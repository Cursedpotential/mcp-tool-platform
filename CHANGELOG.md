<!-- File: CHANGELOG.md | Date: 2026-01-11 | Agent: Claude Code | Model: Opus 4.1 -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Multi-Store Architecture**: Hybrid MySQL (VPS3) + PostgreSQL (VPS2) + Neo4j + Chroma + Redis + Directus
- Trinity Router (`server/mcp/storage/systemRouter.ts`) for orchestrated multi-tier storage
- Dedicated database helpers: `db.mysql.ts` and `db.postgres.ts`
- Neo4j/Graphiti client wiring with driver-backed queries and connection testing.
- Headless Colab Enterprise settings endpoints and UI card (test/save stubs, ready for real API hooks).
- Postgres extension audit endpoint to verify Supabase-style extensions (vector/postgis/pg_graphql/pg_net/pg_cron/pgsodium/etc.).
- MCP graph routing now executes Cypher via Graphiti.

### Changed

- **BREAKING**: Removed all Supabase dependencies and client code
- Settings router migrated from Supabase to MySQL
- Patterns router migrated from Supabase to MySQL

### Changed

- Settings router/UI extended for graph/Colab and extension reporting; fixed API key delete return path.
- Dependencies: added `neo4j-driver` for graph connectivity.

### Pending/Next

- Implement real Colab Enterprise job runner API calls and persistence.
- Implement pattern router + UI wiring; finalize LLM/tool/vector routing with cost/health tracking.
- Apply Traefik labels/subdomain mapping (Coolify public; Kasm/Browser tailnet-only) and enable logging stack.

## [0.1.0] - 2026-01-10

### Added

- **Initial Platform Architecture**: Forensic legal case management + MCP tool server
- **Docker Compose Configuration**: Multi-service deployment with LiteLLM, MetaMCP, Neo4j, Chroma
- **Bidirectional MCP Architecture**: Internal + External MetaMCP for client integration
- **Database Integration**: Supabase PostgreSQL, Neo4j Aura, in-process Chroma
- **AI Framework Integration**: LangGraph, LangChain, LlamaIndex for forensic analysis
- **Pattern Library**: 256 behavioral patterns for gaslighting/DARVO detection
- **Multi-Pass NLP Classifier**: 6-pass analysis pipeline with spaCy, NLTK, TextBlob
- **Document Processing Pipeline**: OCR, parsing, entity extraction, behavioral analysis
- **Tool Registry**: 65+ forensic tools registered (20 working, 45 pending)

### Known Issues

- drizzle.config.ts shows MySQL dialect but needs PostgreSQL (FIXED)
- Router layer (server/\_core/router.ts) has TODOs in all major functions
- 45/65 tool handlers are stubbed and need implementation
- Backend UI wiring incomplete (Settings, Pattern Library pages)
- OOM errors in document loaders for large files
- Missing External MetaMCP deployment for client tool exposure (FIXED)

### Dependencies

- **Backend**: Node.js 22, TypeScript 5.9, Express 4.21, tRPC 11.6
- **Database**: MySQL (VPS3), PostgreSQL + PGVector + PostGIS (VPS2), Neo4j Aura, Chroma, Redis
- **AI/ML**: spaCy, NLTK, TextBlob, sentence-transformers
- **Frontend**: React 19, Tailwind CSS 4, tRPC hooks
- **Infrastructure**: Docker Compose, 9 microservices, multi-VPS deployment
