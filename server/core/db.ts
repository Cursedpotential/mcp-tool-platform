// File: server/core/db.ts
// Date: 2026-01-22
// Multi-System Database Router for Salem Forensic Trinity

// @ts-ignore
declare module 'sql.js';

import { getPgClient, getDb as getPgDb, testConnection, checkPgVector, closeDb as closePg } from './db.postgres';
import { getMySqlDb, testMySqlConnection, closeMySql } from './db.mysql';
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
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Convenience export for legacy code expecting a 'db' object
 */
export const db = {
  get primary() { return getPgDb(); },
  get mysql() { return getMySqlDb(); },
};

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

export async function closePrimary() {
  return await closePg();
}

// ============================================================================
// MYSQL APPLICATION DB (VPS3)
// ============================================================================

export async function getAppDb() {
  return await getMySqlDb();
}

export async function testAppConnection(): Promise<{ success: boolean; latency?: number; error?: string }> {
  return await testMySqlConnection();
}

export async function closeApp() {
  return await closeMySql();
}

// ============================================================================
// DYNAMIC DATABASE ROUTER
// ============================================================================

/**
 * Common entry point for tRPC routers and services
 */
export async function getDb(role: DatabaseRole = DATABASE_ROLES.PRIMARY) {
  switch (role) {
    case DATABASE_ROLES.PRIMARY:
      return await getPrimaryDb();
    default:
      return await getPrimaryDb();
  }
}

// ============================================================================
// GRAPHITI + NEO4J (VPS1 - TEMPORAL GRAPH)
// ============================================================================

export function getGraphDb() {
  return graphitiClient;
}

// ============================================================================
// CHROMA + WORKING MEMORY (VPS2)
// ============================================================================

export function getVectorStore() {
  return chromaManager;
}

// ============================================================================
// DIRECTUS + FILE VAULT (VPS1)
// ============================================================================

export function getFileVault() {
  if (!_directusClient) {
    _directusClient = createDirectusClient();
  }
  return _directusClient;
}

// ============================================================================
// LEGACY / UTILS
// ============================================================================

export async function closeAll() {
  await Promise.all([
    closePrimary(),
    closeApp(),
    graphitiClient.close()
  ]);
}

// ============================================================================
// MISSING EXPORTS - Added to fix TypeScript errors
// ============================================================================

/**
 * Execute a raw SQL query against PostgreSQL
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const client = await getPgClient();
  if (!client) {
    throw new Error('PostgreSQL client not available');
  }
  // For raw queries, use tagged template or unsafe
  return client.unsafe(sql, params) as Promise<T[]>;
}

/**
 * Get database client by role
 */
export async function getDatabaseClient(role: DatabaseRole = DATABASE_ROLES.PRIMARY) {
  switch (role) {
    case DATABASE_ROLES.PRIMARY:
      return await getPgClient();
    case DATABASE_ROLES.TEMPORAL_GRAPH:
      return graphitiClient;
    case DATABASE_ROLES.WORKING_MEMORY:
      return chromaManager;
    case DATABASE_ROLES.FILE_VAULT:
      return getFileVault();
    default:
      return await getPgClient();
  }
}

/**
 * Initialize all database connections
 */
export async function initAllDatabases(): Promise<{
  postgres: boolean;
  mysql: boolean;
  neo4j: boolean;
  chroma: boolean;
}> {
  const [pgResult, mysqlResult, neo4jResult] = await Promise.allSettled([
    testPrimaryConnection(),
    testAppConnection(),
    graphitiClient.testConnection()
  ]);

  return {
    postgres: pgResult.status === 'fulfilled' && pgResult.value.success,
    mysql: mysqlResult.status === 'fulfilled' && mysqlResult.value.success,
    neo4j: neo4jResult.status === 'fulfilled' && neo4jResult.value.success,
    chroma: true // ChromaDB doesn't have test connection yet
  };
}

/**
 * Get database for a specific operation type
 */
export async function getDatabaseForOperation(operation: 'read' | 'write' | 'search' | 'graph') {
  switch (operation) {
    case 'read':
    case 'write':
      return await getPrimaryDb();
    case 'search':
      return chromaManager;
    case 'graph':
      return graphitiClient;
    default:
      return await getPrimaryDb();
  }
}

/**
 * Upsert user record
 */
export async function upsertUser(userData: {
  openId: string;
  name?: string;
  email?: string;
  loginMethod?: string;
}): Promise<any> {
  const db = await getPrimaryDb();
  if (!db) throw new Error('Database not available');
  
  // Import users table dynamically to avoid circular deps
  const { users } = await import('../../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  const existing = await db.select().from(users).where(eq(users.openId, userData.openId));
  
  if (existing.length > 0) {
    // Update existing user
    await db.update(users)
      .set({ 
        name: userData.name,
        email: userData.email,
        lastSignedIn: new Date().toISOString()
      })
      .where(eq(users.openId, userData.openId));
    return existing[0];
  } else {
    // Insert new user
    const result = await db.insert(users).values({
      openId: userData.openId,
      name: userData.name || null,
      email: userData.email || null,
      loginMethod: userData.loginMethod || null,
    }).returning();
    return result[0];
  }
}

/**
 * Get user by OpenID
 */
export async function getUserByOpenId(openId: string): Promise<any | null> {
  const db = await getPrimaryDb();
  if (!db) return null;
  
  const { users } = await import('../../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  const result = await db.select().from(users).where(eq(users.openId, openId));
  return result.length > 0 ? result[0] : null;
}
