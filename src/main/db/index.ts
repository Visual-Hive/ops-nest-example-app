import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import { CREATE_TABLES_SQL } from './schema';

let db: Database.Database;

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'opsnest.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(CREATE_TABLES_SQL);

  console.log(`Database initialized at: ${dbPath}`);
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
