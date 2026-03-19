import type { IpcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getDb } from '../db';
import { getStore } from '../store';
import { v4 as uuid } from 'uuid';
import type { AppEvent, ColumnMapping } from '../../shared/models';
import { getSheetHeaders } from '../services/sheets-import.service';
import { importFromSheets } from '../services/sheets-import.service';
import { importFromMonday } from '../services/monday-import.service';

export function registerEventsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.EVENTS_LIST, async () => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
    return { events: rows.map(rowToEvent) };
  });

  ipcMain.handle(
    IPC.EVENTS_CREATE,
    async (
      _event,
      name: string,
      date: string,
      config?: {
        mondayBoardId?: string;
        sheetsSpreadsheetId?: string;
        sheetsRange?: string;
        columnMapping?: string;
      }
    ) => {
      const db = getDb();
      const id = uuid();
      db.prepare(
        `INSERT INTO events (id, name, date, monday_board_id, sheets_spreadsheet_id, sheets_range, column_mapping)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        name,
        date,
        config?.mondayBoardId || null,
        config?.sheetsSpreadsheetId || null,
        config?.sheetsRange || null,
        config?.columnMapping || null
      );

      // Auto-select as active
      const store = getStore();
      store.set('activeEventId', id);

      return { success: true, event: { id, name, date } };
    }
  );

  ipcMain.handle(IPC.EVENTS_SELECT, async (_event, eventId: string) => {
    const store = getStore();
    store.set('activeEventId', eventId);
    return { success: true };
  });

  ipcMain.handle(IPC.EVENTS_GET_ACTIVE, async () => {
    const store = getStore();
    const activeId = store.get('activeEventId');
    if (!activeId) {
      return { event: null };
    }
    const db = getDb();
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get(activeId);
    return { event: row ? rowToEvent(row) : null };
  });

  // Update event configuration (sheets, monday board, column mapping)
  ipcMain.handle(
    'events:update',
    async (
      _event,
      eventId: string,
      updates: {
        mondayBoardId?: string;
        sheetsSpreadsheetId?: string;
        sheetsRange?: string;
        columnMapping?: string;
        name?: string;
        date?: string;
      }
    ) => {
      const db = getDb();
      const setClauses: string[] = [];
      const values: unknown[] = [];

      const fieldMap: Record<string, string> = {
        mondayBoardId: 'monday_board_id',
        sheetsSpreadsheetId: 'sheets_spreadsheet_id',
        sheetsRange: 'sheets_range',
        columnMapping: 'column_mapping',
        name: 'name',
        date: 'date',
      };

      for (const [key, value] of Object.entries(updates)) {
        const dbKey = fieldMap[key];
        if (dbKey) {
          setClauses.push(`${dbKey} = ?`);
          values.push(value);
        }
      }

      if (setClauses.length === 0) {
        return { success: false, message: 'No valid fields to update' };
      }

      setClauses.push("updated_at = datetime('now')");
      values.push(eventId);

      db.prepare(
        `UPDATE events SET ${setClauses.join(', ')} WHERE id = ?`
      ).run(...values);

      return { success: true };
    }
  );

  // Sheets helpers
  ipcMain.handle(
    IPC.SHEETS_GET_HEADERS,
    async (_event, spreadsheetId: string, sheetName: string) => {
      try {
        const headers = await getSheetHeaders(spreadsheetId, sheetName);
        return { success: true, headers };
      } catch (err) {
        return {
          success: false,
          headers: [],
          message: err instanceof Error ? err.message : 'Failed to read headers',
        };
      }
    }
  );

  ipcMain.handle(IPC.SHEETS_IMPORT, async (_event, eventId: string) => {
    try {
      const db = getDb();
      const row = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
      if (!row?.sheets_spreadsheet_id || !row?.sheets_range || !row?.column_mapping) {
        return { success: false, message: 'Event not fully configured for Sheets import' };
      }
      const mapping: ColumnMapping = JSON.parse(row.column_mapping);
      const result = await importFromSheets(eventId, row.sheets_spreadsheet_id, row.sheets_range, mapping);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Import failed' };
    }
  });

  // Monday helpers
  ipcMain.handle(IPC.MONDAY_IMPORT, async (_event, eventId: string) => {
    try {
      const db = getDb();
      const row = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
      if (!row?.monday_board_id) {
        return { success: false, message: 'Event not configured with a Monday board' };
      }
      const result = await importFromMonday(eventId, row.monday_board_id);
      return { success: true, ...result };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Import failed' };
    }
  });
}

function rowToEvent(row: any): AppEvent {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    mondayBoardId: row.monday_board_id,
    sheetsSpreadsheetId: row.sheets_spreadsheet_id,
    sheetsRange: row.sheets_range,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
