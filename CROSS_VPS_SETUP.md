# Cross-VPS Communication Setup

**Architecture:** Two Hetzner VPS ($21/month total) connected via Tailscale

---

## VPS Overview

### VPS1 - Storage & Database Backend (8c/16GB + 50GB block)
**Hostname:** `salem-storage`  
**Tailscale tag:** `tag:salem-storage`  
**Services:**
- PostgreSQL (port 5432)
- FerretDB (port 27017)
- Directus (port 8055)
- PhotoPrism (port 2342)
- n8n (port 5678)

### VPS2 - AI & Compute Backend (8c/16GB)
**Hostname:** `salem-compute`  
**Tailscale tag:** `tag:salem-compute`  
**Services:**
- LiteLLM (port 4000)
- MetaMCP (port 4001)
- Chroma (port 8000)
- LibreChat (port 3080)
- Open WebUI (port 8080)
- Ollama (port 11434)
- Kasm Workspace (port 6901)
- Browserless (port 3000)
- Playwright (port 3000)

---

## Tailscale Setup

### 1. Install Tailscale on both VPS

```bash
# On both VPS1 and VPS2
curl -fsSL https://tailscale.com/install.sh | sh
```

### 2. Generate Auth Key

1. Go to https://login.tailscale.com/admin/settings/keys
2. Generate new auth key with tags: `tag:salem-storage,tag:salem-compute`
3. Set expiration: Never
4. Enable reusable: Yes
5. Copy key to `.env` files on both VPS

### 3. Start Tailscale

```bash
# VPS1
tailscale up --authkey=YOUR_AUTH_KEY --advertise-tags=tag:salem-storage --hostname=salem-storage

# VPS2
tailscale up --authkey=YOUR_AUTH_KEY --advertise-tags=tag:salem-compute --hostname=salem-compute
```

### 4. Verify Connection

```bash
# On VPS1
tailscale ping salem-compute

# On VPS2
tailscale ping salem-storage
```

---

## Service Communication

### VPS2 → VPS1 (Compute accessing Storage)

**LibreChat → FerretDB (MongoDB):**
```yaml
# In docker-compose.vps2-compute.yml
librechat:
  environment:
    - MONGO_URI=mongodb://salem-storage:27017/LibreChat
```

**MetaMCP → PostgreSQL:**
```yaml
# In docker-compose.vps2-compute.yml
metamcp:
  environment:
    - POSTGRES_URL=postgres://postgres:password@salem-storage:5432/salem
```

**Platform (Manus app) → PostgreSQL:**
```typescript
// In your Manus app server/_core/env.ts
DATABASE_URL=postgres://postgres:password@salem-storage:5432/salem
```

### VPS1 → VPS2 (Storage accessing Compute)

**n8n → LiteLLM:**
```yaml
# In n8n workflow
HTTP Request Node:
  URL: http://salem-compute:4000/v1/chat/completions
  Headers:
    Authorization: Bearer ${LITELLM_MASTER_KEY}
```

**Directus → LiteLLM (for AI extensions):**
```javascript
// In Directus extension
const response = await fetch('http://salem-compute:4000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.LITELLM_MASTER_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Analyze this document' }]
  })
});
```

---

## DNS Resolution

Tailscale provides automatic DNS resolution:

- `salem-storage` → VPS1 Tailscale IP
- `salem-compute` → VPS2 Tailscale IP

**No need to hardcode IPs!** Services can use hostnames directly.

---

## Firewall Rules

### VPS1 Firewall (Storage)
```bash
# Allow from Tailscale network only
ufw allow in on tailscale0 to any port 5432  # PostgreSQL
ufw allow in on tailscale0 to any port 27017 # FerretDB
ufw allow in on tailscale0 to any port 8055  # Directus (internal API)
ufw allow in on tailscale0 to any port 5678  # n8n (internal API)

# Allow public HTTPS (Traefik)
ufw allow 443/tcp

# Deny direct public access to services
ufw deny 5432/tcp
ufw deny 27017/tcp
```

### VPS2 Firewall (Compute)
```bash
# Allow from Tailscale network only
ufw allow in on tailscale0 to any port 4000  # LiteLLM
ufw allow in on tailscale0 to any port 4001  # MetaMCP
ufw allow in on tailscale0 to any port 8000  # Chroma
ufw allow in on tailscale0 to any port 6901  # Kasm

# Allow public HTTPS (Traefik)
ufw allow 443/tcp

# Deny direct public access to services
ufw deny 4000/tcp
ufw deny 4001/tcp
ufw deny 8000/tcp
ufw deny 6901/tcp
```

---

## Health Checks

### Check Cross-VPS Communication

```bash
# On VPS2, test PostgreSQL connection to VPS1
docker run --rm --network salem-network postgres:16-alpine \
  psql -h salem-storage -U postgres -d salem -c "SELECT 1"

# On VPS1, test LiteLLM connection to VPS2
curl -X POST http://salem-compute:4000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}'
```

---

## Troubleshooting

### Service can't reach other VPS

1. **Check Tailscale status:**
   ```bash
   tailscale status
   ```

2. **Verify DNS resolution:**
   ```bash
   ping salem-storage  # From VPS2
   ping salem-compute  # From VPS1
   ```

3. **Check Docker network:**
   ```bash
   docker network inspect salem-network
   ```

4. **Test direct connection:**
   ```bash
   # From VPS2
   telnet salem-storage 5432
   ```

### Slow cross-VPS communication

1. **Check Tailscale latency:**
   ```bash
   tailscale ping salem-storage
   ```

2. **Enable direct connections (DERP relay bypass):**
   - Ensure both VPS have public IPs
   - Tailscale will automatically use direct connection if possible

3. **Monitor bandwidth:**
   ```bash
   iftop -i tailscale0
   ```

---

## Backup Strategy

### VPS1 → R2 (Nightly at 2am)

Automated via infrastructure sidecar:
- PostgreSQL dump → R2
- `/data/media` → R2
- Directus config → R2

### VPS2 → Local Volumes

No backup needed (stateless services):
- Chroma data (can rebuild from PostgreSQL)
- Ollama models (can re-download)
- Kasm home (ephemeral)

---

## Monitoring

### Cross-VPS Latency

```bash
# Add to cron on both VPS
*/5 * * * * tailscale ping salem-storage >> /var/log/tailscale-latency.log
```

### Service Health

```bash
# Add to n8n workflow (every 5 minutes)
# Check all services via HTTP health endpoints
# Alert if any service is down
```

---

## Cost Breakdown

**Hetzner VPS:**
- VPS1 (8c/16GB): $10.50/month
- VPS2 (8c/16GB): $10.50/month
- Block storage (50GB): $3/month
- **Total:** $24/month

**Tailscale:**
- Free tier (up to 100 devices)

**AWS S3 (LiteLLM cache):**
- Free tier (5GB, 12 months)
- After free tier: ~$0.12/month

**Cloudflare:**
- Free tier (DNS + Access)

**R2 (Backup):**
- Free tier (10GB)
- After free tier: ~$0.30/month

**Grand total:** ~$24.50/month (after free tiers expire)

---

## Next Steps

1. Deploy VPS1 services: `docker-compose -f docker-compose.vps1-storage.yml up -d`
2. Deploy VPS2 services: `docker-compose -f docker-compose.vps2-compute.yml up -d`
3. Test cross-VPS communication (see Health Checks)
4. Configure Cloudflare DNS (see CLOUDFLARE_SETUP.md)
5. Set up monitoring and alerts
