# TODO - Current Priorities

**Last Updated:** January 20, 2026
**Project Phase:** Core Complete (65%), Integration Phase (35%)

> 📖 **See PROJECT_STATUS.md for detailed implementation status**

---

## 🔥 Sprint 1: Immediate Priorities (Next 1-2 Weeks)

### 1. Pattern Library Backend Wiring (HIGH PRIORITY)
**Status:** UI complete, backend needs wiring
**Effort:** 2-3 days

**Tasks:**
- [ ] Wire PatternLibrary.tsx to patterns router
- [ ] Complete 21 TODOs in PatternLibrary.tsx
- [ ] Test pattern CRUD operations (add, edit, delete, bulk import)
- [ ] Test pattern matching against sample text
- [ ] Implement pattern import/export with validation
- [ ] Add loading states and error handling

**Files:**
- `client/src/pages/PatternLibrary.tsx` (315 lines, 21 TODOs)
- `server/api/patterns.ts` (664 lines, fully implemented)

**Why Priority:** Pattern management is a core feature with complete backend. Just needs UI wiring.

---

### 2. Fix TypeScript Errors from Branch Merge (MEDIUM PRIORITY)
**Status:** ~80 TypeScript errors from branch merge
**Effort:** 1 day

**Major Issues:**
- [ ] Fix GCP plugin imports (missing @google-cloud packages)
- [ ] Update LlamaIndex API calls (getNodesFromText deprecated)
- [ ] Fix LangGraph test type mismatches (BaseWorkflowState)
- [ ] Fix test context types (TrpcContext)
- [ ] Resolve router type errors (ToolSpec properties)

**Files:**
- `server/mcp/plugins-pending/gcp-*.ts` (7 files)
- `server/mcp/plugins/llamaindex.ts`
- `server/mcp/orchestration/langgraph.test.ts`
- `server/core/router.ts`

**Why Priority:** Clean TypeScript build enables confident development.

---

### 3. External Service Connection Testing (MEDIUM PRIORITY)
**Status:** Configuration exists, connections untested
**Effort:** 1-2 days

**Tasks:**
- [ ] Test Neo4j connection from Settings UI
- [ ] Test Supabase/pgvector connection from Settings UI
- [ ] Test Chroma persistence (already working, verify TTL cleanup)
- [ ] Document connection requirements and error messages
- [ ] Add connection health checks to Settings page

**Files:**
- `client/src/pages/Settings.tsx` (733 lines, complete)
- `server/api/settings.ts` (458 lines, complete)

**Why Priority:** Validate that configuration UI actually works with real services.

---

## 🎯 Sprint 2: Integration & Polish (Weeks 3-4)

### 4. Python Bridge Implementation/Location
**Status:** Referenced in docs but not found
**Effort:** 1-2 days

**Tasks:**
- [ ] Locate existing python-bridge.ts or create new implementation
- [ ] Test spaCy integration (entity extraction, NER)
- [ ] Test sentence-transformers (embeddings)
- [ ] Document Python environment requirements
- [ ] Add Python provider selection to Settings UI

**Why Important:** Enables advanced NLP features beyond JavaScript fallbacks.

---

### 5. LLM Integration Wiring
**Status:** Provider management exists, execution stubs
**Effort:** 3-4 days

**Tasks:**
- [ ] Wire LLM provider management to actual API calls
- [ ] Implement summarization tools with LLM backend
- [ ] Test with multiple providers (OpenAI, Anthropic, Ollama, Gemini)
- [ ] Add streaming support for long responses
- [ ] Implement cost tracking and usage logging

**Files:**
- `server/mcp/plugins/summarization.ts` (390 lines, partial)
- `server/api/settings.ts` (LLM provider CRUD complete)

**Why Important:** Unlocks summarization and advanced analysis features.

---

### 6. Vector Database Integration Testing
**Status:** Chroma works, pgvector/Qdrant need testing
**Effort:** 2-3 days

**Tasks:**
- [ ] Complete pgvector Supabase integration
- [ ] Test Qdrant connection and operations
- [ ] Verify Chroma TTL cleanup works correctly
- [ ] Add vector DB health checks to Settings
- [ ] Benchmark performance of different vector stores

**Files:**
- `server/mcp/plugins/vector-db.ts` (700 lines, mostly complete)
- `server/mcp/plugins/pgvector-supabase.ts` (345 lines, partial)

**Why Important:** Vector search is a core feature for semantic retrieval.

---

## 🚀 Sprint 3+: External Services (Month 2)

### 7. Graph Database Integration (Neo4j + Graphiti)
**Status:** Wrappers defined, connection needed
**Effort:** 3-4 days

**Tasks:**
- [ ] Wire Neo4j tools to MCP gateway
- [ ] Implement Graphiti temporal graph operations
- [ ] Test entity relationship storage
- [ ] Add graph visualization to UI
- [ ] Document graph schema and queries

**Files:**
- `server/mcp/plugins/graph-db.ts` (485 lines, partial)

---

### 8. External API Integrations
**Status:** Tools defined, APIs not integrated
**Effort:** 5-7 days

**Tasks:**
- [ ] Integrate Tavily search API
- [ ] Integrate Perplexity API
- [ ] Integrate NotebookLM (Google API)
- [ ] Wire n8n workflow triggers
- [ ] Add API key management for external services

**Files:**
- `server/mcp/plugins/browser-search.ts` (275 lines, partial)
- `server/mcp/plugins/notebooklm.ts` (165 lines, partial)
- `server/mcp/plugins/n8n.ts` (180 lines, partial)

---

### 9. Frontend Page Completion
**Status:** 4 complete, 1 stub, 9 unknown
**Effort:** 3-5 days

**Tasks:**
- [ ] Audit remaining pages (Logs, Stats, Wiki, Forks, etc.)
- [ ] Complete or remove incomplete pages
- [ ] Add comprehensive error handling
- [ ] Improve loading states across all pages
- [ ] Add unit tests for complex components

---

## 🧪 Testing & Quality (Ongoing)

### 10. Test Coverage Improvement
**Current:** Some plugin tests, router tests missing
**Target:** 80%+ coverage

**Tasks:**
- [ ] Add tests for settings router
- [ ] Add tests for patterns router
- [ ] Add integration tests for plugin execution
- [ ] Add E2E tests for critical user flows
- [ ] Fix failing tests (LangGraph, LangChain Memory)

---

### 11. Documentation Maintenance
**Status:** Major cleanup done (Jan 20), ongoing maintenance needed

**Tasks:**
- [ ] Keep PROJECT_STATUS.md updated weekly
- [ ] Update component-level docs in docs/ folder
- [ ] Create plugin authoring guide
- [ ] Add troubleshooting guide
- [ ] Create deployment guide

---

## 📦 Infrastructure & Deployment (Future)

### 12. VPS Deployment (DEFERRED)
**Note:** Focus on core functionality first, deployment second

**When Ready:**
- [ ] Deploy to salem-nexus (storage VPS)
- [ ] Deploy to salem-forge (compute VPS)
- [ ] Set up Tailscale VPN between VPSes
- [ ] Configure Traefik reverse proxy
- [ ] Set up monitoring and logging

**See:** `DEPLOYMENT.md` for VPS-specific instructions (when needed)

---

## 🔒 Security & Compliance (Ongoing)

### Tasks:
- [ ] Security audit of API key storage
- [ ] Add rate limiting to MCP gateway
- [ ] Implement request validation middleware
- [ ] Add audit logging for sensitive operations
- [ ] Document security best practices

---

## ✅ Recently Completed (January 20, 2026)

- ✅ Merged all feature branches
- ✅ Fixed dependency conflicts (llamaindex 0.12.1, wouter 3.7.1)
- ✅ Updated README.md with accurate implementation status
- ✅ Created PROJECT_STATUS.md comprehensive status document
- ✅ Cleaned up contradictory documentation
- ✅ This TODO updated to reflect reality

---

## 📋 Notes

### Priority Levels:
- **HIGH** = Blocking other work or critical user-facing feature
- **MEDIUM** = Important but not blocking
- **LOW** = Nice to have or can be deferred

### Effort Estimates:
- **1 day** = ~6-8 hours of focused work
- **2-3 days** = ~12-24 hours
- **1 week** = ~40 hours

### Dependencies:
- Pattern Library wiring → None (ready to start)
- TypeScript fixes → None (ready to start)
- External service testing → Requires API keys/credentials
- Python bridge → Requires Python environment setup
- LLM integration → Requires API keys
- Vector/Graph DBs → Requires service setup

### Resources:
- **PROJECT_STATUS.md** - Detailed implementation status
- **README.md** - Quick start and API usage
- **ARCHITECTURE.md** - System design and patterns
- **docs/** folder - Component-level documentation

---

**Remember:** The platform is already 65% complete with solid foundations. Focus on connecting existing components rather than building new features.
