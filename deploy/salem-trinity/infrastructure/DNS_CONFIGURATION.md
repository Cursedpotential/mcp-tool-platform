# DNS Configuration - Salem Forensic Trinity

**Domain**: mitechconsult.com  
**Total Subdomains**: 14  
**DNS Provider**: (User to configure)  
**TTL Recommendation**: 3600 (1 hour) for all A records  

---

## Overview

The Salem Forensic Trinity requires 14 DNS A records pointing to 3 different VPS IP addresses. Each service gets its own subdomain for:
- Clean SSL certificate management (one cert per subdomain)
- Service isolation
- Easy service migration (change DNS without changing URLs)
- Professional appearance

**Architecture**:
```
mitechconsult.com
├── nexus.mitechconsult.com     → VPS1 (Coolify Master)
├── files.mitechconsult.com     → VPS1 (Directus)
├── photos.mitechconsult.com    → VPS1 (PhotoPrism)
├── n8n.mitechconsult.com       → VPS1 (n8n)
├── chat.mitechconsult.com      → VPS1 (LibreChat)
├── ui.mitechconsult.com        → VPS1 (Open-WebUI)
├── llm.mitechconsult.com       → VPS2 (LiteLLM)
├── chroma.mitechconsult.com    → VPS2 (ChromaDB)
├── ollama.mitechconsult.com    → VPS2 (Ollama)
├── desktop.mitechconsult.com   → VPS2 (Kasm)
├── browser.mitechconsult.com   → VPS2 (Browserless)
├── playwright.mitechconsult.com → VPS2 (Playwright)
├── app.mitechconsult.com       → VPS3 (MCP Platform)
└── mcp.mitechconsult.com       → VPS3 (MetaMCP External)
```

---

## DNS A Records (Complete List)

### VPS1 Records (salem-nexus: 188.245.189.218)

| Subdomain | Type | Name | Value | TTL | Purpose |
|-----------|------|------|-------|-----|---------|
| nexus.mitechconsult.com | A | nexus | 188.245.189.218 | 3600 | Coolify Master UI |
| files.mitechconsult.com | A | files | 188.245.189.218 | 3600 | Directus File Vault |
| photos.mitechconsult.com | A | photos | 188.245.189.218 | 3600 | PhotoPrism Gallery |
| n8n.mitechconsult.com | A | n8n | 188.245.189.218 | 3600 | n8n Workflow Automation |
| chat.mitechconsult.com | A | chat | 188.245.189.218 | 3600 | LibreChat AI Interface |
| ui.mitechconsult.com | A | ui | 188.245.189.218 | 3600 | Open-WebUI LLM Interface |

**Total VPS1 subdomains**: 6

---

### VPS2 Records (salem-forge: 116.203.198.77)

| Subdomain | Type | Name | Value | TTL | Purpose |
|-----------|------|------|-------|-----|---------|
| llm.mitechconsult.com | A | llm | 116.203.198.77 | 3600 | LiteLLM Gateway |
| chroma.mitechconsult.com | A | chroma | 116.203.198.77 | 3600 | ChromaDB Vector Store |
| ollama.mitechconsult.com | A | ollama | 116.203.198.77 | 3600 | Ollama Embeddings |
| desktop.mitechconsult.com | A | desktop | 116.203.198.77 | 3600 | Kasm Workspaces |
| browser.mitechconsult.com | A | browser | 116.203.198.77 | 3600 | Browserless Headless Chrome |
| playwright.mitechconsult.com | A | playwright | 116.203.198.77 | 3600 | Playwright Automation |

**Total VPS2 subdomains**: 6

---

### VPS3 Records (salem-platform: 116.203.40.1)

| Subdomain | Type | Name | Value | TTL | Purpose |
|-----------|------|------|-------|-----|---------|
| app.mitechconsult.com | A | app | 116.203.40.1 | 3600 | MCP Platform Main App |
| mcp.mitechconsult.com | A | mcp | 116.203.40.1 | 3600 | MetaMCP External Gateway |

**Total VPS3 subdomains**: 2

---

## DNS Provider Setup Instructions

### Cloudflare

1. Log in to Cloudflare dashboard
2. Select domain: `mitechconsult.com`
3. Go to **DNS** > **Records**
4. For each record above:
   - Click **Add record**
   - Type: `A`
   - Name: `<subdomain>` (e.g., `nexus`)
   - IPv4 address: `<VPS IP>` (e.g., `188.245.189.218`)
   - Proxy status: **DNS only** (gray cloud, NOT proxied)
   - TTL: `Auto` or `3600`
   - Click **Save**
5. Repeat for all 14 records

**IMPORTANT**: Set proxy status to "DNS only" (gray cloud). Cloudflare proxying will interfere with Traefik SSL certificate issuance.

---

### Namecheap

1. Log in to Namecheap account
2. Go to **Domain List** > Select `mitechconsult.com`
3. Click **Manage** > **Advanced DNS** tab
4. For each record:
   - Click **Add New Record**
   - Type: `A Record`
   - Host: `<subdomain>` (e.g., `nexus`)
   - Value: `<VPS IP>` (e.g., `188.245.189.218`)
   - TTL: `1 hour` (3600 seconds)
   - Click **Save All Changes**
5. Repeat for all 14 records

---

### GoDaddy

1. Log in to GoDaddy account
2. Go to **My Products** > **DNS** for `mitechconsult.com`
3. For each record:
   - Click **Add**
   - Type: `A`
   - Name: `<subdomain>` (e.g., `nexus`)
   - Value: `<VPS IP>` (e.g., `188.245.189.218`)
   - TTL: `1 Hour` (3600 seconds)
   - Click **Save**
4. Repeat for all 14 records

---

### Google Domains (now Squarespace)

1. Log in to Squarespace Domains (formerly Google Domains)
2. Select `mitechconsult.com`
3. Go to **DNS** > **Manage custom records**
4. For each record:
   - Click **Add record**
   - Type: `A`
   - Host: `<subdomain>` (e.g., `nexus`)
   - Data: `<VPS IP>` (e.g., `188.245.189.218`)
   - TTL: `3600`
   - Click **Save**
5. Repeat for all 14 records

---

### Generic DNS Provider

If your provider is not listed above, use these general steps:

1. Access DNS management panel for `mitechconsult.com`
2. Create 14 **A records** with the following pattern:
   - **Record Type**: A
   - **Hostname/Name**: `<subdomain>` (without the domain)
   - **Points To/Value**: `<VPS IP address>`
   - **TTL**: `3600` (1 hour)
3. Save changes
4. Wait for DNS propagation (typically 5-60 minutes)

---

## Verification Commands

After adding all DNS records, verify propagation:

### Check Single Record
```bash
# Replace <subdomain> with actual subdomain
nslookup nexus.mitechconsult.com
dig nexus.mitechconsult.com +short
host nexus.mitechconsult.com
```

**Expected output**: The VPS IP address (e.g., `188.245.189.218`)

### Check All VPS1 Records
```bash
for sub in nexus files photos n8n chat ui; do
  echo "Checking $sub.mitechconsult.com"
  dig +short $sub.mitechconsult.com
done
```

**Expected output**: All should return `188.245.189.218`

### Check All VPS2 Records
```bash
for sub in llm chroma ollama desktop browser playwright; do
  echo "Checking $sub.mitechconsult.com"
  dig +short $sub.mitechconsult.com
done
```

**Expected output**: All should return `116.203.198.77`

### Check All VPS3 Records
```bash
for sub in app mcp; do
  echo "Checking $sub.mitechconsult.com"
  dig +short $sub.mitechconsult.com
done
```

**Expected output**: All should return `116.203.40.1`

### Full Verification Script

Save as `verify-dns.sh`:
```bash
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Salem Forensic Trinity DNS Verification"
echo "========================================"
echo ""

# VPS1 Records
echo "VPS1 (188.245.189.218) Subdomains:"
for sub in nexus files photos n8n chat ui; do
  result=$(dig +short $sub.mitechconsult.com | head -n 1)
  if [ "$result" == "188.245.189.218" ]; then
    echo -e "${GREEN}✓${NC} $sub.mitechconsult.com → $result"
  else
    echo -e "${RED}✗${NC} $sub.mitechconsult.com → $result (expected 188.245.189.218)"
  fi
done

echo ""

# VPS2 Records
echo "VPS2 (116.203.198.77) Subdomains:"
for sub in llm chroma ollama desktop browser playwright; do
  result=$(dig +short $sub.mitechconsult.com | head -n 1)
  if [ "$result" == "116.203.198.77" ]; then
    echo -e "${GREEN}✓${NC} $sub.mitechconsult.com → $result"
  else
    echo -e "${RED}✗${NC} $sub.mitechconsult.com → $result (expected 116.203.198.77)"
  fi
done

echo ""

# VPS3 Records
echo "VPS3 (116.103.40.1) Subdomains:"
for sub in app mcp; do
  result=$(dig +short $sub.mitechconsult.com | head -n 1)
  if [ "$result" == "116.203.40.1" ]; then
    echo -e "${GREEN}✓${NC} $sub.mitechconsult.com → $result"
  else
    echo -e "${RED}✗${NC} $sub.mitechconsult.com → $result (expected 116.203.40.1)"
  fi
done

echo ""
echo "Verification complete!"
```

Run: `bash verify-dns.sh`

---

## DNS Propagation

**Typical Propagation Time**:
- **Local DNS cache**: 0-5 minutes
- **ISP DNS servers**: 5-30 minutes
- **Global propagation**: 1-24 hours (rarely more than 4 hours)

**Check Propagation Globally**:
- https://dnschecker.org
- Enter: `nexus.mitechconsult.com` (or any subdomain)
- Type: `A`
- Click **Search**
- Verify all global locations show correct IP

---

## SSL Certificate Issuance

After DNS propagation, Traefik (via Coolify) will automatically request SSL certificates from Let's Encrypt.

### How It Works

1. **DNS propagates** (subdomain resolves to VPS IP)
2. **HTTP request hits VPS** (user visits `https://nexus.mitechconsult.com`)
3. **Traefik intercepts request** (running on VPS)
4. **Traefik checks for cert** (first time = none exists)
5. **Traefik requests cert from Let's Encrypt** (ACME protocol)
6. **Let's Encrypt validates domain ownership** (HTTP-01 or TLS-ALPN-01 challenge)
7. **Traefik saves cert** (stores in Coolify volume)
8. **HTTPS enabled** (subsequent requests use SSL)

### Certificate Verification

Check SSL certificate status:
```bash
# Check certificate details
openssl s_client -connect nexus.mitechconsult.com:443 -servername nexus.mitechconsult.com < /dev/null 2>/dev/null | openssl x509 -noout -dates

# Quick test
curl -I https://nexus.mitechconsult.com
```

**Expected**: Should return HTTP 200/301/302 with SSL handshake successful

### Troubleshooting SSL Issues

**Issue**: Certificate not issued after DNS propagation

**Causes**:
1. DNS not fully propagated (wait 30 more minutes)
2. Port 80/443 blocked by firewall (check UFW rules)
3. Cloudflare proxy enabled (must be "DNS only")
4. Let's Encrypt rate limit hit (5 certs/week per domain)

**Fix**:
1. Verify DNS: `dig +short nexus.mitechconsult.com` (should return VPS IP)
2. Check port 80/443: `sudo ufw status` (should allow from anywhere)
3. Check Traefik logs in Coolify: Look for ACME errors
4. Wait 1 hour and retry if rate limited

---

## Service-Specific DNS Notes

### Coolify Master (nexus.mitechconsult.com)
- **Critical**: Must be accessible for remote worker management
- **Port requirements**: 80, 443, 8000 (API)
- **SSL**: Required for secure remote deployments

### Directus (files.mitechconsult.com)
- **File uploads**: Large files may timeout (increase Traefik timeout if needed)
- **S3 backend**: Directus can use S3-compatible storage (optional)

### LibreChat (chat.mitechconsult.com)
- **Depends on**: FerretDB (Phase 1 fix required)
- **SSL required**: OAuth providers require HTTPS

### ChromaDB (chroma.mitechconsult.com)
- **Authentication**: API key required (set in .env.vps2)
- **CORS**: May need configuration for browser access

### MCP Platform (app.mitechconsult.com)
- **Primary app**: Main user-facing interface
- **Database**: Connects to MySQL on VPS3 (internal, no DNS needed)
- **Storage**: Connects to Postgres (VPS1), Neo4j Aura, Chroma (VPS2)

---

## Optional: Wildcard Certificate

Instead of individual certificates per subdomain, you can use a wildcard certificate for `*.mitechconsult.com`.

**Pros**:
- Single certificate for all subdomains
- No per-subdomain Let's Encrypt requests

**Cons**:
- Requires DNS-01 challenge (need DNS provider API access)
- More complex Traefik configuration
- If compromised, affects all subdomains

**Recommendation**: Stick with individual certificates for now. Wildcard can be added later if needed.

---

## DNS Security Considerations

### DNSSEC
Consider enabling DNSSEC for `mitechconsult.com` to prevent DNS spoofing:
- Check if your DNS provider supports DNSSEC
- Enable in DNS provider settings
- Add DS records to domain registrar

### CAA Records
Add CAA records to restrict which Certificate Authorities can issue certs:
```
mitechconsult.com.  CAA  0 issue "letsencrypt.org"
mitechconsult.com.  CAA  0 issuewild "letsencrypt.org"
```

This ensures only Let's Encrypt can issue certificates for your domain.

---

## Change Management

### Adding New Service
1. Deploy service to VPS (via Coolify)
2. Choose subdomain (e.g., `monitor.mitechconsult.com`)
3. Add DNS A record pointing to VPS IP
4. Wait for propagation (5-30 min)
5. Traefik auto-issues SSL cert
6. Service accessible via HTTPS

### Moving Service to Different VPS
1. Update DNS A record with new VPS IP
2. Wait for propagation
3. Old VPS traffic stops automatically
4. New VPS Traefik issues new SSL cert

**Downtime**: Typically 0-5 minutes (during DNS propagation)

---

## DNS Troubleshooting

### Record Not Resolving

**Symptom**: `dig nexus.mitechconsult.com` returns no IP

**Checks**:
1. Verify record added in DNS provider UI
2. Check for typos in subdomain name
3. Wait 30 more minutes (propagation delay)
4. Clear local DNS cache: 
   - Windows: `ipconfig /flushdns`
   - macOS: `sudo dscacheutil -flushcache`
   - Linux: `sudo systemd-resolve --flush-caches`

### Wrong IP Address

**Symptom**: DNS resolves to old/wrong IP

**Checks**:
1. Verify correct IP in DNS provider UI
2. Check TTL (may need to wait for old record to expire)
3. Query authoritative nameserver directly:
   ```bash
   dig nexus.mitechconsult.com @ns1.your-dns-provider.com
   ```

### Intermittent Resolution

**Symptom**: Sometimes resolves correctly, sometimes doesn't

**Causes**:
1. Multiple A records with different IPs (remove duplicates)
2. Load balancer/CDN interference (disable if not needed)
3. Local DNS cache poisoning (flush cache)

---

## Post-Deployment DNS Tasks

1. **Monitor DNS health**: Set up uptime monitoring (UptimeRobot, Pingdom)
2. **Enable DNSSEC**: Improve security (if provider supports)
3. **Add CAA records**: Restrict certificate issuance to Let's Encrypt
4. **Document changes**: Update this file when adding new subdomains
5. **Review quarterly**: Audit DNS records for unused subdomains

---

## Quick Reference Table

| VPS | IP | Subdomain Count | Subdomains |
|-----|-----|----------------|-----------|
| VPS1 (salem-nexus) | 188.245.189.218 | 6 | nexus, files, photos, n8n, chat, ui |
| VPS2 (salem-forge) | 116.203.198.77 | 6 | llm, chroma, ollama, desktop, browser, playwright |
| VPS3 (salem-platform) | 116.203.40.1 | 2 | app, mcp |
| **TOTAL** | - | **14** | - |

---

## Contact Information

**DNS Issues**: Contact your DNS provider support  
**SSL Issues**: Check Coolify/Traefik logs, then Hetzner firewall rules  
**General Questions**: Refer to MASTER_DEPLOYMENT_GUIDE.md  

---

**End of DNS Configuration Guide**

Next: Run `verify-dns.sh` after adding all records to confirm propagation.
