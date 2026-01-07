# Context Document for Claude

**Last Updated:** January 7, 2026 - 10:00 PM EST  
**Project:** Forensic Communication Analysis Platform with MCP Gateway & Multi-Agent Orchestration  
**Status:** 40% Complete - Backend scaffolded, VPS deployment in progress, UI wiring needed

---

## CRITICAL STATUS UPDATE

### Token Budget: ~125k remaining (started with 200k)
### Funding: $20 plan exhausted, need $70 to upgrade to $200 plan tomorrow
### Deployment: Groq agents deploying salem-nexus services via Coolify
### Next Session: Wire backend UI, complete routing layer, test file ingestion

---

## Project Overview

This platform provides a comprehensive system for forensic analysis of digital communications (SMS, Facebook, iMessage, email, ChatGPT conversations) with a focus on detecting patterns of abuse, manipulation, coercion, and parental alienation. The system uses multi-pass NLP analysis, custom pattern libraries, and AI-powered meta-analysis to generate court-admissible forensic reports.

**Core Purpose:** Analyze communications to detect gaslighting, DARVO, parental alienation, substance abuse patterns, infidelity evidence, and other manipulative behaviors with preliminary surface-level analysis followed by full-context meta-analysis.

---

## Architecture Overview

### **Storage Layer**
- **R2 Bucket:** Primary storage for ALL raw files (documents, images, OCR outputs, backups)
- **Supabase:** Structured relational data (messages, metadata, preliminary classifications, conversation clusters)
- **pgvector (in Supabase):** Semantic search via embeddings for cross-platform evidence retrieval
- **Neo4j + Graphiti:** Entity graphs and temporal relationships for pattern detection
- **Chroma (Dual Collections):**
  - **Evidence Processing (72hr TTL):** Temporary working memory for preliminary analysis
  - **Project Context (Persistent):** Long-term memory for user preferences, project goals, workflow settings
- **PhotoPrism:** Image analysis (reads from R2, writes metadata to Supabase)
- **Directus:** File management backend (uploads to R2, metadata to Supabase)

### **AI/NLP Layer**
- **LangGraph:** Multi-stage investigation state machines with human-in-the-loop checkpoints
- **LangChain Memory:** Hypothesis tracking (preliminary → full context evolution), reasoning trails
- **LlamaIndex:** Document loaders, chunking strategies, evidence hierarchy
- **Unstructured.io:** PDF/DOCX/HTML parsing with layout preservation
- **Multi-Pass NLP Classifier:**
  - **Pass 0:** Priority screener (custody interference, parental alienation - immediate HIGH severity flags)
  - **Pass 1:** spaCy (structure, entities, speaker attribution)
  - **Pass 2:** NLTK VADER (sentiment, negation, sarcasm detection)
  - **Pass 3:** Pattern Analyzer (256 custom patterns + user patterns from database)
  - **Pass 4:** TextBlob (polarity, subjectivity for sarcasm)
  - **Pass 5:** Sentence Transformers (semantic similarity)
  - **Pass 6:** Aggregation (consensus sentiment, confidence scoring)

### **Pattern Library (256+ Patterns)**
**Core Categories:**
- Gaslighting, blame shifting, minimizing, circular arguments
- DARVO (Deny, Attack, Reverse Victim/Offender) - sequence detection
- Overelaboration (victims provide excessive location/time details)
- Parental alienation (call/visit blocking, child references: "Kailah"/"Kyla")
- Substance abuse (alcohol, Adderall control, weaponization)
- Infidelity (specific places: "Huckleberry Junction", general patterns)
- Financial abuse (domestic vs weaponized)
- Love bombing, excessive gratitude, savior complex
- Sexual shaming, medical abuse, reproductive coercion
- Power asymmetry (victim deference, abuser directives)
- Statistical markers (certainty absolutes, hedge words, pronoun ratios)

**Dynamic Lexicon Import:**
- **HurtLex:** Multilingual hate speech lexicon (English-only filtered, dynamically pulled from GitHub: valeriobasile/hurtlex)
- **MCL Patterns:** Manipulation/Coercion/Linguistic abuse taxonomies (research-backed, to be integrated)
- **Extensible:** Add new lexicons via configuration without recoding

### **Conversation Segmentation**
**Cluster ID Format:** `PLAT_YYMM_TOPIC_iii`  
Example: `SMS_2401_KAILAH_001` (SMS, Jan 2024, about Kailah, sequence 1)

**Detection Method:**
- Sentence Transformers for semantic similarity (threshold < 0.6 = new topic)
- Time-window segmentation (gap > 2 hours = new cluster)
- Entity-based segmentation (entity changes = new cluster)
- Topic extraction via keyword matching + NER

**Platform Codes:** SMS, FB (Facebook), IMSG (iMessage), MAIL (Email), CHAT (ChatGPT), WA (WhatsApp), DISC (Discord), SNAP (Snapchat)

**Topic Codes (6 chars max):** KAILAH (daughter), VISITS (parenting time), CALLS, SCHOOL, MONEY, HEALTH, SUBST (substance), INFID (infidelity), THREAT, GENRL (general)

### **Workflow: Preliminary → Meta-Analysis**

**Phase 1: Preliminary Analysis (Surface-Level)**
1. Ingest document (PDF, DOCX, SMS export, etc.)
2. Parse with Unstructured.io or platform-specific loaders
3. Chunk messages (semantic, conversation-turn, or fixed-size)
4. **Multi-pass NLP classification** (6 passes, NO LLM - fast keyword/regex/statistical)
5. Assign conversation cluster IDs
6. Store in **Chroma (72hr TTL)** + **Supabase** (preliminary_sentiment, preliminary_severity, preliminary_patterns)
7. Generate embeddings → **pgvector**

**Phase 2: Meta-Analysis (Full Context)**
1. After 72hrs (or manually triggered), retrieve ALL messages in conversation group (cross-platform)
2. Load preliminary assessments from Supabase
3. **LLM-powered meta-analysis:**
   - Compare preliminary vs full-context findings
   - Detect contradictions (love bombing + cheating evidence)
   - Identify coordinated patterns (Neo4j graph analysis)
   - Calculate severity deltas
4. Store in **meta_analyses** table (final_sentiment, final_severity, contradictions_found, forensic_significance)
5. Chroma TTL cleanup (evidence purged, preliminary data preserved in Supabase)

---

## CRITICAL GAPS (MUST ADDRESS NEXT SESSION)

### 1. Backend UI Wiring (Settings Page)
**Status:** Scaffolds exist, procedures have TODOs, NO wiring

**Files:**
- `client/src/pages/Settings.tsx` - UI skeleton
- `server/routers/settings.ts` - 25+ procedures with TODOs
- `drizzle/settings-schema.ts` - 12 tables created

**Missing:**
- [ ] Wire database procedures to UI forms
- [ ] Implement API key encryption (crypto module)
- [ ] Test connection buttons for Neo4j/Supabase/Vector DBs
- [ ] NLP configuration (model selection, thresholds)
- [ ] LLM provider management (add/edit/delete/test)
- [ ] Routing rules configuration
- [ ] Export/import settings

### 2. Pattern Library Wiring
**Status:** UI exists, backend has TODOs

**Files:**
- `client/src/pages/PatternLibrary.tsx` - UI skeleton
- `server/routers/patterns.ts` - 15+ procedures with TODOs

**Missing:**
- [ ] Load patterns from database (procedure exists, UI not wired)
- [ ] Add/edit/delete patterns (UI exists, backend TODOs)
- [ ] Test pattern against sample text (UI exists, backend stub)
- [ ] Import/export patterns (UI exists, no backend)

### 3. Routing Layer Implementation
**Status:** Skeleton with TODOs

**File:** `server/_core/router.ts`

**Missing:**
- [ ] routeLLMRequest() - Manus → LiteLLM → External APIs
- [ ] routeMCPRequest() - Manus → MetaMCP → Remote MCPs
- [ ] routeVectorSearch() - Manus → Chroma VPS → Cloud vectors
- [ ] routeGraphQuery() - Manus → Neo4j Aura → Graphiti
- [ ] routeStorageOperation() - Manus → R2 → Directus/PhotoPrism
- [ ] Health checks, retry logic, load balancing
- [ ] Cost/latency tracking

### 4. VPS Service Integration
**Status:** Docker compose ready, NOT deployed or integrated

**LiteLLM:**
- [ ] Deploy to salem-forge (waiting for reformat)
- [ ] Connect platform to LiteLLM
- [ ] Implement failover from Manus → LiteLLM
- [ ] Cost tracking

**MetaMCP:**
- [ ] Deploy to salem-forge
- [ ] Connect platform to MetaMCP
- [ ] Remote MCP server registration
- [ ] Tool discovery

**Chroma VPS:**
- [ ] Deploy to salem-forge
- [ ] Connect platform to Chroma VPS
- [ ] Vector search routing

### 5. MCP Tool Executors
**Status:** 60+ tools registered, 20 have executors, 40 are stubs

**File:** `server/mcp/executor.ts`

**Missing Executors:**
- [ ] Vector DB tools (Qdrant, pgvector, Chroma)
- [ ] Graph DB tools (Neo4j, Graphiti)
- [ ] mem0 shared context tools
- [ ] n8n workflow triggers
- [ ] Browser automation tools (Browserless, Playwright)
- [ ] Python library tools (pandas, Transformers, pdfplumber)
- [ ] JavaScript library tools (Cheerio, Natural, Compromise)

### 6. Frontend Pages NOT Created
- [ ] LLM Router monitoring page
- [ ] Prompt Builder page
- [ ] Workflow Builder page
- [ ] Agent Builder page

---

## VPS Infrastructure

### salem-nexus (116.203.199.238) - Storage/CMS
**Status:** Coolify master running, Groq agents deploying services

**Services (Being Deployed):**
- PostgreSQL (postgres:16-alpine)
- FerretDB (MongoDB-compatible layer)
- Directus (CMS, file management)
- PhotoPrism (image analysis)
- n8n (workflow automation)
- Tailscale (VPN)

**Volume:** salem-vault (60GB XFS) at /mnt/salem-vault

### salem-forge (116.203.198.77) - AI/Compute
**Status:** Being reformatted to clean Debian

**Planned Services (NOT deployed):**
- LiteLLM (LLM routing/proxy)
- MetaMCP (MCP server registry)
- Chroma (vector store)
- LibreChat (chat UI)
- Open WebUI (alternative chat UI)
- Ollama (local LLM runtime)
- Kasm Workspace (remote desktop with Claude/Gemini CLI)
- Browserless (headless Chrome)
- Playwright (browser automation)

---

## Database Schema (Key Tables)

### Supabase PostgreSQL

**Message Storage:**
- `messaging_documents` - Document metadata (file_hash, platform, upload_timestamp)
- `messaging_conversations` - Conversation groups (cluster_id, participants, date_range)
- `messaging_messages` - Individual messages (text, timestamp, sender, preliminary_sentiment, preliminary_severity)
- `messaging_behaviors` - Detected patterns (pattern_name, severity, confidence, mcl_factor)
- `messaging_attachments` - Media files (file_url, mime_type, ocr_text)
- `messaging_evidence_items` - Chain of custody (sha256_hash, custody_log)

**Analysis Storage:**
- `meta_analyses` - Full-context analysis results
- `contradictions` - Detected contradictions between preliminary and final
- `audit_trail` - Immutable log of all operations

**Configuration:**
- `nlpConfig` - spaCy/NLTK/Sentence Transformer settings
- `llmProviders` - Provider credentials and configs
- `routingRules` - Task-based/cost-based/latency-based routing
- `workflows` - Saved workflow definitions
- `agents` - Agent configurations
- `topicCodes` - Custom topic codes
- `platformCodes` - Custom platform codes
- `promptVersions` - Prompt template versioning
- `exportHistory` - Export/import audit trail
- `behavioralPatterns` - Custom user patterns (256 loaded)

### Neo4j Aura (Graphiti)

**Nodes:**
- Person, Address, Place, Organization, Property
- GpsPoint, Phone, Email, VoterRecord, Event

**Relationships:**
- Familial, Romantic, Professional, Residential, Contact
- Spatial, Temporal

### Chroma Collections

**Evidence Processing (72hr TTL):**
- Preliminary analysis chunks
- Embeddings for semantic search
- Auto-cleanup after 72 hours

**Project Context (Persistent):**
- User preferences
- Project goals
- Workflow settings

---

## Testing Status

### Vitest Tests
- **LangGraph:** 15/23 passing (65%)
- **LangChain Memory:** 18/19 passing (95%)
- **Document Loaders:** OOM error (needs optimization)
- **Total:** 52/63 tests passing (83%)

### Integration Tests
- [ ] End-to-end file ingestion NOT tested yet
- [ ] VPS service integration NOT tested
- [ ] Routing layer NOT tested

---

## Deployment Files

### Docker Compose
- `docker-compose.vps1-storage.yml` - salem-nexus services
- `docker-compose.vps2-compute.yml` - salem-forge services
- `litellm-config.yaml` - LiteLLM model routing rules

### Handoff Documents
- `GROQ_COMPOUND_HANDOFF.md` - Deployment instructions for Groq agents
- `AGENT_HANDOFF.md` - 9 parallel work streams for delegation
- `DOCUMENTATION_HANDOFF.md` - 100+ docs for free models to write

### Analysis Documents
- `ARCHITECTURE.md` - 7500+ word system design
- `ARCHITECTURE_DIFF_ANALYSIS.md` - Comparison with conversation ingestion system
- `PUNCHLIST_GAP_ANALYSIS.md` - 28% complete, 52% missing
- `COMPREHENSIVE_GAP_REPORT.md` - 60+ tools registered, 40 need executors
- `STATUS_REPORT_JAN7.md` - THIS SESSION'S COMPREHENSIVE STATUS

---

## Key Code Files

### Backend Core
- `server/_core/router.ts` - Routing layer (TODOs)
- `server/_core/llm.ts` - Manus built-in LLM (works)
- `server/_core/context.ts` - tRPC context
- `server/_core/env.ts` - Environment variables

### MCP System
- `server/mcp/gateway.ts` - MCP gateway (functional)
- `server/mcp/executor.ts` - Tool executors (20/60 done)
- `server/mcp/plugins/` - 15 plugin files (~3500 lines)

### Orchestration
- `server/mcp/orchestration/langgraph-adapter.ts` - State machines
- `server/mcp/orchestration/langchain-memory.ts` - Hypothesis tracking
- `server/mcp/orchestration/sub-agents.ts` - Agent library
- `server/mcp/orchestration/forensic-workflow.ts` - Pre-built workflows

### Document Processing
- `server/mcp/loaders/base-loader.ts` - Abstract loader
- `server/mcp/loaders/sms-loader.ts` - SMS parser
- `server/mcp/loaders/embedding-pipeline.ts` - pgvector integration
- `server/mcp/loaders/document-hierarchy.ts` - Case management
- `server/mcp/parsers/facebook-html-parser.ts` - Streaming parser
- `server/mcp/parsers/xml-sms-parser.ts` - Streaming parser
- `server/mcp/parsers/pdf-imessage-parser.ts` - PDF parser

### NLP
- `server/python-tools/multi_pass_classifier.py` - 6-pass classifier
- `server/python-tools/graphiti_runner.py` - Neo4j integration

### tRPC Routers
- `server/routers/settings.ts` - 25+ procedures (TODOs)
- `server/routers/patterns.ts` - 15+ procedures (TODOs)
- `server/routers.ts` - Main router

### Database
- `drizzle/schema.ts` - User/auth tables
- `drizzle/settings-schema.ts` - 12 config tables
- `server/db.ts` - Database helpers

### Frontend
- `client/src/pages/Home.tsx` - Landing page
- `client/src/pages/Settings.tsx` - Settings UI (not wired)
- `client/src/pages/PatternLibrary.tsx` - Pattern UI (not wired)
- `client/src/components/DashboardLayout.tsx` - Layout

---

## Next Session Priorities

### 1. Verify Groq Deployment (30 min)
- Check Coolify UI at https://nexus.mitechconsult.com
- Verify PostgreSQL, Directus, PhotoPrism, n8n are running
- Test shared media storage
- Document credentials

### 2. Wire Backend UI (4-6 hours)
- Complete Settings page database procedures
- Implement API key encryption
- Wire Pattern Library CRUD operations
- Test all procedures with vitest

### 3. Implement Routing Layer (4-6 hours)
- Complete router.ts with failover logic
- Add health checks for VPS services
- Implement retry logic
- Add cost/latency tracking

### 4. Deploy salem-forge (2-3 hours)
- Add as Coolify remote server
- Deploy AI/Compute services
- Configure Tailscale VPN
- Test cross-VPS communication

### 5. Test File Ingestion (2-3 hours)
- Upload sample Facebook HTML to Directus
- Create n8n preprocessing workflow
- Test end-to-end pipeline
- Debug with live data

---

## Important Notes

### Proxy/Router/Coordinator Status
**ALL STUBS - NO IMPLEMENTATION:**
- routeLLMRequest() - Returns placeholder
- routeMCPRequest() - Returns placeholder
- routeVectorSearch() - Returns placeholder
- routeGraphQuery() - Returns placeholder
- routeStorageOperation() - Returns placeholder

**LiteLLM Integration:** Docker compose ready, NOT deployed, NO platform integration

**MetaMCP Integration:** Docker compose ready, NOT deployed, NO platform integration

**MCP Gateway:** 60+ tools registered, 20 have executors, 40 are stubs

### GitHub Sync
- User made changes via GitHub Copilot
- Added `.github/copilot-instructions.md` (360 lines)
- Scrubbed API keys from documentation files
- All changes pulled and synced

### Funding Constraint
- $20 plan exhausted
- Need $70 to upgrade to $200 plan
- Cannot continue development tonight
- Resume tomorrow with funding

---

**End of Context Document**
