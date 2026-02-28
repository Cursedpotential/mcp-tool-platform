# Technology Stack

**Analysis Date:** 2026-02-23

## Languages

**Primary:**
- TypeScript 5.9.3 - Frontend (React), Backend (Node/Express), MCP servers, Tool Platform
- Python 3.9+ - MCP servers, NLP tools, Forensics servers, Data analysis

**Secondary:**
- Go 1.20-1.22 - Desktop applications (EnvManager, DirectoryScanner, rclone-gui)
- Java 17+ - Stirling-PDF (Spring Boot application)
- JavaScript - Legacy components, Node utilities

## Runtime

**Environment:**
- Node.js - TypeScript/JavaScript runtime for MCP Tool Platform
- Python 3.9+ - Python-based MCP servers and tools
- Go 1.20+ - Compiled desktop utilities
- Java 17+ - Stirling-PDF backend

**Package Manager:**
- pnpm 10.4.1 - Primary for TypeScript/Node projects
- pip - Python package management
- go mod - Go module management
- Gradle - Java dependency management (Stirling-PDF)
- Lockfile: `pnpm-lock.yaml`, `package-lock.json` (present)

## Frameworks

**Core:**
- React 19.2.1 - Frontend UI (Timeline Explorer, Location Admin, Tool Platform)
- Vite 7.1.7 - Build tool and dev server
- Express 4.21.2 - Backend API server (Tool Platform)
- Spring Boot 3.5.9 - Backend framework (Stirling-PDF)

**Testing:**
- Vitest 2.1.4 - JavaScript/TypeScript testing
- pytest 8.3.5 - Python testing

**Build/Dev:**
- esbuild 0.25.0 - JavaScript bundler
- Wails v2.11.0 - Go desktop application framework
- Fyne v2.4.4/v2.6.1 - Go GUI framework

## Key Dependencies

**Critical:**
- Drizzle ORM 0.44.6 - Database ORM with MySQL/PostgreSQL support
- tRPC 11.6.0 - Type-safe API communication
- Radix UI - Component library collection
- Tailwind CSS 4.1.14 - Styling framework
- Framer Motion 12.23.22 - Animation library

**Infrastructure:**
- @anthropic-ai/claude-agent-sdk 0.1.9 - Anthropic API integration
- @google-cloud/* - Google Cloud services (AI Platform, Document AI, Speech, Vision, Storage, Vertex AI)
- @aws-sdk/* - AWS services (Comprehend, Rekognition, S3, Textract)
- @supabase/supabase-js 2.89.0 - Supabase client
- CopilotKit 1.51.3 - AI UI components
- LangChain Community 1.1.10 - LLM orchestration

**Data & Storage:**
- ChromaDB 3.2.0 - Vector database
- Neo4j Driver 5.24.0 - Graph database client
- PostgreSQL (postgres) 3.4.8 - PostgreSQL driver
- MySQL2 3.15.0 - MySQL driver
- ioredis 5.9.2 - Redis client
- pgvector 0.2.1 - Vector extension for PostgreSQL
- faiss-node 0.5.1 - Vector similarity search

**AI/ML:**
- @huggingface/transformers 3.8.1 - Transformer models
- llamaindex 0.12.1 - LLM indexing framework
- natural 8.1.0 - Natural language processing
- @xenova/transformers 2.17.2 - Browser-based ML models

**Python-specific:**
- anthropic 0.49.0+ - Anthropic Python SDK
- unstructured-client 0.32.1+ - Document parsing API
- firecrawl-py 1.14.1+ - Web scraping/crawling
- boto3 1.37.27+ - AWS Python SDK
- beautifulsoup4 4.12.0+ - HTML parsing
- flet 0.24.0+ - Python GUI framework
- Flask 2.3+ - Python web framework
- FastMCP - MCP server framework

**Go-specific:**
- fyne.io/fyne/v2 - Cross-platform GUI framework
- github.com/charmbracelet/bubbletea 0.25.0 - Terminal UI framework
- github.com/wailsapp/wails/v2 2.11.0 - Desktop app framework

**Java/Spring-specific:**
- Apache PDFBox 3.0.6 - PDF manipulation
- Spring Boot 3.5.9 - Application framework
- LibreOffice - Document conversion

## Configuration

**Environment:**
- Configuration via `.env` files with examples provided
- Key configs required: DATABASE_URL, ENCRYPTION_KEY, JWT_SECRET
- Supports MySQL and PostgreSQL database backends
- Vector DB: ChromaDB or Qdrant
- Graph DB: Neo4j

**Build:**
- `package.json` - Node/TypeScript projects
- `requirements.txt` - Python projects
- `go.mod` - Go projects
- `build.gradle` - Java/Gradle projects
- `pyproject.toml` - Python packaging (MCP servers)
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration
- `drizzle.config.ts` - Database ORM configuration

## Platform Requirements

**Development:**
- Node.js 18+ with pnpm 10.4.1+
- Python 3.9+ with pip
- Go 1.20+ with go modules
- Java 17+ for Stirling-PDF
- Docker for containerized services (optional)

**Production:**
- Deployment target: VPS/Coolify platform
- Database: MySQL (app) + PostgreSQL with pgvector (evidence)
- Vector DB: ChromaDB or Qdrant
- Graph DB: Neo4j
- Storage: S3-compatible object storage

---

*Stack analysis: 2026-02-23*
