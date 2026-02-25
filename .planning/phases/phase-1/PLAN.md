# Phase 1: Foundation — "Make It Compile and Connect"

**Phase:** 1 - Foundation
**Created:** 2026-02-25
**Requirements:** FOUND-01, FOUND-02, FOUND-03
**Estimated total effort:** 12-14 hours (OpenCode execution time)

---

## Codebase Discovery (2026-02-25)

Before planning, the actual codebase was inspected. Key findings:

| Item | Estimated | Actual |
|------|-----------|--------|
| TypeScript errors | ~80 | **177** |
| Errors in test files | unknown | **83 (47%)** |
| Errors in source files | unknown | **94 (53%)** |
| Errors in plugins-pending/ (dead GCP code) | unknown | **28 (16%)** |
| Unique files with errors | unknown | **40 files** |
| `pnpm install` works? | assumed yes | **No — stale `wouter@3.7.1.patch` reference breaks it (FIXED)** |
| Health checks at startup? | unknown | **Zero — server starts blind** |
| `initAllDatabases()` called? | unknown | **Exists but never called; skips ChromaDB + Directus** |
| Python bridge spawn logic | 2 files | **Confirmed: python-bridge.ts (626 lines) + graphiti-client.ts (752 lines)** |
| python-bridge.ts path bug | suspected | **Confirmed: uses `process.cwd()`, graphiti-client.ts correctly uses `import.meta.url`** |

### Error Distribution by Category

| TS Error Code | Count | Description |
|---------------|-------|-------------|
| TS7006 | 40 | Parameter implicitly has 'any' type (mostly tests + GCP plugins) |
| TS2322 | 28 | Type assignment incompatible |
| TS2339 | 22 | Property does not exist on type |
| TS2345 | 21 | Argument type mismatch |
| TS2554 | 9 | Wrong number of arguments |
| TS2307 | 8 | Cannot find module (supabase-client, pg, @mcp/core, etc.) |
| TS2741 | 7 | Missing required property |
| TS2802 | 5 | Iterator needs downlevelIteration flag |
| Other | 37 | Various (TS2461, TS2344, TS2769, TS2614, etc.) |

### Error Distribution by File (Top 10)

| File | Errors | Category |
|------|--------|----------|
| schema-resolver.test.ts | 28 | Test — implicit any params |
| gateway.agent.test.ts | 18 | Test — wrong context type |
| langgraph.test.ts | 16 | Test — BaseWorkflowState constraint |
| gcp-document-ai.ts | 13 | plugins-pending — implicit any + bad imports |
| langchain-memory.test.ts | 10 | Test — missing properties, wrong enum values |
| gcp-natural-language.ts | 8 | plugins-pending — type issues |
| timeline-generator.test.ts | 6 | Test — property/type mismatches |
| graph-analytics.ts | 5 | Source — Entity type missing properties |
| pgvector-client.ts | 4 | Source — missing pg module + void indexing |
| bert-sentiment.ts | 4 | Source — Pipeline type mismatch |

---

## Tasks

---

### Task 1: tsconfig Quick Wins — Exclude Dead Code and Fix Iterator Flag

**Requirement:** FOUND-01
**Files:** `tsconfig.json`
**What:**
1. Add `"server/mcp/plugins-pending/**/*"` to the `exclude` array. These are unused GCP plugin stubs (document-ai, natural-language, speech, video-intelligence, vision) that account for 28 errors. They are explicitly in a `plugins-pending` folder — not active code.
2. Add `"downlevelIteration": true` to `compilerOptions`. This fixes 5 TS2802 errors where `Map`, `Set`, and `MapIterator` iteration fails without this flag. The project already targets ESNext so this is safe.
3. Remove the stale `patchedDependencies` entry for `wouter@3.7.1` from `package.json` (the patch file doesn't exist and breaks `pnpm install`). **NOTE: Already done during discovery.**

**Verify:** `pnpm run check 2>&1 | grep "error TS" | wc -l` shows ~33 fewer errors (from 177 to ~144)
**Depends on:** none
**Estimated time:** 15 minutes

---

### Task 2: Fix Missing Module References

**Requirement:** FOUND-01
**Files:**
- `server/mcp/loaders/document-hierarchy.ts`
- `server/mcp/pipelines/document-pipeline.ts`
- `server/mcp/pipelines/production-pipeline.ts`
- `server/mcp/storage/pgvector-client.ts`
- `server/mcp/forensics/pattern-analyzer.ts`
- `server/mcp/plugins/nlp.ts`

**What:**
1. **supabase-client (TS2307, 3 files):** Three files import from `'../storage/supabase-client'` which doesn't exist. This is dead Supabase integration code.
   - `document-hierarchy.ts`: Replace the supabase import with a TODO comment and stub the function calls. The file also has 3 implicit any errors (lines 355, 375, 376) — add type annotations.
   - `document-pipeline.ts`: Same — remove supabase import, stub or remove the dependent code.
   - `production-pipeline.ts`: Same treatment.
2. **pg module (TS2307, pgvector-client.ts line 12):** Import `pg` which isn't in package.json (using `postgres` package instead). Replace `import { Pool } from 'pg'` with the postgres.js client from `server/core/db.postgres.ts`. Also fix the 2 void-indexing errors (lines 140, 143) that result from this broken import.
3. **@langchain/community/embeddings/ollama (TS2307, pgvector-client.ts line 11):** This subpath doesn't exist in the installed version. Replace with direct Ollama HTTP call or `@langchain/ollama` if available. Check what's actually installed.
4. **Missing imports in pattern-analyzer.ts (TS2304, lines 844-846):** `and`, `eq` are used but not imported. Add `import { and, eq } from 'drizzle-orm';`
5. **detectToxicity in nlp.ts (TS2339, line 460):** References `pythonBridge.detectToxicity` which doesn't exist in python-bridge.ts exports. Either add the function to python-bridge.ts or remove the call and add a TODO.

**Verify:** `pnpm run check 2>&1 | grep "TS2307\|TS2304" | wc -l` shows 0
**Depends on:** Task 1
**Estimated time:** 1.5 hours

---

### Task 3: Fix Core Server Type Errors

**Requirement:** FOUND-01
**Files:**
- `server/core/oauth.ts`
- `server/core/sdk.ts`
- `server/mcp/auth/api-keys.ts`
- `server/api/routers/pattern-approval.ts`
- `server/api/routers/settings.ts`
- `server/api/routers/graphiti.ts`
- `server/api/routers/hitl.ts`
- `server/api/copilotkit/index.ts`

**What:**
1. **oauth.ts (3 errors):** `null` not assignable to `string | undefined`. Change the three `null` returns/assignments to `undefined` (or use `?? undefined` on the values). Lines 33-35.
2. **sdk.ts (4 errors):** Same null-vs-undefined pattern (lines 281-283) plus `lastSignedIn` property doesn't exist in the upsertUser type (line 299). Fix: update the `upsertUser` interface in db.ts to include `lastSignedIn`, or remove the property from the call.
3. **api-keys.ts (3 errors):** `insertId` and `affectedRows` on `never` type. The MySQL query result type isn't being inferred. Fix: add explicit return type annotations to the MySQL query calls, or cast the results.
4. **pattern-approval.ts (3 errors):** `TransactionSql<{}>` is not callable. Lines 132, 206, 282. The `postgres` library's transaction API is being used incorrectly — likely needs `sql` tagged template instead of function call syntax.
5. **settings.ts (1 error):** MySQL `boolean` type mismatch — Drizzle MySQL maps boolean to `"true"|"false"` string. Fix: use string literal `"true"` instead of boolean `true` for `isActive`.
6. **graphiti.ts (2 errors):** Wrong argument count — tRPC procedure calls expect 2-3 args but getting 1. Add missing context/input arguments.
7. **hitl.ts (1 error):** Same pattern as graphiti.ts — add missing argument.
8. **copilotkit/index.ts (1 error):** CopilotKit Action parameter type mismatch. Fix: cast the `type` field to `as const` or use the CopilotKit `Parameter` type properly.

**Verify:** `pnpm run check 2>&1 | grep -c "server/core/\|server/api/"` shows 0 (excluding test files)
**Depends on:** Task 1
**Estimated time:** 2 hours

---

### Task 4: Fix MCP Source File Type Errors

**Requirement:** FOUND-01
**Files:**
- `server/mcp/forensics/forensics-router.ts`
- `server/mcp/forensics/hurtlex-fetcher.ts`
- `server/mcp/forensics/identity-service.ts`
- `server/mcp/forensics/chain-custody.ts`
- `server/mcp/forensics/pattern-analyzer.ts` (remaining after Task 2)
- `server/mcp/plugins/graph-analytics.ts`
- `server/mcp/plugins/bert-sentiment.ts`
- `server/mcp/plugins/evidence-linker.ts`
- `server/mcp/plugins/html-parser.ts`
- `server/mcp/plugins/registry.ts`
- `server/mcp/plugins/schema-resolver.ts`
- `server/mcp/orchestration/forensic-workflow.ts`
- `server/mcp/orchestration/sub-agents.ts`
- `server/mcp/storage/pgvector-client.ts` (remaining after Task 2)

**What:**
1. **forensics-router.ts (4 errors):** Schema mismatch — `userId` doesn't exist in insert type, `insertId` on never. Fix: align insert calls with actual Drizzle schema columns. Check `drizzle/schema.ts` for actual column names.
2. **hurtlex-fetcher.ts (3 errors):** Uses `.onDuplicateKeyUpdate()` which is MySQL syntax — but this table is in PostgreSQL (Drizzle PG). Fix: replace with `.onConflictDoUpdate()` (Drizzle PG upsert syntax). Also fix the `boolean === 'string'` comparison (line 501).
3. **identity-service.ts (1 error):** `participants` expects `string[]` but getting `string`. Fix: wrap in array or fix the schema to match.
4. **chain-custody.ts (1 error):** `this` implicitly has `any`. Fix: add explicit `this` parameter type annotation to the function at line 253.
5. **pattern-analyzer.ts (1 remaining error):** `insertId` on never (line 1654). Fix: add return type annotation to the insert query.
6. **graph-analytics.ts (5 errors):** Entity objects missing `properties` field. Fix: add `properties: {}` to the entity literals at lines 1366, 1392, 1424, 1524, 1562.
7. **bert-sentiment.ts (4 errors):** `TextClassificationPipeline` doesn't satisfy `Pipeline` type (missing `processor`). Fix: use the correct type from `@huggingface/transformers` or cast.
8. **evidence-linker.ts (3 errors):** Iterator issues — should be fixed by `downlevelIteration` in Task 1. Verify.
9. **html-parser.ts (1 error):** `processChunk` doesn't exist on `Partial<Handler>`. Fix: check the htmlparser2 API for correct method name, or add type assertion.
10. **registry.ts (3 errors):** `"access:mem0"` not assignable to `ToolPermission`. Fix: add `"access:mem0"` to the ToolPermission union type definition.
11. **schema-resolver.ts (4 errors):** Functions expect 2-3 args but called with 1. Fix: add the missing arguments to callPython calls (likely missing the `args` object).
12. **forensic-workflow.ts (1 error):** `streamGraph` doesn't exist on LangGraphAdapter. Fix: check for correct method name or remove the call.
13. **sub-agents.ts (2 errors):** Type mismatches in audit_trail source and sentiment type. Fix: update the source literal to match the union type, add "tense" to sentiment union or map to valid value.

**Verify:** `pnpm run check 2>&1 | grep -v "\.test\." | grep -c "error TS"` shows 0
**Depends on:** Task 1, Task 2
**Estimated time:** 3 hours

---

### Task 5: Fix Test File Type Errors

**Requirement:** FOUND-01
**Files:**
- `server/mcp/plugins/schema-resolver.test.ts` (28 errors)
- `server/mcp/gateway.agent.test.ts` (18 errors)
- `server/mcp/orchestration/langgraph.test.ts` (16 errors)
- `server/mcp/orchestration/langchain-memory.test.ts` (10 errors)
- `server/mcp/forensics/timeline-generator.test.ts` (6 errors)
- `server/tests/auth.logout.test.ts` (3 errors)
- `server/core/db.test.ts` (1 error)
- `server/mcp/gateway.test.ts` (1 error)

**What:**
1. **schema-resolver.test.ts (28 errors):** All TS7006 — parameter `f` implicitly has `any` type. Fix: Add explicit type annotations to all `.find(f =>` callbacks. Also fix 4 import errors (TS2724/TS2614) — use correct export names from schema-resolver.ts (lowercase `schemaResolver`, default exports for types).
2. **gateway.agent.test.ts (18 errors):** All TS2345 — `{}` not assignable to `TrpcContext`. Fix: Create a proper mock context object at the top of the test file that satisfies the `TrpcContext` type (check `server/core/context.ts` for the shape), then use it in all `createCaller({})` calls. Also 1 TS2802 Set iteration — already fixed by downlevelIteration.
3. **langgraph.test.ts (16 errors):** TS2344 — test state types don't satisfy `BaseWorkflowState` constraint. Fix: Add `workflow_id`, `stage`, `timestamp`, `metadata` fields to test state types. Also fix `streamGraph` (doesn't exist) and `conditionalEdges` (doesn't exist) property accesses.
4. **langchain-memory.test.ts (10 errors):** Missing `reasoning` property in ClassificationSnapshot (7 errors), invalid sentiment values like `"hostile"` and `"abusive"` (2 errors), unknown property `sentiment` on AnalysisSnapshot (2 errors). Fix: Add `reasoning: ''` to snapshot objects, use valid enum values, fix property name.
5. **timeline-generator.test.ts (6 errors):** `description` doesn't exist on TimelineEvent (3 errors), `category` type mismatch (1), private method access (1), wrong arg count (1). Fix: Use correct property names from TimelineEvent type, cast category `as const`, make method public or test via public API.
6. **auth.logout.test.ts (3 errors):** `Date` not assignable to `string`. Fix: Use `.toISOString()` on Date values.
7. **db.test.ts (1 error):** Argument type mismatch for `getDatabaseForOperation`. Fix: Pass correct operation string.
8. **gateway.test.ts (1 error):** `Date` not assignable to `string`. Fix: Use `.toISOString()`.

**Verify:** `pnpm run check` exits with code 0 (ZERO errors). This is the final verification for FOUND-01.
**Depends on:** Task 1, Task 2, Task 3, Task 4
**Estimated time:** 2.5 hours

---

### Task 6: Create Database Health Check System

**Requirement:** FOUND-02
**Files:**
- `server/core/health.ts` (NEW)
- `server/mcp/storage/chroma-client.ts` (modify — add testConnection method)

**What:**
Create `server/core/health.ts` that tests all 5 database tiers and reports clear pass/fail:

```
Tier 1: PostgreSQL  ✓ Connected (latency: 12ms)
Tier 2: Neo4j       ✗ FAILED — Connection refused (bolt://neo4j:7687)
Tier 3: ChromaDB    ✓ Connected (2 collections)
Tier 4: MySQL       ✓ Connected (latency: 8ms)
Tier 5: Directus    ✗ FAILED — Auth failed (http://directus:8055)
```

Implementation:
1. Create `server/core/health.ts` with a `checkAllDatabases()` function that:
   - Calls `testPrimaryConnection()` for PostgreSQL (already exists)
   - Calls `graphitiClient.testConnection()` for Neo4j (already exists)
   - Calls new `chromaManager.testConnection()` for ChromaDB (need to add)
   - Calls `testMySqlConnection()` for MySQL (already exists)
   - Calls `directusClient.healthCheck()` for Directus (already exists but not wired)
   - Each tier wrapped in try/catch with timeout (5 second max per tier)
   - Returns structured result: `{ tier: string, status: 'pass'|'fail', latency?: number, error?: string }[]`
   - Logs formatted console output with pass/fail indicators
2. Add `testConnection()` method to ChromaDB's `ChromaManager` class in `chroma-client.ts`:
   - Try `this.client.heartbeat()` (ChromaDB standard health check)
   - Return `{ success: boolean, collections?: number, error?: string }`
3. The function should NOT throw if individual tiers fail — it reports and continues. PostgreSQL failure is a warning (it's the primary), others are informational.

**Verify:** Import and call `checkAllDatabases()` manually — it should print status for all 5 tiers without crashing even if all services are down.
**Depends on:** Task 1 (needs to compile)
**Estimated time:** 1.5 hours

---

### Task 7: Wire Health Checks into Server Startup

**Requirement:** FOUND-02
**Files:**
- `server/core/index.ts`

**What:**
Modify `startServer()` in `server/core/index.ts` to call `checkAllDatabases()` from Task 6 after the server starts listening:

1. Import `checkAllDatabases` from `'./health'`
2. After `server.listen()` callback, call `await checkAllDatabases()`
3. Log a summary line: `"Database connectivity: X/5 tiers connected"` or `"Database connectivity: X/5 tiers connected (Y failed — see above)"`
4. Do NOT block startup on database failures — the app should start even if external services are down. Log warnings, don't throw.
5. Store the health check results in a module-level variable so the existing `initAllDatabases()` in db.ts can be deprecated or redirected.

**Verify:**
- `pnpm run dev` starts the server and prints health check output for all 5 tiers
- If all external DBs are unreachable, server still starts and reports 0/5 connected with clear error messages per tier
- If PostgreSQL is reachable, it reports 1/5+ connected

**Depends on:** Task 6
**Estimated time:** 30 minutes

---

### Task 8: Create Unified Python Bridge

**Requirement:** FOUND-03
**Files:**
- `server/mcp/python-bridge.ts` (rewrite)
- `server/mcp/storage/graphiti-client.ts` (modify)

**What:**
The current state has two independent Python subprocess spawn implementations:

- **python-bridge.ts** (626 lines): Spawns a new Python process PER CALL via `child_process.spawn()`. Uses `process.cwd()` for paths (fragile). Has JS fallback functions. Talks to `nlp_runner.py`.
- **graphiti-client.ts** (752 lines): Has its own `runPythonCommand()` method (lines 211-255) that spawns Python separately. Uses `import.meta.url` for paths (correct). Talks to `graphiti_runner.py`.

Create a unified bridge:

1. **Rewrite `python-bridge.ts`** to be the single Python subprocess manager:
   - Fix path resolution: Replace `process.cwd()` with `import.meta.url` + `fileURLToPath` (like graphiti-client.ts already does)
   - Single `callPython(script, command, args)` function that takes the target script as a parameter (so it can dispatch to either `nlp_runner.py` or `graphiti_runner.py`)
   - Add `checkPythonHealth()` function that verifies:
     a. Python is installed and reachable
     b. `nlp_runner.py` can be executed (spaCy loads)
     c. `graphiti_runner.py` can be executed (graphiti-core imports)
   - Returns health status with clear method tagging: `method: "spacy" | "js_fallback" | "python_unavailable"`
   - Keep all existing high-level NLP functions (detectLanguage, extractEntities, etc.) with their JS fallbacks
   - Export a `pythonBridge` object with all methods

2. **Modify `graphiti-client.ts`** to use the unified bridge:
   - Remove the private `runPythonCommand()` method (lines 211-255)
   - Import `callPython` from the unified `python-bridge.ts`
   - Update all `this.runPythonCommand(command, args)` calls to use `callPython('graphiti_runner.py', command, args)`
   - Keep all Neo4j Cypher methods unchanged (they don't use Python)
   - Keep the `GraphitiClient` class structure — just swap the Python call mechanism

3. **Do NOT change the Python scripts themselves** (`nlp_runner.py`, `graphiti_runner.py`) — they work fine, the problem is only the TypeScript spawn logic.

**Verify:**
- `import { callPython, checkPythonHealth } from './python-bridge'` works
- `checkPythonHealth()` returns status for both NLP and Graphiti scripts
- `graphiti-client.ts` has zero spawn/child_process imports
- `grep -r "spawn(" server/mcp/storage/graphiti-client.ts` returns nothing
- `grep -r "child_process" server/mcp/storage/graphiti-client.ts` returns nothing
- `pnpm run check` still passes (zero TS errors)

**Depends on:** Tasks 1-5 (app must compile first)
**Estimated time:** 2.5 hours

---

## Success Criteria

1. **`pnpm run check` exits 0** — zero TypeScript errors (FOUND-01)
2. **Server startup prints database status for all 5 tiers** — PostgreSQL, Neo4j, ChromaDB, MySQL, Directus — with clear PASS/FAIL per tier (FOUND-02)
3. **Single Python bridge** — only `python-bridge.ts` spawns Python processes; `graphiti-client.ts` delegates to it. `grep -r "spawn(" server/mcp/storage/` returns nothing (FOUND-03)
4. **Python health check** — `checkPythonHealth()` reports whether spaCy and graphiti-core are loadable, does NOT silently fall back (FOUND-03)

---

## Execution Order

```
Task 1 (tsconfig)
  ├── Task 2 (missing modules) ──┐
  ├── Task 3 (core type errors)  ├── Task 4 (MCP type errors) ── Task 5 (test errors) ── Task 8 (unified bridge)
  └── Task 6 (health check) ── Task 7 (startup wiring)
```

Tasks 2, 3, and 6 can run in parallel after Task 1.
Task 4 depends on Tasks 2+3 (module fixes affect type resolution).
Task 5 depends on Task 4 (tests reference source types).
Task 7 depends on Task 6.
Task 8 depends on Task 5 (app must compile).

---

## Risk Notes

- **177 errors vs ~80 estimated:** The error count is 2x what was expected. Some errors may cascade (fixing one reveals others hidden behind it). Budget extra time.
- **Supabase removal:** Three files import from a non-existent supabase-client. Removing these imports may reveal downstream call sites that also need updating.
- **pgvector-client.ts:** Uses the `pg` package which isn't installed (project uses `postgres` package instead). This is a deeper fix than just changing an import — the Pool API is different.
- **Python bridge on Windows:** `python-bridge.ts` tries `python3` on non-Windows, `python` on Windows. The unified bridge should preserve this detection.

---

*Plan created: 2026-02-25 by gsd-planner@opencode*
*Ready for execution: yes*
