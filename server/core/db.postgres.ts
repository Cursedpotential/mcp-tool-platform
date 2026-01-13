// File: server/core/db.postgres.ts | Date: 2026-01-11 | Agent: Claude Code | Model: Opus 4.1
/**
 * PostgreSQL database helper
 * Replaces MySQL connection with PostgreSQL + PGVector support
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ENV } from './env';

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Get PostgreSQL connection client
 */
export async function getPgClient() {
  if (!_client && process.env.DATABASE_URL) {
    try {
      _client = postgres(process.env.DATABASE_URL, {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      
      // Test connection
      await _client`SELECT 1`;
      console.log('[PostgreSQL] Connected successfully');
    } catch (error) {
      console.warn('[PostgreSQL] Failed to connect:', error);
      _client = null;
    }
  }
  return _client;
}

/**
 * Get Drizzle ORM instance with PostgreSQL
 */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    const client = await getPgClient();
    if (client) {
      try {
        _db = drizzle(client);
        console.log('[Drizzle] PostgreSQL instance ready');
      } catch (error) {
        console.warn('[Drizzle] Failed to initialize:', error);
        _db = null;
      }
    }
  }
  return _db;
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
  const start = Date.now();
  try {
    const client = await getPgClient();
    if (!client) {
      return { success: false, error: 'Database client not available' };
    }
    
    await client`SELECT 1`;
    const latency = Date.now() - start;
    
    return { success: true, latency };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Check if PGVector extension is installed
 */
export async function checkPgVector(): Promise<boolean> {
  try {
    const client = await getPgClient();
    if (!client) return false;
    
    const result = await client`SELECT 1 FROM pg_extension WHERE extname = 'vector'`;
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if PostGIS extension is installed
 */
export async function checkPostGIS(): Promise<boolean> {
  try {
    const client = await getPgClient();
    if (!client) return false;
    
    const result = await client`SELECT 1 FROM pg_extension WHERE extname = 'postgis'`;
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check a list of required extensions and return missing ones
 */
export async function checkExtensions(required: string[]): Promise<{ installed: string[]; missing: string[] }> {
  const installed: string[] = [];
  const missing: string[] = [];

  try {
    const client = await getPgClient();
    if (!client) {
      return { installed, missing: required };
    }

    const rows = await client`SELECT extname FROM pg_extension`;
    const present = new Set(rows.map((r: any) => r.extname as string));

    for (const ext of required) {
      if (present.has(ext)) {
        installed.push(ext);
      } else {
        missing.push(ext);
      }
    }

    return { installed, missing };
  } catch (error) {
    console.warn('[PostgreSQL] Failed to check extensions:', error);
    return { installed, missing: required };
  }
}

/**
 * Close database connection
 */
export async function closeDb() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
    console.log('[PostgreSQL] Connection closed');
  }
}
