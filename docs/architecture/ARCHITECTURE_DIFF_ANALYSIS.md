# Architecture Diff Analysis: Conversation Ingestion System vs Current Platform

**Date:** January 6, 2026  
**Purpose:** Identify conflicts, overlaps, and integration opportunities between the conversation ingestion system design and the current Salem Forensics Platform

---

## Executive Summary

The conversation ingestion system design (uploaded document) represents a **Python-based CLI tool** for preprocessing large conversation files before PostgreSQL ingestion. The current platform is a **Node.js/TypeScript web application** with Python tools for heavy lifting. **These are complementary, not conflicting** - the ingestion system should be integrated as a preprocessing module.

**Key Finding:** The ingestion system design is MORE mature and detailed than the current platform's document processing implementation. We should adopt its architecture as the canonical preprocessing pipeline.

---

## 1. Architecture Conflicts

### 1.1 Language & Runtime

| Aspect | Conversation Ingestion Design | Current Platform | Resolution |
|--------|------------------------------|------------------|------------|
| **Primary Language** | Python (CLI tool) | Node.js/TypeScript (web app) | ✅ **Compatible** - Use Python for preprocessing, Node.js for web UI/API |
| **Execution Model** | CLI with interactive prompts | Web-based tRPC procedures | ✅ **Complementary** - CLI for bulk, web for interactive |
| **File Processing** | Batch processing with chunking | Stream processing via LlamaIndex | ⚠️ **Overlap** - Need to unify chunking strategy |

**Recommendation:** Keep both. Use conversation ingestion CLI for bulk preprocessing (1000+ files), use platform web UI for interactive analysis (1-10 files).

---

### 1.2 Directory Structure

| Component | Conversation Ingestion | Current Platform | Conflict? |
|-----------|----------------------|------------------|-----------|
| **Chunking** | `src/core/chunker/` (Python) | `server/python-tools/` (ad-hoc) | ⚠️ **Overlap** |
| **Validation** | `src/core/validation/` (Python) | Not implemented | ✅ **Missing** - Adopt from ingestion design |
| **Schema Matching** | `src/core/schema_matching/` | Not implemented | ✅ **Missing** - Adopt from ingestion design |
| **Transformers** | `src/transformers/` (modular) | Inline in parsers | ⚠️ **Conflict** - Refactor platform to use modular transformers |
| **Preview System** | `src/core/preview/` | Not implemented | ✅ **Missing** - Critical feature, adopt immediately |

**Recommendation:** Merge directory structures. Move conversation ingestion system into `server/python-tools/conversation-ingester/` as a standalone module.

---

### 1.3 Database Schema

#### Conversation Ingestion Design Schema

```sql
-- Base Tables (from ingestion design)
CREATE TABLE ingestion_runs (
    run_id UUID PRIMARY KEY,
    source_file TEXT,
    schema_used TEXT,
    transformations_applied JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    records_processed INTEGER,
    errors JSONB
);

CREATE TABLE chunk_metadata (
    chunk_id UUID PRIMARY KEY,
    run_id UUID REFERENCES ingestion_runs,
    chunk_path TEXT,
    chunk_number INTEGER,
    record_count INTEGER,
    validation_status TEXT,
    repairs_applied JSONB
);

-- Target Data Tables (example)
CREATE TABLE slack_messages (
    message_id UUID PRIMARY KEY,
    run_id UUID REFERENCES ingestion_runs,
    timestamp TIMESTAMPTZ,
    timestamp_us_eastern TIMESTAMPTZ,
    user_id TEXT,
    user_name TEXT,  -- enriched via ID transformer
    channel_id TEXT,
    message TEXT,
    message_length INTEGER,  -- derived field
    reactions JSONB,
    attachments JSONB
);
```

#### Current Platform Schema

```typescript
// drizzle/schema.ts (existing)
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull(),
  filename: text('filename').notNull(),
  fileType: text('file_type').notNull(),
  uploadedAt: integer('uploaded_at', { mode: 'timestamp' }).notNull(),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  status: text('status').notNull(), // 'pending', 'processing', 'completed', 'failed'
  metadata: text('metadata', { mode: 'json' }),
});

export const chunks = sqliteTable('chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').references(() => documents.id),
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  embedding: text('embedding', { mode: 'json' }), // pgvector in Supabase
  metadata: text('metadata', { mode: 'json' }),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  documentId: text('document_id').references(() => documents.id),
  platform: text('platform').notNull(), // 'sms', 'facebook', 'imessage', etc.
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  sender: text('sender').notNull(),
  recipient: text('recipient'),
  content: text('content').notNull(),
  sentiment: text('sentiment'), // 'positive', 'negative', 'neutral', 'hostile'
  severity: integer('severity'), // 1-10
  metadata: text('metadata', { mode: 'json' }),
});
```

#### Conflicts & Gaps

| Feature | Ingestion Design | Current Platform | Resolution |
|---------|-----------------|------------------|------------|
| **Ingestion Tracking** | `ingestion_runs` table | Missing | ✅ **Add** - Critical for audit trail |
| **Chunk Metadata** | `chunk_metadata` table | Partial in `chunks` | ⚠️ **Merge** - Add validation/repair fields |
| **Transformation Log** | `transformations_applied` JSONB | Missing | ✅ **Add** - Court admissibility requirement |
| **Timezone Fields** | Multiple timezone columns | Single `timestamp` | ⚠️ **Conflict** - Adopt multi-timezone approach |
| **Derived Fields** | `message_length`, `business_hours_flag` | Missing | ✅ **Add** - Useful for analysis |
| **ID Enrichment** | `user_name` (resolved from `user_id`) | Missing | ✅ **Add** - Critical for readability |

**Recommendation:** Adopt ingestion design schema as the canonical structure. Migrate existing `documents`/`chunks`/`messages` tables to match.

---

## 2. Feature Gaps in Current Platform

### 2.1 Missing from Current Platform (Present in Ingestion Design)

| Feature | Ingestion Design | Current Platform | Priority |
|---------|-----------------|------------------|----------|
| **Chunk Validation** | Full validation + repair system | None | 🔴 **Critical** |
| **Schema Matching** | Library of known schemas with 85% similarity matching | None | 🔴 **Critical** |
| **Preview Mode** | Interactive preview of first 10 records before full processing | None | 🔴 **Critical** |
| **Transformation Pipeline** | Modular transformers (timezone, code decoder, ID enricher) | Inline, ad-hoc | 🟡 **Important** |
| **Interactive Validation** | Fix issues on-the-fly during preview | None | 🟡 **Important** |
| **Chunk Naming Strategy** | User-prompted or timestamp-based | Auto-generated UUIDs | 🟢 **Nice-to-have** |
| **Repair Strategies** | JSON/CSV/XML/Log repair without data loss | None | 🔴 **Critical** |

### 2.2 Missing from Ingestion Design (Present in Current Platform)

| Feature | Current Platform | Ingestion Design | Priority |
|---------|-----------------|------------------|----------|
| **Web UI** | Full React dashboard with tRPC | CLI only (web UI planned) | 🔴 **Critical** |
| **Real-time Processing** | Streaming via LlamaIndex | Batch only | 🟡 **Important** |
| **LLM Integration** | LiteLLM, multi-pass NLP, sentiment analysis | Not mentioned | 🔴 **Critical** |
| **Vector Embeddings** | Chroma + pgvector | Not mentioned | 🔴 **Critical** |
| **Neo4j Graph** | Entity relationships, timeline analysis | Not mentioned | 🟡 **Important** |
| **Agent Coordination** | LangGraph workflows, sub-agents | Not mentioned | 🟡 **Important** |
| **Authentication** | Manus OAuth, role-based access | Not mentioned | 🔴 **Critical** |

---

## 3. Overlapping Features (Need Unification)

### 3.1 Chunking Strategy

| Aspect | Ingestion Design | Current Platform | Unified Approach |
|--------|-----------------|------------------|------------------|
| **Method** | Line-based, size-based, smart chunking | Semantic chunking via LlamaIndex | **Hybrid:** Use ingestion design for format-agnostic chunking, LlamaIndex for semantic |
| **Validation** | Post-chunk validation + repair | None | **Adopt ingestion design** |
| **Metadata** | `chunk_metadata` table with validation status | Inline in `chunks` table | **Merge schemas** |

**Recommendation:** Use ingestion design chunking for initial file splitting, then apply LlamaIndex semantic chunking for embedding generation.

---

### 3.2 Schema Discovery

| Aspect | Ingestion Design | Current Platform | Unified Approach |
|--------|-----------------|------------------|------------------|
| **Method** | Fingerprinting + similarity matching against known schemas | Manual schema definition in code | **Adopt ingestion design** - Auto-detect schemas |
| **Storage** | `config/known_schemas/` JSON files | Hardcoded in parsers | **Migrate to database** - Store in `schemas` table |
| **Versioning** | Not mentioned | Not implemented | **Add schema versioning** |

**Recommendation:** Implement schema library in PostgreSQL, expose via tRPC for web UI management.

---

### 3.3 Transformation System

| Aspect | Ingestion Design | Current Platform | Unified Approach |
|--------|-----------------|------------------|------------------|
| **Architecture** | Modular transformers with detection + configuration | Inline in parsers | **Adopt modular approach** |
| **Types** | Timezone, Code Decoder, ID Enricher, Privacy, Text Normalizer | Multi-pass NLP (sentiment, entities, patterns) | **Merge:** Use ingestion transformers for data prep, platform NLP for analysis |
| **Configuration** | Interactive CLI prompts | Hardcoded | **Add web UI** for transformer configuration |

**Recommendation:** Refactor platform to use modular transformer architecture from ingestion design. Add NLP transformers as additional modules.

---

## 4. Integration Strategy

### 4.1 Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Salem Forensics Platform                  │
│                     (Node.js/TypeScript)                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Web UI (React + tRPC)                     │ │
│  │  - Upload files                                        │ │
│  │  - Configure transformers                              │ │
│  │  - Preview results                                     │ │
│  │  - Manage schemas                                      │ │
│  │  - View analysis                                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           tRPC API Layer (server/routers.ts)          │ │
│  │  - ingest.uploadFile()                                │ │
│  │  - ingest.previewChunks()                             │ │
│  │  - ingest.configureTransformers()                     │ │
│  │  - ingest.processFile()                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │    Python Bridge (server/python-tools/bridge.ts)      │ │
│  │  - Spawns Python processes                            │ │
│  │  - Streams progress updates                           │ │
│  │  - Handles errors                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         Conversation Ingestion System (Python)               │
│         (server/python-tools/conversation-ingester/)         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. Chunker (format-agnostic)                         │ │
│  │     - Line-based, size-based, smart chunking          │ │
│  │     - Chunk naming strategy                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  2. Validator + Repairer                              │ │
│  │     - JSON/CSV/XML/Log validation                     │ │
│  │     - Structure repair without data loss              │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  3. Schema Matcher                                    │ │
│  │     - Check known schemas (85% similarity)            │ │
│  │     - Trigger discovery if no match                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  4. Transformation Pipeline                           │ │
│  │     - Timezone transformer                            │ │
│  │     - Code decoder                                    │ │
│  │     - ID enricher                                     │ │
│  │     - Privacy transformer                             │ │
│  │     - Text normalizer                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  5. Preview Manager                                   │ │
│  │     - Process first 10 records                        │ │
│  │     - Return preview to web UI                        │ │
│  │     - Wait for user approval                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  6. Full Processing                                   │ │
│  │     - Apply transformations to all chunks             │ │
│  │     - Insert into PostgreSQL                          │ │
│  │     - Log ingestion run                               │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                       │
│                      (VPS1 - Hetzner)                        │
│                                                              │
│  - ingestion_runs (audit trail)                             │
│  - chunk_metadata (validation status)                       │
│  - messages (processed data)                                │
│  - documents (file metadata)                                │
│  - schemas (known schemas library)                          │
│  - transformers (saved configurations)                      │
└──────────────────────────┬───────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Post-Processing (Platform)                      │
│                                                              │
│  1. LlamaIndex Semantic Chunking (for embeddings)           │
│  2. Multi-Pass NLP Classification (sentiment, patterns)     │
│  3. Vector Embedding Generation (Chroma + pgvector)         │
│  4. Neo4j Graph Population (entities, relationships)        │
│  5. LangGraph Workflows (forensic analysis)                 │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow

**Bulk Upload (1000+ files):**
1. User uploads files to Directus (VPS1)
2. n8n workflow triggers conversation ingestion CLI
3. CLI chunks, validates, repairs, matches schema, transforms
4. CLI inserts into PostgreSQL with audit trail
5. Platform post-processing (NLP, embeddings, graph) runs asynchronously

**Interactive Upload (1-10 files):**
1. User uploads file via platform web UI
2. Platform calls Python ingestion system via bridge
3. Ingestion system returns preview (first 10 records)
4. User reviews, configures transformers, approves
5. Ingestion system processes full file
6. Platform post-processing runs immediately

---

## 5. Schema Migration Plan

### 5.1 New Tables to Add

```sql
-- Ingestion tracking (from ingestion design)
CREATE TABLE ingestion_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file TEXT NOT NULL,
    source_platform TEXT, -- 'slack', 'discord', 'sms', 'facebook', etc.
    schema_id UUID REFERENCES schemas(id),
    transformations_applied JSONB,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    records_processed INTEGER DEFAULT 0,
    errors JSONB,
    status TEXT DEFAULT 'pending' -- 'pending', 'processing', 'completed', 'failed'
);

-- Schema library (new)
CREATE TABLE schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'slack_export', 'discord_chat', etc.
    version INTEGER DEFAULT 1,
    fingerprint JSONB, -- For similarity matching
    fields JSONB NOT NULL, -- Field definitions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transformer configurations (new)
CREATE TABLE transformers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- 'timezone', 'code_decoder', 'id_enricher', etc.
    type TEXT NOT NULL, -- 'timezone', 'decoder', 'enricher', 'privacy', 'normalizer'
    config JSONB NOT NULL, -- Transformer-specific configuration
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chunk metadata (enhance existing chunks table)
ALTER TABLE chunks ADD COLUMN validation_status TEXT DEFAULT 'pending';
ALTER TABLE chunks ADD COLUMN repairs_applied JSONB;
ALTER TABLE chunks ADD COLUMN ingestion_run_id UUID REFERENCES ingestion_runs(id);
```

### 5.2 Existing Tables to Modify

```sql
-- messages table - add derived fields and multi-timezone support
ALTER TABLE messages ADD COLUMN timestamp_us_eastern TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN timestamp_us_pacific TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN message_length INTEGER;
ALTER TABLE messages ADD COLUMN business_hours_flag BOOLEAN;
ALTER TABLE messages ADD COLUMN day_of_week INTEGER;
ALTER TABLE messages ADD COLUMN hour_of_day INTEGER;
ALTER TABLE messages ADD COLUMN sender_name TEXT; -- Enriched from sender ID
ALTER TABLE messages ADD COLUMN recipient_name TEXT; -- Enriched from recipient ID
ALTER TABLE messages ADD COLUMN ingestion_run_id UUID REFERENCES ingestion_runs(id);

-- documents table - add ingestion tracking
ALTER TABLE documents ADD COLUMN ingestion_run_id UUID REFERENCES ingestion_runs(id);
ALTER TABLE documents ADD COLUMN schema_id UUID REFERENCES schemas(id);
ALTER TABLE documents ADD COLUMN transformers_applied JSONB;
```

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Create `server/python-tools/conversation-ingester/` directory structure
- [ ] Copy ingestion system design into project
- [ ] Create PostgreSQL schema migrations (ingestion_runs, schemas, transformers)
- [ ] Implement Python bridge in `server/_core/python-bridge.ts`
- [ ] Add tRPC procedures for ingestion (uploadFile, previewChunks, processFile)

### Phase 2: Core Ingestion System (Week 2)
- [ ] Implement chunker (line-based, size-based, smart)
- [ ] Implement validator + repairer (JSON, CSV, XML, Log)
- [ ] Implement schema matcher with fingerprinting
- [ ] Implement schema discovery
- [ ] Create schema library seeder (Slack, Discord, SMS, Facebook)

### Phase 3: Transformation Pipeline (Week 3)
- [ ] Implement timezone transformer
- [ ] Implement code decoder transformer
- [ ] Implement ID enricher transformer
- [ ] Implement privacy transformer
- [ ] Implement text normalizer transformer
- [ ] Create transformation pipeline orchestrator

### Phase 4: Preview & Interactive Validation (Week 4)
- [ ] Implement preview manager (first 10 records)
- [ ] Create web UI for preview display
- [ ] Implement interactive validation (fix issues on-the-fly)
- [ ] Add transformer configuration UI
- [ ] Add schema mapping UI

### Phase 5: Integration & Testing (Week 5)
- [ ] Integrate with Directus upload flow
- [ ] Integrate with n8n workflows
- [ ] Add ingestion monitoring dashboard
- [ ] Test with real forensic data (Facebook, SMS, iMessage)
- [ ] Performance testing (1000+ files)

### Phase 6: Post-Processing (Week 6)
- [ ] Wire ingested data to LlamaIndex semantic chunking
- [ ] Wire to multi-pass NLP classification
- [ ] Wire to vector embedding generation
- [ ] Wire to Neo4j graph population
- [ ] Wire to LangGraph forensic workflows

---

## 7. Critical Decisions Needed

### 7.1 Schema Storage Location

**Options:**
1. **JSON files** (ingestion design approach) - Simple, version-controllable
2. **PostgreSQL table** (platform approach) - Queryable, manageable via UI
3. **Hybrid** - JSON for defaults, PostgreSQL for user-created

**Recommendation:** **Hybrid** - Ship default schemas as JSON, store user-created/modified schemas in PostgreSQL.

---

### 7.2 Chunking Strategy

**Options:**
1. **Ingestion design only** - Format-agnostic chunking, no semantic awareness
2. **LlamaIndex only** - Semantic chunking, but requires format detection first
3. **Two-stage** - Ingestion design for initial split, LlamaIndex for embedding chunks

**Recommendation:** **Two-stage** - Use ingestion design for file splitting (handles large files, validation, repair), then apply LlamaIndex semantic chunking for embedding generation.

---

### 7.3 CLI vs Web UI

**Options:**
1. **CLI only** (ingestion design) - Fast, scriptable, but not user-friendly
2. **Web UI only** (platform) - User-friendly, but slower for bulk operations
3. **Both** - CLI for bulk, web for interactive

**Recommendation:** **Both** - Expose ingestion system as CLI for n8n workflows and power users, wrap in web UI for interactive use.

---

### 7.4 Transformation Configuration

**Options:**
1. **Interactive prompts** (ingestion design) - CLI-based, step-by-step
2. **Web forms** (platform) - GUI-based, more accessible
3. **Both** - CLI for automation, web for manual

**Recommendation:** **Both** - Support both CLI prompts (for automation) and web forms (for interactive use). Store configurations in PostgreSQL for reuse.

---

## 8. Conflicts Summary

### 🔴 Critical Conflicts (Must Resolve)

1. **Chunking Strategy** - Two different approaches (format-agnostic vs semantic)
   - **Resolution:** Two-stage chunking (ingestion → LlamaIndex)

2. **Schema Storage** - JSON files vs database
   - **Resolution:** Hybrid (JSON defaults + PostgreSQL for custom)

3. **Transformation Architecture** - Modular vs inline
   - **Resolution:** Adopt modular architecture from ingestion design

### 🟡 Important Overlaps (Need Unification)

1. **Validation System** - Missing in platform, comprehensive in ingestion design
   - **Resolution:** Adopt ingestion design validation + repair system

2. **Preview Mode** - Missing in platform, critical in ingestion design
   - **Resolution:** Implement preview system with web UI

3. **Audit Trail** - Partial in platform, comprehensive in ingestion design
   - **Resolution:** Merge schemas, add ingestion_runs tracking

### 🟢 Minor Conflicts (Easy to Resolve)

1. **Chunk Naming** - UUIDs vs timestamps
   - **Resolution:** Support both, default to timestamps for forensic use

2. **File Storage** - R2 vs local filesystem
   - **Resolution:** Use R2 for final storage, local for temporary chunks

---

## 9. Next Steps

1. **Review this diff with user** - Confirm resolution strategies
2. **Create unified schema migration** - Merge ingestion design + platform schemas
3. **Implement Python bridge** - Connect platform to ingestion system
4. **Build schema library** - Seed with Slack, Discord, SMS, Facebook schemas
5. **Create preview UI** - Web interface for interactive validation
6. **Test with real data** - Upload Facebook/SMS files, verify end-to-end flow

---

## 10. Questions for User

1. **Schema storage preference?** JSON files, PostgreSQL, or hybrid?
2. **CLI vs Web UI priority?** Build CLI first (faster) or web UI first (more accessible)?
3. **Transformation configuration?** Interactive prompts, web forms, or both?
4. **Chunking strategy?** Two-stage (ingestion → LlamaIndex) or single-stage?
5. **Integration priority?** Directus/n8n bulk upload or platform interactive upload first?

---

**End of Diff Analysis**
