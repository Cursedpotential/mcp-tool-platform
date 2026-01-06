/**
 * Chroma Vector Database Client
 * Dual-collection system: Evidence Processing (72hr TTL) + Project Context (Persistent)
 */

import { ChromaClient, Collection } from 'chromadb';

// ============================================================================
// TYPES
// ============================================================================

export interface ChromaDocument {
  id: string;
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface ChromaQueryResult {
  ids: string[][];
  distances: number[][];
  metadatas: Record<string, any>[][];
  documents: string[][];
}

export interface EvidenceDocument extends ChromaDocument {
  metadata: {
    document_id: string;
    chunk_index: number;
    case_id: string;
    platform: string;
    ingested_at: string; // ISO timestamp
    expires_at: string; // ISO timestamp (72hrs from ingested_at)
    preliminary_classification?: {
      sentiment: string;
      severity: number;
      patterns: string[];
      confidence: number;
    };
  };
}

export interface ProjectContextDocument extends ChromaDocument {
  metadata: {
    context_type: 'preference' | 'workflow' | 'case_info' | 'project_status';
    case_id?: string;
    created_at: string;
    updated_at: string;
    tags?: string[];
  };
}

// ============================================================================
// CHROMA CLIENT MANAGER
// ============================================================================

export class ChromaManager {
  private client: ChromaClient;
  private evidenceCollection: Collection | null = null;
  private contextCollection: Collection | null = null;
  
  private readonly EVIDENCE_COLLECTION = 'evidence_processing';
  private readonly CONTEXT_COLLECTION = 'project_context';
  private readonly TTL_HOURS = 72;
  
  constructor(chromaUrl: string = 'http://localhost:8000') {
    this.client = new ChromaClient({ path: chromaUrl });
  }
  
  /**
   * Initialize collections
   */
  async initialize(): Promise<void> {
    console.log('[ChromaManager] Initializing collections...');
    
    try {
      // Evidence Processing Collection (72hr TTL)
      this.evidenceCollection = await this.client.getOrCreateCollection({
        name: this.EVIDENCE_COLLECTION,
        metadata: {
          description: 'Temporary working memory for evidence processing',
          ttl_hours: this.TTL_HOURS,
          auto_cleanup: true
        }
      });
      
      // Project Context Collection (Persistent)
      this.contextCollection = await this.client.getOrCreateCollection({
        name: this.CONTEXT_COLLECTION,
        metadata: {
          description: 'Persistent project context and preferences',
          persistent: true
        }
      });
      
      console.log('[ChromaManager] Collections initialized');
      console.log(`  - Evidence: ${this.EVIDENCE_COLLECTION} (${this.TTL_HOURS}hr TTL)`);
      console.log(`  - Context: ${this.CONTEXT_COLLECTION} (persistent)`);
    } catch (error: any) {
      console.error('[ChromaManager] Initialization failed:', error.message);
      throw error;
    }
  }
  
  // ============================================================================
  // EVIDENCE PROCESSING (72hr TTL)
  // ============================================================================
  
  /**
   * Add evidence document to processing collection
   */
  async addEvidence(
    documentId: string,
    chunks: Array<{ id: string; text: string; metadata: any }>,
    embeddings: number[][]
  ): Promise<void> {
    if (!this.evidenceCollection) {
      throw new Error('Evidence collection not initialized');
    }
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.TTL_HOURS * 60 * 60 * 1000);
    
    // Add TTL metadata to all chunks
    const ids = chunks.map(c => c.id);
    const texts = chunks.map(c => c.text);
    const metadatas = chunks.map(c => ({
      ...c.metadata,
      document_id: documentId,
      ingested_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    }));
    
    console.log(`[ChromaManager] Adding ${chunks.length} evidence chunks (expires: ${expiresAt.toISOString()})`);
    
    await this.evidenceCollection.add({
      ids,
      documents: texts,
      metadatas,
      embeddings
    });
  }
  
  /**
   * Query evidence collection
   */
  async queryEvidence(
    queryEmbedding: number[],
    nResults: number = 10,
    filter?: Record<string, any>
  ): Promise<ChromaQueryResult> {
    if (!this.evidenceCollection) {
      throw new Error('Evidence collection not initialized');
    }
    
    const where = filter ? { ...filter } : undefined;
    
    const results = await this.evidenceCollection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where
    });
    
    return results as ChromaQueryResult;
  }
  
  /**
   * Get evidence by document ID
   */
  async getEvidenceByDocument(documentId: string): Promise<ChromaDocument[]> {
    if (!this.evidenceCollection) {
      throw new Error('Evidence collection not initialized');
    }
    
    const results = await this.evidenceCollection.get({
      where: { document_id: documentId }
    });
    
    return this.formatResults(results);
  }
  
  /**
   * Update preliminary classification for evidence
   */
  async updateEvidenceClassification(
    chunkId: string,
    classification: {
      sentiment: string;
      severity: number;
      patterns: string[];
      confidence: number;
    }
  ): Promise<void> {
    if (!this.evidenceCollection) {
      throw new Error('Evidence collection not initialized');
    }
    
    console.log(`[ChromaManager] Updating classification for chunk: ${chunkId}`);
    
    // Get existing metadata first
    const existing = await this.evidenceCollection.get({ ids: [chunkId] });
    const existingMeta = existing.metadatas?.[0] || {};
    
    await this.evidenceCollection.update({
      ids: [chunkId],
      metadatas: [{
        ...existingMeta,
        preliminary_classification: JSON.stringify(classification)
      }]
    });
  }
  
  /**
   * Cleanup expired evidence (manual trigger)
   */
  async cleanupExpiredEvidence(): Promise<number> {
    if (!this.evidenceCollection) {
      throw new Error('Evidence collection not initialized');
    }
    
    const now = new Date().toISOString();
    
    console.log(`[ChromaManager] Cleaning up evidence expired before: ${now}`);
    
    // Get expired documents
    const expired = await this.evidenceCollection.get({
      where: {
        expires_at: { $lt: now }
      }
    });
    
    if (expired.ids.length === 0) {
      console.log('[ChromaManager] No expired evidence found');
      return 0;
    }
    
    // Delete expired documents
    await this.evidenceCollection.delete({
      ids: expired.ids
    });
    
    console.log(`[ChromaManager] Cleaned up ${expired.ids.length} expired evidence chunks`);
    return expired.ids.length;
  }
  
  /**
   * Get evidence statistics
   */
  async getEvidenceStats(): Promise<{
    total_chunks: number;
    by_case: Record<string, number>;
    by_platform: Record<string, number>;
    oldest_expiry: string | null;
  }> {
    if (!this.evidenceCollection) {
      throw new Error('Evidence collection not initialized');
    }
    
    const all = await this.evidenceCollection.get();
    
    const stats = {
      total_chunks: all.ids.length,
      by_case: {} as Record<string, number>,
      by_platform: {} as Record<string, number>,
      oldest_expiry: null as string | null
    };
    
    for (let i = 0; i < all.ids.length; i++) {
      const meta = all.metadatas?.[i] as any;
      
      if (meta?.case_id) {
        stats.by_case[meta.case_id] = (stats.by_case[meta.case_id] || 0) + 1;
      }
      
      if (meta?.platform) {
        stats.by_platform[meta.platform] = (stats.by_platform[meta.platform] || 0) + 1;
      }
      
      if (meta?.expires_at) {
        if (!stats.oldest_expiry || meta.expires_at < stats.oldest_expiry) {
          stats.oldest_expiry = meta.expires_at;
        }
      }
    }
    
    return stats;
  }
  
  // ============================================================================
  // PROJECT CONTEXT (PERSISTENT)
  // ============================================================================
  
  /**
   * Add project context
   */
  async addContext(
    id: string,
    text: string,
    contextType: 'preference' | 'workflow' | 'case_info' | 'project_status',
    metadata: Record<string, any> = {},
    embedding?: number[]
  ): Promise<void> {
    if (!this.contextCollection) {
      throw new Error('Context collection not initialized');
    }
    
    const now = new Date().toISOString();
    
    const fullMetadata = {
      ...metadata,
      context_type: contextType,
      created_at: now,
      updated_at: now
    };
    
    console.log(`[ChromaManager] Adding context: ${id} (${contextType})`);
    
    await this.contextCollection.add({
      ids: [id],
      documents: [text],
      metadatas: [fullMetadata],
      embeddings: embedding ? [embedding] : undefined
    });
  }
  
  /**
   * Update project context
   */
  async updateContext(
    id: string,
    text?: string,
    metadata?: Record<string, any>,
    embedding?: number[]
  ): Promise<void> {
    if (!this.contextCollection) {
      throw new Error('Context collection not initialized');
    }
    
    const updateData: any = {
      ids: [id]
    };
    
    if (text) {
      updateData.documents = [text];
    }
    
    if (metadata) {
      updateData.metadatas = [{
        ...metadata,
        updated_at: new Date().toISOString()
      }];
    }
    
    if (embedding) {
      updateData.embeddings = [embedding];
    }
    
    console.log(`[ChromaManager] Updating context: ${id}`);
    
    await this.contextCollection.update(updateData);
  }
  
  /**
   * Query project context
   */
  async queryContext(
    queryEmbedding: number[],
    contextType?: string,
    nResults: number = 5
  ): Promise<ChromaQueryResult> {
    if (!this.contextCollection) {
      throw new Error('Context collection not initialized');
    }
    
    const where = contextType ? { context_type: contextType } : undefined;
    
    const results = await this.contextCollection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
      where
    });
    
    return results as ChromaQueryResult;
  }
  
  /**
   * Get context by type
   */
  async getContextByType(contextType: string): Promise<ChromaDocument[]> {
    if (!this.contextCollection) {
      throw new Error('Context collection not initialized');
    }
    
    const results = await this.contextCollection.get({
      where: { context_type: contextType }
    });
    
    return this.formatResults(results);
  }
  
  /**
   * Get context by case ID
   */
  async getContextByCase(caseId: string): Promise<ChromaDocument[]> {
    if (!this.contextCollection) {
      throw new Error('Context collection not initialized');
    }
    
    const results = await this.contextCollection.get({
      where: { case_id: caseId }
    });
    
    return this.formatResults(results);
  }
  
  /**
   * Delete context
   */
  async deleteContext(id: string): Promise<void> {
    if (!this.contextCollection) {
      throw new Error('Context collection not initialized');
    }
    
    console.log(`[ChromaManager] Deleting context: ${id}`);
    
    await this.contextCollection.delete({
      ids: [id]
    });
  }
  
  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  /**
   * Format Chroma results to ChromaDocument[]
   */
  private formatResults(results: any): ChromaDocument[] {
    const documents: ChromaDocument[] = [];
    
    for (let i = 0; i < results.ids.length; i++) {
      documents.push({
        id: results.ids[i],
        text: results.documents?.[i] || '',
        metadata: results.metadatas?.[i] || {},
        embedding: results.embeddings?.[i]
      });
    }
    
    return documents;
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Reset evidence collection (delete all evidence)
   */
  async resetEvidenceCollection(): Promise<void> {
    console.log('[ChromaManager] Resetting evidence collection...');
    
    try {
      await this.client.deleteCollection({ name: this.EVIDENCE_COLLECTION });
    } catch (error) {
      // Collection might not exist
    }
    
    this.evidenceCollection = await this.client.createCollection({
      name: this.EVIDENCE_COLLECTION,
      metadata: {
        description: 'Temporary working memory for evidence processing',
        ttl_hours: this.TTL_HOURS,
        auto_cleanup: true
      }
    });
    
    console.log('[ChromaManager] Evidence collection reset');
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const chromaManager = new ChromaManager(
  process.env.CHROMA_URL || 'http://localhost:8000'
);
