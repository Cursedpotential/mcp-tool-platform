# Handoff: VPS Infrastructure & Deployment

**Thread:** 1 of 3
**Priority:** P0 - Blocking
**Date:** January 9, 2026

---

## ⚠️ CRITICAL: DELEGATE ALL CODING

You have access to Groq, Gemini, OpenRouter, Anthropic, and Cohere APIs through Manus settings. **DO NOT write boilerplate code yourself.** Delegate to external LLMs for:

- Docker configuration adjustments
- Shell scripts
- Environment variable setup
- Any repetitive coding tasks

Use your tokens for planning, debugging, and user communication only. The user has explicitly required this.

---

## Mission

Deploy the complete VPS infrastructure to Coolify and verify all services are operational. This is blocking work for the other threads because the platform depends on these backend services.

---

## Current State

The docker-compose files and all supporting configurations are complete and located in `/deploy/docker/`:

| File | Purpose | Services |
|------|---------|----------|
| `docker-compose.vps1-complete.yml` | salem-nexus (VPS1) | PostgreSQL, MariaDB, FerretDB, Directus, PhotoPrism, n8n, LibreChat, Open WebUI |
| `docker-compose.vps2-salem-forge.yml` | salem-forge (VPS2) | LiteLLM, MetaMCP, Chroma, Kasm Workspace, Browserless, Playwright |
| `Dockerfile.kasm` | Custom Kasm image | VS Code, Claude CLI, Gemini CLI, Python tools, FastAPI server |
| `litellm-config.yaml` | LLM routing | Model aliases, fallbacks, caching |

Environment files are in the project root (gitignored): `.env.vps1-complete`, `.env.vps2-salem-forge`

---

## VPS Details

| Server | IP | Specs | Coolify URL |
|--------|-----|-------|-------------|
| salem-nexus | 116.203.199.238 | 8 vCPU, 16GB RAM, 60GB storage | https://nexus.mitechconsult.com |
| salem-forge | 116.203.198.77 | 8 vCPU, 16GB RAM | https://forge.mitechconsult.com |

Coolify API Token: `1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b`

---

## Tasks

### 1. Deploy salem-nexus Services

Deploy the 8 services to VPS1 via Coolify. The docker-compose file is ready, but you need to:

1. Upload `docker-compose.vps1-complete.yml` to Coolify
2. Configure environment variables from `.env.vps1-complete`
3. Ensure the 60GB storage volume is mounted at `/mnt/salem-vault`
4. Start the stack and verify each service

**Service verification checklist:**

| Service | Port | Health Check |
|---------|------|--------------|
| PostgreSQL | 5432 | `pg_isready` |
| MariaDB | 3306 | `mysqladmin ping` |
| FerretDB | 27017 | Connect from LibreChat |
| Directus | 8055 | Web UI accessible |
| PhotoPrism | 2342 | Web UI accessible |
| n8n | 5678 | Web UI accessible |
| LibreChat | 3080 | Web UI accessible |
| Open WebUI | 8080 | Web UI accessible |

### 2. Deploy salem-forge Services

Deploy the 6 services to VPS2:

1. Build the custom Kasm image from `Dockerfile.kasm`
2. Upload `docker-compose.vps2-salem-forge.yml` to Coolify
3. Configure environment variables from `.env.vps2-salem-forge`
4. Start the stack

**Service verification checklist:**

| Service | Port | Health Check |
|---------|------|--------------|
| LiteLLM | 4000 | `/health` endpoint |
| MetaMCP | 3010 | API responds |
| Chroma | 8000 | `/api/v1/heartbeat` |
| Kasm | 6901 | VNC accessible |
| Browserless | 3004 | `/pressure` endpoint |
| Playwright | 3005 | Health check |

### 3. Configure Cross-VPS Communication

The services need to communicate across VPS boundaries:

- salem-forge services need to reach PostgreSQL on salem-nexus (port 5432)
- The main platform (Manus hosting) needs to reach all services

Since Tailscale was skipped, use public IPs with firewall rules:

```bash
# On salem-nexus, allow salem-forge IP
ufw allow from 116.203.198.77 to any port 5432

# On salem-forge, allow salem-nexus IP
ufw allow from 116.203.199.238
```

### 4. Deploy Cloudflare Workers

The 6 workers are in `/deploy/cloudflare/`. Deploy using wrangler:

```bash
cd deploy/cloudflare
npx wrangler deploy r2-storage.js --name salem-r2-storage
npx wrangler deploy evidence-hasher.js --name salem-evidence-hasher
npx wrangler deploy auth-proxy.js --name salem-auth-proxy
npx wrangler deploy cache-api.js --name salem-cache-api
npx wrangler deploy rate-limiter.js --name salem-rate-limiter
npx wrangler deploy webhook-receiver.js --name salem-webhook-receiver
```

Configure the R2 bucket binding and KV namespaces as specified in `wrangler.toml`.

### 5. Database Initialization

After PostgreSQL is running:

1. Create the required databases:
   ```sql
   CREATE DATABASE salem_forensics;
   CREATE DATABASE mcp_tool_platform;
   CREATE DATABASE directus;
   CREATE DATABASE n8n;
   ```

2. Enable extensions:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

3. Run schema migrations from the platform

---

## Credentials Reference

All credentials are in the .env files. Key ones:

| Service | Variable | Notes |
|---------|----------|-------|
| PostgreSQL | `POSTGRES_PASSWORD` | Main database |
| Directus | `DIRECTUS_ADMIN_PASSWORD` | Admin UI |
| PhotoPrism | `PHOTOPRISM_ADMIN_PASSWORD` | Admin UI |
| n8n | `N8N_PASSWORD` | Admin UI |
| Chroma | `CHROMA_AUTH_TOKEN` | API auth |
| R2 | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Storage |

---

## Success Criteria

1. All 14 services are running and healthy
2. Cross-VPS communication works (forge can reach nexus PostgreSQL)
3. All web UIs are accessible via HTTPS
4. Cloudflare Workers are deployed and responding
5. R2 storage operations work

---

## Blockers & Notes

- **FerretDB** had schema errors in previous attempts - verify it creates the `documentdb_api` schema in PostgreSQL
- **Directus** needs the `/directus/uploads` directory to be writable
- **Kasm** requires the custom Dockerfile to be built first
- **LiteLLM** needs the `litellm-config.yaml` mounted

---

## Files to Reference

- `/deploy/docker/docker-compose.vps1-complete.yml`
- `/deploy/docker/docker-compose.vps2-salem-forge.yml`
- `/deploy/docker/Dockerfile.kasm`
- `/deploy/docker/litellm-config.yaml`
- `/deploy/cloudflare/wrangler.toml`
- `/docs/deployment/COOLIFY_DEPLOYMENT_GUIDE.md`
- `/docs/deployment/CROSS_VPS_SETUP.md`
