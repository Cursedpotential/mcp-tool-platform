#!/bin/bash
# =============================================================================
# Salem Forensic Trinity - Cross-VPS Firewall Configuration
# =============================================================================
# Purpose: Configure UFW on all 3 VPSs for secure communication
# Strategy: 
# 1. Allow public SSH, HTTP, HTTPS
# 2. Allow all traffic on the private network (10.10.0.0/16)
# 3. Deny everything else
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
  echo -e "${BLUE}========================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}========================================${NC}"
}

# VPS IPs
VPS1_PUBLIC="188.245.189.218"
VPS2_PUBLIC="116.203.198.77"
VPS3_PUBLIC="116.203.40.1"

PRIVATE_SUBNET="10.10.0.0/16"

# Script to run on each VPS
UFW_COMMANDS=$(cat <<EOF
# 1. Default Policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 2. Public Services
sudo ufw allow 22/tcp comment 'Public SSH'
sudo ufw allow 80/tcp comment 'Public HTTP'
sudo ufw allow 443/tcp comment 'Public HTTPS'
sudo ufw allow 8000/tcp comment 'Coolify API'

# 3. Private Network (CRITICAL)
# Allow all traffic from the private subnet (Free bandwidth, secure)
sudo ufw allow from $PRIVATE_SUBNET comment 'Hetzner Private Network'

# 4. Enable UFW
echo "y" | sudo ufw enable
sudo ufw status numbered
EOF
)

# Apply to VPS1
print_header "Configuring Firewall on VPS1 (salem-nexus)"
ssh root@$VPS1_PUBLIC "$UFW_COMMANDS"
echo -e "${GREEN}VPS1 Complete${NC}\n"

# Apply to VPS2
print_header "Configuring Firewall on VPS2 (salem-forge)"
ssh root@$VPS2_PUBLIC "$UFW_COMMANDS"
echo -e "${GREEN}VPS2 Complete${NC}\n"

# Apply to VPS3
print_header "Configuring Firewall on VPS3 (salem-platform)"
ssh root@$VPS3_PUBLIC "$UFW_COMMANDS"
echo -e "${GREEN}VPS3 Complete${NC}\n"

print_header "Firewall Configuration Summary"
echo "All 3 VPSs are now secured."
echo "Public access: SSH (22), HTTP (80), HTTPS (443), Coolify (8000)"
echo "Private access: Full access for all VPSs on 10.10.0.x"
