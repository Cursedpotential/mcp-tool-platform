/**
 * Vector Store Integration
 *
 * Pluggable vector store supporting Chroma and FAISS for semantic search
 * and similarity matching in forensic analysis.
 */

import { ChromaClient, Collection } from 'chromadb';
import * as faiss from 'faiss-node';
import { cachedEmbeddingService } from '../loaders/real-embedding-service';

// ============================================================================
// TYPES
// ============================================================================

export interface VectorDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
  metadata?: Record<string, any>;
}

export interface VectorStoreConfig {
  type: 'chroma' | 'faiss';
  url?: string;
  path?: string;
  collectionName: string;
  dimension?: number;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

// ============================================================================
// VECTOR STORE INTERFACE
// ============================================================================

export interface IVectorStore {
  initialize(): Promise<void>;
  addDocuments(documents: VectorDocument[]): Promise<void>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  deleteDocuments(ids: string[]): Promise<void>;
  getDocumentCount(): Promise<number>;
  clearCollection(): Promise<void>;
}

// ============================================================================
// CHROMA VECTOR STORE
// ============================================================================

export class ChromaVectorStore implements IVectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
    this.client = new ChromaClient({
      path: config.url || 'http://localhost:8000'
    });
  }

  async initialize(): Promise<void> {
    try {
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.collectionName,
        metadata: { description: 'Forensic analysis vector store' }
      });
      console.log(`[Chroma] Initialized collection: ${this.config.collectionName}`);
    } catch (error) {
      console.error('[Chroma] Initialization failed:', error);
      throw error;
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.collection) throw new Error('Collection not initialized');

    const ids = documents.map(d => d.id);
    const contents = documents.map(d => d.content);
    const metadatas = documents.map(d => d.metadata);

    await this.collection.add({
      ids,
      documents: contents,
      metadatas
    });

    console.log(`[Chroma] Added ${documents.length} documents`);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.collection) throw new Error('Collection not initialized');

    const { limit = 10, threshold = 0.0, filter, includeMetadata = true } = options;

    const results = await this.collection.query({
      queryTexts: [query],
      nResults: limit,
      where: filter
    });

    const searchResults: SearchResult[] = [];

    if (results.ids[0] && results.distances && results.documents) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const score = 1 - (results.distances[0][i] || 0);

        if (score >= threshold) {
          searchResults.push({
            document: {
              id: results.ids[0][i],
              content: results.documents[0][i] || '',
              metadata: includeMetadata ? results.metadatas?.[0]?.[i] || {} : {}
            },
            score,
            metadata: includeMetadata ? results.metadatas?.[0]?.[i] || {} : undefined
          });
        }
      }
    }

    return searchResults.sort((a, b) => b.score - a.score);
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.collection) throw new Error('Collection not initialized');
    await this.collection.delete({ ids });
  }

  async getDocumentCount(): Promise<number> {
    if (!this.collection) throw new Error('Collection not initialized');
    const count = await this.collection.count();
    return count;
  }

  async clearCollection(): Promise<void> {
    if (!this.collection) throw new Error('Collection not initialized');
    await this.collection.delete({});
  }
}

// ============================================================================
// FAISS VECTOR STORE
// ============================================================================

export class FaissVectorStore implements IVectorStore {
  private index: any = null;
  private documents: Map<string, VectorDocument> = new Map();
  private config: VectorStoreConfig;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      const dimension = this.config.dimension || cachedEmbeddingService.getDimensions();
      this.index = new faiss.IndexFlatIP(dimension);
      console.log(`[FAISS] Initialized index with dimension: ${dimension}`);
    } catch (error) {
      console.error('[FAISS] Initialization failed:', error);
      throw error;
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.index) throw new Error('Index not initialized');

    const texts = documents.map(d => d.content);
    const embeddings = await cachedEmbeddingService.generateEmbeddings(texts);

    const embeddingsFloat32 = new Float32Array(embeddings.flat());
    this.index.add(embeddingsFloat32);

    documents.forEach((doc, i) => {
      this.documents.set(doc.id, { ...doc, embedding: embeddings[i] });
    });

    console.log(`[FAISS] Added ${documents.length} documents with real embeddings`);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.index) throw new Error('Index not initialized');

    const { limit = 10, threshold = 0.0 } = options;

    const queryEmbedding = await cachedEmbeddingService.generateEmbedding(query);
    const queryFloat32 = new Float32Array(queryEmbedding);

    const { distances, labels } = this.index.search(queryFloat32, limit);

    const results: SearchResult[] = [];
    const docIds = Array.from(this.documents.keys());

    for (let i = 0; i < labels.length; i++) {
      const score = distances[i];
      if (score >= threshold) {
        const docId = docIds[labels[i]];
        const document = this.documents.get(docId);
        if (document) {
          results.push({
            document,
            score
          });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async deleteDocuments(ids: string[]): Promise<void> {
    ids.forEach(id => {
      const doc = this.documents.get(id);
      if (doc) {
        doc.metadata.deleted = true;
      }
    });
  }

  async getDocumentCount(): Promise<number> {
    return Array.from(this.documents.values()).filter(d => !d.metadata.deleted).length;
  }

  async clearCollection(): Promise<void> {
    this.documents.clear();
    await this.initialize();
  }
}

// ============================================================================
// VECTOR STORE FACTORY
// ============================================================================

export class VectorStoreFactory {
  static create(config: VectorStoreConfig): IVectorStore {
    switch (config.type) {
      case 'chroma':
        return new ChromaVectorStore(config);
      case 'faiss':
        return new FaissVectorStore(config);
      default:
        throw new Error(`Unsupported vector store type: ${config.type}`);
    }
  }

  static createFromEnv(): IVectorStore {
    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
    const enableVectorDb = process.env.ENABLE_VECTOR_DB === 'true';

    if (!enableVectorDb) {
      throw new Error('Vector database is disabled in environment');
    }

    return new ChromaVectorStore({
      type: 'chroma',
      url: chromaUrl,
      collectionName: 'forensic_analysis'
    });
  }
}

// ============================================================================
// FORENSIC VECTOR STORE (HIGH-LEVEL API)
// ============================================================================

export class ForensicVectorStore {
  private store: IVectorStore;
  private initialized: boolean = false;

  constructor(store?: IVectorStore) {
    this.store = store || VectorStoreFactory.createFromEnv();
  }

  async initialize(): Promise<void> {
    await this.store.initialize();
    this.initialized = true;
  }

  async addForensicDocuments(documents: Array<{
    id: string;
    content: string;
    sourceType: 'text' | 'chat' | 'email' | 'social_media';
    timestamp?: string;
    author?: string;
    tags?: string[];
  }>): Promise<void> {
    const vectorDocs: VectorDocument[] = documents.map(doc => ({
      id: doc.id,
      content: doc.content,
      metadata: {
        sourceType: doc.sourceType,
        timestamp: doc.timestamp || new Date().toISOString(),
        author: doc.author || 'unknown',
        tags: doc.tags || [],
        indexedAt: new Date().toISOString()
      }
    }));

    await this.store.addDocuments(vectorDocs);
  }

  async searchForensic(
    query: string,
    options: SearchOptions & {
      sourceTypes?: string[];
      dateRange?: { start: string; end: string };
      authors?: string[];
      tags?: string[];
    } = {}
  ): Promise<SearchResult[]> {
    const filter: Record<string, any> = {};

    if (options.sourceTypes?.length) {
      filter.sourceType = { $in: options.sourceTypes };
    }

    if (options.authors?.length) {
      filter.author = { $in: options.authors };
    }

    if (options.tags?.length) {
      filter.tags = { $in: options.tags };
    }

    if (options.dateRange) {
      filter.timestamp = {
        $gte: options.dateRange.start,
        $lte: options.dateRange.end
      };
    }

    return await this.store.search(query, { ...options, filter });
  }

  async findSimilarDocuments(documentId: string, limit: number = 5): Promise<SearchResult[]> {
    // This would require a getDocumentById method in the store
    // For now, let's keep it simple
    console.warn('[VectorStore] findSimilarDocuments requires document content lookup');
    return [];
  }

  async getStats(): Promise<{
    totalDocuments: number;
    collections: string[];
    lastUpdated?: string;
  }> {
    const totalDocuments = await this.store.getDocumentCount();

    return {
      totalDocuments,
      collections: [this.store.constructor.name],
      lastUpdated: new Date().toISOString()
    };
  }
}

export const chromaStore = new ChromaVectorStore({
  type: 'chroma',
  collectionName: 'forensic_analysis'
});

export const faissStore = new FaissVectorStore({
  type: 'faiss',
  collectionName: 'forensic_analysis'
});

export const forensicVectorStore = new ForensicVectorStore();

export const vectorStoreTools = [
  {
    name: 'vector_search',
    description: 'Perform semantic search in vector store',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Maximum results', default: 10 },
        threshold: { type: 'number', description: 'Similarity threshold', default: 0.0 },
        sourceTypes: { type: 'array', items: { type: 'string' }, description: 'Filter by source types' }
      },
      required: ['query']
    }
  },
  {
    name: 'add_vector_documents',
    description: 'Add documents to vector store for semantic search',
    inputSchema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              content: { type: 'string' },
              sourceType: { type: 'string', enum: ['text', 'chat', 'email', 'social_media'] },
              timestamp: { type: 'string' },
              author: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } }
            },
            required: ['id', 'content', 'sourceType']
          }
        }
      },
      required: ['documents']
    }
  }
];