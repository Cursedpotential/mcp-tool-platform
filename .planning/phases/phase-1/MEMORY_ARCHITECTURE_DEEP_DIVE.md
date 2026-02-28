# Memory Architecture Deep Dive — Extracted from Perplexity Analysis

**Source:** `docs/[https___github.com_Hawksight-AI_semantica](https_.md` (lines 920-1350+)  
**Date:** February 26, 2026  
**Focus:** Memory tiers, domain separation, gotchas, and workflows

---

## Executive Summary

The Perplexity conversation refined a **6-tier memory architecture** using PostgreSQL/pgvector as the "spine" with Semantica as the semantic/graph brain. This is NOT the same as the 4-tier or 5-tier designs in other documents — this is the final iteration with explicit domain separation and workflow patterns.

**Core Principle:** PostgreSQL is the single source of truth for structured data; Semantica provides the semantic/temporal reasoning layer on top; Directus serves as the admin/bulk-ingest portal.

---

## The 6 Memory Tiers — Domain Separation

### Tier 1: Short-Term / Working Memory (Per Session)

**What it is:** Ephemeral session state during active agent interactions  
**Storage:** PostgreSQL + optional Redis for ultra-ephemeral streaming  
**Schema:**
```sql
agent_sessions(id, user_id, case_id, started_at, last_active_at, summary)
session_messages(id, session_id, role, text, tool_calls_json, created_at)
```

**Domain:**
- Chat history within a single session
- Tool call sequences
- Temporary context that hasn't been persisted to long-term memory
- Streaming state (Redis) with periodic snapshots to PG

**Integration with Semantica:**
- Register key messages/decisions in Semantica via `AgentContext.store(...)`
- Query via: `VectorStore` similarity over "recent messages" collection
- Query via: Graph queries over "conversation episode" subgraph

**Gotcha:** "Also continue using Redis/queue for ultra‑ephemeral state and streaming; periodically snapshot key sessions into PG / Semantica when important."
- **Risk:** Data loss if session crashes before snapshot
- **Mitigation:** Automatic snapshot on tool completion, manual checkpoint triggers

---

### Tier 2: Episodic Memory (Raw Events)

**What it is:** Immutable record of everything that happened  
**Storage:** PostgreSQL `raw_events` table  
**Schema:**
```sql
raw_events(
  id, case_id, source_type, source_path, 
  sender, participants, text, 
  event_time, ingested_at,  -- BITEMPORAL
  hash, provenance_json
)
```

**Domain:**
- Raw emails, messages, filings, imports
- Complete audit trail with SHA-256 hashes
- Chain of custody for forensic evidence
- "Event time T vs ingestion time T′" — critical for legal timelines

**Integration with Semantica:**
- Semantica ingests from `raw_events` via: `semantica_ingest_episodes(case_id)`
- Creates **episode subgraph** — time-ordered, provenance-rich history
- Episode nodes mirror PG records with temporal properties

**Gotcha:** "Every significant event lands in raw_events with full metadata and bitemporal timestamps."
- **Critical:** Must preserve both timestamps for contradiction detection
- **Example:** Message sent at 2pm (event_time) but imported at 5pm (ingested_at)
- **Use case:** "Show me all messages from before the court filing" (event_time) vs "Show me what we knew at 3pm" (ingested_at)

---

### Tier 3: Semantic Memory (Entities, Relationships, Decisions)

**What it is:** What the system believes about the world  
**Storage:** Semantica graph + PostgreSQL mapping tables  
**Pattern:** Episode → Knowledge Graph (from Semantica cookbook)

**Domain:**
- Extracted entities (people, places, organizations)
- Relationships between entities (MENTIONED_IN, SENT_BY, RELATES_TO)
- **Decisions as first-class nodes:** "X constitutes coercive control"

**Schema (PostgreSQL mapping tables):**
```sql
entities(id, semantica_id, case_id, type, key_props..., first_seen_at, last_seen_at)
relationships(
  id, semantica_id, from_entity, to_entity, relation_type, 
  valid_from, valid_to, created_at, updated_at
)
```

**Integration workflow:**
1. Extract entities/relationships from episodes
2. Insert into Semantica `ContextGraph` with properties: `created_at`, `last_updated`, validity fields
3. Decision nodes link to:
   - Evidence nodes (events, documents) that support them
   - Agents/humans who made/approved them
   - Quality/strength/confidence scores

**Gotcha:** "Treat major inferences/decisions as first‑class graph nodes"
- **Critical:** Don't just store as edge properties — decisions change, evidence evolves
- **Pattern:** Each decision node has temporal validity and can be superseded
- **Example:** "Coercive control finding v1" (confidence 0.6) → "Coercive control finding v2" (confidence 0.9, new evidence)

---

### Tier 4: Vector Memory (Semantic Search, RAG)

**What it is:** Embeddings for similarity search  
**Storage:** PostgreSQL pgvector (`segment_embeddings` table)  
**Schema:**
```sql
segments(id, case_id, content, source_doc_id, page, section, context_metadata)
segment_embeddings(
  id, segment_id, embedding vector(768),
  case_id, event_time, labels, entity_refs
)
```

**Domain:**
- Normalized chunks from Docling (with page/section/context)
- Semantic search over case content
- **Always combined with metadata filters** (case_id, time range, entity filters)

**Integration with Semantica:**
- `VectorStore` backed by pgvector (thin wrapper)
- **Same embeddings** used by both Semantica and custom tools
- IDs from PG stored in Semantica nodes as external references

**Gotcha:** "Always combine vector similarity with metadata filters"
- **Anti-pattern:** Pure vector search across all cases
- **Pattern:** Vector search WHERE case_id = X AND event_time BETWEEN Y AND Z
- **Why:** Prevents cross-case contamination, respects temporal boundaries

**RAG Best Practice (from Tessell/Tiger/EDB posts):**
```sql
SELECT content, embedding <=> query_embedding AS distance
FROM segment_embeddings
WHERE case_id = 'current_case'
  AND event_time BETWEEN '2024-01-01' AND '2024-12-31'
  AND labels @> ARRAY['coercive_control']
ORDER BY distance
LIMIT 10;
```

---

### Tier 5: Community / Global Memory (Clusters, Summaries)

**What it is:** Higher-level patterns and summaries  
**Storage:** PostgreSQL + Semantica community subgraphs  
**Schema:**
```sql
clusters(
  id, semantica_id, case_id, label, 
  summary_embedding, summary_text, time_span,
  entity_count, event_count
)
```

**Domain:**
- Clusters of related entities/events (Zep-style clustering)
- Long-horizon summaries per case, per party
- Life phases, behavioral shifts, recurring themes
- "What was the pattern of communication in 2019 vs 2023?"

**Generation:**
- Semantica (and/or Zep-style clustering) maintains community subgraphs
- Periodic background jobs or triggered on case milestone
- **Not real-time** — expensive computation

**Gotcha:** "Clustered semantics and longer‑horizon summaries per case"
- **Frequency:** Daily/weekly batch, not per-ingestion
- **Storage:** Both in Semantica graph AND PG for easy querying
- **Use case:** "Summarize the custody dispute pattern" (requires community memory, not individual events)

---

### Tier 6: Human-in-the-Loop Edits

**What it is:** Corrections, labels, annotations from human review  
**Storage:** PostgreSQL `human_annotations` table  
**Schema:**
```sql
human_annotations(
  id, case_id, 
  target_type, target_id,  -- references events/entities/edges
  annotation_type,         -- 'correction', 'label', 'review', 'dispute'
  annotation_data,         -- JSON with changes
  user_id, created_at
)
```

**Domain:**
- Fact corrections ("This summary mislabels person A")
- Pattern reclassifications ("Mark as coercive control, not neutral")
- Review outcomes (approved/rejected detections)
- Disputes (conflicting interpretations)

**Integration workflow:**
1. Edits via CopilotKit + MCP Apps land in `human_annotations`
2. Async job triggers Semantica updates:
   - Re-classification of entities
   - Edge invalidation (superseded by human input)
   - Quality score adjustments
3. Propagates to downstream GraphRAG (higher confidence)

**Gotcha:** "Trigger Semantica updates via async job"
- **Don't block UI** on graph updates — queue and process
- **Audit trail:** Keep both original AI inference AND human correction as separate nodes
- **Conflict resolution:** Human annotation > AI inference in quality scoring

---

## System Integration — How the Pieces Fit

### Data Flow Overview

```
┌─────────────────────────────────────────────────────────────┐
│  INGESTION                                                  │
│  Raw files → Docling → normalized segments                  │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│  POSTGRESQL (The Spine)                                     │
│  ├─ raw_events        ← Immutable event log                 │
│  ├─ segments          ← Normalized chunks                   │
│  ├─ segment_embeddings← pgvector for RAG                    │
│  ├─ entities          ← Mapping to Semantica IDs            │
│  ├─ relationships     ← Temporal validity tracking          │
│  ├─ clusters          ← Community summaries                 │
│  ├─ human_annotations ← HITL edits                          │
│  └─ agent_sessions    ← Short-term memory                   │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│  SEMANTICA (The Brain)                                      │
│  ├─ Episode subgraph    ← Mirrors raw_events                │
│  ├─ Semantic subgraph   ← Entities, relationships, decisions│
│  ├─ Community subgraph  ← Clusters, summaries               │
│  └─ ContextGraph        ← For GraphRAG queries              │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│  QUERY / AGENT LAYER                                        │
│  ├─ GraphRAG: semantic + temporal reasoning                 │
│  ├─ Vector search: similarity + metadata filters            │
│  └─ HITL: CopilotKit with MCP Apps                          │
└─────────────────────────────────────────────────────────────┘
```

### Key Integration Patterns

**1. ID Mirroring (Critical for Joins)**
- PostgreSQL tables have `semantica_id` column
- Semantica nodes have `pg_id` property
- Enables: `SELECT * FROM entities WHERE semantica_id IN (...)`

**2. Bitemporal Timestamps (Everywhere)**
- `event_time`: When it actually happened (for legal timeline)
- `ingested_at`: When system learned about it (for knowledge state)
- Use case: "What did we know before the hearing?" (ingested_at < hearing_date)

**3. Async Ingestion Pipeline**
```
File Upload → Directus (bulk ingest) → PG raw_events 
     → Semantica ingest job (queued) 
     → Episode subgraph 
     → Entity extraction 
     → Semantic subgraph 
     → Vector embedding (pgvector)
```

**4. Quality-Aware Reasoning**
Every node/edge in Semantica has quality attributes:
- Source type: `court_order` > `sworn_testimony` > `text_message` > `hearsay`
- Review state: `human_verified` > `ai_confident` > `ai_low_confidence`
- Confidence score: 0.0-1.0

GraphRAG prefers high-quality edges; conflicting low-quality edges surface for HITL.

---

## Critical Gotchas and Design Decisions

### 1. Temporal Classification (from OpenAI Cookbook)

Every fact in the graph must be classified:
- **Atemporal:** Always true (e.g., "Person X is the biological father")
- **Static:** True for a period (e.g., "Lived at 123 Main St from Jan-Mar 2024")
- **Dynamic:** Changes frequently (e.g., "Current emotional state")

**Implementation:**
```python
semantica_upsert_fact(
  subject="Person X",
  predicate="resides_at",
  object="123 Main St",
  event_time="2024-01-15",
  validity="static",
  classification="verified"
)
```

**Gotcha:** "Invalidates or supersedes older edges when appropriate"
- Dynamic facts: Old edge gets `valid_to` timestamp
- Static facts: Keep both with date ranges
- Atemporal facts: Never invalidate

### 2. Superseding vs. Updating

**Pattern from Semantica:**
- Don't overwrite nodes — create new version
- Link: `new_version SUPERSEDES old_version`
- Preserve full audit trail for legal defensibility

**Example:**
```
[CoerciveControl_Finding_v1] --SUPERSEDED_BY--> [CoerciveControl_Finding_v2]
     ↑                                                    ↑
[Evidence_A, Evidence_B]                        [Evidence_A, Evidence_B, Evidence_C]
```

### 3. Vector + Graph Hybrid Queries

**Don't do:**
- Pure vector search (loses temporal/relational context)
- Pure graph traversal (misses semantic similarity)

**Do:**
1. Vector search with metadata filters (candidate chunks)
2. Expand to graph neighborhood (entities, related facts)
3. Rank by quality + recency + relevance

### 4. Directus as Portal (Not Primary Storage)

**Correct usage:**
- Directus points at same PG instance
- Bulk file ingest via Directus web UI
- Directus AI flows call MCP-tool-platform → Docling → PG
- Review UI for `raw_events`, `entities`, `human_annotations`

**Incorrect usage:**
- Treating Directus as separate database
- Storing evidence only in Directus (must be in PG spine)

### 5. Semantica Integration Strategy

**Recommended (from conversation):**
```
Semantica as Python service
  ├─ HTTP/gRPC endpoints
  ├─ MCP server wrapper
  └─ Reads/writes to PG spine via IDs
```

**Not recommended:**
- Direct SQL integration (bypasses Semantica's governance)
- Multiple writers to graph (race conditions, conflicts)

---

## Workflow Examples

### Workflow 1: Ingest New Message Export

```
1. Upload XML via Directus or Portal
   ↓
2. Docling parses → normalized segments with bboxes
   ↓
3. Write to PG:
   - raw_events (one per message, with hash)
   - segments (chunks with metadata)
   - segment_embeddings (pgvector)
   ↓
4. Queue Semantica ingest job
   ↓
5. Semantica:
   - Create episode subgraph from raw_events
   - Extract entities/relationships
   - Update semantic subgraph
   - Mark job complete
   ↓
6. Ready for GraphRAG queries
```

### Workflow 2: Human Correction

```
1. User reviews AI finding in CopilotKit UI
   ↓
2. User marks: "Not coercive control, mislabeled"
   ↓
3. Write to human_annotations table
   ↓
4. Trigger async job:
   - Create correction node in Semantica
   - Link: correction CORRECTS original_finding
   - Update quality scores
   - Invalidate downstream inferences
   ↓
5. Future GraphRAG uses corrected version
   ↓
6. Audit trail preserved (both versions exist)
```

### Workflow 3: Temporal Query

```
Question: "What was the custody arrangement on March 15, 2024?"

1. Graph query in Semantica:
   MATCH (c:CustodyArrangement)
   WHERE c.valid_from <= '2024-03-15'
     AND (c.valid_to IS NULL OR c.valid_to >= '2024-03-15')
   RETURN c

2. Verify evidence:
   MATCH (c)-[:BASED_ON]->(e:Evidence)
   RETURN e.source, e.confidence

3. Return:
   - Current arrangement at that date
   - Evidence supporting it
   - Confidence/quality scores
```

---

## Migration from Current Architecture

### Current State (what exists)
- Chroma working memory (72hr TTL) — ✅ working
- PostgreSQL/pgvector — ✅ partially implemented
- Neo4j + Graphiti — ⚠️ stub only
- MySQL (Drizzle) — ✅ for app metadata
- Supabase — ✅ for final storage

### Target State (this design)
- **PostgreSQL as spine** (replaces Supabase for messages)
- **Semantica** (replaces custom graph code)
- **Dual Neo4j** (optional: semantic_facts vs temporal_memory)
- **DuckDB** (analytical queries — NOT in this Perplexity iteration)
- **LanceDB** (multimodal vault — NOT in this Perplexity iteration)

### Migration Path

**Phase 1:** Consolidate on PG spine
- Move messaging tables from Supabase to local PG
- Add bitemporal timestamps to all event tables
- Create mapping tables for Semantica IDs

**Phase 2:** Semantica integration
- Deploy Semantica Python service
- Implement episode ingestion pipeline
- Migrate entity extraction from custom code to Semantica

**Phase 3:** HITL workflow
- Integrate CopilotKit
- Implement human_annotations table
- Build review UI in Directus

**Phase 4:** Advanced features (optional)
- DuckDB for analytical queries (if needed)
- LanceDB for multimodal (if needed)
- Community clustering for long-term patterns

---

## Key Takeaways

1. **PostgreSQL is the spine** — everything else references it by ID
2. **Bitemporal timestamps are mandatory** — event_time vs ingested_at
3. **Semantica is the brain** — temporal reasoning, GraphRAG, quality-aware
4. **6 tiers, explicit domains** — don't mix concerns
5. **Async pipelines** — don't block UI on graph updates
6. **Quality attributes on everything** — source type, review state, confidence
7. **Human edits are first-class** — separate nodes, linked to originals
8. **Supersede, don't overwrite** — full audit trail for legal defensibility

---

## References to Source Material

**Lines 920-1019:** Postgres/pgvector as spine, 6 memory tiers end-to-end  
**Lines 1262-1307:** Memory tiers using Semantica patterns  
**Lines 1328-1349:** Temporal awareness using only Semantica patterns  
**Footnotes [^4_1] through [^4_22]:** Zep/Graphiti, OpenAI cookbooks, RAG best practices  
**Footnotes [^6_1] through [^6_12]:** Semantica cookbooks, integration patterns

---

**Document Status:** Extracted from Perplexity conversation for Phase 1 planning  
**Next Step:** Reconcile with integrated-architecture-blueprint.md (which has DuckDB/LanceDB) to determine final architecture
