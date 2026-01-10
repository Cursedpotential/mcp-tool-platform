# MCP Tool Platform - Salem Forensics

A forensic evidence analysis platform built on the Model Context Protocol (MCP), designed for processing, analyzing, and managing digital evidence in legal proceedings. The platform provides AI-powered document analysis, pattern detection, and evidence chain verification with court-admissible audit trails.

---

## ⚠️ CRITICAL: Delegation Requirements

**ALL agents working on this project MUST delegate coding and routine tasks to external LLMs.** Do not write boilerplate code manually. Use the available API keys:

| Service | Use Case | Model |
|---------|----------|-------|
| **Groq** | Fast code generation, simple tasks | Llama 3.3 70B, Compound (free) |
| **Gemini** | Complex reasoning, GCP integration | Gemini 2.5 Flash |
| **OpenRouter** | Fallback, variety of models | Various |
| **Anthropic** | Complex analysis | Claude |

**How to delegate:**
```javascript
// Use Manus built-in API or direct API calls
const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${process.env.Groq_api_key}` },
  body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [...] })
});
```

Reserve your tokens for planning, architecture decisions, debugging, and user communication. Delegate everything else.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test

# Database migrations
pnpm db:push
```

---

## Architecture Overview

The platform operates across three deployment environments:

| Environment | Purpose | Services |
|-------------|---------|----------|
| **Manus Hosting** | Web application, API gateway, orchestration | Main platform, tRPC API, OAuth, **Chroma Scratch Space** |
| **salem-nexus (VPS1)** | Storage, CMS, chat interfaces | PostgreSQL (59 extensions), MariaDB, FerretDB, Directus, PhotoPrism, n8n, LibreChat, Open WebUI |
| **salem-forge (VPS2)** | Backend compute, AI services | LiteLLM, MetaMCP, **Chroma (Working Memory)**, Redis, Kasm Workspace, Browserless, Playwright |

Additional cloud services:
- **Cloudflare**: Workers (edge functions), R2 (storage with WORM, zero egress)
- **Google Cloud**: Document AI, Vision, NLP, Graphiti on Cloud Run
- **Neo4j Aura**: Knowledge graph (Graphiti backend)

---

## Three-Tier Memory Architecture

| Tier | Storage | Location | TTL | Purpose |
|------|---------|----------|-----|---------|
| **Persistent Context** | Graphiti + Neo4j | Cloud Run | ∞ | Entities, relationships, timelines |
| **Persistent Vectors** | pgvector | salem-nexus | ∞ | Evidence embeddings, semantic search |
| **Working Memory** | Chroma | salem-forge | 72hr | Active analysis, conversation context |
| **Scratch Space** | Chroma | **Manus platform** | 1hr | Agent coordination, workflow state |
| **Session/Cache** | Redis | salem-forge | Variable | Job queue, locks, rate limits |

**CRITICAL:** Scratch Chroma runs **ON MANUS** (`/server/_core/chroma-scratch.ts`), not on VPS.

---

## Key Features

- **UUIDv7 everywhere** (time-ordered, monotonic IDs)
- **Evidence WORM storage** (Cloudflare R2 with Bucket Lock, 1-year retention)
- **Job queue** (pgmq + Redis with retry logic, exponential backoff)
- **Multi-agent coordination** (Redis Streams + Chroma Scratch Space)
- **59 PostgreSQL extensions** (pgvector, pgmq, pg_cron, pg_net, pgsodium, pg_graphql, PostGIS suite)
- **MCP Gateway** (65+ tools for evidence processing)
- **Chain of custody** (SHA-256 hashing, immutable audit trail)

---

## Project Structure

```
mcp-tool-platform/
├── client/                 # React 19 frontend (Vite + Tailwind 4)
├── server/                 # Express 4 + tRPC 11 backend
│   ├── _core/              # Auth, LLM, Chroma Scratch, database
│   ├── mcp/                # MCP gateway (65+ tools)
│   │   ├── plugins/        # Tool implementations
│   │   ├── plugins-pending/# GCP plugins (need fixing)
│   │   └── orchestration/  # LangChain/LangGraph
│   ├── db.ts               # Database helpers
│   └── routers.ts          # tRPC procedures
├── deploy/                 # Deployment configs
│   ├── docker/             # VPS docker-compose, Dockerfiles, postgres-init.sql
│   ├── cloudflare/         # Edge workers (6 workers)
│   └── gcp/                # Cloud Run services
├── docs/                   # Documentation
│   ├── architecture/       # System design
│   ├── deployment/         # Deployment guides
│   └── handoff/            # Task handoffs (3 parallel threads)
├── drizzle/                # Database schema
├── PROJECT_GUIDE.md        # Comprehensive architecture guide
├── MANUS_PROJECT_INSTRUCTIONS.md  # Concise instructions for Manus
└── todo.md                 # Master task list
```

---

## Development Workflow

### Adding Features

1. **Update schema:** `drizzle/schema.ts`
2. **Push migration:** `pnpm db:push`
3. **Add DB helpers:** `server/db.ts`
4. **Create tRPC procedures:** `server/routers.ts`
5. **Build UI:** `client/src/pages/`
6. **Write tests:** `server/*.test.ts`

### Evidence Processing Flow

1. **Ingest** → Upload to R2, compute SHA-256
2. **Embed** → Generate embeddings, store in pgvector
3. **Extract** → Parse entities/events, send to Graphiti
4. **Analyze** → Multi-agent coordination via Redis Streams
5. **Store** → Results in Neo4j, evidence chain in PostgreSQL

---

## Documentation

- **[PROJECT_GUIDE.md](PROJECT_GUIDE.md)** - Comprehensive architecture, design decisions, deployment guide
- **[MANUS_PROJECT_INSTRUCTIONS.md](MANUS_PROJECT_INSTRUCTIONS.md)** - Concise instructions for Manus project settings
- **[/docs/handoff/](docs/handoff/)** - AI agent delegation instructions (3 parallel threads)
- **[/docs/CHATGPT_SPEC_REVIEW.md](docs/CHATGPT_SPEC_REVIEW.md)** - ChatGPT's 5 milestones analysis
- **[/docs/architecture/](docs/architecture/)** - System design documents
- **[/docs/deployment/](docs/deployment/)** - Deployment guides
- **[/todo.md](todo.md)** - Master task list

---

## Infrastructure Deployment

### Thread 1: VPS Infrastructure
**Handoff:** `/docs/handoff/HANDOFF_VPS_INFRASTRUCTURE.md`  
**Tasks:**
- Deploy salem-nexus services (PostgreSQL, Directus, PhotoPrism, n8n, LibreChat)
- Deploy salem-forge services (Chroma, Redis, LiteLLM, MetaMCP, Kasm)
- Configure cross-VPS firewall rules
- Deploy Cloudflare Workers

### Thread 2: GCP Integration
**Handoff:** `/docs/handoff/HANDOFF_GCP_INTEGRATION.md`  
**Tasks:**
- Fix TypeScript errors in Graphiti codebase
- Build Docker image
- Deploy to Cloud Run
- Wire Neo4j Aura connection

### Thread 3: Platform Features
**Handoff:** `/docs/handoff/HANDOFF_PLATFORM_FEATURES.md`  
**Tasks:**
- Implement agent coordination (Redis Streams + Chroma Scratch)
- Build evidence parsers (Facebook, Instagram, SMS, email)
- Create timeline UI

**BLOCKED:** Needs user's "thinking types" specification for cognitive architecture.

---

## PostgreSQL Extensions (59 Total)

Auto-install via `/deploy/docker/postgres-init.sql`:

**Critical Extensions:**
- `vector` (pgvector) - Embeddings and semantic search
- `pgmq` - Lightweight message queue (like AWS SQS)
- `pg_cron` - Job scheduler
- `pg_net` - Async HTTP client for database webhooks
- `pgsodium` - libsodium cryptographic functions (Vault)
- `pg_graphql` - GraphQL support
- `pg_jsonschema` - JSON schema validation
- PostGIS suite (8 extensions) - Geospatial data

**Requires:** `supabase/postgres:15` image (not `postgres:16-alpine`).

Full list: ltree, pgstattuple, citext, pg_stat_statements, bloom, dblink, hypopg, pgrowlocks, rum, pgroonga, wrappers, postgis, postgis_raster, postgis_sfcgal, postgis_tiger_geocoder, postgis_topology, pgrouting, address_standardizer, unaccent, pg_walinspect, pg_prewarm, pgaudit, dict_int, dict_xsyn, earthdistance, fuzzystrmatch, http, tcn, pgcrypto, insert_username, pgtap, btree_gin, btree_gist, tablefunc, hstore, index_advisor, sslinfo, plpgsql_check, pg_hashids, cube, uuid-ossp, pg_repack, intarray, postgres_fdw, autoinc, tsm_system_time, tsm_system_rows, moddatetime, lo, isn, seg.

---

## Stack

**Frontend:**
- React 19
- Tailwind CSS 4
- Wouter (routing)
- tRPC client
- shadcn/ui components

**Backend:**
- Express 4
- tRPC 11
- Drizzle ORM
- Superjson
- Zod validation

**Databases:**
- PostgreSQL 16 (salem-nexus)
- Neo4j Aura (Cloud Run)
- Chroma (salem-forge + Manus)
- Redis (salem-forge)
- MySQL/TiDB (Manus-provided)

**Storage:**
- Cloudflare R2 (evidence files with WORM)
- pgvector (embeddings)

**LLM:**
- LiteLLM proxy (salem-forge)
- Multiple providers (Groq, Gemini, OpenRouter, Anthropic, Cohere, Perplexity, Mistral, Grok)

---

## Current Status (Jan 10, 2026)

**Completed:**
- ✅ MCP Gateway with 65+ tools
- ✅ LangGraph forensic workflows
- ✅ VPS docker-compose files (salem-nexus, salem-forge)
- ✅ Cloudflare Workers (6 workers)
- ✅ R2 integration with WORM
- ✅ Python bridge for remote execution
- ✅ PostgreSQL 59 extensions setup
- ✅ Chroma Scratch Space on Manus
- ✅ Three-tier memory architecture
- ✅ PROJECT_GUIDE.md and MANUS_PROJECT_INSTRUCTIONS.md

**In Progress:**
- 🔄 GCP service integration (plugins need TypeScript fixes)
- 🔄 VPS deployment to Coolify
- 🔄 Agent coordination implementation

**Blocked:**
- ⛔ Thinking types spec (needs user input)
- ⛔ Cognitive architecture design

---

## Common Mistakes to Avoid

### ❌ Scratch Space on VPS
**Wrong:** Adding scratch Chroma to docker-compose  
**Right:** Scratch Chroma runs on Manus platform (`/server/_core/chroma-scratch.ts`)

### ❌ Using Standard PostgreSQL Image
**Wrong:** `postgres:16-alpine` (missing pgmq, pg_net, pgsodium)  
**Right:** `supabase/postgres:15` or custom build

### ❌ Forgetting Evidence Chain
**Wrong:** Processing evidence without logging  
**Right:** Every operation logs traceId (UUIDv7), SHA-256 hashes, timestamps

### ❌ Mixing Memory Tiers
**Wrong:** Storing permanent data in Chroma  
**Right:** Permanent → Neo4j/pgvector, Working → Chroma (72hr), Scratch → Chroma (1hr)

---

## Next Steps

1. **Deploy VPS infrastructure** (Thread 1) - Coolify deployment of salem-nexus + salem-forge
2. **Deploy Graphiti to Cloud Run** (Thread 2) - Fix TypeScript errors, build Docker image
3. **Implement agent coordination** (Thread 3) - Needs thinking types spec from user
4. **Build evidence parsers** (Facebook, Instagram, SMS, email)
5. **Create timeline UI** (visualize knowledge graph)

---

## License

Private - All rights reserved.

---

**Full Documentation:** See [PROJECT_GUIDE.md](PROJECT_GUIDE.md) for comprehensive architecture and deployment instructions.
