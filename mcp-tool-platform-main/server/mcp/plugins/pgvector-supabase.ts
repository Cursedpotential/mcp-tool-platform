/**
 * pgvector + Supabase Integration
 * 
 * Persistent vector storage using Supabase Postgres with pgvector extension.
 * This is the long-term storage layer (unlike Chroma's 72hr TTL working memory).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Configuration
// ============================================================================

interface PgVectorConfig {
  enabled: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
  tableName?: string;
  dimensions?: number;
}

const config: PgVectorConfig = {
  enabled: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  tableName: process.env.PGVECTOR_TABLE || 'embeddings',
  dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10),
};

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 */
function getSupabaseClient(): SupabaseClient {
  if (!config.enabled) {
    throw new Error('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY env vars.');
  }
  
  if (!supabaseClient) {
    supabaseClient = createClient(config.supabaseUrl!, config.supabaseKey!);
  }
  
  return supabaseClient;
}

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingRecord {
  id: string;
  user_id?: number;
  collection?: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  similarity: number;
}

// ============================================================================
// Core Operations
// ============================================================================

/**
 * Initialize pgvector table (idempotent)
 */
export async function initPgVectorTable(): Promise<void> {
  const client = getSupabaseClient();
  
  // Check if table exists
  const { data: tables, error: listError } = await client
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_name', config.tableName!);
  
  if (listError) {
    throw new Error(`Failed to check table existence: ${listError.message}`);
  }
  
  if (tables && tables.length > 0) {
    console.log(`[pgvector] Table ${config.tableName} already exists`);
    return;
  }
  
  // Create table with pgvector extension
  const { error: createError } = await client.rpc('create_embeddings_table', {
    table_name: config.tableName,
    dimensions: config.dimensions,
  });
  
  if (createError) {
    throw new Error(`Failed to create pgvector table: ${createError.message}`);
  }
  
  console.log(`[pgvector] Created table ${config.tableName} with ${config.dimensions} dimensions`);
}

/**
 * Add embeddings to pgvector
 */
export async function addEmbeddings(
  records: Array<{
    id: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
    collection?: string;
    userId?: number;
  }>
): Promise<void> {
  const client = getSupabaseClient();
  
  const rows = records.map((r) => ({
    id: r.id,
    user_id: r.userId,
    collection: r.collection,
    content: r.content,
    embedding: r.embedding,
    metadata: r.metadata || {},
    created_at: new Date().toISOString(),
  }));
  
  const { error } = await client.from(config.tableName!).insert(rows);
  
  if (error) {
    throw new Error(`Failed to insert embeddings: ${error.message}`);
  }
}

/**
 * Search embeddings by vector similarity
 */
export async function searchEmbeddings(
  queryEmbedding: number[],
  options: {
    collection?: string;
    userId?: number;
    topK?: number;
    threshold?: number;
  } = {}
): Promise<SearchResult[]> {
  const client = getSupabaseClient();
  
  const { collection, userId, topK = 10, threshold = 0.7 } = options;
  
  // Use pgvector's <-> operator for cosine distance
  let query = client
    .rpc('match_embeddings', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: topK,
    });
  
  if (collection) {
    query = query.eq('collection', collection);
  }
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to search embeddings: ${error.message}`);
  }
  
  return (data || []).map((row: unknown) => {
    const r = row as { id: string; content: string; metadata: Record<string, unknown>; similarity: number };
    return {
      id: r.id,
      content: r.content,
      metadata: r.metadata,
      similarity: r.similarity,
    };
  });
}

/**
 * Delete embeddings
 */
export async function deleteEmbeddings(
  ids: string[],
  options: {
    collection?: string;
    userId?: number;
  } = {}
): Promise<number> {
  const client = getSupabaseClient();
  
  let query = client.from(config.tableName!).delete().in('id', ids);
  
  if (options.collection) {
    query = query.eq('collection', options.collection);
  }
  
  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }
  
  const { error, count } = await query;
  
  if (error) {
    throw new Error(`Failed to delete embeddings: ${error.message}`);
  }
  
  return count || 0;
}

/**
 * Get embedding by ID
 */
export async function getEmbedding(id: string): Promise<EmbeddingRecord | null> {
  const client = getSupabaseClient();
  
  const { data, error } = await client
    .from(config.tableName!)
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get embedding: ${error.message}`);
  }
  
  return data as EmbeddingRecord;
}

/**
 * List collections
 */
export async function listCollections(userId?: number): Promise<Array<{ name: string; count: number }>> {
  const client = getSupabaseClient();
  
  let query = client
    .from(config.tableName!)
    .select('collection', { count: 'exact' });
  
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to list collections: ${error.message}`);
  }
  
  // Group by collection and count
  const collections = new Map<string, number>();
  (data || []).forEach((row: { collection?: string }) => {
    const name = row.collection || 'default';
    collections.set(name, (collections.get(name) || 0) + 1);
  });
  
  return Array.from(collections.entries()).map(([name, count]) => ({ name, count }));
}

/**
 * Get stats
 */
export async function getStats(): Promise<{
  enabled: boolean;
  totalEmbeddings: number;
  collections: number;
  dimensions: number;
}> {
  if (!config.enabled) {
    return {
      enabled: false,
      totalEmbeddings: 0,
      collections: 0,
      dimensions: config.dimensions || 0,
    };
  }
  
  const client = getSupabaseClient();
  
  const { count, error } = await client
    .from(config.tableName!)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    throw new Error(`Failed to get stats: ${error.message}`);
  }
  
  const collections = await listCollections();
  
  return {
    enabled: true,
    totalEmbeddings: count || 0,
    collections: collections.length,
    dimensions: config.dimensions || 0,
  };
}

// ============================================================================
// SQL Setup Scripts (for reference)
// ============================================================================

/**
 * SQL to create embeddings table with pgvector
 * Run this in Supabase SQL editor:
 * 
 * -- Enable pgvector extension
 * CREATE EXTENSION IF NOT EXISTS vector;
 * 
 * -- Create embeddings table
 * CREATE TABLE IF NOT EXISTS embeddings (
 *   id TEXT PRIMARY KEY,
 *   user_id INTEGER,
 *   collection TEXT,
 *   content TEXT NOT NULL,
 *   embedding vector(1536),
 *   metadata JSONB DEFAULT '{}',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Create index for vector similarity search
 * CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON embeddings 
 * USING ivfflat (embedding vector_cosine_ops)
 * WITH (lists = 100);
 * 
 * -- Create function for similarity search
 * CREATE OR REPLACE FUNCTION match_embeddings(
 *   query_embedding vector(1536),
 *   match_threshold float DEFAULT 0.7,
 *   match_count int DEFAULT 10
 * )
 * RETURNS TABLE (
 *   id text,
 *   content text,
 *   metadata jsonb,
 *   similarity float
 * )
 * LANGUAGE plpgsql
 * AS $$
 * BEGIN
 *   RETURN QUERY
 *   SELECT
 *     embeddings.id,
 *     embeddings.content,
 *     embeddings.metadata,
 *     1 - (embeddings.embedding <=> query_embedding) AS similarity
 *   FROM embeddings
 *   WHERE 1 - (embeddings.embedding <=> query_embedding) > match_threshold
 *   ORDER BY embeddings.embedding <=> query_embedding
 *   LIMIT match_count;
 * END;
 * $$;
 */

export const PGVECTOR_SETUP_SQL = `
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  collection TEXT,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS embeddings_embedding_idx ON embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function for similarity search
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    embeddings.id,
    embeddings.content,
    embeddings.metadata,
    1 - (embeddings.embedding <=> query_embedding) AS similarity
  FROM embeddings
  WHERE 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`;
