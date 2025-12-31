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
- [x] Unified LLM Provider Hub with all providers
- [x] Ollama adapter (local and cloud)
- [x] OpenAI adapter
- [x] Anthropic adapter (Claude)
- [x] Google Gemini adapter (Flash, Pro)
- [x] Groq adapter
- [x] OpenRouter adapter
- [x] Perplexity adapter
- [x] Together AI adapter
- [x] Mistral adapter
- [x] Cohere adapter
- [x] Smart routing (local first, cloud fallback)
- [x] Provider health checks and fallbacks
- [x] Cost tracking per provider

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
- [x] Stats collector with dashboard data
- [ ] JSONL structured logging
- [ ] Health checks and concurrency limits

## Documentation
- [x] Research notes document
- [x] Shared type definitions
- [x] README.md with architecture overview
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
- [x] Tool Explorer page (browse, search, test tools)
- [x] Stats Dashboard page (analytics, charts, metrics)
- [x] Settings page (LLM providers, routing, system)
- [x] Config page (patterns, behaviors, dictionaries)

## Testing
- [x] Content store unit tests
- [x] Gateway API unit tests

## Python Integration
- [x] Python subprocess bridge from Node to Python tools
- [x] Python NLP runner (spaCy, langdetect, NLTK)
- [ ] Add sentence-transformers for local BERT embeddings
- [ ] Integrate Hugging Face transformers for classification

## Admin Dashboard UI
- [x] Tool Explorer page
- [x] Stats Dashboard with visualizations
- [x] LLM provider settings UI
- [x] Definition/pattern editor (patterns, behaviors, dictionaries)
- [x] Import/export for all definitions
- [ ] Rules editor page (YAML/JSON rule sets)
- [ ] Sandbox path configuration

## Extensible Plugin System
- [x] Tool plugin interface for adding new tools
- [x] Plugin registry with tool discovery
- [ ] Plugin manifest format (JSON/YAML)
- [ ] Hot-reload plugin support
- [ ] Plugin validation and sandboxing

## Definition/Pattern Manager
- [x] Pattern definition CRUD
- [x] Behavioral definition CRUD
- [x] Custom dictionary management
- [x] Import/export definitions
- [ ] Pattern set versioning

## Schema & Import/Export System
- [x] JSON Schema definitions for config types
- [x] Settings export (full backup)
- [x] Settings import (restore from backup)
- [x] LLM provider config export/import
- [x] Validation on import
- [ ] Version migration support

## Stats Dashboard (Beautiful Visualizations)
- [x] Real-time tool call metrics
- [x] Success/failure rates with charts
- [x] Hourly activity charts
- [x] LLM provider usage breakdown
- [x] Token consumption tracking
- [x] Cost analytics per provider
- [x] Top tools leaderboard
- [x] Error log viewer
- [ ] Latency histograms per tool (P50/P95/P99)
- [ ] Usage heatmaps (time-based)
- [ ] Pipeline flow visualization
- [ ] Historical trend charts

## Local CLI Bridge
- [x] Ollama local API integration (localhost:11434)
- [x] LM Studio OpenAI-compatible API
- [x] Claude Code CLI subprocess bridge
- [x] Gemini CLI subprocess bridge
- [x] aider integration for code tasks
- [x] llama.cpp server support
- [x] CLI tool auto-detection
- [x] Unified LLM router with fallback chain
- [x] Provider priority configuration
- [ ] Qwen Coder integration


## Real-time Logging & Analytics
- [x] WebSocket server for real-time log streaming
- [x] Live log viewer in dashboard
- [x] Log filtering by level, tool, trace ID
- [x] Log export functionality
- [x] Real-time metrics updates (auto-refresh)

## Tool Forking System
- [x] Generic tool base class with fork capability
- [x] Tool versioning system
- [x] Fork UI in Tool Explorer (Forks page)
- [x] Claude MCP adapter (tools + skills format)
- [x] Gemini Extension adapter (extension manifest)
- [x] OpenAI Function adapter
- [x] Platform-specific best practices templates
- [x] Export forked tool as downloadable package
- [x] Tool diff view (compare versions)

## MCP Server Proxy/Aggregator
- [x] MCP server registry (add/remove remote servers)
- [x] Proxy layer to forward requests to registered servers
- [x] Tool aggregation from multiple MCP servers
- [x] Health monitoring for connected servers
- [x] Load balancing across servers (priority-based)
- [x] Server migration wizard (migration config export)
- [ ] Connection pooling and caching

## Cloud Model Backend
- [x] OpenRouter integration as default cloud backend
- [x] Free model tier selection (Llama, Mistral, etc.)
- [x] Fallback chain: Local Ollama → OpenRouter → Other providers
- [x] Model routing based on task type
- [x] Token/cost tracking per request
