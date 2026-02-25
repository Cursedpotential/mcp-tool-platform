# Project Research Summary

**Project:** MCP Tool Platform
**Domain:** Forensic evidence preprocessing / Legal case management
**Researched:** 2026-02-25
**Confidence:** HIGH (all 4 research files grounded in direct codebase analysis + Context7-verified library docs)

---

## Executive Summary

The MCP Tool Platform is a ~75-80% built forensic evidence preprocessing system that ingests messaging data (Facebook, SMS, Snapchat), runs NLP and behavioral pattern detection (303 patterns mapped to Michigan custody best-interest factors), and stores results across a multi-database architecture (PostgreSQL/pgvector, Neo4j/Graphiti, ChromaDB, Directus). The core problem is not missing features — it's that existing components aren't wired together. The platform has 22+ tRPC routers the UI never calls, a Pattern Library with 21 TODO comments, mock embeddings (`Array(384).fill(0)`) where real ones should be, a Python bridge that silently degrades to toy JS fallbacks, and three competing pipeline implementations with different database clients. The ~80 TypeScript compilation errors from a branch merge block all development.

The recommended approach is staged: fix the build, verify database connectivity, then wire ONE format (XML SMS) end-to-end before touching anything else. The existing stack is solid — TypeScript/Node 22, tRPC, Drizzle ORM, React 19 — and only needs one new package (BullMQ for job queues). The research also identified a significant architectural evolution planned via a detailed Perplexity/Gemini conversation (see reference below) that introduces PG/pgvector as a 6-tier memory spine, Semantica for semantic intelligence, Docling for document parsing, Agno for agent orchestration, CopilotKit for HITL UI, and Langflow as a workflow design studio. These additions should be phased in progressively after the core messaging pipeline works — they are force multipliers, not prerequisites.

The critical risks are: (1) the Python bridge silently falling back to garbage JS NLP without any indication, (2) multi-database writes with no tracking of which tiers succeeded, and (3) the "80% built" integration trap where wiring existing components takes 3x longer than building new ones. All three must be addressed in the first two phases.

**Architectural evolution reference:** `C:\Users\matts\Projects\TheBigOne\[https___github.com_Hawksight-AI_semantica](https_.md` (1777 lines) — downstream agents (roadmapper, phase planners) MUST read this file when working on Phases 4-6. Do NOT attempt to inline its contents.

---

## Key Findings

### Recommended Stack

The existing stack is locked and sufficient. Only one new install is required.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Job Queue** | BullMQ `^5.70.1` (NEW) | Replaces 490-line custom Redis queue. FlowProducer handles parse→NLP→pattern→store dependencies. Built on already-installed ioredis. |
| **Knowledge Graph** | graphiti-core `0.28.x` (UPDATE) | Only KG library with native temporal awareness. Pin to `>=0.28.0,<0.29.0`. Requires LLM — budget for API costs or use Ollama. |
| **NLP (TypeScript)** | compromise + natural (EXISTING) | Entity extraction, sentiment, POS tagging. No Python needed for first-pass analysis. |
| **NLP (Python)** | spaCy + sentence-transformers (EXISTING) | Deep NER, embeddings. NOT installed locally — deployment dependency. Pin spaCy to `>=3.8.0,<3.9.0`. |
| **Embeddings** | Ollama nomic-embed-text 768-dim (EXISTING) | Free, local, already in docker-compose. Drizzle has native `vector()` column + HNSW index. |
| **Hashing** | Node.js crypto SHA-256 (EXISTING) | chain-custody.ts (316 lines) already implements full forensic chain. No new library needed. |
| **Schema Validation** | Zod 4.x (EXISTING) | Already used extensively with tRPC. Define per-platform message schemas. |

**Do NOT use:** faiss-node (pgvector does it), neo4j-driver v6 (breaking changes), fast-xml-parser v6 (breaking changes), mem0 for evidence storage, LlamaIndex for KG (Graphiti is purpose-built), any new database systems.

### Expected Features

**Must work for the platform to be usable (Table Stakes):**

| Priority | Feature | Gap |
|----------|---------|-----|
| P0 | Fix ~80 TypeScript errors | Branch merge artifacts blocking all development |
| P0 | Database connections verified | Silent data loss if services unreachable |
| P1 | File upload → ingestion pipeline | No upload UI exists. Ingestion router untested E2E |
| P1 | Facebook + SMS parser execution | Parsers exist but untested with real data at scale |
| P1 | Message results browser | No browser page exists — biggest visible gap |
| P1 | Pattern Library UI wired | 21 TODOs = commented-out tRPC calls. Backend complete. |
| P2 | Pipeline progress feedback | onProgress callback exists but not wired to UI |

**What makes this platform worth building (Differentiators):**

| Priority | Feature | Status |
|----------|---------|--------|
| P2 | MCL 722.23 behavioral pattern detection | 1659-line analyzer exists. Needs integration testing + UI. |
| P2 | HITL approval workflow | Backend complete (547 lines). UI components exist. Wire only. |
| P2 | Semantic search (pgvector) | Infrastructure exists. Needs search UI + real embeddings in pipeline. |
| P2 | Snapchat parser | Schema exists with CSS selectors. No loader implementation. |
| P2 | Cross-platform timeline | Backend exists. UI agent exists. Wire together. |
| P3 | Knowledge graph visualization | Highest complexity. Needs graph rendering library. Defer. |

**Do NOT build now:** Case Bible/Obsidian integration, automated court docs, multi-model LLM for bulk analysis, CI/CD, voice/video, 3D graph rendering, multi-user collaboration, TraceIQ integration.

### Architecture Approach

**Current architecture is sound but unwired.** Five layers: Presentation (React) → tRPC API (22+ routers) → Processing (parsers, NLP, pattern detection) → Queue (Redis, not wired) → Storage (TrinityRouter across 5 tiers).

**Key patterns to preserve:**
1. **Graceful degradation** — TrinityRouter wraps each storage tier in try/catch. If Neo4j goes down, PostgreSQL still works.
2. **TypeScript-first, Python-fallback** — Use compromise/natural for fast NLP, reserve Python for deep analysis.
3. **Forensic hashing at every stage** — SHA-256 chain of custody is already built.
4. **PostgreSQL as source of truth** — Neo4j is a derived relationship view, rebuildable from PG.

**Anti-patterns to fix:**
1. Stale Supabase references in production-pipeline.ts (dead code, will crash)
2. Mock embeddings `Array(384).fill(0)` polluting vector stores
3. Synchronous pipeline processing (blocks UI on large imports)
4. SQL.js in pattern analyzer (PostgreSQL is already available)
5. Three competing pipeline implementations (consolidate to ingestion router)
6. Schema mismatch between drizzle/schema.ts, production-message-schemas, and production-pipeline.ts Supabase tables

**Architectural evolution (Perplexity conversation — reference file for details):**
- PG/pgvector becomes 6-tier memory spine (short-term sessions, episodic raw_events, semantic entities, vector embeddings, community clusters, human annotations)
- Bitemporal timestamps (event_time + ingested_at) — critical for forensic temporal analysis
- Semantica (Hawksight-AI) replaces hand-rolled graph/provenance/conflict detection
- Docling (IBM/LF AI) replaces custom PDF/office parsing
- Agno as primary agent runtime/AgentOS
- CopilotKit for human-in-the-loop UI
- Langflow as visual workflow design studio (NOT a gateway replacement)
- OWL (CAMEL-AI) optional for specialist multi-agent tasks

### Critical Pitfalls

**Top 5 pitfalls with prevention strategies:**

| # | Pitfall | Severity | Prevention | Phase |
|---|---------|----------|------------|-------|
| 1 | **Python bridge silently degrades to JS fallbacks** — you think you have real NLP but you have 17-word sentiment lists and bag-of-words hashes. All downstream analysis is compromised. | BLOCKER | Startup health gate. Canary test before processing. Tag every result with `method: "spacy" | "js_fallback"`. Reject storing fallback results in evidence DBs. | Phase 0 |
| 2 | **Multi-DB write inconsistency** — PostgreSQL says "processed" but ChromaDB has no embeddings and Neo4j has no entities. No reconciliation mechanism exists. | BLOCKER | Add `write_status` JSON column to PG tracking per-tier success. Background retry for failed tiers. Reconciliation check after each batch. | Phase 1 |
| 3 | **"80% built" wiring trap** — fixing one TS error creates 2 new ones. Components built by different agents with different data shape assumptions. 22+ routers never called from UI. | BLOCKER | Fix ALL TS errors first. Then ONE vertical slice E2E. 2-hour timebox per integration task. | Phase 0-1 |
| 4 | **Graphiti LLM cost explosion** — add_episode() fires LLM calls per episode. 10K messages = $100+ and days of processing. add_episode_bulk() skips edge invalidation (defeats purpose). | HIGH | Use direct Cypher for bulk loading. Reserve Graphiti for high-value flagged conversations only. Configure local LLM via Ollama. | Phase 4+ |
| 5 | **Hardcoded GCP API keys in 5 files** — blocks deployment, security risk if repo is ever shared | HIGH | Move to `.env`. 30-minute task. Rotate keys after cleanup. | Phase 0 |

---

## Implications for Roadmap

### Suggested Phase Structure

**6 phases. Ship working features over polished features. Each phase delivers something Matt can use.**

---

#### Phase 0: Foundation — "Make It Compile"
**Rationale:** Nothing works until the app builds. Security debt must be cleared before deployment. Python bridge health gate prevents garbage data from day one.

**Delivers:** A compiling application with verified infrastructure.

**Work:**
- Fix ~80 TypeScript compilation errors (`tsc --noEmit` exits 0)
- Move 5 hardcoded GCP API keys to `.env`
- Python bridge startup health gate (verify spaCy + sentence-transformers load)
- Unify two Python bridges (python-bridge.ts + graphiti-client.ts separate spawn logic)
- Fix `process.cwd()` → `import.meta.url` in python-bridge.ts
- Database connection health checks at startup (all 5 tiers)
- Auth bypass mode (`AUTH_MODE=bypass`) for Tailscale-protected deployment

**Pitfalls to avoid:** P1 (Python silent failure), P3 (wiring cascade), P7 (hardcoded keys), P11 (cwd path)

**Features addressed:** T1 (build fix), T6 (DB connections)

**Estimated effort:** 2-3 days

---

#### Phase 1: First Vertical Slice — "Upload SMS, See Messages"
**Rationale:** Get ONE format flowing end-to-end before adding complexity. Users can start loading evidence immediately. Messages browsable after parse, even before NLP completes.

**Delivers:** Matt can upload XML SMS exports and see parsed messages in a browser UI.

**Work:**
- File upload component → tRPC mutation → ingestion router
- Wire TrinityRouter into ingestion pipeline (replace Supabase refs)
- Replace mock embeddings with real-embedding-service.ts / Ollama calls
- Schema reconciliation (consolidate 3 schema approaches to production-message-schemas)
- Add `write_status` JSON column for multi-DB write tracking
- Build message results browser page (list + search + filter + conversation threading)
- Neo4j driver pool configuration (maxConnectionPoolSize: 25, etc.)
- ChromaDB cleanup scheduler (setInterval every 6 hours)
- Fix `getEvidenceStats()` to use pagination (currently fetches ALL docs → OOM)
- ONE integration test: "upload small SMS export → verify in PostgreSQL"
- Smoke tests for each database connection

**Pitfalls to avoid:** P2 (multi-DB inconsistency), P5 (ChromaDB no cleanup), P6 (Neo4j session leak), P8 (large JSON OOM), P9 (OAuth lock-in)

**Features addressed:** T2 (upload→ingestion), T3 (SMS parser), T5 (results browser), T6 (verified connections)

**Estimated effort:** 5-7 days

---

#### Phase 2: NLP + Pattern Detection — "See What the Messages Mean"
**Rationale:** Analysis is the value proposition. Pattern detection is what makes this platform better than manually reading messages. Backend is mostly built — this phase is primarily wiring.

**Delivers:** Messages enriched with sentiment, entities, behavioral pattern tags mapped to MCL 722.23 factors. HITL review for low-confidence detections.

**Work:**
- Wire Multi-Pass Classifier into pipeline (after parse, before store)
- Migrate Pattern Analyzer from SQL.js to Drizzle ORM (PostgreSQL)
- Wire Pattern Analyzer as pipeline stage (after NLP)
- Pattern Library UI wiring (21 TODOs → uncomment tRPC calls + connect)
- Show pattern tags and confidence scores in message results browser
- Pipeline progress feedback (wire onProgress → SSE/WebSocket → frontend)
- HITL approval queue wiring (backend + components exist, connect them)
- Semantic search UI component (pgvector queries already possible)

**Pitfalls to avoid:** P4 (Graphiti cost — don't use Graphiti here, use rule-based patterns)

**Features addressed:** T4 (Pattern Library), T7 (progress feedback), D1 (MCL patterns), D3 (HITL), D4 (semantic search)

**Estimated effort:** 5-7 days

---

#### Phase 3: Additional Parsers + Scale — "Process All Message Sources"
**Rationale:** Facebook and Snapchat are critical data sources beyond SMS. BullMQ replaces the fragile custom queue for large exports. Python bridge optimization enables batch processing without timeout.

**Delivers:** Facebook HTML, Snapchat parsing. Large exports (10K+ messages) process without blocking UI.

**Work:**
- Port Facebook HTML parser from production-pipeline.ts to ingestion router pattern
- Build Snapchat parser (schema with CSS selectors exists, need loader)
- Install BullMQ, wire FlowProducer for staged pipeline (parse→NLP→patterns→embed→store)
- Python bridge persistent process pool (stdin/stdout JSON-RPC, 3-5 workers)
- Batch NLP calls (50 messages per dispatch)
- Processing status tracking with per-stage UI indicator
- Stream-parse large JSON files (replace JSON.parse(readFileSync) with stream-json)
- Consolidate duplicate pipeline files (production-pipeline.ts, end-to-end-pipeline.ts → ingestion router)
- Cross-platform timeline generation (wire existing backend + UI agent)

**Pitfalls to avoid:** P8 (large JSON OOM), P10 (spawn overhead)

**Features addressed:** D6 (Snapchat), D7 (timeline), T3 (Facebook parser)

**Estimated effort:** 7-10 days

---

#### Phase 4: Memory Architecture + Knowledge Graph — "Build the Evidence Brain"
**Rationale:** The PG/pgvector memory spine redesign is foundational for everything that follows. Knowledge graph visualization is the highest-value differentiator but has the highest complexity. By this phase, the core pipeline is proven reliable.

**Delivers:** 6-tier memory architecture. Knowledge graph visualization. Forensic chain-of-custody audit UI.

**Work:**
- PostgreSQL schema evolution: bitemporal timestamps (event_time + ingested_at)
- Implement memory tiers in PG: episodic (raw_events), semantic (entities/relationships), vector (embeddings), community (clusters), human annotations
- Directus configuration as bulk storage/admin portal over PG
- Neo4j/Graphiti selective enrichment (flagged conversations only, not bulk)
- Direct Cypher bulk loading for initial entity population
- Knowledge graph 2D visualization (react-force-graph-2d or vis-network — NOT 3D)
- Temporal filtering in graph view (show relationships as they existed at a point in time)
- Chain-of-custody audit trail UI (display hash provenance for any document)
- Configure Graphiti with Ollama (free) or budget-capped OpenAI

**Pitfalls to avoid:** P4 (Graphiti LLM cost — use direct Cypher for bulk, Graphiti for selective)

**Features addressed:** D2 (KG visualization), D5 (chain of custody UI)

**Reference:** See Perplexity conversation file for full memory tier architecture details.

**Estimated effort:** 10-14 days

---

#### Phase 5: Framework Integration — "Level Up the Platform"
**Rationale:** These are force multipliers that replace hand-rolled systems with purpose-built frameworks. They should only be integrated after the core pipeline is stable and producing reliable results.

**Delivers:** Semantic intelligence layer, advanced document parsing, visual workflow design, agent orchestration, improved HITL UI.

**Work:**
- **Semantica (Hawksight-AI):** Semantic intelligence layer between ingestion and graph/vector stores. Replaces hand-rolled provenance and conflict detection.
- **Docling (IBM/LF AI):** Document intelligence for PDF/office parsing. Has MCP server. Replaces custom PDF parsing.
- **Agno:** Agent runtime/AgentOS. Replaces custom agent orchestration. Python-based.
- **CopilotKit:** React-native copilot for human-in-the-loop UI. Replaces existing HITL components.
- **Langflow:** Visual workflow builder as "design studio and incubator" for pipeline experimentation.
- **OWL (CAMEL-AI):** Optional specialist multi-agent automation, invoked via MCP when needed.

**Reference:** See Perplexity conversation file for ALL implementation details. Do NOT design these integrations without reading that file first.

**Estimated effort:** 14-21 days (highly variable — depends on framework maturity and API stability)

---

### Phase Ordering Rationale

```
Phase 0 (Foundation) ──→ Phase 1 (Vertical Slice) ──→ Phase 2 (NLP + Patterns)
                                                              │
                                                              ├──→ Phase 3 (Parsers + Scale)
                                                              │         │
                                                              │         ├──→ Phase 4 (Memory + KG)
                                                              │         │         │
                                                              │         │         └──→ Phase 5 (Frameworks)
                                                              │         │
                                                              │         └── (can partially overlap Phase 4)
```

**Why this order:**
1. **Phase 0 before everything** — can't test what doesn't compile
2. **Phase 1 before Phase 2** — analysis is useless without a working data pipeline
3. **Phase 2 before Phase 3** — prove patterns work on one format before adding more formats
4. **Phase 3 before Phase 4** — memory architecture benefits from having diverse data flowing through it
5. **Phase 4 before Phase 5** — framework integration should work with the production memory architecture, not the prototype one
6. **Phases 3-4 can partially overlap** — additional parsers are independent of memory architecture work

**Matt can start using the platform productively after Phase 1.** Each subsequent phase adds capabilities without breaking what works.

### Research Flags

| Phase | Needs `/gsd-research-phase`? | Why |
|-------|------------------------------|-----|
| Phase 0 | **NO** — Standard patterns | TypeScript error fixing, env var migration, health checks. Well-documented. |
| Phase 1 | **NO** — Wiring existing code | Components exist. Schema reconciliation is codebase work, not research. |
| Phase 2 | **MAYBE** — Pattern analyzer migration | SQL.js → Drizzle migration may have edge cases. Compromise plugin API should be verified via Context7. |
| Phase 3 | **YES** — BullMQ FlowProducer patterns | FlowProducer parent-child dependency patterns need research. Facebook export format may have changed. Stream-json API needs Context7 lookup. |
| Phase 4 | **YES** — Memory architecture + Graphiti selective usage | 6-tier memory schema design needs research. Graphiti 0.28.x API changes from 0.26.3. react-force-graph-2d vs vis-network comparison. Must read Perplexity conversation file. |
| Phase 5 | **YES** — All new frameworks | Semantica, Docling, Agno, CopilotKit, Langflow all need deep research. Current docs, API stability, integration patterns. Must read Perplexity conversation file. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | **HIGH** | All versions verified via npm/PyPI/Context7. Only 1 new install (BullMQ). Compatibility matrix fully verified. |
| **Features** | **HIGH** | Grounded in direct codebase inspection. Feature gaps identified by reading actual source files, not guessing. Priority matrix reflects real dependencies. |
| **Architecture** | **HIGH** | Based on analysis of 15+ source files. Data flow diagrams match actual code. Anti-patterns verified by reading the offending lines. |
| **Pitfalls** | **HIGH** | All pitfalls verified against Context7 (Neo4j driver, ChromaDB, Graphiti) and Node.js official docs. Codebase-specific issues (Python bridge, mock embeddings) verified by reading source. |
| **Phase ordering** | **MEDIUM-HIGH** | Logical based on dependencies, but effort estimates are rough. Wiring tasks are notoriously hard to estimate for a solo non-programmer. |
| **Framework integration (Phase 5)** | **MEDIUM** | Referenced in Perplexity conversation but not independently verified. API stability of newer frameworks (Semantica, Agno) is uncertain. |

### Gaps to Address During Planning

1. **Facebook export format verification** — Facebook changes export format periodically. Need to test with Matt's actual Facebook data download before Phase 3 parser work.
2. **VPS resource constraints** — No research on whether Salem Trinity VPS instances have enough RAM/CPU for concurrent PostgreSQL + Neo4j + ChromaDB + Ollama + Python NLP. Could be a deployment blocker.
3. **LLM cost modeling for Graphiti** — Need to calculate: (number of high-value conversations) × (cost per LLM call) = total budget. Depends on which provider and whether Ollama is viable for entity extraction quality.
4. **Drizzle schema migration path** — Three schema approaches exist. The reconciliation strategy (which tables survive, which get renamed) needs careful planning before Phase 1 implementation.
5. **Semantica / Docling / Agno maturity** — These are referenced in the Perplexity conversation but haven't been independently verified for production readiness. Phase 5 planning must include feasibility assessment.

---

## Sources

### From STACK.md
- Context7: graphiti-core (help_getzep_graphiti), Drizzle ORM (pgvector integration), BullMQ (FlowProducer), fast-xml-parser (v5/v6 API), compromise (NER), neo4j-javascript-driver (streaming API)
- npm registry: all Node.js package versions verified 2026-02-25
- PyPI: graphiti-core 0.28.1, spaCy 3.8.11 verified
- Codebase: package.json, requirements.txt, redis-queue.ts, chain-custody.ts, graphiti_runner.py

### From FEATURES.md
- Codebase inspection: server/mcp/loaders/*, server/mcp/pipelines/*, server/mcp/forensics/*, server/api/routers/*, client/src/pages/*
- PROJECT.md: project definition with validated/active/out-of-scope features
- Pattern Library: 21 commented-out tRPC calls visible in PatternLibrary.tsx lines 50-68
- Ingestion Router: 326 lines, production-pipeline: 662 lines

### From ARCHITECTURE.md
- Direct codebase analysis of 15+ source files
- INGESTION_ARCHITECTURE.md, STORAGE_ARCHITECTURE.md, BACKEND_ARCHITECTURE.md
- PROJECT.md

### From PITFALLS.md
- Node.js child_process official docs (v25.7.0)
- Context7: neo4j-javascript-driver (benchmark 94.9), chroma-core/chroma (benchmark 79.9), graphiti (benchmark 68)
- Codebase: python-bridge.ts (626 lines), graphiti-client.ts (752 lines), chroma-client.ts (513 lines)

### Architectural Evolution
- Perplexity/Gemini conversation: `C:\Users\matts\Projects\TheBigOne\[https___github.com_Hawksight-AI_semantica](https_.md` (1777 lines)

---
*Research synthesis completed: 2026-02-25*
*Ready for roadmap: yes*
*Author: gsd-research-synthesizer@opencode*
