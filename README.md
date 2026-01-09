# MCP Tool Platform - Salem Forensics

A forensic evidence analysis platform built on the Model Context Protocol (MCP), designed for processing, analyzing, and managing digital evidence in legal proceedings. The platform provides AI-powered document analysis, pattern detection, and evidence chain verification with court-admissible audit trails.

---

## ⚠️ CRITICAL: Delegation Requirements

**ALL agents working on this project MUST delegate coding and routine tasks to external LLMs.** Do not write boilerplate code manually. Use the available API keys:

| Service | Use Case | Model |
|---------|----------|-------|
| **Groq** | Fast code generation, simple tasks | Llama 3.3 70B, Compound (free) |
| **Gemini** | Complex reasoning, GCP integration | Gemini 2.5 Flash |
| **OpenRouter** | Fallback, variety of models | Various |
| **Anthropic** | Complex analysis | Claude |

**How to delegate:**
```javascript
// Use Manus built-in API or direct API calls
const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${process.env.Groq_api_key}` },
  body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [...] })
});
```

Reserve your tokens for planning, architecture decisions, debugging, and user communication. Delegate everything else.

---

## Architecture Overview

The platform operates across three deployment environments:

| Environment | Purpose | Services |
|-------------|---------|----------|
| **Manus Hosting** | Web application, API gateway, orchestration | Main platform, tRPC API, OAuth |
| **salem-nexus (VPS1)** | Storage, CMS, chat interfaces | PostgreSQL, MariaDB, FerretDB, Directus, PhotoPrism, n8n, LibreChat, Open WebUI |
| **salem-forge (VPS2)** | Backend compute, AI services | LiteLLM, MetaMCP, Chroma, Kasm Workspace, Browserless, Playwright |

Additional cloud services:
- **Cloudflare**: Workers (edge functions), R2 (storage, zero egress)
- **Google Cloud**: Document AI, Vision, NLP, Graphiti on Cloud Run
- **Neo4j Aura**: Knowledge graph (Graphiti backend)

---

## Memory Architecture

Three-tier memory system:

| Tier | Location | TTL | Purpose |
|------|----------|-----|---------|
| **Persistent Context** | Graphiti + Neo4j | Permanent | Entities, relationships, established facts |
| **Working Memory** | Chroma (salem-forge) | 72 hours | Active investigation context |
| **Scratch Space** | Manus (ephemeral) | Session | Agent coordination buffer |

---

## Project Structure

```
mcp-tool-platform/
├── client/                 # React frontend (Vite + Tailwind)
├── server/                 # Express + tRPC backend
│   ├── mcp/                # MCP gateway (65+ tools)
│   │   ├── plugins/        # Tool implementations
│   │   ├── plugins-pending/# GCP plugins (need fixing)
│   │   └── orchestration/  # LangChain/LangGraph
│   └── _core/              # Auth, LLM, database
├── deploy/                 # Deployment configs
│   ├── docker/             # VPS docker-compose, Dockerfiles
│   ├── cloudflare/         # Edge workers
│   └── gcp/                # Cloud Run services
├── docs/                   # Documentation
│   ├── architecture/       # System design
│   ├── deployment/         # Deployment guides
│   └── handoff/            # Task handoffs
└── todo.md                 # Master task list
```

---

## Quick Start

```bash
pnpm install
pnpm dev
pnpm test
```

---

## Documentation

- **Architecture**: `/docs/architecture/`
- **Deployment**: `/docs/deployment/`
- **Handoffs**: `/docs/handoff/`
- **Task List**: `/todo.md`

---

## Current Status (Jan 9, 2026)

**Completed:**
- MCP Gateway with 65+ tools
- LangGraph forensic workflows
- VPS docker-compose files (salem-nexus, salem-forge)
- Cloudflare Workers (6 workers)
- R2 integration
- Python bridge for remote execution

**In Progress:**
- GCP service integration (plugins need TypeScript fixes)
- Cognitive architecture / thinking types
- Agent builder system
- Database consolidation

**Blocked:**
- Thinking types spec (needs user input)

---

## License

Private - All rights reserved.
