// File: server/core/db.ts
// Date: 2026-01-18
// Multi-System Database Router for Salem Forensic Trinity

// @ts-ignore
declare module 'sql.js';

import { getPgClient, getDb as getPgDb, testConnection, checkPgVector, closeDb as closePg } from './db.postgres';
import { graphitiClient } from '../mcp/storage/graphiti-client';
import { chromaManager } from '../mcp/storage/chroma-client';
import { createDirectusClient } from '../mcp/storage/directus-client';

// ============================================================================
// DATABASE ROLE DEFINITIONS
// ============================================================================

export const DATABASE_ROLES = {
  /** PostgreSQL + PGVector (VPS1): Structured data and semantic embeddings */
  PRIMARY: 'primary',

  /** Neo4j + Graphiti: Temporal knowledge graph (Zep-style) */
  TEMPORAL_GRAPH: 'temporal_graph',

  /** ChromaDB (VPS2): Short-term working memory (72hr TTL) */
  WORKING_MEMORY: 'working_memory',

  /** Directus CMS (VPS1): Binary file vault */
  FILE_VAULT: 'file_vault',

  /** Scratch work (local SQLite for dev) */
  SCRATCH: 'scratch'
} as const;

export type DatabaseRole = typeof DATABASE_ROLES[keyof typeof DATABASE_ROLES];

// ============================================================================
// CONNECTION STATE
// ============================================================================

let _directusClient: any = null;
let _sqliteDb: any = null;

// ============================================================================
// POSTGRESQL + PGVECTOR (VPS1 - PRIMARY)
// ============================================================================

export async function getPrimaryDb() {
  return await getPgDb();
}

export async function getPrimaryClient() {
  return await getPgClient();
}

export async function testPrimaryConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
  return await testConnection();
}

export async function isPgVectorReady(): Promise<boolean> {
  return await checkPgVector();
}

// ============================================================================
// NEO4J + GRAPHITI (TEMPORAL KNOWLEDGE GRAPH)
// ============================================================================

export interface GraphitiConfig {
  uri: string;
  username: string;
  password: string;
}

export async function getTemporalGraphClient(): Promise<any> {
  return graphitiClient;
}

export async function testTemporalConnection(): Promise<{ success: boolean; error?: string }> {
  return await graphitiClient.testConnection();
}

// ============================================================================
// CHROMADB (VPS2 - WORKING MEMORY, 72hr TTL)
// ============================================================================

export interface ChromaConfig {
  url: string;
  collectionName: string;
}

export async function getWorkingMemoryClient(): Promise<any> {
  return chromaManager;
}

export async function testWorkingMemoryConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const success = await chromaManager.healthCheck();
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// DIRECTUS CMS (VPS1 - FILE VAULT)
// ============================================================================

export interface DirectusConfig {
  url: string;
  email: string;
  password: string;
}

export async function getFileVaultClient(): Promise<any> {
  if (!_directusClient) {
    _directusClient = createDirectusClient();
  }
  return _directusClient;
}

export async function testFileVaultConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getFileVaultClient();
    const success = await client.healthCheck();
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// SCRATCH WORK (SQLite - Local Dev)
// ============================================================================

let _SQL: any = null;
const SQLITE_PATH = process.env.SQLITE_PATH || './data/salem_scratch.db';

async function initSqlite(): Promise<any> {
  if (!_SQL) {
    const initSqlJs = (await import('sql.js')).default;
    _SQL = await initSqlJs();
  }
  return _SQL;
}

export async function getScratchDb(): Promise<any> {
  if (!_sqliteDb) {
    const SQL = await initSqlite();
    const { existsSync, readFileSync, mkdirSync } = await import('fs');
    const { dirname, resolve } = await import('path');

    const dbPath = resolve(SQLITE_PATH);
    const dataDir = dirname(dbPath);

    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    if (existsSync(dbPath)) {
      const fileBuffer = readFileSync(dbPath);
      _sqliteDb = new SQL(fileBuffer);
    } else {
      _sqliteDb = new SQL.Database();
    }

    console.log('[Database] Scratch SQLite initialized');
  }
  return _sqliteDb;
}

// ============================================================================
// MULTI-SYSTEM ROUTER
// ============================================================================

/**
 * Route database operations based on data type and retention requirements
 * Implements the 3-Tier Memory Architecture from SSoT
 */
export function getDatabaseForOperation(operation: {
  /** Type of data being stored/queried */
  type: 'messages' | 'documents' | 'entities' | 'relationships' | 'embeddings' | 'files' | 'context' | 'scratch';
  /** How long the data should be retained */
  retention: 'temporary' | 'short_term' | 'permanent';
  /** Whether this is a vector search operation */
  isVectorSearch?: boolean;
  /** Whether this requires graph traversal */
  isGraphQuery?: boolean;
}): DatabaseRole {

  // Vector embeddings → PostgreSQL (PGVector)
  if (operation.isVectorSearch || operation.type === 'embeddings') {
    return DATABASE_ROLES.PRIMARY;
  }

  // Graph queries (entities, relationships) → Neo4j/Graphiti
  if (operation.isGraphQuery || operation.type === 'entities' || operation.type === 'relationships') {
    return DATABASE_ROLES.TEMPORAL_GRAPH;
  }

  // Short-term evidence processing → Chroma (72hr TTL)
  if (operation.retention === 'short_term' || operation.type === 'context') {
    return DATABASE_ROLES.WORKING_MEMORY;
  }

  // Full files (PDF, images, exports) → Directus
  if (operation.type === 'files' || operation.type === 'documents') {
    return DATABASE_ROLES.FILE_VAULT;
  }

  // Scratch work for local dev → SQLite
  if (operation.type === 'scratch' || operation.retention === 'temporary') {
    return DATABASE_ROLES.SCRATCH;
  }

  // Default: Structured data → PostgreSQL
  return DATABASE_ROLES.PRIMARY;
}

/**
 * Get appropriate database client for a given role
 */
export async function getDatabaseClient(role: DatabaseRole): Promise<any> {
  switch (role) {
    case DATABASE_ROLES.PRIMARY:
      return await getPrimaryDb();

    case DATABASE_ROLES.TEMPORAL_GRAPH:
      return await getTemporalGraphClient();

    case DATABASE_ROLES.WORKING_MEMORY:
      return await getWorkingMemoryClient();

    case DATABASE_ROLES.FILE_VAULT:
      return await getFileVaultClient();

    case DATABASE_ROLES.SCRATCH:
      return await getScratchDb();

    default:
      throw new Error(`Unknown database role: ${role}`);
  }
}

// ============================================================================
// INITIALIZATION & HEALTH CHECKS
// ============================================================================

export interface DatabaseHealth {
  primary: boolean;
  temporalGraph: boolean;
  workingMemory: boolean;
  fileVault: boolean;
  scratch: boolean;
}

export async function initAllDatabases(): Promise<DatabaseHealth> {
  const health: DatabaseHealth = {
    primary: false,
    temporalGraph: false,
    workingMemory: false,
    fileVault: false,
    scratch: false
  };

  // Test Primary (PostgreSQL)
  try {
    const result = await testPrimaryConnection();
    health.primary = result.success;
    console.log(`[Database] ${health.primary ? '✓' : '✗'} Primary (PostgreSQL + PGVector)`);
  } catch (error) {
    console.log(`[Database] ✗ Primary (PostgreSQL): ${error}`);
  }

  // Test Temporal Graph (Neo4j/Graphiti)
  try {
    const result = await testTemporalConnection();
    health.temporalGraph = result.success;
    console.log(`[Database] ${health.temporalGraph ? '✓' : '✗'} Temporal Graph (Neo4j/Graphiti)`);
  } catch (error) {
    console.log(`[Database] ✗ Temporal Graph: ${error}`);
  }

  // Test Working Memory (Chroma)
  try {
    const result = await testWorkingMemoryConnection();
    health.workingMemory = result.success;
    console.log(`[Database] ${health.workingMemory ? '✓' : '✗'} Working Memory (Chroma VPS)`);
  } catch (error) {
    console.log(`[Database] ✗ Working Memory: ${error}`);
  }

  // Test File Vault (Directus)
  try {
    const result = await testFileVaultConnection();
    health.fileVault = result.success;
    console.log(`[Database] ${health.fileVault ? '✓' : '✗'} File Vault (Directus)`);
  } catch (error) {
    console.log(`[Database] ✗ File Vault: ${error}`);
  }

  // Initialize Scratch (SQLite)
  try {
    await getScratchDb();
    health.scratch = true;
    console.log(`[Database] ✓ Scratch (SQLite)`);
  } catch (error) {
    console.log(`[Database] ✗ Scratch: ${error}`);
  }

  return health;
}

export async function closeAllConnections(): Promise<void> {
  await closePg();
  _directusClient = null;
  _sqliteDb = null;
  console.log('[Database] All connections closed');
}

// Re-export from postgres module
export { checkPgVector, testConnection as testPgConnection };

// ============================================================================
// BACKWARD COMPATIBILITY LAYER (SQLite Scratch Work)
// These functions maintain compatibility with existing code that uses SQLite
// ============================================================================

const DB_PATH = process.env.DATA_ROOT || './data';

/**
 * Get SQLite database instance (backward compatibility wrapper for scratch work)
 */
export async function getDb() {
  return await getScratchDb();
}

/**
 * Save SQLite database to file
 */
export async function saveDb() {
  const db = await getScratchDb();
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    const { writeFileSync, mkdirSync } = await import('fs');
    const { dirname, resolve } = await import('path');
    const dbPath = resolve(DB_PATH, 'salem.db');
    const dataDir = dirname(dbPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    writeFileSync(dbPath, buffer);
    console.log(`[Database] Saved scratch SQLite to ${dbPath}`);
  }
}

/**
 * Execute a query and return results (SQLite)
 */
export async function query(sql: string, params: any[] = []): Promise<any[]> {
  const db = await getScratchDb();
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

/**
 * Execute without returning results (SQLite)
 */
export async function run(sql: string, params: any[] = []): Promise<void> {
  const db = await getScratchDb();
  if (!db) throw new Error('Database not available');
  db.run(sql, params);
  await saveDb();
}

/**
 * Insert and return last rowid (SQLite)
 */
export async function insert(sql: string, params: any[] = []): Promise<number> {
  const db = await getScratchDb();
  if (!db) throw new Error('Database not available');
  db.run(sql, params);
  await saveDb();

  const result = await query('SELECT last_insert_rowid() as id');
  return result[0]?.id || 0;
}

// Helper for saveDb
async function existsSync(path: string): Promise<boolean> {
  try {
    const { statSync } = await import('fs');
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
