# Stack Research

**Domain:** Forensic messaging pipeline — messaging-to-knowledge-graph for custody case evidence
**Researched:** 2026-02-25
**Confidence:** HIGH (versions verified via npm registry, PyPI, Context7)
**Context:** Subsequent milestone — platform ~80% built, researching what's needed for end-to-end messaging workflow

## Existing Stack (Locked — Do Not Change)

The platform core is locked per `STORAGE_ARCHITECTURE.md` and `BACKEND_ARCHITECTURE.md`:

| Technology | Installed Version | Purpose |
|------------|-------------------|---------|
| TypeScript | 5.9.3 | Language |
| Node.js | 22 | Runtime |
| Express | 4.21.2 | HTTP server |
| tRPC | 11.6.0 | Type-safe API layer |
| React | 19.2.1 | Frontend |
| Vite | 7.1.7 | Build tool |
| Drizzle ORM | 0.44.6 | SQL ORM + pgvector support |
| PostgreSQL | 16 + pgvector | Primary data store + vector search |
| Neo4j | 5.15+ | Graph database (Graphiti knowledge graph) |
| ChromaDB | 3.2.0 (npm) | Vector working memory (72hr TTL) |
| Redis | 7 (via ioredis 5.9.2) | Queue backend, caching |
| MySQL | (via mysql2 3.15.0) | App database |
| Directus | — | File/asset management |
| pnpm | 10.4.1 | Package manager |

This research focuses only on what's needed **on top of** the existing stack for the messaging workflow.

---

## Recommended Stack Additions

### 1. Job Queue: BullMQ (NEW — Replace Custom Queue)

| | |
|---|---|
| **Library** | `bullmq` |
| **Version** | `^5.70.1` (latest stable, verified 2026-02-25) |
| **Confidence** | **HIGH** — Context7 verified, 1236 code snippets, npm registry confirmed |
| **Status** | **NEW INSTALL REQUIRED** — not in package.json |

**Why:** The existing `server/mcp/queue/redis-queue.ts` is a 490-line custom Redis queue with manual Lua scripts, manual priority sorting, manual retry logic, and an in-memory fallback. BullMQ provides all of this out of the box plus:

- **FlowProducer** for parent-child job dependencies — perfect for the parse→NLP→pattern→store pipeline where each stage depends on the previous
- **Built-in progress tracking** via `job.updateProgress()` — replaces the manual `PipelineProgress` callbacks in `document-pipeline.ts`
- **Automatic retries** with configurable backoff — the custom queue has manual retry logic that's fragile
- **Concurrency control** per worker — process 5 parse jobs but only 2 Python NLP jobs (to avoid overloading the bridge)
- **Rate limiting** — throttle Graphiti/LLM API calls without custom code
- **Job scheduling** (delayed/repeating) — useful for batch re-processing
- **Built on ioredis** — already installed at `^5.9.2`

**Pipeline flow mapping:**

```
FlowProducer.add({
  name: 'process-export',
  queueName: 'messaging',
  children: [
    { name: 'parse', queueName: 'parse', data: { file, format } },
    // After parse completes, parent triggers:
    { name: 'nlp-tag', queueName: 'nlp', data: { messageIds } },
    { name: 'pattern-detect', queueName: 'patterns', data: { messageIds } },
    { name: 'store-all-dbs', queueName: 'storage', data: { messageIds } },
  ]
})
```

**Migration path:** Keep the existing `QueueManager` interface, swap internals to BullMQ. The `InMemoryQueue` fallback is still useful for local dev without Redis.

### 2. Knowledge Graph: graphiti-core (EXISTING — Version Upgrade Needed)

| | |
|---|---|
| **Library** | `graphiti-core` (Python) |
| **Installed** | `0.26.3` |
| **Latest** | `0.28.1` (verified PyPI 2026-02-25) |
| **Pinned in requirements.txt** | `>=0.3.0` (dangerously wide) |
| **Confidence** | **HIGH** — Context7 verified (224 snippets), PyPI confirmed, existing runner works |

**Why graphiti-core and not alternatives:**

- **Temporal awareness** — Graphiti is the only knowledge graph library that natively tracks when facts were true. For 8+ years of messaging data, knowing "X said Y in 2019 but contradicted it in 2023" is the entire value proposition.
- **EpisodeType.message** — Native support for `{role}: {message}` format. Messages go in, entities and relationships come out automatically.
- **Custom entity/edge types** — Can define `Person`, `Location`, `Threat`, `Promise` entity types with Pydantic models. Can define `Threatened`, `Gaslit`, `Lied_About` edge types. This maps directly to the 303 behavioral patterns.
- **Hybrid search** — `NODE_HYBRID_SEARCH_RRF` and `EDGE_HYBRID_SEARCH_RRF` combine vector similarity with graph traversal. Already imported in `graphiti_runner.py`.

**Action items:**
1. Pin version: change `>=0.3.0` to `>=0.28.0,<0.29.0` in requirements.txt
2. Update `graphiti_runner.py` — it says "Updated for v0.5+ API" but the API has changed significantly through 0.26→0.28
3. Configure LLM provider — Graphiti defaults to OpenAI. The existing Provider Hub supports 20+ providers. Wire one through.
4. Define custom entity/edge types for the forensic domain (see Architecture section)

**Graphiti requires an LLM for entity extraction.** It's not optional — the library uses LLM calls internally to identify entities and relationships from episode text. Budget for API costs or configure a local model.

### 3. Message Parsers (EXISTING — Already Installed)

| Library | Installed | Latest | Purpose | Confidence |
|---------|-----------|--------|---------|------------|
| `fast-xml-parser` | `^5.2.5` | `5.4.1` | SMS XML exports (Android SMS Backup & Restore) | **HIGH** — Context7 verified |
| `cheerio` | `^1.1.2` | `1.2.0` | HTML message exports (Facebook, Instagram DMs) | **HIGH** — npm verified |
| `csv-parse` | `^5.6.0` | `6.1.0` | CSV/tabular exports | **HIGH** — npm verified |
| `sax` | `^1.4.4` | — | Streaming XML for large files | **HIGH** — already installed |
| `htmlparser2` | `^10.1.0` | — | Fast HTML parsing (alternative to cheerio for streaming) | **HIGH** — already installed |

**Snapchat parser:** Schema exists at `server/mcp/schemas/snapchat_messages.json` but no loader. Snapchat exports as JSON — use native `JSON.parse()` with Zod validation. No new library needed.

**Version note:** `fast-xml-parser` v5→v6 has breaking changes (new options API structure per Context7). Stay on v5 branch unless v6 offers something critical. The v5 API with `XMLParser(options)` is stable and well-documented.

### 4. TypeScript-Native NLP (EXISTING — Already Installed)

| Library | Installed | Latest | Purpose | Confidence |
|---------|-----------|--------|---------|------------|
| `compromise` | `^14.14.5` | `14.15.0` | Entity extraction (people, places, orgs), POS tagging | **HIGH** — Context7 verified |
| `natural` | `^8.1.0` | `8.1.0` (current) | Tokenization, stemming, sentiment scoring | **HIGH** — npm verified |
| `franc` | `^6.2.0` | — | Language detection | **HIGH** — already installed |
| `string-similarity` | `^4.0.4` | — | Fuzzy string matching for entity deduplication | **HIGH** — already installed |

**compromise capabilities verified (Context7):**
- `doc.people().text()` — extract person names
- `doc.places().text()` — extract locations
- `doc.organizations().text()` — extract organizations
- `doc.topics().text()` — extract all named entities combined
- `compromise-sentiment` plugin — sentiment analysis
- `compromise-dates` plugin — date/time extraction from natural text
- Synchronous API, no external dependencies, works in Node.js and browser

**Pattern: TypeScript-first, Python-fallback.**
Use compromise/natural for first-pass NLP (entity extraction, sentiment, language detection). Reserve Python bridge for:
- spaCy: dependency parsing, custom NER models, deeper linguistic analysis
- sentence-transformers: high-quality embeddings for semantic search
- Graphiti: knowledge graph episode ingestion (Python-only library)

### 5. Vector Embeddings (EXISTING — Already Configured)

| Component | Version | Purpose | Confidence |
|-----------|---------|---------|------------|
| Ollama + `nomic-embed-text` | latest | Local embeddings (768-dim), free, no API cost | **HIGH** — in docker-compose |
| `pgvector` npm | `^0.2.1` | Node.js pgvector client | **HIGH** — installed |
| Drizzle `vector()` column | 0.44.6+ | Native pgvector column type + HNSW index | **HIGH** — Context7 verified |
| `@huggingface/transformers` | `^3.8.1` | Browser/Node embeddings (fallback) | **MEDIUM** — installed but usage unclear |

**Drizzle pgvector integration verified (Context7):**
```typescript
import { vector, index } from 'drizzle-orm/pg-core';
// Define vector column with dimensions matching your embedding model
embedding: vector('embedding', { dimensions: 768 }),  // nomic-embed-text = 768 dims
// HNSW index for fast similarity search
index('embIdx').using('hnsw', table.embedding.op('vector_cosine_ops'))
// Query with cosineDistance
const similarity = sql<number>`1 - (${cosineDistance(table.embedding, queryVec)})`;
```

**Embedding pipeline:**
1. Message text → Ollama `nomic-embed-text` (768-dim) → pgvector for semantic search
2. Same embeddings → ChromaDB for 72hr working memory during processing
3. Graphiti handles its own embeddings internally (configurable provider)

### 6. Forensic Hashing (EXISTING — Node.js crypto)

| Component | Status | Purpose | Confidence |
|-----------|--------|---------|------------|
| `crypto.createHash('sha256')` | In use | SHA-256 content hashing for chain of custody | **HIGH** — verified in codebase |
| `chain-custody.ts` | Implemented | Full chain of custody with cryptographic chaining | **HIGH** — 316 lines, tested |
| `identity-service.ts` | Implemented | Deterministic conversation identity via SHA-256 | **HIGH** — verified |
| `content-store.ts` | Implemented | Content-addressed artifact store | **HIGH** — verified |

**No new libraries needed for hashing.** Node.js built-in `crypto` module provides SHA-256, which is the forensic standard. The existing implementation in `chain-custody.ts` already:
- Hashes content at each processing stage
- Creates cryptographic chain linking stages
- Provides `createHash()` and `verifyHash()` exports
- Has test coverage in `chain-custody.test.ts`

**What to verify:** The `pattern-analyzer.ts` uses a weak custom hash (bitwise `<<5` JS hash) for document identification at line 1190. This should be replaced with the SHA-256 `createHash()` from `chain-custody.ts` for forensic integrity.

### 7. Schema Validation (EXISTING)

| Library | Installed | Purpose | Confidence |
|---------|-----------|---------|------------|
| `zod` | `^4.1.12` (latest: `4.3.6`) | Message schema validation per platform | **HIGH** — extensively used with tRPC |

**Usage pattern:** Define Zod schemas for each messaging platform's export format (Facebook JSON, SMS XML, Snapchat JSON). Validate parsed messages before they enter the pipeline. Already used extensively throughout the tRPC routers.

### 8. Timestamp Handling (EXISTING)

| Library | Installed | Purpose | Confidence |
|---------|-----------|---------|------------|
| `date-fns` | `^4.1.0` (current) | Timestamp normalization across platforms | **HIGH** — npm verified |

**Critical for messaging pipeline:** Different platforms export timestamps in different formats:
- Facebook: Unix epoch milliseconds
- SMS Backup: Unix epoch milliseconds (in XML attributes)
- Snapchat: ISO 8601 strings
- Use `date-fns` to normalize all to UTC `Date` objects before storage and Graphiti ingestion.

### 9. Neo4j Driver (EXISTING)

| Library | Installed | Latest | Purpose | Confidence |
|---------|-----------|--------|---------|------------|
| `neo4j-driver` | `^5.24.0` | `6.0.1` | Direct Neo4j queries from TypeScript | **HIGH** — Context7 verified |

**Version note:** neo4j-driver 6.0 is a major version bump. The existing `graphiti-client.ts` (752 lines) uses the v5 API. **Do not upgrade to v6** during this milestone — it would require rewriting the client. The v5 driver is fully compatible with Neo4j 5.15+.

**Streaming support verified (Context7):** The v5 driver supports streaming record consumption via `.subscribe({ onKeys, onNext, onCompleted, onError })` — useful for large graph queries.

---

## Python Bridge Stack (EXISTING — Version Updates Needed)

The Python bridge (`server/mcp/python-bridge.ts`) spawns Python processes via `child_process`. These tools run on the Python side:

| Library | Pinned | Latest | Purpose | Action |
|---------|--------|--------|---------|--------|
| `graphiti-core` | `>=0.3.0` | `0.28.1` | Temporal knowledge graph | **Pin to `>=0.28.0,<0.29.0`** |
| `spacy` | `>=3.7.0` | `3.8.11` | Deep NLP, NER, dependency parsing | **Pin to `>=3.8.0,<3.9.0`** |
| `nltk` | `>=3.8.0` | — | Tokenization, corpora | Keep as-is |
| `sentence-transformers` | `>=2.2.0` | — | Semantic embeddings | Keep as-is |
| `torch` | `>=2.0.0` | — | ML runtime for sentence-transformers | Keep as-is |
| `neo4j` (Python) | `>=5.0.0` | — | Python Neo4j driver for Graphiti | Keep as-is |
| `numpy` | `>=1.24.0` | — | Numerical operations | Keep as-is |

**Critical: NLP packages are NOT installed locally.** `pip show spacy nltk sentence-transformers` returns "not found". These are deployment dependencies — they'll run on the Salem Trinity VPS. But they need to be installable and tested before deployment.

---

## What NOT to Use

| Avoid | Why | Use Instead | Confidence |
|-------|-----|-------------|------------|
| Custom Redis queue (current `redis-queue.ts`) | 490 lines of hand-rolled Lua scripts, manual retries, no flow support. Maintenance liability for a solo developer. | BullMQ — battle-tested, typed, flow support | **HIGH** |
| `faiss-node` (installed) | In-memory only, no persistence. Already have pgvector. Adds dependency for no benefit. | pgvector with HNSW index via Drizzle | **HIGH** |
| ChromaDB for permanent storage | 72hr TTL by design. `chroma-client.ts` explicitly uses it as working memory. | PostgreSQL/pgvector for permanent, ChromaDB only during processing | **HIGH** |
| `neo4j-driver` v6 | Major breaking changes, would require rewriting `graphiti-client.ts` (752 lines) | Stay on v5 branch during this milestone | **HIGH** |
| `fast-xml-parser` v6 | Breaking API changes (new options structure). v5 is stable and sufficient. | Stay on v5 (`^5.2.5`) | **MEDIUM** |
| `mem0` for message storage | Feature flag `ENABLE_MEM0` is false. Designed for AI agent memory, not forensic evidence. | PostgreSQL for permanent structured data | **HIGH** |
| New database systems | Already running 5 databases. Each one is operational overhead on 3 VPS instances. | Route all data through existing PostgreSQL/Neo4j/ChromaDB | **HIGH** |
| Heavy ML models for parsing | Structured exports (JSON, XML, HTML) don't need ML to parse. | Regex, cheerio, fast-xml-parser for parsing. ML only for NLP tagging. | **HIGH** |
| LlamaIndex for knowledge graph | Installed (`llamaindex ^0.12.1`) but Graphiti is purpose-built for temporal graphs. LlamaIndex's KG is static. | Graphiti for temporal KG. Keep LlamaIndex only if needed for RAG. | **MEDIUM** |

---

## Installation

```bash
# NEW — Only one new package needed
pnpm add bullmq

# VERIFY existing Python deps can install (on VPS or local test):
cd server/python-tools
pip install -r requirements.txt

# VERIFY Ollama has the embedding model:
ollama pull nomic-embed-text

# UPDATE requirements.txt pins (manual edit):
# graphiti-core>=0.3.0  →  graphiti-core>=0.28.0,<0.29.0
# spacy>=3.7.0          →  spacy>=3.8.0,<3.9.0
```

---

## Stack Patterns for This Milestone

### Pattern 1: TypeScript-first, Python-fallback

- Use compromise/natural for NLP tasks that don't need Python (entity extraction, sentiment, POS tagging)
- Reserve Python bridge for: spaCy custom NER, Graphiti episode ingestion, sentence-transformers embeddings
- **Why:** Python bridge adds ~500ms startup latency per process spawn. For 10,000+ messages, this adds up. Do as much as possible in TypeScript.

### Pattern 2: Parse → Enrich → Store (staged pipeline via BullMQ)

- **Stage 1 (TS):** Parse raw exports into normalized `ParsedMessage` format using existing loaders
- **Stage 2 (TS):** Basic NLP tagging with compromise/natural (entities, sentiment, language)
- **Stage 3 (Python):** Deep NLP with spaCy (dependency parsing, custom NER) + forensic hashing
- **Stage 4 (Python):** Graphiti `add_episode()` with `EpisodeType.message` for knowledge graph
- **Stage 5 (TS):** Store results across all databases (PostgreSQL, pgvector, ChromaDB, Neo4j metadata)
- **Why:** Each stage can be tested independently. BullMQ FlowProducer handles dependencies. A failure in Stage 3 doesn't lose Stage 1-2 results.

### Pattern 3: Forensic integrity at every stage

- SHA-256 hash content before and after each processing stage
- Chain of custody entry at each stage (use existing `chain-custody.ts`)
- Content-addressed storage for raw and processed artifacts (use existing `content-store.ts`)
- **Why:** Court evidence must be provably unmodified. Every transformation must be auditable.

### Pattern 4: Embedding before storage

- Generate embeddings (Ollama nomic-embed-text, 768-dim) during Stage 2-3
- Store vectors in pgvector for permanent semantic search
- Also push to ChromaDB for 72hr processing window
- **Why:** Embedding at ingest time means semantic search is available immediately. No separate batch embedding job needed.

---

## Version Compatibility Matrix

| Package A | Compatible With | Verified | Notes |
|-----------|-----------------|----------|-------|
| `graphiti-core` 0.28.x | Neo4j 5.15+ | **YES** — requires APOC plugin | APOC already in docker-compose |
| `graphiti-core` 0.28.x | OpenAI API (default) | **YES** — Context7 verified | Can swap to Anthropic or local model |
| `graphiti-core` 0.28.x | Python `neo4j` >=5.0 | **YES** — listed in Requires | Both already pinned |
| Drizzle ORM 0.44.x | pgvector extension | **YES** — Context7 verified | Native `vector()` column, HNSW index |
| `bullmq` 5.70.x | ioredis 5.x | **YES** — built on ioredis | ioredis 5.9.2 already installed |
| `bullmq` 5.70.x | Redis 7 | **YES** | Redis 7 in docker-compose |
| `neo4j-driver` 5.24.x | Neo4j 5.15+ | **YES** — Context7 verified | Do NOT upgrade to 6.x |
| `compromise` 14.x | Node 22 | **YES** | Pure JS, no native deps |
| `fast-xml-parser` 5.x | Node 22 | **YES** | Pure JS |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Graphiti requires LLM API calls (not free) | **MEDIUM** | Configure cheapest provider (gpt-4.1-nano for reranking, gpt-4.1-mini for extraction) or local Ollama model |
| Python bridge latency for 10K+ messages | **MEDIUM** | Batch messages into episodes (10-20 messages per `add_episode` call). Use BullMQ concurrency limits. |
| graphiti-core 0.28.x API may differ from 0.26.3 runner code | **LOW** | `graphiti_runner.py` already handles the core API. Test upgrade before deploying. |
| BullMQ migration from custom queue | **LOW** | Keep `QueueManager` interface, swap implementation. In-memory fallback still works. |
| Python NLP packages not installed locally | **LOW** | Deployment concern, not development blocker. Test in Docker. |

---

## Sources

- **Context7** `/websites/help_getzep_graphiti` — Episode types, custom entity/edge types, LLM configuration, search recipes (HIGH confidence)
- **Context7** `/drizzle-team/drizzle-orm-docs` — pgvector integration, vector column, HNSW index, cosineDistance (HIGH confidence)
- **Context7** `/taskforcesh/bullmq` — FlowProducer, Worker, job dependencies, batch processing, progress tracking (HIGH confidence)
- **Context7** `/naturalintelligence/fast-xml-parser` — XML parsing options, v4/v5/v6 API differences (HIGH confidence)
- **Context7** `/spencermountain/compromise` — NER extraction, people/places/orgs, plugins, API (HIGH confidence)
- **Context7** `/neo4j/neo4j-javascript-driver` — Streaming API, transaction retries, v5/v6 differences (HIGH confidence)
- **npm registry** — All Node.js package versions verified 2026-02-25 via `npm view <pkg> version`
- **PyPI** — `graphiti-core` version 0.28.1 verified, `spacy` 3.8.11 verified via `pip index versions`
- **Codebase** — `package.json`, `requirements.txt`, `redis-queue.ts`, `chain-custody.ts`, `graphiti_runner.py`, `production-pipeline.ts` examined directly

---
*Stack research for: Forensic messaging pipeline (subsequent milestone — end-to-end messaging workflow)*
*Researched: 2026-02-25*
*Author: gsd-project-researcher@opencode*
