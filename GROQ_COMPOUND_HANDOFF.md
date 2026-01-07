# Groq Compound Agent Handoff - Salem Nexus Deployment

**Date:** January 7, 2026  
**Task:** Deploy infrastructure services to salem-nexus via Coolify  
**Priority:** HIGH  
**Estimated Time:** 2-4 hours  

---

## Mission

Deploy PostgreSQL, FerretDB, Directus, PhotoPrism, and n8n to **salem-nexus** (116.203.199.238) using Coolify API. Configure shared media storage on salem-vault (60GB XFS volume). Verify all services are accessible via Cloudflare DNS.

---

## Credentials & Access

### Coolify API
- **URL:** https://nexus.mitechconsult.com
- **API Key:** `1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b`
- **Test:** `curl -H "Authorization: Bearer <API_KEY>" https://nexus.mitechconsult.com/api/v1/servers`

### Hetzner Cloud API
- **API Key:** `BpA7Tw9IkbPG57dSFVtG0q56Bz7F20Wkcdg5Gpd2vaj2pOvGWKtVd817I0n0eAUl`
- **Server:** salem-nexus (ID: 116864004, IP: 116.203.199.238)
- **Volume:** salem-vault (ID: check via API, 60GB XFS, attached to salem-nexus)

### Cloudflare
- **Email:** matt.salem85@gmail.com
- **Global API Key:** `d4a987b34085205d82f58e410e38dbba99786`
- **Zone ID:** `d543c96e4bb7fad63e5f1925dce79640`
- **Domain:** mitechconsult.com

### SSH Access
- **Host:** root@116.203.199.238
- **Note:** Use Hetzner console if SSH key not available

---

## Pre-Deployment Checklist

### 1. Verify salem-vault Volume Mount

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

### 2. Test Coolify API Connection

```bash
curl -H "Authorization: Bearer 1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b" \
  https://nexus.mitechconsult.com/api/v1/servers | jq '.'
```

**Expected:** JSON response with server list

### 3. Verify DNS Records

```bash
# Check DNS propagation
dig +short nexus.mitechconsult.com
dig +short directus.mitechconsult.com
dig +short photo.mitechconsult.com
dig +short n8n.mitechconsult.com
dig +short postgres.mitechconsult.com
```

**Expected:** All should resolve to 116.203.199.238

---

## Deployment Steps

### Step 1: Create Coolify Project

**Via Coolify UI:**
1. Go to https://nexus.mitechconsult.com
2. Navigate to **Projects** → **New Project**
3. Name: `salem-forensics-storage`
4. Description: `Storage, database, and CMS backend for Salem Forensics Platform`

**Or via API (if available):**
```bash
curl -X POST -H "Authorization: Bearer 1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b" \
  -H "Content-Type: application/json" \
  -d '{"name":"salem-forensics-storage","description":"Storage, database, and CMS backend"}' \
  https://nexus.mitechconsult.com/api/v1/projects
```

### Step 2: Deploy PostgreSQL

**Service Configuration:**
- **Name:** salem-postgres
- **Image:** postgres:16-alpine
- **Domain:** postgres.mitechconsult.com (internal only, no public access)
- **Volume:** /mnt/salem-vault/postgres:/var/lib/postgresql/data

**Environment Variables:**
```env
POSTGRES_USER=salem
POSTGRES_PASSWORD=<GENERATE_STRONG_PASSWORD>
POSTGRES_DB=salem_forensics
```

**Docker Compose (if importing):**
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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U salem"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**Verification:**
```bash
# Wait for container to start
sleep 10

# Test connection
docker exec -it salem-postgres psql -U salem -d salem_forensics -c "SELECT version();"
```

### Step 3: Deploy FerretDB

**Service Configuration:**
- **Name:** salem-ferretdb
- **Image:** ghcr.io/ferretdb/ferretdb:latest
- **Depends on:** salem-postgres

**Environment Variables:**
```env
FERRETDB_POSTGRESQL_URL=postgres://salem:${POSTGRES_PASSWORD}@postgres:5432/salem_forensics
```

**Docker Compose:**
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

**Verification:**
```bash
# Check logs
docker logs salem-ferretdb

# Should see "FerretDB started" message
```

### Step 4: Deploy Directus

**Service Configuration:**
- **Name:** salem-directus
- **Image:** directus/directus:latest
- **Domain:** directus.mitechconsult.com
- **Volumes:**
  - /mnt/salem-vault/directus:/directus/uploads
  - /mnt/salem-vault/media:/media:ro (read-only shared media)

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

**Docker Compose:**
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
      - /mnt/salem-vault/media:/media:ro
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

**Verification:**
```bash
# Wait for startup
sleep 15

# Test access
curl -I https://directus.mitechconsult.com

# Should return 200 OK or redirect to login
```

### Step 5: Deploy PhotoPrism

**Service Configuration:**
- **Name:** salem-photoprism
- **Image:** photoprism/photoprism:latest
- **Domain:** photo.mitechconsult.com
- **Volumes:**
  - /mnt/salem-vault/media/originals:/photoprism/originals
  - /mnt/salem-vault/media/cache:/photoprism/storage

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

**Docker Compose:**
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

**Verification:**
```bash
# Wait for startup (PhotoPrism takes 30-60 seconds)
sleep 60

# Test access
curl -I https://photo.mitechconsult.com

# Should return 200 OK
```

### Step 6: Deploy n8n

**Service Configuration:**
- **Name:** salem-n8n
- **Image:** n8nio/n8n:latest
- **Domain:** n8n.mitechconsult.com
- **Volumes:**
  - /mnt/salem-vault/n8n:/home/node/.n8n
  - /mnt/salem-vault/media:/media (read-write for workflows)

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

**Docker Compose:**
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
      - /mnt/salem-vault/media:/media
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

**Verification:**
```bash
# Wait for startup
sleep 15

# Test access
curl -I https://n8n.mitechconsult.com

# Should return 200 OK or redirect
```

---

## Post-Deployment Testing

### Test 1: PostgreSQL Connection

```bash
docker exec -it salem-postgres psql -U salem -d salem_forensics -c "\dt"
```

**Expected:** List of tables (should include Directus, PhotoPrism, n8n tables)

### Test 2: Shared Media Storage

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

### Test 3: Directus Admin Access

1. Go to https://directus.mitechconsult.com
2. Login with admin credentials
3. Create test collection: `test_collection`
4. Add test field: `name` (string)
5. Upload test file to Directus

**Expected:** File appears in `/mnt/salem-vault/directus/`

### Test 4: PhotoPrism Image Indexing

1. Go to https://photo.mitechconsult.com
2. Login with admin credentials
3. Upload test image to `/mnt/salem-vault/media/originals/`
4. Trigger index in PhotoPrism UI

**Expected:** Image appears in PhotoPrism library

### Test 5: n8n Workflow

1. Go to https://n8n.mitechconsult.com
2. Create test workflow:
   - Trigger: Manual
   - Action: Read file from `/media/originals/test-file.txt`
   - Action: Write to PostgreSQL
3. Execute workflow

**Expected:** Workflow completes successfully

---

## Environment Variables Summary

Generate these strong passwords/keys and save securely:

```env
# PostgreSQL
POSTGRES_PASSWORD=<generate_32_char_password>

# Directus
DIRECTUS_KEY=<generate_32_char_random_key>
DIRECTUS_SECRET=<generate_64_char_random_secret>
DIRECTUS_ADMIN_PASSWORD=<generate_32_char_password>

# PhotoPrism
PHOTOPRISM_PASSWORD=<generate_32_char_password>

# n8n
N8N_ENCRYPTION_KEY=<generate_32_char_random_key>
```

**Password generation command:**
```bash
openssl rand -base64 32
```

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

---

## Success Criteria

- [ ] PostgreSQL running and accessible
- [ ] FerretDB connected to PostgreSQL
- [ ] Directus accessible at https://directus.mitechconsult.com
- [ ] PhotoPrism accessible at https://photo.mitechconsult.com
- [ ] n8n accessible at https://n8n.mitechconsult.com
- [ ] Shared media storage working (all services see same files)
- [ ] All services persisting data to salem-vault volume
- [ ] SSL/TLS certificates issued by Let's Encrypt
- [ ] All admin credentials documented and secure

---

## Deliverables

1. **Deployment Summary Report** - Document what was deployed, any issues encountered, and resolutions
2. **Credentials Document** - Secure list of all generated passwords and keys
3. **Service URLs** - List of all accessible services with test results
4. **Screenshots** - Directus, PhotoPrism, and n8n login screens
5. **Next Steps** - Recommendations for salem-forge deployment

---

## Contact

**User:** Matthew Salem (matt.salem85@gmail.com)  
**Project:** Salem Forensics Platform  
**Timeline:** Deploy tonight for end-to-end file ingestion testing

---

**End of Handoff Document**
