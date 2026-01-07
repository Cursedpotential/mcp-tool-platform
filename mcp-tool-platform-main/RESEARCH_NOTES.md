# Research Notes: MCP Preprocessing Tool Shop

> **Purpose**: This document synthesizes research findings from 7 parallel research tracks to inform the architecture and implementation of a preprocessing tool shop designed for 85%+ token reduction.

---

## Executive Summary

This preprocessing tool shop serves as an intermediary "Home Depot of tools" that processes raw documents before they flow into final databases (Neo4j, Supabase, vector DBs). The system uses **Chroma as working memory** during processing, supports **multiple LLM providers** (Ollama, Gemini, OpenRouter, BERT), and outputs structured, pre-analyzed data ready for ingestion.

### Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **MCP Transport** | Streamable HTTP | Multi-client support, SSE streaming, session management |
| **Server Pattern** | Composite Service | Reduces chattiness, maximizes token efficiency |
| **Vector Store** | Chroma (working memory) | Built-in persistence, metadata filtering, dev-friendly |
| **NLP Libraries** | spaCy + Transformers | spaCy for speed, Transformers for advanced tasks |
| **Search Tools** | ripgrep primary, ugrep fallback | JSON output, streaming, comprehensive filtering |
| **LLM Interface** | Provider-agnostic via adapters | Supports Ollama, Gemini, OpenRouter, local BERT |

---

## 1. MCP Protocol Specification

### Version Information
- **MCP Specification**: 2025-06-18
- **Python SDK**: >=1.2.0
- **Node.js**: >=18.0.0

### Transport Options

**Streamable HTTP** (Recommended for this platform):
- Uses HTTP POST for client-to-server messages
- Server-Sent Events (SSE) for real-time streaming
- Supports resumability and session management
- Replaces older `HTTP+SSE` transport from 2024-11-05

**Security Requirements**:
- MUST validate `Origin` header on all requests
- Bind to `localhost` (127.0.0.1) when running locally
- Implement proper authentication mechanisms

### Server Implementation Pattern

**Composite Service Pattern** (Selected):
```
Instead of:
  - fetch_customer() → fetch_orders() → fetch_tickets() [3 calls, high tokens]

Use:
  - get_customer_context() → consolidated response [1 call, low tokens]
```

This pattern is critical for achieving 85%+ token reduction by:
1. Combining multiple API calls into single tools
2. Returning preprocessed, structured data
3. Using references instead of inline content

### Tool Discovery & Paging
- Dynamic tool discovery via `notifications/tools/didChange`
- Pagination support for large result sets
- Streaming for long-running preprocessing tasks

### Sources
- https://modelcontextprotocol.io/specification/2025-06-18
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

---

## 2. Claude & Gemini Compatibility

### Claude MCP Connector
- **Beta Header**: `anthropic-beta: mcp-client-2025-11-20`
- **Deprecated**: `mcp-client-2025-04-04`
- **Limitation**: Only `tool_calls` supported; server must be HTTP-accessible

**Configuration**:
- `mcp_servers` array for connection details
- `mcp_toolset` in `tools` array for tool configuration
- Supports multi-server connectivity in single request

### Gemini Function Calling
- Supports parallel function calling (multiple in one turn)
- Supports compositional calling (sequential)
- Python SDK has automatic function calling feature

**Token Efficiency Patterns**:
- Minimize function declarations sent per request
- Use structured responses to reduce parsing overhead
- Batch related operations into single function calls

### Sources
- https://platform.claude.com/docs/en/agents-and-tools/mcp-connector
- https://ai.google.dev/gemini-api/docs/function-calling

---

## 3. Search Tools (ripgrep/ugrep)

### ripgrep (Primary)
```bash
# JSON structured output
rg --json "pattern" ./path

# Key flags for programmatic use
rg --json \
   --glob "*.md" \
   --ignore-file .gitignore \
   --max-count 100 \
   --context 2 \
   "search_term"
```

**Output Structure**:
```json
{"type":"match","data":{"path":{"text":"file.md"},"lines":{"text":"matched line"},"line_number":42,"absolute_offset":1234}}
```

### ugrep (Fallback)
```bash
# JSON output
ugrep --json "pattern" ./path

# Similar filtering capabilities
ugrep --json \
      --include="*.md" \
      --exclude-dir=node_modules \
      --max-count=100 \
      "search_term"
```

### Python Integration (ripgrepy)
```python
from ripgrepy import Ripgrepy

rg = Ripgrepy("pattern", "./path")
results = rg.json().glob("*.md").run().as_dict
```

**Version Requirements**:
- ripgrep: Latest stable
- ripgrepy: Python 3.6+
- ugrep: Latest stable

### Sources
- https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md
- https://ugrep.com/

---

## 4. Document Processing (Pandoc/Tesseract)

### Pandoc

**Best Practices**:
```bash
# Always specify formats explicitly
pandoc -f docx -t markdown -s input.docx -o output.md

# Extract metadata
pandoc --standalone --metadata-file=meta.yaml input.md -o output.html
```

**Performance Note**: Version 2.0+ has significant performance regression for small files. For high-throughput pipelines processing many small files, consider Pandoc 1.x if Lua filters aren't needed.

**Supported Conversions** (relevant to preprocessing):
- DOCX → Markdown
- PDF → Markdown (with limitations)
- HTML → Markdown
- LaTeX → Markdown
- EPUB → Markdown

### Tesseract OCR

**Critical Requirements**:
- Input images: **300 DPI minimum**
- Preprocessing is essential for accuracy

**Page Segmentation Modes (PSM)**:
```bash
# Single uniform block of text
tesseract image.png output --psm 6

# Single line
tesseract image.png output --psm 7

# Sparse text
tesseract image.png output --psm 11
```

**Language Support**:
```bash
# Install language pack
apt-get install tesseract-ocr-deu  # German

# Use specific language
tesseract image.png output -l deu
```

**Trained Data Options**:
- `tessdata`: Standard (balanced)
- `tessdata_best`: Highest accuracy (slower)
- `tessdata_fast`: Fastest (lower accuracy)

### Preprocessing Pipeline
```
Image → Binarization → Deskew → Denoise → Tesseract → Text
```

### Sources
- https://pandoc.org/MANUAL.html
- https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html

---

## 5. NLP Libraries (Provider-Agnostic)

### Recommended Stack

| Task | Primary | Fallback |
|------|---------|----------|
| Tokenization/Sentence Split | spaCy | NLTK |
| Entity Extraction | spaCy | Transformers |
| Sentiment Analysis | Transformers | NLTK VADER |
| Keyword Extraction | spaCy + TextRank | NLTK |
| Language Detection | langdetect | spaCy |

### spaCy (Primary for Speed)
```python
import spacy
nlp = spacy.load("en_core_web_sm")

doc = nlp("Apple is buying a UK startup for $1 billion")

# Entities
entities = [(ent.text, ent.label_, ent.start_char, ent.end_char) 
            for ent in doc.ents]

# Sentences with offsets
sentences = [(sent.text, sent.start_char, sent.end_char) 
             for sent in doc.sents]
```

### Transformers (Advanced Tasks)
```python
from transformers import pipeline

# Sentiment
sentiment = pipeline("sentiment-analysis")
result = sentiment("This is excellent!")

# NER with offsets
ner = pipeline("ner", aggregation_strategy="simple")
entities = ner("Apple is buying UK startup")
```

### Provider-Agnostic Interface Pattern
```python
from abc import ABC, abstractmethod

class NLPProvider(ABC):
    @abstractmethod
    def extract_entities(self, text: str) -> list[dict]:
        pass
    
    @abstractmethod
    def analyze_sentiment(self, text: str) -> dict:
        pass
    
    @abstractmethod
    def split_sentences(self, text: str) -> list[dict]:
        pass

class SpacyProvider(NLPProvider):
    def __init__(self, model="en_core_web_sm"):
        self.nlp = spacy.load(model)
    # ... implementations

class TransformersProvider(NLPProvider):
    def __init__(self):
        self.ner = pipeline("ner")
        self.sentiment = pipeline("sentiment-analysis")
    # ... implementations
```

### Version Requirements
- Python: >=3.8
- spaCy: >=3.0
- Transformers: >=4.0
- NLTK: >=3.5

### Sources
- https://spacy.io/usage/spacy-101
- https://huggingface.co/docs/transformers/en/index

---

## 6. Vector Store (Chroma as Working Memory)

### Why Chroma for Preprocessing

| Feature | Chroma | FAISS |
|---------|--------|-------|
| Persistence | Built-in `PersistentClient` | Manual serialization |
| Metadata Filtering | Native support | Limited |
| Dev Experience | Simple API | Complex |
| Use Case | Working memory, staging | Production scale |

### Chroma Usage Pattern
```python
import chromadb

# Persistent client for working memory
client = chromadb.PersistentClient(path="./preprocessing_cache")

# Create collection for document chunks
collection = client.get_or_create_collection(
    name="document_chunks",
    metadata={"hnsw:space": "cosine"}
)

# Add with metadata for filtering
collection.add(
    ids=["chunk_1", "chunk_2"],
    embeddings=[[0.1, 0.2, ...], [0.3, 0.4, ...]],
    metadatas=[
        {"doc_id": "doc_123", "chunk_idx": 0, "type": "paragraph"},
        {"doc_id": "doc_123", "chunk_idx": 1, "type": "heading"}
    ],
    documents=["First chunk text", "Second chunk text"]
)

# Query with metadata filter
results = collection.query(
    query_embeddings=[[0.1, 0.2, ...]],
    n_results=10,
    where={"doc_id": "doc_123"}
)
```

### Export to Final DB Pattern
```python
# After preprocessing, export to Neo4j/Supabase
def export_to_final_db(collection_name: str):
    collection = client.get_collection(collection_name)
    all_data = collection.get(include=["embeddings", "metadatas", "documents"])
    
    # Transform for Neo4j graph export
    for i, doc_id in enumerate(all_data["ids"]):
        yield {
            "id": doc_id,
            "embedding": all_data["embeddings"][i],
            "metadata": all_data["metadatas"][i],
            "text": all_data["documents"][i]
        }
    
    # Clean up working memory after export
    client.delete_collection(collection_name)
```

### Version Requirements
- chromadb: Latest stable
- Python: >=3.9

### Sources
- https://docs.trychroma.com/getting-started
- https://docs.trychroma.com/docs/run-chroma/persistent-client

---

## 7. LLM Provider Integration

### Provider-Agnostic Architecture

```
┌─────────────────────────────────────────┐
│           LLM Provider Interface        │
├─────────────────────────────────────────┤
│  embed(text) → vector                   │
│  complete(prompt) → response            │
│  rerank(query, docs) → ranked_docs      │
└─────────────────────────────────────────┘
         │         │         │         │
    ┌────┴────┐ ┌──┴──┐ ┌───┴───┐ ┌───┴───┐
    │ Ollama  │ │Gemini│ │OpenRtr│ │ BERT  │
    │ Adapter │ │Adapter│ │Adapter│ │Local  │
    └─────────┘ └──────┘ └───────┘ └───────┘
```

### Ollama (Cloud or Self-Hosted)
```python
import ollama

# Embeddings
response = ollama.embeddings(
    model="nomic-embed-text",
    prompt="Document text to embed"
)
embedding = response["embedding"]

# Completion
response = ollama.chat(
    model="llama3.2",
    messages=[{"role": "user", "content": "Summarize this..."}]
)
```

### Gemini 2.5 Flash (Cost-Effective Processing)
```python
import google.generativeai as genai

genai.configure(api_key="...")
model = genai.GenerativeModel("gemini-2.5-flash")

response = model.generate_content("Extract entities from: ...")
```

### Local BERT Embeddings (sentence-transformers)
```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

# Single embedding
embedding = model.encode("Document text")

# Batch embeddings (efficient)
embeddings = model.encode([
    "First document",
    "Second document",
    "Third document"
])
```

### OpenRouter (Free Models)
```python
import openai

client = openai.OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="..."
)

response = client.chat.completions.create(
    model="meta-llama/llama-3.2-3b-instruct:free",
    messages=[{"role": "user", "content": "..."}]
)
```

### Recommended Model Selection

| Task | Recommended Model | Rationale |
|------|-------------------|-----------|
| Embeddings | sentence-transformers (local) | No API cost, fast |
| Summarization | Gemini 2.5 Flash | Cost-effective, good quality |
| Entity Extraction | spaCy (local) | No API cost, fast |
| Complex Analysis | Gemini 2.5 Pro | Best reasoning |
| Reranking | Contextual AI Reranker v2 | Open-source, multilingual |

### Sources
- https://ollama.com/cloud
- https://ai.google.dev/gemini-api/docs/models
- https://sbert.net/
- https://openrouter.ai/models/?q=free

---

## Architecture Decision Matrix

### Framework Decision

| Option | Pros | Cons | Score |
|--------|------|------|-------|
| **TS Gateway + Python Runners** | Type safety, Python ML ecosystem | Two runtimes | ⭐⭐⭐⭐⭐ |
| Pure TypeScript | Single runtime | Limited ML libraries | ⭐⭐⭐ |
| Pure Python | Rich ML ecosystem | Slower HTTP handling | ⭐⭐⭐⭐ |

**Decision**: TypeScript Gateway + Python Runners

- Gateway handles MCP protocol, routing, auth in TypeScript
- Python runners execute NLP, OCR, embedding tasks
- Communication via HTTP/JSON-RPC or Redis queue

### Token Efficiency Strategies

1. **Reference-Based Returns**: Never inline large content
   ```json
   {"ref": "sha256:abc123", "size": 45000, "mime": "text/markdown", "preview": "First 200 chars..."}
   ```

2. **Paged Retrieval**: Chunk large results
   ```json
   {"ref": "sha256:abc123", "page": 1, "total_pages": 10, "content": "..."}
   ```

3. **Structured Metadata**: Return offsets/citations, not full text
   ```json
   {"entities": [{"text": "Apple", "type": "ORG", "start": 0, "end": 5}]}
   ```

4. **Preprocessing Pipeline**: Extract everything locally before LLM sees it
   ```
   Raw Doc → OCR → Markdown → Chunks → Entities → Sentiment → Keywords → Graph → Ready for LLM
   ```

---

## Breaking Changes & Deprecations

| Component | Change | Impact |
|-----------|--------|--------|
| MCP Transport | `HTTP+SSE` → `Streamable HTTP` | Update transport implementation |
| Claude Connector | `mcp-client-2025-04-04` deprecated | Use `mcp-client-2025-11-20` |
| Pandoc | 2.0+ performance regression | Consider 1.x for high-throughput |

---

## Version Requirements Summary

```yaml
# Runtime
node: ">=18.0.0"
python: ">=3.9"

# MCP
mcp-sdk: ">=1.2.0"

# NLP
spacy: ">=3.0"
transformers: ">=4.0"
nltk: ">=3.5"

# Vector Store
chromadb: "latest"

# Embeddings
sentence-transformers: "latest"

# Search
ripgrep: "latest"
ugrep: "latest"

# Document Processing
pandoc: ">=2.0 or 1.x for performance"
tesseract: ">=5.0"
```

---

## Next Steps

1. Implement MCP Gateway with Streamable HTTP transport
2. Build content-addressed object store with SHA-256 refs
3. Create plugin architecture with provider registry
4. Implement worker swarm with task graph and checkpointing
5. Build export pipelines for Neo4j/Supabase/vector DB
