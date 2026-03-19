import { getDb } from '../db';
import { getStore } from '../store';

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

    // Step 1: Pull from Google Sheets
    await pullFromSheets();

    // Step 2: Pull from Monday.com
    await pullFromMonday();

    // Step 3: Pull from Outlook
    await pullFromOutlook();

    // Step 4: Detect and handle conflicts
    await detectConflicts();

    // Step 5: Push changes to external systems
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

async function pullFromSheets(): Promise<void> {
  // TODO: Implement in Phase 3
  // 1. Read configured sheet ranges
  // 2. Hash-compare each cell against sync_journal
  // 3. Update local DB for changed cells
  console.log('  [Sheets] Pull - not yet implemented');
}

async function pullFromMonday(): Promise<void> {
  // TODO: Implement in Phase 3
  // 1. Query board items via GraphQL
  // 2. Use activity_logs for change detection
  // 3. Update local DB for changed items
  console.log('  [Monday] Pull - not yet implemented');
}

async function pullFromOutlook(): Promise<void> {
  // TODO: Implement in Phase 4
  // 1. Fetch new emails since last sync
  // 2. Match to vendors by email address
  // 3. Classify with Claude
  // 4. Store in emails table
  console.log('  [Outlook] Pull - not yet implemented');
}

async function detectConflicts(): Promise<void> {
  // TODO: Implement in Phase 3
  // 1. Check sync_journal for fields changed in multiple sources
  // 2. Apply conflict resolution policy
  // 3. Create escalations for unresolvable conflicts
  console.log('  [Conflicts] Detection - not yet implemented');
}

async function pushChanges(): Promise<void> {
  // TODO: Implement in Phase 3
  // 1. Find local changes not yet pushed
  // 2. Push to appropriate external systems
  // 3. Log in sync_journal
  console.log('  [Push] Changes - not yet implemented');
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
