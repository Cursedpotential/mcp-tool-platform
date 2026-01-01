# Gap Analysis: Planning Requirements vs Implementation

This document compares the planning requirements against the current MCP Tool Shop implementation.

## Summary

| Category | Status | Coverage |
|----------|--------|----------|
| 1. Token-efficient tool surface | ✅ Complete | 100% |
| 2. MCP compatibility + transport | ✅ Complete | 100% |
| 3. Local/remote runners + routing | ⚠️ Partial | 70% |
| 4. Pluggable architecture | ⚠️ Partial | 60% |
| 5. Human-in-the-loop gating | ❌ Missing | 0% |
| 6. Large-doc pipeline | ⚠️ Partial | 40% |
| 7. Storage layer | ⚠️ Partial | 70% |
| 8. NLP is tool-agnostic | ✅ Complete | 90% |
| 9. Observability + reliability | ⚠️ Partial | 60% |
| 10. Docs | ⚠️ Partial | 50% |

---

## Detailed Analysis

### 1. Token-efficient tool surface ✅ COMPLETE

| Requirement | Status | Location |
|-------------|--------|----------|
| `search_tools(query, top_k)` returns minimal tool cards | ✅ | `server/mcp/gateway.ts:68` |
| `describe_tool(tool_name)` returns full schema on demand | ✅ | `server/mcp/gateway.ts:120` |
| `invoke_tool(...)` returns refs for large outputs | ✅ | `server/mcp/gateway.ts:167` |
| `get_ref(ref, paging)` supports pagination | ✅ | `server/mcp/gateway.ts:237` |

**No gaps identified.**

---

### 2. MCP compatibility + transport ✅ COMPLETE

| Requirement | Status | Location |
|-------------|--------|----------|
| Works with Claude MCP patterns (stdio and/or HTTP) | ✅ | `server/mcp/proxy/mcp-proxy.ts` |
| MCP-specific uncertainties isolated behind adapter layer | ✅ | `server/mcp/proxy/` directory |

**No gaps identified.**

---

### 3. Local/remote runners + routing ⚠️ PARTIAL (70%)

| Requirement | Status | Location | Gap |
|-------------|--------|----------|-----|
| Can run tools locally | ✅ | `server/mcp/workers/executor.ts` | - |
| Can run tools on remote runners (HTTP/JSON-RPC/gRPC) | ⚠️ | `server/mcp/llm/provider-hub.ts` | Only HTTP, no gRPC |
| Routing rules decide where tools run | ⚠️ | `server/mcp/llm/smart-router.ts` | LLM routing only, not general tool routing |

**Gaps:**
- [ ] gRPC transport for remote runners
- [ ] General tool routing rules (not just LLM routing)
- [ ] Runner health checks and automatic failover
- [ ] Load balancing across multiple runners

---

### 4. Pluggable architecture ⚠️ PARTIAL (60%)

| Requirement | Status | Location | Gap |
|-------------|--------|----------|-----|
| Plugin manifests (name/version/tools/permissions/deps/tags/runtime) | ⚠️ | `server/mcp/plugins/registry.ts:48` | Missing version, deps, runtime fields |
| Hot-load from plugins/ | ❌ | - | Not implemented |
| Namespacing avoids collisions | ✅ | Plugin names are prefixed | - |
| Per-plugin permissions enforced | ✅ | `server/mcp/gateway.ts:189` | - |

**Gaps:**
- [ ] Hot-reload plugin system (watch plugins/ directory)
- [ ] Full plugin manifest schema (version, dependencies, runtime)
- [ ] Plugin dependency resolution
- [ ] Plugin sandboxing/isolation
- [ ] Plugin marketplace/registry

---

### 5. Human-in-the-loop gating ❌ MISSING (0%)

| Requirement | Status | Location | Gap |
|-------------|--------|----------|-----|
| Write/move/delete/merge returns `requires_approval` | ❌ | - | Not implemented |
| PLAN + preview/diff + rollback + approval_id | ❌ | - | Not implemented |
| Separate `approve(approval_id, option)` required | ❌ | - | Not implemented |
| Audit trail stored (JSONL/SQLite) | ❌ | - | Not implemented |

**Gaps:**
- [ ] Approval request system with `requires_approval` flag
- [ ] Preview/diff generation for destructive operations
- [ ] Rollback capability for approved operations
- [ ] `approve(approval_id, option)` endpoint
- [ ] Audit trail storage (JSONL or SQLite)
- [ ] Approval timeout and expiration
- [ ] Multi-approver support for sensitive operations

---

### 6. Large-doc pipeline ⚠️ PARTIAL (40%)

| Requirement | Status | Location | Gap |
|-------------|--------|----------|-----|
| Ingest → normalize → segment into sections/chunks | ⚠️ | `server/mcp/plugins/nlp.ts` | Basic chunking only |
| Stable IDs for chunks | ❌ | - | Not implemented |
| Hierarchical summaries (chunk→section→doc) with citations | ❌ | - | Not implemented |
| Retrieval tool returns supporting spans (BM25 + embeddings) | ⚠️ | Embeddings only | No BM25 |

**Gaps:**
- [ ] Stable chunk IDs (content-addressed)
- [ ] Hierarchical summarization pipeline (map-reduce)
- [ ] Citation tracking through summary levels
- [ ] BM25 retrieval alongside vector search
- [ ] Streaming parser for large files (SAX/iterparse)
- [ ] Memory-efficient processing (never load full file)

---

### 7. Storage layer ⚠️ PARTIAL (70%)

| Requirement | Status | Location | Gap |
|-------------|--------|----------|-----|
| Content-addressed object store (hash refs) | ✅ | `server/mcp/store/content-store.ts` | - |
| Metadata DB tracks lineage/provenance | ⚠️ | `drizzle/schema.ts` | Basic metadata, no full lineage |
| Optional vector store module (Chroma/FAISS) | ❌ | - | Not implemented |
| Vector store is pluggable/off by default | ❌ | - | Not implemented |

**Gaps:**
- [ ] Full lineage/provenance tracking (parent refs, transformations)
- [ ] Chroma integration (pluggable)
- [ ] FAISS integration (pluggable)
- [ ] Vector store abstraction layer
- [ ] Collection management UI

---

### 8. NLP is tool-agnostic ✅ MOSTLY COMPLETE (90%)

| Requirement | Status | Location | Gap |
|-------------|--------|----------|-----|
| NLP Provider Interface + registry | ✅ | `server/mcp/plugins/nlp.ts` | - |
| Configurable routing per task/filetype/project | ⚠️ | Basic routing | No project-level config |
| Annotation/review loop stored in DB | ❌ | - | Not implemented |

**Gaps:**
- [ ] Project-level NLP provider configuration
- [ ] Annotation/review loop for NLP results
- [ ] NLP result caching

---

### 9. Observability + reliability ⚠️ PARTIAL (60%)

| Requirement | Status | Location | Gap |
|-------------|--------|----------|-----|
| Trace IDs across gateway → runner | ✅ | `server/mcp/observability/tracing.ts` | - |
| Structured logs | ✅ | `server/mcp/realtime/log-stream.ts` | - |
| Timeouts/retries | ⚠️ | Basic timeouts | No retry logic |
| Concurrency limits | ⚠️ | `server/mcp/workers/executor.ts` | Basic limits |
| Backpressure | ⚠️ | `server/mcp/workers/executor.ts:108` | Basic check only |

**Gaps:**
- [ ] Retry logic with exponential backoff
- [ ] Circuit breaker pattern
- [ ] Rate limiting per client/API key
- [ ] Metrics export (Prometheus/OpenTelemetry)
- [ ] Health check endpoints
- [ ] Graceful degradation

---

### 10. Docs ⚠️ PARTIAL (50%)

| Requirement | Status | Location | Gap |
|-------------|--------|----------|-----|
| README.md exists and matches reality | ✅ | `README.md` | - |
| CHANGELOG.md exists | ❌ | - | Not created |
| DEPLOYMENT.md exists | ❌ | - | Not created |

**Gaps:**
- [ ] CHANGELOG.md with version history
- [ ] DEPLOYMENT.md with deployment instructions
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Architecture diagrams
- [ ] Contributing guidelines

---

## Priority Gap List

### P0 - Critical (Blocks Core Functionality)

1. **Human-in-the-loop gating** - Required for safe operation
   - Approval request system
   - Audit trail storage
   - Rollback capability

2. **Large-doc streaming** - Required for 5GB+ files
   - Streaming XML/HTML parsers
   - Memory-efficient processing

### P1 - High Priority (Significant Feature Gaps)

3. **Vector store integration** - Required for semantic search
   - Chroma/FAISS pluggable modules
   - Collection management

4. **Hot-reload plugins** - Required for extensibility
   - Watch plugins/ directory
   - Full manifest schema

5. **Retry/circuit breaker** - Required for reliability
   - Exponential backoff
   - Circuit breaker pattern

### P2 - Medium Priority (Enhancement)

6. **gRPC transport** - Better performance for remote runners
7. **BM25 retrieval** - Hybrid search capability
8. **Hierarchical summarization** - Better large-doc handling
9. **Metrics export** - Production monitoring

### P3 - Low Priority (Nice to Have)

10. **CHANGELOG.md** - Version tracking
11. **DEPLOYMENT.md** - Deployment docs
12. **Annotation/review loop** - NLP result verification
