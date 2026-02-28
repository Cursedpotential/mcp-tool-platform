/**
 * LanceDB Client - Multimodal Vault (Tier 2)
 * 
 * Replaces: Qdrant/pgvector for vectors + Directus for binary storage
 * Purpose: Embedded vector database for embeddings and raw binary content
 * 
 * Architecture:
 * - Embeddings collection: Text vectors for semantic search
 * - Raw binaries collection: Images, audio, video, documents
 * - Arrow integration: Direct data exchange with DuckDB
 */

import * as lancedb from '@lancedb/lancedb';
import { Table, Schema, Field, Float32, Utf8, Binary, Timestamp, Int64 } from 'apache-arrow';

// Schema definitions
export interface EmbeddingRecord {
  id: string;
  source_hash: string; // SHA-256 from DuckDB
  embedding_vector: Float32Array;
  text_content: string;
  embedding_model: string; // e.g., 'nomic-embed-text'
  dimension: number; // e.g., 768
  created_at: Date;
  metadata: Record<string, unknown>;
}

export interface RawBinaryRecord {
  id: string;
  source_hash: string; // SHA-256 from DuckDB
  content_type: string; // MIME type
  binary_data: Uint8Array;
  extracted_text: string | null; // OCR/transcription result
  thumbnail: Uint8Array | null; // For images/videos
  created_at: Date;
  metadata: Record<string, unknown>;
}

export interface LanceDBConfig {
  path: string;
}

const EMBEDDING_DIMENSION = 768; // nomic-embed-text dimension
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

/**
 * LanceDB Client for forensic vault
 */
export class LanceDBClient {
  private db: lancedb.Connection | null = null;
  private embeddingsTable: lancedb.Table | null = null;
  private binariesTable: lancedb.Table | null = null;
  private config: LanceDBConfig;
  private initialized = false;

  constructor(config?: Partial<LanceDBConfig>) {
    this.config = {
      path: config?.path || process.env.LANCEDB_PATH || './data/lancedb/multimodal_vault'
    };
  }

  /**
   * Initialize LanceDB connection and create collections
   */
  async initialize(): Promise<boolean> {
    try {
      // Ensure data directory exists
      const fs = await import('fs/promises');
      const path = await import('path');
      await fs.mkdir(path.dirname(this.config.path), { recursive: true });

      // Open or create database
      this.db = await lancedb.connect(this.config.path);

      // Create embeddings table if not exists
      try {
        this.embeddingsTable = await this.db.openTable('embeddings');
        console.log('[LanceDB] Opened existing embeddings table');
      } catch {
        // Table doesn't exist, create it with initial schema
        const initialData = [{
          id: '__schema_init__',
          source_hash: '',
          embedding_vector: new Float32Array(EMBEDDING_DIMENSION),
          text_content: '',
          embedding_model: DEFAULT_EMBEDDING_MODEL,
          dimension: EMBEDDING_DIMENSION,
          created_at: new Date(),
          metadata: {}
        }];
        this.embeddingsTable = await this.db.createTable('embeddings', initialData);
        // Delete the schema init record
        await this.embeddingsTable.delete('id = "__schema_init__"');
        console.log('[LanceDB] Created embeddings table');
      }

      // Create binaries table if not exists
      try {
        this.binariesTable = await this.db.openTable('raw_binaries');
        console.log('[LanceDB] Opened existing raw_binaries table');
      } catch {
        // Table doesn't exist, create it
        const initialData = [{
          id: '__schema_init__',
          source_hash: '',
          content_type: '',
          binary_data: new Uint8Array(0),
          extracted_text: null,
          thumbnail: null,
          created_at: new Date(),
          metadata: {}
        }];
        this.binariesTable = await this.db.createTable('raw_binaries', initialData);
        // Delete the schema init record
        await this.binariesTable.delete('id = "__schema_init__"');
        console.log('[LanceDB] Created raw_binaries table');
      }

      this.initialized = true;
      console.log('[LanceDB] Initialized at:', this.config.path);
      return true;
    } catch (error) {
      console.error('[LanceDB] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Store embedding vector
   */
  async storeEmbedding(
    sourceHash: string,
    embeddingVector: Float32Array,
    textContent: string,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    if (!this.embeddingsTable) throw new Error('Embeddings table not initialized');

    const { randomUUID } = await import('crypto');
    const id = randomUUID();

    const record: EmbeddingRecord = {
      id,
      source_hash: sourceHash,
      embedding_vector: embeddingVector,
      text_content: textContent,
      embedding_model: DEFAULT_EMBEDDING_MODEL,
      dimension: embeddingVector.length,
      created_at: new Date(),
      metadata
    };

    await this.embeddingsTable.add([record]);
    return id;
  }

  /**
   * Store binary content (image, audio, video, document)
   */
  async storeBinary(
    sourceHash: string,
    contentType: string,
    binaryData: Uint8Array,
    extractedText: string | null = null,
    thumbnail: Uint8Array | null = null,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    if (!this.binariesTable) throw new Error('Binaries table not initialized');

    const { randomUUID } = await import('crypto');
    const id = randomUUID();

    const record: RawBinaryRecord = {
      id,
      source_hash: sourceHash,
      content_type: contentType,
      binary_data: binaryData,
      extracted_text: extractedText,
      thumbnail,
      created_at: new Date(),
      metadata
    };

    await this.binariesTable.add([record]);
    return id;
  }

  /**
   * Search embeddings by vector similarity
   */
  async searchEmbeddings(
    queryVector: Float32Array,
    limit: number = 10,
    minScore: number = 0.7
  ): Promise<Array<{ record: EmbeddingRecord; score: number }>> {
    if (!this.embeddingsTable) throw new Error('Embeddings table not initialized');

    // LanceDB vector search
    const results = await this.embeddingsTable
      .vectorSearch(queryVector)
      .limit(limit)
      .toArray();

    // Convert results and calculate similarity scores
    return results
      .filter((r: any) => r.id !== '__schema_init__')
      .map((r: any) => ({
        record: this.toEmbeddingRecord(r),
        score: this.cosineSimilarity(queryVector, new Float32Array(r.embedding_vector))
      }))
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get embedding by source hash
   */
  async getEmbeddingByHash(sourceHash: string): Promise<EmbeddingRecord | null> {
    if (!this.embeddingsTable) throw new Error('Embeddings table not initialized');

    const results = await this.embeddingsTable
      .query()
      .where(`source_hash = '${sourceHash}'`)
      .limit(1)
      .toArray();

    if (results.length === 0) return null;
    return this.toEmbeddingRecord(results[0]);
  }

  /**
   * Get binary by source hash
   */
  async getBinaryByHash(sourceHash: string): Promise<RawBinaryRecord | null> {
    if (!this.binariesTable) throw new Error('Binaries table not initialized');

    const results = await this.binariesTable
      .query()
      .where(`source_hash = '${sourceHash}'`)
      .limit(1)
      .toArray();

    if (results.length === 0) return null;
    return this.toBinaryRecord(results[0]);
  }

  /**
   * Get binary by ID
   */
  async getBinaryById(id: string): Promise<RawBinaryRecord | null> {
    if (!this.binariesTable) throw new Error('Binaries table not initialized');

    const results = await this.binariesTable
      .query()
      .where(`id = '${id}'`)
      .limit(1)
      .toArray();

    if (results.length === 0) return null;
    return this.toBinaryRecord(results[0]);
  }

  /**
   * Update extracted text for a binary
   */
  async updateExtractedText(id: string, extractedText: string): Promise<void> {
    if (!this.binariesTable) throw new Error('Binaries table not initialized');

    // LanceDB doesn't support direct updates, need to delete and re-add
    // For now, we'll add the extracted_text to metadata
    const existing = await this.getBinaryById(id);
    if (existing) {
      existing.extracted_text = extractedText;
      await this.binariesTable.delete(`id = '${id}'`);
      await this.binariesTable.add([existing]);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false;
      const tables = await this.db.tableNames();
      return tables.includes('embeddings') && tables.includes('raw_binaries');
    } catch {
      return false;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    // LanceDB connections don't need explicit closing
    this.db = null;
    this.embeddingsTable = null;
    this.binariesTable = null;
    this.initialized = false;
    console.log('[LanceDB] Connection closed');
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Convert LanceDB row to EmbeddingRecord
   */
  private toEmbeddingRecord(row: any): EmbeddingRecord {
    return {
      id: row.id,
      source_hash: row.source_hash,
      embedding_vector: new Float32Array(row.embedding_vector),
      text_content: row.text_content,
      embedding_model: row.embedding_model,
      dimension: row.dimension,
      created_at: new Date(row.created_at),
      metadata: row.metadata || {}
    };
  }

  /**
   * Convert LanceDB row to RawBinaryRecord
   */
  private toBinaryRecord(row: any): RawBinaryRecord {
    return {
      id: row.id,
      source_hash: row.source_hash,
      content_type: row.content_type,
      binary_data: new Uint8Array(row.binary_data),
      extracted_text: row.extracted_text,
      thumbnail: row.thumbnail ? new Uint8Array(row.thumbnail) : null,
      created_at: new Date(row.created_at),
      metadata: row.metadata || {}
    };
  }

  /**
   * Get the underlying database connection
   */
  getDb(): lancedb.Connection | null {
    return this.db;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
let lanceDBInstance: LanceDBClient | null = null;

export function getLanceDBClient(config?: Partial<LanceDBConfig>): LanceDBClient {
  if (!lanceDBInstance) {
    lanceDBInstance = new LanceDBClient(config);
  }
  return lanceDBInstance;
}

export const lanceDbWrapper = {
  get client() {
    return getLanceDBClient();
  },
  initialize: () => getLanceDBClient().initialize(),
  healthCheck: () => getLanceDBClient().healthCheck(),
  close: () => getLanceDBClient().close()
};
