# Salem Forensics Platform - Deployment Guide

**Architecture:** Two Hetzner VPS ($21/month total) with Cloudflare Zero Trust

---

## Overview

The Salem Forensics Platform is deployed across two Hetzner VPS instances:

- **VPS1 (Storage & CMS):** PostgreSQL, Directus, PhotoPrism, n8n
- **VPS2 (AI & Compute):** LiteLLM, MetaMCP, Chroma, LibreChat, Open WebUI, Ollama, Kasm

Both VPS are connected via Tailscale for secure cross-VPS communication and protected by Cloudflare Access for public access.

---

## Prerequisites

### Accounts & Services
- [x] Hetzner Cloud account
- [x] Cloudflare account with domain (mitechconsult.com)
- [x] Tailscale account
- [x] AWS account (S3 free tier for LiteLLM cache)
- [x] R2 account (Cloudflare R2 for backups)
- [x] LLM API keys (OpenAI, Anthropic, Gemini, etc.)

### Local Tools
```bash
# Install required tools
brew install jq curl git docker
```

---

## Step 1: Create Hetzner VPS Instances

### VPS1 - Storage & Database (8c/16GB + 50GB block storage)

```bash
# Create VPS1
hcloud server create \
  --name salem-storage \
  --type cpx31 \
  --image ubuntu-22.04 \
  --ssh-key your-ssh-key \
  --location nbg1

# Create and attach block storage
hcloud volume create \
  --name salem-storage-data \
  --size 50 \
  --server salem-storage \
  --automount \
  --format ext4

# Get VPS1 IP
VPS1_IP=$(hcloud server ip salem-storage)
echo "VPS1 IP: $VPS1_IP"
```

### VPS2 - AI & Compute (8c/16GB)

```bash
# Create VPS2
hcloud server create \
  --name salem-compute \
  --type cpx31 \
  --image ubuntu-22.04 \
  --ssh-key your-ssh-key \
  --location nbg1

# Get VPS2 IP
VPS2_IP=$(hcloud server ip salem-compute)
echo "VPS2 IP: $VPS2_IP"
```

---

## Step 2: Install Docker & Docker Compose

Run on **both VPS1 and VPS2**:

```bash
# SSH into VPS
ssh root@<VPS_IP>

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

---

## Step 3: Setup Tailscale

### Generate Auth Key

1. Go to https://login.tailscale.com/admin/settings/keys
2. Generate new auth key:
   - **Reusable:** Yes
   - **Ephemeral:** No
   - **Tags:** `tag:salem-storage,tag:salem-compute`
   - **Expiration:** Never
3. Copy the auth key

### Install Tailscale on VPS1

```bash
ssh root@$VPS1_IP

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale
tailscale up --authkey=YOUR_AUTH_KEY --advertise-tags=tag:salem-storage --hostname=salem-storage

# Verify
tailscale status
```

### Install Tailscale on VPS2

```bash
ssh root@$VPS2_IP

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale
tailscale up --authkey=YOUR_AUTH_KEY --advertise-tags=tag:salem-compute --hostname=salem-compute

# Verify
tailscale status
```

### Test Cross-VPS Communication

```bash
# On VPS1
ping salem-compute

# On VPS2
ping salem-storage
```

---

## Step 4: Configure Environment Variables

### VPS1 Environment (.env)

```bash
# On VPS1
cat > /root/salem/.env <<EOF
# Domain
DOMAIN=mitechconsult.com

# Tailscale
TAILSCALE_AUTH_KEY=YOUR_TAILSCALE_AUTH_KEY

# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=salem

# Directus
DIRECTUS_ADMIN_EMAIL=your-email@example.com
DIRECTUS_ADMIN_PASSWORD=$(openssl rand -base64 24)
DIRECTUS_KEY=$(openssl rand -base64 32)
DIRECTUS_SECRET=$(openssl rand -base64 32)

# PhotoPrism
PHOTOPRISM_ADMIN_USER=admin
PHOTOPRISM_ADMIN_PASSWORD=$(openssl rand -base64 24)

# n8n
N8N_USER=admin
N8N_PASSWORD=$(openssl rand -base64 24)

# R2 Backup
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
R2_BUCKET=salem-backups
EOF
```

### VPS2 Environment (.env)

```bash
# On VPS2
cat > /root/salem/.env <<EOF
# Domain
DOMAIN=mitechconsult.com

# Tailscale
TAILSCALE_AUTH_KEY=YOUR_TAILSCALE_AUTH_KEY

# PostgreSQL (VPS1)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<same-as-vps1>
POSTGRES_DB=salem

# Chroma
CHROMA_AUTH_TOKEN=$(openssl rand -base64 32)

# LiteLLM
LITELLM_MASTER_KEY=$(openssl rand -base64 32)

# AWS S3 Cache (free tier)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_CACHE_BUCKET=salem-litellm-cache

# LLM API Keys
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GEMINI_API_KEY=your-gemini-key
COHERE_API_KEY=your-cohere-key
OPENROUTER_API_KEY=your-openrouter-key
GROQ_API_KEY=your-groq-key

# Open WebUI
OPENWEBUI_SECRET_KEY=$(openssl rand -base64 32)

# Kasm Workspace
KASM_VNC_PASSWORD=$(openssl rand -base64 16)

# Browserless
BROWSERLESS_TOKEN=$(openssl rand -base64 32)
EOF
```

---

## Step 5: Deploy Services

### Deploy VPS1 (Storage & CMS)

```bash
# On VPS1
mkdir -p /root/salem
cd /root/salem

# Copy docker-compose file
scp docker-compose.vps1-storage.yml root@$VPS1_IP:/root/salem/docker-compose.yml

# Mount block storage
mkdir -p /mnt/block-storage
mount /dev/disk/by-id/scsi-0HC_Volume_* /mnt/block-storage

# Add to fstab for persistence
echo "/dev/disk/by-id/scsi-0HC_Volume_* /mnt/block-storage ext4 discard,nofail,defaults 0 0" >> /etc/fstab

# Create directories
mkdir -p /mnt/block-storage/media
mkdir -p /mnt/block-storage/postgres
mkdir -p /mnt/block-storage/photoprism

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Deploy VPS2 (AI & Compute)

```bash
# On VPS2
mkdir -p /root/salem
cd /root/salem

# Copy docker-compose file
scp docker-compose.vps2-compute.yml root@$VPS2_IP:/root/salem/docker-compose.yml

# Copy additional files
scp litellm_config.yaml root@$VPS2_IP:/root/salem/
scp Dockerfile.* root@$VPS2_IP:/root/salem/

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

---

## Step 6: Configure Cloudflare DNS & Access

### Setup DNS Records

```bash
# Set environment variables
export CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
export VPS1_IP=<vps1-ip>
export VPS2_IP=<vps2-ip>

# Run Cloudflare setup script
./scripts/cloudflare-setup.sh
```

### Configure Cloudflare Access (Manual)

1. Go to https://dash.cloudflare.com → Zero Trust → Access → Applications
2. Create applications for each service:

**VPS1 Services:**
- `cms.mitechconsult.com` (Directus)
- `photos.mitechconsult.com` (PhotoPrism)
- `n8n.mitechconsult.com` (n8n)

**VPS2 Services:**
- `chat.mitechconsult.com` (LibreChat)
- `ui.mitechconsult.com` (Open WebUI)
- `desktop.mitechconsult.com` (Kasm - Backup access only)

3. Set authentication method: **Email OTP** or **Google OAuth**
4. Add your email to allowed users
5. Set session duration: **24 hours**

---

## Step 7: Verify Deployment

### Test DNS Resolution

```bash
dig cms.mitechconsult.com
dig chat.mitechconsult.com
```

### Test Service Access

**Via Cloudflare (Public):**
- https://cms.mitechconsult.com (Directus)
- https://photos.mitechconsult.com (PhotoPrism)
- https://n8n.mitechconsult.com (n8n)
- https://chat.mitechconsult.com (LibreChat)
- https://ui.mitechconsult.com (Open WebUI)

**Via Tailscale (Private):**
```bash
# From any device on Tailnet
curl http://salem-storage:8055  # Directus
curl http://salem-compute:4000/health  # LiteLLM
```

### Test Cross-VPS Communication

```bash
# On VPS2, test PostgreSQL connection to VPS1
docker exec -it salem-librechat sh -c "nc -zv salem-storage 5432"
```

---

## Step 8: Configure Manus Platform

### Update Platform Environment

```bash
# In your Manus app .env
DATABASE_URL=postgres://postgres:password@salem-storage:5432/salem
LITELLM_API_URL=http://salem-compute:4000
LITELLM_API_KEY=your-litellm-master-key
CHROMA_API_URL=http://salem-compute:8000
CHROMA_AUTH_TOKEN=your-chroma-token
```

### Deploy Platform

```bash
# In Manus dashboard
# Click "Publish" button after creating checkpoint
```

---

## Monitoring & Maintenance

### Check Service Health

```bash
# VPS1
ssh root@$VPS1_IP
cd /root/salem
docker-compose ps
docker-compose logs --tail=50

# VPS2
ssh root@$VPS2_IP
cd /root/salem
docker-compose ps
docker-compose logs --tail=50
```

### Monitor Resources

```bash
# Check disk usage
df -h /mnt/block-storage

# Check memory
free -h

# Check Docker stats
docker stats
```

### Backup Verification

```bash
# Check R2 backups (runs nightly at 2am)
docker exec salem-vps1-infrastructure rclone ls r2:salem-backups/vps1
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Restart service
docker-compose restart <service-name>

# Rebuild service
docker-compose up -d --force-recreate <service-name>
```

### Cross-VPS Communication Fails

```bash
# Check Tailscale status
tailscale status

# Restart Tailscale
systemctl restart tailscaled

# Check DNS resolution
ping salem-storage
ping salem-compute
```

### Cloudflare Access Not Working

1. Check DNS is proxied (orange cloud in Cloudflare dashboard)
2. Verify Access application is enabled
3. Check user email is in allowed list
4. Clear browser cookies and try again

---

## Cost Breakdown

**Monthly Costs:**
- Hetzner VPS1 (8c/16GB): $10.50
- Hetzner VPS2 (8c/16GB): $10.50
- Block storage (50GB): $3.00
- AWS S3 cache (5GB): $0.00 (free tier, 12 months)
- R2 backups (10GB): $0.00 (free tier)
- Cloudflare DNS + Access: $0.00 (free tier)
- Tailscale: $0.00 (free tier)

**Total:** $24/month

---

## Next Steps

1. ✅ Deploy infrastructure
2. ✅ Configure Cloudflare Access
3. [ ] Upload forensic data to Directus
4. [ ] Create n8n workflows for preprocessing
5. [ ] Test end-to-end pipeline (upload → process → analyze)
6. [ ] Build case analysis workflows in platform
7. [ ] Train team on platform usage

---

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review documentation: `docs/`
- Contact: your-email@example.com
