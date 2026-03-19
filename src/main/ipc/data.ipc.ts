import type { IpcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getDb } from '../db';
import { v4 as uuid } from 'uuid';
import type { Area, Equipment, Vendor, Escalation, SyncConflict } from '../../shared/models';

export function registerDataHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.DATA_GET_AREAS, async (_event, eventId?: string) => {
    const db = getDb();
    const query = eventId
      ? db.prepare('SELECT * FROM areas WHERE event_id = ? ORDER BY name')
      : db.prepare('SELECT * FROM areas ORDER BY name');
    const rows = eventId ? query.all(eventId) : query.all();
    return { areas: rows.map(rowToArea) };
  });

  ipcMain.handle(IPC.DATA_GET_EQUIPMENT, async (_event, areaId: string) => {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM equipment WHERE area_id = ? ORDER BY name')
      .all(areaId);
    return { equipment: rows.map(rowToEquipment) };
  });

  ipcMain.handle(IPC.DATA_GET_VENDORS, async () => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM vendors ORDER BY name').all();
    return { vendors: rows.map(rowToVendor) };
  });

  // Update equipment with local change tracking
  ipcMain.handle(
    IPC.DATA_UPDATE_EQUIPMENT,
    async (_event, id: string, updates: Record<string, unknown>) => {
      const db = getDb();
      const allowed = [
        'name',
        'quantity_needed',
        'quantity_confirmed',
        'vendor_id',
        'status',
        'notes',
      ];
      const setClauses: string[] = [];
      const values: unknown[] = [];

      for (const [key, value] of Object.entries(updates)) {
        const dbKey = camelToSnake(key);
        if (allowed.includes(dbKey)) {
          setClauses.push(`${dbKey} = ?`);
          values.push(value);
        }
      }

      if (setClauses.length === 0) {
        return { success: false, message: 'No valid fields to update' };
      }

      setClauses.push("updated_at = datetime('now')");
      values.push(id);

      // Wrap in transaction: read old values, update, log changes
      const transaction = db.transaction(() => {
        // Read current row for diff
        const currentRow = db
          .prepare('SELECT * FROM equipment WHERE id = ?')
          .get(id) as any;
        if (!currentRow) return { success: false, message: 'Equipment not found' };

        // Run the update
        db.prepare(
          `UPDATE equipment SET ${setClauses.join(', ')} WHERE id = ?`
        ).run(...values);

        // Log per-field changes to sync_journal
        const logChange = db.prepare(
          `INSERT INTO sync_journal (entity_type, entity_id, source, field_name, old_value, new_value)
           VALUES ('equipment', ?, 'local', ?, ?, ?)`
        );

        for (const [key, value] of Object.entries(updates)) {
          const dbKey = camelToSnake(key);
          if (!allowed.includes(dbKey)) continue;
          const oldVal = String(currentRow[dbKey] ?? '');
          const newVal = String(value ?? '');
          if (oldVal !== newVal) {
            logChange.run(id, dbKey, oldVal, newVal);
          }
        }

        return { success: true };
      });

      return transaction();
    }
  );

  ipcMain.handle(IPC.DATA_GET_ESCALATIONS, async () => {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM escalations WHERE status != 'resolved' ORDER BY created_at DESC")
      .all();
    return { escalations: rows.map(rowToEscalation) };
  });

  ipcMain.handle(
    IPC.DATA_RESOLVE_ESCALATION,
    async (_event, id: string, resolution: string) => {
      const db = getDb();
      db.prepare(
        "UPDATE escalations SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?"
      ).run(id);
      db.prepare(
        "INSERT INTO sync_journal (entity_type, entity_id, source, field_name, old_value, new_value) VALUES ('escalation', ?, 'local', 'status', 'open', ?)"
      ).run(id, resolution);
      return { success: true };
    }
  );

  // Get sync conflicts (escalations of type sync_conflict with competing journal entries)
  ipcMain.handle(IPC.DATA_GET_CONFLICTS, async () => {
    const db = getDb();

    // Find open sync_conflict escalations
    const escalations = db
      .prepare(
        "SELECT * FROM escalations WHERE type = 'sync_conflict' AND status != 'resolved' ORDER BY created_at DESC"
      )
      .all() as any[];

    const conflicts: SyncConflict[] = [];

    for (const esc of escalations) {
      // Find the competing journal entries (marked as pending for this escalation)
      const entries = db
        .prepare(
          `SELECT * FROM sync_journal
           WHERE conflict_resolved LIKE ?
           ORDER BY synced_at DESC`
        )
        .all(`pending:escalation:${esc.id}%`) as any[];

      if (entries.length < 2) continue;

      // Get equipment name for display
      let equipmentName: string | undefined;
      if (esc.entity_type === 'equipment') {
        const equip = db
          .prepare('SELECT name FROM equipment WHERE id = ?')
          .get(esc.entity_id) as any;
        equipmentName = equip?.name;
      }

      // Group by unique source, take the most recent entry per source
      const bySource = new Map<string, any>();
      for (const entry of entries) {
        if (!bySource.has(entry.source)) {
          bySource.set(entry.source, entry);
        }
      }
      const sources = [...bySource.values()];
      if (sources.length < 2) continue;

      conflicts.push({
        id: esc.id,
        entityType: esc.entity_type,
        entityId: esc.entity_id,
        fieldName: entries[0].field_name,
        equipmentName,
        sourceA: {
          source: sources[0].source,
          value: sources[0].new_value,
          timestamp: sources[0].synced_at,
        },
        sourceB: {
          source: sources[1].source,
          value: sources[1].new_value,
          timestamp: sources[1].synced_at,
        },
      });
    }

    return { conflicts };
  });

  // Resolve a specific conflict by choosing a source
  ipcMain.handle(
    IPC.DATA_RESOLVE_CONFLICT,
    async (_event, escalationId: string, chosenSource: string) => {
      const db = getDb();

      const transaction = db.transaction(() => {
        // Find the escalation
        const esc = db
          .prepare('SELECT * FROM escalations WHERE id = ?')
          .get(escalationId) as any;
        if (!esc) return { success: false, message: 'Escalation not found' };

        // Find the competing entries
        const entries = db
          .prepare(
            `SELECT * FROM sync_journal WHERE conflict_resolved LIKE ?`
          )
          .all(`pending:escalation:${escalationId}%`) as any[];

        // Find the chosen entry
        const chosen = entries.find((e: any) => e.source === chosenSource);
        if (!chosen) return { success: false, message: 'Source not found in conflict' };

        // Apply the chosen value to the equipment row
        if (esc.entity_type === 'equipment') {
          const dbField = chosen.field_name;
          db.prepare(
            `UPDATE equipment SET ${dbField} = ?, updated_at = datetime('now') WHERE id = ?`
          ).run(chosen.new_value, esc.entity_id);
        }

        // Mark all entries as resolved
        db.prepare(
          `UPDATE sync_journal SET conflict_resolved = ? WHERE conflict_resolved LIKE ?`
        ).run(
          `manual:${chosenSource}`,
          `pending:escalation:${escalationId}%`
        );

        // Resolve the escalation
        db.prepare(
          "UPDATE escalations SET status = 'resolved', resolved_at = datetime('now') WHERE id = ?"
        ).run(escalationId);

        return { success: true };
      });

      return transaction();
    }
  );
}

function rowToArea(row: any): Area {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    sheetsRowId: row.sheets_row_id,
    mondayItemId: row.monday_item_id,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEquipment(row: any): Equipment {
  return {
    id: row.id,
    areaId: row.area_id,
    name: row.name,
    quantityNeeded: row.quantity_needed,
    quantityConfirmed: row.quantity_confirmed,
    vendorId: row.vendor_id,
    status: row.status,
    sheetsCellRef: row.sheets_cell_ref,
    mondaySubitemId: row.monday_subitem_id,
    notes: row.notes,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToVendor(row: any): Vendor {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    mondayContactId: row.monday_contact_id,
    lastContactedAt: row.last_contacted_at,
    createdAt: row.created_at,
  };
}

function rowToEscalation(row: any): Escalation {
  return {
    id: row.id,
    type: row.type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    description: row.description,
    aiRecommendation: row.ai_recommendation,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
