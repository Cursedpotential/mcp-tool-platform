/**
 * Supabase Client for pgvector and Structured Data Storage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface EmbeddingRow {
  id: string;
  document_id: string;
  chunk_id: string;
  embedding: number[];
  text: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  conversation_id?: string;
  case_id?: string;
  platform: string;
  source_path: string;
  filename: string;
  chunk_count: number;
  indexed_at: string;
  metadata: Record<string, any>;
}

export interface ChunkRow {
  chunk_id: string;
  document_id: string;
  conversation_id?: string;
  case_id?: string;
  index: number;
  text: string;
  embedding_id?: string;
  metadata: Record<string, any>;
}

export interface SemanticSearchResult {
  chunk_id: string;
  document_id: string;
  text: string;
  similarity: number;
  metadata: Record<string, any>;
  created_at: string;
}

// ============================================================================
// SUPABASE CLIENT MANAGER
// ============================================================================

export class SupabaseManager {
  private client: SupabaseClient;
  
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
    }
    
    this.client = createClient(supabaseUrl, supabaseKey);
    console.log('[SupabaseManager] Initialized');
  }
  
  // ============================================================================
  // EMBEDDINGS (pgvector)
  // ============================================================================
  
  /**
   * Insert embeddings into pgvector
   */
  async insertEmbeddings(embeddings: Omit<EmbeddingRow, 'created_at'>[]): Promise<void> {
    console.log(`[SupabaseManager] Inserting ${embeddings.length} embeddings`);
    
    const { error } = await this.client
      .from('embeddings')
      .insert(embeddings);
    
    if (error) {
      throw new Error(`Failed to insert embeddings: ${error.message}`);
    }
  }
  
  /**
   * Insert single embedding
   */
  async insertEmbedding(embedding: Omit<EmbeddingRow, 'created_at'>): Promise<void> {
    await this.insertEmbeddings([embedding]);
  }
  
  /**
   * Upsert embeddings (insert or update)
   */
  async upsertEmbeddings(embeddings: Omit<EmbeddingRow, 'created_at'>[]): Promise<void> {
    console.log(`[SupabaseManager] Upserting ${embeddings.length} embeddings`);
    
    const { error } = await this.client
      .from('embeddings')
      .upsert(embeddings, { onConflict: 'chunk_id' });
    
    if (error) {
      throw new Error(`Failed to upsert embeddings: ${error.message}`);
    }
  }
  
  /**
   * Semantic search using pgvector
   */
  async semanticSearch(
    queryEmbedding: number[],
    options: {
      matchThreshold?: number;
      matchCount?: number;
      filterPlatform?: string;
      filterCaseId?: string;
      filterEvidenceId?: string;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const {
      matchThreshold = 0.7,
      matchCount = 10,
      filterPlatform,
      filterCaseId,
      filterEvidenceId
    } = options;
    
    console.log(`[SupabaseManager] Semantic search (threshold: ${matchThreshold}, count: ${matchCount})`);
    
    const { data, error } = await this.client
      .rpc('match_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        filter_platform: filterPlatform || null,
        filter_case_id: filterCaseId || null,
        filter_evidence_id: filterEvidenceId || null
      });
    
    if (error) {
      throw new Error(`Semantic search failed: ${error.message}`);
    }
    
    return data as SemanticSearchResult[];
  }
  
  /**
   * Get embeddings for a document
   */
  async getDocumentEmbeddings(documentId: string): Promise<EmbeddingRow[]> {
    const { data, error } = await this.client
      .from('embeddings')
      .select('*')
      .eq('document_id', documentId)
      .order('metadata->chunk_index', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to get document embeddings: ${error.message}`);
    }
    
    return data as EmbeddingRow[];
  }
  
  /**
   * Delete embeddings for a document
   */
  async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    console.log(`[SupabaseManager] Deleting embeddings for document: ${documentId}`);
    
    const { error } = await this.client
      .from('embeddings')
      .delete()
      .eq('document_id', documentId);
    
    if (error) {
      throw new Error(`Failed to delete embeddings: ${error.message}`);
    }
  }
  
  // ============================================================================
  // DOCUMENTS
  // ============================================================================
  
  /**
   * Insert document metadata
   */
  async insertDocument(document: Omit<DocumentRow, 'indexed_at'>): Promise<void> {
    console.log(`[SupabaseManager] Inserting document: ${document.id}`);
    
    const { error } = await this.client
      .from('documents')
      .insert(document);
    
    if (error) {
      throw new Error(`Failed to insert document: ${error.message}`);
    }
  }
  
  /**
   * Insert multiple documents
   */
  async insertDocuments(documents: Omit<DocumentRow, 'indexed_at'>[]): Promise<void> {
    console.log(`[SupabaseManager] Inserting ${documents.length} documents`);
    
    const { error } = await this.client
      .from('documents')
      .insert(documents);
    
    if (error) {
      throw new Error(`Failed to insert documents: ${error.message}`);
    }
  }
  
  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<DocumentRow | null> {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to get document: ${error.message}`);
    }
    
    return data as DocumentRow;
  }
  
  /**
   * Get documents by case ID
   */
  async getDocumentsByCase(caseId: string): Promise<DocumentRow[]> {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .eq('case_id', caseId)
      .order('indexed_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get documents by case: ${error.message}`);
    }
    
    return data as DocumentRow[];
  }
  
  /**
   * Update document metadata
   */
  async updateDocument(documentId: string, updates: Partial<DocumentRow>): Promise<void> {
    console.log(`[SupabaseManager] Updating document: ${documentId}`);
    
    const { error } = await this.client
      .from('documents')
      .update(updates)
      .eq('id', documentId);
    
    if (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }
  }
  
  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    console.log(`[SupabaseManager] Deleting document: ${documentId}`);
    
    const { error } = await this.client
      .from('documents')
      .delete()
      .eq('id', documentId);
    
    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  }
  
  // ============================================================================
  // CHUNKS
  // ============================================================================
  
  /**
   * Insert chunks
   */
  async insertChunks(chunks: ChunkRow[]): Promise<void> {
    console.log(`[SupabaseManager] Inserting ${chunks.length} chunks`);
    
    const { error } = await this.client
      .from('chunks')
      .insert(chunks);
    
    if (error) {
      throw new Error(`Failed to insert chunks: ${error.message}`);
    }
  }
  
  /**
   * Get chunks for a document
   */
  async getDocumentChunks(documentId: string): Promise<ChunkRow[]> {
    const { data, error } = await this.client
      .from('chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('index', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to get document chunks: ${error.message}`);
    }
    
    return data as ChunkRow[];
  }
  
  /**
   * Get chunk by ID
   */
  async getChunk(chunkId: string): Promise<ChunkRow | null> {
    const { data, error } = await this.client
      .from('chunks')
      .select('*')
      .eq('chunk_id', chunkId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get chunk: ${error.message}`);
    }
    
    return data as ChunkRow;
  }
  
  /**
   * Delete chunks for a document
   */
  async deleteDocumentChunks(documentId: string): Promise<void> {
    console.log(`[SupabaseManager] Deleting chunks for document: ${documentId}`);
    
    const { error} = await this.client
      .from('chunks')
      .delete()
      .eq('document_id', documentId);
    
    if (error) {
      throw new Error(`Failed to delete chunks: ${error.message}`);
    }
  }
  
  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================
  
  /**
   * Insert document with chunks and embeddings (transaction)
   */
  async insertDocumentComplete(
    document: Omit<DocumentRow, 'indexed_at'>,
    chunks: ChunkRow[],
    embeddings: Omit<EmbeddingRow, 'created_at'>[]
  ): Promise<void> {
    console.log(`[SupabaseManager] Inserting complete document: ${document.id}`);
    console.log(`  - Chunks: ${chunks.length}`);
    console.log(`  - Embeddings: ${embeddings.length}`);
    
    // Insert document
    await this.insertDocument(document);
    
    // Insert chunks
    if (chunks.length > 0) {
      await this.insertChunks(chunks);
    }
    
    // Insert embeddings
    if (embeddings.length > 0) {
      await this.insertEmbeddings(embeddings);
    }
    
    console.log(`[SupabaseManager] Complete document inserted: ${document.id}`);
  }
  
  /**
   * Delete document with all related data (cascade)
   */
  async deleteDocumentComplete(documentId: string): Promise<void> {
    console.log(`[SupabaseManager] Deleting complete document: ${documentId}`);
    
    // Delete embeddings
    await this.deleteDocumentEmbeddings(documentId);
    
    // Delete chunks
    await this.deleteDocumentChunks(documentId);
    
    // Delete document
    await this.deleteDocument(documentId);
    
    console.log(`[SupabaseManager] Complete document deleted: ${documentId}`);
  }
  
  // ============================================================================
  // STATISTICS
  // ============================================================================
  
  /**
   * Get embedding statistics for a case
   */
  async getCaseEmbeddingStats(caseId: string): Promise<{
    platform: string;
    document_count: number;
    chunk_count: number;
    avg_chunk_length: number;
  }[]> {
    const { data, error } = await this.client
      .rpc('get_case_embedding_stats', {
        case_id_param: caseId
      });
    
    if (error) {
      throw new Error(`Failed to get case stats: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Find duplicate chunks
   */
  async findDuplicateChunks(
    similarityThreshold: number = 0.95,
    limitCount: number = 100
  ): Promise<{
    chunk_id_1: string;
    chunk_id_2: string;
    similarity: number;
    text_1: string;
    text_2: string;
  }[]> {
    const { data, error } = await this.client
      .rpc('find_duplicate_chunks', {
        similarity_threshold: similarityThreshold,
        limit_count: limitCount
      });
    
    if (error) {
      throw new Error(`Failed to find duplicates: ${error.message}`);
    }
    
    return data;
  }
  
  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('embeddings')
        .select('id')
        .limit(1);
      
      return !error;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get client instance (for custom queries)
   */
  getClient(): SupabaseClient {
    return this.client;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const supabaseManager = new SupabaseManager();
