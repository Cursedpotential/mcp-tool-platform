# What Is This Project?

**Last Updated:** January 20, 2026
**For:** Quick understanding of what we're actually building

---

## 🎯 In One Sentence

**An MCP-compliant tool platform for document preprocessing, NLP, and forensic analysis, with a Zep AI-style memory layer (using open-source Graphiti for temporal knowledge graphs).**

---

## 🏗️ What It Actually Does

### Core Functionality (Working Now):
1. **Document Processing** - OCR, conversion (Pandoc), text extraction, segmentation
2. **Search & Retrieval** - ripgrep/ugrep integration, semantic search, BM25 ranking
3. **NLP Analysis** - Entity extraction, sentiment analysis, keyword extraction, language detection
4. **Forensic Evidence** - SHA-256 chain of custody, cryptographic integrity verification
5. **Vector Storage** - Chroma (temporary 72hr TTL), Qdrant/pgvector (permanent)
6. **Pattern Detection** - Behavioral pattern matching with custom user patterns
7. **Tool Gateway** - MCP protocol for 80+ preprocessing tools

### Memory Layer (Zep AI Clone - In Progress):
- **Chroma** - Temporary working memory (72hr TTL)
- **MySQL/PostgreSQL** - Structured relational data
- **Qdrant/pgvector** - Permanent semantic search
- **Neo4j + Graphiti** - Temporal knowledge graphs (entities, relationships, facts)

---

## 🚫 What This Is NOT

- ❌ **NOT mem0** - We removed all mem0 references. Using Graphiti instead.
- ❌ **NOT a chat interface** - This is a preprocessing/analysis backend
- ❌ **NOT a forensics-only tool** - Forensics is one use case; it's general-purpose
- ❌ **NOT production-ready everywhere** - 65% complete (core done, integrations in progress)

---

## 📊 Implementation Status (65% Complete)

| Component | Status | What Works |
|-----------|--------|------------|
| **MCP Gateway** | ✅ 100% | Tool discovery, invocation, 80+ tools registered |
| **Document Processing** | ✅ 100% | Pandoc, Tesseract OCR, text extraction |
| **Search** | ✅ 100% | ripgrep/ugrep with JavaScript fallbacks |
| **NLP** | ✅ 85% | JavaScript-based (entity, sentiment, keywords) |
| **Vector Storage** | ✅ 90% | Chroma working, Qdrant/pgvector defined |
| **Database Schema** | ✅ 100% | 18 tables, full Drizzle ORM |
| **Frontend** | 🟡 60% | 4 pages complete (Home, Settings, Tools, PatternLibrary stub) |
| **Neo4j + Graphiti** | 🟡 40% | Connection config exists, needs entity extraction wiring |
| **Python Bridge** | ❌ 0% | Referenced but not found/implemented |
| **External APIs** | ❌ 20% | Tavily, NotebookLM, n8n defined but not connected |

---

## 🗄️ Storage Architecture (Zep AI Pattern)

### 4-Tier Design:

**Tier 1: Chroma (Temporary - 72hr TTL)**
- Purpose: Working memory during document processing
- What: Embeddings, intermediate results, pre-aggregation data
- Cleanup: Automatic after 72 hours

**Tier 2: MySQL/PostgreSQL (Structured)**
- Purpose: Relational data with ACID guarantees
- What: Users, documents, patterns, analysis results, config
- Tables: 18 tables defined in drizzle/schema.ts

**Tier 3: Qdrant or pgvector (Permanent Vectors)**
- Purpose: Long-term semantic search
- What: Finalized document embeddings, cross-document search
- Provider: User choice (Qdrant self-hosted OR pgvector in Supabase)

**Tier 4: Neo4j + Graphiti (Temporal Graph)**
- Purpose: Entity relationships that change over time
- What: People, places, organizations, facts, contradictions
- Library: Graphiti (open source, powers Zep AI)

### Data Flow:
```
Ingest Document
    ↓
Parse & Chunk
    ↓
Store in Chroma (temp embeddings)
    ↓
Process with NLP
    ↓
Extract Entities → Neo4j + Graphiti (graph)
    ↓
Finalize Embeddings → Qdrant/pgvector (permanent)
    ↓
Store Metadata → MySQL/PostgreSQL (structured)
    ↓
Chroma auto-cleanup (72hr TTL)
```

**See STORAGE_ARCHITECTURE.md for full details.**

---

## 🎯 Use Cases

1. **Document Preprocessing** - Convert any format, extract structure
2. **Forensic Analysis** - Maintain chain of custody, detect patterns
3. **Knowledge Graphs** - Track how entities/relationships change over time
4. **Semantic Search** - Find relevant content by meaning, not keywords
5. **Behavioral Analysis** - Detect patterns in communications
6. **Multi-Agent Orchestration** - Provide tools to AI agents via MCP

---

## 🔧 Tech Stack

**Backend:**
- Node.js + TypeScript
- Express + tRPC
- Drizzle ORM (MySQL/PostgreSQL)

**Storage:**
- Chroma (in-memory + disk persistence)
- MySQL/PostgreSQL (Drizzle ORM)
- Qdrant or pgvector (vector search)
- Neo4j + Graphiti (knowledge graphs)

**Frontend:**
- React 19
- TailwindCSS + Radix UI
- Wouter (routing)
- tRPC React Query

**Tools/Services:**
- Pandoc (document conversion)
- Tesseract (OCR)
- ripgrep/ugrep (search)
- Natural.js, Compromise (NLP)
- Graphiti (temporal knowledge graphs)

---

## 📖 Key Documentation

**Start Here:**
1. **README.md** - Quick start, installation, API usage
2. **PROJECT_STATUS.md** - Detailed 65% implementation breakdown
3. **STORAGE_ARCHITECTURE.md** - Definitive 4-tier storage design (Zep AI clone)
4. **TODO.md** - Current priorities (Sprint 1-3+)
5. **claude.md** - Agent onboarding guide

**Architecture:**
- **ARCHITECTURE.md** - System design patterns
- **docs/DATABASE_ARCHITECTURE.md** - Database schema details
- **docs/MCP_TOOL_CATALOG.md** - Full tool listing

---

## 🚀 Current Priorities (Sprint 1)

1. **Pattern Library UI Wiring** - Backend complete, 21 frontend TODOs
2. **Fix TypeScript Errors** - ~80 errors from branch merge
3. **Test External Connections** - Neo4j, Supabase, Qdrant from Settings UI
4. **Locate Python Bridge** - Referenced but implementation not found

**See TODO.md for full roadmap.**

---

## 🎓 For New Developers/Agents

### What Works Right Now:
- ✅ Search files with ripgrep/ugrep
- ✅ Convert documents with Pandoc
- ✅ OCR images/PDFs with Tesseract
- ✅ Extract entities, sentiment, keywords (JavaScript)
- ✅ Store vectors in Chroma (in-memory + disk)
- ✅ Create forensic evidence chains (SHA-256)
- ✅ Manage behavioral patterns (CRUD operations)
- ✅ Configure LLM providers via Settings UI
- ✅ Browse and test tools via Tools Explorer

### What Needs Work:
- 🟡 Wire Graphiti entity extraction (needs LLM)
- 🟡 Test Neo4j connection from Settings UI
- 🟡 Connect Qdrant/pgvector for permanent storage
- 🟡 Implement Python bridge for advanced NLP
- 🟡 Wire LLM provider execution (provider management exists)
- 🟡 Complete Pattern Library UI (backend is done)

### Common Mistakes to Avoid:
1. ❌ Don't assume Python bridge works (needs location/implementation)
2. ❌ Don't assume mem0 is part of project (removed completely)
3. ❌ Don't assume all 14 frontend pages are done (only 4 are)
4. ❌ Don't assume external APIs work (most defined but not connected)
5. ✅ DO check PROJECT_STATUS.md before assuming features exist

---

## 💡 Key Insights

### Why Graphiti (Not mem0)?
- Open source MIT license (full transparency)
- Powers Zep AI (proven architecture)
- Temporal graph support (relationships change over time)
- Contradiction detection built-in
- Neo4j backend (battle-tested)

### Why 4-Tier Storage?
- **Tier 1 (Chroma)**: Fast preprocessing, auto-cleanup
- **Tier 2 (MySQL)**: Structured queries, ACID guarantees
- **Tier 3 (Qdrant)**: Semantic search at scale
- **Tier 4 (Neo4j)**: Complex relationship traversal, temporal analysis

### Why MCP Protocol?
- Standard way for AI agents to discover tools
- Works with Claude, ChatGPT, Gemini, custom agents
- Tools are self-describing (input schema included)
- Content-addressed storage (SHA-256 refs)

---

## 🔗 Quick Links

- **GitHub:** https://github.com/Cursedpotential/mcp-tool-platform
- **Graphiti:** https://github.com/getzep/graphiti (open source library we use)
- **Zep AI:** https://www.getzep.com/ (architecture we're cloning)
- **MCP Protocol:** https://modelcontextprotocol.io/

---

**Last Updated:** January 20, 2026
**Version:** 1.0
**Status:** 65% Complete (Core features functional, integrations in progress)
