# MCP Tool Platform - Architecture & Data Flow Documentation

## 🏗️ **COMPLETE SYSTEM ARCHITECTURE**

### **Data Flow Overview**
```
RAW FILES → DIRECTUS (Evidentiary Storage)
     ↓
METADATA EXTRACTION → POSTGRESQL + PGVECTOR (Searchable)
     ↓
RELATIONSHIPS → NEO4J AURA + GRAPHITI (Temporal Analysis)
     ↓
IMAGE ANALYSIS → PHOTOPRISM (Metadata, Facial Recognition)
     ↓
TOOLS/WORKFLOWS → MCP SERVER (Exposed to External LLMs)
     ↓
AUTOMATION → N8N (Workflow Coordination)
```

---

## 🎯 **3-TIER VECTOR STORAGE ARCHITECTURE**

### **Tier 1: PGVector (PostgreSQL) - LONG-TERM PERSISTENT**
- **Purpose**: Permanent vector storage for all evidence, documents, analysis
- **Scope**: Everything searchable forever
- **Use Cases**: 
  - 8 years of message embeddings
  - Document analysis results
  - Case context and timeline
  - Pattern matching results
  - Cross-evidence relationships

### **Tier 2: Chroma VPS (72-Hour TTL) - SHORT-TERM PROCESSING**
- **Purpose**: Mimic human short-term memory during evidence processing
- **Scope**: Only what's currently being analyzed
- **TTL**: 72 hours automatic expiration
- **Use Cases**:
  - Active document processing chunks
  - Current investigation context
  - Temporary workflow state
  - "What was I just looking at?" memory

### **Tier 3: Chroma In-Process - MULTI-AGENT COORDINATION**
- **Purpose**: Session-only scratch space for agent-to-agent communication
- **Scope**: Single processing session
- **TTL**: Session duration only
- **Use Cases**:
  - Agent handoffs and coordination
  - Parallel processing results
  - Temporary tool outputs
  - Inter-agent message passing

---

## 🔄 **BIDIRECTIONAL MCP ARCHITECTURE**

### **INTERNAL FLOW (VPS Services → Platform)**
```
Docker Containers → MetaMCP (Internal:4001) → Platform
     ↓                ↓                    ↓
LiteLLM APIs       Route platform        Forensic
Neo4j Graph DB     requests to           Analysis
Chroma Vector DB   appropriate           Engine
Directus Files     services
PhotoPrism Images
```

### **EXTERNAL FLOW (Platform → External Clients)**
```
Platform → MetaMCP (External:4002) → External Clients
    ↓              ↓                    ↓
Forensic        Expose ALL tools      Claude Code
Analysis        to any LLM            Gemini CLI
Engine          client               Qwen Code
                                     Desktop/Mobile
```

---

## 🧠 **CONTEXT PERSISTENCE STRATEGY**

### **Human Memory Simulation**
- **Challenge**: Human analysts can only hold so much context in mind
- **Solution**: 72-hour TTL mimics human short-term memory
- **Benefit**: When full picture emerges, compare initial analysis vs. final analysis
- **Use Case**: Detect gaslighting/manipulation patterns that become obvious in hindsight

### **Permanent Context Storage**
- **Project State**: What has been processed, reviewed, analyzed
- **Timeline Tracking**: Chronological case progression  
- **Analysis History**: Previous findings and conclusions
- **Cross-Reference**: How initial context changes over time

### **Storage Location**
- **Primary**: PostgreSQL tables (structured metadata)
- **Secondary**: PGVector (embeddings for semantic search)
- **Tertiary**: Directus (raw files + file metadata)

---

## 🛠️ **MESSAGE PROCESSING PIPELINE (8 Years of Data)**

### **Step 1: Raw Message Ingestion**
```
SMS/Facebook/iMessage Exports → Directus (Evidentiary Storage)
     ↓
Metadata Extraction (Sender, Recipient, Timestamp, Platform)
     ↓
```

### **Step 2: Message Parsing & Classification**
```
Raw Messages → Multi-Pass NLP Classifier (6 passes)
     ↓
Platform Detection → Content Analysis → Behavioral Pattern Matching
     ↓
```

### **Step 3: Vector Embeddings & Storage**
```
Processed Messages → Embeddings (OpenAI/sentence-transformers)
     ↓
PGVector Storage → Long-term Searchable Context
     ↓
```

### **Step 4: Relationship Analysis**
```
Messages → Entity Extraction → Neo4j Graph Database
     ↓
Temporal Relationships → Graphiti Analysis → Pattern Detection
     ↓
```

---

## 🎨 **COMPONENT FEATURE MAP**

### **Frontend (React 19 + Tailwind 4)**
- **Home Dashboard**: System status, quick actions, recent activity
- **Tools Page**: Tool discovery and invocation
- **Settings Page**: 🔧 **WIRING NEEDED** (API keys, database config, LLM routing)
- **Pattern Library**: 🔧 **WIRING NEEDED** (Create, edit, delete 256 patterns)
- **Stats Page**: Performance metrics, usage analytics
- **API Keys**: 🔧 **WIRING NEEDED** (Claude Pro, Gemini Pro, ChatGPT Pro, etc.)
- **MCP Config**: Internal/External MetaMCP configuration

### **Backend (Node.js 22 + tRPC 11.6)**
- **MCP Gateway**: 4 core endpoints (search, describe, invoke, getRef)
- **Tool Registry**: 65 tools (20 working, 45 stubbed)
- **Task Executor**: Content-addressed deduplication, checkpoint/resume
- **Smart Router**: 🔧 **ROUTING LOGIC NEEDED** (cost, latency, failover)
- **Database Layer**: PostgreSQL + Drizzle ORM + PGVector
- **AI Framework Integration**: LangGraph, LangChain, LlamaIndex

### **Database Layer**
- **PostgreSQL**: Main relational database (metadata, messages, case context)
- **PGVector**: Vector embeddings for semantic search
- **Neo4j Aura**: Graph relationships and temporal analysis
- **Chroma**: Short-term and session-only vector storage

### **Infrastructure Layer**
- **Docker Compose**: 9 microservices orchestration
- **Kasm Workspace**: Debian desktop + CLI tools (Claude Code, Gemini CLI, etc.)
- **LiteLLM**: Universal LLM proxy (100+ models)
- **MetaMCP**: Internal + External MCP server registry
- **n8n**: Workflow automation
- **Redis**: Caching and job queues

---

## 🔗 **INTEGRATION POINTS**

### **External Service Connections**
- **Claude Pro**: Via CLI tools in Kasm workspace
- **Gemini Pro**: Via CLI tools in Kasm workspace  
- **ChatGPT Pro**: Via CLI tools in Kasm workspace
- **Perplexity Pro**: Via CLI tools in Kasm workspace
- **OpenAI API**: Direct API integration
- **Anthropic API**: Direct API integration
- **Groq API**: Direct API integration
- **Ollama**: Local model integration
- **NVIDIA**: GPU-accelerated processing
- **AWS/GCP/Azure**: Cloud services integration

### **CLI Tool Integration**
```
Platform → Kasm CLI Tools → Pro Accounts
     ↓            ↓               ↓
Forensic    Claude Code        Claude Pro
Analysis    Gemini CLI         Gemini Pro
Tools       Qwen Code          ChatGPT Pro
            Codex              Perplexity Pro
            Help Open Code     etc.
```

---

## ⚙️ **DATA FLOW DETAILS**

### **Document Processing Flow**
```
1. File Upload → Directus (evidentiary storage)
2. Metadata Extraction → PostgreSQL tables
3. Content Processing → NLP classification
4. Pattern Matching → Behavioral analysis
5. Vector Embeddings → PGVector storage
6. Relationship Analysis → Neo4j graph
7. Results Storage → PostgreSQL + Chroma
```

### **Tool Invocation Flow**
```
1. User selects tool → Platform
2. Smart Router → Optimal service selection
3. Service execution → Docker container/API
4. Results processing → Post-processing pipeline
5. Storage → Appropriate database
6. Response → User/External client
```

### **External Client Flow**
```
1. External LLM → MetaMCP (External:4002)
2. Tool discovery → Available forensic tools
3. Tool invocation → Platform internal execution
4. Results → External LLM
5. Context sync → VPS ↔ Desktop
```

---

## 🚨 **CRITICAL ARCHITECTURAL GAPS**

### **Current Issues**
- 🔴 drizzle.config.ts shows MySQL but needs PostgreSQL
- 🔴 Router layer has TODOs in all major functions
- 🔴 45/65 tool handlers are stubbed
- 🔴 Backend UI wiring incomplete
- 🔴 Missing External MetaMCP deployment
- 🔴 OOM errors in document loaders

### **Immediate Fixes Required**
1. ✅ **Drizzle Config**: MySQL → PostgreSQL (FIXED)
2. ⏳ **PostgreSQL Service**: Added to docker-compose
3. ⏳ **PGVector Integration**: Extensions and schemas
4. ⏳ **External MetaMCP**: Port 4002 deployment
5. ⏳ **Router Implementation**: Smart routing logic
6. ⏳ **Tool Handlers**: Complete missing executors
7. ⏳ **UI Wiring**: Settings and Pattern Library

---

## 🎯 **SUCCESS CRITERIA**

### **Phase 1 Goals (Document Processing)**
- ✅ PostgreSQL + PGVector running
- ✅ Settings page functional (API key management)
- ✅ Pattern Library functional (CRUD operations)
- ✅ Message parsing pipeline working
- ✅ Vector search operational

### **Phase 2 Goals (Tool Integration)**
- ⏳ 45 missing tool handlers implemented
- ⏳ OOM errors resolved
- ⏳ Streaming document processing
- ⏳ Large file support (5GB XML, 100-page PDFs)

### **Phase 3 Goals (LLM Integration)**
- ⏳ Smart router with failover
- ⏳ Pro account integration via CLI tools
- ⏳ External MetaMCP operational
- ⏳ Cross-platform context sync

### **Phase 4 Goals (Production Ready)**
- ⏳ Complete bidirectional MCP architecture
- ⏳ Security hardening (API key encryption)
- ⏳ Performance optimization
- ⏳ Comprehensive testing

---

This architecture document serves as the **single source of truth** for understanding your MCP Tool Platform's complex but brilliant design. The 3-tier vector storage mimicking human memory, bidirectional MCP flow, and integration with Pro accounts creates a truly unique forensic analysis system.