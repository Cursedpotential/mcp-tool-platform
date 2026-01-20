# MCP Tool Platform - Documentation Index

## 📚 **Complete Wiki Documentation Suite**

This documentation provides comprehensive, man-page style references for all components of the MCP Tool Platform - a sophisticated forensic legal case management system with MCP tool orchestration.

---

## 🏗️ **Architecture & Core Systems**

### **Primary APIs & Interfaces**

- **[MCP Gateway](mcp-gateway.md)** - Token-efficient API with 4 core endpoints (search, describe, invoke, get_ref)
- **[Tool Registry](tool-registry.md)** - Dynamic tool registration with 78+ forensic analysis tools
- **[Task Executor](task-executor.md)** - Execution engine with checkpoint/resume and deduplication
- **[Content Store](content-store.md)** - SHA-256 content-addressed storage for large artifacts
- **[Smart Router](smart-router.md)** - Intelligent LLM provider routing with cost optimization

### **AI & Integration Layer**

- **[LiteLLM Proxy](litellm-proxy.md)** - Universal proxy supporting 75+ LLM providers with cost tracking
- **[Directus CMS](directus-integration.md)** - Headless CMS for file management and AI plugins
- **[Neo4j Graphiti](neo4j-graphiti.md)** - Temporal knowledge graphs for entity relationships
- **[Chroma Vector DB](chroma-integration.md)** - 72-hour TTL working memory for evidence processing

---

## 🔧 **Tool Categories & Capabilities**

### **Document Processing (15 tools)**

- OCR extraction, format conversion, text chunking
- Multi-format parsing (PDF, Word, images)
- Content extraction and normalization

### **NLP & Analysis (12 tools)**

- Sentiment analysis, entity extraction
- Text classification, summarization
- spaCy, NLTK, TextBlob, Sentence Transformers integration

### **Forensic Analysis (20 tools)**

- 256 behavioral pattern detection
- Gaslighting, DARVO, parental alienation patterns
- HurtLex detection, severity scoring
- Multi-pass classification system

### **Search & Discovery (8 tools)**

- Web search, semantic search, Tavily, Perplexity
- Browser automation, screenshot, content extraction

### **Vector Database (8 tools)**

- Embedding storage and retrieval
- Chroma (72hr TTL), PGVector, Qdrant integration
- Semantic similarity search

### **Graph Database (6 tools)**

- Entity and relationship management
- Temporal analysis, contradiction detection
- Neo4j and Graphiti integration

### **ML & AI (6 tools)**

- LLM invocation, embedding generation
- Smart routing, provider management

### **Workflow & Orchestration (4 tools)**

- Tool chaining, workflow execution
- Checkpoint management, state persistence

---

## 📊 **Workflows & Processing Pipelines**

### **Document Analysis Workflow**

- 7-stage end-to-end document processing
- OCR → Entity Extraction → Sentiment → Pattern Detection → Evidence Compilation
- Court-admissible report generation

### **Message Processing Pipeline**

- Specialized for 8-year messaging datasets
- Multi-platform support (SMS, Facebook, iMessage, WhatsApp)
- Temporal analysis, behavioral pattern detection
- Evidence packaging for legal proceedings

### **Evidence Correlation Workflow**

- Cross-document relationship analysis
- Timeline reconstruction
- Pattern aggregation across sources

### **Pattern Detection Workflow**

- Multi-pass behavioral analysis
- Severity scoring and risk assessment
- Contextual pattern interpretation

---

## 🎨 **Frontend Components**

### **React Application Structure**

- Main app with wouter routing
- Settings page for API key and database configuration
- Tools discovery interface
- API key management UI
- MCP configuration panel

### **Key Pages**

- **Home**: System dashboard and stats
- **Tools**: Tool discovery and invocation
- **Settings**: Configuration management
- **API Keys**: Provider key management
- **MCP Config**: External tool exposure settings

---

## 🚀 **Deployment & Operations**

### **Docker Compose Architecture**

- **salem-nexus**: Storage services (PostgreSQL, Directus, PhotoPrism, n8n)
- **salem-forge**: Compute services (LiteLLM, MetaMCP, Kasm, Jupyter)
- **Cross-VPS Communication**: Tailscale VPN for secure inter-server communication

### **Environment Configuration**

- Production environment templates
- API key management and encryption
- Database connection configuration
- SSL/TLS certificate setup

### **Monitoring & Health Checks**

- Service health monitoring
- Performance metrics collection
- Error tracking and alerting
- Resource usage monitoring

---

## 🔐 **Security & Compliance**

### **Authentication & Authorization**

- User authentication via tRPC
- API key encryption (AES-256)
- Role-based access control
- Session management

### **Data Security**

- Content-addressed storage with SHA-256
- End-to-end encryption for sensitive data
- Secure API key storage
- Audit logging for compliance

### **Legal Compliance**

- Chain of custody tracking
- Data integrity verification
- Court-admissible evidence formatting
- Timestamp preservation

---

## 📈 **Performance & Scaling**

### **Optimization Strategies**

- Token-efficient tool discovery
- Content-addressed deduplication
- Intelligent provider routing
- Response caching and batching

### **Scalability Features**

- Horizontal scaling across multiple servers
- Load balancing and failover
- Resource pooling and connection reuse
- Asynchronous processing queues

### **Monitoring & Analytics**

- Real-time performance metrics
- Cost tracking and optimization
- Usage analytics and reporting
- Error rate monitoring

---

## 🛠️ **Development & Maintenance**

### **Code Organization**

- **server/**: Backend API and business logic
- **client/**: React frontend application
- **shared/**: TypeScript type definitions
- **drizzle/**: Database schema and migrations
- **docs/**: Comprehensive documentation

### **Development Workflow**

- Plan → Build → Test → Deploy cycle
- Comprehensive logging and error handling
- Automated testing and validation
- Continuous integration and deployment

### **Maintenance Tasks**

- Database schema updates
- API key rotation
- Security patches and updates
- Performance optimization

---

## 📋 **Quick Reference**

### **Starting the Platform**

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.production .env
# Edit .env with your API keys and database config

# Start services
docker-compose -f docker-compose.salem-nexus.yml up -d
docker-compose -f docker-compose.salem-forge.yml up -d

# Start application
pnpm run dev
```

### **Access Points**

- **Web UI**: http://localhost:3000
- **Directus**: http://localhost:8055
- **LiteLLM**: http://localhost:4000
- **MetaMCP Internal**: http://localhost:4001
- **MetaMCP External**: http://localhost:4002

### **Key Configuration**

- Database: PostgreSQL + PGVector + PostGIS
- Cache: Dragonfly (Redis-compatible)
- AI: LiteLLM proxy with 75+ providers
- Storage: Directus CMS + R2/Cloudflare
- Graph: Neo4j Aura + Graphiti
- Vector: Chroma (72hr TTL) + PGVector (persistent)

---

## 🎯 **Use Cases**

### **Forensic Legal Analysis**

- Process 8-year messaging datasets
- Detect behavioral patterns (gaslighting, DARVO)
- Generate court-admissible evidence
- Timeline reconstruction and analysis

### **Document Processing**

- Multi-format document ingestion
- OCR and text extraction
- Entity recognition and classification
- Sentiment analysis and summarization

### **AI-Powered Research**

- Multi-provider LLM access
- Cost-optimized routing
- Vector similarity search
- Knowledge graph construction

---

## 📞 **Support & Resources**

### **Documentation Navigation**

Use this index to navigate to specific component documentation. Each page follows man-page format with:

- **NAME**: Component purpose
- **SYNOPSIS**: Quick usage summary
- **DESCRIPTION**: Detailed functionality
- **DATA STRUCTURES**: Type definitions
- **API METHODS**: Function interfaces
- **CONFIGURATION**: Setup examples
- **SEE ALSO**: Related components

### **Getting Help**

- Check component-specific documentation
- Review workflow examples
- Examine configuration templates
- Monitor logs for troubleshooting

---

**Documentation Version**: 1.0.0
**Platform Version**: v0.2.0-rc1
**Last Updated**: January 11, 2026
**Generated by**: Claude Code - Opus 4.1
