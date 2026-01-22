# Deploying VPS3 (salem-platform)

**Role**: Application Layer (MCP Tool Platform, Node.js)
**IP**: `116.203.40.1` (Public) / `10.10.0.4` (Private)

## Prerequisites

1.  **SSH Access**: Ensure you can SSH into `root@116.203.40.1` (or `salem-platform` if config updated).
2.  **Files**: Ensure you have `docker-compose.vps3-platform.yml` and `.env.vps3.template`.

## Deployment Steps

### 1. Initial Server Setup
Run the setup script to install Docker, configure firewall, and check Coolify connection.

```bash
# On your local machine (WSL/PowerShell):
cd path/to/salem-trinity-deployment/phase3-vps3-platform
./setup-vps3.sh
```

### 2. Prepare Environment
SSH into the server and configure the environment:

```bash
ssh salem-platform

# Create app directory
mkdir -p /opt/salem-platform
cd /opt/salem-platform

# Copy files (Run these SCPS from your local machine to the VPS)
# scp docker-compose.vps3-platform.yml salem-platform:/opt/salem-platform/docker-compose.yml
# scp .env.vps3.template salem-platform:/opt/salem-platform/.env
```

### 3. Configure .env
Edit the `.env` file on the server:

```bash
nano .env
```
*   **Database**: Ensure `DATABASE_URL` uses `10.10.0.2` (VPS1).
*   **Redis/LLM**: Ensure URLs use `10.10.0.3` (VPS2).
*   **Secrets**: Fill in `ENCRYPTION_KEY` and `JWT_SECRET`.

### 4. Deploy Application
Since this is managed by Coolify, you have two options:

**Option A: Coolify UI (Recommended)**
1.  Go to `https://nexus.mitechconsult.com`.
2.  Create a new resource on **salem-platform**.
3.  Select **Docker Compose**.
4.  Paste the contents of `docker-compose.vps3-platform.yml`.
5.  Add the environment variables in the UI.
6.  Click **Deploy**.

**Option B: Manual Docker Compose (For testing)**
```bash
docker compose up -d
```
*Note: If you use manual Docker Compose, Coolify won't automatically track it unless you import it.*

## Verification

1.  **Check Containers**:
    ```bash
    docker ps
    ```
    Should see `mcp-platform`.

2.  **Check Logs**:
    ```bash
    docker logs -f mcp-platform
    ```
    Look for "Server listening on port 3000" and successful database connections.

3.  **Public Access**:
    Visit `https://mcp.mitechconsult.com` (ensure DNS A record points to `116.203.40.1`).
