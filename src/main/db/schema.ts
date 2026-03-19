export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT,
    monday_board_id TEXT,
    sheets_spreadsheet_id TEXT,
    sheets_range TEXT,
    column_mapping TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id),
    name TEXT NOT NULL,
    sheets_row_id TEXT,
    monday_item_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    area_id TEXT NOT NULL REFERENCES areas(id),
    name TEXT NOT NULL,
    quantity_needed INTEGER NOT NULL DEFAULT 0,
    quantity_confirmed INTEGER NOT NULL DEFAULT 0,
    vendor_id TEXT REFERENCES vendors(id),
    status TEXT NOT NULL DEFAULT 'not_ordered',
    sheets_cell_ref TEXT,
    monday_subitem_id TEXT,
    notes TEXT,
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    monday_contact_id TEXT,
    last_contacted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    outlook_message_id TEXT,
    vendor_id TEXT REFERENCES vendors(id),
    direction TEXT NOT NULL,
    subject TEXT,
    body_preview TEXT,
    body_full TEXT,
    ai_classification TEXT,
    ai_summary TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS draft_emails (
    id TEXT PRIMARY KEY,
    vendor_id TEXT REFERENCES vendors(id),
    in_reply_to TEXT REFERENCES emails(id),
    subject TEXT,
    body TEXT,
    ai_reasoning TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    source TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    conflict_resolved TEXT,
    pushed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS escalations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT NOT NULL,
    ai_recommendation TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sync_journal_source_pushed ON sync_journal(source, pushed_at);
  CREATE INDEX IF NOT EXISTS idx_areas_event ON areas(event_id);
  CREATE INDEX IF NOT EXISTS idx_equipment_area ON equipment(area_id);
  CREATE INDEX IF NOT EXISTS idx_emails_vendor ON emails(vendor_id);
  CREATE INDEX IF NOT EXISTS idx_sync_journal_entity ON sync_journal(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
`;

/**
 * Idempotent migrations for columns added after initial schema.
 * ALTER TABLE ... ADD COLUMN throws if column exists; we catch and ignore.
 */
export const MIGRATIONS = [
  'ALTER TABLE sync_journal ADD COLUMN pushed_at TEXT',
  'ALTER TABLE events ADD COLUMN monday_column_map TEXT',
];
