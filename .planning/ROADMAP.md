# MCP Tool Platform — Roadmap (Merged Architecture)

**Generated:** 2026-02-26  
**Depth:** comprehensive  
**Total phases:** 8  
**Core value:** Raw messaging exports → temporally-aware, forensically-hashed evidence with bidirectional LLM/Portal/API access  
**Architecture:** DuckDB (master clock) + LanceDB (multimodal vault) + Dual Neo4j (semantic_facts + temporal_memory) + Two-pass enrichment

---

## Architecture Overview

### Storage Layer (New Foundation)

```
┌─────────────────────────────────────────────────────────────────┐
│  DUCKDB — Master Clock & ETL Engine                              │
│  ├─ Chronological normalization (all timestamps → UTC)          │
│  ├─ SHA-256 hashing at first touch (chain of custody)           │
│  ├─ Deduplication via content hash                               │
│  └─ Schema unification (cross-platform → common format)         │
├─────────────────────────────────────────────────────────────────┤
│  LANCEDB — Multimodal Vault                                      │
│  ├─ Raw binary storage (screenshots, PDFs, audio)               │
│  ├─ Vector embeddings (CLIP for images, text embeddings)        │
│  ├─ Metadata: UUID, source_hash, timestamp, OCR_text            │
│  └─ Zero-copy Arrow ↔ DuckDB integration                        │
├─────────────────────────────────────────────────────────────────┤
│  NEO4J — Dual Database                                           │
│  ├─ semantic_facts (Semantica-managed)                          │
│  │   └─ Validated entities, PROV-O provenance, conflicts        │
│  └─ temporal_memory (Graphiti-managed)                          │
│      └─ Temporal edges, fact evolution, episodic memory         │
└─────────────────────────────────────────────────────────────────┘
```

### Enrichment Model (Two-Pass)

**Pass 1 — Blind Ingestion (Immediate Context)**
- Sentiment, intent classification using 24-hour window only
- Entity extraction (dates, amounts, locations)
- Lock initial state with immutable hash
- Captures "how it felt at the time"

**Pass 2 — Hindsight Synthesis (Longitudinal)**
- Community detection across months/years
- Contradiction detection (e.g., "at home" vs GPS)
- Pattern identification invisible to original participant
- Critical for gaslighting detection

### Bidirectional Access

All functionality exposed through:
- **MCP Tools** — For LLM agents (progressive disclosure: core tools exposed, others discoverable)
- **REST API** — For backend integrations
- **Portal UI** — For manual ingestion, review, HITL workflows
- **Workflow Engine** — Multi-step composed from atomic tools

---

## Phase 1: Foundation — "Infrastructure That Breathes"

**Goal:** App compiles, all storage tiers connect, DuckDB + LanceDB initialized as core infrastructure.

**Requirements:** FOUND-01, FOUND-02, FOUND-03, STOR-01, STOR-02

**Success Criteria:**
1. `tsc --noEmit` exits 0 with zero TypeScript errors
2. App starts and reports connection status: DuckDB (embedded), LanceDB (local), Neo4j (dual DBs), ChromaDB _(deprecated Tier 5 — legacy only, see docs/ARCHITECTURE_SSOT.md)_
3. DuckDB initialized with staging tables for ingestion, ETL functions, SHA-256 utilities
4. LanceDB initialized with schema for raw binaries + metadata + vector columns
5. Neo4j configured with two named databases: `semantic_facts` and `temporal_memory`
6. Python bridge starts and confirms spaCy, sentence-transformers loaded
7. Unified bridge handles NLP, Graphiti, and Semantica calls

**Estimated effort:** 3-4 days  
**Dependencies:** None  
**Research needed:** DuckDB Node.js API patterns, LanceDB embedding storage

---

## Phase 2: Storage Foundation — "DuckDB + LanceDB + Dual Neo4j"

**Goal:** Storage layers operational with bidirectional read/write paths and forensic integrity.

**Requirements:** STOR-03, STOR-04, STOR-05, PIPE-02

**Success Criteria:**
1. DuckDB can ingest raw files (any format) and emit: normalized record + SHA-256 hash + provenance chain
2. LanceDB stores original binaries with metadata linking back to DuckDB records (foreign key via UUID)
3. Zero-copy query: DuckSQL can JOIN with LanceDB Arrow data without serialization
4. Neo4j `semantic_facts` DB accepts validated entity writes with PROV-O provenance
5. Neo4j `temporal_memory` DB accepts temporal edges with valid_at/invalid_at timestamps
6. Write tracking: Every write to any tier logs success/failure to DuckDB `write_status`
7. Chain of custody: Any record can trace back to original file hash + ingestion timestamp

**Bidirectional capabilities:**
- MCP tools: `duckdb_ingest_file`, `lancedb_store_binary`, `neo4j_write_entity`, `neo4j_write_temporal`
- API endpoints: `/api/v1/ingest`, `/api/v1/storage/query`
- Portal: File upload UI with progress, hash verification display

**Estimated effort:** 4-5 days  
**Dependencies:** Phase 1  
**Research needed:** LanceDB-DuckDB Arrow integration patterns

---

## Phase 3: Ingestion Pipeline — "SHA-256 at First Touch"

**Goal:** Unified pipeline that ingests any format (XML, HTML, PDF, images) through DuckDB with immediate forensic hashing.

**Requirements:** PIPE-01, PIPE-04, PIPE-05, PARSE-01, PARSE-03

**Success Criteria:**
1. Single pipeline implementation (merged from competing versions) — all ingestion flows through DuckDB staging
2. Zero Supabase references in pipeline code
3. Canonical message schema flows from parser → DuckDB → downstream (one definition, not three)
4. Upon file upload: SHA-256 hash generated before any transformation, stored in all three places (DuckDB, LanceDB, Neo4j)
5. SMS/XML parser tested end-to-end: upload → DuckDB normalization → message browser
6. Large files (10K+ messages) stream through without memory errors (lxml.iterparse, streaming JSON)
7. All writes tracked per-tier in DuckDB `write_status`

**Bidirectional capabilities:**
- MCP tools: `ingest_sms_export`, `ingest_facebook_html`, `verify_file_hash`, `get_provenance_chain`
- API: `/api/v1/ingest/sms`, `/api/v1/ingest/facebook`, `/api/v1/verify/:hash`
- Portal: Upload widget with drag-drop, format detection, hash display, dedupe warnings

**Estimated effort:** 5-6 days  
**Dependencies:** Phase 2  
**Research needed:** Streaming XML/HTML parsing for large exports

---

## Phase 4: Pass 1 Enrichment — "Blind Classification"

**Goal:** Every ingested message gets immediate context-only analysis (sentiment, intent, entities) locked with immutable hash.

**Requirements:** NLP-01, NLP-02, NLP-03, ENRICH-01

**Success Criteria:**
1. After DuckDB ingestion, messages flow through Pass 1 enrichment using only 24-hour context window
2. Multi-Pass Classifier runs: sentiment (pos/neg/anxious/neutral), intent (inquiry/conflict/financial/planning/social)
3. Entity extraction: Duckling + spaCy for dates, amounts, addresses, relative times
4. Real embeddings: 768-dim from Ollama nomic-embed-text (zero `Array(768).fill(0)` remaining)
5. Pass 1 state locked: Initial classification stored with immutable SHA-256 reference to original message
6. Pattern Analyzer tags messages matching 303 behavioral patterns with confidence scores and MCL 722.23 mappings
7. All Pass 1 outputs written to: DuckDB (structured), Neo4j temporal_memory (entities as temporal nodes), LanceDB (embeddings)

**Bidirectional capabilities:**
- MCP tools: `classify_message_pass1`, `extract_entities`, `analyze_sentiment`, `detect_patterns`
- API: `/api/v1/enrich/pass1`, `/api/v1/patterns/detect`
- Portal: Message browser shows Pass 1 tags (sentiment badges, pattern highlights), entity sidebar

**Estimated effort:** 5-6 days  
**Dependencies:** Phase 3  
**Research needed:** Compromise NER plugin API, Duckling integration

---

## Phase 5: Pattern Detection UX — "See, Review, Search"

**Goal:** User can view pattern detections, approve low-confidence matches, search by meaning across all storage tiers.

**Requirements:** NLP-04, NLP-05, UI-01, UI-02, UI-03

**Success Criteria:**
1. Pattern Library page shows all 303 patterns with categories, descriptions, MCL 722.23 factor mappings
2. Message browser displays detected patterns per message with confidence scores and factor mappings
3. Low-confidence detections appear in HITL approval queue (approve/reject/reclassify)
4. Semantic search: Natural language query ("threats about custody") returns messages ranked by LanceDB vector similarity
5. Filter by pattern type (gaslighting, DARVO, etc.) in message browser
6. Cross-tier search: Query can span DuckDB (structured), LanceDB (vectors), Neo4j (relationships)

**Bidirectional capabilities:**
- MCP tools: `search_semantic`, `filter_by_pattern`, `get_hitl_queue`, `approve_detection`, `reject_detection`
- API: `/api/v1/search`, `/api/v1/patterns`, `/api/v1/hitl/queue`, `/api/v1/hitl/approve`
- Portal: Full Pattern Library UI, message browser with filters, HITL approval panel, semantic search bar

**Estimated effort:** 5-6 days  
**Dependencies:** Phase 4  
**Research needed:** Cross-tier query optimization

---

## Phase 6: Multi-Source & Document Intelligence — "Docling + Scale"

**Goal:** Facebook data, PDFs, Office docs processed with layout preservation; Docling handles document intelligence.

**Requirements:** PARSE-02, PIPE-06, DOC-01, UI-04

**Success Criteria:**
1. Facebook HTML export parser ported and tested: upload → DuckDB → messages in browser alongside SMS
2. Docling integrated: PDF/DOCX/PPTX/XLSX parsing with layout understanding, table extraction (97.9% accuracy)
3. Docling MCP server available for ad-hoc document parsing
4. Large exports (10K+ messages, multi-GB PDFs) stream through without OOM errors
5. Cross-platform timeline: SMS, Facebook, document mentions unified in chronological order
6. Filter timeline by source platform to compare patterns across communication channels
7. Screenshot/image OCR: Vision-language models (GPT-4o-mini, Gemini) extract text + generate captions

**Bidirectional capabilities:**
- MCP tools: `ingest_facebook_export`, `parse_with_docling`, `extract_image_text`, `build_cross_platform_timeline`
- API: `/api/v1/ingest/facebook`, `/api/v1/parse/docling`, `/api/v1/timeline`
- Portal: Upload for Facebook HTML, PDF/Office doc viewer with Docling structure display, timeline visualization

**Estimated effort:** 6-7 days  
**Dependencies:** Phase 3 (for parser patterns), Phase 5 (for UX)  
**Research needed:** Docling MCP server setup, Facebook export format changes

---

## Phase 7: Pass 2 Enrichment — "Hindsight Synthesis"

**Goal:** Longitudinal analysis detects patterns invisible at ingestion time — contradictions, community structures, behavioral shifts.

**Requirements:** ENRICH-08, ENRICH-09, ENRICH-10, ENRICH-11, ENRICH-12, ENRICH-13, ENRICH-14

**Success Criteria:**
1. Bitemporal timestamps: Every message has `event_time` (when sent) and `ingested_at` (when processed)
2. Pass 2 triggered: User can flag case for hindsight synthesis (or auto-triggered after N messages)
3. Community detection: Microsoft GraphRAG identifies life phases, behavioral shifts, recurring themes across months/years
4. Contradiction detection: Graphiti identifies conflicts (e.g., "at home" claim + GPS location differ) → creates CONTRADICTS edge
5. Neo4j updated: Pass 2 annotations link to original Pass 1 nodes without modifying locked initial state
6. Pattern evolution: Query shows how relationship patterns changed over time (e.g., "What changed in 2019?")
7. Gaslighting evidence: Contradictions between Pass 1 (what was said at the time) and Pass 2 (what actually happened) are queryable

**Bidirectional capabilities:**
- MCP tools: `run_pass2_synthesis`, `detect_communities`, `find_contradictions`, `query_pattern_evolution`
- API: `/api/v1/enrich/pass2`, `/api/v1/contradictions`, `/api/v1/communities`
- Portal: Hindsight synthesis trigger, contradiction report viewer, community/timeline visualization

**Estimated effort:** 7-10 days  
**Dependencies:** Phase 4 (Pass 1 must exist to contrast with), Phase 6 (multi-source for complete picture)  
**Research needed:** GraphRAG community detection, Graphiti contradiction API

---

## Phase 8: Agent & Query Layer — "Intelligent Interface"

**Goal:** Purpose-built frameworks replace hand-rolled code — Agno for agents, CopilotKit for HITL, Semantica for semantic intelligence.

**Requirements:** FW-01, FW-02, FW-03, FW-04, AGENT-01

**Success Criteria:**
1. **Semantica integration:** Python service between ingestion and graph/vector stores — handles provenance, conflict detection, NER, GraphRAG
   - Replaces custom provenance code
   - W3C PROV-O alignment throughout
   - Exposed via MCP: `semantica_extract`, `semantica_validate`, `semantica_query`

2. **Agno integration:** Agent runtime with MCPTools for calling all MCP servers, PgVector integration, sessions/streaming/tracing
   - Replaces custom agent orchestration
   - AgentOS provides API, UI, tracing
   - MCP tools discoverable and callable

3. **CopilotKit integration:** React-native HITL UI with shared state, generative UI, approval gates, fact correction
   - Replaces existing HITL system
   - MCP Apps render in UI for complex workflows
   - Human-in-the-loop checkpoints for high-impact actions

4. **Langflow (optional):** Visual workflow builder for prototyping multi-step flows, exportable as MCP tools

5. **Query capabilities working:**
   - "Show me anxious messages within 1 hour of GPS conflicts"
   - "What changed in my relationship patterns in 2019?"
   - "Find screenshots from Law Office visits + related chats"
   - "Generate forensic report for Nov 14, 2019 with full provenance"

**Progressive tool exposure:**
- Core tools always exposed: `ingest_file`, `search_messages`, `get_provenance`
- Extended tools discoverable: `run_pass2_synthesis`, `detect_contradictions`, `build_community_graph`
- Agent can request tool access via `discover_tools` → gets granted access with user approval via CopilotKit

**Bidirectional capabilities:**
- MCP: Full tool registry with progressive disclosure, Agno agents calling tools, Semantica semantic layer
- API: `/api/v1/agents/query`, `/api/v1/reports/forensic`, `/api/v1/tools/discover`
- Portal: CopilotKit-powered assistant, workflow builder (Langflow), full HITL review panels

**Estimated effort:** 10-14 days  
**Dependencies:** Phase 5 (HITL to replace), Phase 7 (memory architecture for Semantica)  
**Research needed:** All framework APIs (Semantica, Agno, CopilotKit, Langflow)

---

## Coverage Matrix

| REQ-ID | Description | Phase |
|--------|-------------|-------|
| FOUND-01 | Fix TypeScript errors | 1 |
| FOUND-02 | Database connectivity verification | 1 |
| FOUND-03 | Python bridge unified | 1 |
| STOR-01 | DuckDB initialization | 1 |
| STOR-02 | LanceDB initialization | 1 |
| STOR-03 | Dual Neo4j configuration | 2 |
| STOR-04 | DuckDB-LanceDB Arrow integration | 2 |
| STOR-05 | Chain of custody (SHA-256) | 2 |
| PIPE-01 | SMS/XML upload through UI | 3 |
| PIPE-02 | TrinityRouter → DuckDB pipeline | 2-3 |
| PIPE-04 | Schema consolidation (3→1) | 3 |
| PIPE-05 | Per-tier write tracking | 2-3 |
| PIPE-06 | Large file streaming | 3, 6 |
| PARSE-01 | SMS parser E2E | 3 |
| PARSE-02 | Facebook parser | 6 |
| PARSE-03 | Pipeline consolidation | 3 |
| NLP-01 | Multi-Pass Classifier wired | 4 |
| NLP-02 | Pattern Analyzer wired | 4 |
| NLP-03 | Pattern Analyzer → Drizzle | 4 |
| NLP-04 | Pattern Library UI | 5 |
| NLP-05 | Pattern results in browser | 5 |
| ENRICH-01 | Pass 1 enrichment (blind) | 4 |
| ENRICH-08 | Bitemporal timestamps | 7 |
| ENRICH-09 | Pass 2 trigger | 7 |
| ENRICH-10 | Community detection (GraphRAG) | 7 |
| ENRICH-11 | Contradiction detection (Graphiti) | 7 |
| ENRICH-12 | Pass 2 annotations | 7 |
| ENRICH-13 | Pattern evolution | 7 |
| ENRICH-14 | Gaslighting evidence query | 7 |
| UI-01 | Message browser | 5 |
| UI-02 | HITL approval queue | 5 |
| UI-03 | Semantic search | 5 |
| UI-04 | Cross-platform timeline | 6 |
| DOC-01 | Docling document parsing | 6 |
| FW-01 | Semantica integration | 8 |
| FW-02 | Docling integration | 6 |
| FW-03 | Agno integration | 8 |
| FW-04 | CopilotKit integration | 8 |
| AGENT-01 | Progressive tool exposure | 8 |

**Coverage:** 34 requirements mapped. 0 orphans.

---

## Phase Dependency Graph

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 8
                 │                              │            ↑
                 │                              └──→ Phase 7 ─┘
                 │
                 └──→ Phase 6 ────────────────────────┘
```

**Critical path:** 1 → 2 → 3 → 4 → 5 → 8  
**Parallel tracks:**
- Phase 6 (Multi-Source) branches from 3, can run with 4-5
- Phase 7 (Pass 2) branches from 4, needs Pass 1 complete, runs with 5

**First usable milestone:** End of Phase 3 (upload SMS, see messages)  
**Production ready:** End of Phase 5 (full pattern detection + search)  
**Fully intelligent:** End of Phase 8 (agents, hindsight, semantic layer)

---

## References

- **PROJECT.md:** `.planning/PROJECT.md`
- **REQUIREMENTS.md:** `.planning/REQUIREMENTS.md`
- **Architectural Blueprint:** `docs/integrated-architecture-blueprint.md` (1264 lines — merged into this roadmap)
- **Framework Discussion:** `docs/[https___github.com_Hawksight-AI_semantica](https_.md)` (1777 lines — Semantica, Docling, Agno, CopilotKit)
- **Original Architecture:** `STORAGE_ARCHITECTURE.md`, `BACKEND_ARCHITECTURE.md`

---
*Generated: 2026-02-26 by gsd-roadmapper@opencode*  
*Architecture merged from: original roadmap + integrated-architecture-blueprint + Semantica discussion*
