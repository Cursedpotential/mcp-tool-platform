# Salem Forensic Trinity - Master Deployment Guide

**System Architecture**: 3-VPS forensic-grade infrastructure with temporal awareness  
**Owner**: MiTech Consulting  
**Domain**: mitechconsult.com  
**Deployment Date**: January 2026  

---

## Executive Summary

The Salem Forensic Trinity is a three-tier distributed system designed for forensic legal case management with built-in temporal awareness, chain-of-custody tracking, and multi-modal data storage.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Salem Forensic Trinity                        │
│                   3-VPS Distributed System                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   VPS1: NEXUS    │  │  VPS2: FORGE     │  │ VPS3: PLATFORM   │
│  188.245.189.218 │  │  116.203.198.77  │  │  116.203.40.1    │
│                  │  │                  │  │                  │
│  Storage Layer   │  │  Compute Layer   │  │  Platform Layer  │
│                  │  │                  │  │                  │
│  • PostgreSQL    │  │  • LiteLLM       │  │  • MCP Platform  │
│  • Directus      │  │  • ChromaDB      │  │  • MetaMCP Ext   │
│  • PhotoPrism    │  │  • Dragonfly     │  │  • MySQL         │
│  • n8n           │  │  • Ollama        │  │                  │
│  • MariaDB       │  │  • Kasm          │  │                  │
│  • FerretDB      │  │  • Browserless   │  │                  │
│  • LibreChat     │  │  • Playwright    │  │                  │
│  • Open-WebUI    │  │  • MetaMCP Int   │  │                  │
│                  │  │                  │  │                  │
│  Coolify Master  │  │  Remote Worker   │  │  Remote Worker   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │   Neo4j Aura Cloud  │
                    │   + Graphiti Layer  │
                    │  (Temporal Graphs)  │
                    └─────────────────────┘
```

### Three-Tier Memory Architecture

**Tier 1: Persistent Storage** (Long-term, forensic-grade)
- PostgreSQL (VPS1) with pgvector, PostGIS, 34 extensions
- Neo4j Aura + Graphiti (Cloud) for temporal entity graphs
- Directus (VPS1) for file vault with SHA-256 hashing

**Tier 2: Working Memory** (72-hour TTL, active cases)
- ChromaDB (VPS2) with auto-expiration
- Dragonfly (VPS2) for real-time caching

**Tier 3: Scratch Space** (Session-level, ephemeral)
- In-process memory in MCP Platform (VPS3)
- Request-scoped data

### System Router (The "General Contractor")

The **TrinityRouter** orchestrates all storage operations across the 3-tier architecture:

```typescript
// Single write → Multiple systems (atomic)
await trinityRouter.storeEvidence({
  file: uploadedFile,           // → Directus (VPS1)
  metadata: { case: "2024-001" }, // → Postgres (VPS1)
  entities: ["suspect A"],       // → Neo4j via Graphiti (Cloud)
  workingCopy: true             // → Chroma (VPS2, 72hr TTL)
});

// Smart query routing by capability
const results = await trinityRouter.query({
  type: "temporal",  // → Routes to Graphiti
  query: "Show suspect movements Jan 15-20"
});
```

**Forensic Guarantees**:
- SHA-256 hashing on all file uploads
- `valid_from` timestamps for temporal awareness (Graphiti)
- Chain-of-custody logging to Postgres `audit_log` table
- Immutable storage with version tracking

---

## Infrastructure Status

### Current State (Pre-Deployment)

| VPS | IP | Status | Issues | Action Required |
|-----|-----|--------|--------|-----------------|
| **VPS1** (salem-nexus) | 188.245.189.218 | ✅ Running | 🔴 Postgres missing 32/34 extensions<br>🔴 FerretDB schema missing<br>🔴 LibreChat crash loop | **Phase 1**: Fix Postgres |
| **VPS2** (salem-forge) | 116.203.198.77 | ⚠️ Registered | 🔴 No services deployed<br>🔴 SSH access denied | **Phase 2**: Deploy services |
| **VPS3** (salem-platform) | 116.203.40.1 | ⚠️ Provisioned | 🔴 Not in Coolify<br>🔴 SSH host key not trusted<br>🔴 Docker status unknown | **Phase 3**: Setup + Deploy |

### Target State (Post-Deployment)

All 3 VPSs fully operational with:
- ✅ Coolify managing all containers
- ✅ Traefik handling SSL termination for all services
- ✅ UFW firewall rules enabling cross-VPS communication
- ✅ DNS A records pointing subdomains to correct VPS IPs
- ✅ System Router orchestrating all storage operations
- ✅ Forensic integrity enforced at every layer

---

## Deployment Phases

### Phase 1: Fix VPS1 Postgres (CRITICAL - Blocks Everything)

**Duration**: 10-15 minutes  
**Risk Level**: ⚠️ Medium (requires Postgres restart)  
**Dependencies**: None  

**Problem**: PostgreSQL on VPS1 only has 2/34 extensions installed. Missing:
- `vector` (pgvector) - CRITICAL for semantic search
- `pgcrypto` - CRITICAL for SHA-256 hashing
- PostGIS suite (8 extensions) - CRITICAL for spatial queries
- 23 other extensions for full functionality
- `documentdb_api` schema for FerretDB

**Impact**: 
- LibreChat in crash loop (missing FerretDB schema)
- System Router cannot function (no pgvector)
- No forensic hashing (no pgcrypto)
- No spatial queries (no PostGIS)

**Tasks**:
1. Install missing Postgres extension packages on VPS1
2. Execute `vps1-postgres-fix.sql` to enable all 34 extensions
3. Create `documentdb_api` schema for FerretDB
4. Restart Postgres container
5. Verify all extensions loaded
6. Restart LibreChat (should exit crash loop)

**Deliverables**:
- `phase1-vps1-fix/vps1-postgres-fix.sql` - Complete SQL script
- `phase1-vps1-fix/fix-vps1.sh` - Automated fix script
- Verification commands in `VERIFICATION_CHECKLIST.md`

**Rollback**: Postgres restart reverts to previous state if SQL fails

---

### Phase 2: Deploy VPS2 Compute Services

**Duration**: 30-45 minutes  
**Risk Level**: ✅ Low (no existing services to disrupt)  
**Dependencies**: Phase 1 complete (for cross-VPS Postgres access)  

**Objective**: Deploy 8 compute services to VPS2 (salem-forge)

**Services**:
1. **LiteLLM** (`llm.mitechconsult.com`) - Multi-provider LLM gateway
2. **ChromaDB** (`chroma.mitechconsult.com`) - Working memory (72hr TTL)
3. **Dragonfly** (internal) - Redis-compatible cache
4. **Ollama** (`ollama.mitechconsult.com`) - Local embeddings + cloud proxy
5. **Kasm** (`desktop.mitechconsult.com`) - Browser-based desktops
6. **Browserless** (`browser.mitechconsult.com`) - Headless Chrome
7. **Playwright** (`playwright.mitechconsult.com`) - Browser automation
8. **MetaMCP Internal** (internal) - MCP tool orchestration

**Deployment Method**: Coolify UI (remote deployment from VPS1)

**Tasks**:
1. Verify VPS2 SSH access from Coolify
2. Create `.env.vps2` from template
3. Deploy `docker-compose.vps2-forge.yml` via Coolify
4. Configure Traefik labels for SSL
5. Verify all 8 services running
6. Test cross-VPS connectivity (VPS2 → VPS1 Postgres on port 5432)

**Deliverables**:
- `phase2-vps2-deploy/docker-compose.vps2-forge.yml` - Complete stack
- `phase2-vps2-deploy/.env.vps2.template` - Environment variables
- `phase2-vps2-deploy/DEPLOY_VPS2.md` - Step-by-step Coolify guide

**Rollback**: Delete Coolify deployment (containers auto-removed)

---

### Phase 3: Setup VPS3 Platform Layer

**Duration**: 45-60 minutes  
**Risk Level**: ⚠️ Medium (migrating data from Manus)  
**Dependencies**: Phase 1, Phase 2 complete  

**Objective**: 
1. Add VPS3 to Coolify as remote worker
2. Deploy MCP Platform application
3. Migrate MySQL database from Manus hosting
4. Deploy MetaMCP External gateway

**Services**:
1. **MCP Platform** (`app.mitechconsult.com`) - Main application
2. **MetaMCP External** (`mcp.mitechconsult.com`) - Public MCP gateway
3. **MySQL** (internal) - Application database (migrated from Manus)

**Migration Strategy**:
- Export MySQL from Manus hosting
- Import to VPS3 MySQL container
- Update MCP Platform connection strings
- Verify data integrity

**Tasks**:
1. Accept SSH host key for VPS3 (116.203.40.1)
2. Install Docker on VPS3
3. Add VPS3 to Coolify as remote worker
4. Create `.env.vps3` from template
5. Deploy MySQL container first
6. Execute `MIGRATE_FROM_MANUS.md` procedures
7. Deploy MCP Platform + MetaMCP External
8. Verify app functionality

**Deliverables**:
- `phase3-vps3-platform/setup-vps3.sh` - Initial VPS3 setup
- `phase3-vps3-platform/docker-compose.vps3-platform.yml` - Platform stack
- `phase3-vps3-platform/.env.vps3.template` - Environment variables
- `phase3-vps3-platform/MIGRATE_FROM_MANUS.md` - Data migration guide

**Rollback**: Keep Manus hosting active until verification complete

---

### Phase 4: Integrate System Router

**Duration**: 20-30 minutes  
**Risk Level**: ✅ Low (additive change, backward compatible)  
**Dependencies**: Phase 1, 2, 3 complete  

**Objective**: Deploy `TrinityRouter` class to orchestrate all 4 storage systems

**Storage Clients** (already implemented):
- `GraphitiClient` - Neo4j Aura + Graphiti temporal graphs (762 lines)
- `ChromaClient` - Working memory with 72hr TTL
- `DirectusClient` - File vault
- `PostgresClient` - Will use existing `db.ts` pool

**New Component**:
- `systemRouter.ts` - Orchestration layer ("General Contractor")

**Capabilities**:
1. **Multi-system writes**: Single API call → 4 storage systems atomically
2. **Query routing**: Semantic → pgvector, Temporal → Graphiti, Spatial → PostGIS
3. **Forensic integrity**: SHA-256 hashing, `valid_from` timestamps, audit logging
4. **Graceful degradation**: If one system fails, others continue (with warnings)

**Tasks**:
1. Create `server/mcp/storage/systemRouter.ts` (500+ lines)
2. Update `server/mcp/storage/index.ts` to export TrinityRouter
3. Integrate with existing tools (optional, backward compatible)
4. Deploy to VPS3 via Git push → Coolify rebuild
5. Verify all 4 storage clients reachable

**Deliverables**:
- `phase4-system-router/systemRouter.ts` - Complete implementation
- `phase4-system-router/index.ts` - Updated exports
- `phase4-system-router/INTEGRATION_GUIDE.md` - Usage examples

**Rollback**: System Router is opt-in; existing tools continue working

---

### Phase 5: Infrastructure Hardening

**Duration**: 15-20 minutes  
**Risk Level**: ⚠️ Medium (firewall rules can lock out access)  
**Dependencies**: All previous phases complete  

**Objective**: Secure cross-VPS communication and DNS configuration

**Tasks**:
1. Configure UFW firewall rules on all 3 VPSs:
   - VPS1: Allow 5432 (Postgres) from VPS2, VPS3 only
   - VPS2: Allow 8000 (ChromaDB), 6379 (Dragonfly) from VPS1, VPS3 only
   - VPS3: Allow 3306 (MySQL) from VPS1, VPS2 only
   - All: Allow 22 (SSH), 80/443 (HTTP/HTTPS) from anywhere
2. Create DNS A records for all 13+ subdomains
3. Verify SSL certificates issued by Traefik
4. Test end-to-end System Router operations
5. Enable audit logging to Postgres

**Deliverables**:
- `infrastructure/FIREWALL_RULES.sh` - UFW configuration script
- `infrastructure/DNS_CONFIGURATION.md` - All A record mappings
- `infrastructure/VERIFICATION_CHECKLIST.md` - Testing procedures

**Rollback**: Disable UFW on specific VPS if locked out

---

## DNS Configuration Summary

**Domain**: mitechconsult.com  
**Nameservers**: (User to provide)  

### Required A Records

| Subdomain | Target VPS | IP Address | Service |
|-----------|-----------|------------|---------|
| nexus | VPS1 | 188.245.189.218 | Coolify Master |
| files | VPS1 | 188.245.189.218 | Directus |
| photos | VPS1 | 188.245.189.218 | PhotoPrism |
| n8n | VPS1 | 188.245.189.218 | n8n Automation |
| chat | VPS1 | 188.245.189.218 | LibreChat |
| ui | VPS1 | 188.245.189.218 | Open-WebUI |
| llm | VPS2 | 116.203.198.77 | LiteLLM |
| chroma | VPS2 | 116.203.198.77 | ChromaDB |
| ollama | VPS2 | 116.203.198.77 | Ollama |
| desktop | VPS2 | 116.203.198.77 | Kasm Workspaces |
| browser | VPS2 | 116.203.198.77 | Browserless |
| playwright | VPS2 | 116.203.198.77 | Playwright |
| app | VPS3 | 116.203.40.1 | MCP Platform |
| mcp | VPS3 | 116.203.40.1 | MetaMCP External |

**Total**: 14 A records  
**See**: `infrastructure/DNS_CONFIGURATION.md` for detailed configuration

---

## Critical Pre-Deployment Checklist

### Before Starting Phase 1

- [ ] **Backup VPS1 Postgres data** (even though we're only adding extensions)
- [ ] **Verify Coolify API access** (test with curl command)
- [ ] **Confirm SSH access to VPS1** (`ssh salem-nexus` or `ssh root@188.245.189.218`)
- [ ] **Review VPS1 current service list** (should see 8 containers running)
- [ ] **Check disk space on VPS1** (at least 5GB free for Postgres restart)

### Before Starting Phase 2

- [ ] **Phase 1 verification passed** (all 34 extensions loaded)
- [ ] **LibreChat no longer crashing** (verify in Coolify logs)
- [ ] **VPS2 reachable from VPS1** (ping test from salem-nexus)
- [ ] **Coolify shows VPS2 as healthy remote worker**
- [ ] **Generate all required API keys** (LiteLLM, ChromaDB, etc.)

### Before Starting Phase 3

- [ ] **Phase 1 and 2 verification passed**
- [ ] **Export Manus MySQL database** (backup before migration)
- [ ] **VPS3 SSH host key accepted** (manual SSH login once)
- [ ] **Docker installed on VPS3** (or automated via setup-vps3.sh)
- [ ] **Coolify shows VPS3 as healthy remote worker**

### Before Starting Phase 4

- [ ] **All 3 VPSs operational**
- [ ] **Neo4j Aura instance accessible** (test from VPS3)
- [ ] **All 4 storage clients tested individually**
- [ ] **Backup current MCP Platform code** (Git commit before merge)

### Before Starting Phase 5

- [ ] **All services responding on their subdomains**
- [ ] **Traefik SSL certificates issued** (check Coolify dashboard)
- [ ] **Test SSH access from your workstation to all 3 VPSs**
- [ ] **Have backup access method** (Hetzner console, VNC, etc.)

---

## Rollback Strategy

### Phase 1 Rollback
If Postgres extension installation fails:
1. Restart Postgres container (reverts to previous state)
2. Check Postgres logs: `docker logs <postgres-container-id>`
3. Manual rollback: None needed (extensions are additive)

### Phase 2 Rollback
If VPS2 deployment fails:
1. Delete deployment in Coolify UI
2. Containers auto-removed (no persistent data yet)
3. Re-run Phase 2 with corrected configuration

### Phase 3 Rollback
If VPS3 deployment or migration fails:
1. **Keep Manus hosting active** (do not cancel until verified)
2. Delete VPS3 deployment in Coolify
3. Re-import MySQL backup if corruption occurred
4. Retry migration with corrected procedure

### Phase 4 Rollback
If System Router integration breaks existing tools:
1. Git revert to commit before System Router merge
2. Redeploy MCP Platform via Coolify
3. System Router is opt-in; old tools still functional

### Phase 5 Rollback
If firewall rules lock out access:
1. Access via Hetzner console (VNC)
2. Disable UFW: `sudo ufw disable`
3. Re-enable SSH access
4. Correct firewall rules and re-apply

---

## Success Criteria

### Phase 1 Success
- [ ] All 34 Postgres extensions show in `\dx` output
- [ ] `documentdb_api` schema exists
- [ ] LibreChat container running (not crashing)
- [ ] LibreChat UI accessible at `https://chat.mitechconsult.com`

### Phase 2 Success
- [ ] All 8 VPS2 services show "running" in Coolify
- [ ] ChromaDB API responds on `https://chroma.mitechconsult.com/api/v1/heartbeat`
- [ ] LiteLLM health check passes
- [ ] VPS2 can connect to VPS1 Postgres (port 5432 test)

### Phase 3 Success
- [ ] MCP Platform UI accessible at `https://app.mitechconsult.com`
- [ ] MySQL database matches Manus export (row count verification)
- [ ] MetaMCP External responds on `https://mcp.mitechconsult.com/health`
- [ ] All app features functional (login, case creation, file upload)

### Phase 4 Success
- [ ] System Router instantiates without errors
- [ ] Test write to all 4 storage systems completes
- [ ] Test query routes to correct backend (pgvector, Graphiti, etc.)
- [ ] SHA-256 hash verification passes on file upload
- [ ] Temporal query returns time-aware results from Graphiti

### Phase 5 Success
- [ ] All UFW rules active on all 3 VPSs
- [ ] Cross-VPS connectivity verified (VPS2 → VPS1 Postgres works)
- [ ] All 14 DNS A records propagated (nslookup test)
- [ ] All services accessible via HTTPS with valid SSL
- [ ] End-to-end test: Upload file → Query across all tiers → Verify results

---

## Post-Deployment Operations

### Monitoring

**Coolify Dashboard**: `https://nexus.mitechconsult.com`
- Check all container health states
- Review logs for errors
- Monitor resource usage (CPU, RAM, disk)

**Key Metrics**:
- VPS1 Postgres connections (should be < 100)
- VPS2 ChromaDB collection count (auto-expires after 72hr)
- VPS3 MCP Platform response times (< 200ms for cached queries)
- Neo4j Aura query performance (Graphiti temporal queries)

### Maintenance Windows

**Weekly**:
- Review Postgres `audit_log` table for anomalies
- Check ChromaDB TTL expiration (verify old data purged)
- Verify Graphiti temporal consistency (no orphaned nodes)

**Monthly**:
- Review UFW firewall logs for unauthorized access attempts
- Update Docker images via Coolify (staged rollout: VPS2 → VPS3 → VPS1)
- Backup Postgres + MySQL to external storage

**Quarterly**:
- Review System Router performance metrics
- Optimize Postgres indexes based on query patterns
- Audit Neo4j Aura graph structure for bloat

### Scaling Considerations

**When to scale**:
- VPS1 Postgres > 80% connections: Add read replica
- VPS2 ChromaDB > 10GB: Reduce TTL or add VPS
- VPS3 MCP Platform > 5000 req/min: Add horizontal instances

**Scaling strategy**:
- VPS1: Vertical scaling (more RAM/CPU) OR read replica for queries
- VPS2: Horizontal scaling (add VPS4 for ChromaDB sharding)
- VPS3: Horizontal scaling (multiple MCP Platform instances + load balancer)

---

## Support and Troubleshooting

### Common Issues

**Issue**: LibreChat still crashing after Phase 1
- **Cause**: FerretDB connection string incorrect
- **Fix**: Check `MONGODB_URI` in LibreChat env vars, should point to FerretDB on port 27017

**Issue**: VPS2 services can't reach VPS1 Postgres
- **Cause**: UFW blocking port 5432
- **Fix**: Verify firewall rule allows VPS2 IP, check with `sudo ufw status`

**Issue**: System Router writes fail silently
- **Cause**: One of 4 storage clients not reachable
- **Fix**: Check logs for specific client error, verify network/credentials

**Issue**: Graphiti temporal queries return empty results
- **Cause**: Missing `valid_from` timestamps on entity nodes
- **Fix**: Ensure all writes through System Router include temporal metadata

### Log Locations

- **Coolify logs**: UI dashboard per service
- **Postgres logs**: `docker logs <postgres-container>`
- **MCP Platform logs**: `/app/logs/` inside container
- **System Router logs**: Console output (integrate with Winston/Pino for production)

### Emergency Contacts

- **Infrastructure**: Hetzner Support (VPS provider)
- **Database**: Neo4j Aura Support (for Graphiti/Neo4j issues)
- **Application**: MiTech Consulting internal team

---

## Next Steps After Deployment

1. **Load testing**: Simulate 100 concurrent users on MCP Platform
2. **Backup automation**: Configure automated Postgres/MySQL backups to S3-compatible storage
3. **Monitoring dashboards**: Deploy Grafana + Prometheus for real-time metrics
4. **Security audit**: Run vulnerability scan on all 3 VPSs
5. **Documentation**: Create user guides for case managers using the system
6. **Training**: Train staff on System Router capabilities and forensic workflows

---

## Appendix

### File Manifest

All deployment files located in `salem-trinity-deployment/`:

**Documentation** (Priority 1):
- `MASTER_DEPLOYMENT_GUIDE.md` (this file)
- `infrastructure/DNS_CONFIGURATION.md`
- `infrastructure/VERIFICATION_CHECKLIST.md`

**Phase 1: VPS1 Fix**:
- `phase1-vps1-fix/vps1-postgres-fix.sql`
- `phase1-vps1-fix/fix-vps1.sh`

**Phase 2: VPS2 Deploy**:
- `phase2-vps2-deploy/docker-compose.vps2-forge.yml`
- `phase2-vps2-deploy/.env.vps2.template`
- `phase2-vps2-deploy/DEPLOY_VPS2.md`

**Phase 3: VPS3 Platform**:
- `phase3-vps3-platform/setup-vps3.sh`
- `phase3-vps3-platform/docker-compose.vps3-platform.yml`
- `phase3-vps3-platform/.env.vps3.template`
- `phase3-vps3-platform/MIGRATE_FROM_MANUS.md`

**Phase 4: System Router**:
- `phase4-system-router/systemRouter.ts`
- `phase4-system-router/index.ts`
- `phase4-system-router/INTEGRATION_GUIDE.md`

**Infrastructure**:
- `infrastructure/FIREWALL_RULES.sh`

**Total**: 16 files

### Technology Stack

**VPS Provider**: Hetzner Cloud  
**Container Orchestration**: Coolify (self-hosted)  
**Reverse Proxy**: Traefik (Coolify-managed)  
**Databases**: PostgreSQL 16, MySQL 8, Neo4j Aura, ChromaDB  
**Caching**: Dragonfly (Redis-compatible)  
**File Storage**: Directus (S3-compatible backend)  
**LLM Gateway**: LiteLLM (multi-provider)  
**Automation**: n8n (workflow automation)  
**Monitoring**: Coolify built-in (upgrade to Grafana post-deployment)  

### Architecture Decisions

**Why 3 VPSs instead of 1 large VPS?**
- Fault isolation (compute failure doesn't take down storage)
- Cost optimization (scale layers independently)
- Security (storage layer not directly exposed to compute)

**Why MySQL on VPS3 instead of migrating to Postgres?**
- Less work (existing schema already MySQL)
- MCP Platform already has MySQL connectors
- Postgres on VPS1 reserved for forensic data only

**Why Neo4j Aura (cloud) instead of self-hosted?**
- Managed service (no maintenance overhead)
- Graphiti library optimized for Aura
- Better uptime SLA than self-hosted

**Why Dragonfly instead of Redis?**
- Drop-in Redis replacement with better performance
- Lower memory footprint (up to 50% savings)
- Built-in clustering support

**Why ChromaDB with 72hr TTL instead of permanent vector store?**
- Working memory for active cases only
- Reduces storage costs (old embeddings auto-purge)
- Permanent embeddings stored in Postgres pgvector

---

## Timeline Estimate

| Phase | Duration | Cumulative | Can Run in Parallel? |
|-------|----------|------------|---------------------|
| Phase 1 | 15 min | 15 min | No (blocks everything) |
| Phase 2 | 45 min | 1h 0min | No (needs Phase 1) |
| Phase 3 | 60 min | 2h 0min | No (needs Phase 1, 2) |
| Phase 4 | 30 min | 2h 30min | No (needs Phase 1, 2, 3) |
| Phase 5 | 20 min | 2h 50min | No (needs all previous) |
| **Total** | **2h 50min** | - | Sequential deployment |

**With testing/verification**: Add 30-45 minutes (total ~3.5 hours)

**Recommended schedule**: 
- Morning: Phase 1 + 2 (VPS fixes and compute deployment)
- Afternoon: Phase 3 + 4 (Platform migration and System Router)
- Evening: Phase 5 (Firewall hardening, final verification)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-21 | Initial deployment plan | Claude (AI Assistant) |

---

**End of Master Deployment Guide**

For detailed instructions on each phase, refer to phase-specific documentation in respective subdirectories.
