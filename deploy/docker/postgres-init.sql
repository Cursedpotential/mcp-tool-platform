-- ============================================================================
-- PostgreSQL Extensions Initialization
-- ============================================================================
-- This script installs all extensions needed for the MCP Tool Platform
-- Mimics Supabase extension set for compatibility
-- Run automatically on first PostgreSQL container startup

-- Core Extensions (always available)
CREATE EXTENSION IF NOT EXISTS plpgsql;              -- PL/pgSQL procedural language (usually pre-installed)

-- UUID & Crypto
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";          -- UUID generation functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;             -- Cryptographic functions (hashing, encryption)

-- Vector Search (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;               -- pgvector for embeddings and semantic search

-- Text Search & Indexing
CREATE EXTENSION IF NOT EXISTS pg_trgm;              -- Trigram text similarity and GIN/GiST indexes
CREATE EXTENSION IF NOT EXISTS btree_gin;            -- GIN index support for btree-indexable types
CREATE EXTENSION IF NOT EXISTS btree_gist;           -- GiST index support for btree-indexable types
CREATE EXTENSION IF NOT EXISTS citext;               -- Case-insensitive text type

-- Data Types
CREATE EXTENSION IF NOT EXISTS hstore;               -- Key-value store within PostgreSQL
CREATE EXTENSION IF NOT EXISTS ltree;                -- Hierarchical tree-like structures (labels)
CREATE EXTENSION IF NOT EXISTS isn;                  -- ISBN, ISSN, EAN13, etc. data types
CREATE EXTENSION IF NOT EXISTS lo;                   -- Large object maintenance

-- Performance & Monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;   -- Track query execution statistics

-- Optional: PostGIS (geospatial data)
-- Uncomment if you need geospatial features
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;
-- CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Optional: TimescaleDB (time-series data)
-- Uncomment if you need time-series features
-- CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================================
-- Verify Installation
-- ============================================================================
-- Query to check installed extensions:
-- SELECT extname, extversion FROM pg_extension ORDER BY extname;
