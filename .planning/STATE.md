# MCP Tool Platform — Project State

**Project:** MCP Tool Platform  
**Core value:** Raw messaging exports → temporally-aware, forensically-hashed evidence with bidirectional LLM/Portal/API access  
**Architecture:** LlamaIndex Orchestration (DuckDB + LanceDB + Dual Neo4j + Two-pass enrichment)  
**Current phase:** Phase 2 (LlamaIndex Orchestration)  
**Overall progress:** 2/8 phases complete

---

## Phase Status

| Phase | Name | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | Foundation | completed | 2026-02-27 | 2026-02-27 |
| 2 | LlamaIndex Orchestration | completed | 2026-02-28 | 2026-02-28 |
| 3 | Ingestion Pipeline & Cloud Sync | in progress | — | — |
| 4 | Pass 1 Enrichment (Models) | not started | — | — |
| 5 | Pattern Detection UX | not started | — | — |
| 6 | Multi-Source & Document Intelligence | not started | — | — |
| 7 | Pass 2 Enrichment | not started | — | — |
| 8 | Agent & Query Layer | not started | — | — |

---

## Current Focus

**Phase 3: Ingestion Pipeline & Cloud Sync — "The 4GB XML Pipeline"**

Immediate tasks:
- Rclone block storage Watcher (`server/mcp/ingest/watcher.ts`)
- Rebuild Coolify VPS docker-compose infrastructure to support block storage
- Finalize the dual-Neo4j connection logic inside Semantica Node Postprocessor

---

## Progress Bar

```
Phase 1  [ ██████████ ] 100%
Phase 2  [ ██████████ ] 100%
Phase 3  [ . . . . . . . . . . ] 0%
Phase 4  [ . . . . . . . . . . ] 0%
Phase 5  [ . . . . . . . . . . ] 0%
Phase 6  [ . . . . . . . . . . ] 0%
Phase 7  [ . . . . . . . . . . ] 0%
Phase 8  [ . . . . . . . . . . ] 0%
Overall  [ ███░░░░░░░ ] 25%
```

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-28 | **LlamaIndex Orchestrator Pivot** | MS GraphRAG is a monolithic LLM-heavy black box. LlamaIndex Property Graph natively automates DuckDB + LanceDB + Neo4j synchronization. |
| 2026-02-28 | GLiNER2 & Recognizers-Text | Shifted Pass 1 NER completely to CPU. GLiNER for NLP (names), Recognizers for deterministic logic (dates). |
| 2026-02-28 | Cloudflare R2 + VPS Block Storage | Transporting 4GB XMLs over HTTP is impossible. Using Rclone to sync R2 directly to VPS block storage, skipping the application network layer. |
| 2026-02-28 | Unsloth Two-Pass Fine-Tuning | Pass 1 is handled by an 8B SLM (Llama 3/Nemotron) trained via Unsloth on the 300+ legacy regex patterns. Pass 2 is handled by Cloud LLM. |
| 2026-02-28 | Headless OpenCode Proxy | LiteLLM will route Pass 2 requests to an OpenCode API proxy to leverage existing subscription limits, saving API costs. |

---

## Session Continuity

| Session | Date | Agent | What Happened | What's Next |
|---------|------|-------|---------------|-------------|
| Sprint 1 | 2026-02-28 | execution@opencode | Built the atomic LlamaIndex Ingestion pipeline. Ported legacy XML parser, DARVO Regex flagger, GLiNER2 bridge, and Recognizers text. | Phase 3: Build the Cloudflare R2 / VPS Block Storage Watcher pipeline and rebuild Coolify Docker Compose. |

---
*Last updated: 2026-02-28 by execution@opencode*  
*Architecture: LlamaIndex Orchestration (DuckDB + LanceDB + Dual Neo4j)*
