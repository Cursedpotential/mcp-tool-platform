#!/bin/bash
# =============================================================================
# Salem Forensic Trinity - VPS3 (salem-platform) Initial Setup
# =============================================================================
# Purpose: Prepare VPS3 for deployment and add to Coolify as remote worker
# Target: VPS3 (salem-platform) - 116.203.40.1 (10.10.0.4 private)
# Duration: ~5-10 minutes
# Prerequisites: SSH key already configured for root@116.203.40.1
# =============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS3_IP="116.203.40.1"
VPS3_HOSTNAME="salem-platform"
COOLIFY_MASTER="nexus.mitechconsult.com"
COOLIFY_API_TOKEN="2|JcKuUG0IAm5rkoSnFAXs1qMo7KTAwx5Ggt1svTr7ce5b0874"

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

print_header "Pre-flight Checks"

# Check if running from workstation (not on VPS3)
CURRENT_HOST=$(hostname)
if [[ "$CURRENT_HOST" == *"salem-platform"* ]]; then
  print_error "This script should be run from your workstation, not on VPS3!"
  exit 1
fi

print_success "Running from workstation: $CURRENT_HOST"

# Check if SSH key exists
if [ ! -f ~/.ssh/id_ed25519_hetzner ]; then
  print_error "SSH key not found: ~/.ssh/id_ed25519_hetzner"
  print_info "Make sure Hetzner SSH key is configured"
  exit 1
fi

print_success "SSH key found"

# =============================================================================
# Step 1: Accept SSH Host Key
# =============================================================================

print_header "Step 1: Accept SSH Host Key"

print_info "Connecting to VPS3 for the first time..."
print_warning "You will be prompted to accept the host key - type 'yes'"

# Remove old host key if exists
ssh-keygen -R "$VPS3_IP" 2>/dev/null || true

# Test SSH connection (will prompt for host key acceptance)
if ssh -o StrictHostKeyChecking=ask root@$VPS3_IP "echo 'Connected to VPS3'"; then
  print_success "SSH connection established"
else
  print_error "SSH connection failed"
  print_info "Verify VPS3 IP: $VPS3_IP"
  print_info "Verify SSH key: ~/.ssh/id_ed25519_hetzner"
  exit 1
fi

# =============================================================================
# Step 2: Check Private Network IP
# =============================================================================

print_header "Step 2: Verify Private Network"

print_info "Checking for Hetzner private network interface..."
PRIVATE_IP=$(ssh root@$VPS3_IP "ip addr show | grep 'inet 10.10' | awk '{print \$2}' | cut -d'/' -f1" || echo "")

if [ -z "$PRIVATE_IP" ]; then
  print_error "Private network IP not found!"
  print_warning "Expected 10.10.0.4 or similar on enp7s0 interface"
  print_info "Check Hetzner Cloud Console → Networks"
  print_info "VPS3 should be added to same private network as VPS1/VPS2"
  exit 1
fi

print_success "Private network IP: $PRIVATE_IP"

# Verify can ping VPS1 and VPS2
print_info "Testing connectivity to VPS1 (10.10.0.2)..."
if ssh root@$VPS3_IP "ping -c 2 10.10.0.2 > /dev/null 2>&1"; then
  print_success "VPS3 → VPS1 connectivity OK"
else
  print_error "Cannot ping VPS1 via private network"
fi

print_info "Testing connectivity to VPS2 (10.10.0.3)..."
if ssh root@$VPS3_IP "ping -c 2 10.10.0.3 > /dev/null 2>&1"; then
  print_success "VPS3 → VPS2 connectivity OK"
else
  print_error "Cannot ping VPS2 via private network"
fi

# =============================================================================
# Step 3: Update System
# =============================================================================

print_header "Step 3: Update System"

print_info "Updating package lists..."
ssh root@$VPS3_IP "apt-get update -qq"
print_success "Package lists updated"

print_info "Installing system updates (this may take 5-10 minutes)..."
ssh root@$VPS3_IP "DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq"
print_success "System updated"

# =============================================================================
# Step 4: Install Docker
# =============================================================================

print_header "Step 4: Install Docker"

print_info "Checking if Docker is already installed..."
if ssh root@$VPS3_IP "docker --version > /dev/null 2>&1"; then
  DOCKER_VERSION=$(ssh root@$VPS3_IP "docker --version")
  print_success "Docker already installed: $DOCKER_VERSION"
else
  print_info "Installing Docker (this may take 3-5 minutes)..."
  
  # Install prerequisites
  ssh root@$VPS3_IP "apt-get install -y -qq ca-certificates curl gnupg lsb-release"
  
  # Add Docker GPG key
  ssh root@$VPS3_IP "mkdir -p /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg"
  
  # Add Docker repository
  ssh root@$VPS3_IP "echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable\" | tee /etc/apt/sources.list.d/docker.list > /dev/null"
  
  # Install Docker
  ssh root@$VPS3_IP "apt-get update -qq && apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
  
  # Start Docker service
  ssh root@$VPS3_IP "systemctl enable docker && systemctl start docker"
  
  DOCKER_VERSION=$(ssh root@$VPS3_IP "docker --version")
  print_success "Docker installed: $DOCKER_VERSION"
fi

# Verify Docker is running
print_info "Verifying Docker service status..."
if ssh root@$VPS3_IP "systemctl is-active docker > /dev/null 2>&1"; then
  print_success "Docker service running"
else
  print_error "Docker service not running"
  ssh root@$VPS3_IP "systemctl status docker"
  exit 1
fi

# =============================================================================
# Step 5: Configure Firewall (UFW)
# =============================================================================

print_header "Step 5: Configure Firewall"

print_info "Checking if UFW is installed..."
if ! ssh root@$VPS3_IP "command -v ufw > /dev/null 2>&1"; then
  print_info "Installing UFW..."
  ssh root@$VPS3_IP "apt-get install -y -qq ufw"
fi

print_info "Configuring firewall rules..."

# Allow SSH (CRITICAL - do this first to avoid lockout)
ssh root@$VPS3_IP "ufw allow 22/tcp comment 'SSH'"
print_success "Allow SSH (22/tcp)"

# Allow HTTP/HTTPS for Traefik
ssh root@$VPS3_IP "ufw allow 80/tcp comment 'HTTP'"
ssh root@$VPS3_IP "ufw allow 443/tcp comment 'HTTPS'"
print_success "Allow HTTP/HTTPS (80/443)"

# Enable UFW (if not already enabled)
ssh root@$VPS3_IP "echo 'y' | ufw enable > /dev/null 2>&1 || true"
print_success "Firewall enabled"

# Show firewall status
print_info "Current firewall rules:"
ssh root@$VPS3_IP "ufw status numbered"

# =============================================================================
# Step 6: Add SSH Config Entry (Local)
# =============================================================================

print_header "Step 6: Update Local SSH Config"

SSH_CONFIG="$HOME/.ssh/config"

if grep -q "Host salem-platform" "$SSH_CONFIG" 2>/dev/null; then
  print_warning "salem-platform entry already exists in SSH config"
else
  print_info "Adding salem-platform to SSH config..."
  cat >> "$SSH_CONFIG" << EOF

# VPS3 (salem-platform) - Added $(date +%Y-%m-%d)
Host salem-platform
    HostName 116.203.40.1
    User root
    IdentityFile ~/.ssh/id_ed25519_hetzner
    StrictHostKeyChecking no
EOF
  print_success "SSH config updated"
fi

# Test new SSH alias
print_info "Testing SSH alias..."
if ssh salem-platform "echo 'SSH alias works'"; then
  print_success "SSH alias 'salem-platform' configured"
else
  print_error "SSH alias test failed"
fi

# =============================================================================
# Step 7: Add VPS3 to Coolify
# =============================================================================

print_header "Step 7: Add VPS3 to Coolify Master"

print_info "VPS3 is already linked to Coolify master on VPS1 (nexus)"
print_success "All 3 VPSs managed from: https://nexus.mitechconsult.com"

print_info "Verifying Coolify can see all servers..."
SERVERS=$(curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" https://nexus.mitechconsult.com/api/v1/servers | jq -r '.[] | .name' 2>/dev/null || echo "")

if echo "$SERVERS" | grep -q "salem-platform"; then
  print_success "VPS3 (salem-platform) found in Coolify"
else
  print_warning "VPS3 not yet visible in Coolify API"
  print_info "Check Coolify UI: https://nexus.mitechconsult.com"
  print_info "Servers → Verify salem-platform status is 'Healthy'"
fi

# =============================================================================
# Step 8: Summary & Next Steps
# =============================================================================

print_header "Setup Complete"

echo ""
echo "VPS3 (salem-platform) is ready for deployment!"
echo ""
echo "Configuration Summary:"
echo "  • Public IP:      116.203.40.1"
echo "  • Private IP:     $PRIVATE_IP"
echo "  • Hostname:       salem-platform"
echo "  • Docker:         $(ssh root@$VPS3_IP 'docker --version' | cut -d' ' -f3 | tr -d ',')"
echo "  • SSH Alias:      ssh salem-platform"
echo "  • Firewall:       UFW enabled (22, 80, 443)"
echo "  • Coolify:        Linked to nexus.mitechconsult.com"
echo ""
echo "Private Network Connectivity:"
echo "  • VPS1 (10.10.0.2): $(ssh root@$VPS3_IP 'ping -c 1 10.10.0.2 > /dev/null 2>&1 && echo "✓ OK" || echo "✗ Failed"')"
echo "  • VPS2 (10.10.0.3): $(ssh root@$VPS3_IP 'ping -c 1 10.10.0.3 > /dev/null 2>&1 && echo "✓ OK" || echo "✗ Failed"')"
echo ""

print_header "Next Steps"

echo "1. Deploy MCP Platform stack to VPS3:"
echo "   → Coolify UI: https://nexus.mitechconsult.com"
echo "   → Server: salem-platform"
echo "   → Use: docker-compose.vps3-platform.yml"
echo ""
echo "2. Configure environment variables:"
echo "   → Copy .env.vps3.template to .env"
echo "   → Fill in database credentials"
echo "   → Set MySQL password"
echo ""
echo "3. Migrate data from Manus hosting:"
echo "   → Follow: phase3-vps3-platform/MIGRATE_FROM_MANUS.md"
echo "   → Export Manus MySQL database"
echo "   → Import to VPS3 MySQL container"
echo ""
echo "4. Verify deployment:"
echo "   → https://app.mitechconsult.com (MCP Platform)"
echo "   → https://mcp.mitechconsult.com (MetaMCP External)"
echo ""

print_success "VPS3 Setup Script Complete!"

# =============================================================================
# Cleanup & Exit
# =============================================================================

echo ""
print_info "You can now proceed with Phase 3 deployment"
echo ""
