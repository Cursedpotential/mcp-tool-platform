# Coolify Deployment Guide - Salem Forensics Platform

**Date:** January 7, 2026  
**Servers:** salem-nexus (Coolify master), salem-forge (remote worker)  
**Coolify API Key:** `1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b`

---

## Architecture Overview

**salem-nexus (116.203.199.238):**
- Coolify master instance
- PostgreSQL + FerretDB
- Directus CMS
- PhotoPrism
- n8n automation
- Block storage: salem-vault (60GB XFS) at `/mnt/salem-vault`

**salem-forge (116.203.198.77):**
- Coolify remote worker (clean Debian)
- LiteLLM
- MetaMCP
- Chroma VPS
- LibreChat + Open WebUI
- Ollama
- Kasm Workspace
- Browserless + Playwright

---

## Phase 1: Coolify API Setup

### 1.1 Test API Connection

```bash
curl -H "Authorization: Bearer 1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b" \
  https://nexus.mitechconsult.com/api/v1/servers
```

**Expected:** List of servers (should show salem-nexus)

### 1.2 Get Server Details

```bash
curl -H "Authorization: Bearer 1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b" \
  https://nexus.mitechconsult.com/api/v1/servers/{server_id}
```

---

## Phase 2: Add salem-forge as Remote Server

### 2.1 Wait for salem-forge Reformat

- User is reformatting salem-forge to clean Debian
- IP will remain: 116.203.198.77
- Wait for confirmation before proceeding

### 2.2 Add Remote Server via Coolify UI

1. Go to Coolify dashboard: https://nexus.mitechconsult.com
2. Navigate to **Servers** → **Add Server**
3. Enter details:
   - **Name:** salem-forge
   - **IP:** 116.203.198.77
   - **SSH Key:** Use existing or generate new
   - **Type:** Remote Server

### 2.3 Or via API

```bash
curl -X POST -H "Authorization: Bearer 1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "salem-forge",
    "ip": "116.203.198.77",
    "port": 22,
    "user": "root"
  }' \
  https://nexus.mitechconsult.com/api/v1/servers
```

---

## Phase 3: Configure salem-vault Volume

### 3.1 Mount Block Storage on salem-nexus

SSH into salem-nexus and verify mount:

```bash
ssh root@116.203.199.238

# Check if salem-vault is mounted
df -h | grep salem-vault

# If not mounted, mount it
mkdir -p /mnt/salem-vault
mount /dev/disk/by-id/scsi-0HC_Volume_<volume_id> /mnt/salem-vault

# Add to /etc/fstab for persistence
echo "/dev/disk/by-id/scsi-0HC_Volume_<volume_id> /mnt/salem-vault xfs defaults 0 0" >> /etc/fstab

# Create directory structure
mkdir -p /mnt/salem-vault/postgres
mkdir -p /mnt/salem-vault/media/originals
mkdir -p /mnt/salem-vault/media/cache
mkdir -p /mnt/salem-vault/backups
mkdir -p /mnt/salem-vault/directus

# Set permissions
chmod 755 /mnt/salem-vault
chmod 700 /mnt/salem-vault/postgres
chmod 755 /mnt/salem-vault/media
```

### 3.2 Configure Coolify to Use Volume

In Coolify UI or docker-compose, map volumes:

```yaml
volumes:
  - /mnt/salem-vault/postgres:/var/lib/postgresql/data
  - /mnt/salem-vault/media:/media
  - /mnt/salem-vault/directus:/directus/uploads
```

---

## Phase 4: Deploy PostgreSQL + FerretDB

### 4.1 Create Project in Coolify

1. Go to **Projects** → **New Project**
2. Name: `salem-forensics-storage`
3. Description: Storage, database, and CMS backend

### 4.2 Add PostgreSQL Service

**Via Coolify UI:**
1. Add Service → Database → PostgreSQL
2. Name: `salem-postgres`
3. Version: 16
4. Volume: `/mnt/salem-vault/postgres:/var/lib/postgresql/data`
5. Environment variables:
   - `POSTGRES_USER=salem`
   - `POSTGRES_PASSWORD=<generate_strong_password>`
   - `POSTGRES_DB=salem_forensics`
6. Domain: `postgres.mitechconsult.com` (internal only, no public access)

**Or via docker-compose import:**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: salem-postgres
    environment:
      POSTGRES_USER: salem
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: salem_forensics
    volumes:
      - /mnt/salem-vault/postgres:/var/lib/postgresql/data
    networks:
      - salem-network
    restart: unless-stopped
```

### 4.3 Add FerretDB Service

```yaml
services:
  ferretdb:
    image: ghcr.io/ferretdb/ferretdb:latest
    container_name: salem-ferretdb
    environment:
      FERRETDB_POSTGRESQL_URL: postgres://salem:${POSTGRES_PASSWORD}@postgres:5432/salem_forensics
    depends_on:
      - postgres
    networks:
      - salem-network
    restart: unless-stopped
```

---

## Phase 5: Deploy Directus

### 5.1 Add Directus Service

```yaml
services:
  directus:
    image: directus/directus:latest
    container_name: salem-directus
    environment:
      KEY: ${DIRECTUS_KEY}
      SECRET: ${DIRECTUS_SECRET}
      DB_CLIENT: pg
      DB_HOST: postgres
      DB_PORT: 5432
      DB_DATABASE: salem_forensics
      DB_USER: salem
      DB_PASSWORD: ${POSTGRES_PASSWORD}
      ADMIN_EMAIL: matt.salem85@gmail.com
      ADMIN_PASSWORD: ${DIRECTUS_ADMIN_PASSWORD}
      PUBLIC_URL: https://directus.mitechconsult.com
      STORAGE_LOCATIONS: local
      STORAGE_LOCAL_ROOT: /directus/uploads
    volumes:
      - /mnt/salem-vault/directus:/directus/uploads
      - /mnt/salem-vault/media:/media:ro  # Read-only access to shared media
    depends_on:
      - postgres
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.directus.rule=Host(`directus.mitechconsult.com`)"
      - "traefik.http.routers.directus.entrypoints=websecure"
      - "traefik.http.routers.directus.tls.certresolver=letsencrypt"
    networks:
      - salem-network
    restart: unless-stopped
```

**Coolify will handle Traefik labels automatically if you set the domain in UI.**

---

## Phase 6: Deploy PhotoPrism

### 6.1 Add PhotoPrism Service

```yaml
services:
  photoprism:
    image: photoprism/photoprism:latest
    container_name: salem-photoprism
    environment:
      PHOTOPRISM_ADMIN_USER: admin
      PHOTOPRISM_ADMIN_PASSWORD: ${PHOTOPRISM_PASSWORD}
      PHOTOPRISM_AUTH_MODE: password
      PHOTOPRISM_SITE_URL: https://photo.mitechconsult.com
      PHOTOPRISM_ORIGINALS_LIMIT: 50000
      PHOTOPRISM_HTTP_COMPRESSION: gzip
      PHOTOPRISM_DATABASE_DRIVER: postgres
      PHOTOPRISM_DATABASE_SERVER: postgres:5432
      PHOTOPRISM_DATABASE_NAME: salem_forensics
      PHOTOPRISM_DATABASE_USER: salem
      PHOTOPRISM_DATABASE_PASSWORD: ${POSTGRES_PASSWORD}
      PHOTOPRISM_DISABLE_TLS: "false"
      PHOTOPRISM_DEFAULT_TLS: "true"
    volumes:
      - /mnt/salem-vault/media/originals:/photoprism/originals
      - /mnt/salem-vault/media/cache:/photoprism/storage
    depends_on:
      - postgres
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.photoprism.rule=Host(`photo.mitechconsult.com`)"
      - "traefik.http.routers.photoprism.entrypoints=websecure"
      - "traefik.http.routers.photoprism.tls.certresolver=letsencrypt"
    networks:
      - salem-network
    restart: unless-stopped
```

---

## Phase 7: Deploy n8n

### 7.1 Add n8n Service

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    container_name: salem-n8n
    environment:
      N8N_HOST: n8n.mitechconsult.com
      N8N_PORT: 5678
      N8N_PROTOCOL: https
      WEBHOOK_URL: https://n8n.mitechconsult.com
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: salem_forensics
      DB_POSTGRESDB_USER: salem
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD}
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
    volumes:
      - /mnt/salem-vault/n8n:/home/node/.n8n
      - /mnt/salem-vault/media:/media  # Access to shared media for workflows
    depends_on:
      - postgres
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.n8n.rule=Host(`n8n.mitechconsult.com`)"
      - "traefik.http.routers.n8n.entrypoints=websecure"
      - "traefik.http.routers.n8n.tls.certresolver=letsencrypt"
    networks:
      - salem-network
    restart: unless-stopped
```

---

## Phase 8: Deploy Tailscale + rclone Sidecar

### 8.1 Infrastructure Sidecar

```yaml
services:
  infrastructure:
    image: ubuntu:22.04
    container_name: salem-infrastructure
    privileged: true
    environment:
      TAILSCALE_AUTH_KEY: ${TAILSCALE_AUTH_KEY}
      RCLONE_CONFIG_R2_TYPE: s3
      RCLONE_CONFIG_R2_PROVIDER: Cloudflare
      RCLONE_CONFIG_R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY}
      RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: ${R2_SECRET_KEY}
      RCLONE_CONFIG_R2_ENDPOINT: ${R2_ENDPOINT}
    volumes:
      - /mnt/salem-vault:/mnt/salem-vault:shared  # Shared with all containers
    command: |
      bash -c "
        apt-get update && apt-get install -y curl rclone fuse &&
        curl -fsSL https://tailscale.com/install.sh | sh &&
        tailscale up --authkey=$TAILSCALE_AUTH_KEY --hostname=salem-nexus &&
        mkdir -p /mnt/r2 &&
        rclone mount r2:salem-forensics /mnt/r2 --daemon --allow-other &&
        tail -f /dev/null
      "
    networks:
      - salem-network
    restart: unless-stopped
```

---

## Phase 9: Environment Variables

Create `.env` file in Coolify project:

```env
# PostgreSQL
POSTGRES_PASSWORD=<generate_strong_password>

# Directus
DIRECTUS_KEY=<generate_random_key>
DIRECTUS_SECRET=<generate_random_secret>
DIRECTUS_ADMIN_PASSWORD=<generate_strong_password>

# PhotoPrism
PHOTOPRISM_PASSWORD=<generate_strong_password>

# n8n
N8N_ENCRYPTION_KEY=<generate_random_key>

# Tailscale
TAILSCALE_AUTH_KEY=<get_from_tailscale_admin>

# R2 Storage
R2_ACCESS_KEY=<get_from_cloudflare>
R2_SECRET_KEY=<get_from_cloudflare>
R2_ENDPOINT=<your_r2_endpoint>

# Hetzner
HETZNER_API_KEY=BpA7Tw9IkbPG57dSFVtG0q56Bz7F20Wkcdg5Gpd2vaj2pOvGWKtVd817I0n0eAUl

# Cloudflare
CLOUDFLARE_EMAIL=matt.salem85@gmail.com
CLOUDFLARE_API_KEY=d4a987b34085205d82f58e410e38dbba99786
CLOUDFLARE_ZONE_ID=d543c96e4bb7fad63e5f1925dce79640
```

---

## Phase 10: Testing & Verification

### 10.1 Test PostgreSQL Connection

```bash
docker exec -it salem-postgres psql -U salem -d salem_forensics -c "\dt"
```

### 10.2 Test Directus

1. Go to https://directus.mitechconsult.com
2. Login with admin credentials
3. Create test collection
4. Upload test file

### 10.3 Test PhotoPrism

1. Go to https://photo.mitechconsult.com
2. Login with admin credentials
3. Upload test image to `/mnt/salem-vault/media/originals`
4. Verify PhotoPrism indexes it

### 10.4 Test n8n

1. Go to https://n8n.mitechconsult.com
2. Create test workflow
3. Test webhook trigger
4. Verify database connection

### 10.5 Test Shared Storage

```bash
# On salem-nexus
touch /mnt/salem-vault/media/originals/test.txt

# Verify Directus can see it
docker exec -it salem-directus ls /media/originals

# Verify PhotoPrism can see it
docker exec -it salem-photoprism ls /photoprism/originals
```

---

## Phase 11: salem-forge Deployment (After Reformat)

Once salem-forge is reformatted and added to Coolify:

### 11.1 Deploy AI/Compute Services

Use `docker-compose.vps2-compute.yml` from project root:

```bash
# Copy to salem-forge
scp docker-compose.vps2-compute.yml root@116.203.198.77:/root/

# Deploy via Coolify
# Import docker-compose in Coolify UI
# Assign to salem-forge server
```

### 11.2 Services on salem-forge

- LiteLLM (llm.mitechconsult.com)
- MetaMCP (mcp.mitechconsult.com)
- Chroma VPS (chroma.mitechconsult.com)
- LibreChat (chat.mitechconsult.com)
- Open WebUI (ui.mitechconsult.com)
- Ollama (ollama.mitechconsult.com)
- Kasm Workspace (desktop.mitechconsult.com)
- Browserless (browser.mitechconsult.com)
- Playwright

---

## Phase 12: Cloudflare Access (Zero Trust)

### 12.1 Enable Cloudflare Access

1. Go to Cloudflare dashboard → Zero Trust
2. Create Access application for each service
3. Set authentication policy (email OTP, Google, etc.)
4. Apply to all subdomains except mail-related

### 12.2 Example Policy

- **Application:** Salem Forensics Services
- **Domains:** *.mitechconsult.com (exclude mail.*, mx.*, smtp.*)
- **Policy:** Email must be matt.salem85@gmail.com
- **Session duration:** 24 hours

---

## Troubleshooting

### Issue: Volume not mounted

```bash
# Check Hetzner volume status
curl -H "Authorization: Bearer BpA7Tw9IkbPG57dSFVtG0q56Bz7F20Wkcdg5Gpd2vaj2pOvGWKtVd817I0n0eAUl" \
  https://api.hetzner.cloud/v1/volumes

# Remount manually
mount /dev/disk/by-id/scsi-0HC_Volume_<id> /mnt/salem-vault
```

### Issue: Coolify API not responding

```bash
# Check Coolify status on salem-nexus
ssh root@116.203.199.238
docker ps | grep coolify
docker logs coolify
```

### Issue: Services can't connect to PostgreSQL

```bash
# Check PostgreSQL is running
docker ps | grep postgres
docker logs salem-postgres

# Test connection
docker exec -it salem-postgres psql -U salem -d salem_forensics
```

---

## Next Steps

1. ✅ Cloudflare DNS configured
2. ⏳ Deploy salem-nexus services via Coolify
3. ⏳ Wait for salem-forge reformat
4. ⏳ Add salem-forge to Coolify cluster
5. ⏳ Deploy salem-forge services
6. ⏳ Test end-to-end file ingestion pipeline
7. ⏳ Configure Cloudflare Access for Zero Trust

---

**End of Deployment Guide**
