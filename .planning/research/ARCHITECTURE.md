# Architecture Research

**Domain:** Forensic evidence preprocessing platform (messaging focus)
**Researched:** 2026-02-25
**Confidence:** HIGH (based on direct codebase analysis of 15+ source files)

---

## System Overview

This documents the **existing** architecture of the MCP Tool Platform as built, not a proposed design. The platform is ~75-80% implemented. The primary gap is wiring — components exist but aren't connected into an end-to-end flow.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                               │
│  ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │
│  │ Evidence  │ │ Timeline  │ │ Pattern  │ │  Agent    │ │ Ingest   │  │
│  │ Browser   │ │ Viewer    │ │ Library  │ │ Dashboard │ │ Upload   │  │
│  └─────┬─────┘ └─────┬─────┘ └────┬─────┘ └─────┬─────┘ └────┬─────┘  │
│        └──────────────┴────────────┴─────────────┴────────────┘        │
├────────────────────────────────┬────────────────────────────────────────┤
│                           tRPC API LAYER (22+ routers)                 │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ ingestion  │ │ evidence   │ │ conversations│ │ analysis/agents  │  │
│  │ router     │ │ router     │ │ router       │ │ routers          │  │
│  └─────┬──────┘ └─────┬──────┘ └──────┬───────┘ └───────┬──────────┘  │
├────────┴──────────────┴───────────────┴──────────────────┴─────────────┤
│                        PROCESSING LAYER                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │  Parsers          │  │  NLP Pipeline     │  │  Forensic Analysis  │  │
│  │  - XML SMS        │  │  - Python Bridge  │  │  - Pattern Analyzer │  │
│  │  - Facebook HTML  │  │  - Multi-Pass     │  │  - Behavior Detect  │  │
│  │  - PDF iMessage   │  │    Classifier     │  │  - 303 patterns     │  │
│  │  - Google Chat    │  │  - Sentiment      │  │  - Forensic Hashing │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│           └────────────────────┼────────────────────────┘              │
├────────────────────────────────┼───────────────────────────────────────┤
│                        QUEUE LAYER (NOT YET WIRED)                     │
│  ┌────────────────────────────┴────────────────────────────────────┐   │
│  │  Redis Queue (redis-queue.ts) / InMemoryQueue fallback          │   │
│  │  - Priority-based task scheduling                               │   │
│  │  - Atomic pop with Lua scripts                                  │   │
│  │  - Retry logic + task lifecycle                                 │   │
│  │  - Task executor (workers/executor.ts, 1614 lines)             │   │
│  └────────────────────────────┬────────────────────────────────────┘   │
├────────────────────────────────┼───────────────────────────────────────┤
│                        STORAGE LAYER (TrinityRouter)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Directus │ │PostgreSQL│ │  Neo4j/  │ │ ChromaDB │ │  PGVector  │  │
│  │ (CMS)    │ │ (Drizzle)│ │ Graphiti │ │ (embed)  │ │  (embed)   │  │
│  │ VPS1     │ │ VPS1     │ │ VPS1     │ │ VPS2     │ │  VPS1      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

Infrastructure: 3 VPS (Salem Trinity) connected via Tailscale
  VPS1 (Nexus):   PostgreSQL, Directus, Neo4j, n8n, PhotoPrism
  VPS2 (Forge):   ChromaDB, LiteLLM, Ollama
  VPS3 (Platform): App server (Nuxt), MetaMCP
```

## Component Responsibilities

| Component | Responsibility | Status | Key File(s) |
|-----------|----------------|--------|-------------|
| **tRPC API** | Type-safe API layer between frontend and backend | Working (22+ routers) | `server/api/index.ts` (1269 lines) |
| **Ingestion Router** | Stream-parse uploads, normalize messages, store | Most production-ready pipeline code | `server/api/routers/ingestion.ts` (326 lines) |
| **Production Pipeline** | Full pipeline: parse → NLP → patterns → store | Has stale Supabase refs, needs Drizzle migration | `server/mcp/pipelines/production-pipeline.ts` (662 lines) |
| **TrinityRouter** | Orchestrate writes across all 5 storage tiers | Fully implemented, graceful degradation | `server/mcp/storage/systemRouter.ts` (405 lines) |
| **Python Bridge** | Spawn Python processes for NLP functions | Functional but basic (no pooling/batching) | `server/mcp/python-bridge.ts` (626 lines) |
| **Multi-Pass Classifier** | Orchestrate NLP: sentiment, entities, keywords | Implemented, calls Python bridge | `server/mcp/analysis/multi-pass-classifier.ts` (613 lines) |
| **Pattern Analyzer** | Detect 303 behavioral patterns in messages | Uses SQL.js locally (should migrate to Drizzle) | `server/mcp/forensics/pattern-analyzer.ts` (1659 lines) |
| **Redis Queue** | Priority-based async task processing | Implemented but NOT wired to pipelines | `server/mcp/queue/redis-queue.ts` (489 lines) |
| **Task Executor** | Worker that processes queued tasks | Implemented, pairs with Redis queue | `server/mcp/workers/executor.ts` (1614 lines) |
| **NLP Runner** | Python-side NLP: spaCy, VADER, sentence-transformers | 8 commands, lazy-loads models | `server/python-tools/nlp_runner.py` (375 lines) |
| **Graphiti Client** | Neo4j knowledge graph operations | Implemented | `server/mcp/storage/graphiti-client.ts` (752 lines) |
| **ChromaDB Client** | Vector embeddings for semantic search | Implemented | `server/mcp/storage/chroma-client.ts` (513 lines) |
| **Directus Client** | CMS asset management | Implemented | `server/mcp/storage/directus-client.ts` |
| **PGVector Client** | PostgreSQL vector extension for embeddings | Implemented | `server/mcp/storage/pgvector-client.ts` |
| **Embedding Service** | Generate real vector embeddings | EXISTS but not wired (mock embeddings used) | `server/mcp/analysis/real-embedding-service.ts`, `server/python-tools/get_embedding.py` |

---

## Data Flow: Messaging Pipeline (End-to-End)

### Current State (What Works)

```
  User uploads file via UI
          ↓
  ┌─────────────────────────────────┐
  │  Ingestion Router (tRPC)        │  ← Only handles XML SMS currently
  │  - Streaming XML parser         │
  │  - Message normalization        │
  │  - Forensic SHA-256 hashing     │
  │  - Drizzle ORM writes           │
  └──────────┬──────────────────────┘
             ↓
  ┌─────────────────────────────────┐
  │  PostgreSQL (Drizzle pgTable)   │  ← Messages stored with metadata
  │  - production-message-schemas   │
  │  - conversations, participants  │
  └──────────┬──────────────────────┘
             ↓
  ┌─────────────────────────────────┐
  │  Basic NLP (inline)             │  ← Some analysis in ingestion router
  │  - Behavior analysis service    │
  │  - Identity resolution          │
  └─────────────────────────────────┘
```

### Target State (What Should Work)

```
  User uploads file (XML SMS / Facebook HTML / PDF iMessage / Google Chat)
          ↓
  ┌─────────────────────────────────┐
  │  1. PARSING STAGE               │
  │  Format-specific parser          │
  │  → Normalized MessageDocument    │
  │  → Forensic SHA-256 hash         │
  └──────────┬──────────────────────┘
             ↓
  ┌─────────────────────────────────┐
  │  2. REDIS QUEUE                  │  ← Currently bypassed (sync for-loop)
  │  Enqueue tasks per message batch │
  │  Priority: urgent > normal > low │
  └──────────┬──────────────────────┘
             ↓
  ┌─────────────────────────────────┐
  │  3. NLP ENRICHMENT               │
  │  Multi-Pass Classifier calls:    │
  │  ├─ Python Bridge → nlp_runner   │
  │  │  ├─ spaCy NER                 │
  │  │  ├─ VADER sentiment           │
  │  │  ├─ TextBlob sentiment        │
  │  │  ├─ sentence-transformers     │
  │  │  └─ langdetect                │
  │  ├─ Speaker attribution          │
  │  ├─ Entity extraction            │
  │  └─ Keyword extraction           │
  └──────────┬──────────────────────┘
             ↓
  ┌─────────────────────────────────┐
  │  4. FORENSIC ANALYSIS            │
  │  Pattern Analyzer detects:       │
  │  ├─ 303 behavioral patterns      │
  │  ├─ Manipulation detection       │
  │  ├─ Coercive control patterns    │
  │  ├─ DARVO sequences              │
  │  └─ Temporal clustering          │
  └──────────┬──────────────────────┘
             ↓
  ┌─────────────────────────────────┐
  │  5. EMBEDDING GENERATION         │  ← Currently mock (Array(384).fill(0))
  │  Real Embedding Service:         │
  │  ├─ get_embedding.py             │
  │  └─ sentence-transformers model  │
  └──────────┬──────────────────────┘
             ↓
  ┌─────────────────────────────────┐
  │  6. MULTI-TIER STORAGE           │
  │  TrinityRouter.storeEvidence()   │
  │  ├─ Directus  → CMS asset        │
  │  ├─ PostgreSQL → structured data  │
  │  ├─ Neo4j/Graphiti → relationships│
  │  ├─ ChromaDB → semantic vectors   │
  │  └─ PGVector → SQL-native vectors │
  │  (Each tier fails gracefully)     │
  └──────────┬──────────────────────┘
             ↓
  ┌─────────────────────────────────┐
  │  7. QUERY / UI                   │
  │  TrinityRouter.query() routes:   │
  │  ├─ semantic → ChromaDB/PGVector  │
  │  ├─ temporal → PostgreSQL         │
  │  ├─ relational → Neo4j/Graphiti   │
  │  ├─ spatial → PostgreSQL          │
  │  └─ comprehensive → all tiers     │
  └─────────────────────────────────┘
```

---

## Four Architecture Questions Answered

### Q1: Optimal Data Flow for Raw Export → UI Browsing

**Answer: Staged pipeline with queue boundaries between CPU-intensive stages.**

The flow should be:

1. **Parse** (fast, I/O bound) — runs synchronously on upload
2. **Store raw** (fast) — PostgreSQL via Drizzle, immediate
3. **Enqueue NLP tasks** — Redis queue, per-conversation batch
4. **NLP enrichment** (slow, CPU bound) — async worker, Python bridge
5. **Pattern detection** (moderate) — async worker, after NLP completes
6. **Embedding generation** (slow, GPU/CPU bound) — async worker, batch
7. **Multi-tier storage** — TrinityRouter, after enrichment complete
8. **UI available** — messages browsable after step 2, enriched after step 7

**Key insight:** Messages should be browsable immediately after parsing (step 2). NLP enrichment and pattern detection happen asynchronously. The UI shows messages with a "processing" indicator until enrichment completes.

**What exists today:** The ingestion router (step 1-3) works for XML SMS. The TrinityRouter (step 7) works. Steps 4-6 exist as components but aren't wired into the pipeline flow. The production-pipeline.ts tries to do everything synchronously in one pass, which won't scale.

### Q2: Python Bridge Structure for Reliable NLP at Scale

**Answer: Persistent process pool with stdin/stdout JSON-RPC, replacing per-call child_process.spawn.**

Current state (`python-bridge.ts`):
```
Each NLP call → child_process.spawn('python3', ['nlp_runner.py', command])
                → Wait for stdout → Parse JSON → Return
                → Process dies after each call
```

Problems:
- Model loading on every call (spaCy loads ~500MB models)
- No connection reuse
- No batching (1 message = 1 process)
- No backpressure

Recommended structure:
```
┌─────────────────────────────────────────────────────┐
│  Python Bridge v2                                    │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │  Process Pool │    │  Worker Process (persist) │   │
│  │  (3-5 workers)├───→│  - spaCy loaded once     │   │
│  │               │    │  - stdin/stdout JSON-RPC  │   │
│  │  Round-robin  │    │  - Batch support          │   │
│  │  assignment   │    │  - Health check heartbeat │   │
│  └──────┬───────┘    └──────────────────────────┘   │
│         │                                            │
│  ┌──────┴───────┐                                    │
│  │  Batch Queue  │  ← Collect N messages or timeout  │
│  │  (50 msgs or  │    before dispatching to worker    │
│  │   500ms max)  │                                    │
│  └──────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

Implementation approach:
1. **Persistent Python process** — `nlp_runner.py` already has a command dispatch loop. Add a `--server` mode that reads JSON-RPC from stdin, processes, writes to stdout. Models load once at startup.
2. **Process pool** — `python-bridge.ts` maintains 3-5 persistent child processes. Round-robin dispatch. Restart on crash.
3. **Batching** — Collect messages into batches of 50 (or 500ms timeout). Send batch to one worker. Reduces per-call overhead.
4. **JS fallbacks stay** — The existing JS fallback functions in `python-bridge.ts` remain for when Python is unavailable. They're less accurate but functional.

**Build order:** This is a Phase 2 concern. For Phase 1, the current per-call approach works for small uploads (<1000 messages). Optimize when processing large exports (10K+ messages).

### Q3: Neo4j/Graphiti Knowledge Graph Integration

**Answer: Graph as relationship enrichment layer, not primary storage. Write-behind from PostgreSQL.**

Current state:
- `graphiti-client.ts` (752 lines) wraps Graphiti-core operations
- `graphiti_runner.py` handles Python-side Graphiti calls
- TrinityRouter already writes to Neo4j as tier 3 (after Directus and PostgreSQL)
- Graceful degradation — if Neo4j is down, other tiers still work

Integration pattern:
```
PostgreSQL (source of truth for messages)
     │
     ├──── TrinityRouter.storeEvidence() ──→ Neo4j/Graphiti
     │     (writes relationship data)         │
     │                                        │
     │     Relationships stored:              │
     │     - Person ←SENT→ Message            │
     │     - Person ←COMMUNICATES_WITH→ Person│
     │     - Message ←PART_OF→ Conversation   │
     │     - Message ←EXHIBITS→ Pattern       │
     │     - Person ←HAS_PATTERN→ BehaviorType│
     │                                        │
     └──── TrinityRouter.query()  ←──────────┘
           (relational queries route to Neo4j)
```

**Key principle:** PostgreSQL is the source of truth. Neo4j is a derived view optimized for relationship traversal. If Neo4j goes down or gets corrupted, it can be rebuilt from PostgreSQL data.

**What to model in the graph:**
- **People** — participants in conversations, with identity resolution
- **Communication patterns** — who talks to whom, frequency, timing
- **Behavioral clusters** — patterns that span multiple conversations
- **Temporal sequences** — escalation patterns over time (e.g., DARVO sequences)

**What NOT to model in the graph:**
- Message text content (stays in PostgreSQL + ChromaDB)
- File attachments (stays in Directus)
- Vector embeddings (stays in ChromaDB/PGVector)

### Q4: Redis Queue Orchestration for Multi-Stage Processing

**Answer: Task dependency chain with stage-specific queues.**

Current state:
- `redis-queue.ts` has full implementation with priority, retry, Lua atomic ops
- `executor.ts` (1614 lines) has task processing logic
- **Neither is wired to the pipeline** — pipelines use synchronous for-loops

Recommended queue structure:
```
┌─────────────────────────────────────────────────────────┐
│  Queue Names (Redis)                                     │
│                                                          │
│  ingest:parse     → Parse raw files, normalize messages  │
│  ingest:nlp       → NLP enrichment (Python bridge)       │
│  ingest:patterns  → Pattern detection (303 patterns)     │
│  ingest:embed     → Generate real embeddings             │
│  ingest:store     → Multi-tier storage (TrinityRouter)   │
│  ingest:dead      → Failed tasks after max retries       │
│                                                          │
│  Priority levels: URGENT(1) > NORMAL(5) > LOW(10)        │
└─────────────────────────────────────────────────────────┘

Task Flow:
  Upload completes
       ↓
  Enqueue to ingest:parse
       ↓ (on success)
  Enqueue to ingest:nlp (per batch)
       ↓ (on success)
  Enqueue to ingest:patterns
       ↓ (on success)
  Enqueue to ingest:embed
       ↓ (on success)
  Enqueue to ingest:store
       ↓ (on success)
  Mark document as "fully processed"

  On failure at any stage:
  - Retry up to 3 times with exponential backoff
  - After max retries → ingest:dead
  - Partial results still available (messages browsable after parse)
```

**Implementation approach:**
1. **Don't rewrite the queue** — `redis-queue.ts` already has everything needed
2. **Wire it in** — The ingestion router should enqueue tasks instead of processing inline
3. **Stage workers** — Each stage gets a worker function registered with the executor
4. **Task payload** — Each task carries `{ documentId, conversationId, batchIndex, stage }`
5. **Progress tracking** — Update a `processing_status` column on the document record

---

## Gaps vs. Things That Just Need Wiring

### Things That Just Need Wiring (Components Exist)

| What | From | To | Effort |
|------|------|----|--------|
| Redis queue → Pipeline | `redis-queue.ts` | `ingestion.ts` router | Medium — refactor ingestion to enqueue instead of inline process |
| Real embeddings → Storage | `real-embedding-service.ts` + `get_embedding.py` | `systemRouter.ts` + `production-pipeline.ts` | Low — replace `Array(384).fill(0)` with service call |
| TrinityRouter → Ingestion | `systemRouter.ts` | `ingestion.ts` | Medium — ingestion router should call TrinityRouter for multi-tier writes |
| Pattern Analyzer → Pipeline | `pattern-analyzer.ts` | Pipeline stage | Medium — needs Drizzle migration (currently SQL.js), then wire as pipeline stage |
| Frontend → tRPC | UI pages (12 routes) | tRPC routers | Medium — 21 Pattern Library TODOs, connect pages to data |
| Supabase → Drizzle | `production-pipeline.ts` | Drizzle ORM calls | Medium — replace all Supabase client imports with Drizzle equivalents |

### Actual Gaps (Components Don't Exist Yet)

| What | Why Needed | Effort |
|------|-----------|--------|
| Facebook HTML parser | Only XML SMS parsing works in ingestion router | Medium — parser exists in `production-pipeline.ts` but not in ingestion router |
| PDF iMessage parser | Court evidence often comes as PDF exports | High — needs OCR or PDF text extraction |
| Google Chat parser | Another common message source | Medium |
| Python bridge server mode | Current per-call spawn won't scale past 1K messages | Medium — add `--server` mode to `nlp_runner.py` |
| Processing status UI | Users need to see upload progress through stages | Low — just a status column + polling |
| Database migration reconciliation | `production-pipeline.ts` uses different table names than `production-message-schemas` | Medium — consolidate to one schema |

---

## Build Order: Fastest Path to Usable

### Phase 1: End-to-End for One Format (XML SMS)

**Goal:** Upload XML SMS → see messages in UI with basic analysis. Everything synchronous, no queue.

```
1. Fix ingestion router to use TrinityRouter for storage
   (currently writes only to PostgreSQL, should write to all tiers)

2. Wire real embeddings instead of mock arrays
   (replace Array(384).fill(0) → real-embedding-service call)

3. Connect frontend Evidence Browser to tRPC evidence queries
   (pages exist, data connections missing)

4. Verify: Upload XML → parse → store → browse messages in UI
```

**Rationale:** Get ONE format working end-to-end before adding complexity. Users can start loading evidence immediately.

### Phase 2: Add NLP + Pattern Detection

**Goal:** Messages get enriched with sentiment, entities, behavioral patterns.

```
1. Wire Multi-Pass Classifier into pipeline (after parse, before store)
2. Wire Pattern Analyzer into pipeline (after NLP, before store)
3. Migrate Pattern Analyzer from SQL.js to Drizzle ORM
4. Surface analysis results in UI (Pattern Library page)
```

**Rationale:** Analysis is the value proposition. But it's useless without Phase 1's basic flow working.

### Phase 3: Queue + Scale

**Goal:** Handle large exports (10K+ messages) without blocking the UI.

```
1. Wire Redis queue between ingestion and processing stages
2. Add stage-specific workers to executor
3. Upgrade Python bridge to persistent process pool
4. Add processing status tracking + UI indicator
```

**Rationale:** Only needed when processing large files. Phase 1-2 work fine for small exports with synchronous processing.

### Phase 4: Additional Parsers

**Goal:** Support Facebook HTML, PDF iMessage, Google Chat.

```
1. Port Facebook HTML parser from production-pipeline.ts to ingestion router
2. Build PDF iMessage parser (new)
3. Build Google Chat parser (new)
4. Each parser outputs the same normalized MessageDocument format
```

**Rationale:** More formats = more evidence sources. But the pipeline must work for one format first.

### Phase 5: Knowledge Graph + Advanced Queries

**Goal:** Relationship mapping, cross-conversation pattern detection.

```
1. Enrich Neo4j/Graphiti writes with relationship data
2. Build relationship query UI (who talks to whom, when, patterns)
3. Cross-conversation behavioral trend detection
4. Timeline visualization with graph data
```

**Rationale:** This is the differentiator, but it requires all earlier phases to be solid.

---

## Architectural Patterns (Existing)

### Pattern 1: Graceful Degradation (TrinityRouter)

**What:** Each storage tier is wrapped in try/catch. If one tier fails, the others still succeed. Results include per-tier status.
**When to use:** Any multi-service write operation.
**Trade-offs:** Partial writes can create consistency issues (mitigated by PostgreSQL being source of truth).

```typescript
// From systemRouter.ts — each tier wrapped independently
results.directus = await this.writeToDirectus(evidence);  // tier 1
results.postgres = await this.writeToPostgres(evidence);  // tier 2
results.neo4j = await this.writeToNeo4j(evidence);        // tier 3 (can fail)
results.chroma = await this.writeToChroma(evidence);       // tier 4 (can fail)
results.pgvector = await this.writeToPGVector(evidence);   // tier 5 (can fail)
```

### Pattern 2: Capability-Based Query Routing (TrinityRouter)

**What:** Queries specify a capability (semantic, temporal, relational, comprehensive) and TrinityRouter routes to the appropriate storage tier.
**When to use:** When multiple storage backends serve different query types.
**Trade-offs:** Query planning complexity increases with tiers.

### Pattern 3: JS Fallbacks for Python Functions (Python Bridge)

**What:** Every Python NLP function has a JavaScript fallback that returns approximate results. If Python is unavailable, the bridge uses JS.
**When to use:** When an external runtime dependency might be unavailable.
**Trade-offs:** Fallback quality is lower, but the system never hard-fails on NLP unavailability.

### Pattern 4: Forensic Hashing (SHA-256 Chain of Custody)

**What:** Every piece of evidence gets a SHA-256 hash at ingestion time. Hash is stored alongside the data. Enables chain-of-custody verification.
**When to use:** Any evidence processing system where authenticity matters.
**Trade-offs:** Small performance overhead, but critical for court admissibility.

---

## Anti-Patterns Found in Codebase

### Anti-Pattern 1: Stale Supabase References

**What exists:** `production-pipeline.ts` imports from `../storage/supabase-client` and writes to `messaging_*` tables via Supabase client.
**Why it's wrong:** The project migrated to PostgreSQL + Drizzle ORM. Supabase references are dead code that will crash at runtime.
**Do this instead:** Use the ingestion router pattern — Drizzle ORM with `production-message-schemas`. OR port the production pipeline's logic into the ingestion router.

### Anti-Pattern 2: Mock Embeddings in Production Code

**What exists:** `Array(384).fill(0)` and `Array(1536).fill(0)` used as placeholder embeddings in `systemRouter.ts` and `production-pipeline.ts`.
**Why it's wrong:** Semantic search will return garbage results. ChromaDB and PGVector will store meaningless vectors.
**Do this instead:** Wire `real-embedding-service.ts` and `get_embedding.py` which already exist. Call them before storage.

### Anti-Pattern 3: Synchronous Pipeline Processing

**What exists:** Pipelines process messages in a for-loop, blocking the request until all messages are processed.
**Why it's wrong:** A 10K message export will timeout the HTTP request. UI is blocked during processing.
**Do this instead:** Parse and store raw messages synchronously (fast). Enqueue NLP/pattern tasks to Redis (already implemented, just not wired).

### Anti-Pattern 4: SQL.js in Pattern Analyzer

**What exists:** `pattern-analyzer.ts` uses SQL.js (in-memory SQLite compiled to WASM) for its 303 pattern definitions.
**Why it's wrong:** PostgreSQL is already available. Running SQLite alongside PostgreSQL adds complexity and prevents sharing pattern data with other components.
**Do this instead:** Migrate pattern definitions to a PostgreSQL table via Drizzle. The pattern analyzer queries PostgreSQL like everything else.

### Anti-Pattern 5: Duplicate Pipeline Implementations

**What exists:** Three pipeline files: `production-pipeline.ts` (662 lines), `end-to-end-pipeline.ts` (244 lines), and `ingestion.ts` router (326 lines).
**Why it's wrong:** Logic is split across files with different approaches (Supabase vs Drizzle, different table names, different feature coverage).
**Do this instead:** Consolidate into the ingestion router approach (tRPC + Drizzle + streaming parser). Port missing parsers from production-pipeline.ts into the ingestion router pattern.

---

## Integration Points

### External Services (Salem Trinity VPS)

| Service | VPS | Integration Pattern | Status |
|---------|-----|---------------------|--------|
| PostgreSQL | VPS1 (Nexus) | Drizzle ORM, connection string via env | Working |
| Directus | VPS1 (Nexus) | REST API via directus-client.ts | Implemented |
| Neo4j | VPS1 (Nexus) | Graphiti-core via graphiti-client.ts + graphiti_runner.py | Implemented |
| ChromaDB | VPS2 (Forge) | REST API via chroma-client.ts | Implemented |
| PGVector | VPS1 (Nexus) | PostgreSQL extension, accessed via Drizzle | Implemented |
| LiteLLM | VPS2 (Forge) | OpenAI-compatible API proxy | Available |
| Ollama | VPS2 (Forge) | Local LLM inference | Available |
| Redis | VPS3 (Platform) | ioredis client in redis-queue.ts | Implemented, not wired |
| n8n | VPS1 (Nexus) | Workflow automation | Available, not integrated |
| Tailscale | All VPS | Mesh VPN connecting all services | Working |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend ↔ Backend | tRPC (type-safe RPC) | 22+ routers, some pages not yet connected |
| TypeScript ↔ Python | child_process spawn (JSON over stdout) | Works but needs persistent process for scale |
| App ↔ Storage Tiers | TrinityRouter abstraction | Each tier has its own client library |
| Queue ↔ Workers | Redis pub/sub + Lua scripts | Implemented, not yet wired to pipeline |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-100 conversations (current) | Synchronous processing fine. Current architecture works as-is once wired. |
| 100-1K conversations | Wire Redis queue. Upgrade Python bridge to process pool. Batch embeddings. |
| 1K-10K conversations | Add worker concurrency (multiple executor instances). Consider embedding generation on VPS2 (GPU via Ollama). |
| 10K+ conversations | Unlikely for forensic case work. If needed: partition by case, parallel workers per partition. |

### First Bottleneck: Python NLP Processing

The per-call child_process.spawn pattern means every message loads spaCy models from scratch. For 1000+ messages, this is the bottleneck.

**Fix:** Persistent Python process with stdin/stdout JSON-RPC (Phase 3).

### Second Bottleneck: Embedding Generation

Mock embeddings hide this problem. Real embeddings via sentence-transformers are CPU-intensive (~50ms per message on CPU).

**Fix:** Batch processing (50 messages at once), consider GPU inference on VPS2 via Ollama embedding endpoint.

---

## Schema Reconciliation Note

A critical finding: the codebase has **two different schema approaches** that need reconciliation:

1. **`drizzle/schema.ts`** — Uses `pgTable` with tables like `evidence`, `conversations`, `messages`, `patterns`
2. **`drizzle/production-message-schemas`** — Referenced by ingestion router, likely has different table names
3. **`production-pipeline.ts`** — References Supabase tables: `messaging_documents`, `messaging_conversations`, `messaging_messages`, `messaging_behaviors`

Before any wiring work, these schemas need to be unified. The `production-message-schemas` used by the ingestion router should be the canonical source, since that's the most production-ready code path.

---

## Sources

- Direct codebase analysis of 15+ source files (HIGH confidence)
- `INGESTION_ARCHITECTURE.md` — bidirectional ingestion pathways
- `STORAGE_ARCHITECTURE.md` — 4-tier storage design (canonical)
- `BACKEND_ARCHITECTURE.md` — VPS layout, database separation
- `PROJECT.md` — project vision and goals

---
*Architecture research for: MCP Tool Platform (forensic evidence preprocessing)*
*Researched: 2026-02-25*
*Based on: Direct codebase analysis, not hypothetical design*
