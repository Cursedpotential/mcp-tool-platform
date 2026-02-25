# MCP Tool Platform

## What This Is

A forensic evidence preprocessing platform that ingests messaging data (Facebook, SMS, Snapchat, etc.), processes it through 80+ MCP-compliant tools (NLP, behavioral pattern detection, forensic hashing), and stores results across a multi-database architecture (PostgreSQL/pgvector, Neo4j/Graphiti knowledge graph, ChromaDB, MySQL, Directus). Built for a single user — Matt Salem — to process 8+ years of digital communications for a Michigan family court custody case (Salem v. Kinzel, No. 2025-53985-DC).

## Core Value

Take raw messaging exports and turn them into searchable, pattern-tagged, forensically-hashed evidence with a temporal knowledge graph — so behavioral patterns across years of communication become visible and court-presentable.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Inferred from existing codebase. -->

- MCP Gateway with 4-endpoint API (search_tools, describe_tool, invoke_tool, get_ref) — existing (`server/mcp/gateway.ts`, 1431 lines)
- Plugin registry with 37 tool plugins (NLP, forensics, document, search, graph analytics) — existing (`server/mcp/plugins/registry.ts`)
- tRPC API layer with 22+ routers (system, auth, mcp, config, stats, llm, forensics, patterns, agents, graphiti, ingestion, etc.) — existing (`server/api/index.ts`)
- Multi-database routing: PostgreSQL (primary), MySQL (app), Neo4j (graph), ChromaDB (vectors), Directus (files) — existing (`server/core/db.ts`)
- 303 behavioral patterns for detecting gaslighting, DARVO, coercive control, NPD/BPD/ASPD/DV indicators — existing (pattern schemas + `server/mcp/forensics/pattern-analyzer.ts`)
- Document loaders for Facebook, SMS, PDF, XML message formats — existing (`server/mcp/loaders/`)
- Production ingestion pipeline with multi-stage processing — existing (`server/mcp/pipelines/production-pipeline.ts`)
- NLP classifiers and conversation segmentation — existing (`server/mcp/analysis/multi-pass-classifier.ts`)
- Content-addressed artifact store with SHA-256 hashing and paged retrieval — existing (`server/mcp/store/content-store.ts`)
- Forensic chain of custody with hashing and audit trails — existing (`server/mcp/forensics/`)
- LLM Provider Hub with smart routing across 20+ providers — existing (`server/mcp/llm/provider-hub.ts`, 1725 lines)
- MCP server proxy aggregating remote MCP servers (HTTP/WS/stdio) — existing (`server/mcp/proxy/mcp-proxy.ts`, 707 lines)
- Graphiti temporal knowledge graph client over Neo4j — existing (`server/mcp/storage/graphiti-client.ts`, 752 lines)
- ChromaDB dual-collection system (72hr TTL evidence processing + persistent project context) — existing (`server/mcp/storage/chroma-client.ts`, 513 lines)
- PGVector semantic search with Ollama embeddings — existing (`server/mcp/storage/pgvector-client.ts`)
- Graph analytics (community detection, centrality, temporal patterns) — existing (Priority 2/3 implementations)
- React SPA with 12 routes (dashboard, tools, stats, settings, config, logs, proxy, forks, wiki, API keys, MCP config, patterns) — existing (`client/src/App.tsx`)
- Agent dashboard with document analysis, pattern analysis, timeline generation UIs — existing (`client/src/agents/`)
- Human-in-the-loop (HITL) approval workflow for low-confidence pattern detections — existing (`server/mcp/hitl/`)
- OAuth + API key authentication with role-based access — existing (`server/core/oauth.ts`, `server/routers/api-keys.ts`)
- Real-time log streaming with structured logging — existing (`server/mcp/realtime/log-stream.ts`)
- Task execution engine with Redis-based queue — existing (`server/mcp/workers/executor.ts`, `server/mcp/queue/redis-queue.ts`)
- Python bridge for NLP/ML tools (spaCy, NLTK, sentence-transformers, Graphiti) — existing (`server/mcp/python-bridge.ts`)
- Docker Compose multi-VPS deployment config (Salem Trinity: 3 VPS, 20+ services) — existing (`deploy/`)
- Cloudflare Workers edge layer (auth proxy, R2 storage, evidence hasher, cache, rate limiter, webhooks) — existing (`deploy/cloudflare/`)
- Drizzle ORM schema with 12+ tables and 3 SQL migrations — existing (`drizzle/schema.ts`)

### Active

<!-- Current scope. Building toward these. Priority: messaging workflow end-to-end. -->

- [ ] Wire UI pages to backend procedures (21 Pattern Library TODOs, multiple pages not connected)
- [ ] Fix ~80 TypeScript errors from branch merge so the app builds clean
- [ ] End-to-end messaging workflow: upload raw export -> parse -> NLP tag -> pattern detect -> store in all databases -> browse results
- [ ] External service connection testing (Neo4j, ChromaDB, PostgreSQL, Directus on Salem Trinity VPS)
- [ ] LLM integration wiring (Provider Hub exists but needs connection testing and UI integration)
- [ ] Python bridge testing (NLP tools exist but bridge may not be exercised end-to-end)
- [ ] Case Bible (Obsidian vault) integration — read evidence from / write reports to the vault
- [ ] Snapchat message parser (schema exists at `server/mcp/schemas/snapchat_messages.json`, no loader yet)
- [ ] Knowledge graph browsing UI — query and visualize the Neo4j/Graphiti temporal graph from the frontend
- [ ] Test coverage — zero tests currently exist

### Out of Scope

- Multi-user/multi-tenant support — single user (Matt), no need for user management beyond owner
- Mobile app — desktop/laptop browser only
- Real-time collaboration — solo operation
- Public-facing deployment — private Tailscale + Cloudflare Access only
- Voice/video processing integration — future, after messaging workflow is solid
- TraceIQ integration — separate GSD project, will be wired in later via MCP gateway
- Automated court document generation — future milestone after evidence processing works
- CI/CD pipeline — not needed until deployment is stable

## Context

**Court case:** Salem v. Kinzel, No. 2025-53985-DC, Genesee County 7th Circuit Court, Family Division. Matt Salem (pro se) hasn't seen his daughter Kailah (age 5) in 10 months. The platform processes digital evidence to demonstrate systematic behavioral patterns across 8+ years of communications.

**Evidence types:** Text messages (8+ years), location history (2017-2024 Google Timeline), communication logs (multiple platforms), documents (court filings, correspondence), 303 behavioral patterns (NPD/BPD/ASPD/DV library).

**Case Bible:** Obsidian vault at `C:\Users\matts\OneDrive\Case Bible` — the knowledge base for the case. Currently being reorganized by another agent. Eventual bidirectional integration with this platform is an architectural requirement but not yet built.

**Codebase state:** ~75-80% built. Documentation understates completion — Priority 2/3 features (pgvector, Graphiti, graph analytics) are implemented but gap docs weren't updated. ~80 TypeScript errors from a branch merge need fixing. 21 Pattern Library TODOs in frontend. Multiple UI pages exist but aren't wired to their backend procedures.

**Prior art:** Several sub-projects in TheBigOne workspace (TraceIQ, Evidence Analysis, Voice Analysis) implement pieces of this functionality independently. Those tools will eventually be orchestrated through the MCP gateway, but currently there are zero runtime dependencies between sub-projects.

## Constraints

- **Solo operator**: Matt is not a trained programmer — tooling must work without deep debugging. Prefer "it just works" over clever abstractions.
- **Budget**: $24/month for 3 Hetzner VPS instances. No expensive cloud AI services beyond API-key-based usage.
- **Urgency**: No specific court deadline, but extreme personal urgency — 10 months without seeing daughter. Ship working features over polished features.
- **Stack locked**: TypeScript/Node 22 (server), React 19 (client), Express + tRPC, Drizzle ORM, pnpm. Documented in `STORAGE_ARCHITECTURE.md` (marked "DO NOT CHANGE") and `BACKEND_ARCHITECTURE.md` (marked "DEFINITIVE").
- **Deployment**: Salem Trinity 3-VPS architecture via Tailscale + Cloudflare. Docker Compose orchestration. No Kubernetes.
- **Python bridge**: Required for NLP/ML (spaCy, Graphiti, sentence-transformers). TypeScript server spawns Python processes via child_process.
- **Manus OAuth**: Authentication currently tied to Manus platform OAuth. May need replacement if deploying independently.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MCP Tool Platform first for GSD initialization (before TraceIQ) | It's the culmination project — all sub-projects feed into it. ~75-80% built vs TraceIQ's disaster state. | -- Pending |
| Messaging workflow as immediate priority | Matt needs to process messaging data into databases and build knowledge graph NOW. Not theoretical features, not polish. | -- Pending |
| Brownfield GSD approach with codebase mapping | Existing codebase is substantial — need to capture what's built before planning what's next. 7 codebase map documents written. | Good |
| Case Bible integration as architectural requirement (not immediate) | Obsidian vault is the brain of the operation but is currently being reorganized. Integration design should happen, but implementation waits. | -- Pending |
| Moderate court case context in project docs | Enough for agents to make smart decisions about forensic features, but not so much it overwhelms technical planning. | Good |
| Note-and-move-on for hardcoded GCP API keys (5 files) | Security issue exists but fixing it doesn't advance the messaging workflow. Will address before any public exposure. | Revisit |

---
*Last updated: 2026-02-25 after GSD initialization Step 4*
