import { getDb } from '../db';
import { readSheetRange } from './sheets.service';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import type { ColumnMapping } from '../../shared/models';

/**
 * Import data from a Google Sheet into the local SQLite database.
 * Uses column mapping to interpret sheet structure.
 */
export async function importFromSheets(
  eventId: string,
  spreadsheetId: string,
  range: string,
  mapping: ColumnMapping
): Promise<{ areasImported: number; equipmentImported: number }> {
  const rows = await readSheetRange(spreadsheetId, range);
  if (rows.length === 0) {
    return { areasImported: 0, equipmentImported: 0 };
  }

  const db = getDb();

  // First row is headers - find column indices from mapping
  const headers = rows[0];
  const colIndex = resolveColumnIndices(headers, mapping);

  // Track areas by name for deduplication
  const areaMap = new Map<string, string>(); // name -> id
  let areasImported = 0;
  let equipmentImported = 0;

  const insertArea = db.prepare(
    `INSERT INTO areas (id, event_id, name, sheets_row_id, status, last_synced_at)
     VALUES (?, ?, ?, ?, 'pending', datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       last_synced_at = datetime('now'),
       updated_at = datetime('now')`
  );

  const insertEquipment = db.prepare(
    `INSERT INTO equipment (id, area_id, name, quantity_needed, quantity_confirmed, status, sheets_cell_ref, vendor_id, notes, last_synced_at)
     VALUES (?, ?, ?, ?, 0, 'not_ordered', ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       quantity_needed = excluded.quantity_needed,
       status = excluded.status,
       notes = excluded.notes,
       last_synced_at = datetime('now'),
       updated_at = datetime('now')`
  );

  const findVendor = db.prepare('SELECT id FROM vendors WHERE name = ?');
  const insertVendor = db.prepare(
    `INSERT INTO vendors (id, name) VALUES (?, ?)
     ON CONFLICT(id) DO NOTHING`
  );

  const upsertSnapshot = db.prepare(
    `INSERT INTO sync_journal (entity_type, entity_id, source, field_name, old_value, new_value)
     VALUES (?, ?, 'sheets', 'import', NULL, ?)`
  );

  // Process data rows (skip header)
  const transaction = db.transaction(() => {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => !cell?.trim())) continue; // skip empty rows

      const areaName = row[colIndex.areaName]?.trim();
      const equipName = row[colIndex.equipmentName]?.trim();

      if (!areaName && !equipName) continue;

      // Ensure area exists
      let areaId: string;
      if (areaName) {
        if (areaMap.has(areaName)) {
          areaId = areaMap.get(areaName)!;
        } else {
          // Check if area already exists for this event
          const existing = db
            .prepare('SELECT id FROM areas WHERE event_id = ? AND name = ?')
            .get(eventId, areaName) as { id: string } | undefined;
          areaId = existing?.id || uuid();
          areaMap.set(areaName, areaId);
          insertArea.run(areaId, eventId, areaName, String(i));
          if (!existing) areasImported++;
        }
      } else {
        // No area name on this row - use the last known area
        const lastArea = [...areaMap.values()].pop();
        if (!lastArea) continue;
        areaId = lastArea;
      }

      // Import equipment if present
      if (equipName) {
        const quantity = parseInt(row[colIndex.quantity] || '0', 10) || 0;
        const status = mapSheetStatus(row[colIndex.status]?.trim());
        const vendorName = row[colIndex.vendor]?.trim();
        const notes = colIndex.notes !== -1 ? row[colIndex.notes]?.trim() : undefined;
        const cellRef = `${columnLetter(colIndex.equipmentName)}${i + 1}`;

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

        // Generate deterministic ID based on event+area+equipment for idempotent imports
        const equipId = deterministicId(eventId, areaId, equipName);

        insertEquipment.run(
          equipId,
          areaId,
          equipName,
          quantity,
          cellRef,
          vendorId,
          notes || null
        );
        equipmentImported++;

        // Log the import
        upsertSnapshot.run('equipment', equipId, JSON.stringify({ name: equipName, quantity, status }));
      }
    }
  });

  transaction();

  return { areasImported, equipmentImported };
}

/**
 * Read sheet headers and return them for column mapping UI
 */
export async function getSheetHeaders(
  spreadsheetId: string,
  sheetName: string
): Promise<string[]> {
  const range = `${sheetName}!1:1`;
  const rows = await readSheetRange(spreadsheetId, range);
  return rows[0] || [];
}

function resolveColumnIndices(
  headers: string[],
  mapping: ColumnMapping
): Record<keyof ColumnMapping, number> {
  const find = (name: string) => {
    const idx = headers.findIndex(
      (h) => h?.trim().toLowerCase() === name?.toLowerCase()
    );
    return idx;
  };

  return {
    areaName: find(mapping.areaName),
    equipmentName: find(mapping.equipmentName),
    quantity: find(mapping.quantity),
    status: find(mapping.status),
    vendor: find(mapping.vendor),
    notes: mapping.notes ? find(mapping.notes) : -1,
  };
}

function mapSheetStatus(status?: string): string {
  if (!status) return 'not_ordered';
  const lower = status.toLowerCase();
  if (lower.includes('deliver')) return 'delivered';
  if (lower.includes('confirm')) return 'confirmed';
  if (lower.includes('order')) return 'ordered';
  if (lower.includes('done') || lower.includes('complete')) return 'delivered';
  return 'not_ordered';
}

function columnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

function deterministicId(eventId: string, areaId: string, equipName: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${eventId}:${areaId}:${equipName}`)
    .digest('hex');
  // Format as UUID-like string for consistency
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
