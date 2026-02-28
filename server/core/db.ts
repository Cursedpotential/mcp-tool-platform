// File: server/core/db.ts
// Date: 2026-02-28
// Multi-System Database Router for 5-Tier Architecture

import { getMySqlDb, testMySqlConnection, closeMySql } from './db.mysql';
import { getDuckDBClient } from '../mcp/storage/duckdb';
import { getLanceDbClient } from '../mcp/storage/lancedb';
import { graphitiClient } from '../mcp/storage/graphiti-client';

// ============================================================================
// DATABASE ROLE DEFINITIONS
// ============================================================================

export const DATABASE_ROLES = {
  /** Tier 5: MySQL (Application State, Users, Settings, Index) */
  CONTROL_PLANE: 'control_plane',

  /** Tier 1: DuckDB (First-touch, Hashes, Embedded SQL) */
  EVIDENCE_VAULT: 'evidence_vault',

  /** Tier 2: LanceDB (Zero-copy Vector embeddings) */
  VECTOR_VAULT: 'vector_vault',

  /** Tier 3 & 4: Neo4j (Temporal Graph + Semantica) */
  GRAPH_VAULT: 'graph_vault'
} as const;

export type DatabaseRole = typeof DATABASE_ROLES[keyof typeof DATABASE_ROLES];

// ============================================================================
// MYSQL APPLICATION DB (Tier 5 - Control Plane)
// ============================================================================

export async function getAppDb() {
  return await getMySqlDb();
}

export async function testAppConnection() {
  return await testMySqlConnection();
}

export async function closeApp() {
  return await closeMySql();
}

// ============================================================================
// DUCKDB (Tier 1 - Evidence Vault)
// ============================================================================

export function getEvidenceDb() {
  return getDuckDBClient();
}

// ============================================================================
// LANCEDB (Tier 2 - Vector Vault)
// ============================================================================

export function getVectorDb() {
  return getLanceDbClient();
}

// ============================================================================
// NEO4J GRAPH (Tiers 3 & 4 - Graph Vault)
// ============================================================================

export function getTemporalGraph() {
  return graphitiClient;
}

// ============================================================================
// INITIALIZATION HOOK
// ============================================================================

export async function initAllDatabases() {
  console.log('[DB Router] Initializing 5-Tier Database Architecture...');
  
  // 1. Initialize Control Plane
  const mysqlResult = await testMySqlConnection();
  
  // 2. Initialize Embedded Databases (DuckDB & LanceDB)
  const duckdb = getEvidenceDb();
  if (!duckdb.isInitialized()) {
    await duckdb.initialize();
  }
  
  const lancedb = getVectorDb();
  await lancedb.initialize();
  
  // 3. Initialize Graph Connection
  const neo4jResult = await graphitiClient.testConnection();

  return {
    mysql: mysqlResult.success,
    duckdb: duckdb.isInitialized(),
    lancedb: lancedb.isInitialized(),
    neo4j: neo4jResult.success
  };
}

export async function closeAll() {
  await Promise.all([
    closeApp(),
    getEvidenceDb().close(),
    graphitiClient.close()
  ]);
}
