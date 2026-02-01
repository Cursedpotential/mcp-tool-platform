# MCP Preprocessing Tool Shop

A comprehensive **MCP-compliant tool platform** providing 80+ preprocessing and analysis tools for document processing, NLP, forensics, vector databases, and more. Features **multi-store architecture** (MySQL + PostgreSQL + Neo4j + Chroma + Redis + Directus) optimized for both high-concurrency operations and complex evidence analysis.

## 🎯 What This Platform Does

This platform serves as a **centralized tool gateway** where heavy computational work happens before data flows to downstream systems (databases, orchestrating agents, or final storage). Think of it as the "Home Depot of preprocessing tools" - a well-organized toolkit that agents can discover and use.

## Core Capabilities

**Fully Implemented:**
- 📄 **Document Processing** - Pandoc conversion, Tesseract OCR, text segmentation
- 🔍 **Search** - ripgrep/ugrep integration with JSON output and JavaScript fallbacks
- 🧠 **NLP** - Entity extraction, sentiment analysis, keyword extraction, language detection
- 🔐 **Forensics** - Cryptographic evidence chain of custody with SHA-256 hashing
- 📊 **Vector Databases** - Chroma (in-memory + persistent), Qdrant, pgvector support
- 📚 **Library Tools** - Cheerio, XML, JSON5, YAML, CSV, Natural.js, Compromise
- 🗄️ **Pattern Management** - Store and manage behavioral patterns with full CRUD
- ⚙️ **Settings Management** - Configure LLM providers, databases, workflows

**Partially Implemented (Requires External Services):**
- 🤖 ML/Embeddings, Graph Databases (Neo4j/Graphiti), Python Bridge
- 🌐 Browser Search (Tavily/Perplexity), Workflow Automation (n8n)
- 📝 Summarization (requires LLM API), NotebookLM integration

## 📦 Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- (Optional) ripgrep, ugrep, Pandoc, Tesseract for full plugin support

### Installation

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

The platform will be available at `http://localhost:3000`

### Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL=your_database_url

# Authentication (optional)
JWT_SECRET=your_secret
OAUTH_SERVER_URL=your_oauth_url

# External APIs (optional)
BUILT_IN_FORGE_API_URL=http://your-vps
BUILT_IN_FORGE_API_KEY=your_key
```

## 🏗️ Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│                    External Agents                          │
│         (Claude, ChatGPT, Gemini, Custom Agents)            │
└────────────────────┬────────────────────────────────────────┘
                     │ MCP Protocol
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   MCP Gateway Layer                         │
│  • Tool Discovery (80+ tools across 10 categories)          │
│  • Tool Invocation (execute with parameters)                │
│  • Content References (SHA-256 based storage)               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Plugin Execution Layer                     │
│  • 26 plugin modules (13,265 lines)                         │
│  • JavaScript & Python providers                            │
│  • Content-addressed storage                                │
│  • Forensic chain of custody                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Storage Layer                             │
│  • Chroma (in-process working memory)                       │
│  • PostgreSQL/MySQL (structured data via Drizzle)           │
│  • pgvector (embeddings - requires Supabase)                │
│  • Neo4j (graph relationships - requires setup)             │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 API Usage

### MCP Gateway Endpoints

The platform exposes a standard MCP gateway with these endpoints:

#### 1. List Available Tools

```typescript
const tools = await trpc.mcp.listTools.query({
  category: "document", // optional: filter by category
  limit: 50
});
// Returns: [{ name, category, description, tags, inputSchema }]
```

#### 2. Search Tools Semantically

```typescript
const results = await trpc.mcp.searchTools.query({
  query: "extract entities from text",
  topK: 10
});
// Returns: Tools ranked by relevance
```

#### 3. Invoke a Tool

```typescript
const result = await trpc.mcp.invokeTool.mutate({
  toolName: "doc.ocr_image_or_pdf",
  args: {
    path: "/data/document.pdf",
    language: "eng"
  }
});
// Returns: { success: true, data: { ... } }
```

## 📚 Tool Categories

| Category | Tool Count | Description |
|----------|------------|-------------|
| **document** | 15+ | Pandoc conversion, OCR, text extraction, segmentation |
| **search** | 8+ | ripgrep, ugrep, BM25 retrieval, similarity search |
| **nlp** | 12+ | Entity extraction, sentiment, keywords, language detection |
| **vector-db** | 10+ | Chroma, Qdrant, pgvector operations |
| **forensics** | 6+ | Evidence hashing, chain of custody, verification |
| **library** | 15+ | Cheerio, XML, JSON5, YAML, Natural.js, Compromise |
| **diff** | 4+ | Text comparison, similarity analysis |
| **ml** | 8+ | Embeddings, semantic search (requires setup) |
| **graph-db** | 6+ | Neo4j/Graphiti operations (requires setup) |
| **browser** | 5+ | Search APIs (requires API keys) |

## 🎨 User Interface

### Pages Included

1. **Home** (`/`) - Landing page with tool categories and quick start
2. **Settings** (`/settings`) - Configure LLM providers, databases, workflows
3. **Tools** (`/tools`) - Browse, search, and test tools interactively
4. **Pattern Library** (`/patterns`) - Manage behavioral patterns (UI ready, needs backend wiring)

## 🗄️ Database Schema

The platform includes 18 comprehensive tables:

**Core Tables:**
- `users`, `apiKeys`, `apiKeyUsageLogs`
- `behavioralPatterns`, `patternCategories`
- `workflows`, `workflowTemplates`
- `systemPrompts`, `severityWeights`

**Document Intelligence:**
- `documents`, `documentSections`, `documentChunks`
- `documentSpans`, `documentSummaries`, `documentEntities`

**Evidence Management:**
- `evidenceChains`, `hurtlexTerms`, `mclFactors`

**Configuration:**
- `bertConfigs`, `forensicResults`, `schemaResolvers`

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Type checking
pnpm check

# Code formatting
pnpm format
```

## 📖 Project Structure

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

## 🚀 Use Cases

This platform can be used for:

1. **Document Preprocessing** - Convert, OCR, and extract structure from documents
2. **Forensic Analysis** - Maintain cryptographic evidence chains
3. **NLP Pipelines** - Extract entities, analyze sentiment, detect patterns
4. **Vector Search** - Semantic search across document collections
5. **Behavioral Analysis** - Detect patterns in communications
6. **Multi-Agent Orchestration** - Provide preprocessing tools to AI agents

## 🔐 Security Features

- **Evidence Chain of Custody** - SHA-256 hashing with verification
- **API Key Management** - Encrypted storage with usage tracking
- **Audit Logging** - Comprehensive activity tracking
- **Sandboxed Operations** - Controlled file system access

## 🚢 Deployment Architecture

> For detailed VPS deployment (salem-nexus/salem-forge), see [DEPLOYMENT.md](DEPLOYMENT.md) and [Master Deployment Guide](deploy/salem-trinity/MASTER_DEPLOYMENT_GUIDE.md)

**Multi-VPS "Trinity" Architecture:**
- **VPS1 (Nexus)**: PostgreSQL, Directus, PhotoPrism, n8n, Coolify
- **VPS2 (Forge)**: LiteLLM, MetaMCP, ChromaDB, Ollama, Kasm
- **VPS3 (Main)**: MySQL, Primary application backend

## Documentation Structure

The project documentation is organized into the following categories in the `docs/` directory:

- [**Architecture**](docs/architecture/): Detailed design docs, data flow diagrams, and architectural analysis.
- [**Guides**](docs/guides/): Implementation guides, development workflows, and setup instructions.
- [**Reports**](docs/reports/): Code reviews, progress reports, and status updates.
- [**Analysis**](docs/analysis/): In-depth analysis of gaps, behavior, and research notes.
- [**Archive**](docs/archive/): Historical handoffs, task lists, and legacy documentation.

## 📄 License

MIT

## 🤝 Contributing

This is an active development project. The core preprocessing features are production-ready, while external integrations (Python bridge, cloud services) are in development.

**Current Status:**
- ✅ 60-70% implemented (core features complete)
- ✅ MCP Gateway fully functional
- ✅ 26 plugins with 159 exported functions
- 🟡 External service integrations in progress

For more details, see `PROJECT_STATUS.md` for current implementation state.
