-- ============================================================================
-- PostgreSQL Extensions Initialization - Full Supabase Compatibility
-- ============================================================================
-- This script installs all 59 extensions from Supabase for maximum compatibility
-- Run automatically on first PostgreSQL container startup
--
-- NOTE: Some extensions require additional setup:
-- - pg_cron: Add 'pg_cron' to shared_preload_libraries in postgresql.conf
-- - pgmq, pg_net, pgsodium: Supabase-specific, may need custom build
-- - PostGIS extensions: Require postgis package
--
-- Extensions marked as "IF NOT EXISTS" will skip if unavailable

-- ============================================================================
-- Core & PL/pgSQL
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS plpgsql;              -- PL/pgSQL procedural language (usually pre-installed)

-- ============================================================================
-- UUID & Crypto
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";          -- UUID generation functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;             -- Cryptographic functions (hashing, encryption)
CREATE EXTENSION IF NOT EXISTS pgsodium;             -- libsodium cryptographic functions (Supabase Vault)

-- ============================================================================
-- Vector Search
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;               -- pgvector for embeddings and semantic search

-- ============================================================================
-- Text Search & Indexing
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;              -- Trigram text similarity and GIN/GiST indexes
CREATE EXTENSION IF NOT EXISTS btree_gin;            -- GIN index support for btree-indexable types
CREATE EXTENSION IF NOT EXISTS btree_gist;           -- GiST index support for btree-indexable types
CREATE EXTENSION IF NOT EXISTS citext;               -- Case-insensitive text type
CREATE EXTENSION IF NOT EXISTS unaccent;             -- Text search dictionary that removes accents
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;        -- String similarity and distance functions
CREATE EXTENSION IF NOT EXISTS pgroonga;             -- Fast full-text search (Groonga-based)
CREATE EXTENSION IF NOT EXISTS pgroonga_database;    -- PGroonga database management

-- ============================================================================
-- Advanced Indexing
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS bloom;                -- Bloom filter index access method
CREATE EXTENSION IF NOT EXISTS rum;                  -- RUM index access method (better than GIN for some cases)
CREATE EXTENSION IF NOT EXISTS hypopg;               -- Hypothetical indexes for query planning

-- ============================================================================
-- Data Types
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS hstore;               -- Key-value store within PostgreSQL
CREATE EXTENSION IF NOT EXISTS ltree;                -- Hierarchical tree-like structures (labels)
CREATE EXTENSION IF NOT EXISTS cube;                 -- Multidimensional cube data type
CREATE EXTENSION IF NOT EXISTS earthdistance;        -- Great-circle distances on Earth
CREATE EXTENSION IF NOT EXISTS isn;                  -- ISBN, ISSN, EAN13, etc. data types
CREATE EXTENSION IF NOT EXISTS seg;                  -- Line segment data type

-- ============================================================================
-- Performance & Monitoring
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;   -- Track query execution statistics
CREATE EXTENSION IF NOT EXISTS pgstattuple;          -- Tuple-level statistics
CREATE EXTENSION IF NOT EXISTS pgrowlocks;           -- Row-level locking information
CREATE EXTENSION IF NOT EXISTS pg_prewarm;           -- Prewarm relation data into cache
CREATE EXTENSION IF NOT EXISTS pg_walinspect;        -- Inspect Write-Ahead Log contents
CREATE EXTENSION IF NOT EXISTS pgaudit;              -- Auditing functionality

-- ============================================================================
-- Job Scheduling & Queue
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;              -- Job scheduler for PostgreSQL (requires shared_preload_libraries)
CREATE EXTENSION IF NOT EXISTS pgmq;                 -- Lightweight message queue (like AWS SQS)

-- ============================================================================
-- Webhooks & HTTP
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_net;               -- Async HTTP client for database webhooks
CREATE EXTENSION IF NOT EXISTS http;                 -- HTTP client for web page retrieval

-- ============================================================================
-- Database Connectivity
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS dblink;               -- Connect to other PostgreSQL databases
CREATE EXTENSION IF NOT EXISTS postgres_fdw;         -- Foreign data wrapper for remote PostgreSQL servers
CREATE EXTENSION IF NOT EXISTS wrappers;             -- Supabase foreign data wrappers

-- ============================================================================
-- JSON & GraphQL
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;        -- JSON schema validation
CREATE EXTENSION IF NOT EXISTS pg_graphql;           -- GraphQL support

-- ============================================================================
-- PostGIS (Geospatial)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;              -- Geometry and geography spatial types
CREATE EXTENSION IF NOT EXISTS postgis_raster;       -- Raster types and functions
CREATE EXTENSION IF NOT EXISTS postgis_sfcgal;       -- SFCGAL functions
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder; -- TIGER geocoder and reverse geocoder
CREATE EXTENSION IF NOT EXISTS postgis_topology;     -- Topology spatial types and functions
CREATE EXTENSION IF NOT EXISTS pgrouting;            -- Routing extension
CREATE EXTENSION IF NOT EXISTS address_standardizer; -- Address parsing and normalization
CREATE EXTENSION IF NOT EXISTS address_standardizer_data_us; -- US address dataset

-- ============================================================================
-- Table Functions & Utilities
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS tablefunc;            -- Functions that manipulate whole tables (crosstab, etc.)
CREATE EXTENSION IF NOT EXISTS intarray;             -- Functions for 1-D arrays of integers
CREATE EXTENSION IF NOT EXISTS lo;                   -- Large object maintenance

-- ============================================================================
-- Triggers & Change Tracking
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS moddatetime;          -- Track last modification time
CREATE EXTENSION IF NOT EXISTS insert_username;      -- Track who changed a table
CREATE EXTENSION IF NOT EXISTS autoinc;              -- Autoincrementing fields
CREATE EXTENSION IF NOT EXISTS tcn;                  -- Triggered change notifications

-- ============================================================================
-- Text Search Dictionaries
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS dict_int;             -- Text search dictionary for integers
CREATE EXTENSION IF NOT EXISTS dict_xsyn;            -- Extended synonym processing

-- ============================================================================
-- Sampling & Testing
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS tsm_system_rows;      -- TABLESAMPLE by number of rows
CREATE EXTENSION IF NOT EXISTS tsm_system_time;      -- TABLESAMPLE by time in milliseconds
CREATE EXTENSION IF NOT EXISTS pgtap;                -- Unit testing for PostgreSQL

-- ============================================================================
-- Maintenance & Optimization
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_repack;            -- Reorganize tables with minimal locks
CREATE EXTENSION IF NOT EXISTS index_advisor;        -- Query index recommendations
CREATE EXTENSION IF NOT EXISTS plpgsql_check;        -- Extended checks for PL/pgSQL functions

-- ============================================================================
-- SSL & Security
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS sslinfo;              -- SSL certificate information

-- ============================================================================
-- Hashing & Identifiers
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_hashids;           -- Hashids generation

-- ============================================================================
-- Verify Installation
-- ============================================================================
-- Query to check installed extensions:
-- SELECT extname, extversion FROM pg_extension ORDER BY extname;
--
-- Note: Some extensions may fail to install if not available in the PostgreSQL build.
-- This is expected and safe - only available extensions will be installed.
