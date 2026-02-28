---
title: GraphRAG Integration Plan
version: 1.0.0
created: 2026-02-28 23:00
author: gsd-project-researcher@opencode
project: MCP Tool Platform
status: draft
---

# GraphRAG Integration Plan

**Goal:** Wire three GraphRAG packages into the existing 5-tier storage architecture, minimizing custom code while preserving DuckDB as first-touch and Graphiti as temporal memory.

**Non-negotiables:**
1. DuckDB ALWAYS first touch (SHA-256, dedup, staging)
2. Graphiti ALWAYS handles temporal memory (valid_at/invalid_at, contradiction detection)
3. GraphRAG packages handle NER, community detection, retrieval — NOT storage replacement
4. Conflicts surfaced to user (Rule #8)
5. Configurable embeddings (Ollama nomic-embed-text 768-dim default)

---

## Architecture Overview

```
Document arrives
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  DUCKDB — First Touch (ALWAYS)                      │
│  ├─ SHA-256 hash (chain of custody)                 │
│  ├─ Dedup check (content_hash lookup)               │
│  ├─ Metadata extraction (platform, timestamp, etc.) │
│  ├─ ingestion_log INSERT                            │
│  └─ Returns: ingestionId, sourceHash, isDuplicate   │
└────────────────────┬────────────────────────────────┘
                     │
                     ├── IF duplicate → STOP (return existing record)
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  PARALLEL FANOUT (3 paths, independent)             │
│                                                     │
│  PATH 1: LanceDB                                    │
│  ├─ Store raw binary (PDF, screenshot, audio)       │
│  ├─ Generate embedding (nomic-embed-text 768-dim)   │
│  └─ Write to multimodal_vault table                 │
│                                                     │
│  PATH 2: Graphiti → Neo4j temporal_memory           │
│  ├─ Extract temporal facts (episodes)               │
│  ├─ Detect contradictions with existing facts        │
│  ├─ Create/update temporal edges (valid_at/invalid_at)│
│  └─ Python bridge → graphiti-core process           │
│                                                     │
│  PATH 3: Staging for Batch GraphRAG                 │
│  ├─ DuckDB: Mark document as "pending_graphrag"     │
│  └─ (Batch pipeline runs separately on schedule)    │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  DuckDB — Write Tracking                            │
│  ├─ Update write_status per tier                    │
│  └─ Return IngestionResult with per-tier status     │
└─────────────────────────────────────────────────────┘
```

### Batch GraphRAG Pipeline (Runs Separately)

```
Scheduled job (cron or manual trigger)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  DuckDB: Query documents WHERE status = pending     │
│  └─ Returns batch of text chunks for processing     │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  MS GraphRAG Pipeline (Python, graphrag v3.0.5)     │
│  ├─ Phase 1: Text chunking                          │
│  ├─ Phase 2: Entity extraction (LLM or NLP/fast)    │
│  ├─ Phase 3: Relationship extraction                │
│  ├─ Phase 4: Community detection (Leiden algorithm)  │
│  ├─ Phase 5: Community summarization (LLM)          │
│  └─ Phase 6: Output → parquet files                 │
│                                                     │
│  Config:                                            │
│  ├─ GRAPHRAG_ENTITY_EXTRACTION_ENTITY_TYPES:        │
│  │   person, communication, event, location, org    │
│  ├─ GRAPHRAG_CLAIM_EXTRACTION_ENABLED: true         │
│  ├─ extraction_method: fast (spaCy/NLTK)            │
│  └─ llm_model: qwen2.5:14b via Ollama              │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Parquet → Neo4j Import Script                      │
│  ├─ Read entities.parquet                           │
│  │   UNWIND → CREATE (:__Entity__) in semantic_facts│
│  ├─ Read relationships.parquet                      │
│  │   MATCH → MERGE [:RELATED] edges                 │
│  ├─ Read text_units.parquet                         │
│  │   CREATE (:__Chunk__) + [:HAS_ENTITY]            │
│  ├─ Read communities.parquet                        │
│  │   CREATE (:__Community__) + [:IN_COMMUNITY]      │
│  └─ Create vector index on entity descriptions      │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Entity Resolution (Post-Import)                    │
│  ├─ k-NN on entity name embeddings                  │
│  ├─ WCC (Weakly Connected Components) via Neo4j GDS │
│  ├─ Word distance filtering (Levenshtein)           │
│  ├─ LLM evaluation for ambiguous merges             │
│  └─ Cypher MERGE to canonical entity nodes          │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  DuckDB: Mark batch as "graphrag_complete"          │
│  └─ Update write_status with enrichment timestamp   │
└─────────────────────────────────────────────────────┘
```

---

## Component Responsibility Matrix

| Responsibility | Owner | Package/Custom | Database |
|---|---|---|---|
| SHA-256 hashing | DuckDB client | **Custom** (keep existing 416-line client) | DuckDB |
| Dedup check | DuckDB client | **Custom** | DuckDB |
| Ingestion logging | DuckDB client | **Custom** | DuckDB |
| Write tracking | DuckDB client | **Custom** | DuckDB |
| Raw binary storage | LanceDB client | **Custom** (keep existing 389-line client) | LanceDB |
| Vector embeddings | LanceDB client | **Custom** | LanceDB |
| Temporal fact extraction | Graphiti | **Package** (graphiti-core via Python bridge) | Neo4j temporal_memory |
| Contradiction detection | Graphiti | **Package** (graphiti-core) | Neo4j temporal_memory |
| Episode management | Graphiti | **Package** (graphiti-core) | Neo4j temporal_memory |
| Batch entity extraction | MS GraphRAG | **Package** (graphrag v3.0.5) | Parquet → Neo4j |
| Community detection | MS GraphRAG | **Package** (Leiden via Neo4j GDS) | Neo4j semantic_facts |
| Community summarization | MS GraphRAG | **Package** (LLM map-reduce) | Neo4j semantic_facts |
| Parquet → Neo4j import | Import script | **Custom** (~50 lines Cypher) | Neo4j semantic_facts |
| Entity resolution | Resolution script | **Custom** (~100 lines) | Neo4j semantic_facts |
| Local search (retrieval) | Neo4j GraphRAG Python | **Package** (VectorRetriever) | Neo4j semantic_facts |
| Global search (retrieval) | Neo4j GraphRAG Python | **Package** (community map-reduce) | Neo4j semantic_facts |
| Query routing | TrinityRouter | **Custom** (~100 lines, down from 389) | N/A |
| Claim extraction | MS GraphRAG | **Package** (optional, for behavioral patterns) | Parquet → Neo4j |
| User/API keys/workflows | MySQL + Drizzle | **Custom** (existing) | MySQL |

### Custom Code Budget

| Component | Current Lines | Target Lines | Change |
|---|---|---|---|
| DuckDB client (`duckdb.ts`) | 416 | ~350 | -66 (remove unused methods) |
| LanceDB client (`lancedb.ts`) | 389 | ~350 | -39 (remove unused methods) |
| TrinityRouter (`systemRouter.ts`) | 388 | ~100 | **-288** (delegate to packages) |
| Graphiti client (`graphiti-client.ts`) | 752 | ~200 | **-552** (simplify to bridge-only) |
| Python bridge (`python-bridge.ts`) | 427 | ~300 | -127 (remove endpoints GraphRAG handles) |
| `semantic_facts.ts` | 0 (MISSING) | ~80 | **+80** (NEW — Neo4j GraphRAG Python bridge) |
| Parquet import script | 0 | ~50 | +50 (NEW — Cypher UNWIND batch) |
| Entity resolution script | 0 | ~100 | +100 (NEW — k-NN + WCC + LLM) |
| **TOTAL** | ~2,372 | ~1,530 | **-842 lines (~35% reduction)** |

---

## Package Integration Details

### 1. DuckDB (Stays As-Is, Upstream of Everything)

**Current state:** 416-line client, fully functional
**What changes:** Nothing fundamental. DuckDB remains the gatekeeper.

**Minor additions:**
- Add `pending_graphrag` status to `write_status` table
- Add `graphrag_complete` status update method
- Add batch query: `SELECT * FROM ingestion_log WHERE graphrag_status = 'pending'`

```typescript
// New method in DuckDBClient (add ~20 lines)
async getDocumentsPendingGraphRAG(limit: number = 100): Promise<TextChunk[]> {
  return this.db.all(`
    SELECT id, content, source_name, ingested_at
    FROM ingestion_log
    WHERE graphrag_status = 'pending'
    ORDER BY ingested_at ASC
    LIMIT ?
  `, [limit]);
}

async markGraphRAGComplete(ids: string[]): Promise<void> {
  await this.db.run(`
    UPDATE ingestion_log
    SET graphrag_status = 'complete', graphrag_processed_at = CURRENT_TIMESTAMP
    WHERE id IN (${ids.map(() => '?').join(',')})
  `, ids);
}
```

### 2. Graphiti (Stays As-Is, Parallel to GraphRAG)

**Current state:** 752-line client with Python bridge
**What changes:** Simplify TS wrapper, but core functionality unchanged.

**Key principle:** Graphiti and MS GraphRAG extract entities INDEPENDENTLY. They write to DIFFERENT Neo4j databases:
- Graphiti → `temporal_memory` (temporal edges, episodes, contradictions)
- MS GraphRAG → `semantic_facts` (communities, static entity graph)

**They do NOT conflict** because they operate on different databases and extract different things:
- Graphiti extracts **temporal facts** (when things happened, what changed)
- MS GraphRAG extracts **structural relationships** (who is connected to whom, community structure)

**Simplification targets in graphiti-client.ts:**
- Remove manual entity extraction code (Graphiti does this internally)
- Remove manual Neo4j Cypher writes (Graphiti handles its own DB writes)
- Keep: Python bridge subprocess management, health checks, configuration
- Keep: Contradiction detection API (unique to Graphiti, not in GraphRAG)

```typescript
// Simplified Graphiti client (~200 lines)
class GraphitiClient {
  private bridge: PythonBridge;

  async extractTemporalFacts(text: string, metadata: EvidenceMetadata): Promise<TemporalResult> {
    // Graphiti handles: entity extraction, temporal edges, contradiction detection
    // All writes go to Neo4j temporal_memory database
    return this.bridge.call('graphiti.add_episode', {
      name: metadata.sourceName,
      episode_body: text,
      source: 'evidence_ingestion',
      reference_time: metadata.timestamp,
    });
  }

  async detectContradictions(entityName: string): Promise<Contradiction[]> {
    // Unique Graphiti capability — no GraphRAG equivalent
    return this.bridge.call('graphiti.get_contradictions', { entity: entityName });
  }

  async searchTemporalFacts(query: string, timeRange?: TimeRange): Promise<TemporalFact[]> {
    return this.bridge.call('graphiti.search', {
      query,
      start_date: timeRange?.start,
      end_date: timeRange?.end,
    });
  }
}
```

### 3. MS GraphRAG (NEW — Batch Pipeline)

**Integration approach:** Python subprocess via existing Python bridge pattern.

**Why not run directly in Node.js?** MS GraphRAG is a Python-only package. The existing `python-bridge.ts` pattern (subprocess management with JSON IPC) is the proven approach in this codebase.

**Configuration (`settings.yaml` for GraphRAG):**

```yaml
# Custody domain configuration
entity_extraction:
  entity_types:
    - person
    - communication
    - event
    - location
    - organization
    - legal_proceeding
  max_gleanings: 1  # Re-extraction pass, keep at 1 for cost

claim_extraction:
  enabled: true  # Maps to behavioral pattern detection
  description: "Claims about behavior, custody, parenting, substance use, mental health"

llm:
  api_base: http://localhost:11434/v1  # Ollama
  model: qwen2.5:14b
  type: openai_chat

embeddings:
  api_base: http://localhost:11434/v1
  model: nomic-embed-text
  type: openai_embedding

chunks:
  size: 1200
  overlap: 200

storage:
  type: file  # Parquet output
  base_dir: ./data/graphrag/output
```

**Python entry point (`server/python-tools/graphrag_pipeline.py`):**

```python
"""
MS GraphRAG batch pipeline for custody evidence.
Called via Python bridge from Node.js.

Flow:
1. Receive text chunks from DuckDB (via bridge)
2. Run GraphRAG indexing pipeline
3. Output parquet files to ./data/graphrag/output/
4. Import parquet → Neo4j semantic_facts (Cypher UNWIND)
5. Run entity resolution (k-NN + WCC + LLM)
6. Return summary to Node.js
"""
import graphrag
from graphrag.index import run_pipeline
# ... implementation
```

### 4. Neo4j GraphRAG Python (NEW — Retrieval Layer)

**Integration approach:** Python subprocess for retrieval queries.

**Key components to use:**
- `VectorRetriever` — Local search on entity description embeddings
- `VectorCypherRetriever` — Local search + Cypher graph traversal
- `ToolsRetriever` — Routes queries to appropriate retriever based on type

**Python entry point (`server/python-tools/graphrag_retriever.py`):**

```python
"""
Neo4j GraphRAG Python retrieval layer.
Called via Python bridge from Node.js.

Provides:
- Local search: entity-based retrieval with graph context
- Global search: community summary map-reduce
- Temporal search: delegates to Graphiti
"""
from neo4j_graphrag.retrievers import VectorCypherRetriever
from neo4j_graphrag.llm import OllamaLLM
# ... implementation
```

---

## Phased Implementation Plan

### Phase A: Foundation Wiring (Week 1-2)

**Goal:** Get the existing code actually running. Fix the two critical gaps.

| Task | Priority | Lines | Notes |
|---|---|---|---|
| Create `semantic_facts.ts` | P0 | ~80 | TrinityRouter imports it, file doesn't exist |
| Wire `TrinityRouter.initializeAll()` in `server/core/index.ts` | P0 | ~5 | Currently never called |
| Add `graphrag_status` column to DuckDB schema | P1 | ~10 | Needed for batch pipeline tracking |
| Verify DuckDB client actually initializes embedded DB | P1 | ~0 | Test existing code |
| Verify LanceDB client actually creates tables | P1 | ~0 | Test existing code |
| Verify Neo4j connection to Aura (or local) | P1 | ~0 | Test existing code |

**Success criteria:** `pnpm dev` starts, TrinityRouter initializes, DuckDB accepts ingestion.

### Phase B: Graphiti Integration (Week 2-3)

**Goal:** Get temporal memory working end-to-end.

| Task | Priority | Lines | Notes |
|---|---|---|---|
| Simplify `graphiti-client.ts` (752 → ~200) | P1 | -552 | Remove manual extraction, keep bridge |
| Verify Python bridge spawns graphiti-core process | P1 | ~0 | Test existing bridge code |
| Test: Ingest document → Graphiti extracts temporal facts | P1 | ~0 | End-to-end test |
| Test: Contradiction detection across two documents | P1 | ~0 | Core Graphiti feature |
| Wire Graphiti into TrinityRouter parallel fanout | P1 | ~20 | After DuckDB first-touch |

**Success criteria:** Document ingestion creates temporal edges in Neo4j `temporal_memory` database.

### Phase C: MS GraphRAG Batch Pipeline (Week 3-5)

**Goal:** Batch indexing pipeline producing parquet → imported into Neo4j.

| Task | Priority | Lines | Notes |
|---|---|---|---|
| Create `settings.yaml` with custody entity types | P1 | ~30 | Config file |
| Create `graphrag_pipeline.py` | P1 | ~150 | Python subprocess |
| Create parquet → Neo4j import script | P1 | ~50 | Cypher UNWIND batch |
| Add Python bridge endpoint for batch pipeline | P1 | ~30 | In python-bridge.ts |
| Test: 5 sample documents → GraphRAG → parquet → Neo4j | P1 | ~0 | End-to-end test |
| Add entity resolution post-import step | P2 | ~100 | k-NN + WCC + LLM |
| Test: Entity resolution merges "Matt"/"Matthew"/"Dad" | P2 | ~0 | Critical for custody |

**Success criteria:** Batch of documents produces communities in Neo4j `semantic_facts`, entities are resolved.

### Phase D: Retrieval Layer (Week 5-6)

**Goal:** Query routing across all three retrieval modes.

| Task | Priority | Lines | Notes |
|---|---|---|---|
| Create `graphrag_retriever.py` | P1 | ~100 | Python subprocess |
| Add Python bridge endpoints for local/global search | P1 | ~30 | In python-bridge.ts |
| Simplify TrinityRouter (388 → ~100) | P1 | -288 | Delegate to retrievers |
| Wire query routing: local → Neo4j GraphRAG, temporal → Graphiti | P1 | ~30 | In simplified TrinityRouter |
| Test: "What happened between Matt and [person] in 2020?" → local search | P1 | ~0 | |
| Test: "Summarize all custody-related communications" → global search | P1 | ~0 | |
| Test: "When did [person] change their story about X?" → Graphiti temporal | P1 | ~0 | |

**Success criteria:** Three query types route correctly and return results from correct backends.

### Phase E: Two-Pass Enrichment (Week 6-8)

**Goal:** Wire Pass 1 (blind ingestion) and Pass 2 (hindsight synthesis) using the integrated pipeline.

| Task | Priority | Lines | Notes |
|---|---|---|---|
| Pass 1: DuckDB first-touch + LanceDB embeddings + Graphiti temporal | P1 | ~50 | Real-time path |
| Pass 2: MS GraphRAG batch → communities → entity resolution | P1 | ~50 | Batch path |
| DuckDB: Track Pass 1 vs Pass 2 status per document | P1 | ~20 | Schema update |
| Claim extraction for behavioral patterns | P2 | ~30 | MS GraphRAG optional feature |
| Test: Full pipeline with 100 sample messages | P1 | ~0 | End-to-end validation |

**Success criteria:** Documents flow through both passes. Pass 1 captures immediate context, Pass 2 reveals longitudinal patterns.

---

## Query Routing Strategy (Simplified TrinityRouter)

```typescript
// Simplified TrinityRouter (~100 lines)
class TrinityRouter {
  private duckdb: DuckDBClient;         // First touch, always
  private lancedb: LanceDBClient;       // Embeddings, binaries
  private graphiti: GraphitiClient;     // Temporal memory
  private bridge: PythonBridge;         // For GraphRAG retrievers

  async ingestEvidence(data: EvidenceData): Promise<IngestionResult> {
    // Step 1: DuckDB FIRST (non-negotiable)
    const { ingestionId, sourceHash, isDuplicate } = await this.duckdb.firstTouch(data);
    if (isDuplicate) return { ingestionId, status: 'duplicate' };

    // Step 2: Parallel fanout (independent paths)
    const [lanceResult, graphitiResult] = await Promise.allSettled([
      this.lancedb.storeWithEmbedding(data, sourceHash),
      this.graphiti.extractTemporalFacts(data.content, data.metadata),
    ]);

    // Step 3: Mark as pending for batch GraphRAG
    await this.duckdb.markPendingGraphRAG(ingestionId);

    // Step 4: Write tracking
    return this.duckdb.recordWriteStatus(ingestionId, {
      lancedb: lanceResult.status === 'fulfilled',
      graphiti: graphitiResult.status === 'fulfilled',
      graphrag: 'pending',
    });
  }

  async query(question: string, type?: 'local' | 'global' | 'temporal'): Promise<QueryResult> {
    // Route to correct retriever based on query type
    switch (type ?? this.classifyQuery(question)) {
      case 'temporal':
        // "When did X change?" → Graphiti
        return this.graphiti.searchTemporalFacts(question);
      case 'global':
        // "Summarize all..." → MS GraphRAG global search
        return this.bridge.call('graphrag_retriever.global_search', { query: question });
      case 'local':
      default:
        // "What happened with X?" → Neo4j GraphRAG local search
        return this.bridge.call('graphrag_retriever.local_search', { query: question });
    }
  }

  private classifyQuery(question: string): 'local' | 'global' | 'temporal' {
    // Simple heuristic, can be upgraded to LLM-routed later
    if (/when|changed|before|after|timeline/i.test(question)) return 'temporal';
    if (/summarize|overall|all|pattern|trend/i.test(question)) return 'global';
    return 'local';
  }
}
```

---

## Neo4j Database Layout

```
Neo4j Instance
├── semantic_facts (database)
│   ├── __Entity__ nodes (from MS GraphRAG)
│   │   ├─ name, type, description, description_embedding
│   │   └─ human_readable_id, text_unit_ids
│   ├── __Chunk__ nodes (from MS GraphRAG)
│   │   ├─ text, chunk_id, n_tokens
│   │   └─ [:HAS_ENTITY] → __Entity__
│   ├── __Community__ nodes (from MS GraphRAG Leiden)
│   │   ├─ title, summary, full_content, level, rank, weight
│   │   └─ [:IN_COMMUNITY] ← __Entity__
│   ├── [:RELATED] edges (from MS GraphRAG)
│   │   └─ description, rank, weight
│   └── Vector Index: entity_description_embedding (768-dim)
│
└── temporal_memory (database)
    ├── Entity nodes (from Graphiti)
    │   └─ name, type, properties
    ├── Episode nodes (from Graphiti)
    │   ├─ content, source, reference_time
    │   └─ valid_at, invalid_at
    ├── Temporal edges (from Graphiti)
    │   ├─ relationship_type, properties
    │   └─ valid_at, invalid_at (temporal validity)
    └── Contradiction markers (from Graphiti)
        └─ Links conflicting facts with explanation
```

**Key insight:** The two databases are complementary, not redundant:
- `semantic_facts`: Static knowledge graph ("who knows whom, community structure")
- `temporal_memory`: Temporal knowledge graph ("what changed when, what contradicts what")

---

## Custody Domain Entity Types

For `GRAPHRAG_ENTITY_EXTRACTION_ENTITY_TYPES`:

| Entity Type | Examples | Why Important |
|---|---|---|
| `person` | Matt, Jessica, Judge Smith, GAL Johnson | Core actors in custody disputes |
| `communication` | text message, email, phone call, voicemail | Evidence artifacts |
| `event` | court hearing, visitation exchange, CPS visit | Timeline anchors |
| `location` | 123 Main St, Genesee County Courthouse, school | Context for events |
| `organization` | FOC, CPS, school district, therapist office | Institutional actors |
| `legal_proceeding` | Case #2024-FC-1234, motion to modify, PPO | Legal process tracking |

For `GRAPHRAG_CLAIM_EXTRACTION` (behavioral patterns):

| Claim Type | Maps To | MCL 722.23 Factor |
|---|---|---|
| Substance use allegation | Behavioral pattern | Factor (j) — domestic violence |
| Custody interference | Parental alienation | Factor (j) — willingness to facilitate |
| False allegation | DARVO pattern | Factor (l) — other relevant |
| Neglect claim | Neglect pattern | Factor (b) — capacity to provide |
| Coercive control | Manipulation pattern | Factor (c) — moral fitness |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ollama JSON malformed output | HIGH | Medium | Use `fast` NLP method for extraction, reserve LLM for summarization only |
| LanceDB version conflict | MEDIUM | High | Pin versions, test compatibility before upgrading |
| Neo4j GDS not available on Aura | MEDIUM | High | Check Aura tier; fall back to local Neo4j Community + GDS plugin |
| Entity resolution poor quality | MEDIUM | High | Start with strict word distance threshold, expand gradually |
| Graphiti + MS GraphRAG entity duplication | LOW | Low | Different databases, different entity types, no overlap |
| Cost explosion from LLM extraction | HIGH | Medium | Use `fast` method, batch small, monitor token usage |
| Python bridge subprocess crashes | LOW | High | Existing retry logic in python-bridge.ts, add health checks |

---

## Files to Create/Modify

### New Files
| File | Purpose | Lines |
|---|---|---|
| `server/mcp/storage/neo4j/semantic_facts.ts` | Neo4j GraphRAG Python bridge for retrieval | ~80 |
| `server/python-tools/graphrag_pipeline.py` | MS GraphRAG batch indexing pipeline | ~150 |
| `server/python-tools/graphrag_retriever.py` | Neo4j GraphRAG Python retrieval layer | ~100 |
| `server/python-tools/graphrag_import.py` | Parquet → Neo4j Cypher UNWIND import | ~50 |
| `server/python-tools/entity_resolution.py` | k-NN + WCC + LLM entity merge | ~100 |
| `data/graphrag/settings.yaml` | MS GraphRAG configuration | ~30 |

### Modified Files
| File | Change | Impact |
|---|---|---|
| `server/mcp/storage/systemRouter.ts` | Simplify from 388 → ~100 lines | Major refactor |
| `server/mcp/storage/graphiti-client.ts` | Simplify from 752 → ~200 lines | Major refactor |
| `server/mcp/python-bridge.ts` | Add 3 new endpoints (pipeline, retriever, import) | ~90 lines added |
| `server/mcp/storage/duckdb.ts` | Add graphrag_status tracking | ~30 lines added |
| `server/core/index.ts` | Wire TrinityRouter.initializeAll() | ~5 lines added |

### Unchanged Files
| File | Why Unchanged |
|---|---|
| `server/mcp/storage/lancedb.ts` | LanceDB role doesn't change with GraphRAG |
| `server/mcp/storage/neo4j/temporal_memory.ts` | Graphiti manages its own DB |
| `server/mcp/storage/index.ts` | Just re-exports, may need minor update |
| All plugin files (`server/mcp/plugins/*`) | Plugins consume storage, don't implement it |

---

## Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Ingestion: DuckDB first-touch latency | < 50ms | Timer in ingestEvidence() |
| Ingestion: Full parallel fanout (LanceDB + Graphiti) | < 2s | Timer on Promise.allSettled |
| Batch: 100 documents through MS GraphRAG pipeline | < 10 min | End-to-end batch timer |
| Retrieval: Local search response | < 3s | Timer on query() |
| Retrieval: Global search response | < 10s | Timer on query() (map-reduce) |
| Retrieval: Temporal search (Graphiti) | < 2s | Timer on searchTemporalFacts() |
| Entity resolution: Precision | > 90% | Manual review of merge decisions |
| Custom code reduction | ~35% | Line count before/after |
| Community detection: Meaningful clusters | > 5 communities from 100 docs | Neo4j query |

---

## Dependencies & Prerequisites

| Dependency | Required For | Status |
|---|---|---|
| Python 3.12+ | MS GraphRAG, Neo4j GraphRAG Python, Graphiti | Need to verify |
| Neo4j 5.x+ | Graph storage | Existing (Aura) |
| Neo4j GDS plugin | Leiden community detection, WCC entity resolution | Need to verify Aura tier |
| Ollama | LLM + embeddings | Existing |
| nomic-embed-text | 768-dim embeddings | Existing |
| qwen2.5:14b | Entity extraction, claim extraction, summarization | Existing |
| graphrag v3.0.5 | Batch indexing pipeline | `pip install graphrag` |
| neo4j-graphrag-python v1.5.0 | Retrieval layer | `pip install neo4j-graphrag` |
| graphiti-core | Temporal memory | Existing (~40% integrated) |
| spaCy + en_core_web_sm | `fast` NLP extraction method | `pip install spacy && python -m spacy download en_core_web_sm` |
| NLTK data | Tokenization for GraphRAG | `python -c "import nltk; nltk.download('punkt_tab')"` |

---

**Last Updated:** February 28, 2026
**Status:** Draft — awaiting user review
**Next:** User approval → Phase A implementation
