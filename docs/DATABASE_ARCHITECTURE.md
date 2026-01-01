# MCP Tool Shop - Database & Service Architecture

## Overview

The MCP Tool Shop uses a multi-database architecture optimized for different data access patterns. Internal databases handle processing workloads while external databases are exposed as MCP tools for calling agents.

## Database Stack

### Vector Databases (Configurable)

The platform supports multiple vector database backends with a unified interface.

| Provider | Use Case | Hosting | Notes |
|----------|----------|---------|-------|
| **Qdrant** | Primary self-hosted | VPS Docker | Best for large-scale, production deployments |
| **pgvector** | Supabase-native | Supabase | Integrated with existing Postgres, simpler setup |
| **Chroma** | Processing only | Local/ephemeral | Working memory during ETL, not exposed |

**Configuration:**
```typescript
// Environment variables
VECTOR_DB_PROVIDER=qdrant|pgvector
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=optional
PGVECTOR_CONNECTION_STRING=postgres://...
```

**Exposed Tools:**
- `vector.store` - Store embeddings with metadata
- `vector.search` - Semantic similarity search
- `vector.delete` - Remove embeddings
- `vector.list` - List collections

### Relational Database (PostgreSQL)

PostgreSQL via Supabase serves as the primary relational store, accessed through Drizzle ORM.

**Tables:**
- User management and authentication
- Document metadata and lineage
- Analysis results and forensics data
- Approval audit trail
- Job queue and status

**Not directly exposed** - accessed via tRPC procedures and internal services.

### Cache Database (Dragonfly - Optional)

Redis-compatible caching layer for performance optimization.

| Feature | Implementation |
|---------|---------------|
| Session caching | User sessions, API tokens |
| Rate limiting | Per-user, per-tool limits |
| Job queues | Background task management |
| Result caching | Expensive computation results |

**Configuration:**
```typescript
CACHE_ENABLED=true|false
DRAGONFLY_URL=redis://localhost:6379
```

### Graph Database (Neo4j + Graphiti)

Knowledge graph storage for entity relationships and temporal analysis.

**Architecture:**
```
Graphiti (Knowledge Graph Layer)
        ↓
    Neo4j (Storage)
```

**Use Cases:**
- Entity relationship mapping (people, organizations, events)
- Temporal relationship tracking (who said what when)
- Contradiction detection across time
- Communication pattern graphs

**Exposed Tools:**
- `graph.add_entity` - Add node to knowledge graph
- `graph.add_relationship` - Create edge between entities
- `graph.query` - Cypher query execution
- `graph.traverse` - Path finding between entities
- `graph.export` - Export subgraph for visualization

### Document Storage (Directus)

Headless CMS for full document storage and asset management.

**Features:**
- Original document preservation
- Version history
- Metadata management
- Access control
- API-first architecture

**Exposed Tools:**
- `doc.upload` - Store document with metadata
- `doc.get` - Retrieve document
- `doc.list` - List documents with filters
- `doc.update_metadata` - Update document metadata

## External Services

### mem0 (Shared Agent Memory)

Persistent memory layer enabling context sharing across agents and sessions.

**Deployment:** Docker container on VPS

**Capabilities:**
- Long-term memory storage
- Semantic memory search
- Memory scoping (agent, project, global)
- Cross-session context persistence

**Exposed Tools:**
- `memory.add` - Store memory with context
- `memory.search` - Semantic memory retrieval
- `memory.get` - Get specific memory by ID
- `memory.delete` - Remove memory
- `memory.list` - List memories with filters

### n8n Integration

Workflow automation platform integration for complex orchestration.

**Integration Points:**
- Webhook endpoints for triggering MCP tools
- Event emission on job completion
- Credential passthrough for external services
- Workflow trigger tools

**Exposed Tools:**
- `n8n.trigger_workflow` - Start n8n workflow
- `n8n.webhook` - Register webhook endpoint
- `n8n.get_execution` - Check workflow status

### Headless Browser

Playwright-based browser automation for web interaction.

**Capabilities:**
- JavaScript-rendered page access
- Screenshot capture
- Content extraction
- Form interaction
- Cookie/session management

**Exposed Tools:**
- `browser.navigate` - Load URL
- `browser.screenshot` - Capture page
- `browser.extract` - Extract structured content
- `browser.click` - Interact with elements
- `browser.fill` - Fill form fields

### LLM-Optimized Search

Search APIs optimized for AI consumption.

| Provider | Strengths |
|----------|-----------|
| Tavily | Research-focused, citation-rich |
| Perplexity | Conversational, synthesized answers |
| SerpAPI | Raw search results, multiple engines |

**Exposed Tools:**
- `search.web` - General web search
- `search.news` - News-specific search
- `search.research` - Academic/research search

### StirlingPDF

PDF processing service for document manipulation.

**Deployment:** Docker container on VPS

**Operations:**
- Merge multiple PDFs
- Split PDF into pages
- OCR text extraction
- Image conversion
- Compression
- Watermarking

**Exposed Tools:**
- `pdf.merge` - Combine PDFs
- `pdf.split` - Extract pages
- `pdf.ocr` - Extract text via OCR
- `pdf.to_images` - Convert to images
- `pdf.compress` - Reduce file size

## VPS Docker Stack

Services running on VPS, connected via Tailscale or Cloudflare Tunnel:

```yaml
services:
  stirling-pdf:
    image: frooodle/s-pdf:latest
    ports: ["8080:8080"]
    
  mem0:
    image: mem0ai/mem0:latest
    ports: ["8000:8000"]
    
  ollama:
    image: ollama/ollama:latest
    ports: ["11434:11434"]
    
  cli-bridge:
    build: ./cli-bridge
    ports: ["9000:9000"]
    # Runs Claude Code, Gemini CLI, Codex, Aider
    
  qdrant:
    image: qdrant/qdrant:latest
    ports: ["6333:6333"]
    
  neo4j:
    image: neo4j:latest
    ports: ["7474:7474", "7687:7687"]
```

## Security

All VPS services are accessed through secure tunnels:

1. **Tailscale** - Private mesh network, zero-config
2. **Cloudflare Tunnel** - Zero-trust access, DDoS protection

API keys and credentials are managed via environment variables and never exposed to calling agents.
