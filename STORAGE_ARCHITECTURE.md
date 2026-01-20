# Storage & Database Architecture

**Project:** MCP Tool Platform - Zep AI Clone using Open Source Graphiti
**Last Updated:** January 20, 2026
**Status:** DEFINITIVE - DO NOT CHANGE WITHOUT USER APPROVAL

---

## 🎯 Core Mission

We are building a **Zep AI clone** using the open-source **Graphiti library** for temporal knowledge graphs. This is NOT mem0, NOT LangChain Memory alone - we are specifically implementing Zep AI's memory architecture pattern.

**Key Distinction:**
- ❌ **NOT mem0** - mem0 is a different project, not part of this codebase
- ✅ **Graphiti** - Open source temporal knowledge graph library (powers Zep AI)
- ✅ **Neo4j** - Graph database backend for Graphiti
- ✅ **Zep AI pattern** - Message history + graph-based contextual memory

---

## 🏗️ Three-Tier Storage Architecture

### Tier 1: Temporary Working Memory (Chroma)
**Purpose:** Short-term processing workspace, auto-cleanup
**Technology:** Chroma DB (in-memory + disk persistence)
**Retention:** 72 hours TTL (configurable)
**Location:** `./data/chroma` or configured path

**What It Stores:**
- Document embeddings during processing
- Temporary semantic search indices
- Intermediate analysis results
- Pre-aggregation data

**Usage Pattern:**
```typescript
// Store temporarily during document processing
await chromaStoreEmbedding({
  collectionId: 'doc-processing-xyz',
  embedding: vector,
  metadata: { documentId, chunkIndex },
  ttl: 72 // hours
});

// Auto-cleanup happens at TTL expiration
// NO manual cleanup needed
```

**Why Chroma:**
- Fast in-memory operations
- Built-in persistence to disk
- TTL-based cleanup (no orphaned data)
- Perfect for preprocessing pipelines

---

### Tier 2: Structured Relational Data (MySQL/PostgreSQL)
**Purpose:** Traditional structured data storage
**Technology:** Drizzle ORM with MySQL/PostgreSQL
**Retention:** Permanent (user-controlled deletion)
**Location:** Configured database connection

**What It Stores:**
- **Users & Authentication** (`users`, `apiKeys`, `apiKeyUsageLogs`)
- **Documents** (`documents`, `documentSections`, `documentChunks`, `documentSpans`, `documentSummaries`, `documentEntities`)
- **Patterns** (`behavioralPatterns`, `patternCategories`)
- **Configuration** (`bertConfigs`, `forensicResults`, `schemaResolvers`, `severityWeights`, `systemPrompts`, `workflowTemplates`)
- **Analysis Results** (`analysisModules`, `analysisResults`, `mclFactors`, `mclAnalysisModules`, `mclAnalysisResults`)
- **Lexicons** (`hurtlexTerms`, `hurtlexCategories`, `hurtlexSyncStatus`)
- **Evidence Chains** (`evidenceChains` - forensic chain of custody)

**Schema:** 18 tables defined in `drizzle/schema.ts`

**Usage Pattern:**
```typescript
// Store structured metadata
const doc = await db.insert(documents).values({
  name: 'document.pdf',
  contentHash: sha256Hash,
  uploadedBy: userId,
  status: 'processed'
});

// Query relational data
const patterns = await db
  .select()
  .from(behavioralPatterns)
  .where(eq(behavioralPatterns.category, 'gaslighting'));
```

**Why MySQL/PostgreSQL:**
- ACID compliance for critical data
- Rich querying with SQL
- Battle-tested reliability
- Foreign key constraints for data integrity

---

### Tier 3: Long-Term Vector Storage (Qdrant or pgvector)
**Purpose:** Permanent semantic search across all historical data
**Technology:** Qdrant (self-hosted) OR pgvector (Supabase extension)
**Retention:** Permanent (until explicitly deleted)
**Location:** Configured external service

**What It Stores:**
- Finalized document embeddings
- Semantic search indices
- Cross-document similarity data
- Long-term context retrieval

**Usage Pattern:**
```typescript
// Store permanent embeddings (after Chroma TTL expires)
await qdrantUpsert({
  collectionName: 'documents',
  points: [{
    id: documentId,
    vector: embedding,
    payload: {
      documentId,
      userId,
      createdAt,
      contentType: 'document'
    }
  }]
});

// Semantic search across all time
const results = await qdrantSearch({
  collectionName: 'documents',
  vector: queryEmbedding,
  limit: 10,
  filter: { userId }
});
```

**Provider Selection:**
- **Qdrant**: Self-hosted, production-grade, fast
- **pgvector**: Supabase-native, convenient, SQL-based

---

### Tier 4: Temporal Knowledge Graph (Neo4j + Graphiti)
**Purpose:** Entity relationships and temporal context (Zep AI pattern)
**Technology:** Graphiti library + Neo4j database
**Retention:** Permanent with temporal versioning
**Location:** Neo4j Aura or self-hosted Neo4j

**What It Stores:**
- **Entities** (Person, Place, Organization, Event)
- **Relationships** (Familial, Professional, Spatial, Temporal)
- **Facts** (Timestamped assertions about entities)
- **Contradiction Detection** (Same entity, different claims over time)

**Graphiti Features:**
- Automatic entity extraction from text
- Temporal relationship tracking
- Fact versioning and contradiction detection
- Community detection (entity clustering)

**Usage Pattern:**
```typescript
// Add entities and relationships (Graphiti handles graph structure)
await graphitiAddFacts({
  facts: [
    'Alice works at TechCorp since 2020',
    'Bob manages the engineering team',
    'Alice reports to Bob'
  ],
  sourceRef: documentId
});

// Query temporal relationships
const timeline = await graphitiGetEntityTimeline({
  entityName: 'Alice',
  startDate: '2020-01-01',
  endDate: '2024-12-31'
});

// Detect contradictions
const contradictions = await graphitiDetectContradictions({
  entityId: 'person-alice-123',
  timeWindow: '2023-01-01/2024-01-01'
});
```

**Why Graphiti + Neo4j:**
- **Zep AI pattern**: Proven architecture for conversational memory
- **Temporal graphs**: Track how relationships change over time
- **Contradiction detection**: Find conflicting claims automatically
- **Open source**: Graphiti is MIT licensed, fully transparent
- **Graph queries**: Complex relationship traversal in Cypher

**Graphiti Architecture:**
```
Graphiti Library
    ├── Entity Extractor (LLM-powered)
    ├── Relationship Builder
    ├── Temporal Tracker
    ├── Contradiction Detector
    └── Neo4j Driver
            ↓
    Neo4j Database
```

---

## 🔄 Data Flow: Ingestion to Memory

### Phase 1: Document Ingestion
```
1. User uploads document → Store in relational DB (documents table)
2. Hash document → Store in evidenceChains (forensic integrity)
3. Parse document → Extract text, structure, metadata
4. Chunk document → Store in documentChunks (relational)
```

### Phase 2: Temporary Processing (Chroma - 72hr TTL)
```
5. Generate embeddings → Store in Chroma working memory
6. Semantic search within document → Query Chroma
7. Extract patterns/entities → Store results temporarily in Chroma
8. Multi-pass NLP analysis → Aggregate findings in Chroma
```

### Phase 3: Permanent Storage (After Processing)
```
9. Finalized embeddings → Store in Qdrant/pgvector (permanent)
10. Structured metadata → Store in MySQL/PostgreSQL (documents, chunks, entities)
11. Entity relationships → Store in Neo4j via Graphiti (temporal graph)
12. Analysis results → Store in analysisResults table (relational)
13. Chroma cleanup → TTL expires after 72 hours (auto-delete)
```

### Phase 4: Retrieval (Cross-System Query)
```
Query Execution:
├─ Semantic search → Qdrant/pgvector (vector similarity)
├─ Structured filters → MySQL/PostgreSQL (SQL WHERE clauses)
├─ Relationship traversal → Neo4j (Cypher graph queries)
└─ Contradiction detection → Graphiti (temporal analysis)

Response Assembly:
└─ Combine results from all tiers → Return unified context
```

---

## 🛠️ Implementation Status (January 2026)

| Component | Status | Notes |
|-----------|--------|-------|
| **Chroma (Tier 1)** | ✅ Complete | In-memory + disk persistence, TTL cleanup working |
| **MySQL Schema (Tier 2)** | ✅ Complete | 18 tables, full Drizzle ORM integration |
| **Qdrant (Tier 3)** | 🟡 Defined | Tools exist, needs connection testing |
| **pgvector (Tier 3)** | 🟡 Defined | Tools exist, needs Supabase setup |
| **Neo4j (Tier 4)** | 🟡 Defined | Connection config exists, needs wiring |
| **Graphiti (Tier 4)** | 🟡 Partial | Library integrated, entity extraction needs LLM |

---

## 🚫 What We Are NOT Using

### ❌ mem0
- **Status:** NOT PART OF THIS PROJECT
- **Why not:** We are implementing Zep AI pattern using Graphiti directly
- **Confusion:** Previous docs mentioned mem0 incorrectly
- **Action:** All mem0 references being removed from codebase

### ❌ LangChain Memory (Standalone)
- **Status:** NOT using LangChain's memory classes directly
- **Why not:** We need temporal graphs (Graphiti), not just message buffers
- **Note:** May use LangChain for other orchestration, but NOT for memory

### ❌ Redis/Valkey
- **Status:** NOT IMPLEMENTED
- **Why not:** Chroma handles temporary storage better for vector data
- **Note:** Could add for session caching later, but not core architecture

---

## 📊 Storage Decision Matrix

| Use Case | Storage Tier | Why |
|----------|--------------|-----|
| Document processing embeddings | Chroma (Tier 1) | Temporary, auto-cleanup |
| Finalized document embeddings | Qdrant/pgvector (Tier 3) | Permanent semantic search |
| Document metadata | MySQL/PostgreSQL (Tier 2) | Structured queries, ACID |
| User auth, API keys | MySQL/PostgreSQL (Tier 2) | Security, relational integrity |
| Behavioral patterns | MySQL/PostgreSQL (Tier 2) | CRUD operations, sharing |
| Entity relationships | Neo4j + Graphiti (Tier 4) | Temporal graphs, contradictions |
| Person timeline | Neo4j + Graphiti (Tier 4) | "Who knew what when" queries |
| Forensic chain of custody | MySQL/PostgreSQL (Tier 2) | Immutable audit trail |

---

## 🎯 Zep AI Pattern Implementation

**What is Zep AI?**
- Conversational memory layer for LLM applications
- Stores message history + contextual knowledge graph
- Uses Graphiti for temporal relationship tracking
- Open source architecture we're cloning

**Our Implementation:**
```
Message History (MySQL)
    ├─ documentSections (conversation segments)
    ├─ documentChunks (individual messages/chunks)
    └─ documentEntities (extracted entities)

Contextual Memory (Neo4j + Graphiti)
    ├─ Entities (Person, Place, Organization)
    ├─ Relationships (temporal, versioned)
    ├─ Facts (timestamped assertions)
    └─ Contradictions (detected automatically)

Semantic Search (Qdrant/pgvector)
    └─ Cross-document retrieval by meaning
```

**Key Zep AI Features We're Implementing:**
1. ✅ **Entity persistence** - Track people, places, organizations
2. ✅ **Temporal relationships** - "Alice worked at X from 2020-2023"
3. 🟡 **Contradiction detection** - "Alice said X in 2020, Y in 2023"
4. 🟡 **Community detection** - Find clusters of related entities
5. 🟡 **Fact evolution** - Track how facts change over time

---

## 🔧 Configuration

**Environment Variables:**
```bash
# Tier 1: Chroma (Working Memory)
CHROMA_STORAGE_PATH=./data/chroma
CHROMA_RETENTION_HOURS=72

# Tier 2: MySQL/PostgreSQL (Structured Data)
DATABASE_URL=mysql://user:pass@host:3306/database
# OR
DATABASE_URL=postgresql://user:pass@host:5432/database

# Tier 3: Vector Storage
VECTOR_PROVIDER=qdrant  # or pgvector
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_key

# OR
PGVECTOR_CONNECTION_STRING=postgresql://...

# Tier 4: Neo4j + Graphiti (Temporal Graph)
NEO4J_URL=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j
```

---

## 📝 Key Takeaways

1. **Zep AI Clone** - We are explicitly implementing Zep AI's architecture
2. **Graphiti Powers It** - Open source temporal knowledge graph library
3. **No mem0** - mem0 is a different project, not used here
4. **Three Tiers** - Temporary (Chroma) → Structured (MySQL) → Semantic (Qdrant) → Graph (Neo4j)
5. **TTL Cleanup** - Chroma automatically deletes old working memory
6. **Temporal Graphs** - Track how relationships change over time
7. **Open Source** - Graphiti + Neo4j + Chroma all open source

---

## 🚀 Next Steps for Storage Integration

**Sprint 1 (Immediate):**
1. ✅ Remove all mem0 references from codebase
2. ✅ Document this definitive storage architecture
3. 🟡 Test Neo4j connection from Settings UI
4. 🟡 Test Qdrant/pgvector connection from Settings UI

**Sprint 2 (Weeks 3-4):**
5. 🟡 Wire Graphiti entity extraction (needs LLM)
6. 🟡 Implement temporal relationship storage
7. 🟡 Add contradiction detection
8. 🟡 Test full Chroma → Neo4j → Qdrant flow

**Sprint 3+ (Month 2):**
9. 🟡 Implement entity timeline queries
10. 🟡 Add community detection (entity clusters)
11. 🟡 Build graph visualization UI
12. 🟡 Optimize vector search performance

---

**IMPORTANT:** This document is the definitive source of truth for storage architecture. Do not add mem0, do not change to a different pattern without explicit user approval. We are building a Zep AI clone using Graphiti, period.

---

**Last Updated:** January 20, 2026
**Approved By:** Project Owner
**Version:** 1.0 (DEFINITIVE)
