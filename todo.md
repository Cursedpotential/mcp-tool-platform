

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


## Phase 15 - End-to-End Document Processing Pipeline

### Document Ingestion (Unstructured.io)
- [ ] Install and configure unstructured library
- [ ] Create Python bridge for unstructured parsing
- [ ] Implement PDF parsing with layout detection
- [ ] Implement DOCX parsing with structure preservation
- [ ] Implement HTML/XML parsing
- [ ] Add table extraction from documents
- [ ] Create unified document ingestion interface
- [ ] Handle large documents (>10MB) with streaming

### Real Embedding API Integration
- [ ] Wire Manus built-in LLM embedding API
- [ ] Implement batch embedding generation (100+ chunks)
- [ ] Add retry logic and error handling
- [ ] Optimize embedding performance (parallel requests)
- [ ] Add embedding caching to avoid duplicates
- [ ] Test with real documents (1000+ chunks)

### Supabase Integration
- [ ] Install @supabase/supabase-js client
- [ ] Create Supabase client singleton
- [ ] Implement pgvector insertion (embeddings table)
- [ ] Implement structured data insertion (documents, chunks, metadata)
- [ ] Add batch insertion for performance
- [ ] Implement upsert logic (avoid duplicates)
- [ ] Add transaction support for atomic operations
- [ ] Test with real data (100+ documents)

### Classification System
- [ ] Create sentiment classification (positive, neutral, negative, hostile, abusive)
- [ ] Create pattern detection (gaslighting, manipulation, coordinated_abuse)
- [ ] Create severity scoring (1-10 scale)
- [ ] Add confidence scoring for classifications
- [ ] Implement batch classification for chunks
- [ ] Store classifications in Supabase metadata
- [ ] Add preliminary vs final classification tracking

### End-to-End Pipeline Orchestrator
- [ ] Create DocumentPipeline class
- [ ] Implement ingest → chunk → classify → embed → store workflow
- [ ] Add progress tracking and logging
- [ ] Implement error recovery (resume from failure)
- [ ] Add pipeline metrics (processing time, chunk count, etc.)
- [ ] Create pipeline status API endpoint
- [ ] Add webhook notifications for completion
- [ ] Write integration tests for full pipeline

### Testing & Validation
- [ ] Test with small document (<1MB)
- [ ] Test with large document (>10MB)
- [ ] Test with multi-page PDF
- [ ] Test with DOCX with tables
- [ ] Test with HTML with images
- [ ] Verify pgvector semantic search works
- [ ] Verify Supabase data integrity
- [ ] Load test with 100+ documents


## Phase 16 - Multi-Pass NLP Classification (COMPLETED)
- [x] Create Pass 0: Priority screener for custody/alienation/child references
- [x] Add immediate flagging for "Kailah"/"Kyla" mentions
- [x] Add call blocking, visit blocking, parenting time denial detection
- [x] Create multi-pass NLP classifier using all tools
- [x] Pass 1: spaCy (structure, entities, speaker attribution)
- [x] Pass 2: NLTK VADER (sentiment, negation, sarcasm)
- [x] Pass 3: Pattern Analyzer (custom patterns from database + built-in)
- [x] Pass 4: TextBlob (polarity, subjectivity, sarcasm detection)
- [x] Pass 5: Sentence Transformers (semantic similarity)
- [x] Pass 6: Aggregation (consensus sentiment from all sources)
- [x] Load user's 200-hour custom patterns from database before analysis
- [x] Add dual-polarity detection (negative + positive patterns)
- [x] Add sarcasm detection (high subjectivity + contradictory polarity)
- [x] Add negation handling and intensity modifiers
- [x] Override severity with priority flags (custody interference = severity 10)


## Phase 17 - Expanded Pattern Library & Utility Integration

### Pattern Import
- [x] Create database seed script for all patterns (existing + expanded)
- [ ] Add DARVO patterns (Deny, Attack, Reverse Victim/Offender)
- [ ] Add overelaboration patterns (location reporting, time reporting, justification)
- [ ] Add positive manipulation patterns (excessive gratitude, premature intimacy, mirroring, savior complex)
- [ ] Add medical abuse patterns (medication control, diagnosis weaponization)
- [ ] Add reproductive coercion patterns
- [ ] Add power asymmetry patterns (victim deference, abuser directives)
- [ ] Add statistical linguistic markers (certainty absolutes, hedge words)
- [x] Execute seed script and verify import (256 patterns imported)

### Text Miner Integration
- [ ] Wire Text Miner as atomic MCP tool (expose search capabilities)
- [ ] Add bulk pattern search functionality
- [ ] Integrate Text Miner into document processing workflow
- [ ] Add timeline extraction from search results
- [ ] Add context window retrieval (surrounding lines)

### Advanced Analysis
- [ ] Implement DARVO sequence detection (Deny → Attack → Reverse in single context)
- [ ] Implement overelaboration detection (sentence length + justification phrase counting)
- [ ] Implement pronoun ratio analysis (I-talk vs you-talk)
- [ ] Implement hedge word vs certainty analysis
- [ ] Add power asymmetry detection (linguistic markers)

### Utility Wiring
- [ ] Wire Evidence Hasher for chain of custody
- [ ] Wire Mem0 for persistent project context
- [ ] Wire NotebookLM for forensic report generation
- [ ] Wire ML Plugin for custom model training
- [ ] Wire Summarization Plugin for conversation summaries

### Multi-Pass Classifier Refactor
- [ ] Fix Pass 1 to load user patterns from database correctly
- [ ] Fix Pass 2 to use spaCy for structure/entities correctly
- [ ] Fix Pass 3 to use NLTK VADER correctly
- [ ] Fix Pass 4 to use TextBlob correctly
- [ ] Fix Pass 5 to use Sentence Transformers correctly
- [ ] Add Pass 7: DARVO sequence detection
- [ ] Add Pass 8: Overelaboration analysis
- [ ] Add Pass 9: Pronoun ratio analysis
- [ ] Fix Pass 6 aggregation to include all new signals

### Testing
- [ ] Test pattern import with database queries
- [ ] Test Text Miner bulk search
- [ ] Test DARVO detection with real examples
- [ ] Test overelaboration detection
- [ ] Test pronoun ratio analysis
- [ ] Test end-to-end pipeline with sample documents


## Phase 18 - Conversation Segmentation & Topic Clustering

### Conversation Segmentation
- [ ] Create conversation segmentation module using Sentence Transformers
- [ ] Implement semantic similarity calculation between consecutive messages
- [ ] Add time-window based segmentation (gap > 2 hours = new cluster)
- [ ] Add entity-based segmentation (entity changes = new cluster)
- [ ] Implement cluster ID generation (PLAT_YYMM_TOPIC_iii format)
- [ ] Create topic extraction (6-char topic codes: KAILAH, VISITS, CALLS, etc.)
- [ ] Store cluster IDs with messages in database
- [ ] Add cluster metadata table (cluster_id, topic, platform, date_range, message_count)

### Topic Detection
- [ ] Implement topic code mapping (KAILAH, VISITS, CALLS, SCHOOL, MONEY, HEALTH, SUBST, INFID, THREAT, GENRL)
- [ ] Use NER (spaCy) to detect entities for topic assignment
- [ ] Use keyword matching for topic hints
- [ ] Default to GENRL when topic unclear

### Platform Codes
- [ ] Define platform code mapping (SMS, FB, IMSG, MAIL, CHAT, WA, DISC, SNAP)
- [ ] Add platform detection from message source


## Phase 19 - Admin UI & Configuration Backend

### Settings Management UI
- [ ] Create Settings page in client/src/pages/Settings.tsx
- [ ] Add NLP Configuration section (similarity threshold, time gap threshold, min cluster size)
- [ ] Add Topic Detection Configuration (BERTopic parameters, topic code mappings)
- [ ] Add Pattern Library Management (view/add/edit/delete custom patterns)
- [ ] Add Platform Code Management (add/edit platform codes)
- [ ] Add Chroma Configuration (TTL settings, collection management)
- [ ] Add Database Connection Settings (Supabase, Neo4j, pgvector)
- [ ] Add Workflow Configuration (enable/disable analysis passes, adjust weights)

### API Key Management
- [ ] Create API Keys page
- [ ] Add LLM provider key management (OpenAI, Anthropic, Cohere, etc.)
- [ ] Add external service keys (Perplexity, custom APIs)
- [ ] Add key validation and testing
- [ ] Add secure key storage (encrypted in database)

### Import/Export Functionality
- [ ] Create Import/Export page
- [ ] Add pattern library export (JSON, CSV)
- [ ] Add pattern library import (JSON, CSV)
- [ ] Add analysis results export (JSON, CSV, PDF)
- [ ] Add conversation clusters export
- [ ] Add full database backup/restore
- [ ] Add schema version management

### Pattern Library UI
- [ ] Create Pattern Library page
- [ ] Add pattern search and filtering
- [ ] Add pattern creation form (name, category, pattern, description, severity)
- [ ] Add pattern editing (inline or modal)
- [ ] Add pattern deletion with confirmation
- [ ] Add bulk pattern operations (enable/disable, delete)
- [ ] Add pattern testing (test against sample text)
- [ ] Add pattern statistics (match count, last matched, etc.)

### Workflow Configuration UI
- [ ] Create Workflow Configuration page
- [ ] Add multi-pass classifier configuration (enable/disable passes)
- [ ] Add pass weight adjustment (how much each pass contributes to final score)
- [ ] Add DARVO detection configuration (sequence detection parameters)
- [ ] Add overelaboration detection configuration (sentence length thresholds)
- [ ] Add pronoun ratio analysis configuration (thresholds for I-talk vs you-talk)
- [ ] Add topic segmentation configuration (similarity threshold, time gap)
- [ ] Add workflow testing (run sample data through configured workflow)

### Database Management UI
- [ ] Create Database Management page
- [ ] Add connection status indicators (Supabase, Neo4j, Chroma, pgvector)
- [ ] Add database statistics (record counts, storage usage)
- [ ] Add database maintenance tools (vacuum, reindex, cleanup)
- [ ] Add query console for advanced users
- [ ] Add schema migration management


## Phase 20 - Dynamic Lexicon Import System

### HurtLex Integration
- [ ] Create lexicon-importer.ts for dynamic GitHub fetching
- [ ] Fetch HurtLex from valeriobasile/hurtlex repository
- [ ] Filter for English language only (lang=en)
- [ ] Parse CSV format and extract categories
- [ ] Map HurtLex categories to our pattern categories
- [ ] Import HurtLex terms into behavioralPatterns table
- [ ] Add lexicon metadata tracking (source, version, last_updated)

### MCL Patterns Integration
- [ ] Research and find MCL abuse pattern datasets on GitHub
- [ ] Add MCL dataset to lexicon importer
- [ ] Map MCL taxonomies to our categories
- [ ] Import MCL patterns with severity scores

### Extensible Lexicon Architecture
- [ ] Create lexicon configuration system (add new lexicons via config)
- [ ] Add lexicon registry (track all imported lexicons)
- [ ] Add lexicon versioning (track updates, allow rollback)
- [ ] Add lexicon conflict resolution (handle duplicate patterns)
- [ ] Add lexicon priority system (which lexicon takes precedence)
- [ ] Add scheduled lexicon updates (auto-fetch latest versions)
- [ ] Add lexicon validation (check format, required fields)

### Additional Lexicons (Future)
- [ ] Add support for additional abuse/hate speech lexicons
- [ ] Add support for sentiment lexicons (VADER, AFINN, etc.)
- [ ] Add support for emotion lexicons (NRC, EmoLex)
- [ ] Add support for custom user lexicons


## Phase 21 - Audit Logging & Chain of Custody (Court Admissibility)

### Chain of Custody Tracking
- [ ] Create audit_logs table (append-only, immutable)
- [ ] Log file uploads (SHA-256 hash, timestamp, original filename, uploader)
- [ ] Log file integrity checks (hash verification on every access)
- [ ] Log file storage (R2 key, upload timestamp, file size, MIME type)
- [ ] Create file_custody table (file_id, event_type, timestamp, user_id, details)
- [ ] Add cryptographic signing for audit logs (tamper-proof)

### Analysis Provenance Logging
- [ ] Log every NLP pass execution (pass_id, message_id, timestamp, results)
- [ ] Log pattern matches (pattern_id, message_id, confidence, reasoning, detected_by)
- [ ] Log classification decisions (preliminary vs final, confidence deltas)
- [ ] Log meta-analysis findings (analysis_id, evidence_refs, contradictions, timestamps)
- [ ] Create analysis_provenance table (analysis_id, step, tool, input, output, timestamp)

### Data Lineage Mapping
- [ ] Create lineage graph (Message → Chunk → Cluster → Meta-Analysis)
- [ ] Link every pattern match to original message + original file
- [ ] Link every classification to NLP pass + confidence score
- [ ] Link every meta-analysis finding to preliminary assessments + evidence
- [ ] Link every contradiction to preliminary statement + final evidence + timestamps
- [ ] Create lineage_graph table (entity_id, entity_type, parent_id, relationship_type)

### Human Validation Checkpoints
- [ ] Create validation_checkpoints table (checkpoint_id, analysis_id, validator_id, status, timestamp)
- [ ] Add "Review Preliminary Analysis" checkpoint (after Pass 6)
- [ ] Add "Review Meta-Analysis" checkpoint (after full-context analysis)
- [ ] Add "Review Contradictions" checkpoint (before finalizing report)
- [ ] Log validator decisions (approved, rejected, flagged, comments)
- [ ] Add validator signature (cryptographic proof of human review)

### Manual Analysis Trigger (UI)
- [ ] Create "Start Analysis" button in UI (after all platforms ingested)
- [ ] Add pre-analysis checklist (all platforms uploaded, files verified, ready to proceed)
- [ ] Add analysis progress indicator (which pass is running, ETA)
- [ ] Add analysis pause/resume functionality
- [ ] Add analysis cancellation with rollback
- [ ] Log analysis trigger (who started, when, which platforms included)

### Hybrid Model with Overlap
- [ ] Configure multi-tool overlap (same content analyzed by multiple tools)
- [ ] Add consensus scoring (tools agree = high confidence, disagree = flag for review)
- [ ] Add disagreement detection (tools produce different results)
- [ ] Add human review for disagreements (show all tool outputs, let user decide)
- [ ] Add confidence weighting (tools with higher accuracy get more weight)
- [ ] Log consensus decisions (which tools agreed, which disagreed, final decision)

### Audit Trail Export
- [ ] Create audit trail export functionality (JSON, CSV, PDF)
- [ ] Include full chain of custody in forensic report
- [ ] Include analysis provenance (which tool detected what, when)
- [ ] Include data lineage (trace every finding back to source)
- [ ] Include human validation records (who reviewed, when, decisions)
- [ ] Add cryptographic signature to exported audit trail (tamper-proof)

### Best Practices for Custody Cases
- [ ] Implement append-only audit logs (no deletions, no modifications)
- [ ] Add SHA-256 hashing for all files (integrity verification)
- [ ] Add UTC timestamps + local timezone for all events
- [ ] Add user attribution for all actions (who did what, when)
- [ ] Add immutable snapshots at key checkpoints (can't be changed after validation)
- [ ] Add export to court-admissible formats (PDF with signatures)
