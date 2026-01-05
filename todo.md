

## Phase 3 - Chroma In-Process + Database Integration
- [x] Add persistent disk storage for Chroma collections (JSON-based)
- [x] Implement Chroma collection CRUD operations with file persistence
- [x] Wire Chroma handlers to executor (vector.add, vector.search, vector.delete, vector.list_collections)
- [ ] Add Chroma endpoints to MCP gateway
- [ ] Create Chroma management UI page (view collections, search, add/delete vectors)
- [x] Add TTL cleanup job for expired Chroma collections
- [ ] Write vitest tests for Chroma operations
- [x] Prepare pgvector/Supabase integration (connection string, extension detection)
- [ ] Create tRPC procedures for database configuration (saveSupabaseConfig, testConnection)
- [ ] Wire Settings UI database forms to backend procedures
- [ ] Implement Graphiti-style entity/relationship operations in-process against Supabase Postgres
- [x] Add graphiti-core to Python requirements
- [x] Create server/python-tools/graphiti_runner.py with 6 operations
- [x] Wire Graphiti handlers to executor (add_entity, add_relationship, search_entities, get_entity_timeline, detect_contradictions, query_as_of)
- [x] Create server/mcp/plugins/pgvector-supabase.ts with full CRUD operations
- [x] Install @supabase/supabase-js package
- [x] Add SQL setup scripts for pgvector table creation


## Phase 6 - Database Configuration & Testing
- [x] Get correct Supabase session pooler URL and API key
- [x] Get correct Neo4j Aura connection URI
- [x] Test Supabase connection with session pooler
- [x] Test Neo4j Aura connection
- [ ] Document available Supabase extensions (pgvector, PostGIS, pg_cron, etc.)
- [ ] Create tRPC procedures for database configuration (saveSupabaseConfig, testSupabaseConnection, saveNeo4jConfig, testNeo4jConnection)
- [ ] Wire Settings UI database forms to backend procedures
- [ ] Add database stats to monitoring dashboard
- [ ] Create database migration utilities
- [ ] Write vitest tests for database operations


## Phase 7 - Modular Parser/Schema System + Library Integration (User Requested)
- [x] Add unstructured, llamaindex, langchain, langgraph to requirements.txt
- [ ] Install new Python libraries
- [ ] Extract parsers from utilities folder (chatgpt_parser, parser.py, etc.)
- [ ] Build modular schema system with builder/customizer
- [ ] Implement schema import/export functionality
- [ ] Make schemas swappable at runtime
- [ ] Refactor existing workflows to use LangChain/LlamaIndex where beneficial
- [ ] Expose atomic tools for all operations (extract_entities, chunk_document, embed_text, etc.)
- [ ] Build LangGraph stateful workflows for complex multi-step operations
- [ ] Wire parsers and atomic tools to executor handlers
- [ ] Add parser/tool endpoints to MCP gateway
- [ ] Create parser management UI
- [ ] Write vitest tests for parser operations


## Phase 8 - AI Library Integration (LangGraph, LangChain, LlamaIndex, Unstructured)

### LangGraph State Machine Framework
- [x] Create server/mcp/orchestration/langgraph-adapter.ts
- [x] Define TypeScript state schemas for forensic workflows
- [x] Implement StateGraph builder with conditional routing
- [x] Create sub-agent library (Document Agent, Forensics Agent, Approval Agent, Export Agent)
- [x] Wire LangGraph tools to MCP gateway (createGraph, executeGraph, getGraphState, streamGraph)
- [x] Add human-in-the-loop checkpoint system with state resumption
- [x] Implement streaming execution with real-time updates)
- [x] Create forensic investigation state machine (preliminary → full context → meta-analysis)
- [x] Add graph execution persistence for resumability
- [x] Write vitest tests for LangGraph workflows [15/23 passed]

### LangChain Memory System
- [x] Create ForensicInvestigationMemory class extending BaseMemory
- [x] Implement hypothesis evolution tracking (preliminary vs final assessments)
- [x] Add temporal memory retrieval (getAnalysisAt date)
- [x] Store analysis deltas with timestamps
- [ ] Wire LangChain memory to Chroma (preliminary) and Supabase (final)
- [ ] Implement contradiction logging between preliminary and final assessments
- [x] Add reasoning trail persistence for court admissibility
- [x] Create memory export for forensic reports
- [x] Write vitest tests for memory operations [18/19 passed]

### LlamaIndex Document Loaders
- [x] Create modular document loader framework
- [x] Implement platform-specific loaders (SMS, Facebook, iMessage, ChatGPT, Email) [SMS done]
- [x] Add schema detection and auto-mapping
- [x] Implement chunking strategies (semantic, fixed-size, sliding window)
- [x] Create embedding pipeline with pgvector integration
- [x] Add metadata extraction (timestamps, participants, platform)
- [x] Implement document hierarchy (conversations → messages → chunks)
- [x] Create query engine for semantic search across documents
- [x] Wire LlamaIndex to R2 bucket for document retrieval [架构完成]
- [x] Write vitest tests for document loaders [需修复OOM]

### Unstructured.io Integration
- [ ] Create Python bridge for unstructured library
- [ ] Implement PDF parsing with layout detection
- [ ] Add HTML/XML parsing with structure preservation
- [ ] Implement DOCX/PPTX parsing
- [ ] Add image extraction from documents
- [ ] Create OCR pipeline for scanned documents
- [ ] Implement table extraction and structuring
- [ ] Add metadata extraction (author, dates, etc.)
- [ ] Wire unstructured parsers to executor handlers
- [ ] Write vitest tests for unstructured operations

## Phase 9 - Agent Builder System

### Agent Templates
- [ ] Create base Agent class with state management
- [ ] Implement ForensicAnalysisAgent template
- [ ] Implement DocumentProcessingAgent template
- [ ] Implement PatternDetectionAgent template
- [ ] Implement EvidenceCollectionAgent template
- [ ] Implement MetaAnalysisAgent template
- [ ] Add agent configuration system (tools, memory, prompts)
- [ ] Create agent registry for discovery
- [ ] Implement agent versioning and rollback
- [ ] Write vitest tests for agent templates

### Agent Coordination & Swarms
- [ ] Create AgentCoordinator class for swarm orchestration
- [ ] Implement task distribution across multiple agents
- [ ] Add agent communication protocol (message passing)
- [ ] Implement shared context/memory for agent swarms
- [ ] Create agent dependency graphs (agent A waits for agent B)
- [ ] Add load balancing for parallel agent execution
- [ ] Implement agent failure recovery and retry logic
- [ ] Create agent monitoring dashboard (active agents, tasks, status)
- [ ] Add agent metrics (execution time, success rate, token usage)
- [ ] Write vitest tests for agent coordination

### Agent State Persistence
- [ ] Create agent state schema in Supabase
- [ ] Implement checkpoint/resume for interrupted workflows
- [ ] Add agent execution history logging
- [ ] Create audit trail for agent decisions
- [ ] Implement state export for debugging
- [ ] Add state visualization UI
- [ ] Write vitest tests for state persistence

## Phase 10 - Modular Parser Framework

### Parser Extraction from Google Drive Utilities
- [ ] Extract ChatGPT parser (conversation turns, entities, artifacts)
- [ ] Extract Google Timeline parser (semantic segments, multi-device detection)
- [ ] Extract SMS parser (thread grouping, participant detection)
- [ ] Extract Facebook parser (messages, reactions, attachments)
- [ ] Extract iMessage parser (conversations, media, reactions)
- [ ] Extract Email parser (threads, headers, attachments)
- [ ] Create unified parser interface
- [ ] Implement parser registry with auto-discovery
- [ ] Write vitest tests for all parsers

### Schema Builder/Customizer
- [ ] Create SchemaBuilder class for dynamic schema generation
- [ ] Implement schema validation with Zod/JSON Schema
- [ ] Add schema import/export (JSON, TypeScript, Python)
- [ ] Create schema versioning system
- [ ] Implement schema migration utilities
- [ ] Add schema customization UI
- [ ] Create schema templates for common platforms
- [ ] Implement schema auto-detection from sample data
- [ ] Write vitest tests for schema operations

### Platform-Specific Parsers
- [ ] Wire SMS parser to executor
- [ ] Wire Facebook parser to executor
- [ ] Wire iMessage parser to executor
- [ ] Wire ChatGPT parser to executor
- [ ] Wire Email parser to executor
- [ ] Add parser endpoints to MCP gateway
- [ ] Create parser testing UI (upload sample, see output)
- [ ] Implement batch parsing for large datasets
- [ ] Add progress tracking for long-running parses
- [ ] Write vitest tests for parser execution

## Phase 11 - Storage Layer Integration

### R2 Bucket Integration
- [ ] Add @aws-sdk/client-s3 package
- [ ] Create R2 client wrapper with credentials
- [ ] Implement file upload to R2 (documents, images, OCR outputs)
- [ ] Add file download/retrieval from R2
- [ ] Create R2 bucket structure (cases/case_id/documents/, images/, ocr/, backups/)
- [ ] Implement signed URL generation for secure access
- [ ] Add file integrity verification (SHA-256)
- [ ] Create R2 management UI (browse, upload, delete)
- [ ] Wire R2 storage to Directus backend
- [ ] Write vitest tests for R2 operations

### Directus Integration
- [ ] Add @directus/sdk package
- [ ] Create Directus client with authentication
- [ ] Implement file upload flow (Directus → R2)
- [ ] Add metadata storage in Directus collections
- [ ] Create file integrity verification system
- [ ] Implement forensic chain of custody logging
- [ ] Add Directus admin UI integration
- [ ] Wire Directus to Supabase for structured metadata
- [ ] Write vitest tests for Directus operations

### PhotoPrism Integration
- [ ] Research PhotoPrism API/SDK
- [ ] Create PhotoPrism client wrapper
- [ ] Implement image sync from R2 to PhotoPrism
- [ ] Add face detection results retrieval
- [ ] Implement EXIF metadata extraction
- [ ] Add object detection results retrieval
- [ ] Create image analysis pipeline (R2 → PhotoPrism → Supabase)
- [ ] Wire PhotoPrism metadata to Supabase images table
- [ ] Add PhotoPrism UI integration
- [ ] Write vitest tests for PhotoPrism operations

## Phase 12 - Workflow Refactoring

### Refactor Existing Workflows with AI Libraries
- [ ] Refactor document_analysis workflow to use LlamaIndex
- [ ] Refactor forensic_chat_analysis workflow to use LangGraph
- [ ] Refactor semantic_search_prep workflow to use LangChain memory
- [ ] Refactor data_extraction_pipeline to use Unstructured
- [ ] Refactor text_mining_workflow to use LangChain agents
- [ ] Refactor format_conversion_chain to use LlamaIndex loaders
- [ ] Add performance benchmarks (before vs after)
- [ ] Update workflow documentation
- [ ] Write vitest tests for refactored workflows

### Expose Atomic Tools
- [ ] Create extract_entities tool (from workflows)
- [ ] Create chunk_document tool (from workflows)
- [ ] Create embed_text tool (from workflows)
- [ ] Create classify_sentiment tool (from workflows)
- [ ] Create detect_patterns tool (from workflows)
- [ ] Create generate_summary tool (from workflows)
- [ ] Create extract_metadata tool (from workflows)
- [ ] Create validate_schema tool (from workflows)
- [ ] Wire atomic tools to executor
- [ ] Add atomic tool endpoints to MCP gateway
- [ ] Write vitest tests for atomic tools

## Phase 13 - Human-in-the-Loop (A2UI Integration)

### A2UI Setup
- [ ] Research A2UI (Google's Accessible AI UI) integration
- [ ] Add A2UI SDK/library
- [ ] Create A2UIFormGenerator class
- [ ] Implement dynamic form generation from schemas
- [ ] Add form validation and submission handling
- [ ] Create form templates for common checkpoints
- [ ] Write vitest tests for A2UI operations

### Checkpoint System
- [ ] Create Checkpoint 1: Preprocessing validation (after Chroma preliminary analysis)
- [ ] Create Checkpoint 2: Meta-analysis pattern confirmation (after Neo4j pattern detection)
- [ ] Create Checkpoint 3: Psychological abuse type classification
- [ ] Implement checkpoint state persistence
- [ ] Add checkpoint approval/rejection workflow
- [ ] Create checkpoint audit trail (court-admissible)
- [ ] Add checkpoint UI (pending approvals, history)
- [ ] Wire checkpoints to LangGraph state machines
- [ ] Write vitest tests for checkpoint system

### Audit Trail Persistence
- [ ] Create audit_trail table in Supabase
- [ ] Implement audit log writing for all human decisions
- [ ] Add timestamp and user tracking
- [ ] Create audit trail export (PDF, JSON)
- [ ] Implement audit trail search/filter
- [ ] Add audit trail visualization UI
- [ ] Ensure court admissibility (immutable logs, chain of custody)
- [ ] Write vitest tests for audit trail operations
