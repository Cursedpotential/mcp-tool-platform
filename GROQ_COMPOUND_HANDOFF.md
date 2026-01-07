# Groq Compound Agent Handoff - Salem Infrastructure Deployment

**Date:** January 7, 2026  
**Task:** Deploy infrastructure services via Coolify on salem-nexus (master node)  
**Priority:** HIGH  
**Estimated Time:** 2-4 hours  

---

## Mission

Deploy PostgreSQL, FerretDB, Directus, PhotoPrism, n8n, and Tailscale to **salem-nexus** (116.203.199.238) using **Coolify API**. Configure shared media storage on salem-vault (60GB XFS volume). Later, add **salem-forge** (116.203.198.77) as remote server for AI/Compute services.

**Architecture:** salem-nexus = Coolify master controlling both VPS servers

---

## Credentials & Access

### Coolify API
- **URL:** https://nexus.mitechconsult.com
- **API Key:** `1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b`
- **Test:** `curl -H "Authorization: Bearer <API_KEY>" https://nexus.mitechconsult.com/api/v1/servers`

### Hetzner Cloud API
- **API Key:** `BpA7Tw9IkbPG57dSFVtG0q56Bz7F20Wkcdg5Gpd2vaj2pOvGWKtVd817I0n0eAUl`
- **salem-nexus:** ID 116864004, IP 116.203.199.238 (8c/16GB)
- **salem-forge:** ID 116864005, IP 116.203.198.77 (8c/16GB, will add as remote server later)
- **salem-vault:** 60GB XFS volume attached to salem-nexus

### Cloudflare
- **Email:** matt.salem85@gmail.com
- **Global API Key:** `d4a987b34085205d82f58e410e38dbba99786`
- **Zone ID:** `d543c96e4bb7fad63e5f1925dce79640`
- **Domain:** mitechconsult.com

### SSH Access
- **salem-nexus:** root@116.203.199.238
- **salem-forge:** root@116.203.198.77
- **Note:** Use Hetzner console if SSH key not available

---

## Phase 1: Deploy salem-nexus Services (Tonight)

### Pre-Deployment Checklist

#### 1. Verify salem-vault Volume Mount

```bash
# SSH into salem-nexus
ssh root@116.203.199.238

# Check if volume is mounted
df -h | grep salem-vault

# If not mounted, find volume device
lsblk

# Mount it (replace <device> with actual device from lsblk)
mkdir -p /mnt/salem-vault
mount /dev/disk/by-id/scsi-0HC_Volume_* /mnt/salem-vault

# Verify mount
df -h /mnt/salem-vault

# Add to /etc/fstab for persistence
echo "$(blkid -s UUID -o value /dev/disk/by-id/scsi-0HC_Volume_*) /mnt/salem-vault xfs defaults 0 0" >> /etc/fstab

# Create directory structure
mkdir -p /mnt/salem-vault/postgres
mkdir -p /mnt/salem-vault/media/originals
mkdir -p /mnt/salem-vault/media/cache
mkdir -p /mnt/salem-vault/directus
mkdir -p /mnt/salem-vault/n8n
mkdir -p /mnt/salem-vault/backups

# Set permissions
chmod 755 /mnt/salem-vault
chmod 700 /mnt/salem-vault/postgres
chmod 755 /mnt/salem-vault/media
chmod 755 /mnt/salem-vault/directus
chmod 755 /mnt/salem-vault/n8n
```

#### 2. Test Coolify API Connection

```bash
curl -H "Authorization: Bearer 1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b" \
  https://nexus.mitechconsult.com/api/v1/servers | jq '.'
```

**Expected:** JSON response with server list

#### 3. Verify DNS Records

```bash
# Check DNS propagation
dig +short nexus.mitechconsult.com        # 116.203.199.238
dig +short directus.mitechconsult.com     # 116.203.199.238
dig +short photo.mitechconsult.com        # 116.203.199.238
dig +short n8n.mitechconsult.com          # 116.203.199.238
dig +short postgres.mitechconsult.com     # 116.203.199.238
```

**Expected:** All should resolve to 116.203.199.238

---

### Deployment via Coolify

**IMPORTANT:** Use Coolify UI or API to deploy services. Coolify will:
- Automatically configure Traefik reverse proxy
- Issue Let's Encrypt SSL certificates
- Manage container lifecycle
- Handle volume mounts
- Configure networking

#### Option A: Coolify UI Deployment (Recommended)

1. **Go to Coolify:** https://nexus.mitechconsult.com
2. **Create Project:** "salem-forensics-storage"
3. **Add Services:** For each service below, click "New Resource" → "Docker Compose"
4. **Paste docker-compose.yml** from `/home/ubuntu/mcp-tool-platform/docker-compose.vps1-storage.yml`
5. **Configure Environment Variables** (see below)
6. **Deploy**

#### Option B: Coolify API Deployment

**Note:** Coolify API for docker-compose deployment may require research. If API is unclear, use UI.

```bash
# Example API call (adjust based on Coolify API docs)
curl -X POST -H "Authorization: Bearer 1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b" \
  -H "Content-Type: application/json" \
  -d @deployment-payload.json \
  https://nexus.mitechconsult.com/api/v1/applications
```

---

### Service Configuration Details

#### 1. PostgreSQL

**Environment Variables:**
```env
POSTGRES_USER=salem
POSTGRES_PASSWORD=<GENERATE_STRONG_PASSWORD>
POSTGRES_DB=salem_forensics
```

**Volume Mount:**
```yaml
volumes:
  - /mnt/salem-vault/postgres:/var/lib/postgresql/data
```

**Verification:**
```bash
docker exec -it salem-postgres psql -U salem -d salem_forensics -c "SELECT version();"
```

---

#### 2. FerretDB

**Environment Variables:**
```env
FERRETDB_POSTGRESQL_URL=postgres://salem:${POSTGRES_PASSWORD}@postgres:5432/salem_forensics
```

**Depends On:** PostgreSQL

**Verification:**
```bash
docker logs salem-ferretdb | grep "FerretDB started"
```

---

#### 3. Directus

**Domain:** directus.mitechconsult.com

**Environment Variables:**
```env
KEY=<GENERATE_RANDOM_32_CHAR_KEY>
SECRET=<GENERATE_RANDOM_64_CHAR_SECRET>
DB_CLIENT=pg
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=salem_forensics
DB_USER=salem
DB_PASSWORD=${POSTGRES_PASSWORD}
ADMIN_EMAIL=matt.salem85@gmail.com
ADMIN_PASSWORD=<GENERATE_STRONG_PASSWORD>
PUBLIC_URL=https://directus.mitechconsult.com
STORAGE_LOCATIONS=local
STORAGE_LOCAL_ROOT=/directus/uploads
```

**Volume Mounts:**
```yaml
volumes:
  - /mnt/salem-vault/directus:/directus/uploads
  - /mnt/salem-vault/media:/media:ro
```

**Verification:**
```bash
curl -I https://directus.mitechconsult.com
# Should return 200 OK or redirect to login
```

---

#### 4. PhotoPrism

**Domain:** photo.mitechconsult.com

**Environment Variables:**
```env
PHOTOPRISM_ADMIN_USER=admin
PHOTOPRISM_ADMIN_PASSWORD=<GENERATE_STRONG_PASSWORD>
PHOTOPRISM_AUTH_MODE=password
PHOTOPRISM_SITE_URL=https://photo.mitechconsult.com
PHOTOPRISM_ORIGINALS_LIMIT=50000
PHOTOPRISM_HTTP_COMPRESSION=gzip
PHOTOPRISM_DATABASE_DRIVER=postgres
PHOTOPRISM_DATABASE_SERVER=postgres:5432
PHOTOPRISM_DATABASE_NAME=salem_forensics
PHOTOPRISM_DATABASE_USER=salem
PHOTOPRISM_DATABASE_PASSWORD=${POSTGRES_PASSWORD}
PHOTOPRISM_DISABLE_TLS=false
PHOTOPRISM_DEFAULT_TLS=true
```

**Volume Mounts:**
```yaml
volumes:
  - /mnt/salem-vault/media/originals:/photoprism/originals
  - /mnt/salem-vault/media/cache:/photoprism/storage
```

**Verification:**
```bash
# Wait 60 seconds for startup
sleep 60
curl -I https://photo.mitechconsult.com
# Should return 200 OK
```

---

#### 5. n8n

**Domain:** n8n.mitechconsult.com

**Environment Variables:**
```env
N8N_HOST=n8n.mitechconsult.com
N8N_PORT=5678
N8N_PROTOCOL=https
WEBHOOK_URL=https://n8n.mitechconsult.com
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=postgres
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=salem_forensics
DB_POSTGRESDB_USER=salem
DB_POSTGRESDB_PASSWORD=${POSTGRES_PASSWORD}
N8N_ENCRYPTION_KEY=<GENERATE_RANDOM_KEY>
```

**Volume Mounts:**
```yaml
volumes:
  - /mnt/salem-vault/n8n:/home/node/.n8n
  - /mnt/salem-vault/media:/media
```

**Verification:**
```bash
curl -I https://n8n.mitechconsult.com
# Should return 200 OK or redirect
```

---

#### 6. Tailscale

**Environment Variables:**
```env
TS_AUTHKEY=<GET_FROM_TAILSCALE_ADMIN>
TS_HOSTNAME=salem-nexus
TS_STATE_DIR=/var/lib/tailscale
```

**Capabilities:**
```yaml
cap_add:
  - NET_ADMIN
  - SYS_MODULE
```

**Verification:**
```bash
docker exec -it salem-tailscale tailscale status
# Should show connected devices
```

---

### Environment Variables Summary

Generate these strong passwords/keys and save securely:

```bash
# Generate passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
DIRECTUS_KEY=$(openssl rand -base64 32)
DIRECTUS_SECRET=$(openssl rand -base64 64)
DIRECTUS_ADMIN_PASSWORD=$(openssl rand -base64 32)
PHOTOPRISM_PASSWORD=$(openssl rand -base64 32)
N8N_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Save to file
cat > /root/salem-credentials.env <<EOF
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DIRECTUS_KEY=${DIRECTUS_KEY}
DIRECTUS_SECRET=${DIRECTUS_SECRET}
DIRECTUS_ADMIN_PASSWORD=${DIRECTUS_ADMIN_PASSWORD}
PHOTOPRISM_PASSWORD=${PHOTOPRISM_PASSWORD}
N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
EOF

chmod 600 /root/salem-credentials.env
```

---

### Post-Deployment Testing

#### Test 1: PostgreSQL Connection

```bash
docker exec -it salem-postgres psql -U salem -d salem_forensics -c "\dt"
```

**Expected:** List of tables (should include Directus, PhotoPrism, n8n tables)

#### Test 2: Shared Media Storage

```bash
# Create test file
touch /mnt/salem-vault/media/originals/test-file.txt

# Verify Directus can see it
docker exec -it salem-directus ls /media/originals

# Verify PhotoPrism can see it
docker exec -it salem-photoprism ls /photoprism/originals

# Verify n8n can see it
docker exec -it salem-n8n ls /media/originals
```

**Expected:** All three containers should list `test-file.txt`

#### Test 3: Directus Admin Access

1. Go to https://directus.mitechconsult.com
2. Login with admin credentials
3. Create test collection: `test_collection`
4. Add test field: `name` (string)
5. Upload test file to Directus

**Expected:** File appears in `/mnt/salem-vault/directus/`

#### Test 4: PhotoPrism Image Indexing

1. Go to https://photo.mitechconsult.com
2. Login with admin credentials
3. Upload test image to `/mnt/salem-vault/media/originals/`
4. Trigger index in PhotoPrism UI

**Expected:** Image appears in PhotoPrism library

#### Test 5: n8n Workflow

1. Go to https://n8n.mitechconsult.com
2. Create test workflow:
   - Trigger: Manual
   - Action: Read file from `/media/originals/test-file.txt`
   - Action: Write to PostgreSQL
3. Execute workflow

**Expected:** Workflow completes successfully

---

## Phase 2: Add salem-forge as Remote Server (After Reformat)

**IMPORTANT:** salem-forge is currently being reformatted to clean Debian. Once ready, add it as a remote server in Coolify.

### Prerequisites

1. **salem-forge reformatted** to clean Debian 12
2. **SSH access** from salem-nexus to salem-forge
3. **Docker installed** on salem-forge

### Steps to Add Remote Server

#### 1. Prepare salem-forge

```bash
# SSH into salem-forge
ssh root@116.203.198.77

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Enable Docker
systemctl enable docker
systemctl start docker

# Verify Docker
docker --version
```

#### 2. Add SSH Key from salem-nexus

```bash
# On salem-nexus, generate SSH key if not exists
ssh-keygen -t ed25519 -C "coolify@salem-nexus" -f /root/.ssh/coolify_remote

# Copy public key to salem-forge
ssh-copy-id -i /root/.ssh/coolify_remote.pub root@116.203.198.77

# Test connection
ssh -i /root/.ssh/coolify_remote root@116.203.198.77 "docker ps"
```

#### 3. Add Remote Server in Coolify

**Via Coolify UI:**
1. Go to https://nexus.mitechconsult.com
2. Navigate to **Servers** → **Add Server**
3. **Name:** salem-forge
4. **IP Address:** 116.203.198.77
5. **SSH Port:** 22
6. **SSH User:** root
7. **SSH Private Key:** Paste contents of `/root/.ssh/coolify_remote`
8. **Test Connection**
9. **Save**

**Via Coolify API (if available):**
```bash
curl -X POST -H "Authorization: Bearer 1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "salem-forge",
    "ip": "116.203.198.77",
    "port": 22,
    "user": "root",
    "private_key": "<PASTE_SSH_KEY>"
  }' \
  https://nexus.mitechconsult.com/api/v1/servers
```

#### 4. Deploy AI/Compute Services to salem-forge

Once salem-forge is added as remote server, deploy services from `docker-compose.vps2-compute.yml`:

- LiteLLM (llm.mitechconsult.com)
- MetaMCP (mcp.mitechconsult.com)
- Chroma (chroma.mitechconsult.com)
- LibreChat (chat.mitechconsult.com)
- Open WebUI (ui.mitechconsult.com)
- Ollama (ollama.mitechconsult.com)
- Kasm Workspace (desktop.mitechconsult.com)
- Browserless (browser.mitechconsult.com)
- Playwright (playwright.mitechconsult.com)

**Deployment Process:**
1. In Coolify UI, create new project: "salem-forensics-compute"
2. Add new resource: Docker Compose
3. **Select Server:** salem-forge (remote)
4. Paste `docker-compose.vps2-compute.yml`
5. Configure environment variables
6. Deploy

---

## Troubleshooting

### Issue: Volume not mounted

```bash
# Check Hetzner volume status
curl -H "Authorization: Bearer BpA7Tw9IkbPG57dSFVtG0q56Bz7F20Wkcdg5Gpd2vaj2pOvGWKtVd817I0n0eAUl" \
  https://api.hetzner.cloud/v1/volumes | jq '.volumes[] | {name, server, status}'

# Remount manually
mount /dev/disk/by-id/scsi-0HC_Volume_* /mnt/salem-vault
```

### Issue: Coolify API not responding

```bash
# Check Coolify status
ssh root@116.203.199.238
docker ps | grep coolify
docker logs coolify
```

### Issue: Services can't connect to PostgreSQL

```bash
# Check PostgreSQL is running
docker ps | grep postgres
docker logs salem-postgres

# Test connection from host
docker exec -it salem-postgres psql -U salem -d salem_forensics
```

### Issue: DNS not resolving

```bash
# Check Cloudflare DNS
dig +short directus.mitechconsult.com

# If not resolving, wait 5-10 minutes for propagation
```

### Issue: Traefik not routing correctly

```bash
# Check Traefik logs
docker logs traefik

# Verify labels on containers
docker inspect salem-directus | grep -A 10 Labels
```

---

## Success Criteria

### Phase 1 (Tonight)
- [ ] PostgreSQL running and accessible
- [ ] FerretDB connected to PostgreSQL
- [ ] Directus accessible at https://directus.mitechconsult.com
- [ ] PhotoPrism accessible at https://photo.mitechconsult.com
- [ ] n8n accessible at https://n8n.mitechconsult.com
- [ ] Tailscale connected to network
- [ ] Shared media storage working (all services see same files)
- [ ] All services persisting data to salem-vault volume
- [ ] SSL/TLS certificates issued by Let's Encrypt
- [ ] All admin credentials documented and secure

### Phase 2 (After salem-forge reformat)
- [ ] salem-forge added as remote server in Coolify
- [ ] AI/Compute services deployed to salem-forge
- [ ] LiteLLM accessible at https://llm.mitechconsult.com
- [ ] MetaMCP accessible at https://mcp.mitechconsult.com
- [ ] Chroma accessible at https://chroma.mitechconsult.com
- [ ] LibreChat accessible at https://chat.mitechconsult.com
- [ ] Kasm Workspace accessible at https://desktop.mitechconsult.com
- [ ] Tailscale VPN connecting both VPS servers

---

## Deliverables

1. **Deployment Summary Report** - Document what was deployed, any issues encountered, and resolutions
2. **Credentials Document** - Secure list of all generated passwords and keys (saved to `/root/salem-credentials.env`)
3. **Service URLs** - List of all accessible services with test results
4. **Screenshots** - Directus, PhotoPrism, and n8n login screens
5. **Next Steps** - Recommendations for salem-forge deployment and file ingestion testing

---

## Timeline

**Tonight (Phase 1):**
- Deploy salem-nexus services (2-4 hours)
- Verify all services accessible
- Test shared media storage
- Ready for file ingestion testing

**Tomorrow (Phase 2):**
- Wait for salem-forge reformat completion
- Add salem-forge as remote server
- Deploy AI/Compute services
- Configure Tailscale VPN between servers

---

## Contact

**User:** Matthew Salem (matt.salem85@gmail.com)  
**Project:** Salem Forensics Platform  
**Goal:** End-to-end file ingestion testing tonight with live debugging

---

**End of Handoff Document**
