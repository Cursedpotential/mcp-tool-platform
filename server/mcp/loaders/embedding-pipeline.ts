/**
 * Embedding Pipeline with pgvector Integration
 * 
 * Converts document chunks into embeddings and stores them in Supabase pgvector.
 * Supports semantic search across multi-platform evidence.
 */

import type { DocumentChunk, LoadedDocument } from './base-loader';

// ============================================================================
// EMBEDDING TYPES
// ============================================================================

/**
 * Embedding vector with metadata
 */
export interface EmbeddingVector {
  id: string;
  document_id: string;
  chunk_id: string;
  embedding: number[];
  text: string;
  metadata: EmbeddingMetadata;
  created_at: Date;
}

/**
 * Embedding metadata
 */
export interface EmbeddingMetadata {
  platform: string;
  chunk_index: number;
  start_offset: number;
  end_offset: number;
  case_id?: string;
  evidence_id?: string;
  participants?: string[];
  timestamp?: Date;
  custom_fields?: Record<string, any>;
}

/**
 * Semantic search query
 */
export interface SemanticSearchQuery {
  query_text: string;
  top_k?: number;
  similarity_threshold?: number;
  filters?: SearchFilters;
}

/**
 * Search filters
 */
export interface SearchFilters {
  platform?: string[];
  case_id?: string;
  evidence_id?: string;
  participants?: string[];
  date_range?: [Date, Date];
}

/**
 * Search result
 */
export interface SearchResult {
  chunk_id: string;
  document_id: string;
  text: string;
  similarity_score: number;
  metadata: EmbeddingMetadata;
  context?: {
    before?: string;
    after?: string;
  };
}

// ============================================================================
// EMBEDDING SERVICE
// ============================================================================

/**
 * Embedding service using Manus built-in LLM
 */
export class EmbeddingService {
  private apiUrl: string;
  private apiKey: string;
  
  constructor() {
    this.apiUrl = process.env.BUILT_IN_FORGE_API_URL || '';
    this.apiKey = process.env.BUILT_IN_FORGE_API_KEY || '';
  }
  
  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // In production, this would call Manus built-in embedding API
    // For now, return mock embedding (1536 dimensions like OpenAI)
    console.log('[EmbeddingService] Generating embedding for text:', text.slice(0, 50) + '...');
    
    // Mock embedding - in production would be:
    // const response = await fetch(`${this.apiUrl}/embeddings`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.apiKey}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ text, model: 'text-embedding-3-small' })
    // });
    // const data = await response.json();
    // return data.embedding;
    
    return Array(1536).fill(0).map(() => Math.random());
  }
  
  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    console.log(`[EmbeddingService] Generating ${texts.length} embeddings in batch`);
    
    // In production, batch API call
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.generateEmbedding(text));
    }
    
    return embeddings;
  }
}

// ============================================================================
// VECTOR STORE (pgvector via Supabase)
// ============================================================================

/**
 * Vector store using Supabase pgvector
 */
export class VectorStore {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_KEY || '';
  }
  
  /**
   * Store embedding vector
   */
  async storeEmbedding(vector: EmbeddingVector): Promise<void> {
    console.log(`[VectorStore] Storing embedding: ${vector.chunk_id}`);
    
    // In production, insert into Supabase:
    // const { createClient } = await import('@supabase/supabase-js');
    // const supabase = createClient(this.supabaseUrl, this.supabaseKey);
    // 
    // await supabase.from('embeddings').insert({
    //   id: vector.id,
    //   document_id: vector.document_id,
    //   chunk_id: vector.chunk_id,
    //   embedding: vector.embedding,
    //   text: vector.text,
    //   metadata: vector.metadata,
    //   created_at: vector.created_at
    // });
  }
  
  /**
   * Store multiple embeddings (batch)
   */
  async storeEmbeddings(vectors: EmbeddingVector[]): Promise<void> {
    console.log(`[VectorStore] Storing ${vectors.length} embeddings in batch`);
    
    for (const vector of vectors) {
      await this.storeEmbedding(vector);
    }
  }
  
  /**
   * Semantic search using cosine similarity
   */
  async semanticSearch(query: SemanticSearchQuery): Promise<SearchResult[]> {
    console.log(`[VectorStore] Semantic search: "${query.query_text}"`);
    
    // In production, use pgvector similarity search:
    // const { createClient } = await import('@supabase/supabase-js');
    // const supabase = createClient(this.supabaseUrl, this.supabaseKey);
    // 
    // // Generate query embedding
    // const embeddingService = new EmbeddingService();
    // const queryEmbedding = await embeddingService.generateEmbedding(query.query_text);
    // 
    // // pgvector cosine similarity search
    // let queryBuilder = supabase.rpc('match_embeddings', {
    //   query_embedding: queryEmbedding,
    //   match_threshold: query.similarity_threshold || 0.7,
    //   match_count: query.top_k || 10
    // });
    // 
    // // Apply filters
    // if (query.filters?.platform) {
    //   queryBuilder = queryBuilder.in('metadata->platform', query.filters.platform);
    // }
    // if (query.filters?.case_id) {
    //   queryBuilder = queryBuilder.eq('metadata->case_id', query.filters.case_id);
    // }
    // 
    // const { data, error } = await queryBuilder;
    // if (error) throw error;
    // 
    // return data.map(row => ({
    //   chunk_id: row.chunk_id,
    //   document_id: row.document_id,
    //   text: row.text,
    //   similarity_score: row.similarity,
    //   metadata: row.metadata
    // }));
    
    // Mock results
    return [
      {
        chunk_id: 'chunk_001',
        document_id: 'doc_001',
        text: 'Mock search result',
        similarity_score: 0.92,
        metadata: {
          platform: 'sms',
          chunk_index: 0,
          start_offset: 0,
          end_offset: 100
        }
      }
    ];
  }
  
  /**
   * Delete embeddings for a document
   */
  async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    console.log(`[VectorStore] Deleting embeddings for document: ${documentId}`);
    
    // In production:
    // const { createClient } = await import('@supabase/supabase-js');
    // const supabase = createClient(this.supabaseUrl, this.supabaseKey);
    // await supabase.from('embeddings').delete().eq('document_id', documentId);
  }
}

// ============================================================================
// EMBEDDING PIPELINE
// ============================================================================

/**
 * End-to-end embedding pipeline
 */
export class EmbeddingPipeline {
  private embeddingService: EmbeddingService;
  private vectorStore: VectorStore;
  
  constructor() {
    this.embeddingService = new EmbeddingService();
    this.vectorStore = new VectorStore();
  }
  
  /**
   * Process document: chunk → embed → store
   */
  async processDocument(
    document: LoadedDocument,
    chunks: DocumentChunk[],
    caseId?: string,
    evidenceId?: string
  ): Promise<void> {
    console.log(`[EmbeddingPipeline] Processing document: ${document.id} (${chunks.length} chunks)`);
    
    // Generate embeddings for all chunks
    const texts = chunks.map(c => c.text);
    const embeddings = await this.embeddingService.generateEmbeddings(texts);
    
    // Create embedding vectors
    const vectors: EmbeddingVector[] = chunks.map((chunk, index) => ({
      id: `emb_${chunk.chunk_id}`,
      document_id: document.id,
      chunk_id: chunk.chunk_id,
      embedding: embeddings[index],
      text: chunk.text,
      metadata: {
        platform: document.platform,
        chunk_index: chunk.index,
        start_offset: chunk.start_offset,
        end_offset: chunk.end_offset,
        case_id: caseId,
        evidence_id: evidenceId,
        participants: document.metadata.participants,
        timestamp: document.metadata.created_at,
        custom_fields: chunk.metadata
      },
      created_at: new Date()
    }));
    
    // Store in vector database
    await this.vectorStore.storeEmbeddings(vectors);
    
    console.log(`[EmbeddingPipeline] Stored ${vectors.length} embeddings for ${document.id}`);
  }
  
  /**
   * Semantic search across all documents
   */
  async search(query: SemanticSearchQuery): Promise<SearchResult[]> {
    return this.vectorStore.semanticSearch(query);
  }
  
  /**
   * Re-index document (delete old embeddings, create new ones)
   */
  async reindexDocument(
    document: LoadedDocument,
    chunks: DocumentChunk[],
    caseId?: string,
    evidenceId?: string
  ): Promise<void> {
    console.log(`[EmbeddingPipeline] Re-indexing document: ${document.id}`);
    
    // Delete old embeddings
    await this.vectorStore.deleteDocumentEmbeddings(document.id);
    
    // Process document fresh
    await this.processDocument(document, chunks, caseId, evidenceId);
  }
}

// ============================================================================
// CROSS-PLATFORM SEARCH
// ============================================================================

/**
 * Search across multiple platforms
 */
export async function searchAcrossPlatforms(
  query: string,
  platforms: string[],
  caseId?: string,
  topK: number = 20
): Promise<SearchResult[]> {
  const pipeline = new EmbeddingPipeline();
  
  const results = await pipeline.search({
    query_text: query,
    top_k: topK,
    similarity_threshold: 0.7,
    filters: {
      platform: platforms,
      case_id: caseId
    }
  });
  
  return results;
}

/**
 * Find similar messages across platforms
 */
export async function findSimilarMessages(
  referenceText: string,
  caseId: string,
  excludeDocumentId?: string,
  topK: number = 10
): Promise<SearchResult[]> {
  const pipeline = new EmbeddingPipeline();
  
  const results = await pipeline.search({
    query_text: referenceText,
    top_k: topK + 1, // +1 to account for potential self-match
    similarity_threshold: 0.8,
    filters: {
      case_id: caseId
    }
  });
  
  // Filter out self-match
  return results.filter(r => r.document_id !== excludeDocumentId).slice(0, topK);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const embeddingPipeline = new EmbeddingPipeline();
