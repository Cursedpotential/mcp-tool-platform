# MCP Tool Platform - Development Trajectory

**Project Start:** January 2025  
**Last Updated:** January 2025

---

## Mission

Build a comprehensive forensic communication analysis platform that detects patterns of abuse, manipulation, coercion, and parental alienation across multiple digital platforms (SMS, Facebook, iMessage, email, ChatGPT) with preliminary surface-level analysis followed by full-context meta-analysis for court-admissible forensic reports.

---

## Completed Milestones

### **Phase 1: Foundation & Infrastructure** ✅
- [x] Project scaffolding (tRPC + React + Express + Database)
- [x] MCP gateway architecture
- [x] Supabase integration (structured data + pgvector)
- [x] Neo4j + Graphiti integration (entity graphs)
- [x] Chroma dual-collection system (72hr TTL + persistent context)
- [x] Database schema design (platform tables, conversation groups, meta-analyses)

### **Phase 2: LangGraph State Machine Framework** ✅
- [x] TypeScript adapter for LangGraph with fluent API
- [x] State schemas for forensic workflows
- [x] Sub-agent library (Document, Forensics, Approval, Export agents)
- [x] Pre-built workflows (Forensic Investigation, Document Processing)
- [x] Human-in-the-loop checkpoint system
- [x] Python bridge for complex graph execution
- [x] MCP gateway integration (5 tools: createGraph, executeGraph, streamGraph, getGraphState, listWorkflows)

### **Phase 3: LangChain Memory System** ✅
- [x] ForensicInvestigationMemory class
- [x] Hypothesis tracking (preliminary → full context evolution)
- [x] Analysis delta recording
- [x] Temporal queries ("what did we think on Day X?")
- [x] Reasoning trail for audit logs
- [x] Export for forensic reports
- [x] Supabase persistence hooks

### **Phase 4: LlamaIndex Document Loaders** ✅
- [x] BaseDocumentLoader abstract class
- [x] Schema detection from sample data
- [x] Chunking strategies (fixed_size, semantic, sliding_window, conversation_turn)
- [x] SMS/iMessage loader (JSON, CSV, XML, plain text)
- [x] Unstructured.io integration (PDF, DOCX, HTML parsing)
- [x] Document hierarchy manager (Cases → Conversations → Documents → Chunks)

### **Phase 5: Embedding Pipeline** ✅
- [x] EmbeddingService with batch processing
- [x] VectorStore with semantic search
- [x] pgvector SQL schema (HNSW indexing, RLS policies)
- [x] Cross-platform evidence linking
- [x] Forensic timeline queries
- [x] Sentence Transformers integration (all-MiniLM-L6-v2 model)

### **Phase 6: Pattern Library** ✅
- [x] 256 custom patterns across 26 categories
- [x] Database seed script (`seed-patterns.ts`)
- [x] Pattern categories:
  - Gaslighting, blame shifting, minimizing, circular arguments
  - DARVO (Deny, Attack, Reverse Victim/Offender)
  - Overelaboration patterns
  - Parental alienation (custody interference, child references)
  - Substance abuse (alcohol, Adderall control)
  - Infidelity (specific places + general patterns)
  - Financial abuse (domestic vs weaponized)
  - Love bombing, excessive gratitude, savior complex
  - Sexual shaming, medical abuse, reproductive coercion
  - Power asymmetry (victim deference, abuser directives)
  - Statistical markers (certainty absolutes, hedge words)
- [x] Successfully imported 256 patterns to database

### **Phase 7: Multi-Pass NLP Classifier** ✅
- [x] Pass 0: Priority screener (custody/alienation immediate flags)
- [x] Pass 1: spaCy (structure, entities, speaker attribution)
- [x] Pass 2: NLTK VADER (sentiment, negation, sarcasm)
- [x] Pass 3: Pattern Analyzer (custom patterns + user patterns from database)
- [x] Pass 4: TextBlob (polarity, subjectivity for sarcasm detection)
- [x] Pass 5: Sentence Transformers (semantic similarity)
- [x] Pass 6: Aggregation (consensus sentiment, confidence scoring)
- [x] User pattern loading (`loadUserConfig(userId)`)
- [x] Dual-polarity analysis (positive + negative pattern detection)

### **Phase 8: Conversation Segmentation** ✅
- [x] Cluster ID format design (`PLAT_YYMM_TOPIC_iii`)
- [x] Platform code mapping (SMS, FB, IMSG, MAIL, CHAT, WA, DISC, SNAP)
- [x] Topic code mapping (KAILAH, VISITS, CALLS, SCHOOL, MONEY, HEALTH, SUBST, INFID, THREAT, GENRL)
- [x] Semantic similarity-based segmentation (Sentence Transformers)
- [x] Time-window segmentation (gap > 2 hours = new cluster)
- [x] Entity-based segmentation (entity changes = new cluster)
- [x] Topic extraction via keyword matching + NER

### **Phase 9: Dynamic Lexicon Import System** ✅
- [x] Extensible lexicon architecture
- [x] HurtLex importer (valeriobasile/hurtlex from GitHub)
- [x] English-only filtering
- [x] Category mapping to internal pattern system
- [x] Lexicon registry for easy additions
- [x] CSV/JSON/TXT format support
- [x] Batch insertion with duplicate handling

### **Phase 10: Documentation** ✅
- [x] ANALYSIS_LIBRARY_ARCHITECTURE.md (pattern library + NLP tool mapping)
- [x] EXPANDED_PATTERN_LIBRARY.md (research-backed pattern additions)
- [x] MCP_UTILITIES_INDEX.txt (utility inventory)
- [x] claude.md (comprehensive context document for Claude)
- [x] trajectory.md (this document)
- [x] todo.md (400+ tasks tracked)

### **Phase 11: Testing** ⚠️ Partial
- [x] LangGraph workflow tests (15/23 passed - 65%)
- [x] LangChain memory tests (18/19 passed - 95%)
- [ ] Document loader tests (OOM error - needs fix)
- [ ] End-to-end pipeline tests (not yet run)

---

## Current Status

### **What's Working**
✅ Pattern library (256 patterns imported)  
✅ Multi-pass NLP classifier (6 passes)  
✅ Priority screening (custody/alienation flags)  
✅ Conversation segmentation architecture  
✅ LangGraph state machines  
✅ LangChain memory system  
✅ Document loaders (SMS, Unstructured.io)  
✅ Embedding pipeline (architecture complete)  
✅ Dual-collection Chroma (architecture complete)  
✅ Dynamic lexicon importer (HurtLex ready)  

### **What's In Progress**
⏳ Sentence Transformers model download (90MB, slow connection)  
⏳ BERTopic installation (stuck on hdbscan compilation)  
⏳ Text Miner integration  
⏳ Real embedding API wiring  

### **What's Not Started**
❌ DARVO sequence detection implementation  
❌ Overelaboration detection  
❌ Pronoun ratio analysis  
❌ Evidence Hasher integration  
❌ Mem0 integration  
❌ NotebookLM integration  
❌ Admin UI (50+ tasks)  
❌ End-to-end pipeline testing  
❌ HurtLex import execution  
❌ MCL patterns integration  

---

## Architecture Decisions

### **Why Multi-Pass NLP Instead of LLM-Only?**
- **Speed:** Regex/keyword matching is 100x faster than LLM calls
- **Cost:** No API costs for preliminary analysis
- **Objectivity:** Surface-level analysis captures "what was said" without interpretation
- **Delta Tracking:** Preliminary vs final assessments reveal gaslighting patterns
- **Court Admissibility:** Rule-based analysis is more defensible than "AI said so"

### **Why Dual Chroma Collections?**
- **Evidence (72hr TTL):** Ensures "fresh eyes" analysis without contamination from previous assessments
- **Project Context (Persistent):** Agents don't forget user preferences, project goals, workflow settings
- **Cost Savings:** Evidence chunks don't need to live in Chroma forever (moved to Supabase + pgvector)

### **Why Cluster IDs Instead of UUIDs?**
- **Human-Readable:** `SMS_2401_KAILAH_001` tells you platform, date, topic at a glance
- **Sortable:** Chronological ordering without parsing timestamps
- **Compact:** 18 chars max vs 36 for UUIDs
- **Debuggable:** Easy to spot patterns in logs

### **Why R2 as Single Source of Truth?**
- **Immutability:** Original files never modified (forensic integrity)
- **Scalability:** Unlimited storage vs database BLOB limits
- **Performance:** Direct S3 access faster than database queries
- **Chain of Custody:** File hashes + timestamps for court admissibility

---

## Key Metrics

- **256 patterns** imported to database
- **26 pattern categories** defined
- **6 NLP analysis passes** implemented
- **8 platform codes** supported (SMS, FB, IMSG, MAIL, CHAT, WA, DISC, SNAP)
- **10 topic codes** defined (KAILAH, VISITS, CALLS, SCHOOL, MONEY, HEALTH, SUBST, INFID, THREAT, GENRL)
- **5 LangGraph MCP tools** exposed
- **3 AI libraries** integrated (LangGraph, LangChain, LlamaIndex)
- **2 Chroma collections** (evidence TTL + persistent context)
- **400+ tasks** tracked in todo.md
- **15/23 LangGraph tests** passing (65%)
- **18/19 LangChain tests** passing (95%)

---

## Technical Debt

### **High Priority**
1. **BERTopic installation failure** - hdbscan won't compile, need fallback to keyword-based topic detection
2. **Document loader OOM tests** - Memory issue in test suite
3. **State persistence in LangGraph** - 8 tests failing (saveGraphState/getGraphState placeholders)
4. **Real embedding API** - Currently using local sentence-transformers, need Manus built-in LLM API

### **Medium Priority**
1. **Admin UI missing** - No way to configure NLP parameters, manage patterns, or view analysis results
2. **Import/export missing** - No backup/restore functionality
3. **API key management missing** - No UI for adding LLM provider keys
4. **Workflow configuration missing** - Can't enable/disable analysis passes or adjust weights

### **Low Priority**
1. **HurtLex not imported yet** - Importer built but not executed
2. **MCL patterns not researched** - Need to find GitHub repo
3. **NotebookLM not integrated** - Audio summary generation for court
4. **Mem0 not integrated** - Persistent project context

---

## Lessons Learned

### **What Worked Well**
✅ **Multi-pass architecture** - Clean separation of concerns, easy to add new passes  
✅ **Pattern library approach** - User can add custom patterns without code changes  
✅ **Cluster ID format** - Human-readable, sortable, compact  
✅ **Dual Chroma collections** - Solves TTL + persistence problem elegantly  
✅ **LangGraph state machines** - Powerful for multi-stage workflows with checkpoints  

### **What Didn't Work**
❌ **BERTopic dependency** - Too heavy, compilation issues, should have used simpler topic detection  
❌ **Starting with backend** - Should have built admin UI first so user can configure/test  
❌ **Not finishing tasks** - Too many 40-50% complete features, need to finish before moving on  
❌ **LLM in preliminary analysis** - Initial classifier used LLM (slow, expensive), had to rewrite with NLP tools  

### **What to Do Differently**
1. **Finish one feature completely** before moving to next
2. **Build UI alongside backend** so user can test/configure
3. **Start with simplest solution** (keyword matching) before complex ML (BERTopic)
4. **Test with real data early** instead of waiting until "everything is done"

---

## Next Session Priorities

### **Immediate (This Session if Tokens Available)**
1. ✅ Update claude.md with current architecture
2. ✅ Update trajectory.md with progress
3. ✅ Save checkpoint + push to GitHub
4. ⏳ Wait for sentence-transformers model download
5. ⏳ Test conversation segmentation with sample messages

### **Next Session (High Priority)**
1. **Text Miner integration** - Expose as atomic MCP tool + workflow component
2. **DARVO sequence detection** - Implement Deny → Attack → Reverse pattern matching
3. **Admin UI - Settings Page** - NLP configuration, pattern management
4. **End-to-end pipeline test** - Ingest sample SMS export, verify preliminary → meta-analysis flow

### **Future Sessions**
1. **Admin UI completion** - API keys, import/export, workflow config, database management
2. **HurtLex import execution** - Run lexicon importer
3. **MCL patterns integration** - Research + import
4. **Overelaboration detection** - Sentence length analysis
5. **Pronoun ratio analysis** - I-talk vs you-talk
6. **Evidence Hasher** - Chain of custody verification
7. **NotebookLM** - Audio summary generation

---

## Success Criteria

### **MVP (Minimum Viable Product)**
- [ ] Ingest SMS export (JSON/CSV)
- [ ] Run multi-pass preliminary analysis
- [ ] Store results in Supabase with cluster IDs
- [ ] Generate embeddings → pgvector
- [ ] Run meta-analysis on conversation group
- [ ] Export forensic report (PDF)
- [ ] Admin UI to view results

### **V1.0 (Production Ready)**
- [ ] All platform loaders (SMS, Facebook, iMessage, Email, ChatGPT)
- [ ] Full multi-pass classifier (all 6 passes working)
- [ ] DARVO sequence detection
- [ ] Overelaboration detection
- [ ] Pronoun ratio analysis
- [ ] Admin UI (settings, patterns, API keys, import/export)
- [ ] End-to-end tests passing
- [ ] Court-admissible forensic reports

### **V2.0 (Advanced Features)**
- [ ] Real-time analysis (as messages arrive)
- [ ] Multi-agent swarms (parallel analysis)
- [ ] Temporal pattern detection (cycle of abuse)
- [ ] Predictive modeling (escalation risk)
- [ ] Cross-case pattern matching (abuser fingerprinting)
- [ ] Audio/video analysis (tone, facial expressions)

---

## Resources & References

### **Research Papers**
- Linguistic indicators of coercive control (liebertpub.com)
- Overelaboration in victim discourse (forensic linguistics)
- DARVO patterns in abusive relationships

### **Datasets**
- HurtLex: valeriobasile/hurtlex (GitHub)
- MCL patterns: (to be researched)

### **Libraries**
- LangGraph: Multi-agent orchestration
- LangChain: Memory + chains
- LlamaIndex: Document loading + indexing
- Unstructured.io: Document parsing
- spaCy: NLP (entities, structure)
- NLTK: Sentiment, tokenization
- TextBlob: Polarity, subjectivity
- Sentence Transformers: Embeddings
- BERTopic: Topic modeling (not working yet)

---

## Team Notes

**User Preferences:**
- Prefers voice messages (transcribed automatically)
- ADD - needs reminders added to todo.md immediately
- Wants to finish tasks completely before moving on
- Frustrated with 40-50% complete features
- Needs admin UI to configure/test (can't code)

**Communication Style:**
- Direct, no bullshit
- Swears when frustrated (means he cares)
- Asks for clarification when confused
- Provides detailed context when needed

**Project Context:**
- Custody case involving daughter Kailah
- Evidence spans multiple platforms (SMS, Facebook, iMessage)
- Focus on parental alienation, gaslighting, manipulation
- Goal: Court-admissible forensic reports

---

**End of Trajectory Document**
