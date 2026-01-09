# Handoff to Gemini - Current State & Next Tasks

**Date:** 2025-01-05  
**From:** Claude (Anthropic)  
**To:** Gemini Pro (or OpenRouter/OpenAI fallback)  
**Reason:** Cost optimization - Claude is expensive ($120 spent this week)

---

## **Current State**

### **What's Working:**
- ✅ Production pipeline architecture complete (document → conversation → messages → behaviors)
- ✅ 256 custom patterns imported to database (gaslighting, DARVO, parental alienation, etc.)
- ✅ Multi-pass NLP classifier created (6 passes: spaCy, NLTK, TextBlob, Pattern Analyzer, Sentence Transformers, Aggregation)
- ✅ Conversation segmentation system (PLAT_YYMM_TOPIC_iii format)
- ✅ Format-specific parsers (Facebook HTML, XML SMS, PDF iMessage)
- ✅ Supabase schemas with 40+ forensic fields per message
- ✅ LangGraph state machines, LangChain memory, LlamaIndex loaders
- ✅ spaCy installed + en_core_web_sm model loaded successfully

### **In Progress:**
- ⏳ TextBlob installation (running in background, session: test)
- ⏳ Need to verify TextBlob corpora downloaded
- ⏳ Need to test multi-pass classifier with all 6 passes enabled

### **What's Missing:**
- ❌ TextBlob verification
- ❌ Multi-pass classifier end-to-end test
- ❌ Phase 24 (Dependency Management & Deployment) not added to todo.md yet
- ❌ Docker/deployment strategy discussion (waiting for user after work)

---

## **Immediate Tasks for You (Gemini)**

### **Priority 1: Verify TextBlob Installation**
```bash
# Check if TextBlob is installed
python3 -c "import textblob; print('✓ TextBlob installed')"

# Check if corpora are downloaded
python3 -c "from textblob import TextBlob; tb = TextBlob('This is a test.'); print('✓ TextBlob working:', tb.sentiment)"
```

If TextBlob fails, install it:
```bash
sudo pip3 install textblob --quiet
python3 -m textblob.download_corpora
```

### **Priority 2: Test Multi-Pass Classifier**
Run a test to verify all 6 passes work:
```bash
cd /home/ubuntu/mcp-tool-platform
node --import tsx/esm server/mcp/analysis/multi-pass-classifier.test.ts
```

Or create a simple test script:
```typescript
// test-classifier.ts
import { MultiPassClassifier } from './server/mcp/analysis/multi-pass-classifier';

const classifier = new MultiPassClassifier();
const result = await classifier.classify(
  "I never blocked your calls. You're crazy. I'm the victim here.",
  { platform: 'sms', timestamp: new Date() }
);

console.log('Classification result:', JSON.stringify(result, null, 2));
```

### **Priority 3: Add Phase 24 to todo.md**
Append this to `/home/ubuntu/mcp-tool-platform/todo.md`:

```markdown

## Phase 24 - Dependency Management & Deployment

### Python Dependencies
- [x] Install spaCy + en_core_web_sm model
- [ ] Install TextBlob + corpora (verify)
- [ ] Test all Python NLP libraries (spaCy, NLTK, TextBlob, sentence-transformers, langdetect)
- [ ] Test multi-pass classifier with all 6 passes enabled
- [ ] Document Python requirements in requirements.txt
- [ ] Create pip install script for production

### Docker Environment (Discussion Needed)
- [ ] Discuss Docker vs Manus native deployment
- [ ] Test file upload size limits on Manus hosting
- [ ] Test memory limits for 400-page HTML processing
- [ ] Test long-running process support (5-10 min jobs)
- [ ] Create Dockerfile if needed
- [ ] Document deployment requirements

### Large File Handling
- [ ] Implement streaming upload to R2
- [ ] Process files from R2 instead of memory
- [ ] Add background job queue for long analysis
- [ ] Implement progress tracking
- [ ] Test with actual 400-page Facebook HTML

### Production Readiness
- [ ] Add health check endpoint
- [ ] Add dependency verification on startup
- [ ] Create setup script for fresh deployments
- [ ] Test full workflow end-to-end
```

### **Priority 4: Update claude.md**
Add this section to `/home/ubuntu/mcp-tool-platform/claude.md`:

```markdown

## **Python Dependencies Status**

### Installed & Working:
- ✅ spaCy 3.x + en_core_web_sm model
- ✅ NLTK 3.9.2
- ✅ sentence-transformers 5.2.0
- ✅ langdetect 1.0.9
- ✅ TextBlob (verify after installation)

### Multi-Pass Classifier:
- **Pass 0:** Priority screener (custody/alienation flags)
- **Pass 1:** spaCy (entities, structure, speaker attribution)
- **Pass 2:** NLTK VADER (sentiment, negation, sarcasm)
- **Pass 3:** Pattern Analyzer (256 custom patterns from database)
- **Pass 4:** TextBlob (polarity, subjectivity)
- **Pass 5:** Sentence Transformers (semantic similarity)
- **Pass 6:** Aggregation (consensus sentiment)

### Critical Note:
The generic `nlp.ts` plugin uses regex fallbacks. The forensic system uses `multi-pass-classifier.ts` which calls real Python NLP tools via subprocess. DO NOT confuse the two.
```

### **Priority 5: Create requirements.txt**
Create `/home/ubuntu/mcp-tool-platform/requirements.txt`:

```txt
# Core NLP
spacy>=3.0.0
nltk>=3.9.0
textblob>=0.18.0
sentence-transformers>=5.0.0
langdetect>=1.0.9

# AI Libraries
langchain>=0.1.0
langgraph>=0.1.0
llama-index>=0.10.0
unstructured>=0.12.0

# Document Processing
pdfplumber>=0.11.0
python-docx>=1.1.0
beautifulsoup4>=4.12.0

# Database
chromadb>=0.4.0
graphiti-core>=0.3.0

# Utilities
pandas>=2.0.0
numpy>=1.24.0
```

Then run:
```bash
pip3 freeze > /home/ubuntu/mcp-tool-platform/requirements-frozen.txt
```

### **Priority 6: CRITICAL - Missing Backend UI**

**USER FEEDBACK:** "There's no access to configs, builders, import/export, LLM router, prompt customizer, workflow builder, agent/sub-agent builder - NONE of the discussed backend features."

**What's Missing (HIGH PRIORITY):**

1. **Settings/Configuration UI:**
   - [ ] NLP configuration (similarity thresholds, time gaps, chunking strategies)
   - [ ] Pattern library management (add/edit/delete custom patterns)
   - [ ] API key management (LLM providers: OpenAI, Gemini, Cohere, Groq, etc.)
   - [ ] Database connections (Supabase, Neo4j, Chroma, R2)
   - [ ] Workflow configuration (enable/disable analysis passes, adjust weights)
   - [ ] Topic code customization (PLAT_YYMM_TOPIC_iii format)
   - [ ] Platform code management

2. **Import/Export System:**
   - [ ] Export analysis results (JSON, CSV, PDF reports)
   - [ ] Export pattern library (backup custom patterns)
   - [ ] Import pattern library (restore or add new patterns)
   - [ ] Export conversation data (forensic reports)
   - [ ] Import/export workflow definitions
   - [ ] Import/export agent configurations

3. **LLM Router/Provider Management:**
   - [ ] Add/remove LLM providers (OpenAI, Gemini, Cohere, Groq, Claude)
   - [ ] Configure API keys per provider
   - [ ] Set routing rules (which model for which task)
   - [ ] Cost tracking per provider
   - [ ] Fallback configuration (if primary fails)
   - [ ] Model selection UI (choose model per workflow step)

4. **Prompt Customizer/Builder:**
   - [ ] Edit system prompts for classification
   - [ ] Customize prompts for each analysis pass
   - [ ] Template library for common prompts
   - [ ] Variable injection ({{message}}, {{context}}, etc.)
   - [ ] Prompt versioning (rollback to previous)
   - [ ] Test prompt with sample data

5. **Workflow Builder:**
   - [ ] Visual workflow editor (drag-drop nodes)
   - [ ] Define workflow steps (parse → classify → route)
   - [ ] Configure conditional routing (if severity > 8, flag for review)
   - [ ] Add human-in-the-loop checkpoints
   - [ ] Save/load workflow templates
   - [ ] Test workflow with sample data

6. **Agent/Sub-Agent Builder:**
   - [ ] Create custom agents (Forensic Agent, Document Agent, etc.)
   - [ ] Configure agent tools (which NLP tools agent can use)
   - [ ] Set agent memory (Chroma, LangChain memory)
   - [ ] Define agent coordination (swarm orchestration)
   - [ ] Agent template library
   - [ ] Test agent with sample input

7. **Pattern Library Management UI:**
   - [ ] View all patterns (256 custom + built-in)
   - [ ] Add new pattern (name, regex, category, severity)
   - [ ] Edit existing pattern
   - [ ] Delete pattern
   - [ ] Test pattern against sample text
   - [ ] Import patterns from file (JSON, CSV)
   - [ ] Export patterns to file
   - [ ] Pattern usage statistics (how often matched)

**These are CRITICAL for user to actually use the system. Without UI, all the backend is useless.**

**Recommendation for Gemini:**
After completing Priority 1-5, ADD these backend UI tasks to todo.md as Phase 25. DO NOT implement yet - just document them. User needs to discuss priority with Claude when he's back.

---

## **Context You Need**

### **Project Purpose:**
Forensic analysis platform for custody case evidence. Processes messages from multiple platforms (SMS, Facebook, iMessage, email, ChatGPT) to detect:
- Gaslighting, DARVO, parental alienation
- Custody interference (call blocking, visit denial)
- Manipulation patterns (love bombing, blame shifting)
- Michigan Custody Law (MCL) factors

### **Data Flow:**
1. User uploads file (Facebook HTML, XML SMS, PDF iMessage)
2. Parse → Chunk → Store in Chroma (72hr TTL)
3. Classify with multi-pass NLP (6 passes)
4. Route to 4 destinations:
   - **Supabase:** Individual messages + classifications
   - **Neo4j/Graphiti:** Entities + relationships
   - **Directus → R2:** Raw files (chain of custody)
   - **Chroma:** Working memory (purged after 72hrs)

### **Critical Files:**
- `server/mcp/analysis/multi-pass-classifier.ts` - Main classification engine
- `server/python-tools/nlp_runner.py` - Python NLP bridge
- `server/mcp/pipelines/production-pipeline.ts` - End-to-end orchestrator
- `drizzle/production-message-schemas.ts` - Database schemas
- `server/mcp/analysis/priority-screener.ts` - Custody/alienation immediate flags

### **User's Custom Patterns:**
- 256 patterns in `behavioralPatterns` table (loaded via `pattern-analyzer.ts`)
- Includes user's 200-hour analysis library
- Priority patterns: "Kailah"/"Kyla" mentions, call/visit blocking

---

## **What NOT to Do**

1. ❌ Don't use the generic `nlp.ts` plugin - it's regex garbage
2. ❌ Don't modify core architecture without user approval
3. ❌ Don't install new packages without checking with user first
4. ❌ Don't make Docker decisions - user wants to discuss after work
5. ❌ Don't waste tokens on long explanations - be concise

---

## **When to Call Claude Back**

- Docker/deployment architecture decisions
- Complex debugging that you can't solve
- System design changes
- Critical production issues

---

## **Cost Optimization Notes**

**Model Selection Strategy:**

**By Speed:**
1. **Groq** (FASTEST - use for quick tasks, testing, iterations)
2. OpenAI
3. Gemini Pro
4. Claude

**By Cost (cheapest to most expensive):**
1. OpenRouter free tier (Mistral, Groq)
2. Cohere (testing key - good for embeddings, classification, search)
3. OpenAI (user has credits)
4. Gemini Pro (user has subscription) ← **YOU ARE HERE**
5. Claude (expensive, last resort)

**By Task:**
- **Groq:** Fast iterations, testing, simple code generation
- **Cohere:** Embeddings, text classification, semantic search, summarization
- **OpenAI:** General tasks, code generation, reasoning
- **Gemini Pro:** Documentation, long-form writing, multi-modal tasks
- **Claude:** Architecture, complex debugging, critical decisions ONLY

**Use Claude ONLY for:**
- Architecture decisions
- Complex debugging
- Critical system design

---

## **Next Steps After Your Tasks**

1. Report results to user
2. If everything works, save checkpoint
3. Wait for user to return from work for Docker discussion
4. Hand back to Claude ONLY if you hit a blocker

---

**Good luck! Keep costs low. 🚀**
