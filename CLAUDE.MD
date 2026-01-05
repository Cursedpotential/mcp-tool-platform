# CLAUDE.MD - MCP Tool Platform

This document provides context for AI assistants working with this codebase.

## Project Overview

**MCP Tool Platform** is a token-efficient preprocessing platform designed for 85%+ token reduction before data flows into final databases (Neo4j, Supabase, Vector DBs). This is the "Home Depot of preprocessing tools" - an intermediary system where heavy lifting happens so orchestrating agents receive pre-analyzed, structured data.

### Core Purpose

Raw Documents → [MCP Tool Shop] → Preprocessed Data → Final DBs

The platform handles:
- OCR/Pandoc conversion
- Entity extraction
- Sentiment analysis
- Graph relationship extraction
- Chunking with citations
- Embeddings (staging in Chroma)
- Initial summarization

## Architecture

### Stack
- **Runtime:** Node.js 22+, TypeScript 5.9.3
- **Package Manager:** pnpm 10+
- **Framework:** Express + tRPC
- **Frontend:** React 19, Vite 7, TailwindCSS 4
- **Database:** Drizzle ORM with MySQL
- **External Services:**
  - Qdrant (vector database)
  - Neo4j (graph database)
  - mem0 (shared memory, optional)
  - n8n (workflows, optional)

### Key Concepts

#### 1. MCP Gateway API (4 Core Endpoints)

Located in `server/mcp/gateway.ts`:

| Endpoint | Purpose | Token Efficiency |
|----------|---------|------------------|
| `search_tools` | Discover available tools | Returns compact tool cards (name, category, tags) |
| `describe_tool` | Get full tool specification | On-demand loading of schemas and examples |
| `invoke_tool` | Execute tools | Reference-based returns for large outputs |
| `get_ref` | Retrieve content | Paged retrieval (4KB default pages) |

#### 2. Content-Addressed Storage

All large artifacts are stored using SHA-256 content hashes in `server/mcp/store/content-store.ts`:
- **Deduplication:** Identical content stored once
- **Paging:** Token-efficient retrieval of large results
- **Caching:** Content-addressed lookups for repeated operations

#### 3. Plugin System

60+ tools registered in `server/mcp/plugins/registry.ts`:

**Categories:**
- `search` - ripgrep, ugrep
- `document` - Pandoc, Tesseract OCR, segmentation
- `nlp` - Entity extraction, sentiment, keywords, language detection
- `ml` - Embeddings, semantic search, classification
- `database` - Vector (Qdrant), Graph (Neo4j)
- `memory` - mem0 integration
- `workflow` - n8n integration
- `filesystem` - Sandboxed file operations
- `rules` - Pattern matching engine
- `diff` - Text comparison
- `summarization` - Hierarchical map-reduce
- `retrieval` - BM25 + semantic search
- `forensics` - Behavioral pattern analysis (manipulation, abuse detection)
- `etl` - Text mining, format conversion, schema resolution
- `browser` - Web scraping, screenshots
- `library` - JavaScript/Python library wrappers (Cheerio, spaCy, pandas, etc.)

#### 4. Human-in-the-Loop (HITL)

Located in `server/mcp/hitl/approval.ts`:
- Preview of proposed changes
- Diff visualization
- Rollback capability via content store
- Audit logging

## Project Structure

```
mcp-tool-platform/
├── server/
│   ├── _core/
│   │   └── index.ts           # Express server entry point
│   ├── mcp/
│   │   ├── gateway.ts         # MCP Gateway API (4 endpoints)
│   │   ├── store/
│   │   │   └── content-store.ts  # SHA-256 content-addressed storage
│   │   ├── plugins/
│   │   │   ├── registry.ts    # Plugin registry & tool registration
│   │   │   ├── search.ts      # ripgrep/ugrep
│   │   │   ├── document.ts    # Pandoc/Tesseract
│   │   │   ├── nlp.ts         # NLP operations
│   │   │   ├── ml.ts          # Embeddings (optional)
│   │   │   ├── vector-db.ts   # Qdrant integration
│   │   │   ├── graph-db.ts    # Neo4j integration
│   │   │   ├── mem0.ts        # Shared memory
│   │   │   ├── n8n.ts         # Workflow automation
│   │   │   ├── filesystem.ts  # File operations
│   │   │   ├── rules.ts       # Rule engine
│   │   │   ├── diff.ts        # Text comparison
│   │   │   ├── summarization.ts  # Map-reduce
│   │   │   ├── retrieval.ts   # BM25 retrieval
│   │   │   ├── text-miner.ts  # Text mining
│   │   │   ├── format-converter.ts  # Format conversion
│   │   │   ├── schema-resolver.ts  # Schema detection
│   │   │   ├── evidence-hasher.ts  # Cryptographic hashing
│   │   │   └── browser-search.ts  # Web search
│   │   ├── workers/
│   │   │   └── executor.ts    # Task execution
│   │   ├── hitl/
│   │   │   └── approval.ts    # HITL approval system
│   │   ├── export/
│   │   │   └── pipeline.ts    # Export to final DBs
│   │   ├── observability/
│   │   │   └── tracing.ts     # Distributed tracing
│   │   ├── utils/
│   │   │   └── logger.ts      # Pino logger
│   │   └── python-bridge.ts   # Python interop
│   └── auth.*.ts              # Authentication
├── client/
│   └── src/
│       └── pages/
│           └── Home.tsx       # Dashboard
├── shared/
│   └── mcp-types/
│       └── index.ts           # Shared TypeScript types
├── drizzle/                   # Database migrations
├── data/
│   └── content-store/         # Content-addressed storage
├── .env.example               # Environment template
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite config
├── vitest.config.ts           # Vitest config
└── README.md                  # User-facing documentation
```

## Development Workflow

### Setup
```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start dev server (hot reload)
pnpm dev

# Build for production
pnpm build

# Run production server
pnpm start
```

### Testing
```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/mcp/store/content-store.test.ts

# Run with watch mode (for development)
pnpm test --watch
```

### Environment Variables

See `.env.example` for full configuration. Key variables:

**Database:**
- `DATABASE_URL` - MySQL connection string
- `QDRANT_URL` - Qdrant vector DB (default: http://localhost:6333)
- `QDRANT_API_KEY` - API key (optional for local)
- `NEO4J_URL` - Neo4j bolt URL (default: bolt://localhost:7687)
- `NEO4J_USERNAME` - Neo4j username (default: neo4j)
- `NEO4J_PASSWORD` - Neo4j password

**Optional Services:**
- `MEM0_URL` - mem0 API endpoint
- `MEM0_API_KEY` - mem0 API key
- `MEM0_ENABLED` - Enable mem0 integration
- `N8N_URL` - n8n instance URL
- `N8N_API_KEY` - n8n API key
- `N8N_ENABLED` - Enable n8n integration

**Auth:**
- `JWT_SECRET` - JWT signing secret
- `OAUTH_SERVER_URL` - OAuth server URL

**Built-in APIs:**
- `BUILT_IN_FORGE_API_URL` - Forge API endpoint
- `BUILT_IN_FORGE_API_KEY` - Forge API key

## Token Efficiency Strategies

The platform is designed for minimal token usage:

| Strategy | Implementation |
|----------|----------------|
| Reference-based returns | Large outputs return `sha256:` refs instead of inline content |
| Paged retrieval | 4KB default pages, configurable up to 64KB |
| Compact tool cards | Search returns minimal metadata, full spec on demand |
| Structured metadata | Offsets and citations enable precise retrieval |
| Hierarchical summarization | Map-reduce compression with citation tracking |

### Example Flow

```typescript
// 1. Invoke OCR tool
const result = await trpc.mcp.invokeTool.mutate({
  toolName: "doc.ocr_image_or_pdf",
  args: { path: "/data/document.pdf", language: "eng" },
  options: { returnRef: true }
});
// Returns: { success: true, data: { textRef: "sha256:abc123...", pages: 5 } }

// 2. Retrieve content with paging
const page1 = await trpc.mcp.getRef.query({
  ref: "sha256:abc123...",
  page: 1,
  pageSize: 4096
});
// Returns: { content: "...", page: 1, totalPages: 10, hasMore: true }
```

## Important Patterns

### Plugin Registration

All tools are registered in `server/mcp/plugins/registry.ts` in the `registerBuiltinTools()` function:

```typescript
registry.registerTool({
  name: 'category.tool_name',
  category: 'category',
  description: 'Brief description',
  version: '1.0.0',
  tags: ['tag1', 'tag2'],
  inputSchema: { /* Zod-like schema */ },
  outputSchema: { /* Zod-like schema */ },
  permissions: ['read:filesystem', 'access:llm'],
});
```

### Content References

Instead of returning large content inline, use content-addressed references:

```typescript
import { ContentStore } from './store/content-store';

const store = ContentStore.getInstance();
const ref = await store.store(largeContent);
// ref = "sha256:abc123..."

// Later retrieval
const content = await store.get(ref);
```

### Type Safety

All MCP types are defined in `shared/mcp-types/index.ts`:
- `ToolSpec` - Full tool specification
- `ToolCard` - Minimal tool metadata
- `ToolPermission` - Permission levels
- `InvokeRequest` - Tool invocation request
- `InvokeResponse` - Tool invocation response

## Common Tasks

### Adding a New Tool

1. Define the tool in `server/mcp/plugins/registry.ts`:
```typescript
registry.registerTool({
  name: 'my_category.my_tool',
  category: 'my_category',
  description: 'What this tool does',
  version: '1.0.0',
  tags: ['relevant', 'tags'],
  inputSchema: { /* ... */ },
  outputSchema: { /* ... */ },
  permissions: ['required', 'permissions'],
});
```

2. Implement the tool logic in `server/mcp/plugins/my-category.ts`

3. Wire it to the executor in `server/mcp/workers/executor.ts`

4. Add tests in `server/mcp/plugins/my-category.test.ts`

### Searching for Tools

```typescript
const results = await trpc.mcp.searchTools.query({
  query: "extract entities",
  topK: 10,
  category: "nlp"
});
```

### Invoking Tools

```typescript
const result = await trpc.mcp.invokeTool.mutate({
  toolName: "nlp.extract_entities",
  args: { textRef: "sha256:...", provider: "auto" },
  options: { returnRef: true }
});
```

## Current Implementation Status

### Phase 1 (Complete) ✅
- Gateway API (4 endpoints)
- Content-addressed storage
- Plugin registry
- Tool search and discovery
- Basic plugins (search, document, nlp)

### Phase 2 (In Progress)
- **Database Connections** - Wiring Qdrant, Neo4j, mem0, n8n with real connections
- Settings UI for database configuration
- Health check endpoints
- Comprehensive testing

See `PHASE_2_QUICKSTART.md` for implementation guide.

### Phase 3 (Planned)
- Remaining 40+ tools wired to executor
- Full HITL implementation
- Export pipelines to final DBs
- Observability and tracing

## Testing Guidelines

Tests use Vitest with the following patterns:

```typescript
import { describe, it, expect } from 'vitest';

describe('MyPlugin', () => {
  it('should perform operation', async () => {
    const result = await myPlugin.operation(args);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });
});
```

Test files are colocated with source:
- `server/mcp/plugins/vector-db.ts` → `server/mcp/plugins/vector-db.test.ts`

## Key Dependencies

**Core:**
- `express` - HTTP server
- `@trpc/server` - tRPC backend
- `drizzle-orm` - Database ORM
- `zod` - Schema validation

**Database Clients:**
- `@qdrant/js-client-rest` - Qdrant vector DB
- `neo4j-driver` - Neo4j graph DB
- `mysql2` - MySQL client

**Frontend:**
- `react` - UI framework
- `@tanstack/react-query` - Data fetching
- `@trpc/react-query` - tRPC React integration
- `wouter` - Routing
- `@radix-ui/*` - UI components

**Utilities:**
- `pino` - Logging
- `axios` - HTTP client
- `nanoid` - ID generation
- `jose` - JWT handling
- `superjson` - Serialization

## Important Notes

### Token Efficiency is Critical
- ALWAYS use content references (`sha256:...`) for large data
- NEVER return full content inline if > 4KB
- Use paging for large results
- Return compact tool cards in search, full specs only on demand

### Security
- All file operations are sandboxed
- Destructive operations require HITL approval
- Permissions are enforced at the executor level
- Content is deduplicated and immutable

### Performance
- Content store uses SHA-256 for O(1) lookups
- Plugin registry uses tag indexing for fast search
- Database connections are pooled
- Embeddings are batched

### Python Interop
- Python tools use `server/mcp/python-bridge.ts`
- Requires Python 3.8+ with required packages
- Communication via JSON-RPC over stdio

### Logging
- Use `server/mcp/utils/logger.ts` for structured logging
- Pretty print in development, JSON in production
- Include context (userId, toolName, requestId)

## Troubleshooting

### Database Connection Issues
```bash
# Check Docker services
docker-compose ps

# View logs
docker-compose logs qdrant
docker-compose logs neo4j

# Test connectivity
curl http://localhost:6333/health  # Qdrant
curl -u neo4j:password http://localhost:7474/db/neo4j/summary  # Neo4j
```

### Build Failures
```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Type check
pnpm check
```

### Test Failures
```bash
# Run in verbose mode
pnpm test -- --reporter=verbose

# Run specific test
pnpm test -- -t "test name pattern"

# Enable debug logging
DEBUG=* pnpm test
```

## Git Workflow

This project uses feature branches. Current branch: `claude/update-claude-md-c1sCg`

**Branch naming:** `claude/<description>-<session-id>`

```bash
# Always develop on the designated branch
git checkout claude/update-claude-md-c1sCg

# Commit with clear messages
git add .
git commit -m "feat: add new tool for X"

# Push to remote (with -u flag first time)
git push -u origin claude/update-claude-md-c1sCg
```

## Resources

- [README.md](./README.md) - User-facing documentation
- [PHASE_2_QUICKSTART.md](./PHASE_2_QUICKSTART.md) - Implementation guide
- [PHASE_2_DATABASE_CONNECTIONS.md](./PHASE_2_DATABASE_CONNECTIONS.md) - Database setup
- [GAP_ANALYSIS.md](./GAP_ANALYSIS.md) - Missing features
- [Qdrant Docs](https://qdrant.tech/documentation/)
- [Neo4j Driver Docs](https://neo4j.com/docs/driver-manual/current/)
- [tRPC Docs](https://trpc.io/)

## Quick Reference

### File Locations
- Gateway API: `server/mcp/gateway.ts`
- Plugin Registry: `server/mcp/plugins/registry.ts`
- Content Store: `server/mcp/store/content-store.ts`
- Types: `shared/mcp-types/index.ts`
- Logger: `server/mcp/utils/logger.ts`

### Port Numbers
- Dev Server: 3000 (frontend + backend)
- Qdrant: 6333
- Neo4j Bolt: 7687
- Neo4j HTTP: 7474

### Commands Cheat Sheet
```bash
pnpm install           # Install dependencies
pnpm dev               # Start dev server
pnpm build             # Build for production
pnpm start             # Run production server
pnpm test              # Run tests
pnpm check             # Type check
pnpm format            # Format code
pnpm db:push           # Push database schema
```

---

Last Updated: 2026-01-04
Project Version: 1.0.0
