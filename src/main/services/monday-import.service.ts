import { getDb } from '../db';
import { getBoardItems } from './monday.service';
import { v4 as uuid } from 'uuid';

/**
 * Import data from a Monday.com board into the local SQLite database.
 * Monday board structure: Groups = Areas, Items = Equipment, Subitems = sub-equipment.
 * Tracks field-level diffs in sync_journal and stores column ID mapping for push.
 */
export async function importFromMonday(
  eventId: string,
  boardId: string
): Promise<{ areasImported: number; equipmentImported: number }> {
  const items = await getBoardItems(boardId);
  if (items.length === 0) {
    return { areasImported: 0, equipmentImported: 0 };
  }

  const db = getDb();

  const groupMap = new Map<string, string>(); // group.id -> area.id
  let areasImported = 0;
  let equipmentImported = 0;

  const findAreaByMonday = db.prepare(
    'SELECT id FROM areas WHERE event_id = ? AND monday_item_id = ?'
  );
  const findAreaByName = db.prepare(
    'SELECT id FROM areas WHERE event_id = ? AND name = ?'
  );
  const insertArea = db.prepare(
    `INSERT INTO areas (id, event_id, name, monday_item_id, status, last_synced_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       monday_item_id = excluded.monday_item_id,
       status = excluded.status,
       last_synced_at = datetime('now'),
       updated_at = datetime('now')`
  );

  const insertEquipment = db.prepare(
    `INSERT INTO equipment (id, area_id, name, quantity_needed, quantity_confirmed, status, monday_subitem_id, vendor_id, notes, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       quantity_needed = excluded.quantity_needed,
       quantity_confirmed = excluded.quantity_confirmed,
       status = excluded.status,
       monday_subitem_id = excluded.monday_subitem_id,
       notes = excluded.notes,
       last_synced_at = datetime('now'),
       updated_at = datetime('now')`
  );

  const findVendor = db.prepare('SELECT id FROM vendors WHERE name = ?');
  const insertVendor = db.prepare(
    `INSERT INTO vendors (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING`
  );

  const getExisting = db.prepare('SELECT * FROM equipment WHERE id = ?');
  const getExistingByMonday = db.prepare(
    'SELECT * FROM equipment WHERE monday_subitem_id = ?'
  );

  const logMonday = db.prepare(
    `INSERT INTO sync_journal (entity_type, entity_id, source, field_name, old_value, new_value)
     VALUES ('equipment', ?, 'monday', ?, ?, ?)`
  );

  // Derive column ID mapping from the first item's columns for push support
  let columnMapStored = false;

  const transaction = db.transaction(() => {
    for (const item of items) {
      const group = item.group;

      // Ensure area exists for this group
      if (!groupMap.has(group.id)) {
        const existing =
          (findAreaByMonday.get(eventId, group.id) as { id: string } | undefined) ||
          (findAreaByName.get(eventId, group.title) as { id: string } | undefined);
        const areaId = existing?.id || uuid();
        groupMap.set(group.id, areaId);

        insertArea.run(areaId, eventId, group.title, group.id, 'pending');
        if (!existing) areasImported++;
      }

      const areaId = groupMap.get(group.id)!;

      // Store column ID mapping from first item
      if (!columnMapStored && item.columnValues.length > 0) {
        const columnMap = deriveColumnMap(item.columnValues);
        db.prepare('UPDATE events SET monday_column_map = ? WHERE id = ?')
          .run(JSON.stringify(columnMap), eventId);
        columnMapStored = true;
      }

      // Extract column values
      const colVals = parseColumnValues(item.columnValues);
      const quantity = colVals.numbers || 0;
      const quantityConfirmed = colVals.numbersConfirmed || 0;
      const status = mapMondayStatus(colVals.status);
      const vendorName = colVals.people || colVals.text;
      const notes = colVals.longText;

      // Resolve or create vendor
      let vendorId: string | null = null;
      if (vendorName) {
        const existingVendor = findVendor.get(vendorName) as { id: string } | undefined;
        if (existingVendor) {
          vendorId = existingVendor.id;
        } else {
          vendorId = uuid();
          insertVendor.run(vendorId, vendorName);
        }
      }

      // Find existing equipment by monday item ID
      const existingEquip = getExistingByMonday.get(item.id) as any;
      const equipId = existingEquip?.id || uuid();

      // Field-level diff tracking
      if (existingEquip) {
        const newFields: Record<string, string> = {
          name: item.name,
          quantity_needed: String(quantity),
          quantity_confirmed: String(quantityConfirmed),
          status: status,
          notes: notes || '',
        };
        for (const [field, newVal] of Object.entries(newFields)) {
          const oldVal = String(existingEquip[field] ?? '');
          if (oldVal !== newVal) {
            logMonday.run(equipId, field, oldVal, newVal);
          }
        }
      }

      insertEquipment.run(
        equipId,
        areaId,
        item.name,
        quantity,
        quantityConfirmed,
        status,
        item.id,
        vendorId,
        notes || null
      );
      equipmentImported++;

      // Also import subitems
      for (const sub of item.subitems) {
        const subColVals = parseColumnValues(sub.columnValues);
        const subExisting = getExistingByMonday.get(sub.id) as any;
        const subId = subExisting?.id || uuid();

        const subQuantity = subColVals.numbers || 0;
        const subQuantityConfirmed = subColVals.numbersConfirmed || 0;
        const subStatus = mapMondayStatus(subColVals.status);
        const subNotes = subColVals.longText;

        // Field-level diff for subitems
        if (subExisting) {
          const newFields: Record<string, string> = {
            name: sub.name,
            quantity_needed: String(subQuantity),
            quantity_confirmed: String(subQuantityConfirmed),
            status: subStatus,
            notes: subNotes || '',
          };
          for (const [field, newVal] of Object.entries(newFields)) {
            const oldVal = String(subExisting[field] ?? '');
            if (oldVal !== newVal) {
              logMonday.run(subId, field, oldVal, newVal);
            }
          }
        }

        insertEquipment.run(
          subId,
          areaId,
          sub.name,
          subQuantity,
          subQuantityConfirmed,
          subStatus,
          sub.id,
          null,
          subNotes || null
        );
        equipmentImported++;
      }
    }
  });

  transaction();

  return { areasImported, equipmentImported };
}

/**
 * Derive a mapping of our field names to Monday column IDs.
 * Uses the same heuristic as parseColumnValues but returns IDs instead of values.
 */
function deriveColumnMap(
  columnValues: Array<{ id: string; title: string; text: string; value: string }>
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const col of columnValues) {
    const title = col.title.toLowerCase();

    if (title.includes('status') && !map['status']) {
      map['status'] = col.id;
    } else if (title.includes('confirm') && title.includes('quant') && !map['quantity_confirmed']) {
      map['quantity_confirmed'] = col.id;
    } else if (
      (title.includes('quant') || title.includes('number') || title.includes('qty')) &&
      !map['quantity_needed']
    ) {
      map['quantity_needed'] = col.id;
    } else if (
      (title.includes('vendor') || title.includes('supplier') || title.includes('people')) &&
      !map['vendor']
    ) {
      map['vendor'] = col.id;
    } else if (
      (title.includes('note') || title.includes('comment') || title.includes('description')) &&
      !map['notes']
    ) {
      map['notes'] = col.id;
    }
  }

  return map;
}

interface ParsedColumns {
  status?: string;
  numbers?: number;
  numbersConfirmed?: number;
  text?: string;
  longText?: string;
  people?: string;
  date?: string;
}

function parseColumnValues(
  columnValues: Array<{ id: string; title: string; text: string; value: string }>
): ParsedColumns {
  const result: ParsedColumns = {};

  for (const col of columnValues) {
    const title = col.title.toLowerCase();
    const text = col.text?.trim();

    if (!text) continue;

    if (title.includes('status')) {
      result.status = text;
    } else if (title.includes('confirm') && title.includes('quant')) {
      result.numbersConfirmed = parseInt(text, 10) || 0;
    } else if (title.includes('quant') || title.includes('number') || title.includes('qty')) {
      result.numbers = parseInt(text, 10) || 0;
    } else if (title.includes('vendor') || title.includes('supplier') || title.includes('people')) {
      result.people = text;
    } else if (title.includes('note') || title.includes('comment') || title.includes('description')) {
      result.longText = text;
    } else if (title.includes('date') || title.includes('deadline')) {
      result.date = text;
    } else if (!result.text) {
      result.text = text;
    }
  }

  return result;
}

function mapMondayStatus(status?: string): string {
  if (!status) return 'not_ordered';
  const lower = status.toLowerCase();
  if (lower.includes('deliver') || lower.includes('done') || lower.includes('complete'))
    return 'delivered';
  if (lower.includes('confirm')) return 'confirmed';
  if (lower.includes('order') || lower.includes('working') || lower.includes('progress'))
    return 'ordered';
  if (lower.includes('stuck') || lower.includes('block')) return 'ordered';
  return 'not_ordered';
}
