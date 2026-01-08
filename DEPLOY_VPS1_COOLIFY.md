# Deploy VPS1 Storage Stack to Coolify

**Server:** salem-nexus (116.203.199.238)  
**Coolify URL:** https://nexus.mitechconsult.com  
**API Key:** `1|VieISJXT6EBaBL8DLO1Fc1q2hAPuVWjBgKwAVTFZd343619b`

---

## Prerequisites

### 1. Verify Block Storage Mount

```bash
ssh root@116.203.199.238

# Check if volume is mounted
df -h | grep block-storage

# If not mounted, find volume device
lsblk

# Mount it (replace with actual device)
mkdir -p /mnt/block-storage
mount /dev/disk/by-id/scsi-0HC_Volume_* /mnt/block-storage

# Add to /etc/fstab for persistence
echo "$(blkid -s UUID -o value /dev/disk/by-id/scsi-0HC_Volume_*) /mnt/block-storage xfs defaults 0 0" >> /etc/fstab

# Create directory structure
mkdir -p /mnt/block-storage/media
chmod 755 /mnt/block-storage
chmod 755 /mnt/block-storage/media
```

### 2. Create R2 API Token

1. Go to https://dash.cloudflare.com/1a7406c497493a52128bb282f499e7b8/r2/api-tokens
2. Click "Create API Token"
3. Name: `salem-nexus-backup`
4. Permissions: **Object Read & Write**
5. Bucket: **main** (or create `salem-forensics-backup`)
6. Copy **Access Key ID** and **Secret Access Key**
7. Update `.env.vps1-storage`:
   ```
   R2_ACCESS_KEY_ID=<paste_access_key_id>
   R2_SECRET_ACCESS_KEY=<paste_secret_access_key>
   ```

### 3. Get Tailscale Auth Key

1. Go to https://login.tailscale.com/admin/settings/keys
2. Click "Generate auth key"
3. Options:
   - ✅ Reusable
   - ✅ Ephemeral (optional)
   - Tags: `salem-storage`
4. Copy auth key
5. Update `.env.vps1-storage`:
   ```
   TAILSCALE_AUTH_KEY=<paste_auth_key>
   ```

---

## Deployment via Coolify UI

### Step 1: Login to Coolify

1. Go to https://nexus.mitechconsult.com
2. Login with Coolify credentials

### Step 2: Create New Project

1. Click **Projects** → **New Project**
2. Name: `salem-forensics-storage`
3. Description: `Storage & CMS backend for forensic analysis platform`
4. Click **Create**

### Step 3: Add Docker Compose Service

1. In project, click **New Resource** → **Docker Compose**
2. Name: `storage-stack`
3. Paste contents of `docker-compose.vps1-storage.yml`
4. Click **Save**

### Step 4: Configure Environment Variables

Click **Environment** tab and add all variables from `.env.vps1-storage`:

```env
DOMAIN=mitechconsult.com
POSTGRES_USER=salem
POSTGRES_PASSWORD=!Ms10238512!
POSTGRES_DB=salem_forensics
DIRECTUS_ADMIN_EMAIL=matt.salem85@gmail.com
DIRECTUS_ADMIN_PASSWORD=!Ms10238512!
DIRECTUS_KEY=O4RSmsY8baYrDWzCnrGh9bxYnSmqAnXz81IVyLAJl9k=
DIRECTUS_SECRET=GlP/Kha8JnxgRZIBocFQcHJk1XeaplI9w4EUqUb41HlCfFMO0+vOi9WSBQg4y17KBIN2JhjWxOyvQQ+TDMBCyQ==
PHOTOPRISM_ADMIN_USER=admin
PHOTOPRISM_ADMIN_PASSWORD=!Ms10238512!
N8N_USER=admin
N8N_PASSWORD=!Ms10238512!
TAILSCALE_AUTH_KEY=<paste_your_tailscale_key>
R2_ACCESS_KEY_ID=<paste_your_r2_key>
R2_SECRET_ACCESS_KEY=<paste_your_r2_secret>
R2_ENDPOINT=https://1a7406c497493a52128bb282f499e7b8.r2.cloudflarestorage.com
R2_BUCKET=main
```

### Step 5: Deploy

1. Click **Deploy** button
2. Wait for services to start (2-5 minutes)
3. Monitor logs for any errors

---

## Verification

### Check Service Status

```bash
ssh root@116.203.199.238
docker ps

# Should see:
# - salem-postgres
# - salem-ferretdb
# - salem-directus
# - salem-photoprism
# - salem-n8n
# - salem-vps1-infrastructure
```

### Test PostgreSQL

```bash
docker exec -it salem-postgres psql -U salem -d salem_forensics -c "SELECT version();"
```

### Test Directus

```bash
curl -I https://cms.mitechconsult.com
# Should return 200 OK or redirect to login
```

### Test PhotoPrism

```bash
curl -I https://photos.mitechconsult.com
# Should return 200 OK
```

### Test n8n

```bash
curl -I https://n8n.mitechconsult.com
# Should return 200 OK or 401 (auth required)
```

### Test Shared Media Storage

```bash
# Create test file
touch /mnt/block-storage/media/test-file.txt

# Verify Directus can see it
docker exec -it salem-directus ls /directus/uploads

# Verify PhotoPrism can see it
docker exec -it salem-photoprism ls /photoprism/originals

# Verify n8n can see it
docker exec -it salem-n8n ls /media
```

---

## DNS Configuration

Ensure these DNS records exist in Cloudflare:

```
Type  Name     Content              Proxy  TTL
A     cms      116.203.199.238      ✅     Auto
A     photos   116.203.199.238      ✅     Auto
A     n8n      116.203.199.238      ✅     Auto
```

---

## Troubleshooting

### Issue: Services not starting

```bash
# Check logs
docker logs salem-postgres
docker logs salem-directus
docker logs salem-photoprism
docker logs salem-n8n
```

### Issue: Block storage not mounted

```bash
# Remount manually
mount /dev/disk/by-id/scsi-0HC_Volume_* /mnt/block-storage
```

### Issue: Traefik not routing

```bash
# Check Traefik logs
docker logs traefik

# Verify labels on containers
docker inspect salem-directus | grep -A 10 Labels
```

### Issue: SSL certificates not issued

```bash
# Check Traefik dashboard
# Ensure DNS records are pointing to correct IP
# Wait 5-10 minutes for Let's Encrypt validation
```

---

## Next Steps

1. ✅ Deploy storage stack to salem-nexus
2. ⏳ Wait for salem-forge reformat
3. ⏳ Add salem-forge as Coolify remote server
4. ⏳ Deploy AI/Compute stack to salem-forge
5. ⏳ Configure Tailscale VPN between servers
6. ⏳ Test end-to-end file ingestion

---

**End of Deployment Guide**
