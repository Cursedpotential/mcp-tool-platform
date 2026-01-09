# MCP Tool Platform - Master Task List

**Last Updated:** January 9, 2026

This document organizes all pending tasks by workstream for parallel execution across multiple agent threads.

---

## ⚠️ DELEGATION REQUIREMENT

**All agents MUST delegate routine coding to external LLMs (Groq, Gemini, OpenRouter).** Use your tokens for planning, debugging, and user communication only.

---

## Workstream A: VPS Infrastructure & Deployment

**Owner:** Thread 1
**Priority:** P0 - Blocking other work

### Deploy to Coolify
- [ ] Deploy docker-compose.vps1-complete.yml to salem-nexus via Coolify
- [ ] Deploy docker-compose.vps2-salem-forge.yml to salem-forge via Coolify
- [ ] Verify all 14 services are running (8 on nexus, 6 on forge)
- [ ] Configure Traefik SSL certificates for all domains
- [ ] Test cross-VPS communication (forge → nexus PostgreSQL)

### Database Setup
- [ ] Run PostgreSQL schema migrations on salem-nexus
- [ ] Enable pgvector extension for embeddings
- [ ] Configure FerretDB connection for LibreChat
- [ ] Set up database backups to salem-vault volume
- [ ] Test Directus connection to PostgreSQL

### Service Verification
- [ ] Verify PhotoPrism connects to MariaDB
- [ ] Verify n8n connects to PostgreSQL
- [ ] Verify LibreChat connects to FerretDB
- [ ] Verify Open WebUI connects to Ollama Cloud
- [ ] Verify LiteLLM model routing works
- [ ] Verify Chroma persistence across restarts
- [ ] Test Kasm Workspace desktop access

### Cloudflare Workers Deployment
- [ ] Deploy r2-storage worker
- [ ] Deploy evidence-hasher worker
- [ ] Deploy auth-proxy worker
- [ ] Deploy cache-api worker
- [ ] Deploy rate-limiter worker
- [ ] Deploy webhook-receiver worker
- [ ] Configure KV namespaces for rate limiting
- [ ] Test R2 file operations

---

## Workstream B: GCP Integration & Cloud Services

**Owner:** Thread 2
**Priority:** P1 - Enables advanced processing

### Fix GCP Plugin TypeScript Errors
- [ ] Fix gcp-document-ai.ts type errors
- [ ] Fix gcp-vision.ts type errors
- [ ] Fix gcp-natural-language.ts type errors
- [ ] Fix gcp-speech.ts type errors
- [ ] Fix gcp-video-intelligence.ts type errors
- [ ] Move plugins from plugins-pending back to plugins
- [ ] Write vitest tests for GCP plugins

### Deploy Graphiti to Cloud Run
- [ ] Build Graphiti Docker image
- [ ] Push to Google Container Registry
- [ ] Deploy to Cloud Run
- [ ] Configure Neo4j Aura connection
- [ ] Test Graphiti API endpoints
- [ ] Update platform to call Cloud Run Graphiti

### Colab Enterprise Integration
- [ ] Set up Colab Enterprise workspace
- [ ] Create notebook templates for heavy ML tasks
- [ ] Implement API to trigger notebook execution
- [ ] Wire results back to platform

### Google Maps Integration
- [ ] Configure Maps API proxy
- [ ] Implement location-based evidence features
- [ ] Add timeline visualization with maps

---

## Workstream C: Platform Features & Cognitive Architecture

**Owner:** Thread 3
**Priority:** P1 - Core functionality

### Cognitive Architecture (BLOCKED - needs spec)
- [ ] Get thinking types specification from user
- [ ] Implement System 1 (fast) processing
- [ ] Implement System 2 (slow) reasoning
- [ ] Wire memory tiers (persistent, working, scratch)
- [ ] Implement episodic memory via Graphiti
- [ ] Implement semantic memory via Chroma
- [ ] Create memory coordination layer

### Agent Builder System
- [ ] Create base Agent class with state management
- [ ] Implement ForensicAnalysisAgent template
- [ ] Implement DocumentProcessingAgent template
- [ ] Implement PatternDetectionAgent template
- [ ] Create AgentCoordinator for swarm orchestration
- [ ] Implement agent communication protocol
- [ ] Add agent monitoring dashboard

### LangChain/LangGraph Wiring
- [ ] Wire LangChain memory to Chroma (working) and Supabase (final)
- [ ] Implement shared context for agent swarms
- [ ] Refactor semantic_search_prep workflow
- [ ] Add hypothesis evolution tracking

### Parser Framework
- [ ] Extract ChatGPT parser from Google Drive utilities
- [ ] Extract SMS parser
- [ ] Extract Facebook parser
- [ ] Extract iMessage parser
- [ ] Create unified parser interface
- [ ] Wire parsers to executor handlers

### Frontend UI
- [ ] Create AgentBuilder.tsx page
- [ ] Create WorkflowExecution.tsx page
- [ ] Add agent monitoring dashboard
- [ ] Implement evidence upload flow
- [ ] Add timeline visualization

---

## Workstream D: Storage & Database (Can be parallelized)

**Owner:** Any thread with capacity
**Priority:** P2 - Enhancement

### R2 Integration Completion
- [ ] Implement file integrity verification (SHA-256)
- [ ] Create R2 management UI
- [ ] Wire R2 to Directus backend
- [ ] Set up bucket structure (cases/documents/images/ocr)

### Database Consolidation
- [ ] Merge schema files into single source
- [ ] Add missing tables from Supabase design
- [ ] Create database views for common queries
- [ ] Set up cross-database queries if needed

### Supabase Final Storage
- [ ] Configure Supabase for final evidence storage
- [ ] Implement evidence export pipeline
- [ ] Add chain of custody logging
- [ ] Create audit trail system

---

## Completed Tasks (Reference)

### Phase 13 - VPS Infrastructure (Jan 9, 2026)
- [x] Create docker-compose.vps1-complete.yml (8 services)
- [x] Create docker-compose.vps2-salem-forge.yml (6 services)
- [x] Create all .env files with secrets
- [x] Add R2 configuration to services
- [x] Create litellm-config.yaml
- [x] Update Dockerfile.kasm with FastAPI
- [x] Create 6 Cloudflare Workers
- [x] Update python-bridge.ts for remote execution
- [x] Organize deploy/ folder structure
- [x] Clean up docs/ folder structure

### Earlier Phases
- [x] MCP Gateway (65+ tools)
- [x] LangGraph forensic workflows
- [x] Document loaders (SMS, Facebook, iMessage stubs)
- [x] Pattern detection library
- [x] Evidence hasher with chain of custody

---

## Notes

- **Thinking types spec**: User is finding the conversation with the original spec
- **GCP plugins**: Generated via LLM, have TypeScript errors, need manual fixes
- **Tailscale**: Skipped due to configuration issues, using public IPs instead
- **Chroma**: Single instance with multiple collections, not separate deployments
