# TASK 00: Setup Dependencies & Environment

**Priority:** CRITICAL (BLOCKING)  
**Estimated Time:** 30 minutes  
**Delegate To:** Shell commands (can be executed immediately)  
**Cost:** Free

---

## 1. Install Node Dependencies

```bash
cd /home/ubuntu/mcp-tool-platform
pnpm install
```

This will:
- Install all dependencies from `package.json`
- Enable TypeScript checking (`pnpm check`)
- Enable all dev tools

---

## 2. Fix `.env.example` File

Replace the current `.env.example` with this complete version:

```bash
# ============================================================================
# Database Configuration
# ============================================================================
# Primary database connection string
DATABASE_URL=mysql://user:password@localhost:3306/salem

# PostgreSQL configuration (if using Postgres instead of MySQL)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=salem
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# ============================================================================
# Security & Encryption
# ============================================================================
# REQUIRED: Encryption key for API key storage (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your-32-byte-hex-key-here

# JWT secret for authentication
JWT_SECRET=your-jwt-secret-here

# ============================================================================
# Authentication
# ============================================================================
# Manus OAuth server URL
OAUTH_SERVER_URL=https://oauth.manus.im

# ============================================================================
# Built-in Services (Manus Platform)
# ============================================================================
# Built-in Forge API (if using Manus built-in services)
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key

# ============================================================================
# Vector Database (Chroma)
# ============================================================================
# Local development: http://localhost:8000
# Production: Your Chroma server URL
CHROMA_URL=http://localhost:8000
CHROMA_STORAGE_PATH=/data/chroma
CHROMA_AUTH_TOKEN=your-chroma-token

# ============================================================================
# Vector Database (Qdrant) - Alternative
# ============================================================================
# Local development: http://localhost:6333
# Qdrant Cloud: https://YOUR_CLUSTER.qdrant.io
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION_PREFIX=mcp_

# ============================================================================
# Graph Database (Neo4j)
# ============================================================================
# Local development: bolt://localhost:7687
# Neo4j Cloud: Your bolt URL
NEO4J_URL=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password
NEO4J_DATABASE=neo4j

# ============================================================================
# LLM Providers
# ============================================================================
# OpenAI API key
OPENAI_API_KEY=sk-your-openai-key

# Google Gemini API key
GOOGLE_API_KEY=your-google-api-key

# Ollama URL (local or cloud)
OLLAMA_URL=http://localhost:11434

# ============================================================================
# Cloud Storage
# ============================================================================
# Supabase configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# ============================================================================
# File System Paths
# ============================================================================
# Root directory for data storage
DATA_ROOT=/data

# Sandbox root for file operations
SANDBOX_ROOT=/tmp/mcp-sandbox

# Rules directory for pattern files
RULES_DIR=/data/rules

# ============================================================================
# Shared Memory (mem0) - Optional
# ============================================================================
# Local/Docker: http://localhost:8000
# Cloud: https://api.mem0.ai
MEM0_URL=http://localhost:8000
MEM0_API_KEY=
MEM0_ENABLED=false

# ============================================================================
# Workflow Automation (n8n) - Optional
# ============================================================================
# Local development: http://localhost:5678
# Production: Your n8n instance URL
N8N_URL=http://localhost:5678
N8N_API_KEY=
N8N_WEBHOOK_BASE_URL=http://localhost:5678
N8N_ENABLED=false

# ============================================================================
# Server Configuration
# ============================================================================
# Server port
PORT=3000

# Application URL (for frontend)
VITE_APP_URL=http://localhost:3000

# Node environment
NODE_ENV=development

# ============================================================================
# Feature Flags
# ============================================================================
ENABLE_VECTOR_DB=true
ENABLE_GRAPH_DB=true
ENABLE_MEM0=false
ENABLE_N8N=false

# ============================================================================
# Monitoring
# ============================================================================
DATABASE_HEALTH_CHECK_INTERVAL=30000
LOG_LEVEL=info
```

---

## 3. Create `.env` File

Copy `.env.example` to `.env` and fill in actual values:

```bash
cp .env.example .env
```

**REQUIRED VALUES TO SET:**
1. `ENCRYPTION_KEY` - Generate with: `openssl rand -hex 32`
2. `DATABASE_URL` - Your MySQL/PostgreSQL connection string
3. `JWT_SECRET` - Generate with: `openssl rand -hex 32`

**OPTIONAL BUT RECOMMENDED:**
- `CHROMA_URL` - If using vector search
- `NEO4J_URL`, `NEO4J_PASSWORD` - If using graph database
- `OPENAI_API_KEY` or `GOOGLE_API_KEY` - For LLM features

---

## 4. Setup Python Environment (Optional but Recommended)

```bash
cd /home/ubuntu/mcp-tool-platform/server/python-tools

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy language model
python -m spacy download en_core_web_sm
```

**Note:** Python dependencies are heavy (torch, transformers, spacy). This is optional if you're only using JavaScript implementations.

---

## 5. Initialize Database Schema

```bash
cd /home/ubuntu/mcp-tool-platform

# Generate migration files
pnpm db:push
```

This will:
- Generate Drizzle migration files
- Apply schema to database
- Create all tables

---

## 6. Verify Setup

```bash
# Check TypeScript types
pnpm check

# Run tests
pnpm test

# Start development server
pnpm dev
```

---

## 7. Create Required Directories

```bash
mkdir -p /data/chroma
mkdir -p /data/rules
mkdir -p /tmp/mcp-sandbox
```

---

## Troubleshooting

### If `pnpm install` fails:
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### If database migration fails:
```bash
# Check database connection
# Ensure DATABASE_URL is correct
# Ensure database server is running
```

### If Python installation fails:
```bash
# Use lighter dependencies (remove torch)
# Or use Docker image with pre-installed dependencies
```

---

## Output

After completion, verify:
- [ ] `node_modules` directory exists
- [ ] `.env` file created with required values
- [ ] `pnpm check` runs without errors
- [ ] Database schema applied successfully
- [ ] Server starts with `pnpm dev`
