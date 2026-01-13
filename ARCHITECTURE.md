# MCP Tool Platform - Architecture & Design Document

**Version**: 1.0  
**Date**: January 5, 2026  
**Author**: Manus AI  
**Status**: Living Document

---

## Executive Summary

The **MCP Tool Platform** is a token-efficient preprocessing and orchestration system designed to reduce LLM context consumption by 85%+ through intelligent data transformation, analysis, and routing. This platform serves as the "Home Depot of preprocessing tools"—a centralized gateway where heavy computational work happens before data flows into final storage systems (Neo4j, Supabase, Vector DBs) or orchestrating agents.

**Core Value Proposition**: Transform raw, unstructured data into pre-analyzed, structured, semantically-enriched artifacts that downstream systems can consume with minimal token overhead.

---

## System Architecture

### High-Level Design

The platform operates as a **three-layer architecture**:

1. **Gateway Layer** - MCP-compliant API that exposes 65+ preprocessing tools to external agents
2. **Execution Layer** - Task executor with 39+ handler implementations for forensics, NLP, document processing, and ML operations
3. **Storage Layer** - Multi-modal persistence (Chroma in-process, pgvector, Neo4j Aura, MySQL/TiDB)

```
┌─────────────────────────────────────────────────────────────┐
│                    External Agents                          │
│         (Claude, ChatGPT, Gemini, Custom Agents)            │
└────────────────────┬────────────────────────────────────────┘
                     │ MCP Protocol
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Gateway Layer                         │
│  • Tool Discovery (listTools, listCategories, semantic)     │
│  • Tool Invocation (invoke_tool, get_ref)                   │
│  • Workflow Templates (6 pre-built chains)                  │
│  • MCP Server Proxy (aggregate remote tools)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Task Executor Layer                        │
│  • 39 Built-in Handlers (forensics, NLP, document, ML)     │
│  • Python Bridge (Graphiti, spaCy, transformers)            │
│  • Content Store (reference-based returns for large data)   │
│  • Redis Queue (multi-worker orchestration)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer                             │
│  • Chroma (in-process, 72hr TTL working memory)             │
│  • pgvector (Supabase-hosted, persistent embeddings)        │
│  • Neo4j Aura (Graphiti temporal graph)                     │
│  • MySQL/TiDB (structured metadata, user data)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Goals

### 1. Token Efficiency (Primary Goal)

**Problem**: Sending raw documents, conversations, or datasets to LLMs consumes massive context windows and increases costs.

**Solution**: Pre-process data through specialized tools that extract structure, entities, relationships, and summaries before final consumption.

**Target**: 85%+ token reduction through:
- Document chunking and summarization
- Entity extraction and relationship mapping
- Semantic deduplication
- Temporal pattern analysis
- Evidence chain verification

### 2. Tool Discoverability (Agent-Friendly)

**Problem**: Agents struggle to find the right tool for a given task without exhaustive search or prior knowledge.

**Solution**: Multi-modal discovery mechanisms:
- **Semantic routing** - Match natural language intent to best tool
- **Category browsing** - Group tools by function (forensics, NLP, document, ML)
- **Workflow templates** - Pre-built tool chains for common tasks
- **Related tools** - Suggest next steps after tool execution

### 3. Temporal Awareness (Graphiti Integration)

**Problem**: Standard knowledge graphs lack temporal context—can't track how relationships evolve over time or detect contradictions across timelines.

**Solution**: Graphiti-powered temporal graph in Neo4j Aura:
- Track entity relationships with timestamps
- Detect contradictions across time periods
- Support "as of" queries for historical state
- Enable forensic timeline reconstruction

### 4. Modular Extensibility

**Problem**: Monolithic systems are hard to extend and maintain.

**Solution**: Plugin-based architecture:
- Each tool is a self-contained module with schema, handler, and tests
- Python bridge for heavy NLP/ML operations
- MCP server proxy for external tool aggregation
- Clear separation between gateway, executor, and storage

---

## Feature Matrix

### Implemented Features (✅)

| Feature | Status | Description |
|---------|--------|-------------|
| MCP Gateway | ✅ | 7 core endpoints (search, describe, invoke, list, categories, semantic, related) |
| Tool Registry | ✅ | 65 tools registered with full schemas |
| Task Executor | ✅ | 39 handlers wired (forensics, text-miner, format-converter, schema-resolver, evidence-hasher, document, NLP, search, ML, retrieval, summarization) |
| Workflow Templates | ✅ | 6 pre-built workflows (document analysis, evidence chain, entity extraction, timeline forensics, semantic search, batch processing) |
| Content Store | ✅ | Reference-based storage for large outputs (>1MB) |
| Database Schema | ✅ | Document intelligence tables (documents, sections, chunks, spans, summaries, entities, evidenceChains) |
| Frontend Pages | ✅ | 13 pages (Home, Tools, Settings, ApiKeys, McpConfig, Proxy, Stats, Logs, Wiki, Forks, Config, ComponentShowcase, NotFound) |
| MCP Server Proxy | ✅ | Aggregate tools from remote MCP servers |
| LLM Integration | ✅ | Preconfigured helpers for chat, structured output, tool calling |
| Auth System | ✅ | Manus OAuth with session management |

### Partially Implemented (⚠️)

| Feature | Status | Blocker |
|---------|--------|---------|
| Database Connection UI | ⚠️ | Forms exist but no backend procedures to save/test connections |
| Graph DB Plugin | ⚠️ | Code exists but uses HTTP API fallback, not neo4j-driver |
| Vector DB Plugin | ⚠️ | Only Chroma in-memory implemented, Qdrant/pgvector are stubs |
| Redis Queue | ⚠️ | Code exists but not integrated into gateway |

### Missing Critical Infrastructure (❌)

| Feature | Status | Priority |
|---------|--------|----------|
| Chroma Persistent Storage | ❌ | P0 - Currently in-memory only |
| Graphiti Python Integration | ❌ | P0 - Needed for temporal awareness |
| pgvector/Supabase Wiring | ❌ | P0 - Persistent embeddings |
| Docker Compose | ❌ | P1 - Self-hosting |
| Workflow Execution UI | ❌ | P1 - No page to run workflows |
| Local MCP Bridge | ❌ | P2 - Can't connect to user's local tools |

---

## Design Patterns & Conventions

### 1. Tool Schema Pattern

Every tool follows a strict schema:

```typescript
{
  name: 'category.action',           // Namespaced naming
  category: 'forensics',              // For grouping
  description: 'What it does',       // Human-readable
  version: '1.0.0',                  // Semantic versioning
  tags: ['tag1', 'tag2'],            // For search
  inputSchema: { /* JSON Schema */ },
  outputSchema: { /* JSON Schema */ },
  permissions: ['read:fs'],          // Security model
  costEstimate: { /* tokens/time */ }
}
```

### 2. Handler Registration Pattern

Handlers are registered in `server/mcp/workers/executor.ts`:

```typescript
this.registerHandler('tool.name', async (args) => {
  // 1. Validate input
  // 2. Call implementation (local or Python bridge)
  // 3. Return structured output
  // 4. Handle errors gracefully
});
```

### 3. Reference-Based Returns

Large outputs (>1MB) are stored in ContentStore and returned as references:

```typescript
{
  success: true,
  ref: {
    id: 'ref-abc123',
    size: 5242880,
    mimeType: 'application/json',
    expiresAt: 1704499200000
  }
}
```

Agents retrieve via `get_ref` endpoint with pagination support.

### 4. Python Bridge Pattern

Heavy NLP/ML operations delegate to Python:

```typescript
import { callPython } from './server/mcp/python-bridge';

const result = await callPython('spacy_ner', {
  text: input.text,
  model: 'en_core_web_sm'
});
```

Python scripts live in `server/python-tools/` with a unified runner.

### 5. Workflow Composition

Workflows are declarative tool chains:

```typescript
{
  id: 'document-analysis',
  name: 'Document Analysis Pipeline',
  steps: [
    { tool: 'document.parse', output: 'parsed' },
    { tool: 'nlp.extract_entities', input: '${parsed.text}', output: 'entities' },
    { tool: 'forensics.analyze_patterns', input: '${entities}', output: 'patterns' }
  ]
}
```

---

## Integration Points

### Chroma (In-Process Vector DB)

**Purpose**: Fast, ephemeral working memory for embeddings during preprocessing.

**Configuration**:
- Path: `./data/chroma`
- TTL: 72 hours (configurable)
- Retention: Automatic cleanup job

**Use Cases**:
- Semantic deduplication during batch processing
- Similarity search within a single session
- Temporary embedding cache

**NOT for**: Long-term storage (use pgvector instead)

### Graphiti + Neo4j Aura (Temporal Graph)

**Purpose**: Track entity relationships with temporal awareness.

**Architecture**:
- Graphiti Python SDK via python-bridge
- Neo4j Aura connection string from env
- Temporal queries via Cypher

**Use Cases**:
- Forensic timeline reconstruction
- Contradiction detection across time periods
- "As of" queries for historical state
- Relationship evolution tracking

**Connection**: Requires `NEO4J_URL`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` env vars.

### pgvector + Supabase (Persistent Embeddings)

**Purpose**: Long-term vector storage for semantic search.

**Architecture**:
- Supabase Postgres with pgvector extension
- Connection string from env
- Metadata stored in MySQL, vectors in Supabase

**Use Cases**:
- Persistent document embeddings
- Cross-session semantic search
- Knowledge base retrieval

**Connection**: Requires `SUPABASE_URL`, `SUPABASE_KEY` env vars.

### Redis Queue (Multi-Worker Orchestration)

**Purpose**: Distribute heavy preprocessing tasks across workers.

**Architecture**:
- In-memory fallback for single-instance
- Redis connection for multi-worker
- Priority queue support

**Use Cases**:
- Batch document processing
- Parallel tool execution
- Background jobs

**Connection**: Optional `REDIS_URL` env var.

---

## Agent Workflow Guidelines

### For Agents Using This Platform

1. **Discovery Phase**
   - Call `listCategories` to see available tool groups
   - Call `listTools` or `search_tools` to find specific tools
   - Use `semanticRoute` to match intent to best tool

2. **Planning Phase**
   - Check `listWorkflows` for pre-built tool chains
   - Use `getRelatedTools` to discover next steps
   - Review `describe_tool` for input/output schemas

3. **Execution Phase**
   - Call `invoke_tool` with validated input
   - Handle `ref` returns via `get_ref` with pagination
   - Chain tools based on workflow templates

4. **Error Handling**
   - Check `meta.executionTimeMs` for performance issues
   - Retry with exponential backoff on transient errors
   - Fall back to simpler tools if advanced ones fail

### For Agents Building This Platform

1. **Before Making Changes**
   - Read `todo.md` to see planned work
   - Check `analysis/archive/` for historical context
   - Review existing code before reimplementing

2. **When Adding Features**
   - Add unchecked items to `todo.md` FIRST
   - Follow existing patterns (see Design Patterns section)
   - Write vitest tests in `server/*.test.ts`
   - Mark items as `[x]` when complete

3. **When Fixing Bugs**
   - Add bug to `todo.md` as `[ ] Fix: description`
   - Fix the issue
   - Add regression test
   - Mark as `[x]` in `todo.md`

4. **Before Saving Checkpoint**
   - Verify all completed items are marked `[x]` in `todo.md`
   - Run `pnpm test` to ensure all tests pass
   - Check `webdev_check_status` for clean build

---

## Current State (as of 2026-01-05)

### What Works

- **Gateway**: All 7 endpoints functional, 65 tools discoverable
- **Executor**: 39 handlers wired and tested
- **Frontend**: 13 pages with full UI
- **Auth**: Manus OAuth working
- **Database**: Schema created, tables exist
- **Tests**: 78 vitest tests passing

### What's Broken

- **TypeScript Errors**: ✅ Fixed (was 29, now 0)
- **llamaindex Package**: Stubbed out due to dependency conflict
- **Database UI**: Forms don't save/test connections

### What's Missing

- **Chroma Persistence**: In-memory only, no disk storage
- **Graphiti Integration**: Python package added to requirements, needs wiring
- **pgvector Integration**: Stub only, no real connection
- **Docker Setup**: No docker-compose.yml
- **Workflow Execution**: Templates exist but no UI to run them

### Next Steps (Priority Order)

1. **P0**: Build Chroma persistent storage (Phase 3)
2. **P0**: Wire Graphiti Python integration (Phase 4)
3. **P0**: Add pgvector/Supabase connection (Phase 5)
4. **P1**: Create workflow execution UI
5. **P1**: Add Docker Compose setup
6. **P2**: Build local MCP bridge for user's filesystem

---

## Technology Stack

### Backend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Node.js 22 | Server execution |
| Framework | Express 4 + tRPC 11 | API layer |
| Database | MySQL/TiDB | Structured data |
| ORM | Drizzle | Type-safe queries |
| Auth | Manus OAuth | User management |
| Queue | Redis (optional) | Task distribution |
| Python | 3.11+ | NLP/ML operations |

### Frontend

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | React 19 | UI library |
| Styling | Tailwind 4 | CSS framework |
| Components | shadcn/ui | UI primitives |
| Router | wouter | Client-side routing |
| State | tRPC hooks | Data fetching |

### Storage

| Component | Technology | Purpose |
|-----------|------------|---------|
| Vector DB | Chroma (in-process) | Working memory |
| Vector DB | pgvector (Supabase) | Persistent embeddings |
| Graph DB | Neo4j Aura | Temporal relationships |
| Object Storage | S3-compatible | File storage |

### Python Dependencies

| Package | Purpose |
|---------|---------|
| graphiti-core | Temporal graph operations |
| neo4j | Neo4j driver |
| spacy | NLP (NER, POS, dependencies) |
| transformers | Embeddings, classification |
| sentence-transformers | Semantic similarity |
| nltk | Text processing |

---

## Security Model

### Permission System

Tools declare required permissions:

- `read:filesystem` - Read local files
- `write:filesystem` - Write local files
- `read:network` - Make HTTP requests
- `write:network` - Send data externally
- `execute:process` - Run subprocesses
- `access:llm` - Call LLM APIs
- `access:vectordb` - Query vector databases

### Authentication

- **User Auth**: Manus OAuth with JWT sessions
- **API Keys**: Per-user API keys for programmatic access
- **MCP Servers**: Optional API key per remote server

### Data Isolation

- Each user's data is scoped by `userId`
- Chroma collections are user-specific
- Neo4j entities tagged with `sourceRef` for provenance

---

## Performance Characteristics

### Latency Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Tool discovery | <100ms | Cached in memory |
| Simple tool execution | <500ms | Pure JS operations |
| Python bridge call | <2s | Subprocess overhead |
| Document parsing | <5s | Depends on size |
| Embedding generation | <10s | Depends on model |

### Scalability

- **Single Instance**: Handles 10-50 concurrent users
- **Multi-Worker**: Horizontal scaling via Redis queue
- **Database**: TiDB supports 100k+ documents

### Token Efficiency

- **Raw Document**: 10,000 tokens
- **After Preprocessing**: 1,500 tokens (85% reduction)
- **Breakdown**:
  - Summary: 500 tokens
  - Entities: 300 tokens
  - Relationships: 400 tokens
  - Metadata: 300 tokens

---

## Deployment Options

### Option 1: Manus Hosting (Current)

- Hosted on Manus infrastructure
- Auto-scaling, managed database
- No Docker setup needed
- **Best for**: Development, single-user

### Option 2: Self-Hosted (Docker Compose)

- Run locally or on your own server
- Full control over data
- Requires Docker, Redis, Neo4j, Supabase
- **Best for**: Production, multi-user, compliance

### Option 3: Hybrid

- Gateway on Manus, storage self-hosted
- Connect to your Neo4j Aura, Supabase
- **Best for**: Leverage Manus infra, keep data local

---

## Roadmap

### Phase 1: Core Infrastructure (Complete)

- ✅ MCP Gateway with 7 endpoints
- ✅ Tool Registry with 65 tools
- ✅ Task Executor with 39 handlers
- ✅ Database schema
- ✅ Frontend UI

### Phase 2: Database Integration (In Progress)

- ⏳ Chroma persistent storage
- ⏳ Graphiti Python integration
- ⏳ pgvector/Supabase wiring
- ⏳ Database connection UI backend

### Phase 3: Workflow Execution (Next)

- ⬜ Workflow execution engine
- ⬜ Workflow execution UI
- ⬜ Workflow monitoring dashboard
- ⬜ Workflow templates library

### Phase 4: Self-Hosting (Future)

- ⬜ Docker Compose setup
- ⬜ Kubernetes manifests
- ⬜ Deployment documentation
- ⬜ Monitoring & logging

### Phase 5: Local Bridge (Future)

- ⬜ Cloudflare Tunnel integration
- ⬜ Tailscale integration
- ⬜ Local MCP server discovery
- ⬜ Filesystem access

---

## Contributing Guidelines

### For AI Agents

1. **Read this document first** before making changes
2. **Update `todo.md`** before implementing features
3. **Follow existing patterns** (see Design Patterns section)
4. **Write tests** for all new handlers
5. **Mark completed items** in `todo.md` as `[x]`
6. **Save checkpoints** after major milestones

### For Human Developers

1. **Read `CLAUDE.MD`** for AI assistant context
2. **Check `todo.md`** for current priorities
3. **Run `pnpm test`** before committing
4. **Update this document** when architecture changes
5. **Add to `CHANGELOG.md`** for user-facing changes

---

## Glossary

| Term | Definition |
|------|------------|
| **MCP** | Model Context Protocol - Standard for tool discovery and invocation |
| **Tool** | A single preprocessing operation (e.g., `document.parse`) |
| **Handler** | Implementation of a tool's logic |
| **Workflow** | Chain of tools executed in sequence |
| **ContentRef** | Reference to large output stored in ContentStore |
| **Chroma** | In-process vector database for working memory |
| **Graphiti** | Temporal graph framework for Neo4j |
| **pgvector** | Postgres extension for vector similarity search |
| **Token Efficiency** | Reducing LLM context consumption through preprocessing |

---

## Contact & Support

- **Project Repository**: [GitHub](https://github.com/Cursedpotential/mcp-tool-platform)
- **Documentation**: This file + `CLAUDE.MD`
- **Issues**: GitHub Issues
- **Questions**: Create a discussion in GitHub

---

**Document Version**: 1.0  
**Last Updated**: January 5, 2026  
**Next Review**: After Phase 2 completion
