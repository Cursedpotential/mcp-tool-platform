# MCP Tool Platform - Codebase Analysis Report
**Analysis Date:** February 26, 2026  
**Focus Area:** Storage Architecture & Pipeline System  
**Analyst:** GSD Codebase Mapper  
**Repository:** `Projects/TheBigOne/MCP_Tool_Platform/`

---

## Executive Summary

The MCP Tool Platform is a forensic legal case management system with a sophisticated multi-tier storage architecture designed for processing massive evidentiary datasets (8 years of communication logs). The codebase has **~30,000+ lines** of TypeScript across client and server, with a **3-tier memory architecture** and multiple pipeline implementations.

### Current State Overview

| Component | Status | Location |
|-----------|--------|----------|
| MySQL Schema (Drizzle) | ✅ Active | `drizzle/schema.ts` |
| PostgreSQL Schemas | ⚠️ 3 Competing Definitions | `drizzle/*-schemas.ts` |
| Chroma Working Memory | ✅ Implemented | `server/mcp/chroma/` |
| Supabase/pgvector | ✅ Implemented | `server/mcp/storage/supabase-client.ts` |
| Graphiti/Neo4j | ⚠️ Stub Only | `server/mcp/storage/graphiti-client.ts` |
| Python Bridge | ⚠️ Stub Only | `server/mcp/python-bridge.ts` |
| Production Pipeline | ⚠️ Partial | `server/mcp/pipelines/` |
| Document Processing | ✅ Implemented | `server/mcp/loaders/` |

### Critical Findings

1. **Three Competing Schema Definitions**: The codebase has MySQL, PostgreSQL (message-schemas), and PostgreSQL (production-message-schemas) all coexisting without clear ownership
2. **Python Bridge is 100% Stub**: All NLP functions return empty/mock data
3. **Graphiti Client is 100% Stub**: No actual Neo4j connectivity
4. **No DuckDB or LanceDB**: No existing implementation of these databases
5. **TypeScript Strict Mode**: ~80 errors expected in `plugins-pending/` (excluded from build)

---

## 1. Current Storage Architecture

### 1.1 Tier 1: Permanent Relational Storage

#### MySQL (Current Default) - `drizzle/schema.ts`

**Purpose:** Application metadata, user management, configuration  
**Technology:** MySQL 8+ via `mysql2` driver  
**ORM:** Drizzle ORM  

**Tables:** 25+ tables including:
- `users`, `apiKeys`, `apiKeyUsageLogs`
- `analysisModules`, `analysisResults`
- `behavioralPatterns`, `patternCategories`
- `documents`, `documentSections`, `documentChunks`, `documentSpans`
- `documentSummaries`, `documentEntities`, `evidenceChains`
- `mclFactors`, `hurtlexTerms`, `hurtlexCategories`

**Key Characteristics:**
- Uses `mysqlEnum` for type constraints
- All tables have `createdAt`/`updatedAt` timestamps
- Soft-delete pattern via `isActive` flags
- User-scoped data with `userId` foreign keys

#### PostgreSQL + pgvector (Target for Messages) - `drizzle/production-message-schemas.ts`

**Purpose:** Forensic message storage with vector embeddings  
**Technology:** PostgreSQL 16 + pgvector extension  

**Tables:**
- `messagingDocuments` - Chain of custody tracking
- `messagingConversations` - Thread grouping
- `messagingMessages` - Individual messages (core forensic record)
- `messagingAttachments` - MMS/media metadata
- `messagingBehaviors` - Detected pattern matches
- `messagingEvidenceItems` - Court-ready evidence
- `messagingFactorCitations` - MCL factor linking

**Key Characteristics:**
- Full chain of custody (SHA-256 hashes, acquisition metadata)
- MCL 722.23 Best Interest Factors integration
- Temporal fields with timezone support
- Behavior flag columns for quick filtering
- Relations defined via Drizzle relations API

### 1.2 Tier 2: Working Memory (Ephemeral)

#### ChromaDB - `server/mcp/chroma/`

**Purpose:** 72hr TTL working memory for large file processing  
**Deployment:** Docker on VPS2 (salem-forge)  

**Collections:**
- `evidence_processing` - 72hr TTL for active processing
- `project_context` - Persistent project preferences

**Files:**

| File | Lines | Purpose |
|------|-------|---------|
| `chroma-client.ts` | 496 | Main ChromaDB client with dual collections |
| `working-memory.ts` | 631 | Job management, chunking, embedding |
| `stream-processor.ts` | 560 | Streaming file processor for 5GB+ files |

**Key Features:**
- XML-aware chunking (preserves element boundaries)
- JSON streaming parser
- Text chunking with paragraph/sentence boundary detection
- Embedding generation via Ollama (local) or hash-based fallback
- Progress tracking with resume capability

### 1.3 Tier 3: Knowledge Graph

#### Neo4j + Graphiti - `server/mcp/storage/graphiti-client.ts`

**Purpose:** Entity relationships and temporal analysis  
**Status:** ⚠️ **STUB - NOT IMPLEMENTED**  
**Design:** Zep/Graphiti pattern with `valid_from`/`valid_to` on edges

**Current State:**
- All methods return mock data
- No actual Neo4j connection
- Cypher query interface defined but not wired

### 1.4 File Storage

#### R2 (Cloudflare) - `server/storage.ts`
**Purpose:** Binary file storage with CDN access  
**Implementation:** Manus WebDev storage proxy

#### Supabase Storage
**Purpose:** Document and evidence file storage  
**Integration:** Via `supabase-client.ts`

---

## 2. Current Pipeline Architecture

### 2.1 Pipeline Files Overview

| Pipeline | Location | Status | Purpose |
|----------|----------|--------|---------|
| Document Pipeline | `server/mcp/pipelines/document-pipeline.ts` | ✅ Implemented | Generic doc → chunks → embeddings → storage |
| Production Pipeline | `server/mcp/pipelines/production-pipeline.ts` | ⚠️ Partial | Facebook/SMS/iMessage → Supabase + Neo4j |
| End-to-End Pipeline | `server/mcp/pipelines/end-to-end-pipeline.ts` | ⚠️ Partial | Parse → Classify → Segment → Export |
| Export Pipeline | `server/mcp/export/pipeline.ts` | Unknown | Evidence export |

### 2.2 Document Pipeline Flow (`document-pipeline.ts`)

```
┌─────────────────┐
│  File Upload    │
└────────┬────────┘
         ▼
┌─────────────────────────┐
│  unstructuredLoader     │ ← Parse document to chunks
│  (server/mcp/loaders/)  │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│  classifier (multi-pass)│ ← Sentiment, severity, patterns
│  (server/mcp/analysis/) │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│  cachedEmbeddingService │ ← Generate embeddings
│  (real-embedding-service)│
└────────┬────────────────┘
         ▼
┌─────────────────────────┐     ┌──────────────────────┐
│  chromaManager          │────→│  Chroma (72hr TTL)   │
│  (working memory)       │     └──────────────────────┘
└────────┬────────────────┘
         ▼
┌─────────────────────────┐     ┌──────────────────────┐
│  supabaseManager        │────→│  Supabase/pgvector   │
│  (permanent storage)    │     │  (final storage)     │
└─────────────────────────┘     └──────────────────────┘
```

### 2.3 Production Pipeline Flow (`production-pipeline.ts`)

```
┌─────────────────────────┐
│  Raw File Upload        │
│  → Directus → R2        │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│  Format Detection       │
│  Facebook/SMS/iMessage  │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│  Parser                 │
│  (platform-specific)    │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│  Chunking (100 msgs)    │
│  Prevent LLM choking    │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐
│  Chroma (working)       │
│  + Classification       │
└────────┬────────────────┘
         ▼
┌─────────────────────────┐     ┌──────────────────┐
│  Supabase               │────→│  messaging_*     │
│  (conversations,        │     │  tables          │
│   messages, behaviors)  │     └──────────────────┘
└────────┬────────────────┘
         ▼
┌─────────────────────────┐     ┌──────────────────┐
│  Neo4j/Graphiti         │────→│  Entities/       │
│  (entity extraction)    │     │  Relationships   │
└─────────────────────────┘     │  ⚠️ STUBBED      │
                                └──────────────────┘
```

### 2.4 Parsers Available

| Parser | File | Formats | Status |
|--------|------|---------|--------|
| FacebookHTMLParser | `loaders/facebook-parser.ts` | Facebook HTML exports | ✅ |
| XMLSmsParser | `loaders/xml-sms-parser.ts` | Android SMS XML | ✅ |
| PDFImessageParser | `loaders/pdf-imessage-parser.ts` | iMessage PDF exports | ✅ |
| UnstructuredLoader | `loaders/unstructured-loader.ts` | Generic documents | ✅ |

---

## 3. Schema Definitions (The 3 Competing Schemas)

### 3.1 Schema Files Inventory

| File | Lines | Database | Purpose | Status |
|------|-------|----------|---------|--------|
| `drizzle/schema.ts` | 469 | MySQL | App metadata, settings, document intelligence | ✅ ACTIVE |
| `drizzle/message-schemas.ts` | 189 | PostgreSQL | Platform-specific message tables (stub) | ⚠️ PLACEHOLDER |
| `drizzle/production-message-schemas.ts` | 295 | PostgreSQL | Full forensic schema with relations | ⚠️ NOT WIRED |
| `drizzle/settings-schema.ts` | 135 | MySQL | NLP config, LLM providers, routing | ✅ ACTIVE |
| `drizzle/relations.ts` | 61 | - | Relation definitions | ⚠️ Partial |

### 3.2 Schema Conflict Analysis

**Problem:** Three different schema definitions for messages exist:

1. **MySQL (`schema.ts`)**: `documents`, `documentChunks`, `documentEntities` tables
   - Generic document intelligence model
   - Platform-agnostic chunking

2. **PostgreSQL (`message-schemas.ts`)**: `smsMessages`, `facebookMessages`, `imessageMessages`
   - Platform-specific tables
   - Preliminary analysis fields
   - Marked as "PLACEHOLDER - User will provide real schemas later"

3. **PostgreSQL (`production-message-schemas.ts`)**: `messagingMessages`, `messagingConversations`
   - Unified forensic schema
   - Full chain of custody
   - MCL factor integration
   - Relations defined

**Impact:** The production pipeline references tables from schema #3, but the document pipeline doesn't clearly use any of them consistently.

---

## 4. Python Bridge State

### 4.1 Current Implementation - `server/mcp/python-bridge.ts`

**Status:** ⚠️ **100% STUB - NO PYTHON INTEGRATION**

All functions return mock/empty data:
```typescript
// All functions have this pattern:
export async function extractEntities(text: string) {
  console.warn("extractEntities not implemented");
  return { entities: [] };
}
```

### 4.2 Defined but Not Implemented

| Function | Purpose | Used By |
|----------|---------|---------|
| `detectLanguage()` | Language detection | Analysis pipeline |
| `extractEntities()` | spaCy NER | Entity extraction |
| `extractKeywords()` | RAKE/KeyBERT | Pattern detection |
| `analyzeSentiment()` | VADER/transformers | Classification |
| `splitSentences()` | NLP preprocessing | Chunking |
| `nlpBridge.classifyText()` | Text classification | Multi-pass classifier |
| `mlBridge.generateEmbeddings()` | Embedding generation | Embedding service |
| `mlBridge.clusterTexts()` | Text clustering | Analysis |

### 4.3 Expected Python Libraries

Based on TODOs and function names:
- **spaCy** - NER, sentence splitting
- **transformers** - BERT classification, embeddings
- **langdetect** - Language detection
- **VADER** - Sentiment analysis
- **RAKE/KeyBERT** - Keyword extraction
- **Graphiti** - Knowledge graph (Python library)

---

## 5. File Inventory by Purpose

### 5.1 Storage Layer

```
server/
├── db.ts                          # MySQL connection (Drizzle)
├── storage.ts                     # R2 file storage
└── mcp/
    ├── storage/
    │   ├── chroma-client.ts       # ChromaDB wrapper (496 lines) ✅
    │   ├── graphiti-client.ts     # Neo4j wrapper (147 lines) ⚠️ STUB
    │   └── supabase-client.ts     # Supabase/pgvector (494 lines) ✅
    └── chroma/
        ├── working-memory.ts      # Job management (631 lines) ✅
        └── stream-processor.ts    # Streaming parser (560 lines) ✅
```

### 5.2 Pipeline Layer

```
server/mcp/pipelines/
├── document-pipeline.ts           # Generic pipeline (365 lines) ✅
├── production-pipeline.ts         # Forensic pipeline (530 lines) ⚠️
└── end-to-end-pipeline.ts         # Processing pipeline (216 lines) ⚠️
```

### 5.3 Analysis Layer

```
server/mcp/analysis/
├── classifier.ts                  # Multi-pass NLP classifier
├── conversation-segmentation.ts   # Thread grouping
├── multi-pass-classifier.ts       # Pattern detection
├── nlp-classifier.ts              # Text classification
└── priority-screener.ts           # Severity scoring
```

### 5.4 Loader Layer

```
server/mcp/loaders/
├── base-loader.ts
├── document-hierarchy.ts
├── embedding-pipeline.ts
├── real-embedding-service.ts      # Actual embedding generation ✅
├── facebook-parser.ts             # Facebook HTML parser ✅
├── xml-sms-parser.ts              # Android SMS XML parser ✅
├── pdf-imessage-parser.ts         # iMessage PDF parser ✅
├── unstructured-loader.ts         # Generic document loader ✅
└── [other parsers...]
```

### 5.5 Schema Layer

```
drizzle/
├── schema.ts                      # MySQL main schema (469 lines) ✅
├── settings-schema.ts             # MySQL settings (135 lines) ✅
├── message-schemas.ts             # PostgreSQL stub (189 lines) ⚠️
├── production-message-schemas.ts  # PostgreSQL full (295 lines) ⚠️
└── relations.ts                   # Relations (61 lines) ⚠️
```

---

## 6. Conversion Roadmap for DuckDB/LanceDB Integration

### 6.1 New Storage Tier: Analytical Column Store

**Purpose:** Fast analytical queries across millions of messages  
**Technology:** DuckDB (embedded) + LanceDB (vector)  
**Data:** Read replicas from PostgreSQL message tables

### 6.2 Files to Modify

| Priority | File | Changes Required |
|----------|------|------------------|
| P0 | `server/mcp/storage/` | Create `duckdb-client.ts` and `lancedb-client.ts` |
| P0 | `server/mcp/pipelines/` | Add DuckDB sync stage to pipelines |
| P1 | `drizzle/production-message-schemas.ts` | Add views for analytical queries |
| P1 | `server/mcp/analysis/` | Update classifiers to query DuckDB |
| P2 | `server/mcp/python-bridge.ts` | Implement actual Python calls for DuckDB |

### 6.3 Integration Points

```
Current Flow:
  Messages → Supabase (pgvector) ← Queries

New Flow:
  Messages → Supabase (pgvector) ─┬─← Real-time queries
                                  │
                                  ▼
                         DuckDB (analytical) ←← Complex aggregations
                                  │
                                  ▼
                         LanceDB (vectors) ←← Semantic search
```

### 6.4 Python Bridge Requirements

DuckDB has a Python API that the bridge should expose:
```typescript
// New functions needed:
export async function queryDuckDB(sql: string): Promise<QueryResult>
export async function syncToDuckDB(table: string, data: Row[]): Promise<void>
export async function vectorSearchLanceDB(query: number[]): Promise<SearchResult[]>
```

---

## 7. Risk Assessment

### 7.1 High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **3 Competing Schemas** | Database inconsistencies, query failures | Consolidate to `production-message-schemas.ts` |
| **Python Bridge Stubs** | No actual NLP processing | Implement FastAPI Python service |
| **Graphiti Stubs** | No knowledge graph functionality | Deploy Graphiti to Cloud Run |

### 7.2 Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Chroma 72hr TTL** | Data loss if processing interrupted | Add checkpoint/resume logic |
| **Streaming Parser Complexity** | Memory leaks with 5GB+ files | Add backpressure testing |
| **TypeScript Strict Mode** | Build failures | Fix `plugins-pending/` errors |

### 7.3 Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Multiple Pipeline Implementations** | Maintenance overhead | Deprecate `document-pipeline.ts` in favor of `production-pipeline.ts` |
| **MySQL/PostgreSQL Split** | Connection complexity | Document which queries go where |

---

## 8. Dependencies for DuckDB/LanceDB

### 8.1 Node.js Packages to Add

```json
{
  "dependencies": {
    "duckdb": "^0.10.0",        // DuckDB Node.js bindings
    "lancedb": "^0.5.0"         // LanceDB JavaScript SDK
  }
}
```

### 8.2 Python Packages for Bridge

```txt
duckdb>=0.10.0
lancedb>=0.5.0
pyarrow>=15.0.0  # For Arrow format compatibility
```

### 8.3 Environment Variables Needed

```bash
# DuckDB
DUCKDB_PATH=/data/analytics.db
DUCKDB_MEMORY_LIMIT=4GB

# LanceDB
LANCEDB_URI=/data/vectors.lance

# Sync Configuration
DUCKDB_SYNC_INTERVAL=300  # seconds
```

---

## 9. Testing Infrastructure

### 9.1 Existing Tests

| Test File | Coverage |
|-----------|----------|
| `gateway.test.ts` | MCP gateway |
| `gateway.agent.test.ts` | Agent routing |
| `document-loaders.test.ts` | File parsing |
| `pattern-analyzer.test.ts` | Pattern detection |
| `langgraph.test.ts` | Workflow orchestration |
| `langchain-memory.test.ts` | Memory integration |

### 9.2 Test Gaps for Phase 1

- No DuckDB integration tests
- No LanceDB vector search tests
- No Python bridge integration tests
- No end-to-end pipeline tests with real data

---

## 10. Recommendations for Phase 1 Implementation

### 10.1 Immediate Actions (Week 1)

1. **Consolidate Schemas**: Choose `production-message-schemas.ts` as the single source of truth
2. **Implement Python Bridge**: Create FastAPI service with actual spaCy/transformers
3. **Add DuckDB Client**: Create `server/mcp/storage/duckdb-client.ts` following Chroma pattern
4. **Add LanceDB Client**: Create `server/mcp/storage/lancedb-client.ts`

### 10.2 Short-term Actions (Weeks 2-3)

1. **Pipeline Integration**: Add DuckDB sync stage to `production-pipeline.ts`
2. **Query Interface**: Create analytical query builder for DuckDB
3. **Vector Migration**: Sync pgvector embeddings to LanceDB
4. **Testing**: Write integration tests for new storage tier

### 10.3 Architecture Decisions Needed

1. **Sync Strategy**: Real-time (triggers) vs batch (cron)?
2. **Data Retention**: Keep all history in DuckDB or rolling window?
3. **Query Routing**: How to decide PostgreSQL vs DuckDB for a given query?
4. **Python Deployment**: Local subprocess, Docker, or Cloud Run?

---

## Appendix A: File Count by Directory

```
Server: 85+ TypeScript files
Client: 65+ React components
Drizzle: 5 schema files
Tests: 6 test files
Total: ~160+ source files
```

## Appendix B: Key Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript config (strict mode) |
| `vite.config.ts` | Build configuration |
| `vitest.config.ts` | Test configuration |

## Appendix C: External Service Dependencies

| Service | Current Use | Phase 1 Use |
|---------|-------------|-------------|
| MySQL | App metadata | Same |
| PostgreSQL/pgvector | Messages, embeddings | Same (source of truth) |
| Chroma | Working memory (72hr) | Same |
| Neo4j | ⚠️ Not connected | Knowledge graph |
| Supabase | Final storage | Same |
| DuckDB | ❌ Not present | Analytical queries |
| LanceDB | ❌ Not present | Vector search |

---

**End of Report**

*This analysis was generated by the GSD codebase mapper for Phase 1 planning.*
