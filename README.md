# MCP Preprocessing Tool Shop

A token-efficient preprocessing platform designed for **85%+ token reduction** before data flows into final databases (Neo4j, Supabase, Vector DBs). This is the "Home Depot of preprocessing tools" - an intermediary system where heavy lifting happens so orchestrating agents receive pre-analyzed, structured data.

## Architecture Overview

```
Raw Documents → [MCP Tool Shop] → Preprocessed Data → Final DBs
                     ↓
              - OCR/Pandoc conversion
              - Entity extraction
              - Sentiment analysis
              - Graph relationship extraction
              - Chunking with citations
              - Embeddings (staging in Chroma)
              - Initial summarization
```

## Core Features

### MCP Gateway API (4 Endpoints)

| Endpoint | Purpose | Token Efficiency |
|----------|---------|------------------|
| `search_tools` | Discover available tools | Returns compact tool cards (name, category, tags) |
| `describe_tool` | Get full tool specification | On-demand loading of schemas and examples |
| `invoke_tool` | Execute tools | Reference-based returns for large outputs |
| `get_ref` | Retrieve content | Paged retrieval (4KB default pages) |

### Content-Addressed Storage

All large artifacts are stored using SHA-256 content hashes, enabling:
- **Deduplication**: Identical content stored once
- **Paging**: Token-efficient retrieval of large results
- **Caching**: Content-addressed lookups for repeated operations

### Plugin Suite

| Category | Tools | Description |
|----------|-------|-------------|
| **Search** | `search.ripgrep`, `search.ugrep` | Fast regex search with JSON output |
| **Document** | `doc.convert_to_markdown`, `doc.ocr_image_or_pdf`, `doc.segment` | Pandoc conversion, Tesseract OCR, chunking |
| **NLP** | `nlp.detect_language`, `nlp.extract_entities`, `nlp.extract_keywords`, `nlp.analyze_sentiment` | Provider-agnostic NLP operations |
| **Rules** | `rules.evaluate` | YAML/JSON rule sets with pattern matching |
| **Diff** | `diff.text`, `diff.similarity` | Text comparison and similarity analysis |
| **Filesystem** | `fs.list_dir`, `fs.read_file`, `fs.write_file` | Sandboxed file operations |
| **ML** | `ml.embed`, `ml.semantic_search` | Embeddings and semantic search (optional) |
| **Summarization** | `summarize.hierarchical` | Map-reduce summarization with citations |
| **Retrieval** | `retrieve.supporting_spans` | BM25 + semantic retrieval |

### Human-in-the-Loop (HITL)

All destructive operations require approval:
- Preview of proposed changes
- Diff visualization
- Rollback capability via content store
- Audit logging

### LLM Provider Support

Provider-agnostic design supporting:
- **Ollama** (cloud-hosted or local)
- **Gemini** (2.5 Flash/Pro)
- **OpenRouter** (free models)
- **OpenAI** / **Anthropic**
- **Local BERT** (sentence-transformers)

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- (Optional) ripgrep, ugrep, Pandoc, Tesseract for full plugin support

### Installation

```bash
# Clone and install dependencies
cd mcp-tool-platform
pnpm install

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

The platform uses pre-configured environment variables for:
- Database connection (`DATABASE_URL`)
- Authentication (`JWT_SECRET`, `OAUTH_SERVER_URL`)
- Built-in APIs (`BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`)

## API Usage

### Search for Tools

```typescript
const result = await trpc.mcp.searchTools.query({
  query: "extract entities",
  topK: 10,
  category: "nlp"
});
// Returns: { success: true, data: [{ name, category, description, tags }] }
```

### Get Tool Specification

```typescript
const spec = await trpc.mcp.describeTool.query({
  toolName: "nlp.extract_entities"
});
// Returns: Full schema, examples, permissions
```

### Invoke a Tool

```typescript
const result = await trpc.mcp.invokeTool.mutate({
  toolName: "doc.ocr_image_or_pdf",
  args: { path: "/data/document.pdf", language: "eng" },
  options: { returnRef: true }
});
// Returns: { success: true, data: { textRef: "sha256:...", pages: 5 } }
```

### Retrieve Large Content

```typescript
const page = await trpc.mcp.getRef.query({
  ref: "sha256:abc123...",
  page: 1,
  pageSize: 4096
});
// Returns: { content: "...", page: 1, totalPages: 10, hasMore: true }
```

## Data Flow

1. **Ingest**: Raw documents enter via filesystem or upload
2. **Convert**: Pandoc/Tesseract extract text content
3. **Analyze**: NLP plugins extract entities, sentiment, keywords
4. **Chunk**: Document segmentation with offset tracking
5. **Embed**: Optional ML embeddings for semantic search
6. **Stage**: Working memory in Chroma for intermediate results
7. **Export**: Structured data flows to Neo4j/Supabase/Vector DBs

## Token Efficiency Strategies

| Strategy | Implementation |
|----------|----------------|
| Reference-based returns | Large outputs return `sha256:` refs instead of inline content |
| Paged retrieval | 4KB default pages, configurable up to 64KB |
| Compact tool cards | Search returns minimal metadata, full spec on demand |
| Structured metadata | Offsets and citations enable precise retrieval |
| Hierarchical summarization | Map-reduce compression with citation tracking |

## Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/mcp/store/content-store.test.ts
```

## Project Structure

```
server/
  mcp/
    gateway.ts          # MCP Gateway API (4 endpoints)
    store/
      content-store.ts  # Content-addressed storage
    plugins/
      search.ts         # ripgrep/ugrep integration
      document.ts       # Pandoc/Tesseract
      nlp.ts            # Entity extraction, sentiment, etc.
      rules.ts          # Rule engine
      diff.ts           # Text comparison
      filesystem.ts     # Sandboxed file ops
      ml.ts             # Embeddings (optional)
      summarization.ts  # Map-reduce summarization
      retrieval.ts      # BM25 retrieval
      registry.ts       # Plugin registry
    workers/
      executor.ts       # Task execution
    hitl/
      approval.ts       # HITL approval system
    export/
      pipeline.ts       # Export to Neo4j/Supabase/VectorDB
    observability/
      tracing.ts        # Distributed tracing
shared/
  mcp-types/
    index.ts            # Shared type definitions
client/
  src/
    pages/
      Home.tsx          # Dashboard
```

## License

MIT
