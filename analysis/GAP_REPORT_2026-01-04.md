# GAP REPORT v2026-01-04 (Current)

This is a new, current snapshot based on repository state and recent commit history. Older reports are preserved in `analysis/` with a bold archival banner.

## Executive Summary
- **Core gateway and tool surface** are in place (search/describe/invoke/get_ref).
- **Tool wiring has materially improved** (browser, NotebookLM, mem0, n8n, JS/Python library tools, LlamaIndex, LangChain, LangGraph).
- **Key remaining blockers** are still infrastructure-level: real DB integrations, HITL approvals, large-file pipeline, and observability/health checks.

## Verified Recent Implementation (from commit history)
Recent commits indicate the following are now implemented/wired:
- **LangChain + LangGraph tools** (prompt formatting, text splitting, graph runner)
- **LlamaIndex chunking (Node + Python)**
- **JS/Python library tools** (cheerio/xml/json5/yaml/csv/natural/compromise/franc/string-similarity + spaCy/nltk/transformers/beautifulsoup/pdfplumber/pandas)
- **Executor wiring** for browser, NotebookLM, mem0, n8n, and search web/news/research

Commit references (recent):
- `0fb33c8` — LangChain/LangGraph tools + LlamaIndex integrations + JS/Python libraries
- `1204388` — Phase 2 DB plugin implementation (see `analysis/PHASE_2_DATABASE_CONNECTIONS.md`)

## Implemented Tool Surface (Now Wired)
### Core tools (from earlier baseline)
- search/doc/nlp/ml/rules/diff/fs/summarize/retrieve core tools

### Newly wired tools (Phase 1+)
- **Browser:** navigate/screenshot/extract/click/fill (requires Playwright)
- **NotebookLM:** ask/list/select/add/search/remove/stats (requires `notebooklm-mcp`)
- **mem0:** add/search/share_context (requires mem0 endpoint)
- **n8n:** trigger/status (requires n8n endpoint)
- **Search:** web/news/research (requires external APIs)
- **JS libraries:** cheerio/xml/json5/yaml/csv/natural/compromise/franc/string_similarity
- **Python libraries:** spacy/nltk/transformers/beautifulsoup/pdfplumber/pandas
- **LlamaIndex:** llamaindex.chunk_text + py.llamaindex
- **LangChain/LangGraph:** langchain.format_prompt / langchain.split_text / langgraph.run

## Remaining Gaps (Current)
### P0 — Blocking
1. **Human-in-the-loop (HITL)**
   - Approvals table missing
   - `invoke_tool` not gated
   - No CLI approval UI
2. **Document intelligence schema**
   - Missing tables: sections/chunks/spans/summaries/entities/keywords/findings/approvals
3. **Large-file pipeline**
   - Streaming XML/HTML parsers
   - Map-reduce chunking pipeline
   - Memory-efficient processing for 5GB+ files

### P1 — High Priority
1. **DB integrations** (vector/graph/mem0/n8n)
   - Code exists but must be wired to real services and health checks
2. **Observability/health checks**
   - JSONL tracing
   - Per-service health endpoints
   - Circuit breakers/retries
3. **Search fallbacks**
   - API-dependent search tools need fallback paths

### P2 — Medium Priority
- Docs: deployment/API spec, updated changelog
- Plugin manifests/runtime metadata + dependency resolution
- Agent/sub-agent orchestration layer

## External Dependencies Required for “Working” Status
- **Playwright** for browser tools
- **NotebookLM MCP client** (`npx notebooklm-mcp@latest`)
- **mem0 + n8n services**
- **Vector DB (Qdrant/pgvector), Graph DB (Neo4j)**

## Files Archived (Old Reports)
All prior analysis is preserved under `analysis/` with an archival banner at the top. Do not overwrite those files.

