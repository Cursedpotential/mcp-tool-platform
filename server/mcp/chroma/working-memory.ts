/**
 * Chroma Working Memory Store
 * 
 * Handles large file processing (5GB+ XML) by:
 * 1. Streaming chunks into Chroma collections
 * 2. Storing embeddings for semantic search during processing
 * 3. Persisting intermediate results until export to final DBs
 * 4. Supporting resume from interrupted processing
 */

import { createHash } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface ChromaConfig {
  host: string;
  port: number;
  tenant?: string;
  database?: string;
}

export interface ProcessingJob {
  id: string;
  name: string;
  sourceFile: string;
  sourceSize: number;
  collectionName: string;
  status: 'pending' | 'processing' | 'paused' | 'completed' | 'failed';
  progress: {
    bytesProcessed: number;
    chunksCreated: number;
    embeddingsGenerated: number;
    lastOffset: number;
  };
  metadata: {
    fileType: string;
    encoding: string;
    chunkSize: number;
    overlapSize: number;
  };
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

export interface Chunk {
  id: string;
  jobId: string;
  content: string;
  offset: number;
  length: number;
  metadata: {
    xpath?: string;
    elementName?: string;
    lineNumber?: number;
    parentId?: string;
    [key: string]: unknown;
  };
  embedding?: number[];
  createdAt: number;
}

export interface Collection {
  name: string;
  jobId: string;
  documentCount: number;
  embeddingDimensions: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  lastModified: number;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface ChunkingOptions {
  chunkSize: number;       // Target chunk size in characters
  overlapSize: number;     // Overlap between chunks
  preserveElements: boolean; // For XML: try to keep elements intact
  maxChunkSize: number;    // Hard limit on chunk size
}

// ============================================================================
// Chroma Client Wrapper
// ============================================================================

class ChromaClient {
  private config: ChromaConfig;
  private baseUrl: string;

  constructor(config: ChromaConfig) {
    this.config = config;
    this.baseUrl = `http://${config.host}:${config.port}`;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/heartbeat`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async createCollection(name: string, metadata?: Record<string, unknown>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        metadata: metadata || {},
        get_or_create: true,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create collection: ${response.statusText}`);
    }
  }

  async deleteCollection(name: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/collections/${name}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete collection: ${response.statusText}`);
    }
  }

  async listCollections(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/collections`);
    if (!response.ok) {
      throw new Error(`Failed to list collections: ${response.statusText}`);
    }
    const data = await response.json();
    return data.map((c: { name: string }) => c.name);
  }

  async getCollection(name: string): Promise<{ name: string; metadata: Record<string, unknown> } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/collections/${name}`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async addDocuments(
    collectionName: string,
    ids: string[],
    documents: string[],
    embeddings?: number[][],
    metadatas?: Record<string, unknown>[]
  ): Promise<void> {
    const body: Record<string, unknown> = {
      ids,
      documents,
    };
    if (embeddings) body.embeddings = embeddings;
    if (metadatas) body.metadatas = metadatas;

    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collectionName}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Failed to add documents: ${response.statusText}`);
    }
  }

  async queryCollection(
    collectionName: string,
    queryEmbeddings: number[][],
    nResults: number = 10,
    where?: Record<string, unknown>
  ): Promise<{
    ids: string[][];
    documents: string[][];
    distances: number[][];
    metadatas: Record<string, unknown>[][];
  }> {
    const body: Record<string, unknown> = {
      query_embeddings: queryEmbeddings,
      n_results: nResults,
    };
    if (where) body.where = where;

    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collectionName}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Failed to query collection: ${response.statusText}`);
    }
    return await response.json();
  }

  async getDocuments(
    collectionName: string,
    ids?: string[],
    where?: Record<string, unknown>,
    limit?: number,
    offset?: number
  ): Promise<{
    ids: string[];
    documents: string[];
    metadatas: Record<string, unknown>[];
  }> {
    const body: Record<string, unknown> = {};
    if (ids) body.ids = ids;
    if (where) body.where = where;
    if (limit) body.limit = limit;
    if (offset) body.offset = offset;

    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collectionName}/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Failed to get documents: ${response.statusText}`);
    }
    return await response.json();
  }

  async countDocuments(collectionName: string): Promise<number> {
    const response = await fetch(`${this.baseUrl}/api/v1/collections/${collectionName}/count`);
    if (!response.ok) {
      throw new Error(`Failed to count documents: ${response.statusText}`);
    }
    return await response.json();
  }
}

// ============================================================================
// Working Memory Store
// ============================================================================

class WorkingMemoryStore {
  private client: ChromaClient;
  private jobs: Map<string, ProcessingJob> = new Map();
  private embeddingProvider: 'ollama' | 'openai' | 'local' = 'local';
  private embeddingModel: string = 'nomic-embed-text';
  private embeddingDimensions: number = 768;

  constructor(config: ChromaConfig = { host: 'localhost', port: 8000 }) {
    this.client = new ChromaClient(config);
  }

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  setEmbeddingProvider(provider: 'ollama' | 'openai' | 'local', model?: string): void {
    this.embeddingProvider = provider;
    if (model) this.embeddingModel = model;
    
    // Set dimensions based on model
    const dimensionMap: Record<string, number> = {
      'nomic-embed-text': 768,
      'all-minilm': 384,
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    };
    this.embeddingDimensions = dimensionMap[this.embeddingModel] || 768;
  }

  async isAvailable(): Promise<boolean> {
    return this.client.healthCheck();
  }

  // ---------------------------------------------------------------------------
  // Job Management
  // ---------------------------------------------------------------------------

  async createJob(
    name: string,
    sourceFile: string,
    sourceSize: number,
    options: Partial<ChunkingOptions> = {}
  ): Promise<ProcessingJob> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const collectionName = `wm_${id}`;

    const job: ProcessingJob = {
      id,
      name,
      sourceFile,
      sourceSize,
      collectionName,
      status: 'pending',
      progress: {
        bytesProcessed: 0,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        lastOffset: 0,
      },
      metadata: {
        fileType: this.detectFileType(sourceFile),
        encoding: 'utf-8',
        chunkSize: options.chunkSize || 4000,
        overlapSize: options.overlapSize || 200,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Create Chroma collection for this job
    await this.client.createCollection(collectionName, {
      jobId: id,
      sourceFile,
      createdAt: job.createdAt,
    });

    this.jobs.set(id, job);
    return job;
  }

  getJob(jobId: string): ProcessingJob | undefined {
    return this.jobs.get(jobId);
  }

  listJobs(status?: ProcessingJob['status']): ProcessingJob[] {
    const jobs = Array.from(this.jobs.values());
    if (status) {
      return jobs.filter(j => j.status === status);
    }
    return jobs;
  }

  async updateJobProgress(
    jobId: string,
    progress: Partial<ProcessingJob['progress']>
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    job.progress = { ...job.progress, ...progress };
    job.updatedAt = Date.now();
    this.jobs.set(jobId, job);
  }

  async setJobStatus(
    jobId: string,
    status: ProcessingJob['status'],
    error?: string
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    job.status = status;
    job.updatedAt = Date.now();
    if (status === 'completed') job.completedAt = Date.now();
    if (error) job.error = error;
    this.jobs.set(jobId, job);
  }

  async deleteJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Delete the Chroma collection
    await this.client.deleteCollection(job.collectionName);
    this.jobs.delete(jobId);
  }

  // ---------------------------------------------------------------------------
  // Chunk Storage
  // ---------------------------------------------------------------------------

  async storeChunks(
    jobId: string,
    chunks: Array<{
      content: string;
      offset: number;
      metadata?: Record<string, unknown>;
    }>,
    generateEmbeddings: boolean = true
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const ids: string[] = [];
    const documents: string[] = [];
    const metadatas: Record<string, unknown>[] = [];
    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      const chunkId = `chunk_${job.progress.chunksCreated + ids.length}`;
      ids.push(chunkId);
      documents.push(chunk.content);
      metadatas.push({
        jobId,
        offset: chunk.offset,
        length: chunk.content.length,
        ...chunk.metadata,
      });

      if (generateEmbeddings) {
        const embedding = await this.generateEmbedding(chunk.content);
        embeddings.push(embedding);
      }
    }

    await this.client.addDocuments(
      job.collectionName,
      ids,
      documents,
      generateEmbeddings ? embeddings : undefined,
      metadatas
    );

    await this.updateJobProgress(jobId, {
      chunksCreated: job.progress.chunksCreated + chunks.length,
      embeddingsGenerated: job.progress.embeddingsGenerated + (generateEmbeddings ? chunks.length : 0),
      lastOffset: chunks[chunks.length - 1]?.offset || job.progress.lastOffset,
    });
  }

  async getChunks(
    jobId: string,
    options: {
      ids?: string[];
      offset?: number;
      limit?: number;
      where?: Record<string, unknown>;
    } = {}
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const result = await this.client.getDocuments(
      job.collectionName,
      options.ids,
      options.where,
      options.limit,
      options.offset
    );

    return result.ids.map((id, i) => ({
      id,
      content: result.documents[i],
      metadata: result.metadatas[i],
    }));
  }

  async searchChunks(
    jobId: string,
    query: string,
    nResults: number = 10,
    where?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const queryEmbedding = await this.generateEmbedding(query);
    const result = await this.client.queryCollection(
      job.collectionName,
      [queryEmbedding],
      nResults,
      where
    );

    return result.ids[0].map((id, i) => ({
      id,
      content: result.documents[0][i],
      score: 1 - result.distances[0][i], // Convert distance to similarity
      metadata: result.metadatas[0][i],
    }));
  }

  async getChunkCount(jobId: string): Promise<number> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    return this.client.countDocuments(job.collectionName);
  }

  // ---------------------------------------------------------------------------
  // Collection Management
  // ---------------------------------------------------------------------------

  async listCollections(): Promise<Collection[]> {
    const names = await this.client.listCollections();
    const collections: Collection[] = [];

    for (const name of names) {
      if (!name.startsWith('wm_')) continue; // Only working memory collections

      const info = await this.client.getCollection(name);
      if (!info) continue;

      const count = await this.client.countDocuments(name);
      const jobId = (info.metadata?.jobId as string) || '';

      collections.push({
        name,
        jobId,
        documentCount: count,
        embeddingDimensions: this.embeddingDimensions,
        metadata: info.metadata || {},
        createdAt: (info.metadata?.createdAt as number) || 0,
        lastModified: Date.now(),
      });
    }

    return collections;
  }

  async exportCollection(
    jobId: string,
    format: 'json' | 'jsonl' | 'csv' = 'jsonl'
  ): Promise<string> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    const chunks = await this.getChunks(jobId, { limit: 100000 });

    if (format === 'json') {
      return JSON.stringify(chunks, null, 2);
    } else if (format === 'jsonl') {
      return chunks.map(c => JSON.stringify(c)).join('\n');
    } else {
      // CSV
      const headers = ['id', 'content', 'offset', 'length'];
      const rows = chunks.map(c => [
        c.id,
        `"${c.content.replace(/"/g, '""')}"`,
        c.metadata.offset,
        c.metadata.length,
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
  }

  // ---------------------------------------------------------------------------
  // Embedding Generation
  // ---------------------------------------------------------------------------

  private async generateEmbedding(text: string): Promise<number[]> {
    if (this.embeddingProvider === 'local') {
      // Simple local embedding using hash-based approach
      // In production, this would call Ollama or another local model
      return this.simpleHashEmbedding(text, this.embeddingDimensions);
    }

    if (this.embeddingProvider === 'ollama') {
      try {
        const response = await fetch('http://localhost:11434/api/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.embeddingModel,
            prompt: text,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          return data.embedding;
        }
      } catch {
        // Fall back to local
      }
      return this.simpleHashEmbedding(text, this.embeddingDimensions);
    }

    // OpenAI or other providers would be handled here
    return this.simpleHashEmbedding(text, this.embeddingDimensions);
  }

  private simpleHashEmbedding(text: string, dimensions: number): number[] {
    // Simple deterministic embedding based on text hash
    // This is a fallback when no embedding model is available
    const hash = createHash('sha256').update(text).digest();
    const embedding: number[] = [];
    
    for (let i = 0; i < dimensions; i++) {
      const byteIndex = i % hash.length;
      const value = (hash[byteIndex] / 255) * 2 - 1; // Normalize to [-1, 1]
      embedding.push(value);
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / magnitude);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private detectFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      xml: 'xml',
      json: 'json',
      txt: 'text',
      md: 'markdown',
      csv: 'csv',
      html: 'html',
      pdf: 'pdf',
    };
    return typeMap[ext] || 'unknown';
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: WorkingMemoryStore | null = null;

export function getWorkingMemory(config?: ChromaConfig): WorkingMemoryStore {
  if (!instance) {
    instance = new WorkingMemoryStore(config);
  }
  return instance;
}

export function resetWorkingMemory(): void {
  instance = null;
}
