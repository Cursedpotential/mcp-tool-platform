# MCP Tool Platform - Manus Project Instructions

**Paste this into the Manus Project Instructions box**

---

## Project Overview

Forensic evidence processing platform for child custody cases. Multi-agent coordination with three-tier memory architecture and distributed infrastructure.

**Core Stack:** React 19 + Express 4 + tRPC 11 + PostgreSQL 16 + Chroma + Neo4j

---

## Critical Architecture Rules

### 1. Three-Tier Memory (DO NOT CONFUSE)

| Tier | Storage | Location | TTL | Purpose |
|------|---------|----------|-----|---------|
| **Persistent Context** | Graphiti + Neo4j | Cloud Run | ∞ | Knowledge graph |
| **Persistent Vectors** | pgvector | salem-nexus VPS | ∞ | Evidence embeddings |
| **Working Memory** | Chroma | salem-forge VPS | 72hr | Active analysis |
| **Scratch Space** | Chroma | **Manus platform** | 1hr | Agent coordination |
| **Session/Cache** | Redis | salem-forge VPS | Variable | Job queue, locks |

**CRITICAL:** Scratch Chroma runs **ON MANUS**, not on VPS. Code: `/server/_core/chroma-scratch.ts`

### 2. Infrastructure

**Manus Platform (this project):**
- Express + tRPC API
- Chroma Scratch Space (in-process)
- Evidence ingestion
- Agent coordination

**VPS1: salem-nexus (116.203.199.238):**
- PostgreSQL 16 + 59 extensions
- Directus, PhotoPrism, n8n, LibreChat

**VPS2: salem-forge (116.203.198.77):**
- Chroma (working memory, 72hr TTL)
- Redis (session/cache)
- LiteLLM, MetaMCP, Kasm

**Google Cloud Run:**
- Graphiti + Neo4j Aura (persistent graph)

**Cloudflare:**
- R2 (evidence storage with WORM)
- 6 Workers (auth, cache, rate-limit, webhooks, hasher, storage)

### 3. UUIDv7 Everywhere

**All IDs must be UUIDv7** (time-ordered, monotonic).

- PostgreSQL 18+: Native `uuidv7()`
- PostgreSQL 13-17: `pg_uuidv7` extension (requires Supabase image)
- App-side: `import { v7 as uuidv7 } from 'uuid'`

**Current:** PostgreSQL 16 on salem-nexus needs Supabase image or app-side generation.

### 4. Evidence Chain of Custody

**Every evidence operation MUST log:**
- Input hash (SHA-256)
- Output hash
- Tool used
- Provider used
- Timestamp
- traceId (UUIDv7)

**Storage:** R2 with Bucket Lock (1-year retention, immutable).

### 5. PostgreSQL Extensions (59 Total)

**Critical extensions in `/deploy/docker/postgres-init.sql`:**
- `vector` (pgvector) - Embeddings
- `pgmq` - Job queue
- `pg_cron` - Scheduled tasks
- `pg_net` - Database webhooks
- `pgsodium` - Vault crypto
- `pg_graphql` - GraphQL API
- PostGIS suite (8 extensions) - Geospatial

**Requires:** `supabase/postgres:15` image (not `postgres:16-alpine`).

---

## Delegation Requirements

When delegating to external LLMs (Groq, Gemini, OpenRouter, etc.):

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

## Development Workflow

### Adding Features
1. Update schema: `drizzle/schema.ts`
2. Push migration: `pnpm db:push`
3. Add DB helpers: `server/db.ts`
4. Create tRPC procedures: `server/routers.ts`
5. Build UI: `client/src/pages/`
6. Write tests: `server/*.test.ts`

### Evidence Processing Flow
1. **Ingest** → R2 upload + SHA-256 hash
2. **Embed** → pgvector storage
3. **Extract** → Entities/events to Graphiti
4. **Analyze** → Multi-agent coordination
5. **Store** → Neo4j graph + evidence chain

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
**Right:** Every operation logs traceId, hashes, timestamps

### ❌ Mixing Memory Tiers
**Wrong:** Storing permanent data in Chroma  
**Right:** Permanent → Neo4j/pgvector, Working → Chroma (72hr), Scratch → Chroma (1hr)

---

## Key Files

### Infrastructure
- `/deploy/docker/docker-compose.vps1-complete.yml` - salem-nexus
- `/deploy/docker/docker-compose.vps2-salem-forge.yml` - salem-forge
- `/deploy/docker/postgres-init.sql` - 59 PostgreSQL extensions
- `/deploy/cloudflare/wrangler.toml` - Cloudflare Workers

### Code
- `/server/_core/chroma-scratch.ts` - Scratch space (Manus)
- `/server/db.ts` - Database helpers
- `/server/routers.ts` - tRPC procedures
- `/drizzle/schema.ts` - Database schema

### Documentation
- `/PROJECT_GUIDE.md` - Comprehensive guide (this is the full version)
- `/docs/handoff/` - AI agent delegation instructions
- `/docs/CHATGPT_SPEC_REVIEW.md` - ChatGPT's 5 milestones

---

## Environment Variables

**Manus Platform:**
- `DATABASE_URL` - MySQL/TiDB connection
- `JWT_SECRET` - Session signing
- `CHROMA_SCRATCH_PATH` - Local Chroma storage (default: `./data/chroma-scratch`)

**VPS Secrets:**
- `POSTGRES_PASSWORD` - PostgreSQL superuser
- `CHROMA_AUTH_TOKEN` - Chroma API auth
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` - Cloudflare R2
- `NEO4J_URL`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` - Neo4j Aura

---

## Next Steps

1. Deploy VPS infrastructure (Thread 1)
2. Deploy Graphiti to Cloud Run (Thread 2)
3. Implement agent coordination (Thread 3 - needs thinking types spec)
4. Build evidence parsers
5. Create timeline UI

---

**Full Guide:** See `/PROJECT_GUIDE.md` for detailed architecture and deployment instructions.
