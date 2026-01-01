# MCP Tool Shop - Comprehensive Codebase Audit Report

**Date**: January 2026  
**Auditor**: Manus AI  
**Project**: MCP Preprocessing Tool Shop  
**Checkpoint**: c41e4bb3

---

## Executive Summary

The MCP Tool Shop has a solid foundation with extensive infrastructure in place. However, there are several **critical gaps**, **incomplete implementations**, and **placeholders** that need attention before the platform is production-ready.

### Overall Status

| Category | Status | Completion |
|----------|--------|------------|
| Core Infrastructure | ✅ Functional | 85% |
| Plugin Suite | ✅ Functional | 80% |
| LLM Integration | ⚠️ Partial | 60% |
| Frontend UI | ✅ Functional | 85% |
| Database Schema | ⚠️ Minimal | 40% |
| Testing | ⚠️ Basic | 30% |
| Forensics Features | ❌ Not Started | 0% |
| MCP Config Import | ❌ Not Started | 0% |

---

## 1. CRITICAL PLACEHOLDERS (Must Fix)

### 1.1 Smart Router - LLM Provider Calls
**File**: `server/mcp/llm/smart-router.ts` (lines 291-308)
**Issue**: The `callProvider` method returns a placeholder response instead of actually calling the LLM provider.

```typescript
// TODO: Implement actual provider call through hub
const response: LLMResponse = {
  content: 'Placeholder response',  // ← PLACEHOLDER
  model: 'unknown',
  provider: provider as any,
  latencyMs: Date.now() - startTime,
};
```

**Impact**: LLM routing does not work - all requests return "Placeholder response"

**Fix Required**: Connect to the provider hub's actual inference methods.

---

### 1.2 ML Plugin - Embedding Providers
**File**: `server/mcp/plugins/ml.ts` (lines 365-382)
**Issue**: All external embedding providers fall back to local (non-functional) implementation.

```typescript
async function generateOllamaEmbedding(text: string, model: string): Promise<number[]> {
  console.warn('Ollama embedding not implemented, using local fallback');
  return generateLocalEmbedding(text);  // ← Falls back to basic TF-IDF
}

async function generateOpenAIEmbedding(text: string, model: string): Promise<number[]> {
  console.warn('OpenAI embedding not implemented, using local fallback');
  return generateLocalEmbedding(text);
}

async function generateGeminiEmbedding(text: string, model: string): Promise<number[]> {
  console.warn('Gemini embedding not implemented, using local fallback');
  return generateLocalEmbedding(text);
}
```

**Impact**: Semantic search and ML features use low-quality local embeddings instead of proper vector embeddings.

**Fix Required**: Implement actual API calls to Ollama, OpenAI, and Gemini embedding endpoints.

---

### 1.3 Tool Testing - "Coming Soon" Button
**File**: `client/src/pages/Tools.tsx` (line 263)
**Issue**: Tool testing UI is disabled with "Coming Soon" message.

```tsx
<Button className="w-full" disabled>
  <Play className="h-4 w-4 mr-2" />
  Test Tool (Coming Soon)
</Button>
```

**Impact**: Users cannot test tools from the UI.

**Fix Required**: Implement tool invocation form with parameter inputs and result display.

---

## 2. INCOMPLETE FEATURES (Partially Implemented)

### 2.1 Database Schema - Missing Tables
**File**: `drizzle/schema.ts`
**Current Tables**: users, apiKeys, systemPrompts, workflowTemplates, apiKeyUsageLogs

**Missing Tables** (from conversation requirements):
- `behavioralPatterns` - For forensic pattern storage
- `patternCategories` - Pattern categorization
- `hurtlexTerms` - HurtLex dictionary terms
- `hurtlexCategories` - HurtLex category metadata
- `hurtlexSyncStatus` - GitHub sync tracking
- `bertConfigs` - BERT model configurations
- `severityWeights` - Severity scoring weights
- `mclFactors` - MCL 722.23 legal factors
- `schemaResolvers` - AI-generated field mappings
- `forensicResults` - Analysis result storage

**Impact**: Forensic analysis features cannot persist data.

---

### 2.2 Config Manager - In-Memory Only
**File**: `server/mcp/config/config-manager.ts`
**Issue**: All patterns, behaviors, and dictionaries are stored in-memory Maps, not persisted to database.

```typescript
class ConfigurationManager {
  private patterns: Map<string, PatternDefinition> = new Map();  // ← In-memory only
  private behaviors: Map<string, BehavioralDefinition> = new Map();
  private dictionaries: Map<string, CustomDictionary> = new Map();
  // ...
}
```

**Impact**: All configuration is lost on server restart.

**Fix Required**: Connect to database for persistence, or implement file-based storage.

---

### 2.3 Import Button - Not Functional
**File**: `client/src/pages/Config.tsx` (line 150-154)
**Issue**: Import button exists but has no functionality.

```tsx
<Button variant="outline" size="sm">
  <Upload className="h-4 w-4 mr-2" />
  Import
</Button>
```

**Impact**: Users cannot import configuration files.

**Fix Required**: Add file picker and call `config.importAll` mutation.

---

### 2.4 Chroma Integration - Not Connected
**Files**: `server/mcp/chroma/working-memory.ts`, `server/mcp/chroma/stream-processor.ts`
**Issue**: Chroma working memory code exists but is not integrated into the main pipeline.

**Impact**: Large file processing doesn't use vector working memory as designed.

---

## 3. MISSING FEATURES (From Conversation Requirements)

### 3.1 Forensic Analysis Pipeline
**Status**: ❌ Not Started
**Requirements from conversation**:
- HurtLex fetcher from GitHub
- Behavioral pattern matching
- BERT sentiment analysis
- Severity scoring with MCL 722.23 mapping
- Timeline generation
- Custom term management

**Files needed**:
- `server/lib/forensics/hurtlex-fetcher.ts` (was created but lost in sandbox reset)
- `server/lib/forensics/pattern-matcher.ts`
- `server/lib/forensics/severity-scorer.ts`
- `server/lib/forensics/timeline-generator.ts`

---

### 3.2 MCP Config Import & Auto-Discovery
**Status**: ❌ Not Started
**Requirements from conversation**:
- Import local MCP config files (claude_desktop_config.json)
- Auto-discover installed MCPs
- Suggest migration/integration paths
- Parse and validate existing configs

---

### 3.3 Docker CLI Bridge
**Status**: ❌ Not Started
**Requirements from conversation**:
- FastAPI endpoint on VPS
- Syncthing bidirectional sync
- Tailscale private network
- CLI tools: Gemini, Claude Code, Qwen, Aider

---

## 4. TODO ITEMS FROM CODE

### From `todo.md` - Unchecked Items:
- [ ] SQLite metadata layer with migrations
- [ ] Redis-backed distributed queue (optional mode)
- [ ] Chroma integration as working memory during preprocessing
- [ ] Interactive CLI review UI for batch approvals
- [ ] JSONL structured logging
- [ ] Health checks and concurrency limits
- [ ] CHANGELOG.md
- [ ] DEPLOYMENT.md
- [ ] Rules editor page (YAML/JSON rule sets)
- [ ] Sandbox path configuration
- [ ] Plugin manifest format (JSON/YAML)
- [ ] Hot-reload plugin support
- [ ] Plugin validation and sandboxing
- [ ] Pattern set versioning
- [ ] Version migration support
- [ ] Latency histograms per tool (P50/P95/P99)
- [ ] Usage heatmaps (time-based)
- [ ] Pipeline flow visualization
- [ ] Historical trend charts
- [ ] Qwen Coder integration
- [ ] Add sentence-transformers for local BERT embeddings
- [ ] Integrate Hugging Face transformers for classification

### From Code Comments:
- `server/db.ts:92` - "TODO: add feature queries here as your schema grows"
- `server/mcp/llm/smart-router.ts:299` - "TODO: Implement actual provider call through hub"

---

## 5. UI PLACEHOLDERS

### 5.1 Tool Testing
- Location: Tools page
- Status: Button disabled with "Coming Soon"
- Priority: High

### 5.2 Import Functionality
- Location: Config page
- Status: Button present but non-functional
- Priority: Medium

---

## 6. TEST COVERAGE

### Current Tests (28 passing):
- `server/mcp/store/content-store.test.ts` - 12 tests
- `server/auth.logout.test.ts` - 1 test
- `server/mcp/gateway.test.ts` - 15 tests

### Missing Test Coverage:
- Plugin execution tests
- LLM provider integration tests
- API key authentication tests
- Config manager persistence tests
- Forensic analysis tests
- End-to-end workflow tests

---

## 7. SECURITY CONSIDERATIONS

### 7.1 API Key Storage
- Keys are SHA-256 hashed ✅
- Prefix stored for identification ✅
- Permissions system in place ✅

### 7.2 Missing Security Features
- Rate limiting not implemented
- Request validation could be stronger
- No audit logging for sensitive operations
- CORS configuration needs review

---

## 8. RECOMMENDATIONS

### Immediate Priority (P0):
1. **Fix LLM Smart Router** - Make provider calls actually work
2. **Fix ML Embeddings** - Connect to real embedding APIs
3. **Add Database Tables** - Create forensics schema
4. **Persist Config Manager** - Save to database

### High Priority (P1):
1. Implement tool testing UI
2. Add import functionality to Config page
3. Create forensic analysis pipeline
4. Add MCP config import feature

### Medium Priority (P2):
1. Integrate Chroma working memory
2. Add more comprehensive tests
3. Implement missing dashboard visualizations
4. Add CHANGELOG and DEPLOYMENT docs

### Low Priority (P3):
1. Docker CLI bridge
2. Hot-reload plugin support
3. Advanced analytics (heatmaps, histograms)

---

## 9. FILES LOST IN SANDBOX RESET

The following files were created but lost when the sandbox was reset:
- `PLANNING.md` - Comprehensive planning document
- `ARCHITECTURE.md` - Technical architecture details
- `server/lib/forensics/hurtlex-fetcher.ts` - HurtLex GitHub fetcher

These need to be recreated.

---

## 10. SUMMARY TABLE

| Feature | Status | Blocker | Priority |
|---------|--------|---------|----------|
| MCP Gateway API | ✅ Working | None | - |
| Content Store | ✅ Working | None | - |
| Plugin Registry | ✅ Working | None | - |
| LLM Smart Router | ❌ Placeholder | Code needed | P0 |
| ML Embeddings | ❌ Placeholder | API integration | P0 |
| Tool Testing UI | ❌ Disabled | UI implementation | P1 |
| Config Persistence | ❌ In-memory | Database schema | P0 |
| Forensics Pipeline | ❌ Not started | Full implementation | P1 |
| MCP Config Import | ❌ Not started | Full implementation | P1 |
| Chroma Integration | ⚠️ Partial | Pipeline connection | P2 |
| Test Coverage | ⚠️ Basic | More tests needed | P2 |

---

**End of Audit Report**
