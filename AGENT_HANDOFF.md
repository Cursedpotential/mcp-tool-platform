# Agent Handoff Document - Salem Forensics MCP Tool Platform

**Date:** January 6, 2025  
**Project:** MCP Tool Platform Gateway & Runner Swarm  
**Status:** Infrastructure scaffold complete, ready for implementation  
**Priority:** High - Multiple parallel work streams available

---

## Executive Summary

Complete infrastructure scaffold for a production-ready forensic analysis platform combining MCP tool orchestration, LLM routing, vector/graph databases, and cloud AI services. All scaffolds include clear TODOs and are ready for parallel implementation by multiple agents.

**Key Architecture Decisions:**
1. **8GB/4-core VPS optimization** - Service tiers (core always-on vs on-demand webhook-controlled)
2. **Intelligent routing** - Manus built-in → VPS services → External APIs → Databases
3. **Cloud AI separation** - AWS/GCP for fast operational tasks, Colab Enterprise for deep forensic analysis
4. **Provider independence** - VPS failover deployment to avoid vendor lock-in

---

## Work Streams (Parallel Execution Ready)

### 🔴 **Stream 1: VPS Infrastructure Deployment** (Priority: Critical)
**Files:** `docker-compose.8gb.yml`, `.env.docker.example`, `Dockerfile.*`  
**Agent:** DevOps/Infrastructure specialist  
**Estimated effort:** 8-12 hours

**Tasks:**
1. Set up 8GB/4-core VPS (Ubuntu 22.04)
2. Install Docker + Docker Compose
3. Copy all Dockerfiles and docker-compose.8gb.yml to VPS
4. Fill in `.env.docker` with actual credentials
5. Start core services: `docker-compose -f docker-compose.8gb.yml up -d chroma litellm metamcp directus n8n tailscale`
6. Verify all core services are healthy
7. Configure Tailscale VPN for secure access
8. Set up SSL certificates (Let's Encrypt)
9. Configure Nginx reverse proxy
10. Test service health checks

**Deliverables:**
- Running VPS with all core services
- Health monitoring dashboard
- Access credentials document
- Troubleshooting guide

---

### 🟠 **Stream 2: LiteLLM + MetaMCP Integration** (Priority: High)
**Files:** `server/_core/router.ts`, `litellm_config.yaml`, `Dockerfile.metamcp`  
**Agent:** Backend developer with LLM experience  
**Estimated effort:** 12-16 hours

**Tasks:**
1. Complete `routeLLM()` function in `server/_core/router.ts`
   - Implement Manus built-in → LiteLLM → Direct API fallback chain
   - Add cost tracking for each provider
   - Add latency monitoring
   - Implement caching (Redis/Dragonfly)
2. Update `server/_core/llm.ts` to use intelligent routing
3. Test LiteLLM config with all model providers
4. Implement MetaMCP server registry (Dockerfile.metamcp)
   - Complete `/api/mcp/register` endpoint
   - Complete `/api/mcp/servers` endpoint
   - Complete `/api/mcp/tools/search` endpoint
   - Complete `/api/mcp/execute` endpoint
5. Connect local MCP gateway to MetaMCP registry
6. Test cross-server tool execution
7. Add metrics dashboard

**Deliverables:**
- Working LLM routing with fallbacks
- Cost tracking per model/provider
- MCP server registry with tool discovery
- Integration tests

---

### 🟡 **Stream 3: AWS AI Services Integration** (Priority: Medium)
**Files:** `server/_core/aws-ai.ts`  
**Agent:** Backend developer with AWS experience  
**Estimated effort:** 16-20 hours

**Tasks:**
1. Install AWS SDKs: `npm install @aws-sdk/client-rekognition @aws-sdk/client-comprehend @aws-sdk/client-textract`
2. Configure AWS credentials in environment
3. Implement Rekognition functions:
   - `detectFaces()` - Face detection with emotions, age, gender
   - `detectLabels()` - Object and scene detection
   - `detectTextInImage()` - OCR with bounding boxes
4. Implement Comprehend functions:
   - `analyzeSentiment()` - Sentiment analysis
   - `extractEntities()` - Named entity recognition
   - `detectPII()` - PII detection for redaction
5. Implement Textract functions:
   - `extractDocumentText()` - Simple OCR
   - `analyzeDocument()` - Tables and forms extraction
6. Implement `analyzeScreenshot()` pipeline:
   - Extract text from screenshot
   - Detect faces and emotions
   - Analyze sentiment
   - Extract entities
   - Detect PII
   - Store results in Supabase
7. Create tRPC procedures for frontend access
8. Add error handling and retries
9. Add cost tracking

**Deliverables:**
- Working AWS AI service wrappers
- Screenshot analysis pipeline
- tRPC procedures for frontend
- Cost tracking dashboard
- Integration tests

---

### 🟢 **Stream 4: GCP AI Services Integration** (Priority: Medium)
**Files:** `server/_core/gcp-ai.ts`  
**Agent:** Backend developer with GCP experience  
**Estimated effort:** 20-24 hours

**Tasks:**
1. Install GCP SDKs: `npm install @google-cloud/documentai @google-cloud/aiplatform @google-cloud/notebooks`
2. Create GCP service account with required permissions
3. Download service account JSON key
4. Configure GCP credentials in environment
5. Implement Document AI functions:
   - `processDocument()` - Single document processing
   - `batchProcessDocuments()` - Bulk processing
6. Implement Colab Enterprise functions:
   - `executeNotebook()` - On-demand notebook execution
   - `scheduleNotebook()` - Recurring jobs
   - `generateAnalysisNotebook()` - Template generation
7. Implement Vertex AI functions:
   - `predictCustomModel()` - Custom model inference
   - `deployModel()` - Model deployment
8. Create Colab notebook templates:
   - Sentiment analysis with HuggingFace models
   - AbuseDetector v2.0 integration
   - Tether model integration
   - Entity extraction
   - Pattern detection
   - Meta-analysis across cases
9. Implement `analyzeForensicDocument()` pipeline
10. Implement `batchForensicAnalysis()` for bulk processing
11. Test with trial credits

**Deliverables:**
- Working GCP AI service wrappers
- Colab Enterprise integration
- Notebook templates for forensic analysis
- Batch processing pipeline
- Integration tests

---

### 🔵 **Stream 5: Backend UI Implementation** (Priority: High)
**Files:** `server/routers/settings.ts`, `server/routers/patterns.ts`, `client/src/pages/Settings.tsx`, `client/src/pages/PatternLibrary.tsx`  
**Agent:** Full-stack developer  
**Estimated effort:** 24-32 hours

**Tasks:**
1. Merge database schemas from `drizzle/settings-schema.ts` into `drizzle/schema.ts`
2. Run `pnpm db:push` to create tables
3. Implement database helpers in `server/db.ts`
4. Complete all tRPC procedures in `server/routers/settings.ts`:
   - NLP config CRUD
   - LLM provider management
   - Database connection management
   - Workflow configuration
5. Complete all tRPC procedures in `server/routers/patterns.ts`:
   - Pattern CRUD (256 patterns)
   - Pattern testing
   - Pattern import/export
6. Wire up Settings UI (`client/src/pages/Settings.tsx`)
7. Wire up Pattern Library UI (`client/src/pages/PatternLibrary.tsx`)
8. Add routes to `client/src/App.tsx`
9. Create additional UI pages:
   - LLM Router Management
   - Prompt Builder
   - Workflow Builder
   - Agent Builder
   - Import/Export System
10. Write vitest tests for all procedures
11. Test end-to-end

**Deliverables:**
- Working backend management UI
- Pattern library with 256 patterns
- Settings management
- Integration tests
- User documentation

---

### 🟣 **Stream 6: n8n Workflow Automation** (Priority: Medium)
**Files:** `n8n-workflows/service-control.json`  
**Agent:** Automation specialist  
**Estimated effort:** 8-12 hours

**Tasks:**
1. Import `n8n-workflows/service-control.json` into n8n
2. Test webhook endpoints:
   - POST `/webhook/service/start` with `{"service": "salem-kasm-workspace"}`
   - POST `/webhook/service/stop` with `{"service": "salem-kasm-workspace"}`
3. Test scheduled workflows:
   - Start Kasm at 9am weekdays
   - Stop Kasm at 6pm weekdays
4. Create additional workflows:
   - Resource monitoring (stop idle services when RAM >90%)
   - Cost optimization (stop expensive services overnight)
   - Health checks (restart failed services)
   - Backup automation (daily database backups to R2)
5. Add Slack/email notifications for critical events
6. Create workflow documentation

**Deliverables:**
- Working webhook-based service control
- Scheduled automation workflows
- Resource monitoring workflows
- Notification system
- Workflow documentation

---

### 🟤 **Stream 7: Kasm Workspace Setup** (Priority: Medium)
**Files:** `Dockerfile.kasm`  
**Agent:** DevOps/Desktop specialist  
**Estimated effort:** 8-12 hours

**Tasks:**
1. Build Kasm Dockerfile: `docker build -f Dockerfile.kasm -t salem-kasm .`
2. Start Kasm container: `docker-compose -f docker-compose.8gb.yml up -d kasm-workspace`
3. Access VNC at `http://localhost:6901` (password from .env.docker)
4. Configure rclone for R2 bidirectional sync:
   - Test manual sync: `rclone sync /home/kasm-user/workspace r2:salem-forensics/workspace`
   - Set up auto-sync timer (every 5 minutes)
5. Install and configure CLI tools:
   - Claude CLI with API key
   - Gemini CLI with API key
   - Aider (AI pair programming)
   - Cursor (AI code editor)
6. Test desktop workflow:
   - Open VS Code
   - Edit code
   - Sync to R2
   - Verify sync on local desktop
7. Create SSH access for agents
8. Add CLI wrapper scripts for agent calls
9. Test agent → Claude CLI execution
10. Add usage tracking

**Deliverables:**
- Working Kasm workspace with VNC access
- Bidirectional R2 sync (every 5 minutes)
- Configured AI CLI tools
- Agent access scripts
- Usage tracking dashboard
- User guide

---

### ⚫ **Stream 8: Documentation Generation** (Priority: Low)
**Files:** `DOCUMENTATION_HANDOFF.md`, `docs/`  
**Agent:** Technical writer or free LLM (Gemini Flash)  
**Estimated effort:** 40-60 hours (can be delegated to free model)

**Tasks:**
1. Use `DOCUMENTATION_HANDOFF.md` as guide
2. Generate 60+ tool documentation files in `docs/tools/`
3. Generate 20+ workflow documentation files in `docs/workflows/`
4. Generate 15+ system documentation files in `docs/systems/`
5. Add code examples to each doc
6. Add usage statistics and best practices
7. Create developer onboarding guide
8. Create troubleshooting guides
9. Review and edit all generated docs
10. Publish to documentation site

**Deliverables:**
- Complete wiki-style documentation
- API reference
- Developer guides
- Troubleshooting guides
- Deployment guides

---

### ⚪ **Stream 9: VPS Failover Deployment** (Priority: Low)
**Files:** `docker-compose.yml`, `server/`, `client/`  
**Agent:** DevOps specialist  
**Estimated effort:** 16-24 hours

**Tasks:**
1. Create Dockerfile for full Manus app (client + server)
2. Add web app service to docker-compose.yml
3. Configure Nginx reverse proxy for web app
4. Set up SSL/TLS certificates
5. Create database migration scripts:
   - Export all data from Manus/Supabase
   - Import data to VPS databases
6. Create incremental sync script (keep VPS up-to-date)
7. Test full database migration
8. Document DNS configuration for custom domain
9. Create traffic routing script (switch between Manus ↔ VPS)
10. Set up health checks for automatic failover
11. Test manual failover (Manus → VPS)
12. Test automatic failover on Manus downtime
13. Create rollback procedure (VPS → Manus)
14. Document cost comparison (Manus vs VPS vs hybrid)

**Deliverables:**
- Dockerized Manus app
- Database migration scripts
- Failover automation
- DNS configuration guide
- Cost comparison analysis
- Rollback procedure

---

## Critical Files Reference

### Infrastructure
- `docker-compose.8gb.yml` - Optimized VPS deployment (8GB/4-core)
- `.env.docker.example` - Environment variables template
- `Dockerfile.kasm` - Kasm workspace with AI CLI tools
- `Dockerfile.metamcp` - MetaMCP server registry
- `Dockerfile.playwright` - Headless browser automation

### Backend Core
- `server/_core/router.ts` - Intelligent routing layer (TODOs)
- `server/_core/llm.ts` - LLM integration (needs update)
- `server/_core/aws-ai.ts` - AWS AI services wrapper (TODOs)
- `server/_core/gcp-ai.ts` - GCP AI services wrapper (TODOs)

### Backend Features
- `server/routers/settings.ts` - Settings management (TODOs)
- `server/routers/patterns.ts` - Pattern library (TODOs)
- `drizzle/settings-schema.ts` - Database schema additions

### Frontend
- `client/src/pages/Settings.tsx` - Settings UI (TODOs)
- `client/src/pages/PatternLibrary.tsx` - Pattern library UI (TODOs)

### Automation
- `n8n-workflows/service-control.json` - Webhook-based service control
- `litellm_config.yaml` - LLM routing configuration

### Documentation
- `DOCUMENTATION_HANDOFF.md` - Documentation generation guide
- `IMPLEMENTATION_GUIDE.md` - Backend UI implementation guide
- `AGENT_HANDOFF.md` - This file
- `todo.md` - Complete task list (Phase 26-34)

---

## Environment Setup

### Required Credentials

**AWS:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

**GCP:**
- `GCP_PROJECT_ID`
- `GCP_SERVICE_ACCOUNT_KEY_PATH` (JSON file)
- `GCP_DOCUMENT_AI_PROCESSOR_ID`
- `GCP_COLAB_RUNTIME_TEMPLATE`
- `GCP_VERTEX_AI_ENDPOINT`

**LLM APIs:**
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `COHERE_API_KEY`
- `OPENROUTER_API_KEY`
- `GROQ_API_KEY`

**Infrastructure:**
- `NEO4J_AUTH` (using Neo4j Aura hosted)
- `SUPABASE_HOST`, `SUPABASE_PASSWORD`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- `TAILSCALE_AUTH_KEY`

**Services:**
- `LITELLM_MASTER_KEY`
- `CHROMA_AUTH_TOKEN`
- `KASM_VNC_PASSWORD`
- `N8N_USER`, `N8N_PASSWORD`

---

## Testing Strategy

### Unit Tests
- All tRPC procedures must have vitest tests
- See `server/auth.logout.test.ts` for reference
- Run: `pnpm test`

### Integration Tests
- Test complete pipelines end-to-end
- Test AWS AI services with sample data
- Test GCP AI services with sample data
- Test LLM routing with fallbacks
- Test MCP tool execution

### Performance Tests
- Load test LiteLLM with concurrent requests
- Test batch processing (1000+ documents)
- Measure latency for each service
- Track cost per operation

### Failover Tests
- Test Manus → VPS failover
- Test service restart via webhooks
- Test automatic failover on service degradation

---

## Success Criteria

### Stream 1 (VPS Infrastructure)
- [ ] All core services running and healthy
- [ ] SSL certificates configured
- [ ] Tailscale VPN working
- [ ] Health monitoring dashboard live

### Stream 2 (LiteLLM + MetaMCP)
- [ ] LLM routing working with fallbacks
- [ ] Cost tracking per model/provider
- [ ] MCP tool discovery working
- [ ] Cross-server tool execution working

### Stream 3 (AWS AI)
- [ ] Screenshot analysis pipeline working
- [ ] All AWS services integrated
- [ ] Cost tracking dashboard
- [ ] Integration tests passing

### Stream 4 (GCP AI)
- [ ] Document AI processing working
- [ ] Colab Enterprise execution working
- [ ] HuggingFace models integrated
- [ ] Batch processing working

### Stream 5 (Backend UI)
- [ ] All database tables created
- [ ] All tRPC procedures implemented
- [ ] Settings UI working
- [ ] Pattern library working
- [ ] All vitest tests passing

### Stream 6 (n8n Automation)
- [ ] Webhook service control working
- [ ] Scheduled workflows running
- [ ] Resource monitoring active
- [ ] Notifications working

### Stream 7 (Kasm Workspace)
- [ ] VNC access working
- [ ] R2 bidirectional sync working
- [ ] AI CLI tools configured
- [ ] Agent access working

### Stream 8 (Documentation)
- [ ] All tool docs generated
- [ ] All workflow docs generated
- [ ] All system docs generated
- [ ] Developer guides complete

### Stream 9 (VPS Failover)
- [ ] Manus app Dockerized
- [ ] Database migration working
- [ ] Failover automation working
- [ ] Rollback procedure tested

---

## Communication Protocol

### Daily Standups
- Report progress on assigned stream
- Identify blockers
- Request help if needed

### Blocker Resolution
- Document blocker in todo.md
- Tag with `[BLOCKED]`
- Notify team immediately

### Code Review
- All PRs require review before merge
- Follow existing code style
- Include tests with all changes

### Documentation
- Update todo.md as tasks complete
- Document all decisions in CHANGELOG.md
- Update AGENT_HANDOFF.md with new findings

---

## Next Steps

1. **Assign streams to agents** - Match expertise to work streams
2. **Set up communication channels** - Slack/Discord for coordination
3. **Kick off Stream 1** - VPS infrastructure (critical path)
4. **Parallel execution** - Start Streams 2-7 simultaneously
5. **Weekly check-ins** - Review progress, adjust priorities
6. **Integration testing** - Test all streams together
7. **Production deployment** - Deploy to VPS
8. **User acceptance testing** - Validate with real forensic data
9. **Documentation finalization** - Complete Stream 8
10. **Launch** - Go live with full platform

---

## Questions?

Contact project lead with any questions or blockers. All scaffolds are complete and ready for implementation. Let's build this! 🚀
