# MCP Tool Platform — v1 Requirements

**Project:** MCP Tool Platform
**Generated:** 2026-02-25
**Core Value:** Take raw messaging exports and turn them into searchable, pattern-tagged, forensically-hashed evidence with a temporal knowledge graph.

---

## v1 Requirements

### Foundation (FOUND)

- [ ] **FOUND-01**: App compiles cleanly — fix ~80 TypeScript errors from branch merge (`tsc --noEmit` exits 0)
- [ ] **FOUND-02**: Database connectivity verified at startup for all active tiers (PostgreSQL, Neo4j, ChromaDB, MySQL, Directus) with clear error messages if unreachable
- [ ] **FOUND-03**: Python bridge unified — consolidate python-bridge.ts and graphiti-client.ts spawn logic into a single bridge with shared process management

### Data Pipeline (PIPE)

- [ ] **PIPE-01**: User can upload a messaging export file (XML, HTML, JSON) through the UI and trigger ingestion
- [ ] **PIPE-02**: TrinityRouter wired into ingestion pipeline — replaces stale Supabase references, routes writes to correct database tiers
- [ ] **PIPE-03**: Real embeddings generated via Ollama (nomic-embed-text 768-dim) — mock `Array(384).fill(0)` replaced throughout
- [ ] **PIPE-04**: Schema reconciliation complete — consolidate 3 competing schema approaches (drizzle/schema.ts, production-message-schemas, production-pipeline.ts) into one canonical schema
- [ ] **PIPE-05**: Multi-database write tracking — `write_status` JSON column in PostgreSQL tracks per-tier success/failure for every processed message
- [ ] **PIPE-06**: Large file handling — stream-parse JSON/XML files instead of `JSON.parse(readFileSync)` to prevent OOM on 10K+ message exports

### Parsers (PARSE)

- [ ] **PARSE-01**: SMS/XML parser tested end-to-end with real data — upload XML SMS export, verify messages stored in PostgreSQL
- [ ] **PARSE-02**: Facebook HTML parser ported from production-pipeline.ts to ingestion router pattern and tested with real Facebook data export
- [ ] **PARSE-03**: Duplicate pipeline files consolidated — production-pipeline.ts and end-to-end-pipeline.ts merged into ingestion router as single pipeline implementation

### NLP & Pattern Detection (NLP)

- [ ] **NLP-01**: Multi-Pass Classifier wired into pipeline — runs after parse stage, before storage, tags messages with sentiment/entities/topics
- [ ] **NLP-02**: Pattern Analyzer (1659 lines, 303 behavioral patterns) wired as pipeline stage — runs after NLP, detects gaslighting/DARVO/coercive control/NPD/BPD/ASPD/DV indicators
- [ ] **NLP-03**: Pattern Analyzer migrated from SQL.js to Drizzle ORM (PostgreSQL) — eliminates redundant in-memory database
- [ ] **NLP-04**: Pattern Library UI wired — 21 commented-out tRPC calls uncommented and connected to backend procedures
- [ ] **NLP-05**: Pattern detection results visible in message browser — each message shows detected patterns with confidence scores and MCL 722.23 factor mappings

### Frontend & UI (UI)

- [ ] **UI-01**: Message results browser — list view with search, filter by date/sender/platform/pattern, conversation threading, pagination
- [ ] **UI-02**: HITL approval queue — review low-confidence pattern detections, approve/reject/reclassify, with existing backend (547 lines) connected to existing UI components
- [ ] **UI-03**: Semantic search — pgvector-powered search component where user types natural language query and gets relevant messages ranked by similarity
- [ ] **UI-04**: Cross-platform timeline — unified chronological view of messages across all platforms, wiring existing backend + existing UI agent components

### Memory Architecture (MEM)

- [ ] **MEM-01**: Memory architecture restructured per Perplexity conversation — PG/pgvector as the spine with bitemporal timestamps (event_time + ingested_at). See: `C:\Users\matts\Projects\TheBigOne\[https___github.com_Hawksight-AI_semantica](https_.md` for full architecture specification
- [ ] **MEM-02**: Graphiti used selectively for high-value flagged conversations only — NOT bulk processing. Direct Cypher for initial entity population. Budget-capped or Ollama-powered LLM calls.

### Framework Integration (FW)

- [ ] **FW-01**: Semantica (Hawksight-AI) integrated as semantic intelligence layer between ingestion and graph/vector stores — replaces hand-rolled provenance tracking, conflict detection, and custom NER pipelines. See Perplexity conversation for implementation details.
- [ ] **FW-02**: Docling (IBM/LF AI) integrated for document intelligence — canonical parser for PDF/DOCX/PPTX/XLSX/HTML with layout understanding and table extraction. Has MCP server. Replaces custom PDF parsing.
- [ ] **FW-03**: Agno integrated as primary agent runtime/AgentOS — replaces custom agent orchestration. MCPTools for calling MCP servers, PgVector integration, sessions/streaming/tracing. Python-based.
- [ ] **FW-04**: CopilotKit integrated as human-in-the-loop UI layer — React-native copilot with shared state, generative UI, approval gates, fact correction loops. Replaces existing HITL system in `server/mcp/hitl/`.

---

## v2 Requirements (Deferred)

### Deferred from Foundation
- [ ] Move 5 hardcoded GCP API keys to `.env` — security debt, address before any public exposure
- [ ] Python bridge startup health gate — verify spaCy + sentence-transformers load, reject fallback results
- [ ] Auth bypass mode (`AUTH_MODE=bypass`) for Tailscale-protected deployment

### Deferred from Data Pipeline
- [ ] BullMQ async pipeline — FlowProducer for staged processing. Currently synchronous is acceptable for initial use.

### Deferred from Parsers
- [ ] Snapchat parser — schema exists with CSS selectors, no loader yet. Net-new code.

### Deferred from Frontend
- [ ] Pipeline progress feedback — onProgress → SSE/WebSocket → frontend progress bar
- [ ] Knowledge graph 2D visualization — highest complexity, needs graph rendering library

### Deferred from Memory
- [ ] Directus as bulk storage/admin portal over PostgreSQL
- [ ] Chain-of-custody audit trail UI — display hash provenance for any document

### Deferred from Frameworks
- [ ] Langflow — visual workflow builder as "design studio and incubator"
- [ ] OWL (CAMEL-AI) — optional specialist multi-agent automation

---

## Out of Scope

- Multi-user/multi-tenant support — single user (Matt)
- Mobile app — desktop/laptop browser only
- Real-time collaboration — solo operation
- Public-facing deployment — private Tailscale + Cloudflare Access
- Voice/video processing — future, after messaging workflow is solid
- TraceIQ integration — separate GSD project
- Automated court document generation — future milestone
- CI/CD pipeline — not needed until deployment is stable
- Case Bible/Obsidian integration — architectural requirement but deferred
- 3D graph rendering — 2D sufficient

---

## Traceability

<!-- Filled by roadmapper -->

| REQ-ID | Phase | Status |
|--------|-------|--------|

---

## References

- **PROJECT.md**: `.planning/PROJECT.md`
- **Research Summary**: `.planning/research/SUMMARY.md`
- **Architectural Evolution**: `C:\Users\matts\Projects\TheBigOne\[https___github.com_Hawksight-AI_semantica](https_.md)` (1777 lines — Semantica, Docling, Agno, CopilotKit, memory tiers)
- **Existing Architecture**: `STORAGE_ARCHITECTURE.md` (DO NOT CHANGE), `BACKEND_ARCHITECTURE.md` (DEFINITIVE)

---
*Generated: 2026-02-25 by gsd-orchestrator@opencode*
*Ready for roadmap: yes*
