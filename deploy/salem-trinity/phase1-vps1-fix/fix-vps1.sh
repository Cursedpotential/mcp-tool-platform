#!/bin/bash
# =============================================================================
# Salem Forensic Trinity - VPS1 Postgres Fix Automation Script
# =============================================================================
# Purpose: Install all required Postgres extension packages and apply SQL script
# Target: VPS1 (salem-nexus) - 188.245.189.218 (10.10.0.2 private)
# Impact: Fixes missing 32/34 extensions, enables LibreChat, System Router
# Duration: ~10-15 minutes (includes Postgres restart)
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
POSTGRES_CONTAINER=""
POSTGRES_USER="postgres"
SQL_SCRIPT="vps1-postgres-fix.sql"

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

# Check if running on VPS1
HOSTNAME=$(hostname)
if [[ "$HOSTNAME" != *"salem"* ]]; then
  print_warning "Not running on VPS1 hostname. Current: $HOSTNAME"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Find Postgres container
print_info "Searching for Postgres container..."
POSTGRES_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i postgres | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
  print_error "Postgres container not found!"
  echo "Available containers:"
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
  exit 1
fi

print_success "Found Postgres container: $POSTGRES_CONTAINER"

# Check if SQL script exists
if [ ! -f "$SQL_SCRIPT" ]; then
  print_error "SQL script not found: $SQL_SCRIPT"
  print_info "Make sure vps1-postgres-fix.sql is in the same directory"
  exit 1
fi

print_success "SQL script found: $SQL_SCRIPT"

# Check current extension count
CURRENT_EXTENSIONS=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT COUNT(*) FROM pg_extension;" | xargs)
print_info "Current extensions installed: $CURRENT_EXTENSIONS"

if [ "$CURRENT_EXTENSIONS" -ge 34 ]; then
  print_warning "Already have $CURRENT_EXTENSIONS extensions installed (expected 2)"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
  fi
fi

# =============================================================================
# Backup Current State
# =============================================================================

print_header "Backup Current State"

BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/postgres_extensions_backup_$(date +%Y%m%d_%H%M%S).sql"

mkdir -p "$BACKUP_DIR"

print_info "Creating backup of current extensions..."
docker exec "$POSTGRES_CONTAINER" pg_dumpall -U "$POSTGRES_USER" --globals-only > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
  print_success "Backup created: $BACKUP_FILE"
else
  print_error "Backup failed!"
  exit 1
fi

# =============================================================================
# Install Extension Packages
# =============================================================================

print_header "Installing Extension Packages"

print_info "Updating package list inside container..."
docker exec "$POSTGRES_CONTAINER" apt-get update

print_info "Installing Postgres 16 extension packages (this may take 5-10 minutes)..."

# Core extensions
docker exec "$POSTGRES_CONTAINER" apt-get install -y \
  postgresql-16-pgvector \
  postgresql-16-postgis-3 \
  postgresql-16-postgis-3-scripts \
  postgresql-16-pgrouting \
  postgresql-16-pgrouting-scripts \
  postgresql-16-cron \
  postgresql-16-hypopg

print_success "Core extension packages installed"

# Optional extensions (may not be available in all repos)
print_info "Installing optional extension packages..."

# Try to install pg_net (may not be in default repos)
docker exec "$POSTGRES_CONTAINER" bash -c "apt-get install -y postgresql-16-pg-net || echo 'pg_net not available'"

# Try to install pgmq (may not be in default repos)
docker exec "$POSTGRES_CONTAINER" bash -c "apt-get install -y postgresql-16-pgmq || echo 'pgmq not available'"

# Try to install pgaudit (may not be in default repos)
docker exec "$POSTGRES_CONTAINER" bash -c "apt-get install -y postgresql-16-pgaudit || echo 'pgaudit not available'"

print_success "Extension package installation complete"

# =============================================================================
# Verify Packages Installed
# =============================================================================

print_header "Verify Extension Packages"

print_info "Checking installed postgresql-16-* packages..."
docker exec "$POSTGRES_CONTAINER" dpkg -l | grep postgresql-16

# =============================================================================
# Apply SQL Script
# =============================================================================

print_header "Applying SQL Script"

print_info "Copying SQL script to container..."
docker cp "$SQL_SCRIPT" "$POSTGRES_CONTAINER:/tmp/vps1-postgres-fix.sql"

print_success "SQL script copied to container"

print_info "Executing SQL script (this may take 2-3 minutes)..."
docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -f /tmp/vps1-postgres-fix.sql

if [ $? -eq 0 ]; then
  print_success "SQL script executed successfully"
else
  print_error "SQL script execution failed!"
  print_info "Check Postgres logs: docker logs $POSTGRES_CONTAINER"
  exit 1
fi

# =============================================================================
# Verify Extensions Installed
# =============================================================================

print_header "Verification"

print_info "Counting installed extensions..."
NEW_EXTENSION_COUNT=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT COUNT(*) FROM pg_extension;" | xargs)
print_success "Total extensions now: $NEW_EXTENSION_COUNT (expected 36+)"

print_info "Verifying critical extensions..."

# Check pgvector
if docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT 1 FROM pg_extension WHERE extname = 'vector';" | grep -q 1; then
  print_success "pgvector installed"
else
  print_error "pgvector NOT installed"
fi

# Check pgcrypto
if docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto';" | grep -q 1; then
  print_success "pgcrypto installed"
else
  print_error "pgcrypto NOT installed"
fi

# Check PostGIS
if docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT 1 FROM pg_extension WHERE extname = 'postgis';" | grep -q 1; then
  print_success "postgis installed"
else
  print_error "postgis NOT installed"
fi

# Check pg_cron
if docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT 1 FROM pg_extension WHERE extname = 'pg_cron';" | grep -q 1; then
  print_success "pg_cron installed"
else
  print_error "pg_cron NOT installed"
fi

# Check FerretDB schema
if docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT 1 FROM pg_namespace WHERE nspname = 'documentdb_api';" | grep -q 1; then
  print_success "documentdb_api schema created (FerretDB)"
else
  print_error "documentdb_api schema NOT created"
fi

# Check audit_log table
if docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log';" | grep -q 1; then
  print_success "audit_log table created"
else
  print_error "audit_log table NOT created"
fi

# =============================================================================
# Test Functionality
# =============================================================================

print_header "Functionality Tests"

print_info "Testing pgvector..."
VECTOR_TEST=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector;" | xargs)
if [ -n "$VECTOR_TEST" ]; then
  print_success "pgvector test passed (distance: $VECTOR_TEST)"
else
  print_error "pgvector test failed"
fi

print_info "Testing pgcrypto (SHA-256)..."
SHA_TEST=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT encode(digest('test', 'sha256'), 'hex');" | xargs)
if [ -n "$SHA_TEST" ]; then
  print_success "pgcrypto test passed (hash: ${SHA_TEST:0:16}...)"
else
  print_error "pgcrypto test failed"
fi

print_info "Testing PostGIS..."
POSTGIS_TEST=$(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT ST_AsText(ST_MakePoint(-122.4194, 37.7749));" | xargs)
if [ -n "$POSTGIS_TEST" ]; then
  print_success "PostGIS test passed"
else
  print_error "PostGIS test failed"
fi

# =============================================================================
# Restart Dependent Services
# =============================================================================

print_header "Restart Dependent Services"

print_info "Searching for LibreChat container..."
LIBRECHAT_CONTAINER=$(docker ps -a --format '{{.Names}}' | grep -i librechat | head -1)

if [ -n "$LIBRECHAT_CONTAINER" ]; then
  print_info "Found LibreChat container: $LIBRECHAT_CONTAINER"
  print_info "Restarting LibreChat (should exit crash loop)..."
  docker restart "$LIBRECHAT_CONTAINER"
  
  # Wait 5 seconds and check if running
  sleep 5
  if docker ps | grep -q "$LIBRECHAT_CONTAINER"; then
    print_success "LibreChat restarted successfully"
  else
    print_warning "LibreChat not running - check logs: docker logs $LIBRECHAT_CONTAINER"
  fi
else
  print_warning "LibreChat container not found (may not be deployed yet)"
fi

# =============================================================================
# Summary Report
# =============================================================================

print_header "Summary Report"

echo ""
echo "Extensions Before: $CURRENT_EXTENSIONS"
echo "Extensions After:  $NEW_EXTENSION_COUNT"
echo "Extensions Added:  $((NEW_EXTENSION_COUNT - CURRENT_EXTENSIONS))"
echo ""
echo "Critical Extensions Status:"
echo "  • pgvector (embeddings):     $(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN '✓ Installed' ELSE '✗ Missing' END;" | xargs)"
echo "  • pgcrypto (SHA-256):        $(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN '✓ Installed' ELSE '✗ Missing' END;" | xargs)"
echo "  • postgis (spatial):         $(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN '✓ Installed' ELSE '✗ Missing' END;" | xargs)"
echo "  • pg_cron (scheduling):      $(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN '✓ Installed' ELSE '✗ Missing' END;" | xargs)"
echo ""
echo "Infrastructure:"
echo "  • FerretDB schema:           $(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'documentdb_api') THEN '✓ Created' ELSE '✗ Missing' END;" | xargs)"
echo "  • Audit log table:           $(docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -t -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN '✓ Created' ELSE '✗ Missing' END;" | xargs)"
echo ""
echo "Backup Location: $BACKUP_FILE"
echo ""

# =============================================================================
# Next Steps
# =============================================================================

print_header "Next Steps"

echo "1. Verify LibreChat UI is accessible:"
echo "   → https://chat.mitechconsult.com"
echo ""
echo "2. Test System Router vector search:"
echo "   → Should no longer throw 'pgvector not installed' error"
echo ""
echo "3. Verify forensic SHA-256 hashing:"
echo "   → Upload test file, check audit_log table"
echo ""
echo "4. Run full verification checklist:"
echo "   → See salem-trinity-deployment/infrastructure/VERIFICATION_CHECKLIST.md"
echo ""
echo "5. Proceed to Phase 2 (VPS2 deployment):"
echo "   → Deploy compute services to salem-forge"
echo ""

print_success "Phase 1: VPS1 Postgres Fix Complete!"

# =============================================================================
# Cleanup
# =============================================================================

print_info "Cleaning up temporary files..."
docker exec "$POSTGRES_CONTAINER" rm -f /tmp/vps1-postgres-fix.sql
print_success "Cleanup complete"

echo ""
print_header "Script Complete"
echo ""
