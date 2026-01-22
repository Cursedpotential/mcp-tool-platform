<!-- File: README.md | Date: 2026-01-11 | Agent: Claude Code | Model: Opus 4.1 -->

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

### Service Map (Two-VPS split)

- **Nexus (116.203.199.238, storage)**: `postgres` (TCP, tailnet/Access), `cms` (Directus), `photos` (PhotoPrism), `n8n`, `nexus` (Coolify UI; public behind Access). Logging stack TBD.
- **Forge (188.245.189.218 / 116.203.198.77 for UI, compute)**: `llm` (LiteLLM), `mcp` (MetaMCP), `chroma`, `ollama`, `ui` (Open WebUI/LibreChat), `kasm` (desktop, tailnet/Access/backdoor via Access/CF basic auth), `browser` (browserless/playwright, tailnet/Access). Logging stack TBD.
- Dragonfly backs LiteLLM caching (Redis-compatible); Chroma for vectors; Postgres/PGVector on Nexus; Neo4j/Graphiti for graphs.

### Headless Colab Enterprise

- Configurable in Settings (project/region/runtime/service account/notebook/sync bucket).
- Runs GPU notebooks/jobs headlessly; outputs can sync to R2 or Nexus storage.
- UI embedding is not used; access via job runner APIs/MCP tools.

### Postgres Extensions (Nexus)

- Require Supabase-style set: `vector`, `postgis` (+raster/topology/sfcgal), `pg_graphql`, `pg_net`, `pg_cron`, `pgsodium`, `wrappers`, `pgroonga`, `rum`, `bloom`, `pg_trgm`, `pg_stat_statements`, `citext`, `hstore`, `uuid-ossp`, `pgcrypto`, `btree_gin/gist`, `pg_repack`, `pgmq`, `pg_walinspect`, `pgaudit`, `pg_prewarm`, `pg_hashids`, `pg_jsonschema`.

## Core Features

### MCP Gateway API (4 Endpoints)

| Endpoint        | Purpose                     | Token Efficiency                                  |
| --------------- | --------------------------- | ------------------------------------------------- |
| `search_tools`  | Discover available tools    | Returns compact tool cards (name, category, tags) |
| `describe_tool` | Get full tool specification | On-demand loading of schemas and examples         |
| `invoke_tool`   | Execute tools               | Reference-based returns for large outputs         |
| `get_ref`       | Retrieve content            | Paged retrieval (4KB default pages)               |

### Content-Addressed Storage

All large artifacts are stored using SHA-256 content hashes, enabling:

- **Deduplication**: Identical content stored once
- **Paging**: Token-efficient retrieval of large results
- **Caching**: Content-addressed lookups for repeated operations

### Plugin Suite

| Category          | Tools                                                                                          | Description                                |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Search**        | `search.ripgrep`, `search.ugrep`                                                               | Fast regex search with JSON output         |
| **Document**      | `doc.convert_to_markdown`, `doc.ocr_image_or_pdf`, `doc.segment`                               | Pandoc conversion, Tesseract OCR, chunking |
| **NLP**           | `nlp.detect_language`, `nlp.extract_entities`, `nlp.extract_keywords`, `nlp.analyze_sentiment` | Provider-agnostic NLP operations           |
| **Rules**         | `rules.evaluate`                                                                               | YAML/JSON rule sets with pattern matching  |
| **Diff**          | `diff.text`, `diff.similarity`                                                                 | Text comparison and similarity analysis    |
| **Filesystem**    | `fs.list_dir`, `fs.read_file`, `fs.write_file`                                                 | Sandboxed file operations                  |
| **ML**            | `ml.embed`, `ml.semantic_search`                                                               | Embeddings and semantic search (optional)  |
| **Summarization** | `summarize.hierarchical`                                                                       | Map-reduce summarization with citations    |
| **Retrieval**     | `retrieve.supporting_spans`                                                                    | BM25 + semantic retrieval                  |

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

## Documentation Structure

The project documentation is organized into the following categories in the `docs/` directory:

- [**Architecture**](docs/architecture/): Detailed design docs, data flow diagrams, and architectural analysis.
- [**Guides**](docs/guides/): Implementation guides, development workflows, and setup instructions.
- [**Reports**](docs/reports/): Code reviews, progress reports, and status updates.
- [**Analysis**](docs/analysis/): In-depth analysis of gaps, behavior, and research notes.
- [**Archive**](docs/archive/): Historical handoffs, task lists, and legacy documentation.

Core deployment documentation can be found in:
- [**DEPLOYMENT.md**](DEPLOYMENT.md): High-level deployment overview.
- [**Master Deployment Guide**](deploy/salem-trinity/MASTER_DEPLOYMENT_GUIDE.md): Comprehensive 3-VPS "Trinity" deployment instructions.

## Project Structure

```
├── client/             # Frontend React application
├── server/             # Backend Node.js/TypeScript server
│   ├── mcp/            # MCP Gateway logic and plugins
│   └── python-tools/   # Python-based ML and NLP utilities
├── shared/             # Shared TypeScript types and constants
├── docs/               # Project documentation (organized by category)
├── deploy/             # Deployment configurations and guides
│   └── salem-trinity/  # Master 3-VPS deployment suite
├── scripts/            # Maintenance and utility scripts
├── config/             # Configuration files
├── data/               # Local data storage and SQLite databases
└── n8n-workflows/      # Exported n8n workflow definitions
```

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

## License

MIT
