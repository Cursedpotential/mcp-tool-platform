# Gap Analysis & Critical Priorities

**Last Updated:** February 1, 2026
**Status:** 🚨 BLOCKING - Nothing else gets done until these are complete
**Priority Level:** CRITICAL - Core system functionality depends on these

---

## ⚠️ STOP - Read This First

**This document contains the MOST CRITICAL gaps** in the MCP Tool Platform. These are not optional enhancements - they are **required for the system to function as designed**.

**RULE:** Do not work on any other features, refactoring, or improvements until ALL Priority 1 items are complete and tested.

---

## 🎯 The Problem

The current system is **incomplete** in three critical areas:

1. **PGVector is implemented but not integrated** - Semantic search exists but isn't wired to TrinityRouter
2. **Graphiti is not exposed as MCP memory tools** - AI agents can't use the knowledge graph for context
3. **Network analysis capabilities are missing** - Can't discover patterns, communities, or relationships

These gaps prevent the system from being a true **Zep AI clone** and limit its forensic analysis capabilities.

---

## 📊 Priority 1: CRITICAL (Must Complete First)

### Gap 1.1: Integrate PGVector into TrinityRouter ⚠️

**Status:** 🔴 BLOCKING
**Impact:** Semantic search (RAG) is non-functional
**Effort:** 4-6 hours

**Current State:**
- ✅ PGVector SQL schema exists (`server/mcp/loaders/pgvector-setup.sql`)
- ✅ `match_embeddings()` function implemented
- ❌ TrinityRouter only uses ChromaDB (72hr TTL)
- ❌ No permanent semantic search tier

**Problem:**
```typescript
// Current flow (BROKEN):
Evidence → ChromaDB (72hr) → [EXPIRES] → Data lost for RAG ❌

// Should be:
Evidence → ChromaDB (working memory) → PGVector (permanent) ✅
```

**What Needs to Be Done:**

**File:** `server/mcp/storage/systemRouter.ts`

1. Add pgvector tier to `storeEvidence()`:
```typescript
// After ChromaDB storage (line ~200):

// --- TIER 3: PERMANENT SEMANTIC SEARCH (PGVECTOR) ---
try {
  // After meta-analysis is complete, store in pgvector
  if (payload.metadata.analysisComplete) {
    await this.pgClient`
      INSERT INTO embeddings (id, document_id, chunk_id, embedding, text, metadata)
      VALUES (
        ${chromaId},
        ${result.postgresId},
        ${chromaId},
        ${embedding}::vector,
        ${payload.content},
        ${payload.metadata}
      )
    `;
    result.pgvectorId = chromaId;
  }
} catch (err: any) {
  result.errors?.push({ system: 'pgvector', message: err.message });
}
```

2. Add pgvector routing to `query()` method:
```typescript
case 'semantic':
  // First check ChromaDB (working memory)
  const chromaResults = await this.chroma.search(params.query, params.limit);

  // Then query pgvector (permanent storage)
  const pgResults = await this.pgClient`
    SELECT * FROM match_embeddings(
      ${queryEmbedding}::vector,
      0.7, -- threshold
      ${params.limit || 10},
      ${params.caseId}
    )
  `;

  // Merge and deduplicate results
  return mergeResults(chromaResults, pgResults);
```

3. Add migration from Chroma to pgvector:
```typescript
// Scheduled job (runs every 24 hours)
async migrateChromaToVector(): Promise<void> {
  // Find Chroma embeddings older than 48 hours
  const oldEmbeddings = await this.chroma.getExpiring(48);

  // Move to pgvector for permanent storage
  for (const emb of oldEmbeddings) {
    await this.pgClient`
      INSERT INTO embeddings (...)
      VALUES (...)
      ON CONFLICT (chunk_id) DO NOTHING
    `;
  }

  // Chroma will auto-delete at 72hr TTL
}
```

**Acceptance Criteria:**
- [ ] Evidence embeddings stored in both Chroma (temp) and pgvector (permanent)
- [ ] Semantic queries search both tiers
- [ ] Migration job moves Chroma → pgvector before TTL expiration
- [ ] Test query returns results from pgvector after 72+ hours

**Estimated Time:** 4-6 hours

---

### Gap 1.2: Expose Graphiti as MCP Memory Tools ⚠️

**Status:** 🔴 BLOCKING
**Impact:** AI agents can't use knowledge graph for context
**Effort:** 6-8 hours

**Current State:**
- ✅ Graphiti client exists (`server/mcp/storage/graphiti-client.ts`)
- ✅ Used internally by TrinityRouter
- ❌ NOT exposed as MCP tools
- ❌ AI chatbots can't access conversational memory

**Problem:**
Graphiti serves **two purposes** but only one is implemented:
1. ✅ Evidence temporal relationships (implemented)
2. ❌ AI chatbot context memory (NOT exposed via MCP)

**What Needs to Be Done:**

**File:** `server/mcp/plugins/graphiti-memory.ts` (NEW)

Create MCP tools that wrap Graphiti client:

```typescript
/**
 * Graphiti Memory Plugin - MCP Tools for AI Chatbot Context
 *
 * Exposes Graphiti knowledge graph as memory tools for AI agents.
 * Implements Zep AI conversational memory pattern.
 */

export async function addMemory(args: {
  content: string;
  userId?: string;
  agentId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}): Promise<{ memoryId: string; entities: string[]; facts: string[] }> {
  // 1. Extract entities from content using LLM
  const entities = await extractEntities(args.content);

  // 2. Store in Graphiti
  await graphitiClient.storeEntities(entities.map(e => ({
    id: crypto.randomUUID(),
    type: e.type,
    name: e.name,
    properties: {
      ...e.properties,
      user_id: args.userId,
      agent_id: args.agentId,
      session_id: args.sessionId,
      valid_from: new Date().toISOString()
    }
  })));

  // 3. Create relationships
  const relationships = inferRelationships(entities, args.content);
  await graphitiClient.storeRelationships(relationships);

  return {
    memoryId: crypto.randomUUID(),
    entities: entities.map(e => e.id),
    facts: relationships.map(r => r.id)
  };
}

export async function searchMemory(args: {
  query: string;
  userId?: string;
  agentId?: string;
  sessionId?: string;
  limit?: number;
  asOfDate?: string; // Temporal awareness
}): Promise<{
  entities: Entity[];
  relationships: Relationship[];
  relevanceScore: number;
}[]> {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(args.query);

  // 2. Search pgvector for relevant chunks
  const semanticMatches = await pgClient`
    SELECT * FROM match_embeddings(
      ${queryEmbedding}::vector,
      0.7,
      ${args.limit || 10}
    )
  `;

  // 3. Get entities mentioned in matched chunks
  const entityIds = semanticMatches.map(m => m.metadata.entities).flat();

  // 4. Query Graphiti for entity context (temporal)
  const results = await graphitiClient.runQuery(`
    MATCH (e:Entity)
    WHERE e.id IN $entityIds
      AND e.user_id = $userId
      AND ($asOfDate IS NULL OR e.valid_from <= $asOfDate)
    MATCH (e)-[r]->(e2)
    RETURN e, r, e2
  `, { entityIds, userId: args.userId, asOfDate: args.asOfDate });

  return results;
}

export async function getTimeline(args: {
  entityId: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  entity: Entity;
  events: Array<{
    timestamp: string;
    type: string;
    description: string;
    relatedEntities: Entity[];
  }>;
}> {
  // Query temporal graph for entity timeline
  const timeline = await graphitiClient.runQuery(`
    MATCH (e:Entity {id: $entityId})
    MATCH (e)-[r]-(e2)
    WHERE r.timestamp >= $startDate
      AND r.timestamp <= $endDate
    RETURN e, r, e2, r.timestamp
    ORDER BY r.timestamp ASC
  `, { entityId: args.entityId, startDate: args.startDate, endDate: args.endDate });

  return formatTimeline(timeline);
}

export async function detectContradictions(args: {
  entityId: string;
  timeWindow?: { start: string; end: string };
}): Promise<{
  contradictions: Array<{
    fact1: { text: string; timestamp: string; sourceRef: string };
    fact2: { text: string; timestamp: string; sourceRef: string };
    conflictType: 'temporal' | 'factual' | 'relationship';
    explanation: string;
  }>;
}> {
  // Find conflicting facts about the same entity
  const facts = await graphitiClient.runQuery(`
    MATCH (e:Entity {id: $entityId})-[r:HAS_PROPERTY]->(p:Property)
    WHERE r.timestamp >= $start AND r.timestamp <= $end
    WITH p.name AS property,
         COLLECT({value: p.value, timestamp: r.timestamp, source: r.sourceRef}) AS values
    WHERE SIZE(values) > 1
    RETURN property, values
  `, { entityId: args.entityId, ...args.timeWindow });

  return analyzeContradictions(facts);
}

export async function shareContext(args: {
  fromAgentId: string;
  toAgentId: string;
  query: string;
  limit?: number;
}): Promise<{ sharedMemories: any[] }> {
  // Search memories from source agent
  const memories = await searchMemory({
    query: args.query,
    agentId: args.fromAgentId,
    limit: args.limit
  });

  // Create references for target agent
  for (const memory of memories) {
    await graphitiClient.runQuery(`
      MATCH (e:Entity) WHERE e.id IN $entityIds
      MERGE (a:Agent {id: $toAgentId})
      MERGE (a)-[:CAN_ACCESS]->(e)
    `, { entityIds: memory.entities.map(e => e.id), toAgentId: args.toAgentId });
  }

  return { sharedMemories: memories };
}
```

**File:** `server/mcp/workers/executor.ts`

Register MCP tool handlers:

```typescript
// Add after line 696 (after n8n tools)

this.registerHandler("graphiti.add_memory", async args => {
  const { addMemory } = await import("../plugins/graphiti-memory");
  return addMemory(args as {
    content: string;
    userId?: string;
    agentId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  });
});

this.registerHandler("graphiti.search_memory", async args => {
  const { searchMemory } = await import("../plugins/graphiti-memory");
  return searchMemory(args as {
    query: string;
    userId?: string;
    agentId?: string;
    limit?: number;
    asOfDate?: string;
  });
});

this.registerHandler("graphiti.get_timeline", async args => {
  const { getTimeline } = await import("../plugins/graphiti-memory");
  return getTimeline(args as {
    entityId: string;
    startDate?: string;
    endDate?: string;
  });
});

this.registerHandler("graphiti.detect_contradictions", async args => {
  const { detectContradictions } = await import("../plugins/graphiti-memory");
  return detectContradictions(args as {
    entityId: string;
    timeWindow?: { start: string; end: string };
  });
});

this.registerHandler("graphiti.share_context", async args => {
  const { shareContext } = await import("../plugins/graphiti-memory");
  return shareContext(args as {
    fromAgentId: string;
    toAgentId: string;
    query: string;
    limit?: number;
  });
});
```

**Acceptance Criteria:**
- [ ] MCP tools registered: `graphiti.add_memory`, `search_memory`, `get_timeline`, `detect_contradictions`, `share_context`
- [ ] AI agents can store conversational context in knowledge graph
- [ ] AI agents can retrieve relevant context based on queries
- [ ] Temporal queries work ("what did Alice say about X in 2023?")
- [ ] Contradiction detection finds conflicting facts
- [ ] Agents can share context with each other

**Estimated Time:** 6-8 hours

---

### Gap 1.3: Implement Contradiction Detection ⚠️

**Status:** 🔴 BLOCKING
**Impact:** Core Zep AI feature missing
**Effort:** 4 hours

**Current State:**
- ✅ Mentioned in docs
- ❌ Not implemented in code
- ❌ No detection logic exists

**What Needs to Be Done:**

Implement the `detectContradictions()` function from Gap 1.2 above, plus:

**File:** `server/mcp/storage/graphiti-client.ts`

Add contradiction detection method:

```typescript
async detectEntityContradictions(
  entityId: string,
  timeWindow?: { start: string; end: string }
): Promise<Contradiction[]> {
  const query = `
    // Find all properties of this entity over time
    MATCH (e:Entity {id: $entityId})-[r:HAS_PROPERTY]->(p:Property)
    WHERE ($start IS NULL OR r.timestamp >= $start)
      AND ($end IS NULL OR r.timestamp <= $end)
    WITH p.name AS propertyName,
         COLLECT({
           value: p.value,
           timestamp: r.timestamp,
           sourceRef: r.sourceRef,
           confidence: r.confidence
         }) AS values
    WHERE SIZE(values) > 1

    // Detect conflicts
    UNWIND values AS v1
    UNWIND values AS v2
    WHERE v1.timestamp < v2.timestamp
      AND v1.value <> v2.value
    RETURN propertyName, v1, v2
  `;

  const results = await this.runQuery(query, {
    entityId,
    start: timeWindow?.start,
    end: timeWindow?.end
  });

  return results.map(r => ({
    propertyName: r.propertyName,
    earlierValue: r.v1,
    laterValue: r.v2,
    conflictType: classifyConflict(r.v1.value, r.v2.value),
    timeDelta: calculateTimeDelta(r.v1.timestamp, r.v2.timestamp)
  }));
}
```

**Acceptance Criteria:**
- [ ] Detects temporal contradictions (same property, different values over time)
- [ ] Detects factual contradictions (conflicting statements)
- [ ] Returns evidence sources for both conflicting facts
- [ ] Calculates confidence scores

**Estimated Time:** 4 hours

---

## 📊 Priority 2: HIGH VALUE (Complete After P1)

### Gap 2.1: Add Network Analysis - Community Detection

**Status:** 🟡 High Value
**Impact:** Can't discover entity clusters or social groups
**Effort:** 6-8 hours

**What's Missing:**
- Louvain algorithm for community detection
- Label propagation
- Connected components

**Implementation:**

**File:** `server/mcp/plugins/graph-analytics.ts` (NEW)

```typescript
export async function detectCommunities(args: {
  caseId: string;
  algorithm: 'louvain' | 'label_propagation' | 'connected_components';
  minSize?: number;
}): Promise<{
  communities: Array<{
    id: string;
    members: Entity[];
    size: number;
    density: number;
  }>;
}> {
  // Use Neo4j GDS library
  const query = `
    CALL gds.louvain.stream({
      nodeProjection: 'Entity',
      relationshipProjection: {
        RELATES_TO: {
          orientation: 'UNDIRECTED'
        }
      },
      includeIntermediateCommunities: false
    })
    YIELD nodeId, communityId
    WITH communityId, COLLECT(nodeId) AS members
    WHERE SIZE(members) >= $minSize
    RETURN communityId, members
  `;

  // Execute and format results
  return formatCommunities(await graphitiClient.runQuery(query, args));
}
```

**Estimated Time:** 6-8 hours

---

### Gap 2.2: Add Centrality Measures

**Status:** 🟡 High Value
**Impact:** Can't identify influential entities or bridge nodes
**Effort:** 6 hours

**What's Missing:**
- PageRank (influence scoring)
- Betweenness centrality (bridge detection)
- Degree centrality (connection counts)

**Implementation:**

```typescript
export async function calculateCentrality(args: {
  caseId: string;
  measure: 'pagerank' | 'betweenness' | 'degree' | 'eigenvector';
  topK?: number;
}): Promise<{
  rankings: Array<{
    entity: Entity;
    score: number;
    rank: number;
  }>;
}> {
  const query = `
    CALL gds.pageRank.stream({
      nodeProjection: 'Entity',
      relationshipProjection: 'RELATES_TO'
    })
    YIELD nodeId, score
    RETURN nodeId, score
    ORDER BY score DESC
    LIMIT $topK
  `;

  return formatRankings(await graphitiClient.runQuery(query, args));
}
```

**Estimated Time:** 6 hours

---

### Gap 2.3: Entity Resolution & Deduplication

**Status:** 🟡 High Value
**Impact:** Can't merge duplicate entities (same person, different names)
**Effort:** 8 hours

**What's Missing:**
- Fuzzy name matching
- Entity merging
- Alias detection

**Implementation:**

```typescript
export async function findDuplicateEntities(args: {
  caseId: string;
  similarityThreshold: number;
}): Promise<{
  duplicates: Array<{
    entities: Entity[];
    similarity: number;
    suggestedMerge: boolean;
  }>;
}> {
  // Use string similarity + property matching
  const query = `
    MATCH (e1:Entity), (e2:Entity)
    WHERE e1.id < e2.id
      AND e1.type = e2.type
      AND gds.alpha.similarity.cosine(e1.name, e2.name) > $threshold
    RETURN e1, e2, similarity
  `;

  return await graphitiClient.runQuery(query, args);
}

export async function mergeEntities(args: {
  primaryId: string;
  duplicateIds: string[];
}): Promise<{ mergedEntity: Entity }> {
  // Merge duplicate entities into primary
  // Transfer all relationships to primary
  // Mark duplicates as merged
}
```

**Estimated Time:** 8 hours

---

## 📊 Priority 3: ADVANCED (Complete After P2)

### Gap 3.1: Temporal Pattern Analysis
- Detect repeating temporal patterns
- Event sequence mining
- Relationship evolution over time

**Estimated Time:** 10+ hours

### Gap 3.2: Cross-Evidence Linking
- Link evidence to knowledge graph entities
- Find supporting/contradicting evidence
- Evidence clustering by topic

**Estimated Time:** 8+ hours

### Gap 3.3: Network Topology Metrics
- Clustering coefficient
- Network density
- Shortest path analysis
- Diameter/radius

**Estimated Time:** 6+ hours

---

## ✅ Completion Checklist

**Before ANY other work can proceed, ensure:**

### Priority 1 (CRITICAL - MUST COMPLETE)
- [ ] Gap 1.1: PGVector integrated into TrinityRouter
  - [ ] Evidence stored in both Chroma (temp) and pgvector (permanent)
  - [ ] Semantic queries search both tiers
  - [ ] Migration job implemented
  - [ ] Tests passing

- [ ] Gap 1.2: Graphiti exposed as MCP memory tools
  - [ ] 5 MCP tools implemented (add_memory, search_memory, get_timeline, detect_contradictions, share_context)
  - [ ] AI agents can store/retrieve context
  - [ ] Temporal queries working
  - [ ] Tests passing

- [ ] Gap 1.3: Contradiction detection implemented
  - [ ] Detects temporal contradictions
  - [ ] Returns evidence sources
  - [ ] Tests passing

**Total Priority 1 Estimated Time:** 14-18 hours

### Priority 2 (HIGH VALUE)
- [ ] Gap 2.1: Community detection (Louvain)
- [ ] Gap 2.2: Centrality measures (PageRank, betweenness)
- [ ] Gap 2.3: Entity resolution & deduplication

**Total Priority 2 Estimated Time:** 20-22 hours

### Priority 3 (ADVANCED)
- [ ] Gap 3.1: Temporal pattern analysis
- [ ] Gap 3.2: Cross-evidence linking
- [ ] Gap 3.3: Network topology metrics

**Total Priority 3 Estimated Time:** 24+ hours

---

## 🚨 ENFORCEMENT

**NO EXCEPTIONS:** Until Priority 1 is 100% complete:
- ❌ No new features
- ❌ No refactoring
- ❌ No optimization
- ❌ No documentation updates (except related to P1)
- ❌ No UI work
- ❌ No deployment changes

**ONLY ALLOWED:**
- ✅ Completing Priority 1 gaps
- ✅ Bug fixes that block Priority 1
- ✅ Tests for Priority 1 features

---

**Related Documents:**
- [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) - Backend architecture and database responsibilities
- [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md) - Storage tier design
- [README.md](README.md) - Project overview
