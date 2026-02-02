# Gap Analysis & Critical Priorities

**Last Updated:** February 1, 2026
**Status:** 🚨 BLOCKING - Nothing else gets done until ALL priorities complete
**Priority Level:** CRITICAL - ALL items required (P1 + P2 + P3)
**Total Effort:** 58-62 hours

---

## ⚠️ STOP - Read This First

**This document contains ALL CRITICAL gaps** in the MCP Tool Platform. These are not optional enhancements - they are **required for the system to function as designed**. The advanced features (Priority 3) are **what this application is being built for**.

**RULE:** Do not work on any other features, refactoring, or improvements until **ALL priorities (1, 2, AND 3)** are complete and tested.

**USER DIRECTIVE:** "I need everything all the way to the advanced done. The advanced is what I am doing this for."

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

## 📊 Priority 3: ADVANCED (This Is What We're Building For) ⚠️

### Gap 3.1: Temporal Pattern Analysis ⚠️

**Status:** 🔴 CRITICAL - Core forensic capability
**Impact:** Can't detect behavioral patterns over time
**Effort:** 10-12 hours

**What's Missing:**
- Repeating temporal patterns (same behavior at intervals)
- Event sequence mining (A always follows B)
- Relationship evolution tracking (how connections change)
- Temporal motif detection (common time-based patterns)

**Implementation:**

**File:** `server/mcp/plugins/graph-analytics.ts`

```typescript
export async function detectTemporalPatterns(args: {
  caseId: string;
  patternType: 'repeating' | 'sequence' | 'evolution' | 'motif';
  timeWindow?: { start: string; end: string };
  minOccurrences?: number;
}): Promise<{
  patterns: Array<{
    type: string;
    occurrences: number;
    timestamps: string[];
    entities: Entity[];
    confidence: number;
    description: string;
  }>;
}> {
  // Detect repeating patterns
  if (args.patternType === 'repeating') {
    const query = `
      // Find relationships that repeat over time
      MATCH (e1:Entity)-[r:${relationshipType}]->(e2:Entity)
      WHERE r.case_id = $caseId
        AND r.timestamp >= $start
        AND r.timestamp <= $end
      WITH e1, e2, type(r) AS relType,
           COLLECT(r.timestamp) AS timestamps
      WHERE SIZE(timestamps) >= $minOccurrences
      RETURN e1, e2, relType, timestamps,
             SIZE(timestamps) AS occurrences
      ORDER BY occurrences DESC
    `;

    return formatPatterns(await graphitiClient.runQuery(query, args));
  }

  // Detect event sequences (A → B → C)
  if (args.patternType === 'sequence') {
    const query = `
      // Find common event sequences
      MATCH path = (e1)-[r1]->(e2)-[r2]->(e3)
      WHERE r1.timestamp < r2.timestamp
        AND r1.case_id = $caseId
      WITH [node IN nodes(path) | node.name] AS sequence,
           COUNT(*) AS frequency
      WHERE frequency >= $minOccurrences
      RETURN sequence, frequency
      ORDER BY frequency DESC
    `;

    return formatSequences(await graphitiClient.runQuery(query, args));
  }

  // Track relationship evolution
  if (args.patternType === 'evolution') {
    const query = `
      // Track how relationships change over time
      MATCH (e1:Entity)-[r]->(e2:Entity)
      WHERE r.case_id = $caseId
      WITH e1, e2, type(r) AS relType,
           COLLECT({
             timestamp: r.timestamp,
             properties: r.properties,
             strength: r.strength
           }) AS evolution
      WHERE SIZE(evolution) > 1
      RETURN e1, e2, relType, evolution
    `;

    return formatEvolution(await graphitiClient.runQuery(query, args));
  }

  return { patterns: [] };
}
```

**Acceptance Criteria:**
- [ ] Detects repeating temporal patterns (same relationship over time)
- [ ] Mines event sequences (A → B → C patterns)
- [ ] Tracks relationship evolution (how connections change)
- [ ] Identifies temporal motifs (common time-based patterns)
- [ ] Returns confidence scores and occurrence counts

**Estimated Time:** 10-12 hours

---

### Gap 3.2: Cross-Evidence Linking ⚠️

**Status:** 🔴 CRITICAL - Core forensic capability
**Impact:** Can't correlate evidence across sources
**Effort:** 10 hours

**What's Missing:**
- Link evidence to knowledge graph entities
- Find supporting/contradicting evidence
- Evidence clustering by topic/entity
- Cross-source correlation (message + GPS + document)
- Evidence timeline reconstruction

**Implementation:**

**File:** `server/mcp/plugins/evidence-linker.ts` (NEW)

```typescript
export async function linkEvidenceToGraph(args: {
  evidenceId: string;
  caseId: string;
}): Promise<{
  linkedEntities: Entity[];
  linkedRelationships: Relationship[];
  confidence: number;
}> {
  // 1. Get evidence from PostgreSQL
  const evidence = await pgClient`
    SELECT * FROM evidence WHERE id = ${args.evidenceId}
  `;

  // 2. Extract entities from evidence content
  const entities = await extractEntities(evidence.content);

  // 3. Match entities to knowledge graph
  const matches = await graphitiClient.runQuery(`
    UNWIND $entities AS entity
    MATCH (e:Entity)
    WHERE toLower(e.name) = toLower(entity.name)
      OR e.id IN entity.aliases
    RETURN e, entity
  `, { entities });

  // 4. Create REFERENCED_IN relationships
  for (const match of matches) {
    await graphitiClient.storeRelationships([{
      type: 'REFERENCED_IN',
      sourceId: match.e.id,
      targetId: args.evidenceId,
      properties: {
        timestamp: evidence.created_at,
        confidence: match.confidence,
        case_id: args.caseId
      }
    }]);
  }

  return { linkedEntities: matches.map(m => m.e), linkedRelationships: [], confidence: 0.85 };
}

export async function findRelatedEvidence(args: {
  evidenceId: string;
  relationshipType: 'supporting' | 'contradicting' | 'contextual';
  limit?: number;
}): Promise<{
  evidence: Array<{
    id: string;
    type: string;
    content: string;
    relationship: string;
    confidence: number;
  }>;
}> {
  // 1. Get entities from source evidence
  const sourceEntities = await pgClient`
    SELECT e.* FROM evidence ev
    JOIN evidence_entities ee ON ee.evidence_id = ev.id
    JOIN entities e ON e.id = ee.entity_id
    WHERE ev.id = ${args.evidenceId}
  `;

  // 2. Find evidence mentioning same entities
  const related = await pgClient`
    SELECT DISTINCT ev2.*,
           COUNT(DISTINCT e.id) AS shared_entities
    FROM evidence ev2
    JOIN evidence_entities ee2 ON ee2.evidence_id = ev2.id
    JOIN entities e ON e.id = ee2.entity_id
    WHERE e.id IN (${sourceEntities.map(e => e.id)})
      AND ev2.id != ${args.evidenceId}
    GROUP BY ev2.id
    ORDER BY shared_entities DESC
    LIMIT ${args.limit || 10}
  `;

  // 3. Classify relationship (supporting/contradicting)
  return classifyEvidenceRelationships(related, args.relationshipType);
}

export async function clusterEvidenceByTopic(args: {
  caseId: string;
  minClusterSize?: number;
}): Promise<{
  clusters: Array<{
    id: string;
    topic: string;
    evidence: string[];
    entities: Entity[];
    size: number;
  }>;
}> {
  // Use pgvector + graph analysis for clustering
  // 1. Get evidence embeddings from pgvector
  // 2. Cluster embeddings (K-means or DBSCAN)
  // 3. For each cluster, extract common entities from graph
  // 4. Assign topic labels based on entity types and frequencies
}
```

**Acceptance Criteria:**
- [ ] Evidence automatically linked to knowledge graph entities
- [ ] Can find supporting evidence (mentions same entities)
- [ ] Can find contradicting evidence (conflicts with facts)
- [ ] Evidence clusters by topic/entity
- [ ] Cross-source correlation (message + GPS + document at same time)
- [ ] Timeline reconstruction from multiple evidence sources

**Estimated Time:** 10 hours

---

### Gap 3.3: Network Topology Metrics ⚠️

**Status:** 🔴 CRITICAL - Core forensic capability
**Impact:** Can't analyze communication network structure
**Effort:** 8 hours

**What's Missing:**
- Clustering coefficient (how tightly knit is the network?)
- Network density (how connected is the network?)
- Shortest path analysis (degrees of separation)
- Diameter/radius (network size metrics)
- Bridge detection (entities connecting separate groups)
- Isolated node detection (entities with few connections)

**Implementation:**

**File:** `server/mcp/plugins/graph-analytics.ts`

```typescript
export async function analyzeNetworkTopology(args: {
  caseId: string;
  metrics: Array<'clustering' | 'density' | 'diameter' | 'bridges' | 'isolated'>;
}): Promise<{
  clustering: { coefficient: number; byEntity: Map<string, number> };
  density: number;
  diameter: number;
  radius: number;
  bridges: Entity[];
  isolated: Entity[];
}> {
  const results: any = {};

  // Clustering coefficient
  if (args.metrics.includes('clustering')) {
    const query = `
      MATCH (n:Entity {case_id: $caseId})
      OPTIONAL MATCH (n)--(neighbor:Entity)
      WITH n, COLLECT(DISTINCT neighbor) AS neighbors
      WHERE SIZE(neighbors) > 1
      OPTIONAL MATCH (n1)--(n2)
      WHERE n1 IN neighbors AND n2 IN neighbors AND n1 <> n2
      WITH n, neighbors, COUNT(DISTINCT n1) + COUNT(DISTINCT n2) AS actualConnections,
           SIZE(neighbors) * (SIZE(neighbors) - 1) AS possibleConnections
      RETURN AVG(actualConnections * 1.0 / possibleConnections) AS avgClustering,
             COLLECT({entity: n.id, coefficient: actualConnections * 1.0 / possibleConnections}) AS byEntity
    `;
    results.clustering = await graphitiClient.runQuery(query, { caseId: args.caseId });
  }

  // Network density
  if (args.metrics.includes('density')) {
    const query = `
      MATCH (n:Entity {case_id: $caseId})
      WITH COUNT(n) AS nodeCount
      MATCH ()-[r]->()
      WHERE r.case_id = $caseId
      WITH nodeCount, COUNT(r) AS edgeCount
      RETURN edgeCount * 1.0 / (nodeCount * (nodeCount - 1)) AS density
    `;
    results.density = await graphitiClient.runQuery(query, { caseId: args.caseId });
  }

  // Diameter and radius
  if (args.metrics.includes('diameter')) {
    const query = `
      // Use APOC for shortest path calculations
      MATCH (n1:Entity {case_id: $caseId}), (n2:Entity {case_id: $caseId})
      WHERE n1 <> n2
      MATCH path = shortestPath((n1)-[*]-(n2))
      RETURN MAX(LENGTH(path)) AS diameter,
             MIN(LENGTH(path)) AS radius
    `;
    const result = await graphitiClient.runQuery(query, { caseId: args.caseId });
    results.diameter = result[0].diameter;
    results.radius = result[0].radius;
  }

  // Bridge detection (high betweenness centrality)
  if (args.metrics.includes('bridges')) {
    const query = `
      CALL gds.betweenness.stream({
        nodeProjection: 'Entity',
        relationshipProjection: 'RELATES_TO'
      })
      YIELD nodeId, score
      WHERE score > 0.5  // High betweenness = bridge
      MATCH (e:Entity) WHERE id(e) = nodeId
      RETURN e
    `;
    results.bridges = await graphitiClient.runQuery(query, { caseId: args.caseId });
  }

  // Isolated nodes (degree < 2)
  if (args.metrics.includes('isolated')) {
    const query = `
      MATCH (n:Entity {case_id: $caseId})
      WHERE NOT (n)-[]-()  // No connections
         OR SIZE([(n)-[]-() | 1]) < 2  // < 2 connections
      RETURN n
    `;
    results.isolated = await graphitiClient.runQuery(query, { caseId: args.caseId });
  }

  return results;
}
```

**Acceptance Criteria:**
- [ ] Calculates clustering coefficient (network cohesion)
- [ ] Calculates network density (overall connectivity)
- [ ] Finds diameter and radius (network size)
- [ ] Identifies bridge entities (connect separate groups)
- [ ] Detects isolated nodes (minimal connections)
- [ ] All metrics computed efficiently using Neo4j GDS

**Estimated Time:** 8 hours

---

### Gap 3.4: PostGIS Spatial Analysis ⚠️

**Status:** 🔴 CRITICAL - TraceIQ GPS integration
**Impact:** Can't analyze geospatial evidence patterns
**Effort:** 8 hours

**What's Missing:**
- Proximity clustering (frequent location grouping)
- Movement pattern analysis (routes, speed, stops)
- Geofencing alerts (entity entered/exited area)
- Spatial-temporal correlation (who was where when)
- Location prediction (where will entity go next)

**Implementation:**

**File:** `server/mcp/plugins/spatial-analytics.ts` (NEW)

```typescript
export async function analyzeSpatialPatterns(args: {
  caseId: string;
  entityId?: string;
  analysisType: 'clustering' | 'movement' | 'correlation' | 'prediction';
  timeWindow?: { start: string; end: string };
}): Promise<{
  clusters?: Array<{ center: { lat: number; lon: number }; radius: number; visits: number }>;
  movements?: Array<{ route: any; distance: number; duration: number; avgSpeed: number }>;
  correlations?: Array<{ entity1: string; entity2: string; proximity: number; timeOverlap: number }>;
}> {
  // Location clustering (ST_ClusterDBSCAN)
  if (args.analysisType === 'clustering') {
    const clusters = await pgClient`
      SELECT ST_ClusterDBSCAN(geom, eps := 100, minpoints := 3) OVER () AS cluster_id,
             ST_Centroid(ST_Collect(geom)) AS center,
             COUNT(*) AS visits,
             AVG(ST_Distance(geom, ST_Centroid(ST_Collect(geom)))) AS avg_radius
      FROM evidence
      WHERE case_id = ${args.caseId}
        AND geom IS NOT NULL
      GROUP BY cluster_id
      HAVING cluster_id IS NOT NULL
      ORDER BY visits DESC
    `;

    return { clusters: formatClusters(clusters) };
  }

  // Movement analysis
  if (args.analysisType === 'movement') {
    const routes = await pgClient`
      WITH ordered_points AS (
        SELECT geom, created_at,
               LAG(geom) OVER (ORDER BY created_at) AS prev_geom,
               LAG(created_at) OVER (ORDER BY created_at) AS prev_time
        FROM evidence
        WHERE case_id = ${args.caseId}
          AND metadata->>'entity_id' = ${args.entityId}
          AND geom IS NOT NULL
        ORDER BY created_at
      )
      SELECT ST_MakeLine(prev_geom, geom) AS segment,
             ST_Distance(prev_geom::geography, geom::geography) AS distance_meters,
             EXTRACT(EPOCH FROM (created_at - prev_time)) AS duration_seconds,
             ST_Distance(prev_geom::geography, geom::geography) /
               EXTRACT(EPOCH FROM (created_at - prev_time)) AS speed_mps
      FROM ordered_points
      WHERE prev_geom IS NOT NULL
    `;

    return { movements: formatMovements(routes) };
  }

  // Spatial-temporal correlation (who was near whom when)
  if (args.analysisType === 'correlation') {
    const correlations = await pgClient`
      SELECT e1.metadata->>'entity_id' AS entity1,
             e2.metadata->>'entity_id' AS entity2,
             ST_Distance(e1.geom::geography, e2.geom::geography) AS distance_meters,
             ABS(EXTRACT(EPOCH FROM (e1.created_at - e2.created_at))) AS time_diff_seconds,
             COUNT(*) AS proximity_events
      FROM evidence e1
      JOIN evidence e2 ON e1.case_id = e2.case_id
      WHERE e1.case_id = ${args.caseId}
        AND e1.id < e2.id  -- Avoid duplicates
        AND ST_DWithin(e1.geom::geography, e2.geom::geography, 100)  -- Within 100m
        AND ABS(EXTRACT(EPOCH FROM (e1.created_at - e2.created_at))) < 300  -- Within 5 min
      GROUP BY entity1, entity2, distance_meters, time_diff_seconds
      HAVING COUNT(*) >= 3  -- At least 3 proximity events
      ORDER BY proximity_events DESC
    `;

    return { correlations: formatCorrelations(correlations) };
  }

  return {};
}

export async function detectGeofenceViolations(args: {
  caseId: string;
  geofences: Array<{
    id: string;
    polygon: { type: 'Polygon'; coordinates: number[][][] };
    alertType: 'entry' | 'exit' | 'presence';
  }>;
  timeWindow?: { start: string; end: string };
}): Promise<{
  violations: Array<{
    geofenceId: string;
    entityId: string;
    timestamp: string;
    eventType: 'entered' | 'exited' | 'present';
    location: { lat: number; lon: number };
  }>;
}> {
  // For each geofence, detect entry/exit events
  const violations = [];

  for (const fence of args.geofences) {
    const query = `
      WITH points_with_status AS (
        SELECT
          metadata->>'entity_id' AS entity_id,
          geom,
          created_at,
          ST_Within(geom, ST_GeomFromGeoJSON($polygon)) AS inside,
          LAG(ST_Within(geom, ST_GeomFromGeoJSON($polygon)))
            OVER (PARTITION BY metadata->>'entity_id' ORDER BY created_at) AS was_inside
        FROM evidence
        WHERE case_id = ${args.caseId}
          AND geom IS NOT NULL
          AND created_at >= ${args.timeWindow?.start}
          AND created_at <= ${args.timeWindow?.end}
      )
      SELECT entity_id, created_at, geom,
             CASE
               WHEN inside AND NOT COALESCE(was_inside, false) THEN 'entered'
               WHEN NOT inside AND COALESCE(was_inside, false) THEN 'exited'
               WHEN inside THEN 'present'
             END AS event_type
      FROM points_with_status
      WHERE inside != COALESCE(was_inside, false)
         OR (inside AND $alertType = 'presence')
    `;

    const events = await pgClient.query(query, {
      polygon: JSON.stringify(fence.polygon),
      alertType: fence.alertType,
      ...args
    });

    violations.push(...events.map(e => ({
      geofenceId: fence.id,
      entityId: e.entity_id,
      timestamp: e.created_at,
      eventType: e.event_type,
      location: { lat: e.geom.y, lon: e.geom.x }
    })));
  }

  return { violations };
}
```

**Acceptance Criteria:**
- [ ] Links evidence to knowledge graph entities
- [ ] Finds supporting evidence (corroborates facts)
- [ ] Finds contradicting evidence (conflicts with facts)
- [ ] Clusters evidence by topic using embeddings + graph
- [ ] Cross-source correlation (message + GPS + document)
- [ ] Timeline reconstruction from multiple sources
- [ ] Geofence violation detection

**Estimated Time:** 10 hours

---

### Gap 3.5: Advanced Relationship Discovery ⚠️

**Status:** 🔴 CRITICAL - Core forensic capability
**Impact:** Can't infer hidden relationships
**Effort:** 8 hours

**What's Missing:**
- Transitive relationship discovery (A knows B, B knows C → A may know C)
- Relationship strength scoring (frequency + recency + context)
- Hidden connection detection (indirect relationships)
- Association rule mining (if A then usually B)
- Anomaly detection (unusual relationship patterns)

**Implementation:**

```typescript
export async function discoverHiddenRelationships(args: {
  caseId: string;
  maxDegrees: number; // Degrees of separation to search
  minConfidence: number;
}): Promise<{
  inferred: Array<{
    entity1: Entity;
    entity2: Entity;
    inferredType: string;
    confidence: number;
    path: Entity[];
    evidence: string[];
  }>;
}> {
  // Find transitive relationships
  const query = `
    // Find entities connected through intermediaries
    MATCH (e1:Entity {case_id: $caseId}),
          (e2:Entity {case_id: $caseId}),
          path = shortestPath((e1)-[*..${args.maxDegrees}]-(e2))
    WHERE e1 <> e2
      AND NOT (e1)-[]-(e2)  // Not directly connected
      AND LENGTH(path) <= $maxDegrees
    WITH e1, e2, path,
         1.0 / LENGTH(path) AS pathStrength,  // Shorter path = stronger inference
         [rel IN relationships(path) | rel.confidence] AS confidences
    WITH e1, e2, path, pathStrength,
         REDUCE(s = 1.0, c IN confidences | s * c) AS pathConfidence
    WHERE pathStrength * pathConfidence >= $minConfidence
    RETURN e1, e2,
           [node IN nodes(path) | node] AS intermediaries,
           pathConfidence * pathStrength AS confidence
    ORDER BY confidence DESC
  `;

  return formatInferredRelationships(await graphitiClient.runQuery(query, args));
}

export async function scoreRelationshipStrength(args: {
  caseId: string;
}): Promise<{
  relationships: Array<{
    id: string;
    type: string;
    entities: [Entity, Entity];
    strength: number;
    factors: {
      frequency: number;      // How often they interact
      recency: number;        // How recently they interacted
      diversity: number;      // Variety of interaction types
      duration: number;       // Time span of relationship
    };
  }>;
}> {
  const query = `
    MATCH (e1:Entity)-[r]->(e2:Entity)
    WHERE r.case_id = $caseId
    WITH e1, e2, type(r) AS relType,
         COUNT(r) AS frequency,
         MAX(r.timestamp) AS lastInteraction,
         MIN(r.timestamp) AS firstInteraction,
         COLLECT(DISTINCT type(r)) AS interactionTypes
    WITH e1, e2, relType,
         frequency,
         duration(firstInteraction, lastInteraction).days AS durationDays,
         duration(lastInteraction, datetime()).days AS daysSinceLastContact,
         SIZE(interactionTypes) AS diversity
    RETURN e1, e2, relType,
           // Composite strength score
           (frequency * 0.3) +                                    // 30% weight on frequency
           ((365.0 - daysSinceLastContact) / 365.0 * 0.3) +      // 30% weight on recency
           (diversity * 0.2) +                                    // 20% weight on diversity
           (LOG(durationDays + 1) * 0.2)                         // 20% weight on duration
           AS strength
    ORDER BY strength DESC
  `;

  return formatRelationshipStrengths(await graphitiClient.runQuery(query, args));
}
```

**Acceptance Criteria:**
- [ ] Discovers transitive relationships (degrees of separation)
- [ ] Scores relationship strength (frequency + recency + diversity + duration)
- [ ] Detects hidden connections through intermediaries
- [ ] Identifies anomalous relationships (unusual patterns)
- [ ] Association rule mining (co-occurrence patterns)

**Estimated Time:** 8 hours

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
