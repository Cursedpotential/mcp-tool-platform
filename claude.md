# Context Document for Claude

**Last Updated:** January 20, 2026
**Project:** MCP Tool Platform - Comprehensive Preprocessing & Analysis Gateway
**Status:** 65% Complete - Core features functional, integrations in progress

---

## 📋 Quick Reference

**For Current Status:** See `PROJECT_STATUS.md` (comprehensive implementation details)
**For Next Steps:** See `TODO.md` (prioritized task list)
**For Architecture:** See `ARCHITECTURE.md` (system design)
**For Quick Start:** See `README.md` (installation and API usage)

---

## 🎯 Project Overview

The **MCP Tool Platform** is a general-purpose preprocessing and analysis platform that provides 80+ tools for document processing, NLP, forensics, vector databases, and more. It's designed to be the "preprocessing layer" where heavy computational work happens before data flows to downstream systems.

**Think of it as:** A centralized tool gateway that agents (Claude, ChatGPT, Gemini, custom agents) can use to discover and invoke preprocessing tools via the MCP protocol.

---

## ✅ What Actually Works Right Now (January 2026)

### Fully Functional Features:

1. **MCP Gateway** - Tool discovery, invocation, content references (39,469 lines)
2. **Document Processing** - Pandoc conversion, Tesseract OCR, text segmentation
3. **Search** - ripgrep/ugrep integration with JavaScript fallbacks
4. **NLP** - Entity extraction, sentiment analysis, keywords, language detection (JavaScript-based)
5. **Forensics** - SHA-256 evidence chain of custody (production-ready)
6. **Vector Storage** - Chroma (in-memory + persistent), with Qdrant/pgvector support defined
7. **Library Tools** - Cheerio, XML, JSON5, YAML, CSV, Natural.js, Compromise
8. **Pattern Management** - Full CRUD for behavioral patterns (backend complete)
9. **Settings UI** - Configure LLM providers, databases, workflows
10. **Tools Explorer** - Browse, search, and test tools interactively

### Partially Implemented (Requires Setup):

11. **Python Bridge** - Referenced but needs location/implementation
12. **LLM Integration** - Provider management exists, execution needs wiring
13. **Vector DBs** - pgvector/Qdrant need connection testing
14. **Graph DBs** - Neo4j/Graphiti wrappers defined, need connection
15. **External APIs** - Tavily, Perplexity, NotebookLM, n8n defined but not integrated

---

## 🏗️ Architecture Overview

```
External Agents (Claude, ChatGPT, Gemini)
           ↓
    MCP Gateway Layer
     (80+ tools, 10 categories)
           ↓
  Plugin Execution Layer
     (26 modules, 13,265 lines)
           ↓
     Storage Layer
  (Chroma, PostgreSQL, pgvector, Neo4j)
```

**Key Components:**
- **Gateway:** `server/mcp/gateway.ts` (39,469 lines)
- **Plugins:** `server/mcp/plugins/` (26 files, 13,265 lines)
- **Routers:** `server/api/` (settings.ts, patterns.ts - 1,122 lines)
- **Database:** 18 tables via Drizzle ORM (470 lines schema)
- **Frontend:** 4 complete pages (Home, Settings, Tools, PatternLibrary stub)

---

## 🎨 Use Cases

This platform can be used for:

1. **Document Preprocessing** - Convert, OCR, extract structure from any document
2. **Forensic Analysis** - Maintain cryptographic evidence chains
3. **NLP Pipelines** - Extract entities, analyze sentiment, detect patterns
4. **Vector Search** - Semantic search across document collections
5. **Behavioral Analysis** - Detect patterns in communications (one of many use cases)
6. **Multi-Agent Orchestration** - Provide preprocessing tools to AI agents

**Note:** While the platform *can* be used for forensic communication analysis (detecting manipulation, abuse patterns, etc.), that's just **one use case**. The platform is general-purpose and can be applied to many domains.

---

## 🔧 What Needs Work (Priority Order)

### Sprint 1 (Immediate - 1-2 Weeks):
1. **Pattern Library UI Wiring** - Backend complete, 21 TODOs in frontend
2. **Fix TypeScript Errors** - ~80 errors from branch merge (GCP plugins, LlamaIndex API, test types)
3. **Test External Connections** - Neo4j, Supabase, pgvector via Settings UI

### Sprint 2 (Integration - Weeks 3-4):
4. **Python Bridge** - Locate/implement for advanced NLP
5. **LLM Integration** - Wire provider management to execution
6. **Vector DB Testing** - pgvector, Qdrant connection tests

### Sprint 3+ (External Services - Month 2):
7. **Graph DB Integration** - Wire Neo4j/Graphiti tools
8. **External APIs** - Tavily, Perplexity, NotebookLM, n8n
9. **Frontend Completion** - Audit and complete remaining 9 pages

---

## 📊 Implementation Metrics (As of Jan 20, 2026)

| Component | Completion | Quality | Lines of Code |
|-----------|------------|---------|---------------|
| MCP Gateway | 100% | 🟢 Excellent | 39,469 |
| Core Plugins | 85% | 🟢 Excellent | 13,265 |
| Database Schema | 100% | 🟢 Excellent | 470 |
| API Routers | 100% | 🟢 Good | 1,122 |
| Frontend Pages | 60% | 🟡 Mixed | ~2,000 |
| External Integrations | 20% | 🟡 Partial | N/A |

**Overall: 65% Complete** (core features done, integrations in progress)

---

## 🗄️ Database Schema (18 Tables)

**Core:**
- users, apiKeys, apiKeyUsageLogs
- behavioralPatterns, patternCategories
- workflows, workflowTemplates
- systemPrompts, severityWeights

**Document Intelligence:**
- documents, documentSections, documentChunks
- documentSpans, documentSummaries, documentEntities

**Evidence Management:**
- evidenceChains, hurtlexTerms, mclFactors

**Configuration:**
- bertConfigs, forensicResults, schemaResolvers

---

## 🚀 Quick Start for New Agents

1. **Read This First:**
   - `PROJECT_STATUS.md` - Detailed implementation status
   - `README.md` - Installation and API usage
   - `TODO.md` - Current priorities

2. **Understand What Works:**
   - Core search, document, NLP tools are production-ready
   - MCP Gateway is fully functional
   - Database schema is complete
   - Settings and Tools UIs work

3. **Current Priorities:**
   - Pattern Library backend wiring (high priority)
   - Fix TypeScript errors (medium priority)
   - Test external service connections (medium priority)

4. **Don't Assume:**
   - ❌ Python bridge is working (needs location/implementation)
   - ❌ LLM APIs are wired (provider management only)
   - ❌ External services are integrated (Tavily, NotebookLM, n8n)
   - ❌ All 14 frontend pages are complete (only 4 are)

---

## 🔐 Key Files to Know

**Entry Points:**
- `server/core/index.ts` - Main server entry point
- `client/src/main.tsx` - Frontend entry point

**Core Systems:**
- `server/mcp/gateway.ts` - MCP Gateway (39,469 lines)
- `server/mcp/plugins/registry.ts` - Tool registry (1,887 lines)
- `server/api/settings.ts` - Settings management (458 lines)
- `server/api/patterns.ts` - Pattern CRUD (664 lines)

**Database:**
- `drizzle/schema.ts` - Core tables (users, auth)
- `drizzle/settings-schema.ts` - Config tables (18 tables)

**Frontend:**
- `client/src/pages/Home.tsx` - Landing page (388 lines)
- `client/src/pages/Settings.tsx` - Configuration UI (733 lines)
- `client/src/pages/Tools.tsx` - Tool explorer (594 lines)
- `client/src/pages/PatternLibrary.tsx` - Pattern UI (315 lines, 21 TODOs)

---

## 💡 Important Notes for Agents

### ✅ What You Can Trust:

1. **Core plugins work** - search, document, NLP, forensics, vector-db are solid
2. **Database schema is accurate** - 18 tables are production-ready
3. **MCP Gateway is functional** - Use the Tools page to test
4. **Settings/Tools UIs are complete** - They work and look good

### 🟡 What Needs Verification:

1. **External service connections** - Config exists, but untested with real services
2. **Python bridge** - Referenced but implementation not found
3. **LLM execution** - Provider management works, but execution is stubbed
4. **Pattern Library UI** - Looks good but has 21 TODOs (backend is complete though)

### ❌ What Doesn't Work Yet:

1. **External APIs** - Tavily, Perplexity, NotebookLM, n8n not integrated
2. **Approval Gating (HITL)** - Mentioned in old docs but not implemented
3. **Distributed Tracing** - Referenced but no observability code found
4. **9 frontend pages** - Status unknown, need audit

---

## 🎯 Current Focus (As of Jan 20, 2026)

**Just Completed:**
- ✅ Merged all feature branches
- ✅ Fixed dependency conflicts
- ✅ Updated documentation (README, PROJECT_STATUS, TODO)
- ✅ Cleaned up contradictory docs

**Next Up:**
1. Pattern Library UI wiring (high priority, backend is done)
2. Fix TypeScript errors (~80 from merge)
3. Test external service connections
4. Locate/implement Python bridge

---

## 📖 Where to Find Information

- **Implementation Status:** `PROJECT_STATUS.md`
- **Current Priorities:** `TODO.md`
- **Quick Start:** `README.md`
- **System Design:** `ARCHITECTURE.md`
- **Component Docs:** `docs/` folder
- **Old Planning Docs:** `docs-archive/` (archived Jan 20, 2026)
- **Analysis Reports:** `analysis/archive/` (historical only)

---

## 🚨 Common Pitfalls to Avoid

1. **Don't assume features are complete** - Check PROJECT_STATUS.md first
2. **Don't rely on old planning docs** - Use TODO.md for current priorities
3. **Don't assume Python works** - It's referenced but needs verification
4. **Don't assume all pages are done** - Only 4 of 14 frontend pages are complete
5. **Don't assume external APIs work** - Most are defined but not integrated

---

## 🎓 For Claude Code Agents

**When continuing this project:**

1. Read `PROJECT_STATUS.md` to understand current state
2. Check `TODO.md` for immediate priorities
3. Verify what works before assuming it works
4. Focus on connecting existing components (not building new features)
5. The platform is 65% done - finish what's started before adding more

**Remember:**
- Core preprocessing is production-ready (65%)
- External integrations need work (35%)
- Documentation is now accurate (as of Jan 20, 2026)
- Focus on wiring, not architecture

---

**End of Context Document**

**TL;DR:** This is a functional MCP tool platform with 80+ preprocessing tools. Core features work great (search, document processing, NLP, forensics, vector storage). External integrations (Python, LLMs, cloud APIs) need wiring. See PROJECT_STATUS.md for details, TODO.md for priorities.
