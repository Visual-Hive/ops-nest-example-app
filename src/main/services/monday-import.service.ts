import { getDb } from '../db';
import { getBoardItems } from './monday.service';
import { v4 as uuid } from 'uuid';

/**
 * Import data from a Monday.com board into the local SQLite database.
 * Monday board structure: Groups = Areas, Items = Equipment, Subitems = sub-equipment
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

  // Track groups as areas
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

        insertArea.run(
          areaId,
          eventId,
          group.title,
          group.id,
          'pending'
        );
        if (!existing) areasImported++;
      }

      const areaId = groupMap.get(group.id)!;

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
      const existingEquip = db
        .prepare('SELECT id FROM equipment WHERE monday_subitem_id = ?')
        .get(item.id) as { id: string } | undefined;
      const equipId = existingEquip?.id || uuid();

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

      // Also import subitems as equipment under the same area
      for (const sub of item.subitems) {
        const subColVals = parseColumnValues(sub.columnValues);
        const subExisting = db
          .prepare('SELECT id FROM equipment WHERE monday_subitem_id = ?')
          .get(sub.id) as { id: string } | undefined;
        const subId = subExisting?.id || uuid();

        insertEquipment.run(
          subId,
          areaId,
          sub.name,
          subColVals.numbers || 0,
          subColVals.numbersConfirmed || 0,
          mapMondayStatus(subColVals.status),
          sub.id,
          null,
          subColVals.longText || null
        );
        equipmentImported++;
      }
    }
  });

  transaction();

  return { areasImported, equipmentImported };
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
  if (lower.includes('deliver') || lower.includes('done') || lower.includes('complete')) return 'delivered';
  if (lower.includes('confirm')) return 'confirmed';
  if (lower.includes('order') || lower.includes('working') || lower.includes('progress')) return 'ordered';
  if (lower.includes('stuck') || lower.includes('block')) return 'ordered';
  return 'not_ordered';
}
