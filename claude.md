# MCP Tool Platform - Claude Context Document

**Last Updated:** January 2025  
**Project:** Forensic Communication Analysis Platform with MCP Gateway & Multi-Agent Orchestration

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

## Database Schema (Key Tables)

### Platform-Specific Message Tables
```
sms_messages, facebook_messages, imessage_messages, email_messages, chatgpt_conversations
- id, text, timestamp, sender, platform
- conversation_cluster_id (PLAT_YYMM_TOPIC_iii)
- preliminary_sentiment, preliminary_severity, preliminary_patterns
- preliminary_confidence, preliminary_analyzed_at, preliminary_reasoning
```

### Unified Conversation Groups
```
conversation_groups
- id, case_id, participants[], date_range, platforms[]
- message_refs: [{platform, message_id}]
```

### Meta-Analyses
```
meta_analyses
- id, conversation_group_id (FK)
- analysis_type (pattern_detection | timeline | contradiction | psychological_profile)
- final_sentiment, final_severity, final_patterns[]
- coordinated_abuse_score, gaslighting_evidence (JSON)
- contradictions_found: [{preliminary_assessment, final_assessment, evidence_refs}]
- forensic_significance, analyzed_at, human_validated
```

### Behavioral Patterns
```
behavioralPatterns
- id, name, category, pattern (text or regex)
- description, severity (1-10), isRegex, isEnabled
- metadata: {source_lexicon, source_category, language}
```

### Embeddings (pgvector)
```
embeddings
- id, content, embedding (vector(384))
- source_table, source_id, metadata
- HNSW index for fast similarity search
```

---

## Critical Implementation Details

### **Priority Flags (Pass 0 - Immediate Detection)**
**MUST flag immediately with HIGH severity:**
- **Parental Alienation:** "can't see Kailah", "blocked my calls", "denied visitation"
- **Child References:** "Kailah", "Kyla" (voice recognition variant), "my daughter", "our daughter"
- **Custody Interference:** refusing handoffs, canceling scheduled time

### **DARVO Sequence Detection (Single-Context)**
Detect all three components in one message or conversation thread (within 3-5 messages):
1. **Deny:** "I never did that", "that didn't happen"
2. **Attack:** "you're crazy", "you're the abusive one"
3. **Reverse:** "I'm the victim here", "you're attacking me"

**Severity:** 9-10 (hallmark of abusive behavior)

### **User Custom Patterns**
- Stored in `behavioralPatterns` table
- Loaded via `CommunicationPatternAnalyzer.loadUserConfig(userId)`
- **200+ hours of manual pattern curation by user**
- MUST be loaded BEFORE running analysis

### **Dual-Polarity Analysis**
- Detect BOTH positive (love bombing, affirmations) AND negative (gaslighting, threats)
- **Why:** "I love you" (Day 1) + cheating evidence (Day 3) = manipulative love bombing
- Meta-analysis compares positive statements with contradictory actions

---

## Key Files & Directories

```
server/
  mcp/
    orchestration/
      langgraph-adapter.ts          # LangGraph state machine framework
      sub-agents.ts                 # Document, Forensics, Approval, Export agents
      forensic-workflow.ts          # Pre-built forensic investigation workflow
      langchain-memory.ts           # ForensicInvestigationMemory class
    loaders/
      base-loader.ts                # Document loader interface
      sms-loader.ts                 # SMS/iMessage parser
      unstructured-loader.ts        # Unstructured.io wrapper
      embedding-pipeline.ts         # Embedding generation + pgvector storage
      document-hierarchy.ts         # Cases → Conversations → Documents → Chunks
      lexicon-importer.ts           # Dynamic GitHub lexicon fetching (HurtLex, MCL)
    analysis/
      multi-pass-classifier.ts      # 6-pass NLP analysis system
      priority-screener.ts          # Pass 0: Custody/alienation immediate flags
      conversation-segmentation.ts  # Topic change detection + cluster ID generation
      classifier.ts                 # (DEPRECATED - use multi-pass-classifier.ts)
    storage/
      chroma-client.ts              # Dual-collection Chroma (72hr TTL + persistent)
      supabase-client.ts            # Supabase + pgvector integration
    forensics/
      pattern-analyzer.ts           # Custom pattern matching + MCL factors
    plugins/
      langgraph-plugin.ts           # MCP tools: createGraph, executeGraph, streamGraph
      text-miner.ts                 # Bulk pattern search (ugrep/ripgrep)
      nlp.ts                        # NLP provider integrations
    workers/
      executor.ts                   # MCP tool executor (LangGraph handlers registered)
  python-tools/
    nlp_runner.py                   # spaCy, NLTK, sentiment analysis, entity extraction
    langgraph_runner.py             # Python bridge for complex LangGraph execution
    unstructured_parser.py          # Unstructured.io document parsing
    topic_detector.py               # BERTopic topic detection (NOT YET WORKING - hdbscan compile issues)
    get_embedding.py                # Sentence Transformers embeddings
  scripts/
    seed-patterns.ts                # Database seed script (256 patterns imported)
  db.ts                             # Database helpers
  routers.ts                        # tRPC procedures

drizzle/
  schema.ts                         # Database schema (Drizzle ORM)

docs/
  ANALYSIS_LIBRARY_ARCHITECTURE.md  # Pattern library architecture + NLP tool mapping
  EXPANDED_PATTERN_LIBRARY.md       # Research-backed pattern additions
  MCP_UTILITIES_INDEX.txt            # Index of available MCP utilities

todo.md                              # Comprehensive task tracking (400+ items)
```

---

## What's NOT Done Yet

### **High Priority**
- [ ] Text Miner integration (expose as atomic tool + workflow component)
- [ ] DARVO sequence detection implementation
- [ ] Overelaboration detection (sentence length analysis)
- [ ] Pronoun ratio analysis (I-talk vs you-talk)
- [ ] Evidence Hasher integration (chain of custody)
- [ ] Mem0 integration (persistent project context)
- [ ] NotebookLM integration (audio summary generation)
- [ ] BERTopic installation (stuck on hdbscan compilation - fallback to keyword-based topic detection)
- [ ] Real embedding API wiring (currently using sentence-transformers locally)
- [ ] End-to-end pipeline testing with real documents

### **Admin UI (50+ Tasks)**
- [ ] Settings page (NLP configuration, topic detection, pattern library management)
- [ ] API key management (LLM providers, external services)
- [ ] Import/export functionality (patterns, analysis results, backups)
- [ ] Pattern library UI (search, create, edit, delete, test patterns)
- [ ] Workflow configuration UI (enable/disable passes, adjust weights)
- [ ] Database management UI (connection status, statistics, maintenance)

### **Lexicon Integration**
- [ ] HurtLex import execution (importer built, not yet run)
- [ ] MCL patterns research + import
- [ ] Scheduled lexicon updates (auto-fetch latest versions)

---

## Important Conventions

### **Naming**
- **Daughter's name:** Kailah (correct spelling), also match "Kyla" (voice recognition variant)
- **Cluster IDs:** `PLAT_YYMM_TOPIC_iii` (18 chars max, human-readable, sortable)
- **Categories:** snake_case (gaslighting, blame_shifting, parental_alienation)

### **Severity Scoring**
- **1-3:** Low (minor negativity, no abuse indicators)
- **4-6:** Medium (concerning patterns, potential manipulation)
- **7-8:** High (clear abuse indicators, multiple patterns)
- **9-10:** Critical (DARVO, parental alienation, threats, coordinated abuse)

### **Analysis Philosophy**
- **Preliminary:** Fast, objective, surface-level (what words are literally present)
- **Meta-Analysis:** Slow, contextual, retrospective (what patterns emerge across time/platforms)
- **NO LLM in preliminary** (use regex, keyword matching, statistical NLP)
- **LLM only in meta-analysis** (nuanced contradiction detection, psychological profiling)

---

## Testing & Validation

### **Vitest Tests**
- `server/mcp/orchestration/langgraph.test.ts` - 15/23 passed (state persistence needs work)
- `server/mcp/orchestration/langchain-memory.test.ts` - 18/19 passed (95% success)
- `server/mcp/loaders/document-loaders.test.ts` - OOM error (needs fix)

### **Pattern Seed Script**
```bash
node --import tsx server/scripts/seed-patterns.ts
# ✅ Successfully seeded 256 patterns across 26 categories
```

---

## Next Steps for Claude

1. **Complete Text Miner integration** - Expose as MCP tool, integrate into workflows
2. **Implement DARVO sequence detection** - Check for Deny → Attack → Reverse within 3-5 messages
3. **Build admin UI** - Start with Settings page (NLP config, pattern management)
4. **Test end-to-end pipeline** - Ingest sample SMS export, verify preliminary → meta-analysis flow
5. **Fix BERTopic installation** - Or finalize fallback to keyword-based topic detection
6. **Wire real embedding API** - Replace local sentence-transformers with Manus built-in LLM API

---

## Critical Reminders

- **ALWAYS load user custom patterns** from database before analysis (`loadUserConfig(userId)`)
- **NEVER skip preliminary analysis** - it's required for delta tracking in meta-analysis
- **Chroma has TWO collections** - evidence (72hr TTL) and project context (persistent)
- **R2 is single source of truth** for files - PhotoPrism/Directus read from R2, don't store files themselves
- **Cluster IDs are platform-specific** - cross-platform linking happens in meta-analysis via `conversation_groups`
- **Priority flags (Pass 0) are non-negotiable** - custody/alienation patterns MUST be flagged immediately

---

## Contact & Context

**User:** Forensic analysis for custody case, focus on parental alienation and manipulation patterns  
**Daughter:** Kailah (also "Kyla" in voice transcriptions)  
**Key Evidence:** SMS, Facebook Messenger, iMessage, ChatGPT conversations, emails  
**Goal:** Court-admissible forensic reports showing pattern evolution over time
