-- =============================================================================
-- Salem Forensic Trinity - VPS1 Postgres Extension Installation
-- =============================================================================
-- Purpose: Install all 34 required PostgreSQL extensions for full system functionality
-- Target: VPS1 (salem-nexus) Postgres 16 container
-- Impact: Enables pgvector, PostGIS, cryptography, job scheduling, webhooks, and more
-- Prerequisites: Extension packages must be installed via apt (see fix-vps1.sh)
-- =============================================================================

-- Connect to postgres database as superuser
\c postgres

-- Enable required extensions in dependency order
-- Some extensions depend on others, so order matters!

-- =============================================================================
-- CORE EXTENSIONS (Already Installed)
-- =============================================================================

-- 1. plpgsql - Procedural language (installed by default)
-- Already enabled

-- 2. uuid-ossp - UUID generation (already enabled)
-- Already enabled

-- =============================================================================
-- CRYPTOGRAPHY & SECURITY
-- =============================================================================

-- 3. pgcrypto - Cryptographic functions (SHA-256 hashing for forensic integrity)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
COMMENT ON EXTENSION pgcrypto IS 'Cryptographic functions for forensic evidence hashing';

-- =============================================================================
-- VECTOR SEARCH (CRITICAL - Blocks System Router)
-- =============================================================================

-- 4. vector (pgvector) - Vector similarity search for embeddings
CREATE EXTENSION IF NOT EXISTS vector;
COMMENT ON EXTENSION vector IS 'Vector similarity search for semantic embeddings';

-- =============================================================================
-- TEXT SEARCH & PROCESSING
-- =============================================================================

-- 5. pg_trgm - Trigram matching for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 6. citext - Case-insensitive text type
CREATE EXTENSION IF NOT EXISTS citext;

-- 7. unaccent - Text accent removal
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 8. fuzzystrmatch - Fuzzy string matching (Levenshtein, metaphone, soundex)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- =============================================================================
-- INDEXING ENHANCEMENTS
-- =============================================================================

-- 9. btree_gin - GIN index support for btree-indexable types
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 10. btree_gist - GiST index support for btree-indexable types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 11. bloom - Bloom filter index (probabilistic data structure)
CREATE EXTENSION IF NOT EXISTS bloom;

-- 12. hypopg - Hypothetical indexes (test indexes without creating them)
CREATE EXTENSION IF NOT EXISTS hypopg;

-- =============================================================================
-- DATA TYPES
-- =============================================================================

-- 13. hstore - Key-value store within Postgres
CREATE EXTENSION IF NOT EXISTS hstore;

-- 14. ltree - Hierarchical tree-like structures (case hierarchies)
CREATE EXTENSION IF NOT EXISTS ltree;

-- =============================================================================
-- GEOSPATIAL (PostGIS Suite - 8 Extensions)
-- =============================================================================
-- CRITICAL: Required for spatial queries in System Router

-- 15. postgis - Core PostGIS geometry/geography types and functions
CREATE EXTENSION IF NOT EXISTS postgis;

-- 16. postgis_raster - Raster data support
CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- 17. postgis_sfcgal - 3D geometry operations
CREATE EXTENSION IF NOT EXISTS postgis_sfcgal;

-- 18. postgis_tiger_geocoder - US address geocoding
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;

-- 19. postgis_topology - Topology support
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- 20. address_standardizer - Address standardization
CREATE EXTENSION IF NOT EXISTS address_standardizer;

-- 21. address_standardizer_data_us - US address data
CREATE EXTENSION IF NOT EXISTS address_standardizer_data_us;

-- 22. pgrouting - Routing on PostGIS networks
-- Note: Install only if available (optional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgrouting') THEN
    CREATE EXTENSION IF NOT EXISTS pgrouting;
  END IF;
END $$;

-- =============================================================================
-- MONITORING & AUDITING
-- =============================================================================

-- 23. pg_stat_statements - Track execution statistics of SQL statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
COMMENT ON EXTENSION pg_stat_statements IS 'Track query performance metrics';

-- 24. pgaudit - Detailed session and object audit logging
-- Note: Requires pgaudit package, install if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgaudit') THEN
    CREATE EXTENSION IF NOT EXISTS pgaudit;
  END IF;
END $$;

-- =============================================================================
-- JOB SCHEDULING & MESSAGE QUEUE
-- =============================================================================

-- 25. pg_cron - Cron-based job scheduling within Postgres
CREATE EXTENSION IF NOT EXISTS pg_cron;
COMMENT ON EXTENSION pg_cron IS 'Job scheduler for automated maintenance and archival';

-- 26. pgmq - Postgres message queue (for async job processing)
-- Note: Install only if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pgmq') THEN
    CREATE EXTENSION IF NOT EXISTS pgmq;
  END IF;
END $$;

-- =============================================================================
-- WEBHOOKS & EXTERNAL COMMUNICATION
-- =============================================================================

-- 27. pg_net - Async HTTP requests from Postgres (webhooks)
-- Note: Requires pg_net package, install if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  END IF;
END $$;

-- =============================================================================
-- FOREIGN DATA WRAPPERS (Cross-Database Access)
-- =============================================================================

-- 28. dblink - Connect to other Postgres databases
CREATE EXTENSION IF NOT EXISTS dblink;

-- 29. postgres_fdw - Foreign data wrapper for remote Postgres servers
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- =============================================================================
-- JSON & DATA VALIDATION
-- =============================================================================

-- 30. pg_jsonschema - JSON schema validation
-- Note: Install only if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_jsonschema') THEN
    CREATE EXTENSION IF NOT EXISTS pg_jsonschema;
  END IF;
END $$;

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- 31. tablefunc - Table functions (crosstab, connectby, etc.)
CREATE EXTENSION IF NOT EXISTS tablefunc;

-- 32. intarray - Integer array functions and operators
CREATE EXTENSION IF NOT EXISTS intarray;

-- 33. moddatetime - Automatic timestamp update trigger
CREATE EXTENSION IF NOT EXISTS moddatetime;

-- 34. insert_username - Automatic username insertion trigger
CREATE EXTENSION IF NOT EXISTS insert_username;

-- =============================================================================
-- ADDITIONAL UTILITIES (Bonus)
-- =============================================================================

-- tcn (Triggered Change Notification) - Notify on table changes
CREATE EXTENSION IF NOT EXISTS tcn;

-- =============================================================================
-- FERRETDB SCHEMA (CRITICAL - Fixes LibreChat Crash Loop)
-- =============================================================================

-- Create schema for FerretDB (MongoDB wire protocol over Postgres)
CREATE SCHEMA IF NOT EXISTS documentdb_api;
COMMENT ON SCHEMA documentdb_api IS 'FerretDB schema for MongoDB compatibility (used by LibreChat)';

-- Grant permissions to ferretdb user (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_user WHERE usename = 'ferretdb') THEN
    GRANT ALL ON SCHEMA documentdb_api TO ferretdb;
    GRANT ALL ON ALL TABLES IN SCHEMA documentdb_api TO ferretdb;
    ALTER DEFAULT PRIVILEGES IN SCHEMA documentdb_api GRANT ALL ON TABLES TO ferretdb;
  END IF;
END $$;

-- =============================================================================
-- FORENSIC INFRASTRUCTURE (Audit Logging & Chain of Custody)
-- =============================================================================

-- Create audit_log table for chain of custody tracking
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  sha256_hash TEXT,
  ip_address INET,
  user_agent TEXT
);

-- Create index for fast audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON public.audit_log (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log (user_id);

COMMENT ON TABLE public.audit_log IS 'Forensic audit log for chain of custody tracking';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- List all installed extensions (should show 34+)
SELECT 
  e.extname AS extension_name,
  e.extversion AS version,
  n.nspname AS schema,
  c.description
FROM pg_extension e
LEFT JOIN pg_namespace n ON n.oid = e.extnamespace
LEFT JOIN pg_description c ON c.objoid = e.oid
ORDER BY e.extname;

-- Count extensions (should be 36+ including plpgsql and uuid-ossp)
SELECT COUNT(*) AS total_extensions FROM pg_extension;

-- Verify critical extensions are present
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN '✓'
    ELSE '✗'
  END AS pgvector,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN '✓'
    ELSE '✗'
  END AS pgcrypto,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN '✓'
    ELSE '✗'
  END AS postgis,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN '✓'
    ELSE '✗'
  END AS pg_cron,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_schema WHERE nspname = 'documentdb_api') THEN '✓'
    ELSE '✗'
  END AS ferretdb_schema;

-- Test pgvector functionality
SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector AS vector_distance_test;

-- Test pgcrypto (SHA-256 hashing)
SELECT encode(digest('test evidence', 'sha256'), 'hex') AS sha256_hash_test;

-- Test PostGIS
SELECT ST_AsText(ST_MakePoint(-122.4194, 37.7749)) AS postgis_point_test;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VPS1 Postgres Extension Installation Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total Extensions Installed: %', (SELECT COUNT(*) FROM pg_extension);
  RAISE NOTICE 'FerretDB Schema: documentdb_api created';
  RAISE NOTICE 'Audit Log Table: public.audit_log created';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Restart LibreChat container (should exit crash loop)';
  RAISE NOTICE '2. Verify System Router can access pgvector';
  RAISE NOTICE '3. Test forensic SHA-256 hashing';
  RAISE NOTICE '4. Run verification checklist';
  RAISE NOTICE '========================================';
END $$;

-- =============================================================================
-- END OF SCRIPT
-- =============================================================================
