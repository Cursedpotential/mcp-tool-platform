# MCP Tool Platform — Roadmap

**Generated:** 2026-02-25
**Depth:** comprehensive
**Total phases:** 8
**Total requirements:** 27
**Core value:** Raw messaging exports → searchable, pattern-tagged, forensically-hashed evidence with a temporal knowledge graph.

---

## Phase 1: Foundation — "Make It Compile and Connect"

**Goal:** App compiles clean and all infrastructure services are verified at startup.

**Requirements:** FOUND-01, FOUND-02, FOUND-03

**Success Criteria:**
1. `tsc --noEmit` exits 0 with zero TypeScript errors
2. App starts and reports connection status for all 5 database tiers (PostgreSQL, Neo4j, ChromaDB, MySQL, Directus) with clear pass/fail per tier
3. Python bridge starts and confirms spaCy + sentence-transformers are loaded — does NOT silently fall back to JS toy implementations
4. Single unified Python bridge handles both NLP and Graphiti calls (no dual spawn logic in python-bridge.ts vs graphiti-client.ts)

**Estimated effort:** 2-3 days
**Dependencies:** None — this is the starting gate
**Research needed:** No — standard patterns (TS error fixing, health checks, process management)

---

## Phase 2: Pipeline Core — "One Canonical Ingestion Pipeline"

**Goal:** A single, unified ingestion pipeline that writes to all database tiers with per-tier success/failure tracking.

**Requirements:** PIPE-02, PIPE-04, PIPE-05, PARSE-03

**Success Criteria:**
1. Only one pipeline implementation exists (ingestion router) — production-pipeline.ts and end-to-end-pipeline.ts merged or deleted
2. Zero Supabase references remain in active pipeline code — TrinityRouter routes all writes to correct tiers
3. One canonical message schema flows from parser → NLP → storage (three competing definitions consolidated)
4. After ingestion, PostgreSQL `write_status` column shows per-tier success/failure for every processed message
5. Pipeline writes to PostgreSQL and available tiers (Neo4j, ChromaDB) without silent data loss

**Estimated effort:** 3-4 days
**Dependencies:** Phase 1 (app must compile, databases must connect)
**Research needed:** No — codebase consolidation work, not new technology

---

## Phase 3: First Vertical Slice — "Upload SMS, See Messages"

**Goal:** Matt can upload an XML SMS export through the browser and browse parsed messages immediately.

**Requirements:** PIPE-01, PARSE-01, UI-01

**Success Criteria:**
1. User can select an XML SMS export file in the browser and click "Upload" to trigger ingestion
2. After upload, user sees parsed messages in a list view showing sender, timestamp, and content
3. User can search messages by keyword and filter by date range and sender
4. Messages display in conversation threads grouped by contact
5. A 500-message SMS export is fully parsed and browsable within 60 seconds

**Estimated effort:** 4-5 days
**Dependencies:** Phase 2 (pipeline must write to databases correctly)
**Research needed:** No — wiring existing components (upload UI → tRPC → ingestion router → message browser)

---

## Phase 4: NLP & Pattern Analysis — "Messages Get Analyzed"

**Goal:** Every ingested message gets automated NLP tagging and behavioral pattern detection with real embeddings.

**Requirements:** NLP-01, NLP-02, NLP-03, PIPE-03

**Success Criteria:**
1. After ingestion, each message has sentiment score, extracted entities, and topic classification from Multi-Pass Classifier
2. Pattern Analyzer runs after NLP and tags messages matching any of the 303 behavioral patterns with confidence scores and MCL 722.23 factor mappings
3. Pattern Analyzer reads/writes from PostgreSQL via Drizzle ORM — no SQL.js in-memory database
4. Messages have real 768-dim embeddings from Ollama nomic-embed-text — zero instances of `Array(384).fill(0)` or `Array(768).fill(0)` remain
5. Re-ingesting the SMS test export shows NLP tags and pattern detections alongside message content

**Estimated effort:** 4-5 days
**Dependencies:** Phase 3 (need a working upload → parse → browse flow to add analysis into)
**Research needed:** Maybe — SQL.js → Drizzle migration edge cases, compromise NER plugin API (Context7 lookup recommended)

---

## Phase 5: Pattern Detection UX — "See, Review, and Search Evidence"

**Goal:** User can view pattern detections, approve low-confidence matches, and search evidence by meaning.

**Requirements:** NLP-04, NLP-05, UI-02, UI-03

**Success Criteria:**
1. Pattern Library page shows all 303 behavioral patterns with categories, descriptions, and MCL 722.23 factor mappings (all 21 commented-out tRPC calls connected)
2. Message browser shows detected patterns per message with confidence scores and which best-interest factor they map to
3. Low-confidence pattern detections appear in HITL approval queue where user can approve, reject, or reclassify
4. User can type a natural language query (e.g., "threats about custody") and get relevant messages ranked by semantic similarity via pgvector
5. User can filter the message browser by detected pattern type (e.g., show only gaslighting, show only DARVO)

**Estimated effort:** 4-5 days
**Dependencies:** Phase 4 (messages must have pattern tags and embeddings to display/search)
**Research needed:** No — mostly UI wiring (21 TODOs, existing HITL backend, existing pgvector infrastructure)

---

## Phase 6: Multi-Source & Scale — "Process All Message Sources"

**Goal:** Facebook data loaded alongside SMS, large exports handled without crashes, unified cross-platform timeline.

**Requirements:** PARSE-02, PIPE-06, UI-04

**Success Criteria:**
1. User can upload a Facebook HTML data export and see parsed messages in the same browser alongside SMS messages
2. Exports with 10,000+ messages process without out-of-memory errors (stream parsing replaces JSON.parse/readFileSync)
3. Cross-platform timeline shows messages from all sources in unified chronological order
4. User can filter timeline by platform (SMS, Facebook) to compare communication patterns across sources

**Estimated effort:** 5-7 days
**Dependencies:** Phase 3 (working pipeline and message browser to add new parsers into)
**Research needed:** Yes — Facebook export format may have changed; stream-json API needs Context7 lookup; potential BullMQ FlowProducer patterns for async processing

---

## Phase 7: Memory Architecture — "Build the Evidence Brain"

**Goal:** Evidence stored with forensic temporal precision across memory tiers, with selective knowledge graph enrichment for high-value conversations.

**Requirements:** MEM-01, MEM-02

**Success Criteria:**
1. Every message has bitemporal timestamps: `event_time` (when sent) and `ingested_at` (when platform processed it)
2. PostgreSQL schema supports memory tiers: episodic (raw events), semantic (entities/relationships), vector (embeddings), community (clusters), human annotations
3. User can flag a conversation for Graphiti enrichment, which builds relationship entities using budget-capped or Ollama-powered LLM calls
4. Bulk entity population uses direct Cypher queries — Graphiti reserved for selective high-value analysis only

**Estimated effort:** 7-10 days
**Dependencies:** Phase 4 (real embeddings flowing through pipeline; NLP entities available for knowledge graph)
**Research needed:** Yes — 6-tier memory schema design, Graphiti 0.28.x API (updated from 0.26.3), must read Perplexity conversation file at `C:\Users\matts\Projects\TheBigOne\[https___github.com_Hawksight-AI_semantica](https_.md`

---

## Phase 8: Framework Integration — "Replace Hand-Rolled with Purpose-Built"

**Goal:** Purpose-built frameworks replace custom code for semantic intelligence, document parsing, agent orchestration, and human-in-the-loop UI.

**Requirements:** FW-01, FW-02, FW-03, FW-04

**Success Criteria:**
1. Semantica handles provenance tracking and conflict detection between ingestion and graph/vector stores (replaces custom provenance code)
2. Docling parses PDF/DOCX/PPTX/XLSX with layout understanding and table extraction via its MCP server (replaces custom PDF parsing)
3. Agno orchestrates agent tasks with MCPTools for calling MCP servers, PgVector integration, sessions/streaming/tracing (replaces custom agent orchestration)
4. CopilotKit provides React-native HITL UI with shared state, approval gates, and fact correction loops (replaces existing HITL system)

**Estimated effort:** 10-14 days (highly variable — depends on framework maturity and API stability)
**Dependencies:** Phase 5 (existing HITL/agent systems must be working before replacement), Phase 7 (memory architecture must be stable for framework integration)
**Research needed:** Yes — all 4 frameworks need deep research via Context7 + Perplexity conversation file. Semantica, Docling, Agno, CopilotKit current docs, API stability, integration patterns.

---

## Coverage Matrix

| REQ-ID | Description | Phase |
|--------|-------------|-------|
| FOUND-01 | Fix ~80 TypeScript errors | Phase 1 |
| FOUND-02 | Database connectivity verified at startup | Phase 1 |
| FOUND-03 | Python bridge unified | Phase 1 |
| PIPE-01 | Upload messaging export through UI | Phase 3 |
| PIPE-02 | TrinityRouter wired into pipeline | Phase 2 |
| PIPE-03 | Real embeddings via Ollama | Phase 4 |
| PIPE-04 | Schema reconciliation (3 → 1) | Phase 2 |
| PIPE-05 | Multi-database write tracking | Phase 2 |
| PIPE-06 | Large file stream parsing | Phase 6 |
| PARSE-01 | SMS/XML parser tested E2E | Phase 3 |
| PARSE-02 | Facebook HTML parser ported and tested | Phase 6 |
| PARSE-03 | Duplicate pipeline files consolidated | Phase 2 |
| NLP-01 | Multi-Pass Classifier wired into pipeline | Phase 4 |
| NLP-02 | Pattern Analyzer wired as pipeline stage | Phase 4 |
| NLP-03 | Pattern Analyzer migrated to Drizzle ORM | Phase 4 |
| NLP-04 | Pattern Library UI wired (21 TODOs) | Phase 5 |
| NLP-05 | Pattern results visible in message browser | Phase 5 |
| UI-01 | Message results browser | Phase 3 |
| UI-02 | HITL approval queue wired | Phase 5 |
| UI-03 | Semantic search (pgvector) | Phase 5 |
| UI-04 | Cross-platform timeline | Phase 6 |
| MEM-01 | Memory architecture with bitemporal PG spine | Phase 7 |
| MEM-02 | Graphiti selective enrichment | Phase 7 |
| FW-01 | Semantica integration | Phase 8 |
| FW-02 | Docling integration | Phase 8 |
| FW-03 | Agno integration | Phase 8 |
| FW-04 | CopilotKit integration | Phase 8 |

**Coverage: 27/27 requirements mapped. 0 orphans. 0 duplicates.**

---

## Phase Dependency Graph

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5 ──→ Phase 8
                             │            │                      ↑
                             │            └──→ Phase 7 ──────────┘
                             │
                             └──→ Phase 6
```

**Key observations:**
- **Linear critical path:** 1 → 2 → 3 → 4 → 5 → 8
- **Phase 6 (Multi-Source) branches from Phase 3** — can run in parallel with Phases 4-5 since adding parsers is independent of NLP wiring
- **Phase 7 (Memory Architecture) branches from Phase 4** — can run in parallel with Phase 5 since memory tiers are independent of pattern UX
- **Phase 8 converges** — needs both Phase 5 (systems to replace) and Phase 7 (architecture to integrate with)
- **Matt can use the platform productively after Phase 3.** Each subsequent phase adds intelligence without breaking what works.

---

## References

- **PROJECT.md:** `.planning/PROJECT.md`
- **REQUIREMENTS.md:** `.planning/REQUIREMENTS.md`
- **Research Summary:** `.planning/research/SUMMARY.md`
- **Architectural Evolution:** `C:\Users\matts\Projects\TheBigOne\[https___github.com_Hawksight-AI_semantica](https_.md)` (1777 lines — must read for Phases 7-8)

---
*Generated: 2026-02-25 by gsd-roadmapper@opencode*
