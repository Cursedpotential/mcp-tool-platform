# MCP Tool Platform - Project Guide

**Version:** 1.0  
**Last Updated:** January 10, 2026  
**Project Type:** Forensic Evidence Processing Platform with Multi-Agent Coordination

---

## Table of Contents

1. [What We're Building](#what-were-building)
2. [Architecture Overview](#architecture-overview)
3. [Three-Tier Memory System](#three-tier-memory-system)
4. [Infrastructure](#infrastructure)
5. [Key Design Decisions](#key-design-decisions)
6. [Development Workflow](#development-workflow)
7. [Deployment Guide](#deployment-guide)
8. [Knowledge References](#knowledge-references)

---

## What We're Building

The **MCP Tool Platform** is a forensic evidence processing system designed for child custody cases. It combines:

- **Multi-agent coordination** for complex evidence analysis workflows
- **Chain-of-custody tracking** with immutable evidence logging
- **Three-tier memory architecture** for context persistence across sessions
- **MCP (Model Context Protocol) integration** for tool orchestration
- **Distributed infrastructure** across Manus platform + 2 VPS servers

**Core Use Case:** Process evidence from multiple platforms (Facebook, Instagram, text messages, emails) to build a comprehensive timeline and knowledge graph for legal proceedings.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Manus Platform (Hosting)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Express + tRPC API                                       │   │
│  │  - Agent coordination                                     │   │
│  │  - Job queue management                                   │   │
│  │  - Evidence ingestion                                     │   │
│  │  - Chroma Scratch Space (1hr TTL)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─────────────────────────┐
                              │                         │
                              ▼                         ▼
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│  VPS1: salem-nexus (Storage & CMS)  │  │  VPS2: salem-forge (Processing)     │
│  ┌───────────────────────────────┐  │  │  ┌───────────────────────────────┐  │
│  │ PostgreSQL 16 + 59 Extensions │  │  │  │ Chroma (Working Memory)       │  │
│  │ - pgvector (embeddings)       │  │  │  │ - 72hr TTL                    │  │
│  │ - pgmq (job queue)            │  │  │  │ - Active analysis context     │  │
│  │ - pg_cron (scheduling)        │  │  │  └───────────────────────────────┘  │
│  │ - pg_net (webhooks)           │  │  │  ┌───────────────────────────────┐  │
│  └───────────────────────────────┘  │  │  │ Redis (Session/Cache)         │  │
│  ┌───────────────────────────────┐  │  │  └───────────────────────────────┘  │
│  │ Directus (CMS)                │  │  │  ┌───────────────────────────────┐  │
│  │ PhotoPrism (Media)            │  │  │  │ LiteLLM (LLM Proxy)           │  │
│  │ n8n (Workflows)               │  │  │  │ MetaMCP (MCP Registry)        │  │
│  │ LibreChat (Chat UI)           │  │  │  │ Kasm (Desktop)                │  │
│  └───────────────────────────────┘  │  │  └───────────────────────────────┘  │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Google Cloud Run (Persistent)                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Graphiti + Neo4j Aura                                    │   │
│  │  - Long-term knowledge graph                              │   │
│  │  - Entity relationships                                   │   │
│  │  - Timeline construction                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Three-Tier Memory System

The platform uses a **three-tier memory architecture** to balance performance, cost, and persistence:

### Tier 1: Persistent Context (Permanent)
**Storage:** Graphiti + Neo4j Aura (Google Cloud Run)  
**Purpose:** Long-term knowledge graph  
**Contents:**
- Entities (people, events, locations)
- Relationships (parent-child, communication patterns)
- Timeline events (custody exchanges, incidents)
- Case metadata

**Why:** Court-admissible evidence requires permanent, immutable storage with full provenance tracking.

### Tier 2: Working Memory (72hr TTL)
**Storage:** Chroma on salem-forge VPS  
**Purpose:** Active analysis and processing context  
**Contents:**
- Conversation history (multi-turn analysis)
- Active document embeddings
- Intermediate analysis results
- Cross-reference lookups

**Why:** Balances cost and performance for active cases. 72 hours covers typical analysis sessions without permanent storage overhead.

### Tier 3: Scratch Space (1hr TTL)
**Storage:** Chroma on Manus platform (in-process)  
**Purpose:** Agent coordination and ephemeral state  
**Contents:**
- Agent task assignments
- Workflow orchestration state
- Session-specific embeddings
- Temporary calculations

**Why:** Survives Manus platform restarts (unlike pure in-memory) while keeping ultra-short-lived data separate from working memory.

### Tier 4: Persistent Vectors (Permanent)
**Storage:** pgvector on salem-nexus PostgreSQL  
**Purpose:** Long-term semantic search  
**Contents:**
- Evidence document embeddings
- Message embeddings
- Artifact embeddings

**Why:** Enables semantic search across all evidence without re-embedding. Complements Neo4j graph with vector similarity.

### Tier 5: Session/Cache (Variable TTL)
**Storage:** Redis on salem-forge VPS  
**Purpose:** Fast key-value access  
**Contents:**
- Job queue (pgmq fallback)
- Rate limiting counters
- Session tokens
- Hot query results

**Why:** Sub-millisecond access for high-frequency operations.

---

## Infrastructure

### Manus Platform (Hosting)
- **Stack:** React 19 + Tailwind 4 + Express 4 + tRPC 11
- **Database:** MySQL/TiDB (Manus-provided)
- **Storage:** Cloudflare R2 (evidence files)
- **Scratch Space:** Chroma (in-process, local disk)

### VPS1: salem-nexus (116.203.199.238)
**Specs:** 8 vCPU, 16GB RAM, 60GB storage  
**Services:**
- PostgreSQL 16 (with 59 extensions)
- MariaDB 11 (PhotoPrism)
- FerretDB (MongoDB compatibility)
- Directus (headless CMS)
- PhotoPrism (AI media management)
- n8n (workflow automation)
- LibreChat (multi-LLM chat)
- Open WebUI (Ollama chat)

### VPS2: salem-forge (116.203.198.77)
**Specs:** 8 vCPU, 16GB RAM  
**Services:**
- Chroma (working memory, 72hr TTL)
- Redis (session/cache)
- LiteLLM (LLM proxy with caching)
- MetaMCP (MCP server registry)
- Kasm Workspace (persistent desktop)
- Browserless (headless Chrome)
- Playwright (browser automation)

### Google Cloud Run
**Service:** Graphiti + Neo4j Aura  
**Purpose:** Persistent knowledge graph

### Cloudflare
**Services:**
- R2 (evidence storage with WORM)
- Workers (6 deployed: auth, cache, rate-limit, webhooks, evidence-hasher, R2-storage)
- WAF (rate limiting: 120 req/min)

---

## Key Design Decisions

### 1. UUIDv7 for All IDs
**Decision:** Use UUIDv7 (time-ordered) for all primary keys  
**Rationale:**
- Monotonic ordering (better for indexes and logs)
- Timestamp extraction (audit trail)
- Distributed generation (no coordination needed)

**Implementation:**
- PostgreSQL 18+: Native `uuidv7()` function
- PostgreSQL 13-17: `pg_uuidv7` extension (requires Supabase image)
- App-side: `import { v7 as uuidv7 } from 'uuid'`

### 2. Evidence WORM Storage
**Decision:** Cloudflare R2 with Bucket Lock (1-year retention)  
**Rationale:**
- Immutable evidence (court admissibility)
- SHA-256 hashing for integrity verification
- Chain of custody tracking

**Implementation:**
- All evidence files uploaded to R2 with SHA-256 hash
- Metadata stored in PostgreSQL (pgvector for embeddings)
- R2 Bucket Lock prevents deletion/modification

### 3. Job Queue: pgmq + Redis
**Decision:** Use PostgreSQL-based message queue (pgmq) with Redis fallback  
**Rationale:**
- Transactional guarantees (evidence processing must not be lost)
- Deduplication (idempotency keys)
- Retry logic with exponential backoff

**Implementation:**
- `pgmq` extension on PostgreSQL
- Redis for hot queue (sub-second latency)
- Status tracking: queued → running → succeeded/failed/dead

### 4. Multi-Agent Coordination
**Decision:** Redis Streams + Chroma Scratch Space  
**Rationale:**
- Agents need shared blackboard for coordination
- Context continuity across agent handoffs
- Evidence logging for every agent step

**Implementation:**
- Redis Streams for task distribution
- Chroma Scratch Space for agent state
- Evidence chain: traceId → R2/Chroma → Neo4j

### 5. PostgreSQL Extensions (59 total)
**Decision:** Install all Supabase extensions for maximum compatibility  
**Rationale:**
- Future-proofing (avoid "missing extension" errors)
- Full-text search (pgroonga)
- Geospatial (PostGIS suite)
- Job scheduling (pg_cron)
- Webhooks (pg_net)

**Critical Extensions:**
- `vector` (pgvector) - Embeddings
- `pgmq` - Job queue
- `pg_cron` - Scheduled tasks
- `pg_net` - Database webhooks
- `pgsodium` - Vault crypto
- `pg_graphql` - GraphQL API
- PostGIS suite (8 extensions) - Geospatial

### 6. No Tailscale (Public IPs)
**Decision:** Use public IPs with firewall rules instead of Tailscale  
**Rationale:**
- Simpler deployment (no VPN configuration)
- Coolify compatibility
- Firewall rules sufficient for 2-VPS setup

**Implementation:**
```bash
# On salem-nexus, allow salem-forge
ufw allow from 116.203.198.77 to any port 5432

# On salem-forge, allow salem-nexus
ufw allow from 116.203.199.238
```

---

## Development Workflow

### Local Development
```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test

# Database migrations
pnpm db:push
```

### Adding Features
1. **Update schema** in `drizzle/schema.ts`
2. **Push migration**: `pnpm db:push`
3. **Add DB helpers** in `server/db.ts`
4. **Create tRPC procedures** in `server/routers.ts`
5. **Build UI** in `client/src/pages/`
6. **Write tests** in `server/*.test.ts`

### Evidence Processing Workflow
1. **Ingest** → Upload to R2, compute SHA-256
2. **Embed** → Generate embeddings, store in pgvector
3. **Extract** → Parse entities/events, send to Graphiti
4. **Analyze** → Multi-agent coordination via Redis Streams
5. **Store** → Results in Neo4j, evidence chain in PostgreSQL

---

## Deployment Guide

### Prerequisites
- Coolify access (salem-nexus, salem-forge)
- Cloudflare account (R2, Workers)
- Google Cloud account (Cloud Run, Neo4j Aura)
- Environment variables (see `.env.example`)

### Step 1: Deploy VPS Infrastructure
See `/docs/handoff/HANDOFF_VPS_INFRASTRUCTURE.md`

1. Upload docker-compose files to Coolify
2. Configure environment variables
3. Start services
4. Verify health checks

### Step 2: Deploy Cloudflare Workers
```bash
cd deploy/cloudflare
npx wrangler deploy r2-storage.js --name salem-r2-storage
npx wrangler deploy evidence-hasher.js --name salem-evidence-hasher
npx wrangler deploy auth-proxy.js --name salem-auth-proxy
npx wrangler deploy cache-api.js --name salem-cache-api
npx wrangler deploy rate-limiter.js --name salem-rate-limiter
npx wrangler deploy webhook-receiver.js --name salem-webhook-receiver
```

### Step 3: Deploy Graphiti to Cloud Run
See `/docs/handoff/HANDOFF_GCP_INTEGRATION.md`

1. Fix TypeScript errors in Graphiti codebase
2. Build Docker image
3. Deploy to Cloud Run
4. Configure Neo4j Aura connection

### Step 4: Deploy Manus Platform
1. Push code to GitHub
2. Manus auto-deploys from `main` branch
3. Configure environment variables in Manus UI
4. Verify services (tRPC API, Chroma Scratch Space)

### Step 5: Verify End-to-End
1. Upload test evidence file
2. Verify R2 storage + SHA-256 hash
3. Check pgvector embeddings
4. Confirm Neo4j graph update
5. Test multi-agent coordination

---

## Knowledge References

### Handoff Documents (for AI Agents)
- `/docs/handoff/HANDOFF_VPS_INFRASTRUCTURE.md` - VPS deployment (Thread 1)
- `/docs/handoff/HANDOFF_GCP_INTEGRATION.md` - Graphiti + Neo4j (Thread 2)
- `/docs/handoff/HANDOFF_PLATFORM_FEATURES.md` - Agents + parsers (Thread 3)

### Specifications
- `/docs/CHATGPT_SPEC_REVIEW.md` - ChatGPT's 5 milestones (M0-M5)
- `/docs/deployment/COOLIFY_DEPLOYMENT_GUIDE.md` - Coolify setup
- `/docs/deployment/CROSS_VPS_SETUP.md` - VPS networking

### Infrastructure Files
- `/deploy/docker/docker-compose.vps1-complete.yml` - salem-nexus services
- `/deploy/docker/docker-compose.vps2-salem-forge.yml` - salem-forge services
- `/deploy/docker/postgres-init.sql` - PostgreSQL extensions (59 total)
- `/deploy/cloudflare/wrangler.toml` - Cloudflare Workers config

### Code Structure
```
server/
  _core/
    chroma-scratch.ts      # Scratch space (Manus platform)
    llm.ts                 # LLM integration
    voiceTranscription.ts  # Whisper API
    imageGeneration.ts     # Image generation
    map.ts                 # Google Maps proxy
    notification.ts        # Owner notifications
  db.ts                    # Database helpers
  routers.ts               # tRPC procedures
  mcp/
    loaders/               # MCP tool loaders
    plugins/               # MCP plugins
client/
  src/
    pages/                 # React pages
    components/            # Reusable UI
    lib/trpc.ts            # tRPC client
drizzle/
  schema.ts                # Database schema
deploy/
  docker/                  # Docker Compose files
  cloudflare/              # Cloudflare Workers
```

---

## Critical Notes

### PostgreSQL Extensions
- **Requires Supabase image** for pgmq, pg_net, pgsodium
- Standard `postgres:16-alpine` won't have all extensions
- Use `supabase/postgres:15` or build custom image

### Chroma Deployments
1. **Working Memory** - salem-forge VPS (72hr TTL)
2. **Scratch Space** - Manus platform (1hr TTL)

**DO NOT confuse these.** Scratch space runs on Manus, not VPS.

### Evidence Chain
Every evidence operation MUST log:
- Input hash (SHA-256)
- Output hash
- Tool used
- Provider used
- Timestamp
- traceId (UUIDv7)

This is critical for court admissibility.

### Agent Coordination
- Use Redis Streams for task distribution
- Use Chroma Scratch Space for agent state
- Log every agent step to evidence chain

---

## Next Steps

1. **Deploy VPS infrastructure** (Thread 1)
2. **Deploy Graphiti to Cloud Run** (Thread 2)
3. **Implement agent coordination** (Thread 3 - blocked on thinking types spec)
4. **Build evidence parsers** (Facebook, Instagram, SMS, email)
5. **Create timeline UI** (visualize knowledge graph)

---

**Questions?** See `/docs/handoff/` for detailed implementation guides.
