#!/bin/bash
# =============================================================================
# Salem Forensic Trinity - VPS3 (salem-platform) Setup Script
# =============================================================================
# Role: Prepares the VPS for hosting the MCP Tool Platform
# VPS IP: 116.203.40.1 (Public) / 10.10.0.4 (Private - TBD)
# =============================================================================

set -e

# Configuration
VPS_IP="116.203.40.1"
VPS_USER="root"
HOSTNAME="salem-platform"
COOLIFY_TOKEN="ydcRFzANLzkZbVaIO4XKaxBTgDZX5NfE1gHg2TlT8ySLfRR0fCyYNfn9osEz74P9"
COOLIFY_API_URL="https://nexus.mitechconsult.com/api/v1"

echo "============================================================================="
echo "Starting Setup for VPS3 ($HOSTNAME - $VPS_IP)"
echo "============================================================================="

# 1. SSH Check
echo "[1/6] Verifying SSH connectivity..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 $VPS_USER@$VPS_IP "echo OK" >/dev/null 2>&1; then
    echo "✅ SSH connection successful."
else
    echo "❌ SSH connection failed. Please ensure you have added your key."
    echo "Try: ssh-copy-id $VPS_USER@$VPS_IP"
    exit 1
fi

# 2. Hostname Setup
echo "[2/6] Setting hostname..."
ssh $VPS_USER@$VPS_IP "hostnamectl set-hostname $HOSTNAME && echo '✅ Hostname set to $HOSTNAME'"

# 3. System Updates & Dependencies
echo "[3/6] Updating system packages..."
ssh $VPS_USER@$VPS_IP "apt-get update && apt-get upgrade -y && apt-get install -y curl wget git ufw htop ncdu"

# 4. Docker Installation
echo "[4/6] Installing Docker..."
ssh $VPS_USER@$VPS_IP "curl -fsSL https://get.docker.com | sh"
ssh $VPS_USER@$VPS_IP "systemctl enable --now docker"

# 5. Firewall Configuration (UFW)
echo "[5/6] Configuring Firewall (UFW)..."
# Allow SSH, HTTP, HTTPS
ssh $VPS_USER@$VPS_IP "ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable"
echo "✅ Firewall enabled (22, 80, 443 allowed)."

# 6. Verify Coolify Visibility
echo "[6/6] Verifying Coolify Connectivity from Workstation..."
SERVERS=$(curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" $COOLIFY_API_URL/servers)

if echo "$SERVERS" | grep -q "$VPS_IP"; then
    echo "✅ Server $VPS_IP is already managed by Coolify."
else
    echo "⚠️  Server $VPS_IP not found in Coolify list. You may need to add it via the UI."
fi

# 7. Check Private Network
echo "[7/7] Checking Private Network..."
PRIVATE_IP=$(ssh $VPS_USER@$VPS_IP "ip addr show | grep 'inet 10.10' | awk '{print \$2}'")
if [ -n "$PRIVATE_IP" ]; then
    echo "✅ Private Network IP detected: $PRIVATE_IP"
else
    echo "⚠️  No Private Network IP detected (10.10.x.x). Please configure it in Hetzner Console."
fi

echo "============================================================================="
echo "Setup Complete! Next steps:"
echo "1. Deploy services using 'docker-compose.vps3-platform.yml'"
echo "2. Run verification checks."
echo "============================================================================="
