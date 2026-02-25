# Pitfalls Research

**Domain:** Forensic evidence preprocessing platform (multi-database TypeScript + Python NLP bridge)
**Project:** MCP Tool Platform
**Researched:** 2026-02-25
**Confidence:** HIGH (verified against Context7 for Neo4j/ChromaDB/Graphiti, Node.js official docs for child_process, codebase inspection for project-specific issues)

---

## Critical Pitfalls

### Pitfall 1: Python Bridge Silent Failure — JS Fallbacks Mask Broken NLP

**Severity:** BLOCKER

**What goes wrong:**
The Python bridge (`python-bridge.ts`) resolves with `{ success: false }` when Python is unavailable or crashes, then every NLP function silently falls back to primitive JS implementations. The JS fallback for sentiment analysis is a 17-word positive/17-word negative word list. The JS fallback for embeddings is a bag-of-words hash that produces garbage vectors. You process 8 years of messages thinking you have real NLP analysis, but you actually have toy regex results. Every pattern detection downstream is compromised, and you don't know until you try to use the results in court.

**Why it happens:**
- `callPython()` catches all errors and resolves (never rejects) — line 29: `return new Promise(resolve => {`
- No logging distinguishes "Python worked" from "used JS fallback" at the pipeline level
- The `graphiti-client.ts` has a *separate* Python bridge (lines 211-254) using `spawn("python", ...)` with different error handling (it rejects instead of resolving) — two bridges with incompatible failure modes
- `process.cwd()` for `PYTHON_TOOLS_DIR` (line 11) means the path changes depending on where Node starts
- On the remote VPS, Python may be `python3` but the graphiti-client hardcodes `python` (line 217)
- No health check verifies Python + spaCy + sentence-transformers are actually installed on the VPS

**Warning signs:**
- NLP results show `method: "js_fallback"` in responses
- Sentiment analysis confidence is always exactly 0.5 (JS fallback default)
- Embeddings model shows `"js_bow_hash"` instead of actual model name
- Entity extraction only finds EMAIL, URL, DATE, MONEY types (JS regex patterns) — never PERSON, ORG, GPE, etc.

**How to avoid:**
1. **Add a startup health gate:** Before the server accepts requests, run `checkPythonAvailability()` AND verify spaCy model loads. If Python NLP isn't available, log a FATAL error and refuse to start the pipeline (still allow the web UI).
2. **Unify the two Python bridges:** `python-bridge.ts` and `graphiti-client.ts` both spawn Python differently. Create one bridge module. Use the same Python command detection (`python3` vs `python`), the same timeout handling, the same error semantics.
3. **Tag every result with its source:** Every NLP result stored in any database should include `{ method: "spacy" | "js_fallback", confidence_note: "..." }`. Make the pipeline reject storing JS fallback results into evidence databases.
4. **Test the bridge first:** Before processing any messages, run a canary test: `callPython("analyze_sentiment", { text: "I love this" })` and verify `method !== "js_fallback"`.

**Phase to address:** Phase 0 (before any data processing). This is pre-requisite to everything.

---

### Pitfall 2: Multi-Database Write Inconsistency — Partial Failures Leave Ghost Data

**Severity:** BLOCKER

**What goes wrong:**
A single message gets processed and written to 5 databases: PostgreSQL (metadata + hash), Neo4j (entities + relationships), ChromaDB (embeddings), pgvector (semantic search), and Directus (file references). If write #3 fails (e.g., ChromaDB is unreachable on VPS), writes 1-2 succeed. Now PostgreSQL says the message is "processed," Neo4j has the entities, but ChromaDB has no embeddings and pgvector has no search index. The message appears in timeline views but is invisible to semantic search. There is no transaction spanning all 5 databases. There is no reconciliation mechanism. There is no retry queue for partial failures.

**Why it happens:**
- No distributed transaction coordinator exists (and adding one would be over-engineering for a solo project)
- Each database client (`graphiti-client.ts`, `chroma-client.ts`, `pgvector-client.ts`) handles its own connections independently
- Network failures to remote VPS services (Neo4j, ChromaDB, Directus) are transient and unpredictable
- The production pipeline (`production-pipeline.ts`) likely calls each storage client sequentially without tracking which succeeded
- No "processing status" field in PostgreSQL records which database writes completed

**Warning signs:**
- PostgreSQL record count doesn't match ChromaDB document count or Neo4j entity count
- Semantic search misses messages that appear in timeline views
- Pattern detection finds different results than knowledge graph queries
- Server logs show connection errors to any VPS service during processing

**How to avoid:**
1. **Add a `write_status` JSON column to PostgreSQL:** For each processed message, track `{ pg: true, neo4j: true, chromadb: false, pgvector: true, directus: false }`. This is your reconciliation ledger.
2. **Implement a simple retry queue:** When a database write fails, don't abort the whole pipeline. Log the failure, mark the status, continue with other databases. A background job retries failed writes every 5 minutes.
3. **Build a reconciliation check:** A simple script that counts records in each database and flags mismatches. Run it after each batch import.
4. **Test VPS connections before batch processing:** Before starting a large import, ping all 5 databases. If any are down, refuse to start the import (and tell the user which one).

**Phase to address:** Phase 1 (wiring milestone). Must be built into the pipeline from the start, not retrofitted.

---

### Pitfall 3: The "80% Built" Trap — Wiring Takes 3x Longer Than Building

**Severity:** BLOCKER

**What goes wrong:**
Individual components work in isolation but integrating them exposes a cascade of incompatibilities. The ~80 TypeScript errors from the branch merge are the symptom, not the disease. Each error you fix may reveal a type mismatch between what one module exports and another expects. The 21 Pattern Library TODOs in the frontend mean the UI exists but has never talked to the backend. The first time they connect, you discover the tRPC procedure returns data shaped differently than the React component expects. Every "wire it up" task becomes a debugging session that leads to 3 other modules.

**Why it happens:**
- Components were built at different times, possibly by different AI agents, with different assumptions about data shapes
- TypeScript errors compound: fixing one may change types that 10 other files depend on
- No integration tests exist to verify component contracts
- 22+ tRPC routers were built but never called from the UI (the API surface is untested)
- Pattern Library has 303 patterns but the UI has 21 TODOs — the frontend was scaffolded, not implemented
- Solo developer without programming experience = debugging integration issues is 10x slower

**Warning signs:**
- Fixing one TypeScript error creates 2 new ones in other files
- "Fixed the build" but the page shows blank or errors in browser console
- tRPC calls return 500 errors because the procedure signature doesn't match what the UI sends
- Spending >2 hours on a single integration point without progress

**How to avoid:**
1. **Fix the 80 TypeScript errors FIRST, before wiring anything:** This is unglamorous but critical. TypeScript errors are compile-time contracts. If the contracts are broken, nothing downstream works. Use `tsc --noEmit` to verify.
2. **Wire ONE vertical slice end-to-end before touching anything else:** Pick the simplest flow: upload a small Facebook export -> parse -> show parsed messages in UI. Don't touch NLP, don't touch Neo4j, don't touch pattern detection. Get raw data flowing first.
3. **Use browser DevTools Network tab to debug API calls:** When a page doesn't work, the Network tab shows exactly what the UI sent and what the server returned. This is faster than reading code.
4. **Set a 2-hour timebox for each integration task:** If stuck for 2 hours, stop. Write down what you tried. Get AI help. Context-switching kills solo devs.
5. **Ruthlessly defer what doesn't serve the messaging workflow:** Knowledge graph browsing, graph analytics, LLM integration — all cool, all deferrable. The goal is: upload messages -> see them in the UI with basic metadata.

**Phase to address:** Phase 0 (TypeScript fix) and Phase 1 (one vertical slice). The ordering is critical: fix build -> one vertical slice -> expand.

---

### Pitfall 4: Graphiti Requires LLM Calls Per Episode — Cost and Latency Explosion

**Severity:** HIGH

**What goes wrong:**
Graphiti's `add_episode()` is not a simple database write. Per the official docs (Context7, source reputation: HIGH), each episode ingestion triggers LLM inference to extract entities, build relationships, and resolve entity deduplication. For 8 years of messaging data with potentially tens of thousands of messages, this means tens of thousands of LLM API calls. At even $0.01 per call, that's $100+ just for ingestion. At 2-5 seconds per call, that's days of processing time. The `add_episode_bulk()` method is faster but explicitly warns it "does not perform edge invalidation" — meaning temporal contradictions won't be detected, which is the whole point for a forensic case.

**Why it happens:**
- Graphiti is designed for AI agent workloads (small, incremental updates) not bulk forensic analysis
- The official docs require `OPENAI_API_KEY` by default — Graphiti uses OpenAI for entity extraction
- The `graphiti-client.ts` wraps Graphiti via Python subprocess, adding spawn overhead per call
- No batching strategy exists in the codebase — each message would spawn a separate Python process for `add_episode`
- `add_episode_bulk` skips edge invalidation, making it unsuitable for temporal contradiction detection (core forensic use case)

**Warning signs:**
- OpenAI API costs spike after starting ingestion
- Processing a batch of 100 messages takes >5 minutes
- Neo4j graph has duplicate entities (same person, different nodes) because bulk mode skipped deduplication
- Python process spawning becomes the bottleneck (each `runPythonCommand` spawns a new Python interpreter)

**How to avoid:**
1. **Don't use Graphiti for initial bulk ingestion.** Use the direct Neo4j `storeEntities()`/`storeRelationships()` methods (already in `graphiti-client.ts` lines 113-155) for bulk loading. These are pure Cypher queries, no LLM required.
2. **Use Graphiti selectively for high-value episodes only.** After basic entities are loaded, use `add_episode` for specific conversations flagged by pattern detection — not for every message.
3. **Implement a persistent Python process (not spawn-per-call).** Instead of `spawn("python", [script, command, args])` for every call, start a long-running Python process with stdin/stdout JSON-RPC. One process startup, many calls.
4. **Budget LLM calls explicitly.** If using Graphiti's LLM features, calculate: (number of messages) x (cost per LLM call) = total cost. Set a daily budget cap.
5. **Configure Graphiti with a local LLM** via the Provider Hub's Ollama integration instead of OpenAI. Slower but free.

**Phase to address:** Phase 2+ (after basic pipeline works). Knowledge graph enrichment is a later optimization, not Phase 1.

---

### Pitfall 5: ChromaDB "TTL" is Application-Side Only — Data Doesn't Auto-Delete

**Severity:** HIGH

**What goes wrong:**
The `chroma-client.ts` stores `expires_at` timestamps in metadata and has a `cleanupExpiredEvidence()` method, but ChromaDB itself has no native TTL mechanism. The cleanup only happens when someone calls that method. If the server crashes, restarts, or nobody triggers cleanup, expired evidence stays in ChromaDB forever, consuming memory and polluting search results. The `ttl_hours: 72` in collection metadata is just a label — ChromaDB ignores it.

**Why it happens:**
- ChromaDB has no built-in TTL feature (verified via Context7, chroma-core/chroma)
- The cleanup logic (lines 228-258) requires explicit invocation — no scheduler triggers it
- No startup hook runs cleanup after server restart
- The `where: { expires_at: { $lt: now } }` filter uses string comparison on ISO timestamps, which works but is fragile (timezone issues, formatting inconsistencies)
- `getEvidenceStats()` (lines 263-302) calls `this.evidenceCollection.get()` with no filters — fetches ALL documents into Node.js memory. At scale, this crashes the process.

**Warning signs:**
- ChromaDB collection grows indefinitely even though "TTL" is configured
- `getEvidenceStats()` becomes slow or crashes with out-of-memory
- Semantic search returns results from old, expired evidence
- Server restarts "reset" cleanup timers

**How to avoid:**
1. **Add cleanup to server startup:** Run `cleanupExpiredEvidence()` every time the server starts.
2. **Add a setInterval scheduler:** Run cleanup every 6 hours (4x per 72hr TTL period). Simple, doesn't need cron.
3. **Fix `getEvidenceStats()` to use pagination:** Don't fetch all documents. Use ChromaDB's `count()` for total, and `get()` with pagination for metadata aggregation.
4. **Add a cleanup status log:** After each cleanup, log how many documents were removed. If it's always 0, the TTL is either too long or nothing is being ingested.

**Phase to address:** Phase 1 (pipeline wiring). The cleanup scheduler should be wired when the pipeline is wired.

---

### Pitfall 6: Neo4j Session Leak — Every Query Opens a Session That May Not Close

**Severity:** HIGH

**What goes wrong:**
The `graphiti-client.ts` creates a new Neo4j session for every operation (`getSession()` on line 76-80) and relies on `finally` blocks to close them. But the `runPythonCommand()` method (lines 211-254) spawns a separate Python process that creates its OWN Neo4j connection. If the Python process hangs or crashes, that connection leaks. Additionally, the Neo4j driver is created without pool configuration (line 69-73) — no `maxConnectionPoolSize`, no `connectionAcquisitionTimeout`, no `connectionLivenessCheckTimeout`. Under load (e.g., processing a batch of messages), connection exhaustion can occur.

**Why it happens:**
- `neo4j.driver()` called with no pool config defaults to 100 max connections, but Python processes create their own separate connections outside the pool
- No connection pool monitoring or logging
- The `testConnection()` method (lines 83-95) opens and closes a session but doesn't check pool health
- Context7 (neo4j-javascript-driver, benchmark 94.9) explicitly recommends setting `maxConnectionPoolSize`, `connectionAcquisitionTimeout`, and `connectionLivenessCheckTimeout` for production

**Warning signs:**
- Neo4j server logs show "too many connections" or "connection pool exhausted"
- Queries start timing out after processing many messages
- Python processes hang waiting for Neo4j connections
- Server becomes unresponsive during batch processing

**How to avoid:**
1. **Add pool configuration to the Neo4j driver:**
   ```typescript
   this.driver = neo4j.driver(this.neo4jUrl, neo4j.auth.basic(...), {
     maxConnectionPoolSize: 25,        // Lower for single-user
     connectionAcquisitionTimeout: 30000,
     connectionLivenessCheckTimeout: 5000,
     maxConnectionLifetime: 3600000,   // 1 hour
   });
   ```
2. **Use `executeRead`/`executeWrite` instead of `session.run`:** The managed transaction methods handle retries on transient errors automatically (Context7 verified).
3. **Don't let Python processes create their own connections.** Pass Neo4j connection params via the Python bridge and have the Python side use its own pool — but with a shared maximum.
4. **Add `driver.verifyConnectivity()` to startup health check.**

**Phase to address:** Phase 1 (when wiring database connections).

---

### Pitfall 7: Hardcoded GCP API Keys in 5 Files — Security Debt That Blocks Deployment

**Severity:** HIGH

**What goes wrong:**
5 files contain hardcoded GCP API keys. If the repo is ever pushed to GitHub (even a private repo that later becomes public, or that a collaborator forks), those keys are compromised. Automated scanners (GitHub's secret scanning, GitGuardian, TruffleHog) will flag these immediately. More practically: if the keys are for a specific Google Cloud project, they may stop working when the project quota is exceeded or the key is rotated, breaking features silently.

**Why it happens:**
- Rapid prototyping — "I'll fix it later"
- No `.env` file or secrets management was set up early
- Keys were probably copy-pasted from Google Cloud console during development

**Warning signs:**
- `git log --all -p | grep -i "api_key\|api-key\|apikey"` returns hits
- GCP console shows unexpected API usage
- Features that use Google APIs intermittently fail

**How to avoid:**
1. **Move all keys to `.env` now.** This is a 30-minute task. Create `.env` from `.env.example`, replace hardcoded values with `process.env.GCP_API_KEY`.
2. **Add `.env` to `.gitignore`** (verify it's there already).
3. **Run `git log --all -p --diff-filter=A -- "*.ts" "*.js"` to find all committed secrets.** If keys were committed in git history, they're compromised even after removing them from the current code. Consider rotating the keys.
4. **Use `dotenv` (already likely in the project) consistently.** One `.env` file, one `dotenv.config()` call at startup.

**Phase to address:** Phase 0 (before deployment). Can be done in parallel with TypeScript error fixes.

---

## Moderate Pitfalls

### Pitfall 8: Large Message Export OOM — Loading Full Facebook Export Into Memory

**Severity:** MEDIUM

**What goes wrong:**
Facebook message exports can be hundreds of megabytes of JSON. If the document loaders (`server/mcp/loaders/`) use `JSON.parse(fs.readFileSync(...))`, the entire export loads into Node.js memory at once. A 500MB JSON file requires ~1.5GB of heap (JSON.parse creates objects 2-3x the file size). Node.js defaults to ~1.7GB heap. The process crashes with `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory`.

**Why it happens:**
- `JSON.parse()` is the most obvious way to read JSON, and it works fine for small files
- Facebook exports are monolithic JSON files (all messages in one `messages.json` per conversation)
- Node.js doesn't warn before hitting the heap limit — it just crashes

**Warning signs:**
- Server crashes with "JavaScript heap out of memory" during import
- Import works for small exports but fails for large ones
- Node.js process memory usage spikes to >1GB during import

**How to avoid:**
1. **Stream-parse large JSON files:** Use `stream-json` or `jsonparse` to process messages one at a time without loading the full file.
2. **Set `--max-old-space-size=4096` in Node.js startup** as a safety margin, but don't rely on it — streaming is the real fix.
3. **Chunk large exports at the file level first:** Before parsing, split a 500MB file into 50MB chunks. Process each chunk independently.
4. **Show a progress indicator:** For large imports, stream processing naturally provides progress (messages processed / estimated total).

**Phase to address:** Phase 1 (when building the upload -> parse flow).

---

### Pitfall 9: Manus OAuth Lock-In — Authentication May Not Work Outside Manus

**Severity:** MEDIUM

**What goes wrong:**
The OAuth implementation (`server/core/oauth.ts`) is tied to the Manus platform. If deploying independently on Salem Trinity VPS, the OAuth flow may not work because the Manus OAuth provider isn't available. The app becomes inaccessible because it can't authenticate the user.

**Why it happens:**
- OAuth was implemented against Manus's auth provider during initial development
- The OAuth callback URL is likely configured for a Manus-hosted domain
- No fallback authentication mechanism exists

**Warning signs:**
- Login page redirects to a Manus URL that returns 404 or error
- OAuth callback URL mismatch errors in the browser
- Can't access the app at all after deployment to VPS

**How to avoid:**
1. **For the immediate milestone, add a simple bypass:** Since this is a single-user app behind Tailscale + Cloudflare Access, add an environment variable `AUTH_MODE=bypass` that skips OAuth entirely. Tailscale already provides network-level authentication.
2. **Don't spend time building a new OAuth flow now.** The Tailscale + Cloudflare Access double-gate is sufficient security for a single-user forensic tool.
3. **Document the auth dependency** so a future milestone can replace it if needed.

**Phase to address:** Phase 1 (deployment configuration).

---

### Pitfall 10: Spawn-Per-Call Python Overhead — Each NLP Operation Boots an Entire Python Interpreter

**Severity:** MEDIUM

**What goes wrong:**
Every call to `callPython()` or `runPythonCommand()` spawns a new Python process. Python startup takes 200-500ms. Loading spaCy models takes 2-5 seconds. Loading sentence-transformers takes 3-10 seconds. For a batch of 1000 messages, that's 1000 Python startups = 200-500 seconds of pure overhead, plus model loading multiplied 1000x if the models aren't cached in memory.

**Why it happens:**
- `child_process.spawn()` is the simplest way to call Python from Node.js
- Each spawn is a clean process — no model caching between calls
- The bridge was designed for occasional calls, not batch processing

**Warning signs:**
- Processing time per message is dominated by Python startup, not actual NLP
- System resource usage shows many short-lived Python processes
- Processing 100 messages takes >10 minutes when each should take <1 second

**How to avoid:**
1. **Replace spawn-per-call with a long-running Python process.** Start one Python process at server startup that listens on stdin for JSON-RPC commands. Models load once, stay in memory.
2. **Alternative: Use a Python HTTP server.** Run a small FastAPI/Flask server alongside Node.js. Node.js sends HTTP requests to localhost. This is more robust than stdin/stdout IPC.
3. **Batch NLP calls:** Instead of sending one message at a time, send arrays of messages to a single Python invocation. Process 100 messages per spawn instead of 1.

**Phase to address:** Phase 2 (optimization, after basic pipeline works).

---

### Pitfall 11: `process.cwd()` Path Dependency — Python Bridge Breaks From Different Working Directories

**Severity:** MEDIUM

**What goes wrong:**
`python-bridge.ts` line 11: `const PYTHON_TOOLS_DIR = join(process.cwd(), "server", "python-tools")`. The path to Python scripts depends on where Node.js was started. If started from the project root, it works. If started from `server/`, the path becomes `server/server/python-tools` (wrong). Docker containers, PM2, and systemd may all set `cwd` differently.

**Why it happens:**
- `process.cwd()` is the running directory, not the project directory
- Different deployment tools (Docker, PM2, systemd) set working directories differently
- Easy to miss in development where `cwd` is always the project root

**Warning signs:**
- Python bridge works locally but fails in Docker or on VPS
- Error: `ENOENT: no such file or directory` with a path that looks doubled
- Bridge works with `npm run dev` but fails with `pm2 start` or `node dist/server.js`

**How to avoid:**
1. **Use `import.meta.url` (like `graphiti-client.ts` does) instead of `process.cwd()`:**
   ```typescript
   const __filename = fileURLToPath(import.meta.url);
   const __dirname = path.dirname(__filename);
   const PYTHON_TOOLS_DIR = path.resolve(__dirname, "../python-tools");
   ```
2. **This is a one-line fix** that should be done when first touching `python-bridge.ts`.

**Phase to address:** Phase 1 (when fixing the Python bridge).

---

## Minor Pitfalls

### Pitfall 12: ChromaDB String Comparison for Dates — Timezone Fragility

**Severity:** LOW

**What goes wrong:**
The TTL cleanup uses `where: { expires_at: { $lt: now } }` comparing ISO timestamp strings lexicographically. This works IF all timestamps are in UTC with consistent formatting. If any timestamp uses a different timezone offset or format (`2026-02-25T10:00:00Z` vs `2026-02-25T10:00:00+00:00` vs `2026-02-25T10:00:00.000Z`), the comparison produces wrong results.

**How to avoid:**
Store all timestamps in the same format. Use `.toISOString()` consistently (already done in most places). Add a comment documenting the format requirement.

**Phase to address:** Phase 1 (during cleanup wiring).

---

### Pitfall 13: Zero Test Coverage — No Safety Net for Integration Changes

**Severity:** LOW (for now, but becomes HIGH as complexity grows)

**What goes wrong:**
With 22+ tRPC routers, 37 tool plugins, and 5 database clients, any change can break something unexpected. Without tests, you only discover breakage when you use the feature manually. Integration changes (the current milestone) are exactly when tests would catch the most bugs.

**How to avoid:**
1. **Don't aim for comprehensive test coverage now.** That's a trap.
2. **Write ONE integration test:** "Upload a small Facebook export, verify it appears in PostgreSQL." This single test covers the most critical path.
3. **Add smoke tests for each database connection:** "Can I connect to Neo4j? ChromaDB? PostgreSQL?" Run at startup.

**Phase to address:** Phase 1 (one smoke test per database, one integration test for the happy path).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| JS fallback NLP (current) | App runs without Python | Garbage NLP results pollute evidence databases | NEVER for evidence processing — only for UI demo/preview |
| Hardcoded API keys (current) | Faster prototyping | Security breach risk, key rotation breaks features | Never in committed code, fix before any deployment |
| No database write tracking | Simpler pipeline code | Ghost data, inconsistent cross-database state | Only during initial development — not in production pipeline |
| Spawn-per-call Python | Simple implementation | 100-500ms overhead per call, model reload per call | Acceptable for <10 calls/session, unacceptable for batch |
| `process.cwd()` paths | Works in development | Breaks in Docker, PM2, systemd deployment | Never — use `import.meta.url` always |
| No ChromaDB cleanup scheduler | Less startup complexity | Unbounded collection growth, stale search results | Acceptable for first week of testing, then must fix |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Neo4j on remote VPS | Assuming `bolt://` works over public internet | Use `neo4j+s://` (encrypted) or tunnel via Tailscale. Verify `verifyConnectivity()` at startup. |
| ChromaDB on remote VPS | Assuming ChromaDB has auth | ChromaDB has no built-in authentication. Must be behind Tailscale/firewall. NEVER expose to public internet. |
| Directus file storage | Assuming Directus API token works across restarts | Directus static tokens persist, but session tokens expire. Use static tokens for server-to-server. |
| PostgreSQL via Drizzle | Assuming connection string works for all operations | Drizzle connection pools have defaults that may be too low for batch operations. Set `max: 10` explicitly. |
| Graphiti via Python | Assuming Graphiti works without OpenAI key | Graphiti requires an LLM for entity extraction. Either set `OPENAI_API_KEY` or configure alternative LLM provider. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full Facebook JSON into memory | OOM crash, "heap out of memory" | Stream-parse with `stream-json` | Files >200MB |
| `getEvidenceStats()` fetching all ChromaDB docs | Slow response, eventual OOM | Use `count()` and paginated `get()` | >10,000 evidence chunks |
| Spawning Python per NLP call in batch mode | Processing takes hours instead of minutes | Long-running Python process or HTTP server | >50 messages per batch |
| Neo4j unbounded query results | Memory spike, slow queries | Always use `LIMIT` in Cypher queries | >1,000 entities per query |
| Graphiti `add_episode` per message | LLM cost explosion, days of processing | Bulk load via direct Cypher, use Graphiti selectively | >100 episodes |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Hardcoded GCP API keys (5 files) | Key compromise if repo is shared or leaked | Move to `.env`, rotate keys after cleanup |
| ChromaDB exposed without auth | Anyone on the network can read/delete all vector data | Ensure ChromaDB is behind Tailscale, never on public interface |
| Manus OAuth credentials in code | OAuth client secret compromise | Move to `.env`, verify `.gitignore` covers auth configs |
| No rate limiting on tRPC endpoints (if exposed) | Resource exhaustion, DoS | Cloudflare Workers edge layer should handle this — verify it's active |
| Python bridge command injection (theoretical) | If user input reaches `spawn()` args unsanitized | Always JSON.stringify args (already done), never interpolate into command strings |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indicator during import | Matt thinks the app is frozen during large imports | Stream processing with WebSocket progress updates (log-stream.ts exists) |
| Error messages showing stack traces | Confusing for non-programmer user | Catch errors at the tRPC layer, return human-readable messages |
| 21 Pattern Library TODOs showing as blank/broken UI | Pages feel broken even though backend works | Either wire them or hide unfinished pages behind a feature flag |
| No "what went wrong" for failed pipeline steps | Import fails silently, no guidance on what to fix | Log each pipeline step, show a clear status per step in the UI |

## "Looks Done But Isn't" Checklist

- [ ] **Python Bridge:** Has JS fallbacks for all functions — verify Python is actually being used (check `method` field in responses)
- [ ] **ChromaDB TTL:** Collection metadata says "72hr TTL" — verify `cleanupExpiredEvidence()` is actually being called on a schedule
- [ ] **OAuth Login:** Login page exists — verify it works outside Manus platform (probably doesn't)
- [ ] **Pattern Detection:** 303 patterns defined in schema — verify the analyzer actually loads and runs them (not just schema definitions)
- [ ] **Knowledge Graph:** `graphiti-client.ts` has 752 lines of code — verify it actually connects to Neo4j and processes data (may have never been exercised)
- [ ] **LLM Provider Hub:** 1725 lines of code — verify at least one provider is configured and responds
- [ ] **Document Loaders:** Facebook, SMS, PDF loaders exist — verify they produce the data shape downstream components expect
- [ ] **tRPC Routers:** 22+ routers defined — verify the frontend actually calls them (not just `console.log("TODO")`)
- [ ] **Ingestion Pipeline:** Pipeline code exists — verify it calls storage clients in the right order and handles failures
- [ ] **Deployment Config:** Docker Compose exists — verify images build and containers start on Salem Trinity VPS

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Ghost data from partial writes | MEDIUM | Build reconciliation script, re-process mismatched records |
| Garbage NLP results from JS fallback | HIGH | Must re-process all affected messages after fixing Python bridge |
| OOM crash during import | LOW | Restart server, implement streaming, re-run import |
| Neo4j connection exhaustion | LOW | Restart server and Neo4j, add pool config |
| Expired ChromaDB data not cleaned | LOW | Run `cleanupExpiredEvidence()` manually, add scheduler |
| Hardcoded keys compromised | MEDIUM | Rotate all keys in GCP console, update `.env`, audit access logs |
| Graphiti LLM cost overrun | MEDIUM | Stop ingestion, switch to direct Cypher loading, implement budget caps |

## Pitfall-to-Phase Mapping

| Pitfall | Severity | Prevention Phase | Verification |
|---------|----------|------------------|--------------|
| Python bridge silent failure | BLOCKER | Phase 0 | Startup health gate logs `[PYTHON] NLP ready: spaCy=true, transformers=true` |
| Multi-database write inconsistency | BLOCKER | Phase 1 | `write_status` column in PostgreSQL, reconciliation count matches |
| "80% built" integration cascade | BLOCKER | Phase 0 then Phase 1 | `tsc --noEmit` exits 0, one vertical slice works end-to-end |
| Graphiti LLM cost explosion | HIGH | Phase 2+ | Budget cap configured, bulk ingestion uses direct Cypher |
| ChromaDB no auto-cleanup | HIGH | Phase 1 | Server logs show cleanup running every 6 hours |
| Neo4j session/connection leak | HIGH | Phase 1 | Pool config in driver constructor, `verifyConnectivity()` at startup |
| Hardcoded API keys | HIGH | Phase 0 | `grep -r "AIza\|api_key\|API_KEY" --include="*.ts"` returns 0 results |
| Large JSON OOM | MEDIUM | Phase 1 | 500MB test file imports without crash |
| Manus OAuth lock-in | MEDIUM | Phase 1 | App accessible on VPS without Manus platform |
| Python spawn overhead | MEDIUM | Phase 2 | Batch of 100 messages processes in <60 seconds |
| `process.cwd()` path dependency | MEDIUM | Phase 1 | Python bridge works when started from any directory |
| Timestamp string comparison | LOW | Phase 1 | All `expires_at` values use `.toISOString()` format |
| Zero test coverage | LOW→HIGH | Phase 1 | At least 1 integration test + 5 smoke tests exist |

## Sources

- Node.js child_process official documentation (v25.7.0) — pipe buffer limits, maxBuffer defaults, spawn error handling [HIGH confidence]
- Context7: neo4j/neo4j-javascript-driver (benchmark 94.9) — connection pooling, session management, executeRead/executeWrite, error retry logic [HIGH confidence]
- Context7: chroma-core/chroma (benchmark 79.9) — collection management, batch operations (300 vectors/batch), no native TTL [HIGH confidence]
- Context7: websites/help_getzep_graphiti (benchmark 68) — add_episode, add_episode_bulk (no edge invalidation warning), LLM requirement, Neo4j configuration [HIGH confidence]
- Codebase inspection: `python-bridge.ts` (626 lines), `graphiti-client.ts` (752 lines), `chroma-client.ts` (513 lines) — actual implementation patterns and bugs [HIGH confidence]
- PROJECT.md — project constraints, known risks, active requirements [HIGH confidence]

---
*Pitfalls research for: MCP Tool Platform — forensic evidence preprocessing*
*Researched: 2026-02-25*
*Author: gsd-project-researcher@opencode*
