/**
 * DuckDB Client - Master Clock & ETL Layer (Tier 1)
 * 
 * Replaces: ChromaDB 72hr working memory + PostgreSQL structured storage
 * Purpose: Embedded analytical database for ingestion log, staging, and write tracking
 * 
 * Architecture:
 * - Master clock: All writes timestamped here first
 * - Staging: Raw data before Pass 1 enrichment
 * - Write tracking: Which tier has what data
 * - Chain of custody: SHA-256 at first touch
 */

import { DuckDBInstance, DuckDBConnection, DuckDBResult } from '@duckdb/node-api';
import { uuidv7 } from 'uuidv7';

// Staging table schemas
export interface IngestionLog {
  id: string;
  source_hash: string; // SHA-256 at first touch
  source_type: string; // 'text', 'image', 'audio', 'video', 'document'
  source_name: string;
  raw_content: string | null; // For text, store directly
  binary_path: string | null; // For binaries, path in LanceDB
  ingested_at: Date;
  pass1_status: 'pending' | 'processing' | 'completed' | 'failed';
  pass1_completed_at: Date | null;
  pass2_status: 'pending' | 'processing' | 'completed' | 'failed';
  pass2_completed_at: Date | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedMessage {
  id: string;
  ingestion_id: string;
  platform: string; // 'sms', 'imessage', 'discord', 'gmail', etc.
  sender: string;
  recipient: string;
  content: string;
  timestamp: Date;
  embedding_status: 'pending' | 'completed';
  entity_status: 'pending' | 'completed';
  created_at: Date;
}

export interface WriteTracking {
  id: string;
  ingestion_id: string;
  duckdb_written: boolean;
  lancedb_written: boolean;
  neo4j_semantic_written: boolean;
  neo4j_temporal_written: boolean;
  mysql_written: boolean;
  last_updated: Date;
}

export interface DuckDBConfig {
  path: string;
  readOnly?: boolean;
}

/**
 * DuckDB Client for forensic vault
 */
export class DuckDBClient {
  private instance: DuckDBInstance | null = null;
  private connection: DuckDBConnection | null = null;
  private config: DuckDBConfig;
  private initialized = false;

  constructor(config?: Partial<DuckDBConfig>) {
    this.config = {
      path: config?.path || process.env.DUCKDB_PATH || './data/duckdb/forensic_vault.db',
      readOnly: config?.readOnly || false
    };
  }

  /**
   * Initialize DuckDB connection and create staging tables
   */
  async initialize(): Promise<boolean> {
    try {
      // Ensure data directory exists
      const fs = await import('fs/promises');
      const path = await import('path');
      const dataDir = path.dirname(this.config.path);
      await fs.mkdir(dataDir, { recursive: true });

      // Create or open database
      this.instance = await DuckDBInstance.create(this.config.path);
      this.connection = await this.instance.connect();

      // Create staging tables
      await this.createTables();

      this.initialized = true;
      console.log('[DuckDB] Initialized at:', this.config.path);
      return true;
    } catch (error) {
      console.error('[DuckDB] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Create staging tables for forensic vault
   */
  private async createTables(): Promise<void> {
    if (!this.connection) throw new Error('Not connected');

    // Ingestion log - tracks all incoming evidence
    await this.connection.run(`
      CREATE TABLE IF NOT EXISTS ingestion_log (
        id VARCHAR PRIMARY KEY,
        source_hash VARCHAR NOT NULL UNIQUE,
        source_type VARCHAR NOT NULL,
        source_name VARCHAR,
        raw_content TEXT,
        binary_path VARCHAR,
        ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        pass1_status VARCHAR DEFAULT 'pending',
        pass1_completed_at TIMESTAMP,
        pass2_status VARCHAR DEFAULT 'pending',
        pass2_completed_at TIMESTAMP,
        metadata JSON
      )
    `);

    // Normalized messages - standardized message format
    await this.connection.run(`
      CREATE TABLE IF NOT EXISTS normalized_messages (
        id VARCHAR PRIMARY KEY,
        ingestion_id VARCHAR NOT NULL,
        platform VARCHAR NOT NULL,
        sender VARCHAR,
        recipient VARCHAR,
        content TEXT,
        timestamp TIMESTAMP,
        embedding_status VARCHAR DEFAULT 'pending',
        entity_status VARCHAR DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ingestion_id) REFERENCES ingestion_log(id)
      )
    `);

    // Write tracking - which tier has what data
    await this.connection.run(`
      CREATE TABLE IF NOT EXISTS write_tracking (
        id VARCHAR PRIMARY KEY,
        ingestion_id VARCHAR NOT NULL UNIQUE,
        duckdb_written BOOLEAN DEFAULT false,
        lancedb_written BOOLEAN DEFAULT false,
        neo4j_semantic_written BOOLEAN DEFAULT false,
        neo4j_temporal_written BOOLEAN DEFAULT false,
        mysql_written BOOLEAN DEFAULT false,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ingestion_id) REFERENCES ingestion_log(id)
      )
    `);

    // Create indexes for common queries
    await this.connection.run(`
      CREATE INDEX IF NOT EXISTS idx_ingestion_hash ON ingestion_log(source_hash)
    `);
    await this.connection.run(`
      CREATE INDEX IF NOT EXISTS idx_ingestion_status ON ingestion_log(pass1_status, pass2_status)
    `);
    await this.connection.run(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON normalized_messages(timestamp)
    `);

    console.log('[DuckDB] Tables created: ingestion_log, normalized_messages, write_tracking');
  }

  /**
   * Generate a Time-Ordered UUIDv7
   */
  generateUUIDv7(): string {
    return uuidv7();
  }

  /**
   * Calculate SHA-256 hash for chain of custody
   */
  async hashContent(content: string | Buffer): Promise<string> {
    const crypto = await import('crypto');
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Log new ingestion with SHA-256 fingerprint
   */
  async logIngestion(
    sourceType: string,
    sourceName: string,
    rawContent: string | null,
    binaryPath: string | null,
    metadata: Record<string, unknown> = {}
  ): Promise<IngestionLog> {
    if (!this.connection) throw new Error('Not connected');

    const id = this.generateUUIDv7();
    
    // Calculate hash at first touch
    const contentToHash = rawContent || binaryPath || '';
    const sourceHash = await this.hashContent(contentToHash);

    await this.connection.run(`
      INSERT INTO ingestion_log (id, source_hash, source_type, source_name, raw_content, binary_path, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, sourceHash, sourceType, sourceName, rawContent, binaryPath, JSON.stringify(metadata)]);

    // Initialize write tracking
    await this.connection.run(`
      INSERT INTO write_tracking (id, ingestion_id, duckdb_written)
      VALUES (?, ?, true)
    `, [this.generateUUIDv7(), id]);

    return this.getIngestionById(id);
  }

  /**
   * Get ingestion by ID
   */
  async getIngestionById(id: string): Promise<IngestionLog> {
    if (!this.connection) throw new Error('Not connected');

    const result = await this.connection.run(`
      SELECT * FROM ingestion_log WHERE id = ?
    `, [id]);

    const rows = result.getRows();
    if (!rows || rows.length === 0) {
      throw new Error(`Ingestion not found: ${id}`);
    }

    return this.rowToIngestionLog(rows[0]);
  }

  /**
   * Get ingestion by source hash
   */
  async getIngestionByHash(hash: string): Promise<IngestionLog | null> {
    if (!this.connection) throw new Error('Not connected');

    const result = await this.connection.run(`
      SELECT * FROM ingestion_log WHERE source_hash = ?
    `, [hash]);

    const rows = result.getRows();
    if (!rows || rows.length === 0) {
      return null;
    }

    return this.rowToIngestionLog(rows[0]);
  }

  /**
   * Update Pass 1 status
   */
  async updatePass1Status(id: string, status: IngestionLog['pass1_status']): Promise<void> {
    if (!this.connection) throw new Error('Not connected');

    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    await this.connection.run(`
      UPDATE ingestion_log 
      SET pass1_status = ?, pass1_completed_at = ?
      WHERE id = ?
    `, [status, completedAt, id]);
  }

  /**
   * Update Pass 2 status
   */
  async updatePass2Status(id: string, status: IngestionLog['pass2_status']): Promise<void> {
    if (!this.connection) throw new Error('Not connected');

    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    await this.connection.run(`
      UPDATE ingestion_log 
      SET pass2_status = ?, pass2_completed_at = ?
      WHERE id = ?
    `, [status, completedAt, id]);
  }

  /**
   * Update write tracking for a tier
   */
  async updateWriteTracking(
    ingestionId: string, 
    tier: 'lancedb' | 'neo4j_semantic' | 'neo4j_temporal' | 'mysql',
    written: boolean = true
  ): Promise<void> {
    if (!this.connection) throw new Error('Not connected');

    const column = `${tier}_written`;
    await this.connection.run(`
      UPDATE write_tracking 
      SET ${column} = ?, last_updated = CURRENT_TIMESTAMP
      WHERE ingestion_id = ?
    `, [written, ingestionId]);
  }

  /**
   * Get pending items for Pass 1
   */
  async getPendingPass1(limit: number = 100): Promise<IngestionLog[]> {
    if (!this.connection) throw new Error('Not connected');

    const result = await this.connection.run(`
      SELECT * FROM ingestion_log 
      WHERE pass1_status = 'pending'
      ORDER BY ingested_at ASC
      LIMIT ?
    `, [limit]);

    const rows = result.getRows() || [];
    return rows.map(this.rowToIngestionLog);
  }

  /**
   * Get pending items for Pass 2 (24hr window elapsed)
   */
  async getPendingPass2(limit: number = 100): Promise<IngestionLog[]> {
    if (!this.connection) throw new Error('Not connected');

    const result = await this.connection.run(`
      SELECT * FROM ingestion_log 
      WHERE pass1_status = 'completed' 
        AND pass2_status = 'pending'
        AND ingested_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
      ORDER BY ingested_at ASC
      LIMIT ?
    `, [limit]);

    const rows = result.getRows() || [];
    return rows.map(this.rowToIngestionLog);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connection) return false;
      await this.connection.run('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.closeSync();
      this.connection = null;
    }
    if (this.instance) {
      await this.instance.closeSync();
      this.instance = null;
    }
    this.initialized = false;
    console.log('[DuckDB] Connection closed');
  }

  /**
   * Convert database row to IngestionLog object
   */
  private rowToIngestionLog(row: any[]): IngestionLog {
    return {
      id: row[0] as string,
      source_hash: row[1] as string,
      source_type: row[2] as string,
      source_name: row[3] as string,
      raw_content: row[4] as string | null,
      binary_path: row[5] as string | null,
      ingested_at: new Date(row[6] as string),
      pass1_status: row[7] as IngestionLog['pass1_status'],
      pass1_completed_at: row[8] ? new Date(row[8] as string) : null,
      pass2_status: row[9] as IngestionLog['pass2_status'],
      pass2_completed_at: row[10] ? new Date(row[10] as string) : null,
      metadata: JSON.parse(row[11] as string || '{}')
    };
  }

  /**
   * Get the underlying connection for advanced queries
   */
  getConnection(): DuckDBConnection | null {
    return this.connection;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
let duckDBInstance: DuckDBClient | null = null;

export function getDuckDBClient(config?: Partial<DuckDBConfig>): DuckDBClient {
  if (!duckDBInstance) {
    duckDBInstance = new DuckDBClient(config);
  }
  return duckDBInstance;
}

export const duckdb = {
  get client() {
    return getDuckDBClient();
  },
  initialize: () => getDuckDBClient().initialize(),
  healthCheck: () => getDuckDBClient().healthCheck(),
  close: () => getDuckDBClient().closeSync()
};
