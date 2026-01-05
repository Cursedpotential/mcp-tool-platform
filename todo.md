

## Phase 3 - Chroma In-Process + Database Integration
- [x] Add persistent disk storage for Chroma collections (JSON-based)
- [x] Implement Chroma collection CRUD operations with file persistence
- [x] Wire Chroma handlers to executor (vector.add, vector.search, vector.delete, vector.list_collections)
- [ ] Add Chroma endpoints to MCP gateway
- [ ] Create Chroma management UI page (view collections, search, add/delete vectors)
- [x] Add TTL cleanup job for expired Chroma collections
- [ ] Write vitest tests for Chroma operations
- [x] Prepare pgvector/Supabase integration (connection string, extension detection)
- [ ] Create tRPC procedures for database configuration (saveSupabaseConfig, testConnection)
- [ ] Wire Settings UI database forms to backend procedures
- [ ] Implement Graphiti-style entity/relationship operations in-process against Supabase Postgres
- [x] Add graphiti-core to Python requirements
- [x] Create server/python-tools/graphiti_runner.py with 6 operations
- [x] Wire Graphiti handlers to executor (add_entity, add_relationship, search_entities, get_entity_timeline, detect_contradictions, query_as_of)
- [x] Create server/mcp/plugins/pgvector-supabase.ts with full CRUD operations
- [x] Install @supabase/supabase-js package
- [x] Add SQL setup scripts for pgvector table creation


## Phase 6 - Database Configuration & Testing
- [x] Get correct Supabase session pooler URL and API key
- [x] Get correct Neo4j Aura connection URI
- [x] Test Supabase connection with session pooler
- [x] Test Neo4j Aura connection
- [ ] Document available Supabase extensions (pgvector, PostGIS, pg_cron, etc.)
- [ ] Create tRPC procedures for database configuration (saveSupabaseConfig, testSupabaseConnection, saveNeo4jConfig, testNeo4jConnection)
- [ ] Wire Settings UI database forms to backend procedures
- [ ] Add database stats to monitoring dashboard
- [ ] Create database migration utilities
- [ ] Write vitest tests for database operations
