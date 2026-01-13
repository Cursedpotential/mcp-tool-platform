#!/bin/bash
set -e

# ============================================================================
# Cloudflare DNS & Access Setup for Salem Forensics Platform
# ============================================================================
#
# This script automates:
# 1. Cleanup of old Coolify deployment DNS records
# 2. Creation of new DNS records for VPS1 and VPS2 services
# 3. Configuration of Cloudflare Access Zero Trust policies
#
# Prerequisites:
# - Cloudflare API token with DNS:Edit and Access:Edit permissions
# - VPS1 and VPS2 public IP addresses
# - Domain: mitechconsult.com
#
# Usage:
#   ./scripts/cloudflare-setup.sh
#
# ============================================================================

# Configuration
DOMAIN="mitechconsult.com"
ZONE_ID="d543c96e4bb7fad63e5f1925dce79640"
CF_API_TOKEN="${CLOUDFLARE_API_TOKEN}"

# VPS IP addresses (set these before running)
VPS1_IP="${VPS1_IP:-}"
VPS2_IP="${VPS2_IP:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if [ -z "$CF_API_TOKEN" ]; then
        log_error "CLOUDFLARE_API_TOKEN environment variable not set"
        exit 1
    fi
    
    if [ -z "$VPS1_IP" ]; then
        log_error "VPS1_IP environment variable not set"
        exit 1
    fi
    
    if [ -z "$VPS2_IP" ]; then
        log_error "VPS2_IP environment variable not set"
        exit 1
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first."
        exit 1
    fi
    
    # Verify API token
    response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
        -H "Authorization: Bearer $CF_API_TOKEN")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        log_info "Cloudflare API token verified"
    else
        log_error "Invalid Cloudflare API token"
        exit 1
    fi
}

# ============================================================================
# DNS Record Management
# ============================================================================

list_dns_records() {
    log_info "Fetching existing DNS records..."
    curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        | jq -r '.result[] | "\(.id)\t\(.type)\t\(.name)\t\(.content)"'
}

delete_dns_record() {
    local record_id=$1
    local record_name=$2
    
    log_info "Deleting DNS record: $record_name"
    curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$record_id" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        | jq -r '.success'
}

create_dns_record() {
    local subdomain=$1
    local ip=$2
    local proxied=${3:-true}
    
    log_info "Creating DNS record: $subdomain.$DOMAIN → $ip"
    
    response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{
            \"type\": \"A\",
            \"name\": \"$subdomain\",
            \"content\": \"$ip\",
            \"ttl\": 1,
            \"proxied\": $proxied
        }")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        log_info "✓ Created $subdomain.$DOMAIN"
    else
        log_error "Failed to create $subdomain.$DOMAIN"
        echo "$response" | jq '.errors'
    fi
}

cleanup_old_records() {
    log_info "Cleaning up old Coolify deployment records..."
    
    # List of subdomains to keep (mail-related)
    keep_subdomains=("mail" "smtp" "imap" "pop3" "webmail" "autodiscover" "autoconfig")
    
    # Get all DNS records
    records=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CF_API_TOKEN")
    
    # Delete non-mail subdomains
    echo "$records" | jq -r '.result[] | select(.type == "A" or .type == "CNAME") | "\(.id)\t\(.name)"' | \
    while IFS=$'\t' read -r record_id record_name; do
        # Extract subdomain
        subdomain=$(echo "$record_name" | sed "s/\.$DOMAIN//")
        
        # Check if it's a mail-related subdomain
        if [[ " ${keep_subdomains[@]} " =~ " ${subdomain} " ]] || [[ "$subdomain" == "$DOMAIN" ]]; then
            log_info "Keeping: $record_name"
        else
            delete_dns_record "$record_id" "$record_name"
        fi
    done
}

create_vps_records() {
    log_info "Creating DNS records for VPS1 (Storage & CMS)..."
    create_dns_record "cms" "$VPS1_IP" true
    create_dns_record "photos" "$VPS1_IP" true
    create_dns_record "n8n" "$VPS1_IP" true
    
    log_info "Creating DNS records for VPS2 (AI & Compute)..."
    create_dns_record "chroma" "$VPS2_IP" true
    create_dns_record "llm" "$VPS2_IP" true
    create_dns_record "mcp" "$VPS2_IP" true
    create_dns_record "chat" "$VPS2_IP" true
    create_dns_record "ui" "$VPS2_IP" true
    create_dns_record "desktop" "$VPS2_IP" true
    create_dns_record "ollama" "$VPS2_IP" true
    create_dns_record "browser" "$VPS2_IP" true
    create_dns_record "playwright" "$VPS2_IP" true
}

# ============================================================================
# Cloudflare Access Configuration
# ============================================================================

create_access_application() {
    local name=$1
    local domain=$2
    local description=$3
    
    log_info "Creating Cloudflare Access application: $name"
    
    response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/apps" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{
            \"name\": \"$name\",
            \"domain\": \"$domain\",
            \"type\": \"self_hosted\",
            \"session_duration\": \"24h\",
            \"auto_redirect_to_identity\": true,
            \"allowed_idps\": [],
            \"app_launcher_visible\": true,
            \"enable_binding_cookie\": false,
            \"http_only_cookie_attribute\": true,
            \"same_site_cookie_attribute\": \"lax\",
            \"skip_interstitial\": false,
            \"logo_url\": \"\",
            \"description\": \"$description\"
        }")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        app_id=$(echo "$response" | jq -r '.result.id')
        log_info "✓ Created Access application: $name (ID: $app_id)"
        echo "$app_id"
    else
        log_error "Failed to create Access application: $name"
        echo "$response" | jq '.errors'
        echo ""
    fi
}

create_access_policy() {
    local app_id=$1
    local name=$2
    local email=$3
    
    log_info "Creating Access policy for $name..."
    
    response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/access/apps/$app_id/policies" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{
            \"name\": \"$name Policy\",
            \"decision\": \"allow\",
            \"include\": [
                {
                    \"email\": {
                        \"email\": \"$email\"
                    }
                }
            ],
            \"require\": [],
            \"exclude\": []
        }")
    
    if echo "$response" | jq -e '.success' > /dev/null; then
        log_info "✓ Created Access policy for $name"
    else
        log_error "Failed to create Access policy for $name"
        echo "$response" | jq '.errors'
    fi
}

setup_cloudflare_access() {
    log_warn "Cloudflare Access setup requires CF_ACCOUNT_ID and user email"
    log_warn "Please configure Access manually in Cloudflare dashboard:"
    log_warn "  1. Go to https://dash.cloudflare.com → Zero Trust → Access → Applications"
    log_warn "  2. Create applications for each service:"
    
    echo ""
    echo "VPS1 Services:"
    echo "  - cms.$DOMAIN (Directus)"
    echo "  - photos.$DOMAIN (PhotoPrism)"
    echo "  - n8n.$DOMAIN (n8n Automation)"
    
    echo ""
    echo "VPS2 Services:"
    echo "  - chat.$DOMAIN (LibreChat)"
    echo "  - ui.$DOMAIN (Open WebUI)"
    echo "  - desktop.$DOMAIN (Kasm Workspace - BACKUP ACCESS ONLY)"
    echo "  - llm.$DOMAIN (LiteLLM API)"
    echo "  - mcp.$DOMAIN (MetaMCP API)"
    echo "  - chroma.$DOMAIN (Chroma Vector DB)"
    
    echo ""
    log_warn "  3. Set authentication method: Email OTP or Google OAuth"
    log_warn "  4. Add your email to allowed users"
    log_warn "  5. Set session duration: 24 hours"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    log_info "Starting Cloudflare setup for Salem Forensics Platform"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # List existing records
    log_info "Current DNS records:"
    list_dns_records
    echo ""
    
    # Confirm cleanup
    read -p "Do you want to clean up old Coolify records? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup_old_records
        echo ""
    fi
    
    # Create new records
    read -p "Do you want to create new DNS records? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_vps_records
        echo ""
    fi
    
    # Setup Cloudflare Access
    log_info "Cloudflare Access setup instructions:"
    setup_cloudflare_access
    echo ""
    
    log_info "Cloudflare setup complete!"
    log_info "Next steps:"
    log_info "  1. Wait 1-2 minutes for DNS propagation"
    log_info "  2. Test DNS resolution: dig cms.$DOMAIN"
    log_info "  3. Deploy docker-compose on VPS1 and VPS2"
    log_info "  4. Configure Cloudflare Access in dashboard"
    log_info "  5. Test access to all services"
}

# Run main function
main
