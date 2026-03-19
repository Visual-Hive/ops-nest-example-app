import { getDb } from '../db';
import { getStore } from '../store';
import { importFromSheets, resolveColumnIndices, columnLetter } from './sheets-import.service';
import { importFromMonday } from './monday-import.service';
import { readSheetRange, writeSheetRange } from './sheets.service';
import { updateItemColumn } from './monday.service';
import {
  fetchRecentEmails,
  isMicrosoftConfigured,
} from './outlook.service';
import {
  classifyEmail,
  runEscalationReview as aiEscalationReview,
  isAnthropicConfigured,
} from './claude.service';
import { v4 as uuid } from 'uuid';
import type { ColumnMapping, Equipment } from '../../shared/models';

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

    // Step 4: Detect and handle conflicts
    await detectConflicts();

    // Step 5: Push local changes to external systems
    await pushChanges(event);

    // Step 6: AI escalation review
    await runPeriodicEscalationReview();

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
  mondayColumnMap?: Record<string, string>;
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

  let mondayColumnMap: Record<string, string> | undefined;
  if (row.monday_column_map) {
    try {
      mondayColumnMap = JSON.parse(row.monday_column_map);
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
    mondayColumnMap,
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
  if (!isMicrosoftConfigured()) {
    console.log('  [Outlook] Not configured, skipping');
    return;
  }

  try {
    const db = getDb();

    // Only fetch emails since last sync
    const sinceDate = lastSyncAt || undefined;
    const emails = await fetchRecentEmails(sinceDate);

    const insertEmail = db.prepare(
      `INSERT OR IGNORE INTO emails (id, outlook_message_id, vendor_id, direction, subject, body_preview, body_full, is_read, sent_at)
       VALUES (?, ?, ?, 'inbound', ?, ?, ?, ?, ?)`
    );

    const findVendorByEmail = db.prepare('SELECT id FROM vendors WHERE email = ?');
    let newCount = 0;

    for (const msg of emails) {
      // Skip if already stored
      const exists = db
        .prepare('SELECT id FROM emails WHERE outlook_message_id = ?')
        .get(msg.id);
      if (exists) continue;

      // Link to vendor by sender email
      const vendor = findVendorByEmail.get(msg.from) as { id: string } | undefined;

      const emailId = uuid();
      insertEmail.run(
        emailId,
        msg.id,
        vendor?.id || null,
        msg.subject,
        msg.bodyPreview,
        msg.body,
        msg.isRead ? 1 : 0,
        msg.receivedAt
      );
      newCount++;

      // Auto-classify with Claude
      if (isAnthropicConfigured()) {
        try {
          const vendorName = vendor
            ? (db.prepare('SELECT name FROM vendors WHERE id = ?').get(vendor.id) as any)?.name
            : undefined;
          const result = await classifyEmail(msg.subject, msg.bodyPreview, vendorName);
          db.prepare(
            'UPDATE emails SET ai_classification = ?, ai_summary = ? WHERE id = ?'
          ).run(result.classification, result.summary, emailId);
        } catch {
          // Classification failed for this email
        }
      }
    }

    console.log(`  [Outlook] Fetched ${newCount} new emails`);
  } catch (err) {
    console.error('  [Outlook] Pull failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Periodic AI escalation review - runs once per sync cycle.
 * Reviews equipment status and recent emails to flag issues.
 */
async function runPeriodicEscalationReview(): Promise<void> {
  if (!isAnthropicConfigured()) return;

  try {
    const db = getDb();

    // Get all equipment
    const equipmentRows = db.prepare('SELECT * FROM equipment').all() as any[];
    if (equipmentRows.length === 0) return;

    const equipment: Equipment[] = equipmentRows.map((e) => ({
      id: e.id,
      areaId: e.area_id,
      name: e.name,
      quantityNeeded: e.quantity_needed,
      quantityConfirmed: e.quantity_confirmed,
      vendorId: e.vendor_id,
      status: e.status,
      notes: e.notes,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));

    // Get recent emails with summaries
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const emailRows = db
      .prepare(
        `SELECT e.*, v.name as vendor_name FROM emails e
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE e.sent_at > ? AND e.ai_summary IS NOT NULL`
      )
      .all(oneDayAgo) as any[];

    const recentEmails = emailRows.map((e) => ({
      vendorName: e.vendor_name || 'Unknown',
      summary: e.ai_summary,
      sentAt: e.sent_at,
    }));

    const issues = await aiEscalationReview(equipment, recentEmails);

    if (issues.length > 0) {
      const insertEsc = db.prepare(
        `INSERT INTO escalations (id, type, description, ai_recommendation, status)
         VALUES (?, ?, ?, ?, 'open')`
      );

      for (const issue of issues) {
        insertEsc.run(uuid(), issue.type, issue.description, issue.recommendation);
      }
      console.log(`  [AI] Created ${issues.length} escalations`);
    }
  } catch (err) {
    console.error('  [AI] Escalation review failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Detect conflicts: find fields changed by multiple sources since last sync.
 * Auto-resolve if timestamps are >5s apart (most recent wins).
 * Create escalation for ambiguous conflicts (within same sync window).
 */
async function detectConflicts(): Promise<void> {
  const db = getDb();
  const syncWindow = lastSyncAt || '1970-01-01T00:00:00.000Z';

  // Find entity+field pairs changed by multiple sources since last sync
  const conflicts = db
    .prepare(
      `SELECT entity_type, entity_id, field_name,
              GROUP_CONCAT(DISTINCT source) as sources,
              COUNT(DISTINCT source) as source_count
       FROM sync_journal
       WHERE synced_at > ?
         AND conflict_resolved IS NULL
         AND source != 'push'
       GROUP BY entity_type, entity_id, field_name
       HAVING source_count > 1`
    )
    .all(syncWindow) as Array<{
    entity_type: string;
    entity_id: string;
    field_name: string;
    sources: string;
    source_count: number;
  }>;

  if (conflicts.length === 0) return;
  console.log(`  [Conflicts] Found ${conflicts.length} potential conflicts`);

  for (const conflict of conflicts) {
    // Get the competing entries
    const entries = db
      .prepare(
        `SELECT * FROM sync_journal
         WHERE entity_type = ? AND entity_id = ? AND field_name = ?
           AND synced_at > ? AND conflict_resolved IS NULL
         ORDER BY synced_at DESC`
      )
      .all(
        conflict.entity_type,
        conflict.entity_id,
        conflict.field_name,
        syncWindow
      ) as any[];

    if (entries.length < 2) continue;

    // Check timestamp spread
    const timestamps = entries.map((e: any) => new Date(e.synced_at).getTime());
    const spread = Math.max(...timestamps) - Math.min(...timestamps);
    const AMBIGUOUS_THRESHOLD_MS = 5000;

    if (spread > AMBIGUOUS_THRESHOLD_MS) {
      // Most recent wins
      applyMostRecentWins(db, conflict, entries);
    } else {
      // Ambiguous: create escalation
      createConflictEscalation(db, conflict, entries);
    }
  }
}

function applyMostRecentWins(
  db: ReturnType<typeof getDb>,
  conflict: { entity_type: string; entity_id: string; field_name: string },
  entries: any[]
): void {
  // Most recent entry (first since sorted DESC)
  const winner = entries[0];

  // Apply the winning value to the entity
  if (conflict.entity_type === 'equipment') {
    db.prepare(
      `UPDATE equipment SET ${conflict.field_name} = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(winner.new_value, conflict.entity_id);
  }

  // Mark all entries as auto-resolved
  const ids = entries.map((e: any) => e.id);
  db.prepare(
    `UPDATE sync_journal SET conflict_resolved = 'auto:most_recent_wins'
     WHERE id IN (${ids.map(() => '?').join(',')})`
  ).run(...ids);

  console.log(
    `  [Conflicts] Auto-resolved ${conflict.field_name} for ${conflict.entity_id} (${winner.source} wins)`
  );
}

function createConflictEscalation(
  db: ReturnType<typeof getDb>,
  conflict: { entity_type: string; entity_id: string; field_name: string },
  entries: any[]
): void {
  // Get equipment name for description
  let entityName = conflict.entity_id;
  if (conflict.entity_type === 'equipment') {
    const equip = db
      .prepare('SELECT name FROM equipment WHERE id = ?')
      .get(conflict.entity_id) as any;
    if (equip) entityName = equip.name;
  }

  // Get the competing values by source
  const bySource = new Map<string, any>();
  for (const entry of entries) {
    if (!bySource.has(entry.source)) {
      bySource.set(entry.source, entry);
    }
  }
  const sources = [...bySource.entries()];

  const description = sources
    .map(([src, e]) => `${src}: "${e.new_value}"`)
    .join(' vs ');

  const escalationId = uuid();
  db.prepare(
    `INSERT INTO escalations (id, type, entity_type, entity_id, description, status)
     VALUES (?, 'sync_conflict', ?, ?, ?, 'open')`
  ).run(
    escalationId,
    conflict.entity_type,
    conflict.entity_id,
    `Conflict on "${entityName}" field "${conflict.field_name}": ${description}`
  );

  // Mark entries as pending escalation
  const ids = entries.map((e: any) => e.id);
  db.prepare(
    `UPDATE sync_journal SET conflict_resolved = ?
     WHERE id IN (${ids.map(() => '?').join(',')})`
  ).run(`pending:escalation:${escalationId}`, ...ids);

  console.log(
    `  [Conflicts] Escalated ${conflict.field_name} for "${entityName}" (${sources.map(([s]) => s).join(' vs ')})`
  );
}

/**
 * Push local changes back to external systems.
 * Finds unpushed sync_journal entries with source='local' and pushes them.
 */
async function pushChanges(event: EventConfig): Promise<void> {
  const db = getDb();

  // Find unpushed local changes
  const unpushed = db
    .prepare(
      `SELECT sj.*, e.sheets_cell_ref, e.monday_subitem_id, e.area_id
       FROM sync_journal sj
       JOIN equipment e ON sj.entity_id = e.id
       WHERE sj.source = 'local'
         AND sj.pushed_at IS NULL
         AND sj.entity_type = 'equipment'
         AND (sj.conflict_resolved IS NULL OR sj.conflict_resolved NOT LIKE 'pending:%')
       ORDER BY sj.synced_at ASC`
    )
    .all() as any[];

  if (unpushed.length === 0) return;
  console.log(`  [Push] ${unpushed.length} local changes to push`);

  // Group by entity_id
  const byEntity = new Map<string, any[]>();
  for (const entry of unpushed) {
    const list = byEntity.get(entry.entity_id) || [];
    list.push(entry);
    byEntity.set(entry.entity_id, list);
  }

  const markPushed = db.prepare(
    "UPDATE sync_journal SET pushed_at = datetime('now') WHERE id = ?"
  );

  // Cache sheet headers for the cycle (one API call)
  let sheetHeaders: string[] | null = null;

  for (const [entityId, entries] of byEntity) {
    const sample = entries[0];

    // Push to Sheets
    if (sample.sheets_cell_ref && event.sheetsSpreadsheetId && event.columnMapping) {
      try {
        if (!sheetHeaders) {
          // Read headers once for the push cycle
          const sheetName = event.sheetsRange?.split('!')[0] || 'Sheet1';
          const headerRows = await readSheetRange(
            event.sheetsSpreadsheetId,
            `${sheetName}!1:1`
          );
          sheetHeaders = headerRows[0] || [];
        }
        await pushToSheets(event, entityId, entries, sheetHeaders);
      } catch (err) {
        console.error(`  [Push] Sheets push failed for ${entityId}:`, err);
        continue; // Don't mark as pushed
      }
    }

    // Push to Monday
    if (sample.monday_subitem_id && event.mondayBoardId && event.mondayColumnMap) {
      try {
        await pushToMonday(event, entityId, entries);
      } catch (err) {
        console.error(`  [Push] Monday push failed for ${entityId}:`, err);
        continue;
      }
    }

    // Mark entries as pushed
    for (const entry of entries) {
      markPushed.run(entry.id);
    }
  }
}

/**
 * Push local changes for one equipment item back to Google Sheets.
 */
async function pushToSheets(
  event: EventConfig,
  entityId: string,
  entries: any[],
  headers: string[]
): Promise<void> {
  const db = getDb();
  const equip = db
    .prepare('SELECT * FROM equipment WHERE id = ?')
    .get(entityId) as any;
  if (!equip?.sheets_cell_ref || !event.columnMapping) return;

  // Parse row number from sheets_cell_ref (e.g., "B5" -> 5)
  const rowMatch = equip.sheets_cell_ref.match(/(\d+)$/);
  if (!rowMatch) return;
  const rowNum = rowMatch[1];

  // Resolve column indices from headers
  const colIndices = resolveColumnIndices(headers, event.columnMapping);

  // Map our DB field names to the ColumnMapping keys
  const fieldToMappingKey: Record<string, keyof ColumnMapping> = {
    name: 'equipmentName',
    quantity_needed: 'quantity',
    status: 'status',
    notes: 'notes',
  };

  const sheetName = event.sheetsRange?.split('!')[0] || 'Sheet1';

  for (const entry of entries) {
    const mappingKey = fieldToMappingKey[entry.field_name];
    if (!mappingKey) continue;

    const colIdx = colIndices[mappingKey];
    if (colIdx === undefined || colIdx < 0) continue;

    const colLetter = columnLetter(colIdx);
    const cellRef = `${sheetName}!${colLetter}${rowNum}`;

    await writeSheetRange(event.sheetsSpreadsheetId!, cellRef, [[entry.new_value]]);
    console.log(`  [Push] Sheets: wrote ${entry.field_name}="${entry.new_value}" to ${cellRef}`);
  }
}

/**
 * Push local changes for one equipment item back to Monday.com.
 */
async function pushToMonday(
  event: EventConfig,
  entityId: string,
  entries: any[]
): Promise<void> {
  const db = getDb();
  const equip = db
    .prepare('SELECT * FROM equipment WHERE id = ?')
    .get(entityId) as any;
  if (!equip?.monday_subitem_id || !event.mondayColumnMap || !event.mondayBoardId) return;

  for (const entry of entries) {
    const columnId = event.mondayColumnMap[entry.field_name];
    if (!columnId) continue;

    await updateItemColumn(
      event.mondayBoardId,
      equip.monday_subitem_id,
      columnId,
      entry.new_value
    );
    console.log(
      `  [Push] Monday: wrote ${entry.field_name}="${entry.new_value}" to column ${columnId}`
    );
  }
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
