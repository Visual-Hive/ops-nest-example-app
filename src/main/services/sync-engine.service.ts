import { getDb } from '../db';
import { getStore } from '../store';
import { importFromSheets } from './sheets-import.service';
import { importFromMonday } from './monday-import.service';
import type { ColumnMapping } from '../../shared/models';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;
let lastSyncAt: string | null = null;
let lastError: string | null = null;

export function startSyncEngine(): void {
  const store = getStore();
  const intervalMs = store.get('syncIntervalMs') || 120000;

  if (syncInterval) {
    clearInterval(syncInterval);
  }

  syncInterval = setInterval(() => {
    runSyncCycle().catch((err) => {
      console.error('Sync cycle failed:', err);
      lastError = err.message;
    });
  }, intervalMs);

  console.log(`Sync engine started (interval: ${intervalMs}ms)`);
}

export function stopSyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log('Sync engine stopped');
}

export async function runSyncCycle(): Promise<void> {
  if (isSyncing) {
    console.log('Sync already in progress, skipping');
    return;
  }

  isSyncing = true;
  lastError = null;

  try {
    console.log('Starting sync cycle...');

    // Get active event config
    const event = getActiveEventConfig();
    if (!event) {
      console.log('  No active event configured, skipping sync');
      lastSyncAt = new Date().toISOString();
      return;
    }

    // Step 1: Pull from Google Sheets
    await pullFromSheets(event);

    // Step 2: Pull from Monday.com
    await pullFromMonday(event);

    // Step 3: Pull from Outlook (Phase 4)
    await pullFromOutlook();

    // Step 4: Detect and handle conflicts (Phase 3)
    await detectConflicts();

    // Step 5: Push changes (Phase 3)
    await pushChanges();

    lastSyncAt = new Date().toISOString();
    console.log(`Sync cycle complete at ${lastSyncAt}`);
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'Unknown sync error';
    console.error('Sync cycle error:', lastError);
  } finally {
    isSyncing = false;
  }
}

interface EventConfig {
  id: string;
  sheetsSpreadsheetId?: string;
  sheetsRange?: string;
  columnMapping?: ColumnMapping;
  mondayBoardId?: string;
}

function getActiveEventConfig(): EventConfig | null {
  const store = getStore();
  const activeId = store.get('activeEventId');
  if (!activeId) return null;

  const db = getDb();
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(activeId) as any;
  if (!row) return null;

  let columnMapping: ColumnMapping | undefined;
  if (row.column_mapping) {
    try {
      columnMapping = JSON.parse(row.column_mapping);
    } catch {
      // Invalid mapping
    }
  }

  return {
    id: row.id,
    sheetsSpreadsheetId: row.sheets_spreadsheet_id,
    sheetsRange: row.sheets_range,
    columnMapping,
    mondayBoardId: row.monday_board_id,
  };
}

async function pullFromSheets(event: EventConfig): Promise<void> {
  if (!event.sheetsSpreadsheetId || !event.sheetsRange || !event.columnMapping) {
    console.log('  [Sheets] Not configured, skipping');
    return;
  }

  try {
    const result = await importFromSheets(
      event.id,
      event.sheetsSpreadsheetId,
      event.sheetsRange,
      event.columnMapping
    );
    console.log(
      `  [Sheets] Imported ${result.areasImported} areas, ${result.equipmentImported} equipment items`
    );
  } catch (err) {
    console.error('  [Sheets] Pull failed:', err instanceof Error ? err.message : err);
  }
}

async function pullFromMonday(event: EventConfig): Promise<void> {
  if (!event.mondayBoardId) {
    console.log('  [Monday] Not configured, skipping');
    return;
  }

  try {
    const result = await importFromMonday(event.id, event.mondayBoardId);
    console.log(
      `  [Monday] Imported ${result.areasImported} areas, ${result.equipmentImported} equipment items`
    );
  } catch (err) {
    console.error('  [Monday] Pull failed:', err instanceof Error ? err.message : err);
  }
}

async function pullFromOutlook(): Promise<void> {
  // TODO: Implement in Phase 4
  // 1. Fetch new emails since last sync
  // 2. Match to vendors by email address
  // 3. Classify with Claude
  // 4. Store in emails table
}

async function detectConflicts(): Promise<void> {
  // TODO: Implement in Phase 3
  // 1. Check sync_journal for fields changed in multiple sources
  // 2. Apply conflict resolution policy
  // 3. Create escalations for unresolvable conflicts
}

async function pushChanges(): Promise<void> {
  // TODO: Implement in Phase 3
  // 1. Find local changes not yet pushed
  // 2. Push to appropriate external systems
  // 3. Log in sync_journal
}

export function getSyncStatus(): {
  isRunning: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  error: string | null;
} {
  return {
    isRunning: syncInterval !== null,
    isSyncing,
    lastSyncAt,
    error: lastError,
  };
}
