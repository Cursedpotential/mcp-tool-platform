# Migration Guide: From Manus (Local) to Salem Trinity (Production)

This guide outlines the steps to migrate your local development environment ("Manus") to the "Salem Forensic Trinity" production infrastructure (VPS1, VPS2, VPS3).

## Prerequisites

1.  **Access**: SSH access to all three VPS instances (`salem-nexus`, `salem-forge`, `salem-platform`).
2.  **Coolify**: Admin access to the Coolify instance on VPS1 (`nexus.mitechconsult.com`).
3.  **Token**: The updated Coolify API token (`2|**************************************************`).
4.  **Database**: The `salem` database on VPS1 must be accessible from VPS3 (10.10.0.2).

## Migration Steps

### 1. Environment Configuration

1.  **VPS2 (salem-forge)**:
    *   SSH into `salem-forge`.
    *   Navigate to the deployment directory (e.g., `/opt/salem-deploy`).
    *   Copy `.env.vps2.template` to `.env`.
    *   Fill in `LITELLM_MASTER_KEY` (generate new), `CHROMA_API_KEY` (generate new), etc.
    *   **Action**: Deploy services via `docker-compose up -d` or Coolify.

2.  **VPS3 (salem-platform)**:
    *   SSH into `salem-platform`.
    *   Copy `.env.vps3.template` to `.env`.
    *   **CRITICAL**: Ensure `DATABASE_URL` points to `10.10.0.2` (VPS1 internal IP).
    *   **CRITICAL**: Ensure `REDIS_URL`, `LITELLM_URL`, `CHROMA_URL` point to `10.10.0.3` (VPS2 internal IP).
    *   Fill in secure keys (`ENCRYPTION_KEY`, `JWT_SECRET`).

### 2. Database Migration (Postgres)

Since the database is persistent on VPS1, you need to push your local schema and seed data.

#### From Local Workstation:
```bash
# 1. Update your local .env to point to the PRODUCTION database temporarily
# (Use an SSH tunnel for security if direct public access is closed)
ssh -L 5433:localhost:5432 root@188.245.189.218
# Local .env: DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5433/salem

# 2. Push Schema
pnpm db:push

# 3. (Optional) Seed Data
# If you have a seed script
pnpm tsx scripts/seed.ts
```

### 3. Vector Data Migration (ChromaDB)

If you have important vector data locally:
1.  **Export**: There isn't a native "dump" for Chroma yet.
2.  **Strategy**: Re-index your content on production.
    *   Once the platform is running, trigger a "Re-index" job for your knowledge base.
    *   The platform will send content to `http://10.10.0.3:8000` (VPS2).

### 4. Deployment Check

1.  **Deploy VPS3**:
    *   In Coolify (VPS1 UI), trigger a deployment for the `mcp-platform` service.
    *   Ensure it pulls the latest code/image.

2.  **Verify Connectivity**:
    *   **Postgres**: Logs should show successful connection to `10.10.0.2`.
    *   **Redis**: Logs should show successful connection to `10.10.0.3`.
    *   **LLM**: Try a test query in the MCP UI. It should route to `http://10.10.0.3:4000`.

## Verification

- [ ] **Access**: Go to `https://mcp.mitechconsult.com`. Login should work (Supabase/Auth).
- [ ] **Settings**: Go to Settings -> API Keys. Add a dummy key. It should save to Postgres (VPS1).
- [ ] **Chat**: Send a "Hello" message.
    -   Platform (VPS3) -> LiteLLM (VPS2) -> OpenAI/Provider.
    -   Response should come back.

## Troubleshooting

-   **Database Connection Failed**: Check VPS1 `pg_hba.conf` allows `10.10.0.4` (VPS3).
-   **Redis/LLM Failed**: Check VPS2 firewall (UFW) allows `10.10.0.4` on ports 6379, 4000, 8000.
-   **Coolify Issues**: Check the Coolify logs on VPS1.
