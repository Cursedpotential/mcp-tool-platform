# Backend Architecture & Hosting

**Last Updated:** February 1, 2026
**Status:** DEFINITIVE - Critical Reference for Understanding Application vs Evidence Storage

---

## 🎯 Purpose of This Document

This document clarifies the **backend architecture** and **database responsibilities** to prevent agent confusion. Many agents got confused about MySQL vs PostgreSQL roles, leading to incorrect implementations. This is the single source of truth.

---

## 🏗️ Two Separate Concerns

### Concern 1: Application Backend (MySQL)
**What:** The web application itself - user accounts, settings, UI state
**Where:** VPS3 (Main Application Server) or local development
**Database:** MySQL (via Drizzle ORM)
**Purpose:** Power the web interface and application logic

### Concern 2: Evidence Processing Pipeline (PostgreSQL + Multi-Store)
**What:** The forensic evidence storage and analysis system
**Where:** Distributed across VPS1 (PostgreSQL), VPS2 (Chroma), Cloud (Neo4j)
**Database:** TrinityRouter orchestrating multiple stores
**Purpose:** Store, process, and analyze forensic evidence

---

## 📊 Database Responsibilities Matrix

| Database | Location | Purpose | What It Stores | Access Pattern |
|----------|----------|---------|----------------|----------------|
| **MySQL** | VPS3/Local | Application Backend | Users, API keys, UI settings, workflows | Drizzle ORM |
| **PostgreSQL** | VPS1 (Nexus) | Evidence Storage | Evidence records, audit logs, metadata | TrinityRouter |
| **Neo4j + Graphiti** | Cloud/VPS1 | Knowledge Graph | Entities, relationships, temporal facts | TrinityRouter + MCP Tools |
| **ChromaDB** | VPS2 (Forge) | Working Memory | Temporary embeddings (72hr TTL) | TrinityRouter |
| **pgvector** | VPS1 (PostgreSQL) | Semantic Search | Permanent embeddings for RAG | TrinityRouter (needs integration) |
| **PostGIS** | VPS1 (PostgreSQL) | Geospatial Analysis | GPS coordinates, location tracking, spatial queries | TraceIQ → TrinityRouter |
| **Directus** | VPS1 (Nexus) | File Vault | Binary files with SHA-256 chain of custody | TrinityRouter |

---

## 🔀 Critical Distinction: Application vs Evidence

### MySQL - Application Backend

**Schema Location:** `drizzle/schema.ts`
**Tables (18 total):**

```
Application Management:
├── users                    # User accounts
├── apiKeys                  # API key management
├── apiKeyUsageLogs         # Usage tracking
├── workflows               # n8n workflow configs
├── workflowTemplates       # Workflow templates
├── systemPrompts           # LLM system prompts
└── severityWeights         # Analysis weights

Document Management (Application Layer):
├── documents               # Document metadata records
├── documentSections        # Section breakdown
├── documentChunks          # Text chunks
├── documentSpans           # Annotated spans
├── documentSummaries       # Generated summaries
└── documentEntities        # Extracted entities (references)

Pattern Management:
├── behavioralPatterns      # Behavioral pattern definitions
├── patternCategories       # Pattern taxonomy
└── hurtlexTerms           # HurtLex lexicon

Configuration:
├── bertConfigs            # BERT model configs
├── forensicResults        # Analysis results cache
└── schemaResolvers        # JSON schema resolvers
```

**When to Use MySQL:**
- User logs in → MySQL
- User creates workflow → MySQL
- User manages API keys → MySQL
- Application settings → MySQL
- UI state persistence → MySQL

**ORM Access:**
```typescript
import { db } from './server/core/db';
import { users, apiKeys } from '../drizzle/schema';

// Application queries use Drizzle
const user = await db.select().from(users).where(eq(users.id, userId));
```

### PostgreSQL + Multi-Store - Evidence Pipeline

**Schema Location:** `deploy/salem-trinity/phase1-vps1-fix/vps1-postgres-fix.sql`
**Tables:**

```
Evidence Storage (PostgreSQL):
├── evidence                # Evidence records with SHA-256 hashes
├── audit_log              # Forensic chain of custody
└── embeddings             # pgvector semantic search (permanent)

Knowledge Graph (Neo4j):
├── Entity nodes           # People, places, organizations
├── Relationship edges     # Temporal connections
└── Fact nodes            # Timestamped assertions

Working Memory (ChromaDB):
└── Temporary collections  # 72hr TTL embeddings

File Vault (Directus):
└── Binary files          # Documents, images, audio with SHA-256
```

**When to Use TrinityRouter:**
- Evidence ingestion → TrinityRouter.storeEvidence()
- Semantic search → TrinityRouter.query({ type: 'semantic' })
- Temporal queries → TrinityRouter.query({ type: 'temporal' })
- Graph traversal → TrinityRouter.query({ type: 'relational' })

**Router Access:**
```typescript
import { TrinityRouter } from './server/mcp/storage/systemRouter';

const router = new TrinityRouter();
await router.initialize();

// Evidence storage
const result = await router.storeEvidence({
  caseId: 'case-001',
  type: 'message',
  content: 'Text evidence',
  metadata: { platform: 'whatsapp', sender: 'Alice' }
});
```

---

## 🌐 Hosting Architecture

### Development (Local)
```
Localhost:3000
├── MySQL (local or remote)
├── PostgreSQL (VPS1 via Tailscale: 10.10.0.2:5432)
├── Neo4j (Cloud or VPS1)
├── ChromaDB (VPS2 via Tailscale: 10.10.0.3:8000)
└── Directus (VPS1 via Tailscale: 10.10.0.2:8055)
```

### Production - Trinity Architecture

**VPS1 - Salem Nexus (Storage Tier)**
```
IP: 188.245.189.218
Private: 10.10.0.2

Services:
├── PostgreSQL:5432        # Evidence + pgvector (37 extensions)
├── Directus:8055          # File vault with forensic integrity
├── PhotoPrism:2342        # Media analysis
├── n8n:5678              # Workflow automation
└── Coolify:8000          # Container orchestration
```

**VPS2 - Salem Forge (Compute Tier)**
```
IP: 116.203.198.77
Private: 10.10.0.3

Services:
├── ChromaDB:8000         # Working memory (72hr TTL)
├── LiteLLM:4000          # LLM gateway
├── Ollama:11434          # Local embeddings
├── LibreChat:3080        # Chat UI
├── FerretDB:27017        # MongoDB → PostgreSQL bridge
└── MetaMCP:3001          # Internal MCP gateway
```

**VPS3 - Salem Platform (Application Tier)**
```
IP: 116.203.40.1
Private: 10.10.0.4

Services:
├── MCP Platform:3000     # Main application (THIS REPO)
├── MySQL:3306           # Application database
└── MetaMCP Ext:3001     # External public MCP gateway
```

---

## 🗺️ TraceIQ - GPS & Geospatial Processing

### PostGIS Integration

**Status:** PostGIS fully installed (8 extensions), TraceIQ ingestion pipeline in development

**PostGIS Extensions (Part of 37 PostgreSQL Extensions):**
1. `postgis` - Core geometry/geography types
2. `postgis_raster` - Raster data support
3. `postgis_sfcgal` - 3D geometry operations
4. `postgis_tiger_geocoder` - US address geocoding
5. `postgis_topology` - Topology support
6. `address_standardizer` - Address normalization
7. `address_standardizer_data_us` - US address data
8. `pgrouting` - Routing on PostGIS networks

### TraceIQ Data Flow

```
1. GPS Data Ingestion (TraceIQ Pipeline - Separate Process)
   └─> Raw GPS logs (KML, GPX, JSON, CSV)
   └─> Parse coordinates, timestamps, metadata
   └─> Validate and clean location data

2. Database Write (via TrinityRouter)
   └─> TrinityRouter.storeEvidence({
         type: 'location',
         content: 'GPS coordinate data',
         metadata: {
           latitude: 37.7749,
           longitude: -122.4194,
           timestamp: '2026-02-01T12:00:00Z',
           accuracy: 10,
           source: 'device-001'
         }
       })

3. PostGIS Storage (PostgreSQL)
   └─> INSERT INTO evidence (geom, ...)
       VALUES (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), ...)
   └─> Spatial index created automatically (GIST)

4. Meta-Analysis Integration
   └─> Spatial queries via TrinityRouter:
       - Proximity search (find evidence near location)
       - Geofencing (was entity in specific area at time X?)
       - Route reconstruction (connect GPS points into paths)
       - Location clustering (identify frequently visited places)
       - Temporal spatial analysis (movement patterns over time)
```

### Spatial Query Examples

**Proximity Search:**
```typescript
// Find all evidence within 100 meters of a location
const results = await router.query({
  type: 'spatial',
  query: 'proximity',
  params: {
    center: { lat: 37.7749, lon: -122.4194 },
    radius: 100, // meters
    caseId: 'case-001'
  }
});
```

**Geofence Check:**
```typescript
// Was entity at location X during time window?
const results = await pgClient`
  SELECT * FROM evidence
  WHERE case_id = ${caseId}
    AND ST_DWithin(
          geom::geography,
          ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
          ${radius}
        )
    AND created_at BETWEEN ${startTime} AND ${endTime}
`;
```

**Route Reconstruction:**
```typescript
// Connect GPS points into a path
const route = await pgClient`
  SELECT ST_MakeLine(geom ORDER BY created_at) AS route
  FROM evidence
  WHERE case_id = ${caseId}
    AND metadata->>'source' = ${deviceId}
    AND created_at BETWEEN ${startTime} AND ${endTime}
`;
```

**Note:** TraceIQ handles GPS ingestion separately. Once data reaches PostgreSQL, it integrates with the meta-analysis pipeline for cross-analysis with other evidence types (messages, documents, entities).

---

## 🔄 Data Flow Examples

### Example 1: User Uploads Evidence Document

```
1. User uploads PDF via web UI
   └─> MySQL: Insert into documents table (metadata only)
   └─> Application returns document_id

2. Background processing starts
   └─> TrinityRouter.storeEvidence({
         caseId: 'case-001',
         type: 'document',
         content: extractedText,
         file: { buffer, filename, mimeType },
         metadata: { document_id: from MySQL }
       })

3. TrinityRouter orchestrates multi-tier write:
   ├─> Directus (VPS1): Store PDF binary → directus_id
   ├─> PostgreSQL (VPS1): Insert evidence record → postgres_id
   ├─> ChromaDB (VPS2): Store embeddings (72hr) → chroma_id
   ├─> Neo4j (Cloud): Extract entities → graphiti_nodes[]
   └─> Returns: { postgres_id, directus_id, chroma_id, hash }

4. Application updates MySQL documents table:
   └─> UPDATE documents SET
         postgres_evidence_id = postgres_id,
         directus_file_id = directus_id,
         sha256_hash = hash,
         status = 'processed'
```

### Example 2: User Searches for Evidence

```
1. User enters search query in UI
   └─> Application (MySQL): Check user permissions

2. Route query based on type:

   Semantic Search:
   └─> TrinityRouter.query({ type: 'semantic', query: '...' })
       └─> ChromaDB (working memory) + pgvector (permanent)
       └─> Returns: Ranked results with metadata

   Temporal Query:
   └─> TrinityRouter.query({ type: 'temporal', query: '...' })
       └─> Neo4j + Graphiti (temporal graph traversal)
       └─> Returns: Entity timeline with relationships

   Relational Query:
   └─> MySQL (application metadata) JOIN PostgreSQL (evidence)
       └─> Returns: Structured result set

3. Application renders results in UI
```

### Example 3: AI Agent Requests Context

```
1. AI agent calls MCP tool: "graphiti.search_memory"
   └─> MCP Gateway routes to Graphiti client

2. Graphiti queries Neo4j:
   └─> MATCH (e:Entity)-[r]->(e2)
       WHERE e.case_id = $caseId
       RETURN entities, relationships, temporal_facts

3. Return context to agent:
   └─> {
         entities: [...],
         relationships: [...],
         contradictions: [...],
         timeline: [...]
       }

4. Agent uses context to generate response
```

---

## 🚨 Common Mistakes (What Confused Agents)

### ❌ Mistake 1: Using MySQL for Evidence Storage
```typescript
// WRONG - Don't store evidence in MySQL
await db.insert(evidence).values({
  content: evidenceText,
  embedding: vectorData  // ❌ MySQL doesn't have pgvector
});
```

```typescript
// CORRECT - Use TrinityRouter for evidence
await router.storeEvidence({
  caseId: 'case-001',
  content: evidenceText,
  // Router handles multi-tier storage
});
```

### ❌ Mistake 2: Querying PostgreSQL Directly for App Data
```typescript
// WRONG - Don't query PostgreSQL for user data
const user = await pgClient`SELECT * FROM users WHERE id = ${userId}`;
// ❌ Users table is in MySQL, not PostgreSQL
```

```typescript
// CORRECT - Use Drizzle ORM for application data
import { db } from './server/core/db';
import { users } from '../drizzle/schema';

const user = await db.select().from(users).where(eq(users.id, userId));
```

### ❌ Mistake 3: Bypassing TrinityRouter
```typescript
// WRONG - Direct database access for evidence
await chromaClient.add(embedding);
await neo4jSession.run(cypherQuery);
await pgClient.query(sqlQuery);
// ❌ Uncoordinated writes, no forensic integrity
```

```typescript
// CORRECT - Always use TrinityRouter for evidence
await router.storeEvidence(payload);
// ✅ Coordinated multi-tier write with SHA-256 hashing
```

---

## 🎯 Decision Tree: Which Database?

```
Is this about...

The web application itself?
├─ User accounts, login, settings? → MySQL (Drizzle ORM)
├─ Workflow configurations? → MySQL (Drizzle ORM)
├─ API key management? → MySQL (Drizzle ORM)
└─ UI state, preferences? → MySQL (Drizzle ORM)

Forensic evidence processing?
├─ Storing evidence records? → TrinityRouter → PostgreSQL
├─ Binary files (PDFs, images)? → TrinityRouter → Directus
├─ Semantic search (RAG)? → TrinityRouter → pgvector
├─ Temporal relationships? → TrinityRouter → Neo4j + Graphiti
├─ Short-term embeddings? → TrinityRouter → ChromaDB (72hr)
└─ Any evidence operation? → TrinityRouter (orchestrates all)

AI chatbot memory?
├─ Store conversation context? → Graphiti MCP tools (not yet implemented)
├─ Retrieve relevant facts? → Graphiti MCP tools (not yet implemented)
└─ Detect contradictions? → Graphiti MCP tools (not yet implemented)
```

---

## 📝 Environment Variables

### Application Database (MySQL)
```bash
# Drizzle ORM - Application backend
DATABASE_URL=mysql://user:pass@localhost:3306/mcp_platform
```

### Evidence Storage (Multi-Store)
```bash
# PostgreSQL (VPS1) - Evidence + pgvector
POSTGRES_URL=postgresql://user:pass@10.10.0.2:5432/evidence_db

# Neo4j - Knowledge graph
NEO4J_URL=bolt://neo4j.example.com:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password

# ChromaDB (VPS2) - Working memory
CHROMA_HOST=10.10.0.3
CHROMA_PORT=8000

# Directus (VPS1) - File vault
DIRECTUS_URL=http://10.10.0.2:8055
DIRECTUS_TOKEN=your_token
```

---

## 🔧 Code Organization

```
server/
├── core/
│   ├── db.ts              # MySQL connection (Drizzle)
│   ├── db.postgres.ts     # PostgreSQL connection
│   └── router.ts          # Application routing
│
├── api/                   # tRPC routers (application logic)
│   ├── users.ts          # User management (MySQL)
│   ├── workflows.ts      # Workflow CRUD (MySQL)
│   └── settings.ts       # Settings management (MySQL)
│
└── mcp/
    ├── storage/
    │   ├── systemRouter.ts       # TrinityRouter (evidence orchestration)
    │   ├── graphiti-client.ts    # Neo4j + Graphiti
    │   ├── chroma-client.ts      # ChromaDB
    │   └── directus-client.ts    # File vault
    │
    └── plugins/
        ├── vector-db.ts          # pgvector operations
        └── graph-db.ts           # Graph queries
```

---

## ✅ Key Takeaways

1. **MySQL = Application Backend** (users, settings, workflows)
2. **PostgreSQL = Evidence Storage** (forensic records, audit logs)
3. **TrinityRouter = Evidence Orchestrator** (coordinates multi-store writes)
4. **Never bypass TrinityRouter for evidence operations**
5. **Use Drizzle ORM for application data, TrinityRouter for evidence**
6. **Application and evidence concerns are completely separate**

---

**Related Documents:**
- [README.md](README.md) - Project overview and quick start
- [STORAGE_ARCHITECTURE.md](STORAGE_ARCHITECTURE.md) - Detailed storage tier design
- [GAP_ANALYSIS_PRIORITIES.md](GAP_ANALYSIS_PRIORITIES.md) - Critical implementation gaps
- [deploy/salem-trinity/MASTER_DEPLOYMENT_GUIDE.md](deploy/salem-trinity/MASTER_DEPLOYMENT_GUIDE.md) - VPS deployment guide
