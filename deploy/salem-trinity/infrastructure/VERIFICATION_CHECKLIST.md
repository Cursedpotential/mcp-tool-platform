# Verification Checklist - Salem Forensic Trinity

**Purpose**: Step-by-step verification procedures for each deployment phase  
**Critical**: Do NOT proceed to next phase until current phase verification passes  

---

## Pre-Deployment Verification

### Network Architecture (CRITICAL UPDATE)

**Hetzner Private Network Already Configured**:
- VPS1 (salem-nexus): `10.10.0.2` on interface `enp7s0`
- VPS2 (salem-forge): `10.10.0.3` on interface `enp7s0`
- VPS3 (salem-platform): **TBD** (likely `10.10.0.4`)

**IMPORTANT**: All cross-VPS database connections MUST use private network IPs (10.10.0.x):
- ✅ Free bandwidth (no Hetzner egress charges)
- ✅ Better security (traffic never leaves Hetzner network)
- ✅ Lower latency (~0.5ms vs 2-5ms)
- ✅ No firewall rules needed (private network isolated)

**Updated Connection Strings**:
```bash
# VPS2/VPS3 → VPS1 Postgres (BEFORE - WRONG):
POSTGRES_HOST=188.245.189.218

# VPS2/VPS3 → VPS1 Postgres (AFTER - CORRECT):
POSTGRES_HOST=10.10.0.2

# Similar for all cross-VPS connections
```

---

### SQLite Dev Database (`data/salem.db`)

**CRITICAL**: Found existing SQLite database with good schema/config:
- Location: `01_MCP_Tool_Platform_Repo/data/salem.db`
- Size: 48KB
- SQLite version: 3.49.1
- **Action**: DO NOT DELETE - analyze schema and migrate to MySQL on VPS3

**Verification**:
```bash
cd C:\Users\matts\AI_Workspace\TheBigOne\01_MCP_Tool_Platform_Repo
ls -lh data/salem.db
file data/salem.db
```

**Expected**: File exists, shows as SQLite 3.x database

---

### SSH Access Verification

**VPS1 (salem-nexus)**:
```bash
ssh salem-nexus "hostname && uptime"
```
**Expected**: Returns hostname and uptime, no password prompt

**VPS2 (salem-forge)**:
```bash
ssh salem-forge "hostname && uptime"
```
**Expected**: Returns hostname and uptime, no password prompt

**VPS3 (salem-platform)** - First Time:
```bash
# Accept host key first
ssh root@116.203.40.1 "echo 'VPS3 Connected'"
```
**Expected**: Prompt to accept host key, type `yes`, then connects

**Add VPS3 to SSH config**:
```bash
cat >> ~/.ssh/config << 'EOF'

Host salem-platform
    HostName 116.203.40.1
    User root
    IdentityFile ~/.ssh/id_ed25519_hetzner
    StrictHostKeyChecking no
EOF
```

Then test:
```bash
ssh salem-platform "hostname && uptime"
```

---

### Coolify API Access

```bash
# From your workstation
curl -H "Authorization: Bearer ydcRFzANLzkZbVaIO4XKaxBTgDZX5NfE1gHg2TlT8ySLfRR0fCyYNfn9osEz74P9" https://nexus.mitechconsult.com/api/v1/servers
```

**Expected**: JSON response with all 3 servers (salem-nexus, salem-forge, salem-platform)

**Note**: All 3 VPSs are linked to Coolify master on VPS1 (nexus). Deploy to any VPS from nexus.mitechconsult.com

---

### VPS1 Current Service Status

```bash
ssh salem-nexus "docker ps --format 'table {{.Names}}\t{{.Status}}' | head -15"
```

**Expected**: Should show ~8 containers including:
- coolify
- postgres (or similar name)
- directus
- librechat
- open-webui
- n8n
- photoprism

---

### Private Network Connectivity Test

**VPS1 → VPS2**:
```bash
ssh salem-nexus "ping -c 3 10.10.0.3"
```
**Expected**: 3 packets transmitted, 3 received, 0% packet loss, ~0.5ms latency

**VPS2 → VPS1**:
```bash
ssh salem-forge "ping -c 3 10.10.0.2"
```
**Expected**: 3 packets transmitted, 3 received, 0% packet loss

**VPS3 → VPS1** (after VPS3 setup):
```bash
ssh salem-platform "ping -c 3 10.10.0.2"
```

**VPS3 → VPS2** (after VPS3 setup):
```bash
ssh salem-platform "ping -c 3 10.10.0.3"
```

---

## Phase 1 Verification: VPS1 Postgres Fix

### 1.1 Check Current Postgres Extensions

```bash
ssh salem-nexus "docker ps | grep postgres"
# Note the container name (e.g., postgres-123)

ssh salem-nexus "docker exec <postgres-container> psql -U postgres -c '\dx'"
```

**Expected BEFORE fix**: Only 2 extensions (plpgsql, uuid-ossp)

### 1.2 Verify Extension Packages Installed

```bash
ssh salem-nexus "docker exec <postgres-container> dpkg -l | grep postgresql-16"
```

**Expected**: Should show multiple postgresql-16-* packages after installation

### 1.3 Verify All 34 Extensions Loaded

```bash
ssh salem-nexus "docker exec <postgres-container> psql -U postgres -c '\dx' | wc -l"
```

**Expected**: 36 lines (header + 34 extensions + footer)

### 1.4 Verify Specific Critical Extensions

```bash
ssh salem-nexus "docker exec <postgres-container> psql -U postgres -c \"
SELECT extname FROM pg_extension 
WHERE extname IN ('vector', 'pgcrypto', 'postgis', 'pg_cron', 'pgmq', 'pg_net')
ORDER BY extname;
\""
```

**Expected**: All 6 extensions listed

### 1.5 Verify FerretDB Schema

```bash
ssh salem-nexus "docker exec <postgres-container> psql -U postgres -c '\dn' | grep documentdb_api"
```

**Expected**: `documentdb_api` schema exists

### 1.6 Verify LibreChat No Longer Crashing

```bash
ssh salem-nexus "docker logs <librechat-container> --tail 50"
```

**Expected**: No FerretDB connection errors, app running normally

### 1.7 Test LibreChat UI Access

```bash
curl -I https://chat.mitechconsult.com
```

**Expected**: HTTP 200 or 302 (redirect to login), NOT 502/503

---

## Phase 2 Verification: VPS2 Services Deployed

### 2.1 Verify VPS2 in Coolify

**Coolify UI**: https://nexus.mitechconsult.com
- Navigate to **Servers**
- Verify `salem-forge` (116.203.198.77) shows **Healthy**

### 2.2 Verify All 8 Services Running

```bash
ssh salem-forge "docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

**Expected**: 8+ containers (8 services + Traefik):
- litellm
- chroma
- dragonfly
- ollama
- kasm
- browserless
- playwright
- metamcp-internal
- traefik

### 2.3 Test LiteLLM Health

```bash
curl https://llm.mitechconsult.com/health
```

**Expected**: `{"status": "ok"}` or similar

### 2.4 Test ChromaDB API

```bash
curl https://chroma.mitechconsult.com/api/v1/heartbeat
```

**Expected**: Heartbeat response (timestamp)

### 2.5 Test Ollama Endpoint

```bash
curl https://ollama.mitechconsult.com/api/tags
```

**Expected**: JSON response with model list (may be empty initially)

### 2.6 Test Dragonfly (Redis Protocol)

```bash
ssh salem-forge "redis-cli -h localhost -p 6379 PING"
```

**Expected**: `PONG`

### 2.7 Verify Kasm Workspaces

```bash
curl -I https://desktop.mitechconsult.com
```

**Expected**: HTTP 200 or redirect to Kasm login

### 2.8 Test Cross-VPS Database Connectivity

**VPS2 → VPS1 Postgres** (via private network):
```bash
ssh salem-forge "nc -zv 10.10.0.2 5432"
```

**Expected**: Connection succeeded (port 5432 open)

**Test actual Postgres connection**:
```bash
ssh salem-forge "docker run --rm postgres:16 psql -h 10.10.0.2 -U postgres -c 'SELECT version()'"
```

**Expected**: Postgres version output (connection successful)

### 2.9 Verify Traefik SSL Certificates

**Check Traefik logs**:
```bash
ssh salem-forge "docker logs traefik 2>&1 | grep -i 'certificate'"
```

**Expected**: Successful ACME certificate issuance messages for all 6 subdomains

**Test SSL**:
```bash
for sub in llm chroma ollama desktop browser playwright; do
  echo "Testing $sub.mitechconsult.com"
  curl -I https://$sub.mitechconsult.com 2>&1 | grep -i "HTTP\|SSL"
done
```

**Expected**: All return HTTPS 200/301/302 (not certificate errors)

---

## Phase 3 Verification: VPS3 Platform Deployed

### 3.1 Verify VPS3 Private Network IP

```bash
ssh salem-platform "ip addr show | grep 'inet 10.10'"
```

**Expected**: Shows `inet 10.10.0.4/32` or similar on `enp7s0` interface

### 3.2 Verify VPS3 in Coolify

**Coolify UI**: https://nexus.mitechconsult.com
- Navigate to **Servers**
- Verify `salem-platform` (116.203.40.1) shows **Healthy**

### 3.3 Verify Docker Installed on VPS3

```bash
ssh salem-platform "docker --version && docker ps"
```

**Expected**: Docker version 24+ and container list (may be empty before deployment)

### 3.4 Verify All 3 Services Running

```bash
ssh salem-platform "docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

**Expected**: 3+ containers:
- mcp-platform
- metamcp-external
- mysql
- traefik

### 3.5 Test MySQL Container

```bash
ssh salem-platform "docker exec <mysql-container> mysql -u root -p<password> -e 'SELECT VERSION()'"
```

**Expected**: MySQL version output

### 3.6 Verify MySQL Data Migrated

```bash
ssh salem-platform "docker exec <mysql-container> mysql -u root -p<password> -e 'SHOW DATABASES'"
```

**Expected**: Application database(s) from Manus migration present

**Check row counts**:
```bash
ssh salem-platform "docker exec <mysql-container> mysql -u root -p<password> <dbname> -e 'SHOW TABLES; SELECT COUNT(*) FROM <critical_table>'"
```

**Expected**: Row counts match pre-migration counts from Manus

### 3.7 Test MCP Platform UI

```bash
curl -I https://app.mitechconsult.com
```

**Expected**: HTTP 200 or redirect to login

**Full page load test**:
```bash
curl https://app.mitechconsult.com 2>&1 | head -20
```

**Expected**: HTML content, no database connection errors

### 3.8 Test MetaMCP External Gateway

```bash
curl https://mcp.mitechconsult.com/health
```

**Expected**: Health check response (JSON with status)

### 3.9 Verify MCP Platform Can Reach All Storage Layers

**Test from MCP Platform container**:

**→ VPS1 Postgres** (via private network):
```bash
ssh salem-platform "docker exec <mcp-container> nc -zv 10.10.0.2 5432"
```

**→ VPS2 Chroma** (via private network):
```bash
ssh salem-platform "docker exec <mcp-container> nc -zv 10.10.0.3 8000"
```

**→ VPS1 Directus**:
```bash
ssh salem-platform "docker exec <mcp-container> curl -I http://10.10.0.2:8055"
```

**→ Neo4j Aura** (cloud):
```bash
ssh salem-platform "docker exec <mcp-container> nc -zv <neo4j-aura-host> 7687"
```

**Expected**: All connections succeed

### 3.10 Test MCP Platform End-to-End

**Create test case via UI**:
1. Login to https://app.mitechconsult.com
2. Create new case with test data
3. Upload small test file
4. Verify file appears in Directus
5. Verify case metadata in MySQL

---

## Phase 4 Verification: System Router Integration

### 4.1 Verify System Router Code Deployed

```bash
ssh salem-platform "docker exec <mcp-container> ls -lh /app/server/mcp/storage/systemRouter.ts"
```

**Expected**: File exists, ~500+ lines (check size)

### 4.2 Verify All Storage Clients Available

```bash
ssh salem-platform "docker exec <mcp-container> node -e \"
const { GraphitiClient } = require('./server/mcp/storage/graphiti-client');
const { ChromaEvidenceClient } = require('./server/mcp/storage/chroma-client');
const { DirectusClient } = require('./server/mcp/storage/directus-client');
console.log('All clients loaded');
\""
```

**Expected**: "All clients loaded" (no import errors)

### 4.3 Test System Router Multi-System Write

**From MCP Platform container**:
```bash
ssh salem-platform "docker exec <mcp-container> node -e \"
const { TrinityRouter } = require('./server/mcp/storage/systemRouter');
const router = new TrinityRouter();
await router.initialize();
console.log('Router initialized');
\""
```

**Expected**: Router initializes without errors, all 4 clients connect

### 4.4 Test Forensic Integrity (SHA-256 Hashing)

Upload test file via MCP Platform UI and verify:

**Check Directus**:
```bash
curl -H "Authorization: Bearer <directus-token>" \
  https://files.mitechconsult.com/items/files?filter[filename][_eq]=test.pdf
```

**Expected**: Response includes `sha256_hash` field

**Check Postgres audit log**:
```bash
ssh salem-nexus "docker exec <postgres-container> psql -U postgres -c \"
SELECT * FROM audit_log WHERE action = 'file_upload' ORDER BY created_at DESC LIMIT 5;
\""
```

**Expected**: Recent file upload logged with SHA-256 hash

### 4.5 Test Temporal Awareness (Graphiti)

**Query entities with temporal filter**:
```bash
# Via MCP Platform API or GraphitiClient directly
# Verify valid_from timestamps present
```

**Expected**: All entities have `valid_from` timestamp, temporal queries work

### 4.6 Test Query Routing by Capability

**Semantic query → pgvector**:
```bash
# Execute semantic search via System Router
# Verify it routes to Postgres pgvector
```

**Temporal query → Graphiti**:
```bash
# Execute "show changes between Jan 1-15"
# Verify it routes to Neo4j via Graphiti
```

**Spatial query → PostGIS**:
```bash
# Execute "find evidence within 5km of location"
# Verify it routes to Postgres PostGIS
```

---

## Phase 5 Verification: Infrastructure Hardening

### 5.1 Verify UFW Firewall Rules (Public IPs Only)

**NOTE**: Private network (10.10.0.x) does NOT need firewall rules - already isolated

**VPS1 Firewall**:
```bash
ssh salem-nexus "sudo ufw status numbered"
```

**Expected**:
- Allow 22/tcp (SSH) from anywhere
- Allow 80/tcp (HTTP) from anywhere
- Allow 443/tcp (HTTPS) from anywhere
- Allow 8000/tcp (Coolify API) from anywhere
- **NO** rules for private network (10.10.0.x) - not needed

**VPS2 Firewall**:
```bash
ssh salem-forge "sudo ufw status numbered"
```

**Expected**:
- Allow 22/tcp (SSH) from anywhere
- Allow 80/tcp (HTTP) from anywhere
- Allow 443/tcp (HTTPS) from anywhere
- **NO** rules for private network - not needed

**VPS3 Firewall**:
```bash
ssh salem-platform "sudo ufw status numbered"
```

**Expected**: Same as VPS2

### 5.2 Verify DNS Propagation

**Check all 14 A records**:
```bash
for sub in nexus files photos n8n chat ui llm chroma ollama desktop browser playwright app mcp; do
  echo "Checking $sub.mitechconsult.com"
  dig +short $sub.mitechconsult.com
done
```

**Expected**:
- First 6 subdomains → `188.245.189.218` (VPS1)
- Next 6 subdomains → `116.203.198.77` (VPS2)
- Last 2 subdomains → `116.203.40.1` (VPS3)

### 5.3 Verify SSL Certificates for All Subdomains

```bash
for sub in nexus files photos n8n chat ui llm chroma ollama desktop browser playwright app mcp; do
  echo "Testing SSL: $sub.mitechconsult.com"
  openssl s_client -connect $sub.mitechconsult.com:443 -servername $sub.mitechconsult.com < /dev/null 2>/dev/null | grep -i "Verify return code"
done
```

**Expected**: All show `Verify return code: 0 (ok)` (valid Let's Encrypt certs)

### 5.4 Test Cross-VPS Private Network Communication

**VPS2 Chroma → VPS1 Postgres** (via 10.10.0.2):
```bash
ssh salem-forge "docker run --rm postgres:16 psql -h 10.10.0.2 -U postgres -c 'SELECT 1'"
```

**VPS3 MCP Platform → VPS1 Postgres** (via 10.10.0.2):
```bash
ssh salem-platform "docker exec <mcp-container> nc -zv 10.10.0.2 5432"
```

**VPS3 MCP Platform → VPS2 Chroma** (via 10.10.0.3):
```bash
ssh salem-platform "docker exec <mcp-container> curl http://10.10.0.3:8000/api/v1/heartbeat"
```

**Expected**: All connections succeed, NO public IP usage logged

### 5.5 Verify Bandwidth Usage (Private Network Savings)

**Check Hetzner Cloud Console**:
- Navigate to each VPS → Graphs → Network Traffic
- Verify **outgoing traffic is minimal** (cross-VPS traffic uses private network, doesn't count)

**Expected**: Public bandwidth usage should be ~90% lower than if using public IPs

---

## End-to-End System Verification

### E2E Test 1: Full Evidence Upload Flow

1. **Upload PDF via MCP Platform UI** (https://app.mitechconsult.com)
2. **Verify in Directus**: File stored with SHA-256 hash
3. **Verify in Postgres**: Metadata + embedding in pgvector
4. **Verify in Graphiti**: Entity nodes created with `valid_from`
5. **Verify in Chroma**: Working memory copy exists (72hr TTL)

**Validation**:
```bash
# 1. Check Directus
curl -H "Authorization: Bearer <token>" https://files.mitechconsult.com/items/files?sort=-created_at&limit=1

# 2. Check Postgres
ssh salem-nexus "docker exec <postgres> psql -U postgres -c 'SELECT * FROM evidence ORDER BY created_at DESC LIMIT 1'"

# 3. Check Graphiti (via MCP Platform)
# Query Neo4j for latest entity node

# 4. Check Chroma
curl https://chroma.mitechconsult.com/api/v1/collections/evidence_processing/count
```

### E2E Test 2: Semantic Search Across Tiers

1. **Execute semantic query** via MCP Platform: "Find all evidence mentioning suspect John Doe"
2. **Verify query routed to pgvector** (check logs)
3. **Results include temporal context** (from Graphiti)
4. **Results include recent working memory** (from Chroma)

### E2E Test 3: Temporal Query

1. **Execute temporal query**: "Show all evidence changes from Jan 15-20, 2026"
2. **Verify routed to Graphiti** (not pgvector)
3. **Results include valid_from timestamps**
4. **Chain of custody maintained** (audit log in Postgres)

### E2E Test 4: System Degradation (Fault Tolerance)

**Test Chroma offline**:
```bash
ssh salem-forge "docker stop <chroma-container>"
```

**Execute evidence upload**:
- Should succeed (Chroma failure logged as warning)
- Postgres + Directus + Graphiti still write successfully

**Restore Chroma**:
```bash
ssh salem-forge "docker start <chroma-container>"
```

**Expected**: System continues functioning with degraded working memory

---

## Performance Benchmarks

### Database Latency (Private Network vs Public)

**VPS3 → VPS1 Postgres (Private Network)**:
```bash
ssh salem-platform "time docker exec <mcp-container> psql -h 10.10.0.2 -U postgres -c 'SELECT 1'"
```

**Expected**: < 10ms total (including psql startup)

**Compare to public IP** (for reference, don't use in production):
```bash
ssh salem-platform "time docker exec <mcp-container> psql -h 188.245.189.218 -U postgres -c 'SELECT 1'"
```

**Expected**: ~2-5x slower than private network

### System Router Performance

**Multi-system write (4 storage systems)**:
```bash
# Measure time for single evidence upload
# Should complete in < 500ms for small file
```

**Semantic search (pgvector)**:
```bash
# Measure time for embedding search
# Should complete in < 100ms for 1000-vector collection
```

---

## Rollback Verification

If any phase fails and rollback is needed, verify:

### Phase 1 Rollback
```bash
ssh salem-nexus "docker restart <postgres-container>"
# Verify Postgres starts without errors
# Extensions should still be present (additive change)
```

### Phase 2 Rollback
```bash
# In Coolify UI: Delete VPS2 deployment
ssh salem-forge "docker ps"
# Should show no application containers (only Traefik if VPS2 is worker)
```

### Phase 3 Rollback
```bash
# Keep Manus hosting active
# Delete VPS3 deployment in Coolify
# Verify old Manus site still accessible
```

---

## Post-Deployment Monitoring

### Daily Checks (First Week)

1. **All services running**:
   ```bash
   for vps in salem-nexus salem-forge salem-platform; do
     echo "Checking $vps"
     ssh $vps "docker ps | wc -l"
   done
   ```

2. **Chroma TTL working** (72hr expiration):
   ```bash
   curl https://chroma.mitechconsult.com/api/v1/collections/evidence_processing/count
   # Should see count decrease after 72hr
   ```

3. **Audit log growing**:
   ```bash
   ssh salem-nexus "docker exec <postgres> psql -U postgres -c 'SELECT COUNT(*) FROM audit_log'"
   ```

4. **No SSL cert expiration warnings**:
   ```bash
   ssh salem-forge "docker logs traefik 2>&1 | grep -i 'certificate\|expir' | tail -10"
   ```

### Weekly Checks

1. **Review Postgres connections**:
   ```bash
   ssh salem-nexus "docker exec <postgres> psql -U postgres -c 'SELECT count(*) FROM pg_stat_activity WHERE state = \"active\"'"
   # Should be < 50 typically
   ```

2. **Review ChromaDB collection sizes**:
   ```bash
   curl https://chroma.mitechconsult.com/api/v1/collections
   # Check sizes, verify auto-expiration working
   ```

3. **Check Graphiti graph size**:
   ```bash
   # Query Neo4j Aura console: MATCH (n) RETURN count(n)
   # Should grow steadily, no orphaned nodes
   ```

---

## Success Criteria Summary

| Phase | Critical Success Metric |
|-------|------------------------|
| Pre-Deployment | All 3 VPSs reachable via SSH, private network pings work |
| Phase 1 | 34 Postgres extensions loaded, LibreChat running |
| Phase 2 | All 8 VPS2 services running, SSL certs issued, cross-VPS Postgres connection works via 10.10.0.2 |
| Phase 3 | MCP Platform UI accessible, MySQL migrated with matching row counts, app connects to all 4 storage layers via private IPs |
| Phase 4 | System Router writes to all 4 storage systems, SHA-256 hashing works, temporal queries return time-aware results |
| Phase 5 | All 14 DNS records propagated, all subdomains HTTPS, private network traffic confirmed |

---

**End of Verification Checklist**

Refer back to MASTER_DEPLOYMENT_GUIDE.md for detailed phase procedures.

**CRITICAL REMINDER**: Use private network IPs (10.10.0.x) for ALL cross-VPS database connections!
