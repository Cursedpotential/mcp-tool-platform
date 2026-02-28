# External Integrations

**Analysis Date:** 2026-02-23

## APIs & External Services

**AI/ML Services:**
- **Anthropic Claude** - LLM integration for agent capabilities
  - SDK/Client: `@anthropic-ai/claude-agent-sdk`, `anthropic` (Python)
  - Auth: `ANTHROPIC_API_KEY`

- **Google Cloud AI** - Multiple AI services
  - SDK/Client: `@google-cloud/aiplatform`, `@google-cloud/documentai`, `@google-cloud/language`, `@google-cloud/speech`, `@google-cloud/vision`, `@google-cloud/vertexai`, `google.generativeai` (Python)
  - Services: Vertex AI, Document AI, Cloud Speech, Cloud Vision, Natural Language
  - Auth: `GOOGLE_API_KEY` or Google Cloud credentials

- **AWS AI Services** - Amazon AI services
  - SDK/Client: `@aws-sdk/client-comprehend`, `@aws-sdk/client-rekognition`, `@aws-sdk/client-textract`, `boto3` (Python)
  - Services: Amazon Comprehend (NLP), Rekognition (image/video), Textract (OCR)
  - Auth: AWS credentials via environment or credential chain

- **OpenAI** - OpenAI API integration
  - SDK/Client: `openai` (Python)
  - Auth: `OPENAI_API_KEY`

- **Hugging Face Transformers** - ML models
  - SDK/Client: `@huggingface/transformers`, `@xenova/transformers`
  - Purpose: Running transformer models (browser and server-side)

- **Unstructured API** - Document parsing
  - SDK/Client: `unstructured-client` (Python)
  - Purpose: Parsing documents (PDFs, images, etc.) into structured data

- **Firecrawl** - Web scraping/crawling
  - SDK/Client: `firecrawl-py` (Python)
  - Purpose: Crawling websites and extracting content

- **Coolify** - Deployment platform
  - SDK/Client: `@fastmcp-me/coolify-mcp`, `coolify-mcp-server`
  - Auth: `COOLIFY_BASE_URL`, `COOLIFY_TOKEN`

**MCP Services:**
- **mem0** - Memory service
  - SDK/Client: `mem0-mcp-server`
  - Auth: `MEM0_API_KEY`, `MEM0_DEFAULT_USER_ID`

- **Gemini MCP Tool** - Google Gemini integration
  - SDK/Client: `gemini-mcp-tool`
  - Auth: `GEMINI_API_KEY`

- **NotebookLM MCP** - NotebookLM integration
  - SDK/Client: `notebooklm-mcp-zh`, `iventra-notebooklm-mcp`
  - Purpose: Accessing NotebookLM features

- **Qwen MCP** - Qwen LLM integration
  - SDK/Client: `qwen-mcp`
  - Purpose: Qwen model access

- **Structured Memory MCP** - Structured memory storage
  - SDK/Client: `@nmeierpolys/mcp-structured-memory`
  - Purpose: Structured memory management

## Data Storage

**Databases:**
- **MySQL**
  - Connection: `DATABASE_URL` or `mysql://user:password@localhost:3306/salem`
  - Client: `mysql2` (Node), `mysql.connector` (Python)
  - Purpose: Application backend database (users, settings, workflows)

- **PostgreSQL**
  - Connection: `postgres://user:password@localhost:5432/salem` or individual env vars (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`)
  - Client: `postgres` (Node), `psycopg2` (Python)
  - Purpose: Evidence storage (forensic records, audit logs)

- **PostgreSQL with pgvector**
  - Client: `pgvector` (Node extension)
  - Purpose: Vector similarity search on evidence

**Vector Databases:**
- **ChromaDB**
  - Connection: `CHROMA_URL=http://localhost:8000`
  - Client: `chromadb`
  - Storage: `CHROMA_STORAGE_PATH=/data/chroma`
  - Auth: `CHROMA_AUTH_TOKEN`
  - Purpose: Vector embeddings for semantic search

- **Qdrant**
  - Connection: `QDRANT_URL=http://localhost:6333`
  - Auth: `QDRANT_API_KEY`
  - Collection prefix: `QDRANT_COLLECTION_PREFIX=mcp_`
  - Purpose: Alternative vector database

**Graph Database:**
- **Neo4j**
  - Connection: `NEO4J_URL=bolt://localhost:7687`
  - Auth: `NEO4J_USERNAME=neo4j`, `NEO4J_PASSWORD=password`
  - Client: `neo4j-driver`
  - Purpose: Relationship graph for evidence linking

**In-Memory/Search:**
- **Redis**
  - Client: `ioredis`
  - Purpose: Caching (configured but usage not detected)

- **SQLite**
  - Client: `better-sqlite3`, `sql.js`
  - Purpose: Local embedded database (conversation search)

- **FAISS**
  - Client: `faiss-node`
  - Purpose: Vector similarity search (alternative to dedicated vector DBs)

**File Storage:**
- **AWS S3**
  - SDK/Client: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
  - Purpose: Cloud object storage
  - Auth: AWS credentials

- **Google Cloud Storage**
  - SDK/Client: `@google-cloud/storage`
  - Purpose: Cloud object storage
  - Auth: Google Cloud credentials

- **Supabase Storage**
  - SDK/Client: `@supabase/supabase-js`
  - Purpose: Alternative cloud storage/auth
  - Auth: `SUPABASE_URL`, `SUPABASE_KEY`

**Caching:**
- Not detected in active use (Redis configured in env)

## Authentication & Identity

**Auth Provider:**
- **Manus OAuth** - Manus platform authentication
  - Implementation: OAuth flow
  - Auth: `OAUTH_SERVER_URL=https://oauth.manus.im`

- **Supabase Auth** - Alternative auth provider
  - Implementation: Supabase auth-js
  - Location: `03_TraceIQ_Lab/location-admin`

- **Custom JWT** - Local authentication
  - Implementation: Custom JWT tokens
  - Secret: `JWT_SECRET`

## Monitoring & Observability

**Error Tracking:**
- Not detected

**Logs:**
- Approach: Console logging, file logging for Go applications
- Config: `LOG_LEVEL=info`

## CI/CD & Deployment

**Hosting:**
- **Coolify** - Self-hosted deployment platform
  - Platform: http://172.233.222.234:8000
  - Purpose: Application deployment and management

**CI Pipeline:**
- GitHub Actions (detected in Stirling-PDF)
- Build scripts: `./gradlew build`, `npm run build`

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - Primary database connection (MySQL/PostgreSQL)
- `ENCRYPTION_KEY` - Encryption key for API key storage
- `JWT_SECRET` - JWT signing secret
- `CHROMA_URL` - Vector database URL
- `NEO4J_URL`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` - Graph database credentials

**Optional env vars:**
- `OPENAI_API_KEY` - OpenAI API access
- `GOOGLE_API_KEY` - Google Cloud services
- `MEM0_API_KEY` - mem0 memory service
- `QDRANT_URL`, `QDRANT_API_KEY` - Alternative vector DB
- `SUPABASE_URL`, `SUPABASE_KEY` - Supabase access
- `N8N_URL`, `N8N_API_KEY` - Workflow automation

**Secrets location:**
- Environment variables in `.env` files (not committed to git)
- `.env.example`, `.env.docker.example` provided as templates
- Project uses `.env.production` (in Project_Dirs)

## Webhooks & Callbacks

**Incoming:**
- Not detected in active use

**Outgoing:**
- n8n webhook integration (configured but not enabled)
  - `N8N_WEBHOOK_BASE_URL=http://localhost:5678`
  - `N8N_ENABLED=false`

## MCP Server Integrations

**Internal MCP Servers:**
- **Universal Forensics Server** (`Universal_Agents/forensics_server.py`)
  - Tools: quick_search, deep_search, analyze_file, diff_files, extract_entities, slice_json
  - Framework: FastMCP

- **UNS-MCP** (`04_Component_Library/MCP_Servers/UNS-MCP`)
  - Purpose: Unstructured API integration for document parsing
  - Framework: MCP with Python

- **UNS-MCP** (multiple locations)
  - `04_Component_Library/Plugins_&_Tools/External_Utils_Lib/UNS-MCP-main`
  - `04_Component_Library/Plugins_&_Tools/External_Utils_Lib/MCP/UNS-MCP-main`
  - `03_TraceIQ_Lab/location-admin/UNS-MCP-main`

- **NotebookLM MCP**
  - `04_Component_Library/Plugins_&_Tools/External_Utils_Lib/MCP/notebooklm-mcp-target`
  - `04_Component_Library/Plugins_&_Tools/External_Utils_Lib/MCP/notebooklm-mcp-source`

- **Zep Server Reference**
  - `04_Component_Library/Plugins_&_Tools/External_Utils_Lib/MCP/zep-server-reference`
  - Purpose: Memory server integration

- **LangExtract MCP**
  - `04_Component_Library/Plugins_&_Tools/External_Utils_Lib/MCP/langextract-mcp-main`
  - Purpose: Language extraction

- **MCP NLTK**
  - `04_Component_Library/Plugins_&_Tools/External_Utils_Lib/MCP/mcp-nltk-main`
  - Purpose: NLP toolkit integration

- **OFW Assistant**
  - `04_Component_Library/Plugins_&_Tools/External_Utils_Lib/MCP/ofw-assistant-main`
  - Purpose: Document analysis assistant

- **Document Analyser MCP**
  - `04_Component_Library/Plugins_&_Tools/External_Utils_Lib/NLP_Tools/NLP_Document-Analyser-MCP`
  - Purpose: NLP document analysis

---

*Integration audit: 2026-02-23*
