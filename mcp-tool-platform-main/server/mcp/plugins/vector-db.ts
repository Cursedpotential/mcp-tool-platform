/**
 * Vector Database Plugin (Configurable)
 * 
 * Provides unified vector operations with multiple backend support:
 * - Qdrant (self-hosted, production-ready)
 * - pgvector (Supabase-native)
 * - Chroma (internal working memory with TTL retention)
 * 
 * Chroma is NOT exposed to external tools - only used during processing.
 */

import { getContentStore } from '../store/content-store';
import type { ContentRef } from '../../../shared/mcp-types';
import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// ============================================================================
// Configuration
// ============================================================================

export type VectorProvider = 'qdrant' | 'pgvector' | 'chroma';

interface VectorDBConfig {
  provider: VectorProvider;
  qdrant?: {
    url: string;
    apiKey?: string;
    collectionPrefix: string;
  };
  pgvector?: {
    connectionString: string;
    tableName: string;
  };
  chroma?: {
    path: string;
    retentionHours: number; // TTL for working memory
  };
}

const defaultConfig: VectorDBConfig = {
  provider: 'chroma',
  chroma: {
    path: './data/chroma',
    retentionHours: 72, // Default 3 days retention
  },
};

let config: VectorDBConfig = { ...defaultConfig };

/**
 * Configure the vector database
 */
export function configureVectorDB(newConfig: Partial<VectorDBConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 */
export function getVectorDBConfig(): VectorDBConfig {
  return { ...config };
}

// ============================================================================
// Chroma Working Memory (Internal Only - TTL Based)
// ============================================================================

interface ChromaCollection {
  id: string;
  name: string;
  createdAt: number;
  embeddings: Map<string, {
    id: string;
    vector: number[];
    metadata: Record<string, unknown>;
    document?: string;
  }>;
}

const chromaCollections: Map<string, ChromaCollection> = new Map();

// Persistent storage path
const CHROMA_STORAGE_PATH = process.env.CHROMA_STORAGE_PATH || './data/chroma';

// Ensure storage directory exists
if (!existsSync(CHROMA_STORAGE_PATH)) {
  mkdirSync(CHROMA_STORAGE_PATH, { recursive: true });
}

/**
 * Load collection from disk
 */
async function loadCollectionFromDisk(name: string): Promise<ChromaCollection | null> {
  const filePath = join(CHROMA_STORAGE_PATH, `${name}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      embeddings: new Map(Object.entries(parsed.embeddings || {})),
    };
  } catch (error) {
    return null;
  }
}

/**
 * Save collection to disk
 */
async function saveCollectionToDisk(collection: ChromaCollection): Promise<void> {
  const filePath = join(CHROMA_STORAGE_PATH, `${collection.name}.json`);
  const serialized = {
    ...collection,
    embeddings: Object.fromEntries(collection.embeddings),
  };
  await fs.writeFile(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
}

/**
 * Delete collection from disk
 */
async function deleteCollectionFromDisk(name: string): Promise<void> {
  const filePath = join(CHROMA_STORAGE_PATH, `${name}.json`);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
  }
}

/**
 * Load all collections from disk on startup
 */
async function loadAllCollections(): Promise<void> {
  try {
    const files = await fs.readdir(CHROMA_STORAGE_PATH);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const name = file.replace('.json', '');
        const collection = await loadCollectionFromDisk(name);
        if (collection) {
          chromaCollections.set(name, collection);
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist yet, will be created
  }
}

// Load collections on module initialization
loadAllCollections().catch(console.error);

/**
 * Create or get a Chroma collection (internal working memory)
 */
export async function getChromaCollection(name: string): Promise<ChromaCollection> {
  let collection = chromaCollections.get(name);
  
  if (!collection) {
    // Try loading from disk first
    const loaded = await loadCollectionFromDisk(name);
    collection = loaded || undefined;
    
    if (!collection) {
      // Create new collection
      collection = {
        id: `chroma-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        createdAt: Date.now(),
        embeddings: new Map(),
      };
      await saveCollectionToDisk(collection);
    }
    
    chromaCollections.set(name, collection);
  }
  
  return collection;
}

/**
 * Add embeddings to Chroma (internal)
 */
export async function chromaAdd(
  collectionName: string,
  ids: string[],
  vectors: number[][],
  metadatas: Record<string, unknown>[],
  documents?: string[]
): Promise<void> {
  const collection = await getChromaCollection(collectionName);
  
  for (let i = 0; i < ids.length; i++) {
    collection.embeddings.set(ids[i], {
      id: ids[i],
      vector: vectors[i],
      metadata: metadatas[i] || {},
      document: documents?.[i],
    });
  }
  
  // Persist to disk
  await saveCollectionToDisk(collection);
}

/**
 * Query Chroma (internal)
 */
export async function chromaQuery(
  collectionName: string,
  queryVector: number[],
  topK: number = 10,
  filter?: Record<string, unknown>
): Promise<Array<{
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  document?: string;
}>> {
  const collection = chromaCollections.get(collectionName);
  if (!collection) return [];
  
  const results: Array<{
    id: string;
    score: number;
    metadata: Record<string, unknown>;
    document?: string;
  }> = [];
  
  collection.embeddings.forEach((entry) => {
    // Apply filter if provided
    if (filter) {
      for (const [key, value] of Object.entries(filter)) {
        if (entry.metadata[key] !== value) return;
      }
    }
    
    const score = cosineSimilarity(queryVector, entry.vector);
    results.push({
      id: entry.id,
      score,
      metadata: entry.metadata,
      document: entry.document,
    });
  });
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Clean up expired Chroma collections based on TTL
 */
export async function chromaCleanup(): Promise<{ removed: number; remaining: number }> {
  const retentionMs = (config.chroma?.retentionHours ?? 72) * 60 * 60 * 1000;
  const now = Date.now();
  let removed = 0;
  
  const toRemove: string[] = [];
  chromaCollections.forEach((collection, name) => {
    if (now - collection.createdAt > retentionMs) {
      toRemove.push(name);
    }
  });
  
  // Remove from memory and disk
  for (const name of toRemove) {
    chromaCollections.delete(name);
    await deleteCollectionFromDisk(name);
    removed++;
  }
  
  return { removed, remaining: chromaCollections.size };
}

/**
 * Get Chroma stats (internal monitoring)
 */
export async function chromaStats(): Promise<{
  collections: number;
  totalEmbeddings: number;
  oldestCollection?: { name: string; ageHours: number };
}> {
  let totalEmbeddings = 0;
  let oldestCollection: { name: string; ageHours: number } | undefined;
  const now = Date.now();
  
  chromaCollections.forEach((collection) => {
    totalEmbeddings += collection.embeddings.size;
    const ageHours = (now - collection.createdAt) / (60 * 60 * 1000);
    
    if (!oldestCollection || ageHours > oldestCollection.ageHours) {
      oldestCollection = { name: collection.name, ageHours };
    }
  });
  
  return {
    collections: chromaCollections.size,
    totalEmbeddings,
    oldestCollection,
  };
}

// ============================================================================
// Qdrant Operations (External - Exposed)
// ============================================================================

interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

/**
 * Store vectors in Qdrant
 */
export async function qdrantStore(args: {
  collection: string;
  points: QdrantPoint[];
  createCollection?: boolean;
  vectorSize?: number;
}): Promise<{ stored: number; collection: string }> {
  if (config.provider !== 'qdrant' || !config.qdrant) {
    throw new Error('Qdrant not configured');
  }
  
  const { url, apiKey, collectionPrefix } = config.qdrant;
  const collectionName = `${collectionPrefix}${args.collection}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['api-key'] = apiKey;
  
  // Create collection if needed
  if (args.createCollection) {
    const vectorSize = args.vectorSize ?? args.points[0]?.vector.length ?? 384;
    
    try {
      await fetch(`${url}/collections/${collectionName}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        }),
      });
    } catch {
      // Collection may already exist
    }
  }
  
  // Upsert points
  const response = await fetch(`${url}/collections/${collectionName}/points`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      points: args.points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Qdrant upsert failed: ${response.status}`);
  }
  
  return { stored: args.points.length, collection: collectionName };
}

/**
 * Search vectors in Qdrant
 */
export async function qdrantSearch(args: {
  collection: string;
  vector: number[];
  topK?: number;
  filter?: Record<string, unknown>;
  scoreThreshold?: number;
}): Promise<Array<{
  id: string;
  score: number;
  payload: Record<string, unknown>;
}>> {
  if (config.provider !== 'qdrant' || !config.qdrant) {
    throw new Error('Qdrant not configured');
  }
  
  const { url, apiKey, collectionPrefix } = config.qdrant;
  const collectionName = `${collectionPrefix}${args.collection}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['api-key'] = apiKey;
  
  const body: Record<string, unknown> = {
    vector: args.vector,
    limit: args.topK ?? 10,
    with_payload: true,
  };
  
  if (args.filter) {
    body.filter = args.filter;
  }
  
  if (args.scoreThreshold) {
    body.score_threshold = args.scoreThreshold;
  }
  
  const response = await fetch(`${url}/collections/${collectionName}/points/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`Qdrant search failed: ${response.status}`);
  }
  
  const data = await response.json() as { result: Array<{ id: string; score: number; payload: Record<string, unknown> }> };
  
  return data.result.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload,
  }));
}

/**
 * Delete vectors from Qdrant
 */
export async function qdrantDelete(args: {
  collection: string;
  ids?: string[];
  filter?: Record<string, unknown>;
}): Promise<{ deleted: boolean }> {
  if (config.provider !== 'qdrant' || !config.qdrant) {
    throw new Error('Qdrant not configured');
  }
  
  const { url, apiKey, collectionPrefix } = config.qdrant;
  const collectionName = `${collectionPrefix}${args.collection}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['api-key'] = apiKey;
  
  const body: Record<string, unknown> = {};
  if (args.ids) {
    body.points = args.ids;
  } else if (args.filter) {
    body.filter = args.filter;
  }
  
  const response = await fetch(`${url}/collections/${collectionName}/points/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  return { deleted: response.ok };
}

/**
 * List Qdrant collections
 */
export async function qdrantListCollections(): Promise<{ collections: string[] }> {
  if (config.provider !== 'qdrant' || !config.qdrant) {
    throw new Error('Qdrant not configured');
  }
  
  const { url, apiKey, collectionPrefix } = config.qdrant;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['api-key'] = apiKey;
  
  const response = await fetch(`${url}/collections`, { headers });
  
  if (!response.ok) {
    throw new Error(`Qdrant list failed: ${response.status}`);
  }
  
  const data = await response.json() as { result: { collections: Array<{ name: string }> } };
  
  return {
    collections: data.result.collections
      .map((c) => c.name)
      .filter((name) => name.startsWith(collectionPrefix))
      .map((name) => name.slice(collectionPrefix.length)),
  };
}

// ============================================================================
// pgvector Operations (External - Exposed)
// ============================================================================

/**
 * Store vectors in pgvector
 */
export async function pgvectorStore(args: {
  table: string;
  vectors: Array<{
    id: string;
    vector: number[];
    metadata: Record<string, unknown>;
    content?: string;
  }>;
}): Promise<{ stored: number }> {
  if (config.provider !== 'pgvector' || !config.pgvector) {
    throw new Error('pgvector not configured');
  }
  
  // In production, use Drizzle ORM or direct pg client
  // This is a placeholder for the SQL operations
  console.log(`pgvector store: ${args.vectors.length} vectors to ${args.table}`);
  
  return { stored: args.vectors.length };
}

/**
 * Search vectors in pgvector
 */
export async function pgvectorSearch(args: {
  table: string;
  vector: number[];
  topK?: number;
  filter?: string; // SQL WHERE clause
}): Promise<Array<{
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  content?: string;
}>> {
  if (config.provider !== 'pgvector' || !config.pgvector) {
    throw new Error('pgvector not configured');
  }
  
  // In production, execute actual SQL query
  // SELECT *, 1 - (embedding <=> $1) as score FROM table ORDER BY embedding <=> $1 LIMIT $2
  console.log(`pgvector search in ${args.table}`);
  
  return [];
}

// ============================================================================
// Unified Interface (Routes to Configured Provider)
// ============================================================================

/**
 * Store vectors (routes to configured provider)
 */
export async function vectorStore(args: {
  collection: string;
  vectors: Array<{
    id: string;
    vector: number[];
    metadata: Record<string, unknown>;
    content?: string;
  }>;
  createCollection?: boolean;
}): Promise<{ stored: number; provider: VectorProvider; collection: string }> {
  switch (config.provider) {
    case 'qdrant':
      const qdrantResult = await qdrantStore({
        collection: args.collection,
        points: args.vectors.map((v) => ({
          id: v.id,
          vector: v.vector,
          payload: { ...v.metadata, content: v.content },
        })),
        createCollection: args.createCollection,
        vectorSize: args.vectors[0]?.vector.length,
      });
      return { stored: qdrantResult.stored, provider: 'qdrant', collection: qdrantResult.collection };
      
    case 'pgvector':
      const pgResult = await pgvectorStore({
        table: args.collection,
        vectors: args.vectors,
      });
      return { stored: pgResult.stored, provider: 'pgvector', collection: args.collection };
      
    default:
      throw new Error(`Unsupported vector provider: ${config.provider}`);
  }
}

/**
 * Search vectors (routes to configured provider)
 */
export async function vectorSearch(args: {
  collection: string;
  vector: number[];
  topK?: number;
  filter?: Record<string, unknown>;
  scoreThreshold?: number;
}): Promise<{
  results: Array<{
    id: string;
    score: number;
    metadata: Record<string, unknown>;
    content?: string;
  }>;
  provider: VectorProvider;
}> {
  switch (config.provider) {
    case 'qdrant':
      const qdrantResults = await qdrantSearch({
        collection: args.collection,
        vector: args.vector,
        topK: args.topK,
        filter: args.filter,
        scoreThreshold: args.scoreThreshold,
      });
      return {
        results: qdrantResults.map((r) => ({
          id: r.id,
          score: r.score,
          metadata: r.payload,
          content: r.payload.content as string | undefined,
        })),
        provider: 'qdrant',
      };
      
    case 'pgvector':
      const pgResults = await pgvectorSearch({
        table: args.collection,
        vector: args.vector,
        topK: args.topK,
      });
      return { results: pgResults, provider: 'pgvector' };
      
    default:
      throw new Error(`Unsupported vector provider: ${config.provider}`);
  }
}

/**
 * Delete vectors (routes to configured provider)
 */
export async function vectorDelete(args: {
  collection: string;
  ids?: string[];
  filter?: Record<string, unknown>;
}): Promise<{ deleted: boolean; provider: VectorProvider }> {
  switch (config.provider) {
    case 'qdrant':
      const result = await qdrantDelete(args);
      return { ...result, provider: 'qdrant' };
      
    case 'pgvector':
      // Implement pgvector delete
      return { deleted: true, provider: 'pgvector' };
      
    default:
      throw new Error(`Unsupported vector provider: ${config.provider}`);
  }
}

/**
 * List collections (routes to configured provider)
 */
export async function vectorListCollections(): Promise<{
  collections: string[];
  provider: VectorProvider;
}> {
  switch (config.provider) {
    case 'qdrant':
      const result = await qdrantListCollections();
      return { ...result, provider: 'qdrant' };
      
    case 'pgvector':
      // List pgvector tables
      return { collections: [], provider: 'pgvector' };
      
    default:
      throw new Error(`Unsupported vector provider: ${config.provider}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function cosineSimilarity(a: number[], b: number[]): number {
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
