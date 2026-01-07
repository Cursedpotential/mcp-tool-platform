**NOTE: Archived reference version — kept for historical context.**

# Phase 2 Quick-Start Guide

**Status:** Ready to execute  
**Estimated Time:** 30 minutes setup + 2-3 hours implementation  
**Prerequisites:** Docker, Node 18+, pnpm

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Copy Implementation Files

The files are documented in `PHASE_2_DATABASE_CONNECTIONS.md`. Create these files in your project:

```bash
# Create directory structure
mkdir -p server/mcp/plugins
mkdir -p server/mcp/utils
mkdir -p server/mcp/__tests__

# Copy the complete implementations from PHASE_2_DATABASE_CONNECTIONS.md
# Files to create:
# - server/mcp/plugins/vector-db-real.ts
# - server/mcp/plugins/graph-db-real.ts
# - server/mcp/plugins/mem0-real.ts
# - server/mcp/plugins/n8n-real.ts
# - server/mcp/utils/logger.ts
# - server/mcp/__tests__/database-connections.test.ts
```

### Step 2: Install Dependencies

```bash
# Add required packages
pnpm add @qdrant/js-client-rest neo4j-driver pino pino-pretty

# Verify installation
pnpm ls @qdrant/js-client-rest neo4j-driver
```

### Step 3: Create .env File

```bash
# Copy example to actual .env
cp .env.example .env

# For local development, default values work:
# - QDRANT_URL=http://localhost:6333
# - NEO4J_URL=bolt://localhost:7687
# - NEO4J_USERNAME=neo4j
# - NEO4J_PASSWORD=password
```

### Step 4: Start Docker Services

```bash
# Start Qdrant and Neo4j (commented services optional)
docker-compose up -d qdrant neo4j

# Verify they're healthy
docker-compose ps

# Check Qdrant
curl http://localhost:6333/health

# Check Neo4j (wait 10-15 seconds for startup)
sleep 15
curl -u neo4j:password http://localhost:7474/db/neo4j/summary
```

### Step 5: Run Tests

```bash
# Run all database connection tests
pnpm test -- database-connections.test.ts

# Expected output:
# ✓ Vector Database (Qdrant) > should pass health check
# ✓ Vector Database (Qdrant) > should store vectors
# ✓ Vector Database (Qdrant) > should search vectors
# ✓ Graph Database (Neo4j) > should pass health check
# ✓ Graph Database (Neo4j) > should add entities
```

---

## 📋 Implementation Checklist

### Database Plugins (Core Implementation)

- [ ] **vector-db-real.ts** (Qdrant)
  - [ ] `getClient()` initialization
  - [ ] `vectorDBHealthCheck()` endpoint
  - [ ] `vectorStore()` with collection creation
  - [ ] `vectorSearch()` with similarity scoring
  - [ ] `vectorDelete()` with filtering
  - [ ] `vectorListCollections()` for catalog
  - [ ] `vectorGetStats()` for monitoring
  - [ ] Error handling & retries
  - [ ] Logging with pino
  - **Tests:** 6 test cases

- [ ] **graph-db-real.ts** (Neo4j)
  - [ ] `getDriver()` connection pooling
  - [ ] `graphDBHealthCheck()` with version
  - [ ] `addEntity()` with MERGE strategy
  - [ ] `searchEntities()` with Cypher
  - [ ] `addRelationship()` for edges
  - [ ] `findPaths()` for traversal
  - [ ] `closeGraphDB()` on shutdown
  - [ ] Session management
  - [ ] Logging & error handling
  - **Tests:** 5 test cases

- [ ] **mem0-real.ts** (Shared Memory)
  - [ ] HTTP client with axios
  - [ ] `mem0HealthCheck()` endpoint
  - [ ] `addMemory()` with metadata
  - [ ] `searchMemories()` semantic search
  - [ ] `deleteMemory()` cleanup
  - [ ] Bearer token auth
  - [ ] Error handling
  - **Tests:** 4 test cases

- [ ] **n8n-real.ts** (Workflows)
  - [ ] HTTP client with axios
  - [ ] `n8nHealthCheck()` with version
  - [ ] `listWorkflows()` catalog
  - [ ] `triggerWorkflow()` execution
  - [ ] `getExecution()` status polling
  - [ ] API key authentication
  - [ ] Error handling
  - **Tests:** 4 test cases

### Supporting Infrastructure

- [ ] **logger.ts** (Logging)
  - [ ] Pino logger factory
  - [ ] Pretty printing in dev
  - [ ] JSON in production
  - [ ] Per-module loggers

- [ ] **Tests** (database-connections.test.ts)
  - [ ] 19 test cases total
  - [ ] Health checks for all 4 services
  - [ ] CRUD operations
  - [ ] Search & filtering
  - [ ] Error scenarios

### Configuration & Deployment

- [ ] **.env.example** (Environment Template)
  - [ ] Qdrant configuration
  - [ ] Neo4j configuration
  - [ ] mem0 configuration (optional)
  - [ ] n8n configuration (optional)
  - [ ] Feature flags

- [ ] **docker-compose.yml** (Local Development)
  - [ ] Qdrant service (fully configured)
  - [ ] Neo4j service (fully configured)
  - [ ] Health checks for all
  - [ ] Volume persistence
  - [ ] Network isolation

- [ ] **package.json** (Dependencies)
  - [ ] @qdrant/js-client-rest
  - [ ] neo4j-driver
  - [ ] pino & pino-pretty
  - [ ] Updated test scripts

### Integration Points

- [ ] **Settings UI** (Database tabs)
  - [ ] Connection test buttons
  - [ ] Configuration display
  - [ ] Health status indicators
  - [ ] Real-time monitoring

- [ ] **Health Endpoint** (/api/health)
  - [ ] Check all 4 databases
  - [ ] Return latency metrics
  - [ ] Include error messages

- [ ] **Gateway Executor** (gateway.ts)
  - [ ] Register all 4 plugins
  - [ ] Wire CRUD handlers
  - [ ] Add to tool registry

---

## 🧪 Testing Strategy

### Unit Tests (database-connections.test.ts)
```bash
pnpm test -- database-connections.test.ts --reporter=verbose
```

**Expected Results:**
- ✓ Vector DB health check (latency 5-50ms)
- ✓ Vector store/search operations
- ✓ Graph DB health check (latency 10-100ms)
- ✓ Entity CRUD operations
- ✓ Relationship creation & queries

### Integration Tests
```bash
# Test with actual external services
pnpm test -- --include='**/integration/**'
```

### Manual Testing
```bash
# Test Qdrant directly
curl -X POST http://localhost:6333/collections/test/points \
  -H 'Content-Type: application/json' \
  -d '{"points": [{"id": 1, "vector": [0.1, 0.2], "payload": {"text": "hello"}}]}'

# Test Neo4j directly
curl -u neo4j:password -X POST http://localhost:7474/db/neo4j/tx \
  -H 'Content-Type: application/json' \
  -d '{"statements": [{"statement": "CREATE (n:Test {name: \"hello\"}) RETURN n"}]}'
```

---

## 🔍 Debugging

### Check Service Status
```bash
# View logs
docker-compose logs qdrant
docker-compose logs neo4j

# Test connectivity
telnet localhost 6333  # Qdrant
telnet localhost 7687  # Neo4j bolt
telnet localhost 7474  # Neo4j HTTP
```

### Enable Debug Logging
```bash
# Set in .env
LOG_LEVEL=debug

# Run with debug output
DEBUG=* pnpm test
```

### Common Issues

**Neo4j connection timeout:**
```bash
# Wait for Neo4j to fully start (20-30 seconds)
sleep 30

# Verify Neo4j is ready
curl -s http://localhost:7474/db/neo4j/summary | jq .
```

**Qdrant API key rejected:**
```bash
# Check .env has correct key
grep QDRANT_API_KEY .env

# If Qdrant is running locally without auth, leave blank
QDRANT_API_KEY=
```

**Neo4j authentication failed:**
```bash
# Default credentials are neo4j / password
# If changed, update docker-compose.yml and .env

# Reset to defaults
docker-compose down
docker volume rm mcp-tool-platform_neo4j_data
docker-compose up -d neo4j
sleep 30
```

---

## 📊 Monitoring

### Health Check Endpoint
```bash
# Check all services
curl http://localhost:3000/api/health

# Response:
{
  "qdrant": { "healthy": true, "latency": 12, "collections": 5 },
  "neo4j": { "healthy": true, "latency": 25, "version": "5.15.0" },
  "mem0": { "healthy": false, "error": "not enabled" },
  "n8n": { "healthy": false, "error": "not enabled" }
}
```

### Settings UI
Navigate to `/settings/databases`:
- See connection status for each service
- View configuration URLs
- Test connections manually
- View health metrics

### Monitoring Queries

**Qdrant - Collection stats:**
```bash
curl http://localhost:6333/collections/mcp_default
```

**Neo4j - Entity count:**
```bash
curl -u neo4j:password -X POST http://localhost:7474/db/neo4j/tx \
  -d '{"statements": [{"statement": "MATCH (n) RETURN count(n)"}]}'
```

---

## 🚀 Production Deployment

### Environment Variables
```bash
# Update .env for production
QDRANT_URL=https://YOUR_CLUSTER.qdrant.io
QDRANT_API_KEY=

NEO4J_URL=bolt://your-neo4j-instance.com:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

MEM0_URL=https://api.mem0.ai
MEM0_API_KEY=
MEM0_ENABLED=true

N8N_URL=https://your-n8n-instance.com
N8N_API_KEY=
N8N_ENABLED=true
```

### Docker Compose Override
```bash
# Create docker-compose.prod.yml with production services
# Or use environment variable substitution
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Health Check Integration
```typescript
// Add to your startup sequence
import * as vectorDb from './plugins/vector-db-real';
import * as graphDb from './plugins/graph-db-real';

app.get('/health', async (req, res) => {
  const [vdb, gdb] = await Promise.all([
    vectorDb.vectorDBHealthCheck(),
    graphDb.graphDBHealthCheck(),
  ]);
  
  res.json({
    status: vdb.healthy && gdb.healthy ? 'healthy' : 'degraded',
    services: { vectorDb: vdb, graphDb: gdb },
  });
});
```

---

## ✅ Completion Criteria

**Phase 2 is complete when:**

- [ ] All 4 database plugins are wired with real connections
- [ ] Health check endpoints return `{ healthy: true }` for all services
- [ ] Tests pass: `pnpm test -- database-connections.test.ts`
- [ ] Docker services run: `docker-compose ps` shows all UP
- [ ] Settings UI shows connection status
- [ ] Logging works: `LOG_LEVEL=debug pnpm dev` shows debug output
- [ ] Error scenarios handled gracefully
- [ ] No stub/placeholder code remains

**Next Phase: Wiring remaining 40+ tools to executor**

---

## 📚 Reference

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Neo4j Driver Documentation](https://neo4j.com/docs/driver-manual/current/)
- [mem0 API Reference](https://docs.mem0.ai/)
- [n8n Documentation](https://docs.n8n.io/)
- [Pino Logging](https://getpino.io/)

---

## 🎯 Timeline

```
Now:        Phase 2 starts (30min setup)
+1h:        Dependencies installed, Docker running
+3h:        All plugins wired, tests passing
+4h:        Settings UI integrated
+5h:        Production deployment configured
+6h:        Phase 2 complete ✅
```

No more back-and-forth. Full implementation in one go.
