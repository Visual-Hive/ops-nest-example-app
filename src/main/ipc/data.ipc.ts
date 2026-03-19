import type { IpcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getDb } from '../db';
import type { Area, Equipment, Vendor, Escalation } from '../../shared/models';

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

      db.prepare(
        `UPDATE equipment SET ${setClauses.join(', ')} WHERE id = ?`
      ).run(...values);

      return { success: true };
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
      // Log the resolution
      db.prepare(
        "INSERT INTO sync_journal (entity_type, entity_id, source, field_name, old_value, new_value) VALUES ('escalation', ?, 'local', 'status', 'open', ?)"
      ).run(id, resolution);
      return { success: true };
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
