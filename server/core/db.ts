// File: server/core/db.ts | Date: 2026-01-18 | SQL.js for local development
import initSqlJs, { Database } from 'sql.js';
import { resolve, dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';

const DB_PATH = resolve(process.env.DATA_ROOT || './data', 'salem.db');

let _db: Database | null = null;
let _SQL: any = null;

// Lazily create the database instance
export async function getDb() {
  if (!_db) {
    try {
      // Ensure data directory exists
      const dataDir = dirname(DB_PATH);
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      // Initialize sql.js
      if (!_SQL) {
        _SQL = await initSqlJs();
      }

      // Load existing database or create new one
      if (existsSync(DB_PATH)) {
        const fileBuffer = readFileSync(DB_PATH);
        _db = new _SQL.Database(fileBuffer);
        console.log(`[Database] Loaded existing SQLite: ${DB_PATH}`);
      } else {
        _db = new _SQL.Database();
        console.log(`[Database] Created new SQLite: ${DB_PATH}`);
      }
    } catch (error) {
      console.warn('[Database] Failed to connect:', error);
      _db = null;
    }
  }
  return _db;
}

// Save database to file
export async function saveDb() {
  if (_db) {
    const data = _db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
    console.log(`[Database] Saved to ${DB_PATH}`);
  }
}

// Execute a query and return results
export async function query(sql: string, params: any[] = []): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Execute without returning results
export async function run(sql: string, params: any[] = []): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  db.run(sql, params);
  await saveDb();
}

// Insert and return last rowid
export async function insert(sql: string, params: any[] = []): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  db.run(sql, params);
  await saveDb();
  
  // Get last insert id
  const result = await query('SELECT last_insert_rowid() as id');
  return result[0]?.id || 0;
}
