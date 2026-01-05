-- ============================================================================
-- pgvector Setup for Supabase
-- ============================================================================
-- This SQL creates the embeddings table with pgvector extension for semantic search.
-- Run this in Supabase SQL Editor or via migration.

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL UNIQUE,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  text TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes for fast lookups
  CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Create index for vector similarity search (HNSW for fast approximate search)
CREATE INDEX IF NOT EXISTS embeddings_vector_idx 
ON embeddings 
USING hnsw (embedding vector_cosine_ops);

-- Create indexes for metadata filtering
CREATE INDEX IF NOT EXISTS embeddings_document_id_idx ON embeddings(document_id);
CREATE INDEX IF NOT EXISTS embeddings_metadata_platform_idx ON embeddings((metadata->>'platform'));
CREATE INDEX IF NOT EXISTS embeddings_metadata_case_id_idx ON embeddings((metadata->>'case_id'));
CREATE INDEX IF NOT EXISTS embeddings_metadata_evidence_id_idx ON embeddings((metadata->>'evidence_id'));
CREATE INDEX IF NOT EXISTS embeddings_created_at_idx ON embeddings(created_at DESC);

-- Create GIN index for full JSONB metadata search
CREATE INDEX IF NOT EXISTS embeddings_metadata_gin_idx ON embeddings USING gin(metadata);

-- ============================================================================
-- Semantic Search Function
-- ============================================================================
-- Function for cosine similarity search with metadata filters

CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_platform text DEFAULT NULL,
  filter_case_id text DEFAULT NULL,
  filter_evidence_id text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id text,
  document_id text,
  text text,
  similarity float,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.chunk_id,
    e.document_id,
    e.text,
    1 - (e.embedding <=> query_embedding) AS similarity,
    e.metadata,
    e.created_at
  FROM embeddings e
  WHERE 
    (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (filter_platform IS NULL OR e.metadata->>'platform' = filter_platform)
    AND (filter_case_id IS NULL OR e.metadata->>'case_id' = filter_case_id)
    AND (filter_evidence_id IS NULL OR e.metadata->>'evidence_id' = filter_evidence_id)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get embeddings for a document
CREATE OR REPLACE FUNCTION get_document_embeddings(doc_id text)
RETURNS TABLE (
  chunk_id text,
  text text,
  chunk_index int,
  metadata jsonb
)
LANGUAGE sql
AS $$
  SELECT 
    chunk_id,
    text,
    (metadata->>'chunk_index')::int AS chunk_index,
    metadata
  FROM embeddings
  WHERE document_id = doc_id
  ORDER BY (metadata->>'chunk_index')::int;
$$;

-- Get embedding statistics for a case
CREATE OR REPLACE FUNCTION get_case_embedding_stats(case_id_param text)
RETURNS TABLE (
  platform text,
  document_count bigint,
  chunk_count bigint,
  avg_chunk_length float
)
LANGUAGE sql
AS $$
  SELECT
    metadata->>'platform' AS platform,
    COUNT(DISTINCT document_id) AS document_count,
    COUNT(*) AS chunk_count,
    AVG(LENGTH(text)) AS avg_chunk_length
  FROM embeddings
  WHERE metadata->>'case_id' = case_id_param
  GROUP BY metadata->>'platform'
  ORDER BY chunk_count DESC;
$$;

-- Find duplicate or near-duplicate chunks (for deduplication)
CREATE OR REPLACE FUNCTION find_duplicate_chunks(
  similarity_threshold float DEFAULT 0.95,
  limit_count int DEFAULT 100
)
RETURNS TABLE (
  chunk_id_1 text,
  chunk_id_2 text,
  similarity float,
  text_1 text,
  text_2 text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e1.chunk_id AS chunk_id_1,
    e2.chunk_id AS chunk_id_2,
    1 - (e1.embedding <=> e2.embedding) AS similarity,
    e1.text AS text_1,
    e2.text AS text_2
  FROM embeddings e1
  CROSS JOIN embeddings e2
  WHERE 
    e1.chunk_id < e2.chunk_id -- Avoid duplicate pairs
    AND (1 - (e1.embedding <=> e2.embedding)) > similarity_threshold
  ORDER BY (1 - (e1.embedding <=> e2.embedding)) DESC
  LIMIT limit_count;
END;
$$;

-- ============================================================================
-- Cleanup Functions
-- ============================================================================

-- Delete embeddings older than N days
CREATE OR REPLACE FUNCTION cleanup_old_embeddings(days_old int DEFAULT 90)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM embeddings
  WHERE created_at < NOW() - (days_old || ' days')::interval;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================
-- Enable RLS for multi-tenant security

ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access embeddings for their cases
CREATE POLICY embeddings_case_access ON embeddings
  FOR SELECT
  USING (
    metadata->>'case_id' IN (
      SELECT id FROM cases WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can insert embeddings for their cases
CREATE POLICY embeddings_case_insert ON embeddings
  FOR INSERT
  WITH CHECK (
    metadata->>'case_id' IN (
      SELECT id FROM cases WHERE owner_id = auth.uid()
    )
  );

-- Policy: Users can delete embeddings for their cases
CREATE POLICY embeddings_case_delete ON embeddings
  FOR DELETE
  USING (
    metadata->>'case_id' IN (
      SELECT id FROM cases WHERE owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Performance Monitoring
-- ============================================================================

-- View for monitoring embedding performance
CREATE OR REPLACE VIEW embedding_performance AS
SELECT
  metadata->>'platform' AS platform,
  metadata->>'case_id' AS case_id,
  COUNT(*) AS total_chunks,
  AVG(LENGTH(text)) AS avg_chunk_length,
  MIN(created_at) AS first_indexed,
  MAX(created_at) AS last_indexed,
  COUNT(DISTINCT document_id) AS document_count
FROM embeddings
GROUP BY metadata->>'platform', metadata->>'case_id'
ORDER BY total_chunks DESC;

-- ============================================================================
-- Example Queries
-- ============================================================================

-- Search for gaslighting patterns across all platforms
-- SELECT * FROM match_embeddings(
--   query_embedding := (SELECT embedding FROM embeddings LIMIT 1), -- Replace with actual query embedding
--   match_threshold := 0.8,
--   match_count := 20,
--   filter_case_id := 'case_001'
-- );

-- Get embedding stats for a case
-- SELECT * FROM get_case_embedding_stats('case_001');

-- Find near-duplicate messages
-- SELECT * FROM find_duplicate_chunks(0.95, 50);

-- Cleanup old embeddings
-- SELECT cleanup_old_embeddings(90);
