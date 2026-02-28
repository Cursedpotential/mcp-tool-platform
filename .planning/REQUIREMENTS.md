# MCP Tool Platform — v1 Requirements (Merged Architecture)

**Project:** MCP Tool Platform  
**Generated:** 2026-02-26  
**Architecture:** DuckDB + LanceDB + Dual Neo4j + Two-pass enrichment  
**Core Value:** Raw messaging exports → temporally-aware, forensically-hashed evidence with bidirectional LLM/Portal/API access

---

## Architecture Overview

### Storage Layer
- **DuckDB** — Embedded master clock & ETL engine (chronological normalization, SHA-256 hashing, dedupe)
- **LanceDB** — Multimodal vault (raw binaries, vector embeddings, Arrow-native)
- **Neo4j dual databases:**
  - `semantic_facts` — Semantica-managed validated entities, PROV-O provenance
  - `temporal_memory` — Graphiti-managed temporal edges, episodic memory


### Enrichment Model
- **Pass 1** — Blind classification (immediate 24-hour context only): sentiment, intent, entities
- **Pass 2** — Hindsight synthesis (longitudinal): community detection, contradictions, pattern evolution

### Bidirectional Access
Every requirement must support:
- **MCP Tools** — For LLM agents (progressive disclosure: core exposed, extended discoverable)
- **REST API** — For backend integrations
- **Portal UI** — For manual ingestion and HITL workflows

---

## v1 Requirements

### Foundation (FOUND)

- [ ] **FOUND-01**: TypeScript compilation clean — `tsc --noEmit` exits 0 with zero errors
- [ ] **FOUND-02**: Storage connectivity verified at startup: DuckDB (embedded), LanceDB (local), Neo4j (dual DBs), ChromaDB with clear pass/fail per tier
- [ ] **FOUND-03**: Python bridge unified — single bridge handles NLP, Graphiti, and Semantica calls (no dual spawn logic)
- [ ] **FOUND-04**: DuckDB initialized — staging tables, ETL functions, SHA-256 utilities ready
- [ ] **FOUND-05**: LanceDB initialized — schema for raw binaries + metadata + vector columns

**Bidirectional:**
- MCP: `health_check_storage`, `get_storage_status`
- API: `GET /api/v1/health`
- Portal: Status dashboard showing all tiers

### Storage Foundation (STOR)

- [ ] **STOR-01**: DuckDB ingestion pipeline — raw files → normalized records + SHA-256 hash + provenance chain
- [ ] **STOR-02**: LanceDB binary storage — original files stored with metadata linking to DuckDB records (UUID foreign key)
- [ ] **STOR-03**: Zero-copy Arrow integration — DuckDB can query LanceDB data without serialization overhead
- [ ] **STOR-04**: Neo4j `semantic_facts` database — accepts validated entity writes with PROV-O provenance
- [ ] **STOR-05**: Neo4j `temporal_memory` database — accepts temporal edges with valid_at/invalid_at timestamps
- [ ] **STOR-06**: Write tracking — every write to any tier logs success/failure to DuckDB `write_status` table
- [ ] **STOR-07**: Chain of custody — any record can trace back to original file hash + ingestion timestamp

**Bidirectional:**
- MCP: `duckdb_ingest_file`, `lancedb_store_binary`, `lancedb_retrieve_binary`, `neo4j_write_entity`, `neo4j_write_temporal`, `get_provenance_chain`, `verify_file_hash`
- API: `POST /api/v1/ingest`, `GET /api/v1/provenance/:hash`, `GET /api/v1/verify/:hash`
- Portal: File upload with drag-drop, hash verification display, provenance browser

### Data Pipeline (PIPE)

- [ ] **PIPE-01**: SMS/XML upload through UI — user selects file, clicks upload, triggers ingestion via DuckDB pipeline
- [ ] **PIPE-02**: TrinityRouter → DuckDB — pipeline flows through DuckDB staging before downstream writes
- [ ] **PIPE-03**: Schema consolidation — single canonical message schema (eliminate 3 competing definitions)
- [ ] **PIPE-04**: SHA-256 at first touch — hash generated before any transformation, stored in DuckDB + LanceDB + Neo4j
- [ ] **PIPE-05**: Streaming large files — lxml.iterparse for XML/HTML, streaming JSON for 10K+ message exports (no OOM)
- [ ] **PIPE-06**: Zero Supabase references — all stale Supabase code removed from active pipeline

**Bidirectional:**
- MCP: `ingest_sms_export`, `ingest_generic_xml`, `get_ingestion_status`
- API: `POST /api/v1/ingest/sms`, `GET /api/v1/ingest/:job_id/status`
- Portal: Upload widget with format detection, progress bar, dedupe warnings

### Parsers (PARSE)

- [ ] **PARSE-01**: SMS/XML parser E2E — upload XML SMS export, verify messages stored in DuckDB → downstream tiers
- [ ] **PARSE-02**: Facebook HTML parser — ported and tested with real Facebook data export, stores in same schema as SMS
- [ ] **PARSE-03**: Pipeline consolidation — production-pipeline.ts and end-to-end-pipeline.ts merged into DuckDB-based flow

**Bidirectional:**
- MCP: `parse_sms_xml`, `parse_facebook_html`, `preview_parse`
- API: `POST /api/v1/parse/sms`, `POST /api/v1/parse/facebook`, `POST /api/v1/parse/preview`
- Portal: Format preview before ingestion, parse error display

### Pass 1 Enrichment (ENRICH-1)

- [ ] **ENRICH-01**: Immediate context window — Pass 1 uses only 24-hour context (captures "how it felt at the time")
- [ ] **ENRICH-02**: Multi-Pass Classifier — sentiment (pos/neg/anxious/neutral), intent (inquiry/conflict/financial/planning/social)
- [ ] **ENRICH-03**: Entity extraction — Duckling + spaCy for dates, amounts, addresses, relative times
- [ ] **ENRICH-04**: Real embeddings — 768-dim from Ollama nomic-embed-text (zero mock embeddings remaining)
- [ ] **ENRICH-05**: Pass 1 state locked — initial classification stored with immutable SHA-256 reference to original message
- [ ] **ENRICH-06**: Pattern Analyzer — tags messages matching 303 patterns with confidence scores and MCL 722.23 mappings
- [ ] **ENRICH-07**: Multi-tier writes — Pass 1 outputs to DuckDB (structured), Neo4j temporal_memory (entities), LanceDB (embeddings)

**Bidirectional:**
- MCP: `classify_message_pass1`, `extract_entities_pass1`, `analyze_sentiment`, `detect_patterns`, `get_pass1_status`
- API: `POST /api/v1/enrich/pass1`, `GET /api/v1/enrich/:message_id/pass1`, `GET /api/v1/patterns/detect`
- Portal: Message browser with sentiment badges, pattern highlights, entity sidebar

### Pattern Detection UX (UI)

- [ ] **UI-01**: Message browser — list view with sender, timestamp, content, Pass 1 tags, search, filter by date/sender/pattern
- [ ] **UI-02**: Pattern Library — all 303 patterns with categories, descriptions, MCL 722.23 factor mappings (21 TODOs connected)
- [ ] **UI-03**: Pattern results in messages — each message shows detected patterns with confidence and factor mapping
- [ ] **UI-04**: HITL approval queue — review low-confidence detections, approve/reject/reclassify with CopilotKit
- [ ] **UI-05**: Semantic search — natural language query ("threats about custody") returns messages ranked by LanceDB vector similarity
- [ ] **UI-06**: Cross-tier search — query spans DuckDB (structured), LanceDB (vectors), Neo4j (relationships)

**Bidirectional:**
- MCP: `search_semantic`, `filter_by_pattern`, `get_hitl_queue`, `approve_detection`, `reject_detection`, `search_cross_tier`
- API: `POST /api/v1/search`, `GET /api/v1/patterns`, `GET /api/v1/hitl/queue`, `POST /api/v1/hitl/approve`
- Portal: Full Pattern Library UI, HITL review panel, semantic search bar, message browser with filters

### Multi-Source & Document Intelligence (SOURCE)

- [ ] **SOURCE-01**: Facebook data loaded — Facebook HTML export parsed and displayed alongside SMS in unified browser
- [ ] **SOURCE-02**: Docling integration — PDF/DOCX/PPTX/XLSX parsing with layout understanding and table extraction
- [ ] **SOURCE-03**: Docling MCP server — available for ad-hoc document parsing requests
- [ ] **SOURCE-04**: Image OCR — Vision-language models (GPT-4o-mini, Gemini) extract text + generate captions from screenshots
- [ ] **SOURCE-05**: Cross-platform timeline — messages from SMS, Facebook, documents unified in chronological order
- [ ] **SOURCE-06**: Platform filtering — filter timeline by source (SMS only, Facebook only, etc.) to compare patterns

**Bidirectional:**
- MCP: `ingest_facebook_export`, `parse_with_docling`, `extract_image_text`, `build_cross_platform_timeline`
- API: `POST /api/v1/ingest/facebook`, `POST /api/v1/parse/docling`, `POST /api/v1/ocr/image`, `GET /api/v1/timeline`
- Portal: Facebook HTML upload, PDF/Office doc viewer with Docling structure display, timeline visualization

### Pass 2 Enrichment (ENRICH-2)

- [ ] **ENRICH-08**: Bitemporal timestamps — every message has `event_time` (when sent) and `ingested_at` (when processed)
- [ ] **ENRICH-09**: Pass 2 trigger — user can flag case for hindsight synthesis (or auto-trigger after N messages)
- [ ] **ENRICH-10**: Community detection — GraphRAG identifies life phases, behavioral shifts, recurring themes across months/years
- [ ] **ENRICH-11**: Contradiction detection — Graphiti identifies conflicts (e.g., "at home" claim + GPS differ) → creates CONTRADICTS edge
- [ ] **ENRICH-12**: Pass 2 annotations — longitudinal analysis results link to original Pass 1 nodes without modifying locked state
- [ ] **ENRICH-13**: Pattern evolution — query shows how relationship patterns changed over time (e.g., "What changed in 2019?")
- [ ] **ENRICH-14**: Gaslighting evidence — contradictions between Pass 1 (what was said) and Pass 2 (what happened) are queryable

**Bidirectional:**
- MCP: `run_pass2_synthesis`, `detect_communities`, `find_contradictions`, `query_pattern_evolution`, `get_pass2_report`
- API: `POST /api/v1/enrich/pass2`, `GET /api/v1/contradictions`, `GET /api/v1/communities`, `GET /api/v1/evolution`
- Portal: Hindsight synthesis trigger button, contradiction report viewer, community/timeline visualization

### Agent & Query Layer (AGENT)

- [ ] **AGENT-01**: Semantica integration — Python service handles provenance, conflict detection, NER, GraphRAG, W3C PROV-O alignment
- [ ] **AGENT-02**: Agno integration — Agent runtime with MCPTools, PgVector integration, sessions/streaming/tracing
- [ ] **AGENT-03**: CopilotKit integration — HITL UI with shared state, generative UI, approval gates, fact correction loops
- [ ] **AGENT-04**: Progressive tool exposure — core tools always available, extended tools discoverable on demand
- [ ] **AGENT-05**: Tool discovery — LLM can request access to extended tools, user approves via CopilotKit
- [ ] **AGENT-06**: Query capabilities — complex queries working:
  - "Show me anxious messages within 1 hour of GPS conflicts"
  - "What changed in my relationship patterns in 2019?"
  - "Find screenshots from Law Office visits + related chats"
  - "Generate forensic report for Nov 14, 2019 with full provenance"

**Bidirectional:**
- MCP: `semantica_extract`, `semantica_validate`, `semantica_query`, `agno_run_agent`, `discover_tools`, `request_tool_access`
- API: `POST /api/v1/agents/query`, `POST /api/v1/reports/forensic`, `GET /api/v1/tools`, `POST /api/v1/tools/request`
- Portal: CopilotKit-powered assistant, HITL review panels, forensic report generator

---

## v2 Requirements (Deferred)

### Deferred from Foundation
- [ ] Move 5 hardcoded GCP API keys to `.env` — security debt
- [ ] Auth bypass mode (`AUTH_MODE=bypass`) for Tailscale-protected deployment

### Deferred from Pipeline
- [ ] BullMQ async pipeline — FlowProducer for staged processing

### Deferred from Parsers
- [ ] Snapchat parser — schema exists, no loader yet

### Deferred from UI
- [ ] Pipeline progress feedback — SSE/WebSocket progress bar
- [ ] Knowledge graph 2D visualization

### Deferred from Memory
- [ ] Directus as bulk storage/admin portal
- [ ] Chain-of-custody audit trail UI

### Deferred from Frameworks
- [ ] Langflow — visual workflow builder with MCP client/server support

---

## Out of Scope

- Multi-user/multi-tenant support
- Mobile app
- Real-time collaboration
- Public-facing deployment
- Voice/video processing
- TraceIQ integration (separate project)
- Automated court document generation
- CI/CD pipeline
- Case Bible/Obsidian integration
- 3D graph rendering

---

## Traceability (Updated for Merged Architecture)

| REQ-ID | Phase | Description | Status |
|--------|-------|-------------|--------|
| FOUND-01 | 1 | TypeScript clean compile | Pending |
| FOUND-02 | 1 | Storage connectivity (all 5 tiers) | Pending |
| FOUND-03 | 1 | Python bridge unified | Pending |
| FOUND-04 | 1 | DuckDB initialized | Pending |
| FOUND-05 | 1 | LanceDB initialized | Pending |
| STOR-01 | 2 | DuckDB ingestion pipeline | Pending |
| STOR-02 | 2 | LanceDB binary storage | Pending |
| STOR-03 | 2 | Zero-copy Arrow integration | Pending |
| STOR-04 | 2 | Neo4j semantic_facts database | Pending |
| STOR-05 | 2 | Neo4j temporal_memory database | Pending |
| STOR-06 | 2 | Per-tier write tracking | Pending |
| STOR-07 | 2 | Chain of custody | Pending |
| PIPE-01 | 3 | SMS/XML upload UI | Pending |
| PIPE-02 | 3 | TrinityRouter → DuckDB | Pending |
| PIPE-03 | 3 | Schema consolidation | Pending |
| PIPE-04 | 3 | SHA-256 at first touch | Pending |
| PIPE-05 | 3 | Streaming large files | Pending |
| PIPE-06 | 3 | Remove Supabase references | Pending |
| PARSE-01 | 3 | SMS parser E2E | Pending |
| PARSE-02 | 6 | Facebook parser | Pending |
| PARSE-03 | 3 | Pipeline consolidation | Pending |
| ENRICH-01 | 4 | Pass 1: 24-hour context | Pending |
| ENRICH-02 | 4 | Multi-Pass Classifier | Pending |
| ENRICH-03 | 4 | Entity extraction (Duckling + spaCy) | Pending |
| ENRICH-04 | 4 | Real 768-dim embeddings | Pending |
| ENRICH-05 | 4 | Pass 1 state locked | Pending |
| ENRICH-06 | 4 | Pattern Analyzer (303 patterns) | Pending |
| ENRICH-07 | 4 | Pass 1 multi-tier writes | Pending |
| ENRICH-08 | 7 | Bitemporal timestamps | Pending |
| ENRICH-09 | 7 | Pass 2 trigger | Pending |
| ENRICH-10 | 7 | Community detection | Pending |
| ENRICH-11 | 7 | Contradiction detection | Pending |
| ENRICH-12 | 7 | Pass 2 annotations | Pending |
| ENRICH-13 | 7 | Pattern evolution | Pending |
| ENRICH-14 | 7 | Gaslighting evidence | Pending |
| UI-01 | 5 | Message browser | Pending |
| UI-02 | 5 | Pattern Library | Pending |
| UI-03 | 5 | Pattern results in messages | Pending |
| UI-04 | 5 | HITL approval queue | Pending |
| UI-05 | 5 | Semantic search | Pending |
| UI-06 | 5 | Cross-tier search | Pending |
| SOURCE-01 | 6 | Facebook data loaded | Pending |
| SOURCE-02 | 6 | Docling integration | Pending |
| SOURCE-03 | 6 | Docling MCP server | Pending |
| SOURCE-04 | 6 | Image OCR | Pending |
| SOURCE-05 | 6 | Cross-platform timeline | Pending |
| SOURCE-06 | 6 | Platform filtering | Pending |
| AGENT-01 | 8 | Semantica integration | Pending |
| AGENT-02 | 8 | Agno integration | Pending |
| AGENT-03 | 8 | CopilotKit integration | Pending |
| AGENT-04 | 8 | Progressive tool exposure | Pending |
| AGENT-05 | 8 | Tool discovery | Pending |
| AGENT-06 | 8 | Complex query capabilities | Pending |

**Total:** 53 requirements mapped to 8 phases  
**Coverage:** 100% — all requirements map to exactly one phase

---

## References

- **ROADMAP.md** — `.planning/ROADMAP.md` (merged architecture, 8 phases)
- **STATE.md** — `.planning/STATE.md` (architecture pivot documented)
- **Architectural Blueprint** — `docs/integrated-architecture-blueprint.md` (1264 lines — DuckDB, LanceDB, dual Neo4j, two-pass)
- **Framework Discussion** — `docs/[https___github.com_Hawksight-AI_semantica](https_.md)` (1777 lines — Semantica, Docling, Agno, CopilotKit)
- **Original Storage** — `STORAGE_ARCHITECTURE.md` (may need alignment review)
- **Original Backend** — `BACKEND_ARCHITECTURE.md` (may need alignment review)

---
*Generated: 2026-02-26 by gsd-roadmapper@opencode*  
*Architecture: Merged (DuckDB + LanceDB + Dual Neo4j + Two-pass enrichment)*
