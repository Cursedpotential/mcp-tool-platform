/**
 * PGVector Client - LangChain Integration
 *
 * Tier 3 (Permanent Storage) of the Salem Trinity Architecture
 * Uses LangChain's PGVectorStore with Ollama embeddings for permanent semantic search
 *
 * Based on FRAMEWORK_DECISION_MATRIX.md decision to use LangChain pgvector
 */

import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { PoolConfig } from 'pg';
import { Document } from '@langchain/core/documents';

// Environment configuration
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://user:pass@10.10.0.2:5432/evidence_db';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://10.10.0.3:11434';
const OLLAMA_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

export interface PgVectorConfig {
  postgresUrl?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  tableName?: string;
}

export interface StoreEmbeddingParams {
  caseId: string;
  content: string;
  metadata: Record<string, any>;
  postgresId?: string | number;
  hash?: string;
}

export interface SearchResult {
  content: string;
  metadata: Record<string, any>;
  score: number;
}

/**
 * PGVector Client using LangChain
 * Provides permanent semantic search capabilities (Tier 3)
 */
export class PgVectorClient {
  private vectorStore: PGVectorStore | null = null;
  private embeddings: OllamaEmbeddings;
  private config: Required<PgVectorConfig>;
  private initialized = false;

  constructor(config: PgVectorConfig = {}) {
    this.config = {
      postgresUrl: config.postgresUrl || POSTGRES_URL,
      ollamaBaseUrl: config.ollamaBaseUrl || OLLAMA_BASE_URL,
      ollamaModel: config.ollamaModel || OLLAMA_MODEL,
      tableName: config.tableName || 'embeddings'
    };

    // Initialize Ollama embeddings
    this.embeddings = new OllamaEmbeddings({
      baseUrl: this.config.ollamaBaseUrl,
      model: this.config.ollamaModel,
    });

    console.log('[PgVectorClient] Initialized with Ollama embeddings:', {
      baseUrl: this.config.ollamaBaseUrl,
      model: this.config.ollamaModel
    });
  }

  /**
   * Initialize the vector store connection
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.vectorStore) return;

    try {
      // Parse PostgreSQL connection string
      const url = new URL(this.config.postgresUrl);
      const poolConfig: PoolConfig = {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1),
        user: url.username,
        password: url.password,
        max: 10, // Connection pool size
      };

      // Initialize PGVectorStore
      this.vectorStore = await PGVectorStore.initialize(
        this.embeddings,
        {
          postgresConnectionOptions: poolConfig,
          tableName: this.config.tableName,
          columns: {
            idColumnName: 'id',
            vectorColumnName: 'embedding',
            contentColumnName: 'content',
            metadataColumnName: 'metadata',
          },
        }
      );

      this.initialized = true;
      console.log('[PgVectorClient] Connected to PGVector successfully');
    } catch (error) {
      console.error('[PgVectorClient] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Store evidence with embeddings in pgvector
   */
  async storeEmbedding(params: StoreEmbeddingParams): Promise<string> {
    await this.initialize();

    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      // Create document with metadata
      const document = new Document({
        pageContent: params.content,
        metadata: {
          case_id: params.caseId,
          postgres_id: params.postgresId ? String(params.postgresId) : undefined,
          sha256_hash: params.hash,
          stored_at: new Date().toISOString(),
          ...params.metadata
        }
      });

      // Add to vector store (LangChain handles embedding generation)
      const ids = await this.vectorStore.addDocuments([document]);

      console.log('[PgVectorClient] Stored embedding:', {
        caseId: params.caseId,
        embeddingId: ids[0]
      });

      return ids[0];
    } catch (error) {
      console.error('[PgVectorClient] Failed to store embedding:', error);
      throw error;
    }
  }

  /**
   * Semantic search using pgvector similarity
   */
  async semanticSearch(
    query: string,
    caseId?: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    await this.initialize();

    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      // Build filter for case_id if provided
      const filter = caseId ? { case_id: caseId } : undefined;

      // Perform similarity search with scores
      const results = await this.vectorStore.similaritySearchWithScore(
        query,
        limit,
        filter
      );

      // Map to SearchResult format
      return results.map(([doc, score]) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        score: score // Lower score = more similar in pgvector
      }));
    } catch (error) {
      console.error('[PgVectorClient] Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Get embedding vector for a text string
   * Useful for manual operations or debugging
   */
  async getEmbedding(text: string): Promise<number[]> {
    await this.initialize();
    return await this.embeddings.embedQuery(text);
  }

  /**
   * Delete embeddings for a specific case
   */
  async deleteCaseEmbeddings(caseId: string): Promise<void> {
    await this.initialize();

    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      // LangChain doesn't provide direct delete by filter
      // This would require direct SQL access
      console.warn('[PgVectorClient] Delete operation not fully implemented via LangChain');
      console.warn('[PgVectorClient] Use direct SQL: DELETE FROM embeddings WHERE metadata->>\'case_id\' = $1');
    } catch (error) {
      console.error('[PgVectorClient] Delete failed:', error);
      throw error;
    }
  }

  /**
   * Check if pgvector extension is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      await this.initialize();
      return this.initialized && this.vectorStore !== null;
    } catch (error) {
      console.error('[PgVectorClient] Availability check failed:', error);
      return false;
    }
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.vectorStore) {
      await this.vectorStore.end();
      this.vectorStore = null;
      this.initialized = false;
      console.log('[PgVectorClient] Connection closed');
    }
  }
}

// Singleton instance
let pgVectorClient: PgVectorClient | null = null;

/**
 * Get or create the pgvector client singleton
 */
export function getPgVectorClient(config?: PgVectorConfig): PgVectorClient {
  if (!pgVectorClient) {
    pgVectorClient = new PgVectorClient(config);
  }
  return pgVectorClient;
}

export default getPgVectorClient;
