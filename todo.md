

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


## Phase 22 - End-to-End Document Processing Pipeline

### Stubbed Supabase Table Schemas
- [ ] Create sms_messages table schema (stubbed, user will provide real schema)
- [ ] Create facebook_messages table schema (stubbed)
- [ ] Create imessage_messages table schema (stubbed)
- [ ] Create email_messages table schema (stubbed)
- [ ] Create chatgpt_conversations table schema (stubbed)
- [ ] Add common fields (id, text, timestamp, sender, platform, conversation_cluster_id)
- [ ] Add analysis fields (preliminary_sentiment, preliminary_severity, preliminary_patterns, preliminary_confidence)

### Format-Specific Parsers
- [ ] Build Facebook HTML parser (handle excessively long files, nested threads)
- [ ] Build XML SMS parser (handle multi-gig files, streaming parser)
- [ ] Build PDF iMessage parser (extract text, preserve timestamps, handle attachments)
- [ ] Build generic CSV parser (flexible column mapping)
- [ ] Build JSON parser (ChatGPT exports, generic JSON formats)
- [ ] Add format auto-detection (detect format from file extension + content)

### Complete Pipeline Orchestrator
- [ ] Create DocumentProcessingPipeline class
- [ ] Step 1: Format detection + parser selection
- [ ] Step 2: Parse document → extract messages
- [ ] Step 3: Run multi-pass NLP classifier on each message
- [ ] Step 4: Assign conversation cluster IDs
- [ ] Step 5: Export individual messages to Supabase
- [ ] Add progress tracking (X of Y messages processed)
- [ ] Add error handling (skip malformed messages, log errors)
- [ ] Add resume capability (restart from last processed message)

### Supabase Export Module
- [ ] Create SupabaseExporter class
- [ ] Implement batch insertion (100 messages at a time)
- [ ] Implement upsert logic (avoid duplicates)
- [ ] Add transaction support (all-or-nothing insertion)
- [ ] Add retry logic (handle network failures)
- [ ] Log export operations (audit trail)

### Testing
- [ ] Test with sample Facebook HTML export
- [ ] Test with sample XML SMS export (multi-gig simulation)
- [ ] Test with sample PDF iMessage export
- [ ] Verify individual messages in Supabase
- [ ] Verify analysis fields populated correctly
- [ ] Verify conversation cluster IDs assigned


## Phase 23 - Production Schema & Proper Routing

### Update Database Schemas
- [ ] Replace stubbed message-schemas.ts with production schema from user
- [ ] Create messaging_documents table (chain of custody with SHA-256)
- [ ] Create messaging_conversations table (thread grouping)
- [ ] Create messaging_messages table (core forensic record with 40+ fields)
- [ ] Create messaging_attachments table (MMS/media with OCR)
- [ ] Create messaging_behaviors table (detected patterns with confidence/severity)
- [ ] Create messaging_evidence_items table (court-ready evidence)
- [ ] Create messaging_factor_citations table (MCL factor links)
- [ ] Create mcl_factors reference table (A-L best interest factors)
- [ ] Create behavior_categories reference table (18 categories)
- [ ] Add indexes for performance (conversation_id, timestamp, sender, body_lower)
- [ ] Add RLS policies for multi-user access

### Refactor Pipeline for Large Documents
- [ ] Add document chunking (split 400-page HTML into manageable chunks)
- [ ] Store chunks in Chroma during classification (working memory)
- [ ] Implement streaming classification (process chunks without loading entire file)
- [ ] Add progress tracking (chunk X of Y)
- [ ] Ensure LLM doesn't choke on large documents
- [ ] Clear Chroma after classification complete (72hr TTL)

### Wire Neo4j/Graphiti for Entities
- [ ] Extract entities from messages (people, places, events, medical terms)
- [ ] Extract relationships (person A mentioned person B, event X happened at place Y)
- [ ] Store in Neo4j using Graphiti
- [ ] Link entities back to source messages (bidirectional)
- [ ] Add temporal relationships (entity mentions over time)

### Wire Directus for Raw File Storage
- [ ] Upload raw file to R2 bucket via Directus
- [ ] Calculate SHA-256 hash before upload
- [ ] Store file metadata in messaging_documents table
- [ ] Link processed messages back to source file
- [ ] Implement chain of custody tracking

### Routing Logic
- [ ] Individual messages → Supabase (messaging_messages table)
- [ ] Entities/relationships → Neo4j/Graphiti
- [ ] Raw file → Directus → R2 bucket
- [ ] Chunks during classification → Chroma (temporary, 72hr TTL)
- [ ] Ensure all routes happen in correct order

### Testing
- [ ] Create 400-page Facebook HTML test file
- [ ] Run through complete pipeline
- [ ] Verify chunking works (no LLM choking)
- [ ] Verify Chroma storage during classification
- [ ] Verify Supabase message insertion
- [ ] Verify Neo4j entity extraction
- [ ] Verify Directus/R2 raw file storage
- [ ] Verify chain of custody tracking


---

## **Phase 26: Documentation Generation (Wiki-Style)**

### **Documentation Structure**
- [ ] Create `/docs` directory in project root
- [ ] Create `/docs/tools` subdirectory (individual tool docs)
- [ ] Create `/docs/workflows` subdirectory (workflow docs)
- [ ] Create `/docs/systems` subdirectory (system component docs)
- [ ] Create `/docs/guides` subdirectory (user guides)
- [ ] Create `/docs/api` subdirectory (API reference)
- [ ] Create `/docs/images` subdirectory (diagrams, screenshots)

### **System Overview Documentation**
- [ ] `/docs/README.md` - Main documentation index with links to all docs
- [ ] `/docs/ARCHITECTURE.md` - High-level system architecture (already exists, may need updates)
- [ ] `/docs/GETTING_STARTED.md` - Quick start guide for new users
- [ ] `/docs/INSTALLATION.md` - Installation and setup instructions
- [ ] `/docs/CONFIGURATION.md` - Configuration guide (env vars, settings)
- [ ] `/docs/DEPLOYMENT.md` - Deployment guide (Manus hosting, Docker)
- [ ] `/docs/TROUBLESHOOTING.md` - Common issues and solutions

### **Tool Documentation (60+ tools)**
Each tool needs: Purpose, Parameters, Return Values, Examples, Related Tools

#### Search Tools
- [ ] `/docs/tools/search-web.md` - Web search tool
- [ ] `/docs/tools/search-semantic.md` - Semantic search tool
- [ ] `/docs/tools/search-tavily.md` - Tavily LLM-optimized search
- [ ] `/docs/tools/search-perplexity.md` - Perplexity search

#### Document Tools
- [ ] `/docs/tools/document-parse.md` - Document parsing tool
- [ ] `/docs/tools/document-ocr.md` - OCR tool
- [ ] `/docs/tools/document-extract.md` - Text extraction tool
- [ ] `/docs/tools/document-chunk.md` - Document chunking tool

#### NLP Tools
- [ ] `/docs/tools/nlp-sentiment.md` - Sentiment analysis tool
- [ ] `/docs/tools/nlp-entities.md` - Entity extraction tool
- [ ] `/docs/tools/nlp-classify.md` - Text classification tool
- [ ] `/docs/tools/nlp-summarize.md` - Summarization tool
- [ ] `/docs/tools/nlp-spacy.md` - spaCy integration
- [ ] `/docs/tools/nlp-nltk.md` - NLTK integration
- [ ] `/docs/tools/nlp-textblob.md` - TextBlob integration
- [ ] `/docs/tools/nlp-transformers.md` - Sentence Transformers

#### Forensics Tools
- [ ] `/docs/tools/forensics-analyze-patterns.md` - Pattern analysis tool
- [ ] `/docs/tools/forensics-detect-hurtlex.md` - HurtLex detection
- [ ] `/docs/tools/forensics-score-severity.md` - Severity scoring
- [ ] `/docs/tools/forensics-get-modules.md` - Get analysis modules
- [ ] `/docs/tools/forensics-multi-pass-classifier.md` - Multi-pass NLP classifier
- [ ] `/docs/tools/forensics-priority-screener.md` - Priority screener (Pass 0)

#### Vector Database Tools
- [ ] `/docs/tools/vector-add.md` - Add embeddings to vector DB
- [ ] `/docs/tools/vector-search.md` - Semantic search in vector DB
- [ ] `/docs/tools/vector-delete.md` - Delete embeddings
- [ ] `/docs/tools/vector-chroma.md` - Chroma integration
- [ ] `/docs/tools/vector-pgvector.md` - pgvector/Supabase integration
- [ ] `/docs/tools/vector-qdrant.md` - Qdrant integration

#### Graph Database Tools
- [ ] `/docs/tools/graph-add-entity.md` - Add entity to graph
- [ ] `/docs/tools/graph-add-relationship.md` - Add relationship to graph
- [ ] `/docs/tools/graph-search-entities.md` - Search entities
- [ ] `/docs/tools/graph-timeline.md` - Get entity timeline
- [ ] `/docs/tools/graph-contradictions.md` - Detect contradictions
- [ ] `/docs/tools/graph-neo4j.md` - Neo4j integration
- [ ] `/docs/tools/graph-graphiti.md` - Graphiti integration

#### LLM Tools
- [ ] `/docs/tools/llm-invoke.md` - Invoke LLM
- [ ] `/docs/tools/llm-embed.md` - Generate embeddings
- [ ] `/docs/tools/llm-smart-router.md` - Smart LLM routing
- [ ] `/docs/tools/llm-providers.md` - LLM provider overview

#### Format Conversion Tools
- [ ] `/docs/tools/format-convert.md` - Format conversion tool
- [ ] `/docs/tools/format-parse.md` - Format parsing tool
- [ ] `/docs/tools/format-check-schema.md` - Schema validation
- [ ] `/docs/tools/format-ocr.md` - OCR tool

#### Evidence Chain Tools
- [ ] `/docs/tools/evidence-create-chain.md` - Create evidence chain
- [ ] `/docs/tools/evidence-add-stage.md` - Add stage to chain
- [ ] `/docs/tools/evidence-verify.md` - Verify evidence integrity
- [ ] `/docs/tools/evidence-hash-file.md` - Hash file (SHA-256)
- [ ] `/docs/tools/evidence-export.md` - Export evidence chain
- [ ] `/docs/tools/evidence-report.md` - Generate evidence report

#### Text Mining Tools
- [ ] `/docs/tools/text-mine.md` - Text mining tool (ugrep/ripgrep)

#### Schema Tools
- [ ] `/docs/tools/schema-resolve.md` - Schema resolution
- [ ] `/docs/tools/schema-apply.md` - Apply schema
- [ ] `/docs/tools/schema-cache.md` - Schema caching

### **Workflow Documentation**
Each workflow needs: Purpose, Steps, Input/Output, Diagram, Examples

- [ ] `/docs/workflows/forensic-investigation.md` - 8-stage forensic investigation workflow
- [ ] `/docs/workflows/document-processing.md` - Document processing workflow
- [ ] `/docs/workflows/document-analysis.md` - Document analysis workflow
- [ ] `/docs/workflows/forensic-chat-analysis.md` - Chat analysis workflow
- [ ] `/docs/workflows/semantic-search-prep.md` - Semantic search preparation
- [ ] `/docs/workflows/data-extraction-pipeline.md` - Data extraction pipeline
- [ ] `/docs/workflows/text-mining-workflow.md` - Text mining workflow
- [ ] `/docs/workflows/format-conversion-chain.md` - Format conversion chain

### **System Component Documentation**
- [ ] `/docs/systems/mcp-gateway.md` - MCP Gateway API
- [ ] `/docs/systems/plugin-system.md` - Plugin architecture
- [ ] `/docs/systems/executor.md` - Tool executor
- [ ] `/docs/systems/smart-router.md` - Smart LLM routing
- [ ] `/docs/systems/chroma-storage.md` - Chroma working memory
- [ ] `/docs/systems/supabase-integration.md` - Supabase integration
- [ ] `/docs/systems/neo4j-integration.md` - Neo4j/Graphiti integration
- [ ] `/docs/systems/r2-directus-storage.md` - R2/Directus file storage
- [ ] `/docs/systems/langgraph-state-machines.md` - LangGraph workflows
- [ ] `/docs/systems/langchain-memory.md` - LangChain memory system
- [ ] `/docs/systems/llamaindex-loaders.md` - LlamaIndex document loaders
- [ ] `/docs/systems/multi-pass-classifier.md` - Multi-pass NLP classification
- [ ] `/docs/systems/pattern-library.md` - 256-pattern behavioral library
- [ ] `/docs/systems/embedding-pipeline.md` - Embedding generation pipeline
- [ ] `/docs/systems/audit-logging.md` - Audit trail and chain of custody
- [ ] `/docs/systems/hitl-checkpoints.md` - Human-in-the-loop system

### **User Guides**
- [ ] `/docs/guides/uploading-documents.md` - How to upload documents
- [ ] `/docs/guides/running-analysis.md` - How to run forensic analysis
- [ ] `/docs/guides/managing-patterns.md` - How to manage custom patterns
- [ ] `/docs/guides/configuring-llm-providers.md` - How to configure LLM providers
- [ ] `/docs/guides/building-workflows.md` - How to build custom workflows
- [ ] `/docs/guides/creating-agents.md` - How to create custom agents
- [ ] `/docs/guides/exporting-results.md` - How to export analysis results
- [ ] `/docs/guides/court-admissibility.md` - Ensuring court-admissible evidence

### **API Reference**
- [ ] `/docs/api/mcp-gateway.md` - MCP Gateway API reference
- [ ] `/docs/api/trpc-procedures.md` - tRPC procedures reference
- [ ] `/docs/api/rest-endpoints.md` - REST API endpoints
- [ ] `/docs/api/websocket-api.md` - WebSocket API (log streaming)
- [ ] `/docs/api/authentication.md` - Authentication and authorization

### **Developer Documentation**
- [ ] `/docs/CONTRIBUTING.md` - How to contribute
- [ ] `/docs/DEVELOPMENT.md` - Development setup
- [ ] `/docs/TESTING.md` - Testing guide
- [ ] `/docs/CODE_STYLE.md` - Code style guide
- [ ] `/docs/PLUGIN_DEVELOPMENT.md` - How to create plugins
- [ ] `/docs/TOOL_DEVELOPMENT.md` - How to create tools

### **Documentation Standards**
Each document should follow this template:
```markdown
# [Tool/Workflow/System Name]

## Overview
Brief description (2-3 sentences)

## Purpose
What problem does this solve?

## Parameters/Configuration
List of inputs with types and descriptions

## Return Values/Output
What does this produce?

## Examples
Code examples with explanations

## Related Tools/Systems
Links to related documentation

## Troubleshooting
Common issues and solutions

## See Also
Links to related docs
```

### **Documentation Generation Tasks**
- [ ] Create documentation template generator script
- [ ] Generate skeleton markdown files for all tools
- [ ] Generate skeleton markdown files for all workflows
- [ ] Generate skeleton markdown files for all systems
- [ ] Create documentation index with auto-generated table of contents
- [ ] Add Mermaid diagrams for workflows
- [ ] Add code examples for all tools
- [ ] Add screenshots for UI components
- [ ] Generate API reference from TypeScript types
- [ ] Create searchable documentation site (MkDocs, Docusaurus, or VitePress)



---

## **Phase 28: VPS Failover & Provider Independence**

### VPS Web App Deployment
- [ ] Create Dockerfile for full Manus app (client + server)
- [ ] Add web app service to docker-compose.yml
- [ ] Configure Nginx reverse proxy for web app
- [ ] Set up SSL/TLS certificates (Let's Encrypt)
- [ ] Configure environment variables for VPS deployment
- [ ] Test web app deployment on VPS
- [ ] Create deployment script (one-command deploy)

### Database Migration Scripts
- [ ] Create script to export all data from Manus/Supabase
- [ ] Create script to import data to VPS databases
- [ ] Test full database migration (Supabase → VPS Postgres)
- [ ] Create incremental sync script (keep VPS up-to-date)

### DNS & Traffic Routing
- [ ] Document DNS configuration for custom domain
- [ ] Create traffic routing script (switch between Manus ↔ VPS)
- [ ] Set up health checks for automatic failover
- [ ] Test manual failover (Manus → VPS)
- [ ] Test automatic failover on Manus downtime

### Data Synchronization
- [ ] Set up bidirectional sync for user data
- [ ] Configure R2 as shared storage layer
- [ ] Create conflict resolution strategy
- [ ] Test real-time sync between Manus and VPS

### Monitoring & Alerts
- [ ] Set up uptime monitoring for both Manus and VPS
- [ ] Create alert system for failover events
- [ ] Add cost tracking dashboard (Manus vs VPS)
- [ ] Document rollback procedure (VPS → Manus)

### Documentation
- [ ] Create VPS deployment guide
- [ ] Document failover procedure (step-by-step)
- [ ] Create troubleshooting guide
- [ ] Document cost comparison (Manus vs VPS vs hybrid)

---

## **Phase 29: LiteLLM + MetaMCP Integration**

### LiteLLM Server-Side Integration
- [ ] Implement routeLLM() function in server/_core/router.ts
- [ ] Add LiteLLM client to server/_core/llm.ts
- [ ] Update invokeLLM() to use intelligent routing
- [ ] Add cost tracking for LLM calls
- [ ] Test fallback routing (Manus → LiteLLM → Direct API)
- [ ] Add LiteLLM metrics to monitoring dashboard

### MetaMCP Integration
- [ ] Implement MCP server registration in Dockerfile.metamcp
- [ ] Add tool discovery API endpoints
- [ ] Implement routeMCPTool() function in router.ts
- [ ] Connect local MCP gateway to MetaMCP registry
- [ ] Add MCP tool caching (Redis)
- [ ] Test cross-server tool execution

### Chroma Routing
- [ ] Implement routeVectorSearch() with TTL vs persistent logic
- [ ] Add Chroma VPS client to server
- [ ] Update vector operations to use intelligent routing
- [ ] Test in-process (TTL) vs VPS (persistent) Chroma
- [ ] Add automatic cleanup for expired TTL collections

### Neo4j Routing
- [ ] Implement routeGraphQuery() function
- [ ] Add connection pooling for Neo4j VPS
- [ ] Test VPS → Aura fallback
- [ ] Add graph query caching

### Health Checks & Monitoring
- [ ] Implement checkServiceHealth() for all VPS services
- [ ] Add automatic failover on service degradation
- [ ] Create service health dashboard
- [ ] Add cost tracking for all services

---

## **Phase 30: Kasm Workspace Setup**

### Kasm Configuration
- [ ] Build Kasm Dockerfile with all CLI tools
- [ ] Configure rclone for R2 bidirectional sync
- [ ] Set up auto-sync timer (every 5 minutes)
- [ ] Test workspace sync (local ↔ R2 ↔ desktop)
- [ ] Add desktop shortcuts (VS Code, Sync, etc.)

### CLI Tool Configuration
- [ ] Configure Claude CLI with API key
- [ ] Configure Gemini CLI with API key
- [ ] Test Aider (AI pair programming)
- [ ] Test Cursor (AI code editor)
- [ ] Configure GitHub CLI authentication

### Agent Access
- [ ] Create SSH access for agents to Kasm container
- [ ] Add CLI wrapper scripts for agent calls
- [ ] Test agent → Claude CLI execution
- [ ] Test agent → Gemini CLI execution
- [ ] Add usage tracking for CLI calls

---

## **Phase 31: Documentation Generation (Delegate to Free Model)**

### Tool Documentation (60+ files)
- [ ] Use DOCUMENTATION_HANDOFF.md to generate tool docs
- [ ] Review and edit generated documentation
- [ ] Add code examples to each tool doc
- [ ] Add usage statistics and best practices

### Workflow Documentation (20+ files)
- [ ] Generate workflow documentation
- [ ] Add workflow diagrams
- [ ] Document input/output schemas
- [ ] Add troubleshooting sections

### System Documentation (15+ files)
- [ ] Generate system architecture docs
- [ ] Add deployment guides
- [ ] Document API endpoints
- [ ] Create developer onboarding guide


---

## **Phase 32: AWS AI Services Integration**

### AWS SDK Setup
- [ ] Install AWS SDKs (`@aws-sdk/client-rekognition`, `@aws-sdk/client-comprehend`, `@aws-sdk/client-textract`)
- [ ] Configure AWS credentials in .env.docker
- [ ] Initialize AWS clients in server/_core/aws-ai.ts
- [ ] Test AWS connection and permissions

### Rekognition Integration
- [ ] Implement detectFaces() for screenshot analysis
- [ ] Implement detectLabels() for context detection
- [ ] Implement detectTextInImage() for OCR
- [ ] Test with sample screenshots
- [ ] Add error handling and retries

### Comprehend Integration
- [ ] Implement analyzeSentiment() for conversation tone
- [ ] Implement extractEntities() for people/places/orgs
- [ ] Implement detectPII() for redaction
- [ ] Test with sample conversation text
- [ ] Add batch processing support

### Textract Integration
- [ ] Implement extractDocumentText() for simple OCR
- [ ] Implement analyzeDocument() for tables/forms
- [ ] Test with receipts, invoices, forms
- [ ] Add support for multi-page documents

### Screenshot Analysis Pipeline
- [ ] Implement analyzeScreenshot() complete pipeline
- [ ] Combine Rekognition + Comprehend results
- [ ] Store results in Supabase
- [ ] Add caching to avoid duplicate analysis
- [ ] Create tRPC procedures for frontend access

---

## **Phase 33: GCP AI Services Integration**

### GCP SDK Setup
- [ ] Install GCP SDKs (`@google-cloud/documentai`, `@google-cloud/aiplatform`, `@google-cloud/notebooks`)
- [ ] Create GCP service account with required permissions
- [ ] Download service account JSON key
- [ ] Configure GCP credentials in .env.docker
- [ ] Initialize GCP clients in server/_core/gcp-ai.ts

### Document AI Integration
- [ ] Enable Document AI API in GCP project
- [ ] Create processors (Form Parser, Invoice Parser, Receipt Parser)
- [ ] Implement processDocument() for single documents
- [ ] Implement batchProcessDocuments() for bulk processing
- [ ] Test with complex forms and receipts
- [ ] Compare results with AWS Textract

### Colab Enterprise Setup
- [ ] Enable Colab Enterprise API in GCP project
- [ ] Create runtime templates (CPU, GPU, TPU)
- [ ] Set up GCS bucket for notebook storage
- [ ] Implement executeNotebook() for on-demand execution
- [ ] Implement scheduleNotebook() for recurring jobs
- [ ] Test with sample analysis notebook

### Vertex AI Integration
- [ ] Enable Vertex AI API in GCP project
- [ ] Implement predictCustomModel() for inference
- [ ] Implement deployModel() for model deployment
- [ ] Test with pre-trained models
- [ ] Add support for custom forensic classifiers

### Colab Notebook Templates
- [ ] Create sentiment analysis notebook template
- [ ] Create entity extraction notebook template
- [ ] Create pattern detection notebook template
- [ ] Add data loading from R2/Supabase
- [ ] Add results export to Supabase
- [ ] Test end-to-end execution

---

## **Phase 34: Cloud AI Routing & Optimization**

### Intelligent Routing
- [ ] Update server/_core/router.ts with cloud AI routing
- [ ] Add cost-based routing (AWS vs GCP)
- [ ] Add latency-based routing
- [ ] Add fallback chains (Rekognition → Document AI → Textract)
- [ ] Implement caching to reduce API calls

### Cost Tracking
- [ ] Track AWS API costs (Rekognition, Comprehend, Textract)
- [ ] Track GCP API costs (Document AI, Vertex AI, Colab)
- [ ] Store cost metrics in Supabase
- [ ] Create cost dashboard in Manus app
- [ ] Add budget alerts

### Performance Optimization
- [ ] Implement parallel processing for batch jobs
- [ ] Add request batching for Comprehend
- [ ] Use Colab Enterprise for GPU-intensive tasks
- [ ] Cache frequently analyzed documents
- [ ] Optimize image sizes before sending to APIs

### Testing & Validation
- [ ] Create test suite for AWS AI services
- [ ] Create test suite for GCP AI services
- [ ] Test screenshot analysis pipeline end-to-end
- [ ] Test document analysis pipeline end-to-end
- [ ] Compare accuracy: AWS vs GCP vs custom models


---

## **Phase 33: Hetzner & Coolify API Integration**

### Hetzner Cloud API
- [ ] Install hcloud Python SDK (`pip3 install hcloud`)
- [ ] Create `server/_core/hetzner.ts` wrapper for Node.js → Python bridge
- [ ] Add tRPC procedures for VPS management (list, create, start, stop, resize, snapshot)
- [ ] Create UI page `client/src/pages/ServerManagement.tsx` for VPS control
- [ ] Add Hetzner API key to environment variables
- [ ] Install hcloud CLI in Kasm workspace Dockerfile
- [ ] Test VPS management via platform UI
- [ ] Document Hetzner API usage in `docs/systems/hetzner-integration.md`

### Coolify MCP Integration
- [ ] Configure Coolify MCP server in MCP settings (already installed: `@fastmcp-me/coolify-mcp`)
- [ ] Add Coolify API URL and token to environment variables
- [ ] Create tRPC procedures for Coolify management (deploy, logs, restart, env vars)
- [ ] Create UI page `client/src/pages/DeploymentManagement.tsx` for Coolify control
- [ ] Test deployment management via platform UI
- [ ] Document Coolify MCP usage in `docs/tools/coolify-mcp.md`

### Cross-Platform Management
- [ ] Create unified dashboard showing both Hetzner VPS and Coolify deployments
- [ ] Add monitoring widgets (CPU, RAM, disk usage from Hetzner API)
- [ ] Add deployment status widgets (service health from Coolify API)
- [ ] Implement webhook handlers for Coolify deployment notifications
- [ ] Test full workflow: Create VPS → Deploy services → Monitor status


## Phase 35 - Directus Integration & Single Sign-On

### Directus Extensions & Plugins Research
- [ ] Research available Directus extensions (hooks, endpoints, panels, modules)
- [ ] Identify useful extensions for forensic workflows (file processing, metadata extraction)
- [ ] Research custom extension development (TypeScript SDK)
- [ ] Document extension installation process via Coolify
- [ ] Test extension compatibility with PostgreSQL backend
- [ ] Create list of priority extensions to install

### Directus Portal Integration
- [ ] Create iframe integration for Directus in platform UI
- [ ] Add Directus navigation tab to DashboardLayout
- [ ] Implement seamless navigation between platform and Directus
- [ ] Create tRPC procedures for Directus API proxy (avoid CORS)
- [ ] Wire file upload from platform to Directus
- [ ] Wire file retrieval from Directus to platform
- [ ] Add Directus collection management UI in platform
- [ ] Create custom Directus dashboard for forensic workflows

### Single Sign-On (SSO) Implementation
- [ ] Research Directus authentication methods (JWT, OAuth, API tokens)
- [ ] Implement JWT token sharing between Manus auth and Directus
- [ ] Create SSO middleware for PhotoPrism (API key or reverse proxy auth)
- [ ] Create SSO middleware for n8n (API key or reverse proxy auth)
- [ ] Implement session synchronization across all services
- [ ] Add logout propagation (logout from platform = logout from all services)
- [ ] Test SSO flow: Manus login → Directus → PhotoPrism → n8n
- [ ] Add user role mapping (Manus admin → Directus admin)
- [ ] Implement token refresh logic
- [ ] Add SSO debugging UI (show active sessions across services)

### Missing Backend Features Audit
- [ ] Audit all tRPC procedures for incomplete implementations
- [ ] List all TODOs in server/ directory
- [ ] Identify missing database helpers in server/db.ts
- [ ] Document missing API integrations (AWS, GCP, HuggingFace)
- [ ] List missing frontend pages (LLM Router, Prompt Builder, Workflow Builder, Agent Builder)
- [ ] Identify missing test coverage
- [ ] Create prioritized backlog of missing features
- [ ] Estimate effort for each missing feature
- [ ] Document dependencies between missing features
- [ ] Create implementation roadmap

### Directus Workflow Integration
- [ ] Create Directus collections for forensic evidence (documents, messages, behaviors)
- [ ] Add custom fields for preliminary analysis results
- [ ] Create Directus flows for automated processing (file upload → n8n webhook)
- [ ] Implement Directus webhooks for real-time updates to platform
- [ ] Add Directus filters for conversation clusters
- [ ] Create Directus insights dashboard for case overview
- [ ] Implement Directus permissions for multi-user access
- [ ] Add Directus activity log integration with platform audit trail

### PhotoPrism Integration
- [ ] Research PhotoPrism API authentication
- [ ] Create SSO bridge for PhotoPrism (reverse proxy or API token)
- [ ] Implement iframe integration for PhotoPrism in platform
- [ ] Wire PhotoPrism face detection results to Supabase
- [ ] Wire PhotoPrism EXIF metadata to Supabase
- [ ] Create PhotoPrism album sync with case management
- [ ] Add PhotoPrism search integration in platform UI

### n8n Integration
- [ ] Research n8n API authentication
- [ ] Create SSO bridge for n8n (API key or reverse proxy)
- [ ] Implement iframe integration for n8n in platform
- [ ] Create n8n workflow templates for forensic processing
- [ ] Wire n8n workflow triggers from platform
- [ ] Add n8n execution monitoring in platform UI
- [ ] Create n8n webhook endpoints for platform callbacks
- [ ] Implement n8n credential sharing with platform secrets


## Phase 36 - Migrate Platform to Self-Hosted PostgreSQL

### Database Migration Planning
- [ ] Audit current Manus platform database (TiDB/MySQL)
- [ ] Document all existing tables and schemas
- [ ] Identify data to migrate vs fresh start
- [ ] Plan migration strategy (zero-downtime vs maintenance window)
- [ ] Create rollback plan in case of migration failure
- [ ] Document connection string format for self-hosted PostgreSQL

### PostgreSQL Configuration on salem-nexus
- [ ] Verify PostgreSQL deployment on salem-nexus (Groq agents)
- [ ] Create dedicated database for platform: `mcp_tool_platform`
- [ ] Create platform user with appropriate permissions
- [ ] Configure PostgreSQL for external connections (Manus platform → salem-nexus)
- [ ] Set up connection pooling (PgBouncer or built-in pooler)
- [ ] Configure SSL/TLS for secure connections
- [ ] Set up PostgreSQL backups (automated daily backups to salem-vault)
- [ ] Configure PostgreSQL monitoring (query performance, connection stats)

### Platform Database Connection Update
- [ ] Update DATABASE_URL environment variable to point to salem-nexus PostgreSQL
- [ ] Test connection from Manus platform to salem-nexus PostgreSQL
- [ ] Update Drizzle ORM configuration for PostgreSQL dialect
- [ ] Run schema migrations on new PostgreSQL database (drizzle-kit push)
- [ ] Verify all tables created correctly
- [ ] Test all tRPC procedures with new database connection
- [ ] Update connection pooling settings for production load

### Schema Consolidation
- [ ] Merge drizzle/schema.ts and drizzle/settings-schema.ts into single schema
- [ ] Add missing tables from Supabase design to platform database
- [ ] Create unified schema for all platform data (users, settings, patterns, messages, analyses)
- [ ] Add indexes for performance (conversation_cluster_id, timestamp, sender)
- [ ] Add foreign key constraints for data integrity
- [ ] Create database views for common queries
- [ ] Document schema design decisions

### Data Migration (if needed)
- [ ] Export existing user data from Manus platform database
- [ ] Transform data to match new PostgreSQL schema
- [ ] Import data into salem-nexus PostgreSQL
- [ ] Verify data integrity after migration
- [ ] Test authentication with migrated user data
- [ ] Update user IDs if schema changed

### Shared Database Architecture
- [ ] Configure Directus to use same PostgreSQL instance (salem_forensics database)
- [ ] Configure PhotoPrism to use same PostgreSQL instance
- [ ] Configure n8n to use same PostgreSQL instance
- [ ] Create separate databases for each service (isolation)
- [ ] Document database naming convention (salem_forensics, mcp_tool_platform, etc.)
- [ ] Set up cross-database queries if needed (PostgreSQL foreign data wrappers)
- [ ] Configure database-level permissions (service users can only access their databases)

### PostgreSQL Extensions Setup
- [ ] Enable pgvector extension for embeddings
- [ ] Enable pg_trgm extension for fuzzy text search
- [ ] Enable pg_stat_statements for query performance monitoring
- [ ] Enable uuid-ossp for UUID generation
- [ ] Enable pg_cron for scheduled jobs (cleanup, backups)
- [ ] Test all extensions with platform queries

### Performance Optimization
- [ ] Tune PostgreSQL configuration for 16GB RAM (shared_buffers, work_mem)
- [ ] Set up query performance monitoring
- [ ] Identify slow queries and add indexes
- [ ] Configure autovacuum settings
- [ ] Set up connection pooling limits
- [ ] Test database performance under load
- [ ] Document optimization settings

### Backup & Recovery
- [ ] Set up automated daily backups to salem-vault volume
- [ ] Configure point-in-time recovery (WAL archiving)
- [ ] Test backup restoration process
- [ ] Set up backup monitoring (verify backups complete successfully)
- [ ] Document backup retention policy (daily for 7 days, weekly for 4 weeks)
- [ ] Create disaster recovery runbook

### Security Hardening
- [ ] Change default PostgreSQL passwords
- [ ] Restrict PostgreSQL network access (only from platform IP)
- [ ] Enable SSL/TLS for all connections
- [ ] Set up database audit logging
- [ ] Configure row-level security (RLS) for multi-tenant data
- [ ] Review and minimize user permissions
- [ ] Document security configuration

### Monitoring & Alerting
- [ ] Set up PostgreSQL metrics collection
- [ ] Create dashboard for database health (connections, queries/sec, cache hit ratio)
- [ ] Configure alerts for high connection count
- [ ] Configure alerts for slow queries
- [ ] Configure alerts for disk space usage
- [ ] Configure alerts for backup failures
- [ ] Integrate monitoring with platform UI


## Phase 13 - VPS Infrastructure Deployment (Jan 9, 2026)

### Docker Compose Files
- [x] Create docker-compose.vps1-complete.yml (salem-nexus - 8 services)
- [x] Create docker-compose.vps2-salem-forge.yml (salem-forge - 6 services)
- [x] Create .env.vps1-complete with all secrets
- [x] Create .env.vps2-salem-forge with all secrets
- [x] Add R2 configuration to Directus, n8n, LibreChat
- [x] Create litellm-config.yaml with model routing
- [x] Update Dockerfile.kasm with FastAPI server for Python tools
- [x] Add NLP endpoints to Kasm FastAPI (detect_language, extract_entities, etc.)

### Python Bridge Remote Execution
- [x] Update python-bridge.ts to support remote API calls
- [x] Add PYTHON_API_URL environment variable support
- [x] Keep local subprocess code commented out for future use
- [x] Add all NLP tool endpoints to Kasm FastAPI server

### Cloudflare Workers
- [x] Create r2-storage.js (file operations, zero egress)
- [x] Create evidence-hasher.js (chain of custody, SHA-256)
- [x] Create auth-proxy.js (JWT validation, API key auth)
- [x] Create cache-api.js (LLM response caching)
- [x] Create rate-limiter.js (sliding window rate limiting)
- [x] Create webhook-receiver.js (webhook queue)
- [x] Create wrangler.toml with deployment configuration

### R2 Integration
- [x] Add R2 credentials to .env files
- [x] Configure R2 storage for Directus
- [x] Configure R2 storage for n8n
- [x] Configure R2 storage for LibreChat

### Service Allocation
**salem-nexus (VPS1):**
- PostgreSQL, MariaDB, FerretDB
- Directus, PhotoPrism, n8n
- LibreChat, Open WebUI

**salem-forge (VPS2):**
- LiteLLM, MetaMCP, Chroma
- Kasm Workspace, Browserless, Playwright

