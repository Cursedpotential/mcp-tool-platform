# VPS2 (salem-forge) Deployment Guide

**Target VPS**: salem-forge (116.203.198.77 / 10.10.0.3 private)  
**Services**: 8 compute layer services  
**Duration**: 30-45 minutes  
**Prerequisites**: Phase 1 complete (VPS1 Postgres fixed)  

---

## Overview

This guide walks through deploying all compute services to VPS2 using Coolify's UI. VPS2 handles:
- LLM gateway (LiteLLM)
- Vector storage with 72hr TTL (ChromaDB)
- Redis-compatible cache (Dragonfly)
- Local embeddings (Ollama)
- Browser automation (Browserless, Playwright)
- Virtual desktops (Kasm)
- Internal MCP orchestration (MetaMCP Internal)

**CRITICAL**: Uses Hetzner private network (10.10.0.x) for cross-VPS database connections.

---

## Prerequisites Checklist

### Before Starting

- [ ] **Phase 1 Complete**: VPS1 Postgres has all 34 extensions installed
- [ ] **VPS1 Postgres Accessible**: Can connect from VPS2 via private network (10.10.0.2:5432)
- [ ] **VPS2 Registered in Coolify**: Shows as healthy remote worker
- [ ] **SSH Access to VPS2**: `ssh salem-forge` works without password
- [ ] **DNS Records Created**: All 6 VPS2 subdomains point to 116.203.198.77
- [ ] **Environment Variables Ready**: Generated all required API keys

### Verify VPS2 Network Configuration

```bash
# Check private network IP
ssh salem-forge "ip addr show | grep 'inet 10.10'"
# Expected: inet 10.10.0.3/32 on enp7s0 interface

# Test connection to VPS1 Postgres via private network
ssh salem-forge "nc -zv 10.10.0.2 5432"
# Expected: Connection to 10.10.0.2 5432 port [tcp/postgresql] succeeded!
```

### Generate Required API Keys

Run these commands on your workstation:

```bash
# LiteLLM Master Key (64 chars)
echo "LITELLM_MASTER_KEY=$(openssl rand -hex 32)"

# ChromaDB API Key (64 chars)
echo "CHROMA_API_KEY=$(openssl rand -hex 32)"

# Browserless Token (32 chars)
echo "BROWSERLESS_TOKEN=$(openssl rand -hex 16)"

# Optional: Dragonfly Password (32 chars)
echo "DRAGONFLY_PASSWORD=$(openssl rand -hex 16)"
```

**Save these keys** - you'll need them in the .env file!

---

## Step 1: Prepare Configuration Files

### 1.1 Create .env File

On your workstation:

```bash
cd salem-trinity-deployment/phase2-vps2-deploy
cp .env.vps2.template .env
nano .env
```

Fill in the required values:

```bash
# Domain
DOMAIN=mitechconsult.com
TZ=America/New_York

# Database (VPS1 via private network - CRITICAL!)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your_vps1_postgres_password>
POSTGRES_DB=salem

# LiteLLM
LITELLM_MASTER_KEY=<generated_64_char_key>
LITELLM_CONFIG_PATH=./litellm-config.yaml

# ChromaDB
CHROMA_API_KEY=<generated_64_char_key>

# Dragonfly (optional - leave empty for no password)
DRAGONFLY_PASSWORD=

# Browserless
BROWSERLESS_TOKEN=<generated_32_char_token>

# Docker Hub (optional)
DOCKER_HUB_USERNAME=
DOCKER_HUB_PASSWORD=
```

**IMPORTANT**: Verify `POSTGRES_PASSWORD` matches VPS1's actual password.

### 1.2 Create LiteLLM Configuration File

Create `litellm-config.yaml` in the same directory:

```yaml
model_list:
  # OpenAI Models
  - model_name: gpt-4
    litellm_params:
      model: openai/gpt-4
      api_key: os.environ/OPENAI_API_KEY
      
  - model_name: gpt-3.5-turbo
    litellm_params:
      model: openai/gpt-3.5-turbo
      api_key: os.environ/OPENAI_API_KEY

  # Anthropic Models
  - model_name: claude-3-opus
    litellm_params:
      model: anthropic/claude-3-opus-20240229
      api_key: os.environ/ANTHROPIC_API_KEY
      
  - model_name: claude-3-sonnet
    litellm_params:
      model: anthropic/claude-3-sonnet-20240229
      api_key: os.environ/ANTHROPIC_API_KEY

  # Ollama Models (local on VPS2)
  - model_name: llama3
    litellm_params:
      model: ollama/llama3
      api_base: http://ollama:11434

  # Embeddings
  - model_name: text-embedding-3-small
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  # Caching
  cache: true
  cache_params:
    type: redis
    host: dragonfly
    port: 6379
    
  # Logging
  success_callback: ["langfuse"]
  failure_callback: ["langfuse"]
  
  # Rate Limiting
  num_retries: 3
  request_timeout: 600
  
  # Cost Tracking
  track_cost_per_model: true
```

**Note**: You'll need to add `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` to the .env file if using these providers.

---

## Step 2: Deploy via Coolify UI

### 2.1 Access Coolify Master

1. Navigate to: `https://nexus.mitechconsult.com`
2. Log in with your Coolify credentials

**Note**: All 3 VPSs (salem-nexus, salem-forge, salem-platform) are linked to this Coolify master. You deploy to any VPS from this single UI.

### 2.2 Create New Resource

1. Click **+ New** (top right)
2. Select **Docker Compose**
3. Choose **Raw Compose**

### 2.3 Configure Deployment

**Server Selection**:
- Select: **salem-forge** (116.203.198.77)
- Verify all 3 servers show **Healthy** status in server list

**Project Name**:
- Enter: `salem-compute-layer`

**Compose File**:
- Paste contents of `docker-compose.vps2-forge.yml`

**Environment Variables**:
1. Click **Add Environment Variable** for each entry in your `.env` file:

| Name | Value | Source |
|------|-------|--------|
| DOMAIN | mitechconsult.com | .env |
| TZ | America/New_York | .env |
| POSTGRES_USER | postgres | .env |
| POSTGRES_PASSWORD | <your_password> | .env (SENSITIVE) |
| POSTGRES_DB | salem | .env |
| LITELLM_MASTER_KEY | <64_char_key> | .env (SENSITIVE) |
| LITELLM_CONFIG_PATH | ./litellm-config.yaml | .env |
| CHROMA_API_KEY | <64_char_key> | .env (SENSITIVE) |
| DRAGONFLY_PASSWORD | (leave empty or set) | .env |
| BROWSERLESS_TOKEN | <32_char_token> | .env (SENSITIVE) |
| DOCKER_HUB_USERNAME | (optional) | .env |
| DOCKER_HUB_PASSWORD | (optional) | .env |
| OPENAI_API_KEY | sk-... | External (SENSITIVE) |
| ANTHROPIC_API_KEY | sk-ant-... | External (SENSITIVE) |

**IMPORTANT**: Mark sensitive variables as **Secret** (click lock icon).

**File Uploads**:
1. Click **Upload File**
2. Upload `litellm-config.yaml`
3. Target path: `/config/litellm-config.yaml`

### 2.4 Deploy

1. Click **Save**
2. Click **Deploy**
3. Monitor deployment logs in real-time

**Expected Timeline**:
- Pulling images: 5-10 minutes (8 containers)
- Starting services: 2-5 minutes
- Health checks: 1-2 minutes
- SSL certificate issuance: 2-5 minutes per domain (6 domains)

**Total**: ~15-25 minutes for full deployment

---

## Step 3: Verify Deployment

### 3.1 Check Container Status

In Coolify UI:
- Navigate to **salem-compute-layer** project
- Verify all 8 services show **Running** status:
  - ✅ litellm
  - ✅ chroma
  - ✅ dragonfly
  - ✅ ollama
  - ✅ kasm
  - ✅ browserless
  - ✅ playwright
  - ✅ metamcp-internal

Or via SSH:

```bash
ssh salem-forge "docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

**Expected**: All 8 containers with "Up" status.

### 3.2 Verify Health Checks

```bash
# LiteLLM
curl https://llm.mitechconsult.com/health

# ChromaDB
curl https://chroma.mitechconsult.com/api/v1/heartbeat

# Ollama
curl https://ollama.mitechconsult.com/api/tags

# Browserless
curl https://browser.mitechconsult.com/pressure

# Playwright
curl https://playwright.mitechconsult.com
```

**Expected**: All return successful responses (not 502/503 errors).

### 3.3 Verify Private Network Database Connection

**CRITICAL TEST**: Verify LiteLLM can connect to VPS1 Postgres via private network:

```bash
ssh salem-forge "docker exec litellm nc -zv 10.10.0.2 5432"
```

**Expected**: `Connection to 10.10.0.2 5432 port [tcp/postgresql] succeeded!`

**If connection fails**:
1. Check VPS1 Postgres is running: `ssh salem-nexus "docker ps | grep postgres"`
2. Verify private network IP: `ssh salem-nexus "ip addr show | grep 10.10.0"`
3. Check Postgres allows connections from VPS2 (should be automatic on private network)

### 3.4 Test LiteLLM API

```bash
# Get model list
curl -X GET "https://llm.mitechconsult.com/models" \
  -H "Authorization: Bearer <LITELLM_MASTER_KEY>"

# Test completion (if you added OPENAI_API_KEY)
curl -X POST "https://llm.mitechconsult.com/chat/completions" \
  -H "Authorization: Bearer <LITELLM_MASTER_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Expected**: Model list returned, completion succeeds.

### 3.5 Test ChromaDB API

```bash
# List collections
curl -X GET "https://chroma.mitechconsult.com/api/v1/collections" \
  -H "X-Chroma-Token: <CHROMA_API_KEY>"

# Create test collection
curl -X POST "https://chroma.mitechconsult.com/api/v1/collections" \
  -H "X-Chroma-Token: <CHROMA_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name": "test_collection"}'
```

**Expected**: Empty collections list, then test collection created.

### 3.6 Test Ollama Models

```bash
# Pull a small model (nomic-embed-text for embeddings)
ssh salem-forge "docker exec ollama ollama pull nomic-embed-text"

# Verify model downloaded
curl https://ollama.mitechconsult.com/api/tags | jq '.models[] | .name'
```

**Expected**: `nomic-embed-text` appears in model list.

### 3.7 Verify SSL Certificates

```bash
for sub in llm chroma ollama desktop browser playwright; do
  echo "Testing SSL: $sub.mitechconsult.com"
  openssl s_client -connect $sub.mitechconsult.com:443 -servername $sub.mitechconsult.com < /dev/null 2>/dev/null | grep -i "Verify return code"
done
```

**Expected**: All show `Verify return code: 0 (ok)`.

---

## Step 4: Configure Ollama Models

### 4.1 Pull Recommended Models

```bash
# Small embedding model (134MB) - RECOMMENDED for forensic similarity search
ssh salem-forge "docker exec ollama ollama pull nomic-embed-text"

# Small general-purpose model (4.7GB) - Optional
ssh salem-forge "docker exec ollama ollama pull llama3:8b"

# Check disk usage
ssh salem-forge "docker exec ollama du -sh /root/.ollama/models"
```

**Note**: Ollama has 8GB memory limit. Don't pull large models (70B+) unless increasing memory allocation.

### 4.2 Test Embedding Generation

```bash
curl https://ollama.mitechconsult.com/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "prompt": "Evidence description for forensic case"
  }'
```

**Expected**: 768-dimensional embedding vector returned.

---

## Step 5: Configure ChromaDB Collections

### 5.1 Create Evidence Processing Collection

```bash
curl -X POST "https://chroma.mitechconsult.com/api/v1/collections" \
  -H "X-Chroma-Token: <CHROMA_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "evidence_processing",
    "metadata": {
      "description": "Working memory for active case evidence (72hr TTL)",
      "ttl_hours": 72
    }
  }'
```

### 5.2 Verify Collection Created

```bash
curl -X GET "https://chroma.mitechconsult.com/api/v1/collections/evidence_processing" \
  -H "X-Chroma-Token: <CHROMA_API_KEY>"
```

---

## Step 6: Verify Cross-VPS Integration

### 6.1 Test VPS2 → VPS1 Postgres (Private Network)

```bash
# From LiteLLM container
ssh salem-forge "docker exec litellm sh -c 'apk add postgresql-client && psql -h 10.10.0.2 -U postgres -d salem -c \"SELECT version()\"'"
```

**Expected**: Postgres version output (connection via 10.10.0.2 successful).

### 6.2 Test MetaMCP Internal → VPS1 Postgres

```bash
ssh salem-forge "docker exec metamcp-internal wget -qO- http://localhost:3001/health"
```

**Expected**: Health check response (MetaMCP can connect to Postgres for registry).

### 6.3 Verify Dragonfly Cache

```bash
# From LiteLLM container
ssh salem-forge "docker exec litellm sh -c 'apk add redis && redis-cli -h dragonfly PING'"
```

**Expected**: `PONG` (LiteLLM can use Dragonfly for caching).

---

## Step 7: Configure Kasm Workspaces (Optional)

### 7.1 Access Kasm Admin

1. Navigate to: `https://desktop.mitechconsult.com`
2. Default credentials:
   - Username: `admin@kasm.local`
   - Password: Check Kasm container logs for initial password:
     ```bash
     ssh salem-forge "docker logs kasm 2>&1 | grep 'admin password'"
     ```

### 7.2 Create Workspace Image

1. **Admin Panel** → **Workspaces**
2. **Add Workspace**
3. Select **Ubuntu Jammy Desktop** (or custom image)
4. Configure:
   - Name: `Forensic Investigation Desktop`
   - CPU: 2 cores
   - Memory: 4GB
   - Persistent Profile: ✅ Enabled
5. **Save**

### 7.3 Install Tools in Workspace

Once workspace launches:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install forensic tools
sudo apt install -y \
  exiftool \
  imagemagick \
  tesseract-ocr \
  ffmpeg \
  python3-pip \
  git

# Install Claude CLI (if needed)
curl -fsSL https://claude.ai/install.sh | sh

# Install VS Code (optional)
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main" > /etc/apt/sources.list.d/vscode.list'
sudo apt update
sudo apt install -y code
```

---

## Troubleshooting

### Issue: Container Not Starting

**Symptoms**: Service shows "Exited" status in Coolify

**Diagnosis**:
```bash
# Check logs
ssh salem-forge "docker logs <container-name>"
```

**Common Causes**:
1. **Missing environment variable**: Check .env file in Coolify
2. **Port conflict**: Another service using same port
3. **Volume permission issue**: Run `docker volume inspect <volume-name>`

**Fix**: Correct configuration in Coolify UI, redeploy.

---

### Issue: SSL Certificate Not Issued

**Symptoms**: `https://llm.mitechconsult.com` shows certificate error

**Diagnosis**:
```bash
# Check Traefik logs
ssh salem-forge "docker logs traefik 2>&1 | grep -i acme"
```

**Common Causes**:
1. **DNS not propagated**: Wait 30 more minutes
2. **Port 80/443 blocked**: Check firewall
3. **Rate limit hit**: Let's Encrypt allows 5 certs/week per domain

**Fix**: 
- Verify DNS: `dig +short llm.mitechconsult.com` (should return 116.203.198.77)
- Check firewall: `ssh salem-forge "sudo ufw status"` (should allow 80/443)
- Wait 1 hour and retry if rate limited

---

### Issue: Cannot Connect to VPS1 Postgres

**Symptoms**: LiteLLM logs show "connection refused" to 10.10.0.2:5432

**Diagnosis**:
```bash
# Test from VPS2
ssh salem-forge "nc -zv 10.10.0.2 5432"
```

**Common Causes**:
1. **VPS1 Postgres not running**: Check `ssh salem-nexus "docker ps | grep postgres"`
2. **Wrong IP used**: Verify using 10.10.0.2 (private) not 188.245.189.218 (public)
3. **Private network not configured**: Check `ssh salem-forge "ip addr show | grep 10.10.0"`

**Fix**:
- Restart VPS1 Postgres if down
- Update DATABASE_URL to use 10.10.0.2
- Contact Hetzner support if private network missing

---

### Issue: Dragonfly Cache Not Working

**Symptoms**: LiteLLM logs show Redis connection errors

**Diagnosis**:
```bash
# Test Dragonfly
ssh salem-forge "docker exec dragonfly redis-cli PING"
```

**Common Causes**:
1. **Wrong password**: Check DRAGONFLY_PASSWORD in .env
2. **Container networking issue**: Verify containers on same network

**Fix**: Update REDIS_PASSWORD in LiteLLM environment, restart litellm container.

---

## Post-Deployment Tasks

### 1. Monitor Resource Usage

```bash
# CPU/Memory usage
ssh salem-forge "docker stats --no-stream"

# Disk usage
ssh salem-forge "df -h"
ssh salem-forge "docker system df"
```

**Expected**:
- CPU: < 50% idle usage
- Memory: ~12GB / 16GB used
- Disk: < 50GB used

### 2. Set Up Monitoring (Optional)

**Prometheus + Grafana**:
- LiteLLM exposes metrics on port 9090
- Dragonfly has built-in stats: `redis-cli INFO`
- ChromaDB has metrics endpoint: `/api/v1/metrics`

### 3. Configure Backups

**ChromaDB Data** (important if storing permanent vectors):
```bash
# Backup Chroma volume
ssh salem-forge "docker run --rm -v chroma_data:/data -v /backup:/backup alpine tar czf /backup/chroma_data_$(date +%Y%m%d).tar.gz /data"
```

**LiteLLM Config**:
- Version control `litellm-config.yaml` in git
- Backup .env file to secure password manager

---

## Success Criteria

✅ **All 8 containers running** (docker ps shows "Up" status)  
✅ **All 6 public URLs accessible** via HTTPS with valid SSL  
✅ **Private network connectivity confirmed** (VPS2 → VPS1 Postgres via 10.10.0.2)  
✅ **LiteLLM health check passes** (can list models)  
✅ **ChromaDB API responds** (can create collections)  
✅ **Ollama serving embeddings** (nomic-embed-text model pulled)  
✅ **Dragonfly cache operational** (PING returns PONG)  
✅ **SSL certificates issued** (all 6 subdomains have valid certs)  

---

## Next Steps

1. **Proceed to Phase 3**: Setup VPS3 (salem-platform) and deploy MCP Platform
2. **Load test**: Send 100 concurrent requests to LiteLLM
3. **Monitor for 24 hours**: Check Coolify logs for errors
4. **Document any custom configurations**: Update this guide with learnings

---

**Phase 2: VPS2 Deployment Complete!**

Continue with: `phase3-vps3-platform/setup-vps3.sh` and Phase 3 deployment.
