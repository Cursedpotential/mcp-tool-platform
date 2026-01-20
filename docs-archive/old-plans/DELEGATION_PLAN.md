# MCP Tool Platform - Delegation Plan

**Date:** January 13, 2026  
**Purpose:** Delegate all critical implementation work to cost-effective LLM models  
**Target Models:** Gemini 2.5 Flash, Groq Compound, OpenRouter free models

---

## Completed ✅

- [x] **TASK 00: Setup Dependencies** - DONE
  - Installed node_modules with `pnpm install`
  - Created complete `.env.example` with all required variables
  - Generated encryption key: `0a743933ad930c63138caf93e7aa940669522d1864ee4a433430f177d0687ca5`

---

## Critical Tasks for Delegation 🔴

### TASK 01: Implement Pattern Router
**File:** `TASK_01_PATTERN_ROUTER.md`  
**Delegate To:** Gemini 2.5 Flash  
**Priority:** CRITICAL (blocks UI)  
**Endpoints:** 13 endpoints to implement  
**Estimated Tokens:** ~50K (bulk implementation)

**What to implement:**
- `patterns.list` - Query database with filters
- `patterns.getById` - Fetch single pattern
- `patterns.create` - Insert new pattern
- `patterns.update` - Update existing pattern
- `patterns.delete` - Delete pattern
- `patterns.testPattern` - Test regex
- `patterns.import` - Import pattern library
- `patterns.export` - Export patterns
- `patterns.getStats` - Usage statistics
- `patterns.getCategories` - List categories
- `patterns.createCategory` - Create category
- `patterns.updateCategory` - Update category
- `patterns.deleteCategory` - Delete category

**Database tables:** `behavioralPatterns`, `patternCategories`

---

### TASK 02: Implement Core Router
**Delegate To:** Gemini 2.5 Flash or Groq Compound  
**Priority:** CRITICAL (blocks smart routing)  
**File:** `server/core/router.ts`

**Functions to implement:**
1. `routeLLM()` - Route to LiteLLM proxy or Manus built-in
2. `routeMCPTool()` - Route to local MCP gateway or remote servers
3. `routeVectorSearch()` - Route to Chroma (in-process) or Qdrant (persistent)
4. `routeStorage()` - Route to Manus S3 (<10MB) or user R2 (>10MB)
5. `checkServiceHealth()` - Ping all VPS services
6. `trackCosts()` - Query LiteLLM for cost metrics

**Integration points:**
- LiteLLM proxy at `BUILT_IN_FORGE_API_URL`
- MCP gateway at `server/mcp/gateway.ts`
- Chroma client at `server/mcp/storage/chroma-client.ts`
- Supabase client at `server/mcp/storage/supabase-client.ts`

---

### TASK 03: Complete Production Pipeline
**Delegate To:** Gemini 2.5 Flash  
**Priority:** HIGH  
**File:** `server/mcp/pipelines/production-pipeline.ts`

**Functions to complete:**
1. `extractEntities()` - Call Python spaCy NER or use compromise.js
2. `insertEntitiesIntoNeo4j()` - Wire Graphiti client
3. `detectDirection()` - Implement sender detection logic
4. Wire Directus R2 upload (currently commented out)

**Dependencies:**
- Python spaCy (if using Python bridge)
- Graphiti client at `server/mcp/storage/graphiti-client.ts`
- Directus API configuration

---

### TASK 04: Implement Redis Queue (or Document In-Memory)
**Delegate To:** Gemini 2.5 Flash  
**Priority:** MEDIUM  
**File:** `server/mcp/queue/redis-queue.ts`

**Options:**
1. Implement Redis/Dragonfly connection
2. OR document that in-memory queue is intentional and remove TODO

**If implementing:**
- Use `ioredis` package
- Connect to Dragonfly at configured URL
- Implement queue operations (enqueue, dequeue, peek)

---

### TASK 05: AWS AI Services (Optional)
**Delegate To:** Gemini 2.5 Flash  
**Priority:** LOW (remove if not needed)  
**File:** `server/core/aws-ai.ts`

**Decision needed:** Keep or remove?

**If keeping, implement:**
- Rekognition: `detectFaces()`, `detectLabels()`, `detectTextInImage()`
- Comprehend: `analyzeSentiment()`, `extractEntities()`, `detectPII()`
- Textract: `extractDocumentText()`, `analyzeDocument()`
- Pipeline: `analyzeScreenshot()`

**If removing:**
- Delete `server/core/aws-ai.ts`
- Remove imports from other files
- Update documentation

---

### TASK 06: GCP AI Services (Optional)
**Delegate To:** Gemini 2.5 Flash  
**Priority:** LOW (remove if not needed)  
**File:** `server/core/gcp-ai.ts`

**Decision needed:** Keep or remove?

**If keeping, implement:**
- Document AI: `processDocument()`, `batchProcessDocuments()`
- Colab Enterprise: `executeNotebook()`, `scheduleNotebook()`
- Vertex AI: `predictCustomModel()`, `deployModel()`
- Pipeline: `analyzeForensicDocument()`, `batchForensicAnalysis()`

**If removing:**
- Delete `server/core/gcp-ai.ts`
- Remove imports from other files
- Update Settings UI to remove Colab config

---

## Quick Wins 🟢

### TASK 07: Gateway.ts Review
**Status:** Gateway appears complete (reviewed first 326 lines)  
**Action:** Full review needed to confirm all endpoints implemented

### TASK 08: Database Schema Cleanup
**Delegate To:** Gemini 2.5 Flash  
**Priority:** LOW  
**Action:** Remove unused tables or implement features

**Unused tables:**
- `analysisModules` - No queries found
- `analysisResults` - No queries found
- `apiKeyUsageLogs` - No logging implementation
- `bertConfigs` - No BERT configuration UI
- `forensicResults` - No forensic results storage
- `hurtlexCategories`, `hurtlexSyncStatus` - Hurtlex integration incomplete

### TASK 09: Add Rate Limiting
**Delegate To:** Gemini 2.5 Flash  
**Priority:** MEDIUM  
**File:** `server/core/trpc.ts`

**Implementation:**
- Add rate limiting middleware
- Use in-memory store or Redis
- Limit by IP or user ID
- Different limits for different endpoints

### TASK 10: Add Basic Tests
**Delegate To:** Gemini 2.5 Flash  
**Priority:** MEDIUM  
**Files:** `server/**/*.test.ts`

**Test coverage needed:**
- Gateway endpoints (search, describe, invoke, getRef)
- Pattern router CRUD operations
- Core router logic
- Production pipeline

---

## Delegation Instructions

### For Gemini 2.5 Flash:
```
You are implementing the MCP Tool Platform codebase. Read the task file carefully and implement all functions according to the specifications. Use the provided database schema and follow the error handling patterns. Return the complete updated file(s).
```

### For Groq Compound:
```
Implement the specified functions in the MCP Tool Platform. Follow the task specifications exactly. Use Drizzle ORM for database queries. Handle errors with TRPCError. Return complete code.
```

---

## Cost Estimation

| Task | Model | Est. Tokens | Est. Cost |
|------|-------|-------------|-----------|
| Pattern Router | Gemini 2.5 Flash | 50K | Free |
| Core Router | Gemini 2.5 Flash | 30K | Free |
| Production Pipeline | Gemini 2.5 Flash | 20K | Free |
| Redis Queue | Gemini 2.5 Flash | 10K | Free |
| AWS AI (if kept) | Gemini 2.5 Flash | 40K | Free |
| GCP AI (if kept) | Gemini 2.5 Flash | 40K | Free |
| Tests | Gemini 2.5 Flash | 30K | Free |
| **TOTAL** | | **220K** | **$0** |

---

## Next Steps

1. ✅ Setup complete (dependencies installed, .env.example updated)
2. 🔄 Delegate TASK 01 (Pattern Router) to Gemini
3. 🔄 Delegate TASK 02 (Core Router) to Gemini
4. 🔄 Delegate TASK 03 (Production Pipeline) to Gemini
5. ⏸️ Decide on AWS/GCP AI services (keep or remove)
6. 🔄 Add tests and rate limiting

---

## Files Ready for Delegation

- `TASK_00_SETUP.md` - ✅ COMPLETE
- `TASK_01_PATTERN_ROUTER.md` - ✅ READY
- `CODE_REVIEW_FINDINGS.md` - ✅ REFERENCE

**Next:** Create TASK_02, TASK_03, etc. for remaining critical items.
