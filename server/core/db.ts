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
