# MCP Preprocessing Tool Shop - TODO

## Core Infrastructure
- [x] MCP Gateway API with 4 endpoints (search_tools, describe_tool, invoke_tool, get_ref)
- [x] Content-addressed object store with SHA-256 refs and paging
- [x] Worker swarm with task graph, checkpoint/resume, and dedup
- [ ] SQLite metadata layer with migrations
- [ ] Redis-backed distributed queue (optional mode)

## Plugin Suite
- [x] Search plugin (ripgrep + ugrep with JSON output)
- [x] Document plugin (Pandoc conversion + Tesseract OCR)
- [x] NLP plugin (provider-agnostic: entity extraction, sentiment, keywords, sentences)
- [x] Rules engine plugin (YAML/JSON rule sets, regex/keyword matching)
- [x] Diff/merge/repo/fs tools with gated write operations
- [x] ML plugin (embeddings, semantic search, classification - optional/off by default)
- [x] Summarization plugin (hierarchical map-reduce)
- [x] Retrieval plugin (BM25, supporting spans)

## LLM Provider Integration
- [x] Provider-agnostic LLM interface (types defined)
- [ ] Ollama adapter (cloud-hosted)
- [ ] Gemini adapter (2.5 Flash/Pro)
- [ ] OpenRouter adapter (free models)
- [ ] Local BERT embeddings (sentence-transformers)

## Working Memory & Export
- [x] Export pipeline for Neo4j graph database
- [x] Export pipeline for Supabase
- [x] Export pipeline for final vector DB
- [ ] Chroma integration as working memory during preprocessing

## Human-in-the-Loop
- [x] Approval gating system with preview/diff/rollback
- [ ] Interactive CLI review UI for batch approvals
- [x] Audit logging for all destructive actions

## Observability
- [x] Trace IDs across gateway → runner → task graph
- [x] Metrics (latency, queue depth, bytes processed, cache hits)
- [ ] JSONL structured logging
- [ ] Health checks and concurrency limits

## Documentation
- [x] Research notes document
- [x] Shared type definitions
- [ ] README.md with architecture overview
- [ ] CHANGELOG.md (Keep a Changelog format)
- [ ] DEPLOYMENT.md (local/hybrid/remote setup)

## Token Efficiency Features
- [x] Reference-based returns (never inline large content)
- [x] Paged retrieval for large results
- [x] Structured metadata with offsets/citations
- [x] Hierarchical summarization (map-reduce)
- [x] BM25 retrieval with citation tracking

## Frontend
- [x] Dashboard home page with tool categories
- [x] API documentation display
- [x] Architecture overview visualization

## Testing
- [x] Content store unit tests
- [x] Gateway API unit tests
