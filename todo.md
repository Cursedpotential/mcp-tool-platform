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


## Chroma Working Memory (Large File Processing)
- [x] Chroma database integration as processing staging area
- [x] Streaming chunk processor for 5GB+ XML files
- [x] Memory-efficient XML parser (SAX/streaming)
- [x] Chunk storage with embeddings in Chroma
- [x] Persistent collections per processing job
- [x] Collection management (create, list, delete, export)
- [x] Progress tracking for large file processing
- [x] Resume capability for interrupted processing
- [ ] Chroma management UI in dashboard
- [ ] Export from Chroma to final DBs (Neo4j, Supabase, Vector DB)


## LLM-Assisted MCP Forking (via OpenRouter)
- [ ] OpenRouter integration for MCP design prompts
- [ ] Auto-generate MCP manifest/schema from tool description
- [ ] Generate optimized tool descriptions per platform
- [ ] Create Claude MCP skills definitions via LLM
- [ ] Generate Gemini extension manifest via LLM
- [ ] Best practices templates per platform
- [ ] Fork wizard UI with LLM suggestions

## Local MCP Orchestration (Minimize Calls)
- [ ] Local tool registry with cached index
- [ ] Tool discovery caching (don't re-discover on every call)
- [ ] Request batching for same MCP server
- [ ] Smart routing (know which MCP has which tool)
- [ ] Connection pooling for local MCPs
- [ ] Periodic refresh of tool listings
- [ ] Offline mode with cached tool specs


## Smart LLM Provider Routing (Enhanced)
- [x] Route by task type (simple/complex/creative)
- [x] Route by cost (free tier → paid fallback chain)
- [x] Route by latency requirements (local vs cloud)
- [x] Route by context window needs (long docs → Gemini)
- [x] Load balancing across multiple API keys
- [x] Automatic failover on rate limits
- [x] Cost tracking and budget limits per provider

## Database Provider Routing (NEW)
- [ ] Unified export router for processed data
- [ ] Route entities with relationships → Neo4j
- [ ] Route tabular/structured data → Supabase
- [ ] Route embeddings/semantic data → Vector DB
- [ ] Route large files/blobs → S3/Content Store
- [ ] Auto-detect data type and structure
- [ ] Multi-destination export (same data to multiple DBs)
- [ ] Export validation and rollback
- [ ] Progress tracking for large exports


## Config UI (Settings Tabs)
- [ ] LLM Provider config tab (API keys, endpoints, models)
- [ ] Database routing config tab (Neo4j, Supabase, Vector DB)
- [ ] Chroma settings tab (host, port, collections)
- [ ] MCP server registry tab (add/remove servers)
- [ ] Budget & cost tracking tab (daily/monthly limits)
- [ ] Smart routing policies tab (task types, fallback chains)
- [ ] Import/export all settings as JSON

## Enhanced Security
- [ ] API key encryption at rest (not plain text)
- [ ] Encrypted storage for database credentials
- [ ] Audit logging for sensitive operations
- [ ] Session timeout for inactive users
- [ ] IP whitelisting option
- [ ] Secrets rotation reminder
- [ ] Backup/restore encrypted configs


## Model Discovery & Price Tracking
- [ ] Fetch available models from OpenRouter API
- [ ] Fetch models from Groq, Together, Mistral APIs
- [ ] Parse pricing info and identify free tier models
- [ ] Auto-update model list every 24 hours
- [ ] Track pricing changes over time
- [ ] Alert when free models become paid
- [ ] Recommend cheapest model for each task type
- [ ] Historical price data visualization
- [ ] Smart model selection (prefer free when quality is sufficient)
- [ ] A/B testing free vs paid models for quality comparison


## API Key Authentication for MCP Clients
- [x] Generate unique API keys for MCP clients (mcp_sk_...)
- [x] Store hashed keys in database with metadata
- [x] Middleware to validate Bearer token on MCP endpoints
- [x] Key management (create, list, revoke, rotate)
- [x] Usage tracking per key (calls, tokens, cost)
- [ ] Rate limiting per key
- [x] Key expiration and auto-rotation
- [x] Audit log for key usage

## AI-Generated Platform-Specific MCP Configs
- [x] LLM prompt templates for each platform (Claude, Gemini, OpenAI)
- [x] Generate skills definitions for Claude MCP
- [x] Generate extension manifest for Gemini
- [x] Generate function schemas for OpenAI
- [x] Include platform-specific optimizations (prompt caching, etc.)
- [x] Tool chain recommendations
- [x] Downloadable config files with embedded API key
- [ ] Config versioning and regeneration

## Editable System Prompts & Templates
- [x] System prompt editor for each tool
- [x] Workflow template creator (multi-tool pipelines)
- [x] Prompt versioning with git-like history
- [ ] A/B testing framework for prompts
- [x] Import/export prompt templates
- [ ] Prompt performance metrics (success rate, latency)
- [x] Default prompts for common use cases
- [x] Prompt variables and templating

## Key Management Dashboard
- [x] List all active API keys with metadata
- [x] Show last used timestamp and usage stats
- [x] Revoke/rotate keys UI
- [x] Generate new key button
- [x] Download platform-specific configs
- [x] Key permissions (read-only, full-access)
- [ ] Usage charts per key


## Wiki/Documentation System
- [x] Wiki page with comprehensive tool documentation
- [x] Tool catalog with usage examples
- [x] System architecture overview
- [x] API reference documentation
- [x] Best practices guides
- [x] Troubleshooting section
- [x] Search functionality for wiki
- [x] Markdown-based wiki content
- [ ] Version history for wiki pages

## Skills/Extensions Library
- [ ] Pre-built skills for Claude MCP
- [ ] Pre-built extensions for Gemini
- [ ] When to use each tool guide
- [ ] Tool combination workflows
- [ ] Example prompts and outputs
- [ ] Platform-specific best practices
- [ ] Downloadable skill/extension packages
- [ ] Community-contributed skills (if public)


## Bug Fixes
- [x] Fix "Explore Tools" button navigation on Home page
- [x] Fix "View Documentation" button navigation on Home page

## Pre-built Code Analysis Agents
- [ ] Code diff agent (compare files, PRs, branches)
- [ ] Code review agent (security, style, best practices)
- [ ] Dependency analysis agent (outdated, vulnerabilities)
- [ ] Codebase summarization agent
- [ ] Refactoring suggestion agent
- [ ] Test coverage analysis agent
- [ ] Agent templates page in dashboard

## Docker CLI Environment (Subscription Bridge)
- [ ] Dockerfile with Linux base + CLI tools
- [ ] Install Gemini CLI in container
- [ ] Install Claude Code CLI in container
- [ ] Install Qwen/Aider/other CLI tools
- [ ] HTTP endpoint server to invoke CLI tools
- [ ] MCP tool wrappers (gemini-mcp-tool, claude-agent-sdk)
- [ ] Authentication for CLI tool invocations
- [ ] Session management for CLI contexts
- [ ] docker-compose.yml for easy deployment
- [ ] Environment variable passthrough for API keys
- [ ] Streaming response support from CLI tools
- [ ] Container orchestration from main platform



## File Sync (Syncthing - Local ↔ VPS)
- [ ] Syncthing container in Docker stack
- [ ] Bidirectional sync between local machine and VPS
- [ ] Workspace folder sync for CLI tool context
- [ ] CLI logs sync back to local
- [ ] Syncthing GUI exposed for pairing

## Tailscale (Private Network)
- [ ] Tailscale container in Docker stack
- [ ] Private access to VPS without public ports
- [ ] CLI bridge accessible via Tailscale hostname
- [ ] MCP Tool Shop connects via Tailscale IP

