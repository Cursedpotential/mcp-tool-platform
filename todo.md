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



## Forensics & Behavioral Analysis (NEW)
- [x] Research proper naming for behavioral pattern detector tool (renamed to "Communication Pattern Analyzer")
- [x] Create database schema for forensics tables (patterns, HurtLex, BERT, severity)
- [x] Implement module-based analysis system (select which modules to run)
- [x] Build negative pattern detection modules (manipulation, gaslighting, threats, etc.)
- [x] Build positive pattern detection modules (love bombing, affirmations, kind words)
- [x] Implement HurtLex fetcher from GitHub
- [x] Add severity scoring with MCL 722.23 mapping
- [x] Create timeline generation for pattern visualization
- [x] Support dual-polarity analysis for contradiction detection
- [x] Add forensics router with tRPC endpoints
- [x] Add unit tests for pattern analyzer (24 tests passing)

## Critical Fixes from Audit (P0)
- [x] Fix LLM smart router - connect callProvider to actual provider hub
- [x] Fix ML embeddings - implement Ollama, OpenAI, Gemini embedding APIs
- [ ] Persist config manager to database (currently in-memory only)

## High Priority from Audit (P1)
- [x] Implement tool testing UI (now functional with parameter inputs and result display)
- [ ] Add import functionality to Config page


## ETL & Ingestion Pipeline Integration
- [ ] Forensics analysis runs during ETL ingestion (not standalone UI)
- [ ] Surface-level pattern tagging for meta-analysis in Supabase
- [ ] Support multi-platform corpus (conversations across backups/platforms)

## Import/Export Features
- [ ] Config page import functionality (upload JSON/YAML configs)
- [ ] Import MCP config files (claude_desktop_config.json, etc.)
- [ ] Auto-discover MCPs from imported configs for migration

## AI Schema Detection
- [ ] AI-assisted schema detection for unknown file formats
- [ ] Call LLM to analyze and identify data structures
- [ ] Generate schema resolvers for new formats

## Platform Customization (Claude/Gemini/etc)
- [ ] Platform-specific customization UI (Claude plugins vs Gemini extensions)
- [ ] AI integration to fetch/read latest platform documentation
- [ ] Context7 or documentation service integration
- [ ] Customizable prompts for building platform extensions
- [ ] Template generation for each platform's extension format


## Document Parsing (Unstructured Library)
- [ ] Integrate Unstructured library for multi-format document parsing
- [ ] Support PDF, DOCX, HTML, PPTX, images, and more
- [ ] Auto-detect document type and apply appropriate parser
- [ ] Extract structured elements (tables, headers, lists, images)
- [ ] Chunk documents intelligently for embedding/analysis


## Remote Docker CLI Bridge (VPS Integration)
- [ ] Design API contract for Docker CLI bridge
- [ ] Add VPS endpoint configuration to Settings UI
- [ ] Support Tailscale hostname/IP connection
- [ ] Support Cloudflare Tunnel connection
- [ ] Implement remote CLI provider in provider-hub
- [ ] Add connection health check and status indicator
- [ ] Create Docker CLI bridge specification document
- [ ] Add authentication token for bridge API
- [ ] Support streaming responses from remote CLI

- [ ] Add LLM routing mode toggle (API / CLI / Auto)
- [ ] Global setting in Settings UI for default routing mode
- [ ] Per-request override for routing mode
- [ ] Visual indicator showing which mode is active


## OpenRouter Integration
- [ ] Proper OpenRouter API integration with model selection
- [ ] Daily refresh of free models from OpenRouter API
- [ ] Cache free model list in database
- [ ] Display available free models in UI
- [ ] Auto-select best free model for task type


## Additional LLM Providers
- [ ] NVIDIA NIM API integration
- [ ] Ollama Cloud (check for API, fallback to VPS Docker)
- [ ] Fireworks AI integration
- [ ] Replicate integration
- [ ] DeepSeek integration
- [ ] xAI (Grok) integration
- [ ] AI21 Labs integration
- [ ] Cerebras integration
- [ ] SambaNova integration
- [ ] Lepton AI integration


## Enterprise Cloud AI & Document Processing
- [ ] Google Document AI integration (OCR, form parsing, entity extraction)
- [ ] Google Vertex AI integration (Gemini, embeddings, vision)
- [ ] AWS Textract integration (document analysis)
- [ ] AWS Comprehend integration (NLP, sentiment, entities)
- [ ] AWS Rekognition integration (image analysis)
- [ ] Azure Document Intelligence integration
- [ ] Azure AI Language integration (sentiment, NER, key phrases)
- [ ] Azure Computer Vision integration

## LangChain Integration
- [ ] LangChain document loaders
- [ ] LangChain text splitters
- [ ] LangChain retrievers
- [ ] LangChain chains for complex workflows


## Abuse & Legal Analysis Tools (Priority)
- [ ] Google Perspective API (toxicity, threat, insult, identity attack)
- [ ] OpenAI Moderation API (harassment, hate, violence detection)
- [ ] Hume AI emotion detection (nuanced emotional analysis)
- [ ] Rewire API (hate speech and abuse detection)
- [ ] Google Document AI - Legal Document processor
- [ ] AWS Comprehend targeted sentiment (sentiment on specific entities)
- [ ] Azure AI Language opinion mining (aspect-based sentiment)
- [ ] PII detection and redaction for legal submission
- [ ] Screenshot/PDF OCR for message parsing


## AWS Rekognition (Priority - Image/Screenshot Analysis)
- [ ] Text detection in screenshots (messages, timestamps, usernames)
- [ ] Face detection with emotion analysis
- [ ] Content moderation (inappropriate/explicit content detection)
- [ ] Label detection (objects, scenes, activities)
- [ ] Image properties analysis (quality, manipulation detection)
- [ ] Batch processing for multiple images
- [ ] Integration with forensics pipeline for evidence tagging


## Screenshot-to-Structured-Conversation Pipeline (Priority)
- [ ] OCR extraction with bounding boxes for message regions
- [ ] Message bubble detection (sender identification via position/color)
- [ ] Timestamp extraction and normalization
- [ ] Platform detection (iMessage, WhatsApp, Messenger, Instagram, SMS, etc.)
- [ ] Read receipt and delivery status detection
- [ ] Reaction/emoji detection
- [ ] Conversation threading and assembly logic
- [ ] EXIF metadata extraction for ordering
- [ ] Duplicate message detection across screenshots
- [ ] Gap detection in conversation flow
- [ ] Structured JSON output for forensics pipeline
- [ ] Confidence scoring for extracted content


## MCP Tool Architecture - COMPLETE CATALOG

### Atomic Tools to Implement:
- [ ] ocr.extract_text
- [ ] ocr.extract_from_pdf
- [ ] ocr.detect_text_regions
- [ ] ocr.detect_handwriting
- [ ] screenshot.detect_platform
- [ ] screenshot.extract_messages
- [ ] screenshot.extract_timestamps
- [ ] screenshot.detect_reactions
- [ ] screenshot.detect_read_receipts
- [ ] screenshot.extract_metadata
- [ ] content.analyze_sentiment
- [ ] content.detect_toxicity
- [ ] content.detect_manipulation
- [ ] content.extract_entities
- [ ] content.detect_pii
- [ ] content.redact_pii
- [ ] content.classify_intent
- [ ] content.detect_language
- [ ] image.detect_harmful_content
- [ ] image.detect_faces
- [ ] image.detect_objects
- [ ] image.analyze_quality
- [ ] image.compare_images
- [ ] forensics.analyze_patterns
- [ ] forensics.detect_gaslighting
- [ ] forensics.detect_coercive_control
- [ ] forensics.detect_love_bombing
- [ ] forensics.score_severity
- [ ] forensics.generate_timeline
- [ ] forensics.analyze_hurtlex
- [ ] forensics.detect_contradictions
- [ ] llm.chat
- [ ] llm.embed
- [ ] llm.summarize
- [ ] llm.classify
- [ ] llm.extract_structured
- [ ] document.parse
- [ ] document.chunk
- [ ] document.extract_tables
- [ ] document.extract_forms
- [ ] schema.detect
- [ ] schema.validate
- [ ] schema.transform
- [ ] schema.resolve_platform

### Workflow Tools to Implement:
- [ ] workflow.screenshot_to_conversation
- [ ] workflow.analyze_communication
- [ ] workflow.process_evidence_batch
- [ ] workflow.extract_and_classify
- [ ] workflow.legal_evidence_package

### Tool Infrastructure:
- [ ] Design atomic tool registration pattern with JSON Schema
- [ ] Create workflow tool pattern for orchestrated pipelines
- [ ] workflow.screenshot_to_conversation (full screenshot parsing pipeline)
- [ ] workflow.analyze_communication (full forensics pipeline)
- [ ] workflow.process_evidence_batch (batch processing with all analysis)
- [ ] workflow.extract_and_classify (OCR + entity extraction + classification)
- [ ] Ensure all tools return structured, parseable JSON
- [ ] Add confidence scores to all tool outputs
- [ ] Add warnings/errors array to all tool outputs


## Large File Processing (5GB+ XML/HTML)
- [ ] Chroma DB integration for vector storage
- [ ] Streaming XML parser (SAX/iterparse - no full DOM load)
- [ ] Streaming HTML parser (incremental processing)
- [ ] Semantic chunk generator (respects document structure)
- [ ] Sub-agent spawning and coordination system
- [ ] Parallel chunk processing with worker pool
- [ ] Map-reduce pattern for result aggregation
- [ ] Progress tracking for long-running jobs
- [ ] Incremental result delivery (stream results as available)
- [ ] Memory-efficient file handling (never load full file)
- [ ] Resume capability for interrupted processing
- [ ] Chunk overlap handling for context continuity

### Large File Tools:
- [ ] largefile.stream_parse - Stream parse large XML/HTML/JSON
- [ ] largefile.chunk_document - Generate semantic chunks from stream
- [ ] largefile.process_parallel - Spawn sub-agents for parallel processing
- [ ] largefile.aggregate_results - Map-reduce result aggregation
- [ ] largefile.query_chunks - Query processed chunks via Chroma
- [ ] largefile.get_progress - Check processing progress
- [ ] largefile.resume_job - Resume interrupted processing

### Chroma Integration:
- [ ] Chroma collection management
- [ ] Embedding generation for chunks
- [ ] Metadata storage (source file, position, timestamps)
- [ ] Similarity search for retrieval
- [ ] Filtered queries (by file, date range, content type)
- [ ] Collection cleanup and maintenance


## Gap Analysis - P0 Critical (Blocks Core Functionality)

### Human-in-the-Loop Gating (MISSING)
- [ ] Approval request system with `requires_approval` flag
- [ ] Preview/diff generation for destructive operations
- [ ] Rollback capability for approved operations
- [ ] `approve(approval_id, option)` endpoint
- [ ] Audit trail storage (JSONL or SQLite)
- [ ] Approval timeout and expiration
- [ ] Multi-approver support for sensitive operations

### Large-Doc Streaming (PARTIAL)
- [ ] Streaming XML parser (SAX/iterparse)
- [ ] Streaming HTML parser
- [ ] Memory-efficient processing (never load full file)
- [ ] Stable chunk IDs (content-addressed)

## Gap Analysis - P1 High Priority

### Vector Store Integration (MISSING)
- [ ] Chroma integration (pluggable)
- [ ] FAISS integration (pluggable)
- [ ] Vector store abstraction layer
- [ ] Collection management UI

### Hot-Reload Plugins (MISSING)
- [ ] Watch plugins/ directory for changes
- [ ] Full plugin manifest schema (version, dependencies, runtime)
- [ ] Plugin dependency resolution
- [ ] Plugin sandboxing/isolation

### Reliability Patterns (PARTIAL)
- [ ] Retry logic with exponential backoff
- [ ] Circuit breaker pattern
- [ ] Rate limiting per client/API key
- [ ] Health check endpoints
- [ ] Graceful degradation

## Gap Analysis - P2 Medium Priority

### Remote Runner Improvements
- [ ] gRPC transport for remote runners
- [ ] General tool routing rules (not just LLM)
- [ ] Runner health checks and automatic failover
- [ ] Load balancing across multiple runners

### Large-Doc Pipeline Enhancements
- [ ] Hierarchical summarization (chunk→section→doc)
- [ ] Citation tracking through summary levels
- [ ] BM25 retrieval alongside vector search

### Storage Enhancements
- [ ] Full lineage/provenance tracking
- [ ] Transformation history

### Observability
- [ ] Metrics export (Prometheus/OpenTelemetry)

## Gap Analysis - P3 Low Priority

### Documentation
- [ ] CHANGELOG.md with version history
- [ ] DEPLOYMENT.md with deployment instructions
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Architecture diagrams
- [ ] Contributing guidelines

### NLP Enhancements
- [ ] Project-level NLP provider configuration
- [ ] Annotation/review loop for NLP results
- [ ] NLP result caching


## ============================================
## PUNCH LIST GAPS (Original Requirements)
## ============================================

## Documentation Deliverables (MISSING)
- [ ] CHANGELOG.md (Keep a Changelog format; Unreleased + v0.1.0)
- [ ] DEPLOYMENT.md (local/hybrid/remote, secrets/auth/TLS, observability, backup/rollback, hardening checklist)

## Runner/Worker Swarm Gaps
- [ ] Retry logic with exponential backoff
- [ ] Per-task budgets (max bytes/time)
- [ ] gRPC transport for remote runners
- [ ] Checkpoint/resume improvements
- [ ] Queue depth metrics

## Database Schema Gaps (Document Intelligence)
- [ ] sections table (id, doc_id, parent_id, title, level, start_offset, end_offset)
- [ ] chunks table (id, section_id, content_hash, start_offset, end_offset, token_count)
- [ ] spans table (id, chunk_id, type, start_offset, end_offset, metadata)
- [ ] summaries table (id, target_type, target_id, level, abstract, key_claims, compression_ratio)
- [ ] entities table (id, chunk_id, type, value, start_offset, end_offset, confidence)
- [ ] keywords table (id, chunk_id, term, score, method)
- [ ] findings table (id, doc_id, type, severity, description, citations)
- [ ] approvals table (id, action_type, target, plan_json, diff_preview, status, approver, created_at, resolved_at)

## Search Plugin Gaps
- [ ] search.ugrep implementation
- [ ] search.smart (auto-select best engine)
- [ ] Fallback to JS search if binaries missing

## NLP Plugin Gaps
- [ ] nlp.make_outline (generate document outline)
- [ ] Human review/annotation loop stored in DB
- [ ] Per-project NLP provider configuration

## ML Plugin Gaps
- [ ] ml.classify(text_ref, labels) -> probabilities
- [ ] Optional GPU remote runner configuration

## Rules Engine Plugin (ENTIRE PLUGIN MISSING)
- [ ] rules.load_set(set_name) - Load rule set from YAML/JSON
- [ ] rules.list_sets() - List available rule sets
- [ ] rules.describe_set(set_name) - Get rule set details
- [ ] rules.evaluate(text_ref, set_name) - Evaluate text against rules
- [ ] rules.suggest_set(text_ref) - Suggest applicable rule sets
- [ ] YAML/JSON rule set format definition
- [ ] Rule types: regex, keywords, path patterns, structural hints
- [ ] Rule actions: move, delete, merge, label (all require approval)

## Diff/Merge/FS Gaps
- [ ] merge.propose -> patch + rationale + risks
- [ ] fs.move_path (with approval gating)
- [ ] fs.delete_path (with approval gating)
- [ ] fs.write_file approval gating

## Human-in-the-Loop Gating (ENTIRE SYSTEM MISSING)
- [ ] Approval request model with approval_id
- [ ] PLAN generation for destructive actions
- [ ] Preview/diff generation
- [ ] Rollback capability
- [ ] approve(approval_id, option) endpoint
- [ ] reject(approval_id, reason) endpoint
- [ ] Approval timeout and expiration
- [ ] Interactive CLI review UI
- [ ] Batch approval support
- [ ] Audit trail (JSONL or SQLite)

## Hierarchical Summarization Pipeline (MISSING)
- [ ] Chunk-level map: summarize individual chunks
- [ ] Section-level reduce: combine chunk summaries
- [ ] Doc-level reduce: combine section summaries
- [ ] Corpus-level reduce: combine doc summaries (optional)
- [ ] Summary JSON schema with: abstract, key_claims, entities, keywords, open_questions, risks, citations, compression_stats
- [ ] Citation format: {ref, chunk_id, start_offset, end_offset, page?, line_range?}

## Retrieval System (MISSING)
- [ ] BM25 index creation and storage
- [ ] BM25 indexing fields: title, headings, body, snippets
- [ ] retrieve_spans(question, scope, top_k, filters) API
- [ ] retrieve_outline(doc_ref) API
- [ ] retrieve_section(doc_ref, section_id, paging) API
- [ ] Context stitching algorithm
- [ ] Max-bytes/tokens rules for context assembly
- [ ] Hybrid retrieval (BM25 + embeddings)

## Document Segmentation Gaps
- [ ] Structure-aware segmentation (headings/pages/blocks first)
- [ ] Semantic chunking within structure
- [ ] Stable chunk IDs (content_hash + structural_path)
- [ ] Versioning strategy for normalization/OCR changes
- [ ] Sizing rules (tokens/chars/semantic boundaries)
- [ ] Overlap strategy configuration

## Observability Gaps
- [ ] Queue depth metrics
- [ ] Bytes processed metrics
- [ ] Cache hit metrics
- [ ] Health check endpoints (/health, /ready)
- [ ] Prometheus/OpenTelemetry export

## Processing Pipeline Contracts (MISSING)
- [ ] convert_to_markdown output contract (JSON schema)
- [ ] ocr output contract (JSON schema)
- [ ] clean_normalize output contract (JSON schema)
- [ ] segment output contract (JSON schema)
- [ ] Task graph checkpoint markers format
