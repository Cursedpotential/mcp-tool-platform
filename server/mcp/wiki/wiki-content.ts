/**
 * Wiki/Documentation Content System
 * 
 * Provides comprehensive documentation for the MCP Tool Platform
 * including tool catalog, architecture, API reference, and best practices.
 */

// ============================================================================
// Types
// ============================================================================

export interface WikiPage {
  slug: string;
  title: string;
  category: string;
  content: string;
  lastUpdated: string;
  tags: string[];
}

export interface WikiCategory {
  name: string;
  description: string;
  pages: string[]; // slugs
}

// ============================================================================
// Wiki Content
// ============================================================================

export const WIKI_CATEGORIES: WikiCategory[] = [
  {
    name: 'Getting Started',
    description: 'Introduction and setup guides',
    pages: ['overview', 'quick-start', 'authentication'],
  },
  {
    name: 'Tool Catalog',
    description: 'Documentation for all available tools',
    pages: ['document-tools', 'nlp-tools', 'search-tools', 'ml-tools', 'retrieval-tools', 'summarization-tools'],
  },
  {
    name: 'Architecture',
    description: 'System design and internals',
    pages: ['architecture-overview', 'content-store', 'worker-swarm', 'plugin-system'],
  },
  {
    name: 'API Reference',
    description: 'API endpoints and usage',
    pages: ['api-overview', 'mcp-gateway', 'rest-api', 'websocket-api'],
  },
  {
    name: 'Best Practices',
    description: 'Guides for optimal usage',
    pages: ['token-efficiency', 'large-file-processing', 'llm-routing', 'security'],
  },
  {
    name: 'Platform Integration',
    description: 'Integrating with AI platforms',
    pages: ['claude-integration', 'gemini-integration', 'openai-integration'],
  },
];

export const WIKI_PAGES: Record<string, WikiPage> = {
  'overview': {
    slug: 'overview',
    title: 'MCP Tool Platform Overview',
    category: 'Getting Started',
    lastUpdated: '2024-12-31',
    tags: ['introduction', 'overview'],
    content: `
# MCP Tool Platform Overview

The MCP Tool Platform is a comprehensive **preprocessing tool shop** designed to achieve 85%+ token reduction before data flows into your final databases (Neo4j, Supabase, Vector DBs).

## What It Does

Think of it as the "Home Depot of preprocessing tools" - a one-stop shop for all your document processing, NLP, and analysis needs:

- **Document Processing**: Convert, OCR, chunk, and normalize documents
- **NLP Analysis**: Entity extraction, keyword extraction, sentiment analysis
- **Search**: Fast text search with ripgrep/ugrep
- **Summarization**: Hierarchical map-reduce for large documents
- **ML Features**: Embeddings, semantic search, classification (optional)

## Key Features

### Token Efficiency
The platform is designed to minimize LLM token usage by:
- Preprocessing documents locally before sending to LLMs
- Storing intermediate results in Chroma (working memory)
- Using content-addressed storage for deduplication
- Providing paged retrieval for large results

### Multi-Provider LLM Support
Route tasks to the optimal provider:
- **Local**: Ollama, LM Studio (free, private)
- **Cloud**: OpenAI, Anthropic, Gemini, Groq, OpenRouter
- **CLI**: Claude Code, Gemini CLI, aider

### Platform Integration
Generate configs for any AI platform:
- Claude Desktop MCP format with skills
- Gemini Extensions with proper manifests
- OpenAI function calling format

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                    MCP Gateway API                       │
│  search_tools | describe_tool | invoke_tool | get_ref   │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Document │    │   NLP    │    │  Search  │
    │  Plugin  │    │  Plugin  │    │  Plugin  │
    └──────────┘    └──────────┘    └──────────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
              ┌────────────────────────┐
              │   Content-Addressed    │
              │        Store           │
              │   (SHA-256 refs)       │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Chroma Working       │
              │       Memory           │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Export Pipelines     │
              │ Neo4j | Supabase | VDB │
              └────────────────────────┘
\`\`\`
`,
  },

  'quick-start': {
    slug: 'quick-start',
    title: 'Quick Start Guide',
    category: 'Getting Started',
    lastUpdated: '2024-12-31',
    tags: ['setup', 'tutorial'],
    content: `
# Quick Start Guide

Get up and running with the MCP Tool Platform in minutes.

## 1. Generate an API Key

1. Log in to the dashboard
2. Go to **Settings** → **API Keys**
3. Click **Generate New Key**
4. Copy the key (shown only once!)

## 2. Configure Your AI Client

### For Claude Desktop

Download the config from **Settings** → **Platform Configs** → **Claude Desktop**

Or manually add to \`~/Library/Application Support/Claude/claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "preprocessing-toolshop": {
      "url": "https://your-domain.manus.space/api/mcp",
      "headers": {
        "Authorization": "Bearer mcp_sk_your_key_here"
      }
    }
  }
}
\`\`\`

### For Gemini

Download the extension manifest from **Settings** → **Platform Configs** → **Gemini Extension**

### For OpenAI

Use the function definitions from **Settings** → **Platform Configs** → **OpenAI Functions**

## 3. Test a Tool

Try searching for tools:

\`\`\`bash
curl -X POST https://your-domain.manus.space/api/mcp/search_tools \\
  -H "Authorization: Bearer mcp_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "extract entities"}'
\`\`\`

## 4. Process Your First Document

\`\`\`bash
# Convert a document to markdown
curl -X POST https://your-domain.manus.space/api/mcp/invoke_tool \\
  -H "Authorization: Bearer mcp_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "toolName": "document.convert",
    "args": {
      "filePath": "/path/to/document.pdf",
      "format": "markdown"
    }
  }'
\`\`\`

## Next Steps

- Explore the [Tool Catalog](/wiki/document-tools) to see all available tools
- Learn about [Token Efficiency](/wiki/token-efficiency) best practices
- Set up [LLM Routing](/wiki/llm-routing) for optimal provider selection
`,
  },

  'authentication': {
    slug: 'authentication',
    title: 'Authentication',
    category: 'Getting Started',
    lastUpdated: '2024-12-31',
    tags: ['auth', 'api-keys', 'security'],
    content: `
# Authentication

The MCP Tool Platform uses API key authentication for all MCP client requests.

## API Key Format

Keys follow the format: \`mcp_sk_{64_hex_characters}\`

Example: \`mcp_sk_a1b2c3d4e5f6...\`

## Using API Keys

Include the key in the Authorization header:

\`\`\`
Authorization: Bearer mcp_sk_your_key_here
\`\`\`

## Key Permissions

Each key can have granular permissions:

| Permission | Description |
|------------|-------------|
| \`tools:read\` | List and describe tools |
| \`tools:execute\` | Invoke tools |
| \`config:read\` | Read configurations |
| \`config:write\` | Modify configurations |
| \`admin:*\` | Full administrative access |

## Key Management

### Generate a New Key

1. Go to **Settings** → **API Keys**
2. Click **Generate New Key**
3. Set a name and permissions
4. Copy the key immediately (shown only once!)

### Rotate a Key

1. Go to **Settings** → **API Keys**
2. Find the key to rotate
3. Click **Rotate**
4. A new key is generated, old key is revoked

### Revoke a Key

1. Go to **Settings** → **API Keys**
2. Find the key to revoke
3. Click **Revoke**

## Security Best Practices

- Never commit API keys to version control
- Use environment variables for key storage
- Rotate keys regularly (every 90 days recommended)
- Use the minimum required permissions
- Monitor key usage in the Stats dashboard
`,
  },

  'document-tools': {
    slug: 'document-tools',
    title: 'Document Tools',
    category: 'Tool Catalog',
    lastUpdated: '2024-12-31',
    tags: ['tools', 'document', 'ocr', 'conversion'],
    content: `
# Document Tools

Tools for document conversion, OCR, and text extraction.

## document.convert

Convert documents between formats using Pandoc.

**Input Schema:**
\`\`\`json
{
  "filePath": "string - Path to source document",
  "format": "string - Target format (markdown, text, html, docx)",
  "options": {
    "preserveImages": "boolean - Keep image references",
    "extractMetadata": "boolean - Include document metadata"
  }
}
\`\`\`

**Output:**
\`\`\`json
{
  "contentRef": "sha256:... - Reference to converted content",
  "format": "string - Output format",
  "metadata": { ... }
}
\`\`\`

**Example:**
\`\`\`json
{
  "toolName": "document.convert",
  "args": {
    "filePath": "/uploads/report.pdf",
    "format": "markdown"
  }
}
\`\`\`

---

## document.ocr

Extract text from images and scanned PDFs using Tesseract.

**Input Schema:**
\`\`\`json
{
  "filePath": "string - Path to image or PDF",
  "language": "string - Language code (eng, fra, deu, etc.)",
  "options": {
    "deskew": "boolean - Auto-correct rotation",
    "denoise": "boolean - Remove noise",
    "preserveLayout": "boolean - Maintain spatial layout"
  }
}
\`\`\`

**Output:**
\`\`\`json
{
  "textRef": "sha256:... - Reference to extracted text",
  "confidence": "number - OCR confidence score (0-100)",
  "pages": "number - Number of pages processed"
}
\`\`\`

---

## document.chunk

Split documents into semantic chunks for processing.

**Input Schema:**
\`\`\`json
{
  "contentRef": "string - Reference to document content",
  "chunkSize": "number - Target chunk size in tokens (default: 512)",
  "overlap": "number - Overlap between chunks (default: 50)",
  "strategy": "string - Chunking strategy (semantic, fixed, paragraph)"
}
\`\`\`

**Output:**
\`\`\`json
{
  "chunksRef": "sha256:... - Reference to chunks array",
  "chunkCount": "number - Total chunks created",
  "avgChunkSize": "number - Average tokens per chunk"
}
\`\`\`

---

## document.normalize

Normalize text formatting and encoding.

**Input Schema:**
\`\`\`json
{
  "contentRef": "string - Reference to text content",
  "options": {
    "lowercase": "boolean - Convert to lowercase",
    "removeExtraWhitespace": "boolean - Collapse whitespace",
    "normalizeUnicode": "boolean - Normalize unicode characters",
    "stripHtml": "boolean - Remove HTML tags"
  }
}
\`\`\`
`,
  },

  'nlp-tools': {
    slug: 'nlp-tools',
    title: 'NLP Tools',
    category: 'Tool Catalog',
    lastUpdated: '2024-12-31',
    tags: ['tools', 'nlp', 'entities', 'keywords'],
    content: `
# NLP Tools

Natural language processing tools for text analysis.

## nlp.extract_entities

Extract named entities from text.

**Supported Entity Types:**
- PERSON - People's names
- ORG - Organizations, companies
- LOCATION - Places, addresses
- DATE - Dates and times
- MONEY - Monetary values
- PERCENT - Percentages
- EVENT - Named events
- PRODUCT - Products, services

**Input Schema:**
\`\`\`json
{
  "textRef": "string - Reference to text content",
  "entityTypes": ["PERSON", "ORG", "LOCATION"],
  "provider": "string - NLP provider (spacy, compromise, api)"
}
\`\`\`

**Output:**
\`\`\`json
{
  "entitiesRef": "sha256:...",
  "entities": [
    {
      "text": "John Smith",
      "type": "PERSON",
      "start": 0,
      "end": 10,
      "confidence": 0.95
    }
  ],
  "count": 42
}
\`\`\`

---

## nlp.extract_keywords

Extract important keywords and phrases.

**Input Schema:**
\`\`\`json
{
  "textRef": "string - Reference to text content",
  "maxKeywords": "number - Maximum keywords to return (default: 20)",
  "algorithm": "string - Extraction algorithm (tfidf, rake, textrank)"
}
\`\`\`

**Output:**
\`\`\`json
{
  "keywords": [
    { "term": "machine learning", "score": 0.89 },
    { "term": "neural network", "score": 0.76 }
  ]
}
\`\`\`

---

## nlp.detect_language

Detect the language of text.

**Input Schema:**
\`\`\`json
{
  "textRef": "string - Reference to text content"
}
\`\`\`

**Output:**
\`\`\`json
{
  "language": "en",
  "confidence": 0.98,
  "alternatives": [
    { "language": "de", "confidence": 0.02 }
  ]
}
\`\`\`

---

## nlp.sentiment

Analyze sentiment of text.

**Input Schema:**
\`\`\`json
{
  "textRef": "string - Reference to text content",
  "granularity": "string - Analysis level (document, paragraph, sentence)"
}
\`\`\`

**Output:**
\`\`\`json
{
  "sentiment": "positive",
  "score": 0.72,
  "breakdown": {
    "positive": 0.72,
    "negative": 0.15,
    "neutral": 0.13
  }
}
\`\`\`
`,
  },

  'search-tools': {
    slug: 'search-tools',
    title: 'Search Tools',
    category: 'Tool Catalog',
    lastUpdated: '2024-12-31',
    tags: ['tools', 'search', 'ripgrep', 'regex'],
    content: `
# Search Tools

Fast text search tools using ripgrep and ugrep.

## search.ripgrep

Search files using ripgrep (rg).

**Features:**
- Blazing fast (faster than grep, ag, ack)
- Respects .gitignore by default
- Regex and literal search
- Context lines support
- File type filtering

**Input Schema:**
\`\`\`json
{
  "pattern": "string - Search pattern (regex or literal)",
  "path": "string - Directory or file to search",
  "options": {
    "caseSensitive": "boolean - Case sensitive search",
    "wholeWord": "boolean - Match whole words only",
    "regex": "boolean - Treat pattern as regex",
    "contextLines": "number - Lines of context (default: 2)",
    "maxResults": "number - Maximum results to return",
    "fileTypes": ["string"] - File extensions to include"
  }
}
\`\`\`

**Output:**
\`\`\`json
{
  "matchesRef": "sha256:...",
  "totalMatches": 142,
  "filesMatched": 23,
  "matches": [
    {
      "file": "/path/to/file.txt",
      "line": 42,
      "column": 15,
      "text": "matched line content",
      "context": {
        "before": ["line 40", "line 41"],
        "after": ["line 43", "line 44"]
      }
    }
  ]
}
\`\`\`

---

## search.ugrep

Search files using ugrep (alternative to ripgrep).

**Additional Features:**
- Fuzzy matching
- Boolean queries
- Archive search (zip, tar, etc.)
- PDF/Office document search

**Input Schema:**
\`\`\`json
{
  "pattern": "string - Search pattern",
  "path": "string - Directory or file to search",
  "options": {
    "fuzzy": "number - Fuzzy match distance (0-3)",
    "boolean": "boolean - Enable boolean operators (AND, OR, NOT)",
    "searchArchives": "boolean - Search inside archives"
  }
}
\`\`\`
`,
  },

  'token-efficiency': {
    slug: 'token-efficiency',
    title: 'Token Efficiency Best Practices',
    category: 'Best Practices',
    lastUpdated: '2024-12-31',
    tags: ['best-practices', 'tokens', 'optimization'],
    content: `
# Token Efficiency Best Practices

Achieve 85%+ token reduction with these strategies.

## 1. Preprocess Before LLM

Don't send raw documents to LLMs. Instead:

\`\`\`
Raw Document (10,000 tokens)
    │
    ▼
┌─────────────────┐
│ document.convert │ → Markdown (8,000 tokens)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ document.chunk  │ → Relevant chunks only (2,000 tokens)
└─────────────────┘
    │
    ▼
┌─────────────────┐
│ nlp.extract_*   │ → Structured data (500 tokens)
└─────────────────┘
    │
    ▼
LLM receives structured summary (500 tokens = 95% reduction!)
\`\`\`

## 2. Use Content-Addressed Storage

Store large results once, reference by SHA-256:

\`\`\`json
// Instead of embedding 10,000 tokens in response:
{
  "fullTextRef": "sha256:abc123...",
  "summary": "Brief summary here",
  "entityCount": 42
}

// Retrieve pages as needed:
GET /api/mcp/get_ref?ref=sha256:abc123&page=1&pageSize=100
\`\`\`

## 3. Extract Structure First

Before summarization, extract:
- Entities (people, places, orgs)
- Keywords and topics
- Document outline/structure
- Dates and numbers

This gives the LLM context without full text.

## 4. Use Hierarchical Summarization

For large documents (50+ pages):

\`\`\`
Document
    │
    ├── Chunk 1 → Summary 1
    ├── Chunk 2 → Summary 2
    ├── Chunk 3 → Summary 3
    └── Chunk N → Summary N
           │
           ▼
    Combined Summaries
           │
           ▼
    Final Summary (with citations)
\`\`\`

## 5. Cache Intermediate Results

Use Chroma as working memory:

\`\`\`typescript
// Store processed chunks
await chroma.addDocuments(chunks, { jobId: 'job-123' });

// Query later without reprocessing
const relevant = await chroma.query('search term', { jobId: 'job-123' });
\`\`\`

## 6. Smart LLM Routing

Use local models for simple tasks:

| Task | Model | Cost |
|------|-------|------|
| Keyword extraction | Local Ollama | Free |
| Sentiment analysis | Local Ollama | Free |
| Entity extraction | spaCy (no LLM) | Free |
| Complex analysis | Claude/GPT-4 | Paid |
| Long context | Gemini 2M | Paid |
`,
  },

  'claude-integration': {
    slug: 'claude-integration',
    title: 'Claude Desktop Integration',
    category: 'Platform Integration',
    lastUpdated: '2024-12-31',
    tags: ['claude', 'mcp', 'integration'],
    content: `
# Claude Desktop Integration

Set up the MCP Tool Platform with Claude Desktop.

## Configuration

Add to \`~/Library/Application Support/Claude/claude_desktop_config.json\`:

\`\`\`json
{
  "mcpServers": {
    "preprocessing-toolshop": {
      "url": "https://your-domain.manus.space/api/mcp",
      "headers": {
        "Authorization": "Bearer mcp_sk_your_key"
      }
    }
  }
}
\`\`\`

## Skills

The platform provides pre-built skills that teach Claude how to use the tools effectively:

### Document Preprocessing Skill
\`\`\`
When the user wants to process a document:
1. First use document.convert to convert to markdown
2. If it's an image/scanned PDF, use document.ocr
3. Use document.chunk to split into manageable pieces
4. Store results in Chroma for further processing
\`\`\`

### Entity Extraction Skill
\`\`\`
For entity extraction tasks:
1. First detect the language with nlp.detect_language
2. Use nlp.extract_entities to find people, places, organizations
3. Use nlp.extract_keywords for important terms
4. Return structured results ready for graph database import
\`\`\`

### Semantic Search Skill
\`\`\`
For search tasks:
1. Generate embeddings for the query with ml.generate_embeddings
2. Use retrieval.bm25_search for keyword matching
3. Use retrieval.semantic_search for meaning-based results
4. Combine and rank results for best matches
\`\`\`

## Best Practices for Claude

1. **Use prompt caching** - Claude caches system prompts, so include tool documentation in the system message
2. **Batch operations** - Group related tool calls to reduce round trips
3. **Stream results** - Use streaming for long-running operations
4. **Handle errors gracefully** - Tools return structured errors that Claude can interpret

## Example Conversation

**User:** Process this 50-page PDF and extract all the people and companies mentioned.

**Claude:** I'll process this document using the preprocessing tools:

1. First, let me convert the PDF to markdown...
   \`document.convert({ filePath: "report.pdf", format: "markdown" })\`

2. Now I'll extract entities...
   \`nlp.extract_entities({ textRef: "sha256:...", entityTypes: ["PERSON", "ORG"] })\`

3. Found 42 people and 15 organizations. Here's the summary...
`,
  },

  'architecture-overview': {
    slug: 'architecture-overview',
    title: 'Architecture Overview',
    category: 'Architecture',
    lastUpdated: '2024-12-31',
    tags: ['architecture', 'design', 'internals'],
    content: `
# Architecture Overview

The MCP Tool Platform is designed as a modular, extensible preprocessing system.

## Core Components

### 1. MCP Gateway API

The gateway provides four token-efficient endpoints:

| Endpoint | Purpose |
|----------|---------|
| \`search_tools\` | Discover available tools by query |
| \`describe_tool\` | Get full specification for a tool |
| \`invoke_tool\` | Execute a tool with arguments |
| \`get_ref\` | Retrieve content by SHA-256 reference |

### 2. Plugin System

Tools are organized into plugins:

\`\`\`
plugins/
├── document.ts    # Document conversion, OCR, chunking
├── nlp.ts         # Entity extraction, keywords, sentiment
├── search.ts      # ripgrep, ugrep integration
├── ml.ts          # Embeddings, classification (optional)
├── retrieval.ts   # BM25, semantic search
├── summarization.ts # Map-reduce summarization
├── rules.ts       # Pattern matching engine
├── diff.ts        # Text comparison
└── filesystem.ts  # File operations
\`\`\`

### 3. Content-Addressed Store

Large results are stored by SHA-256 hash:

\`\`\`typescript
// Store content
const ref = await store.put(content); // Returns "sha256:abc123..."

// Retrieve with paging
const page = await store.getPage(ref, { page: 1, pageSize: 100 });
\`\`\`

Benefits:
- Automatic deduplication
- Token-efficient references
- Paged retrieval for large results

### 4. Chroma Working Memory

Intermediate results are stored in Chroma during processing:

\`\`\`typescript
// Create a processing job
const job = await chroma.createCollection('job-123');

// Store chunks with embeddings
await job.add(chunks, embeddings, metadata);

// Query during processing
const relevant = await job.query(queryEmbedding, { topK: 10 });

// Export when done
await job.export('neo4j'); // or 'supabase', 'pinecone'
\`\`\`

### 5. LLM Provider Hub

Smart routing across providers:

\`\`\`
Task Request
    │
    ▼
┌─────────────────┐
│  Smart Router   │
│  - Task type    │
│  - Cost budget  │
│  - Latency req  │
└─────────────────┘
    │
    ├── Simple → Local Ollama (free)
    ├── Complex → Claude/GPT-4 (paid)
    └── Long context → Gemini 2M (paid)
\`\`\`

### 6. Export Pipelines

Route processed data to final destinations:

\`\`\`
Processed Data
    │
    ├── Entities + Relations → Neo4j
    ├── Structured Data → Supabase
    ├── Embeddings → Vector DB
    └── Files → S3
\`\`\`

## Data Flow

\`\`\`
1. Client calls invoke_tool
2. Gateway validates API key
3. Plugin executes tool
4. Large results stored in Content Store
5. Intermediate data cached in Chroma
6. Response returns refs + summary
7. Client retrieves pages as needed
8. Final export to destination DBs
\`\`\`
`,
  },
};

// ============================================================================
// Wiki Functions
// ============================================================================

/**
 * Get all wiki categories
 */
export function getWikiCategories(): WikiCategory[] {
  return WIKI_CATEGORIES;
}

/**
 * Get a wiki page by slug
 */
export function getWikiPage(slug: string): WikiPage | null {
  return WIKI_PAGES[slug] || null;
}

/**
 * Get all pages in a category
 */
export function getPagesByCategory(category: string): WikiPage[] {
  const cat = WIKI_CATEGORIES.find(c => c.name === category);
  if (!cat) return [];
  
  return cat.pages
    .map(slug => WIKI_PAGES[slug])
    .filter((page): page is WikiPage => page !== undefined);
}

/**
 * Search wiki pages
 */
export function searchWiki(query: string): WikiPage[] {
  const lowerQuery = query.toLowerCase();
  
  return Object.values(WIKI_PAGES).filter(page => {
    return (
      page.title.toLowerCase().includes(lowerQuery) ||
      page.content.toLowerCase().includes(lowerQuery) ||
      page.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  });
}

/**
 * Get all wiki pages
 */
export function getAllWikiPages(): WikiPage[] {
  return Object.values(WIKI_PAGES);
}
