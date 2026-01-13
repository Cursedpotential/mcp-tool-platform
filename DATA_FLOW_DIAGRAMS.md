# MCP Tool Platform - Data Flow Diagrams

## 🔄 **PRIMARY DATA FLOW**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   RAW FILES     │    │   DIRECTUS      │    │   METADATA      │
│                 │    │   (Evidentiary  │    │   EXTRACTION    │
│ • SMS Exports   │───▶│    Storage)     │───▶│                 │
│ • PDFs          │    │                 │    │ • Sender/Recv   │
│ • Images        │    │ • AI-friendly   │    │ • Timestamps    │
│ • Documents     │    │   plugins       │    │ • Platform      │
│ • 8yr Messages  │    │ • Raw file      │    │ • Content       │
└─────────────────┘    │   untouched     │    └─────────────────┘
                       └─────────────────┘              │
                              │                         │
                              ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   POSTGRESQL    │    │   PGVECTOR      │    │   NEO4J AURA    │
│   + PostGIS     │    │  (Persistent    │    │   + Graphiti    │
│                 │    │   Vectors)      │    │                 │
│ • Raw Messages  │◀───│                 │◀───│ • Relationships │
│ • Case Context  │    │ • Embeddings    │    │ • Temporal      │
│ • Project State │    │ • Semantic      │    │   Analysis      │
│ • Timeline      │    │   Search        │    │ • Pattern       │
│ • Pattern Lib   │    │ • Cross-ref     │    │   Detection     │
└─────────────────┘    │   Evidence      │    └─────────────────┘
        │               └─────────────────┘             │
        │                       │                       │
        │                       ▼                       │
        │              ┌─────────────────┐              │
        │              │   CHROMA VPS    │              │
        │              │  (72hr TTL)     │              │
        │              │                 │              │
        │              │ • Short-term    │              │
        │              │   memory        │              │
        │              │ • Processing    │              │
        │              │   context       │              │
        │              │ • Human-like    │              │
        │              │   memory span   │              │
        │              └─────────────────┘              │
        │                       │                       │
        │                       ▼                       │
        │              ┌─────────────────┐              │
        │              │     KASM        │              │
        │              │   WORKSPACE     │              │
        │              │                 │              │
        │              │ • CLI Tools     │              │
        │              │ • Claude Code   │              │
        │              │ • Gemini CLI    │              │
        │              │ • Qwen Code     │              │
        │              │ • Pro Accounts  │              │
        │              └─────────────────┘              │
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                    ┌─────────────────┐
                    │     PLATFORM    │
                    │                 │
                    │ • tRPC API      │
                    │ • MCP Gateway   │
                    │ • Smart Router  │
                    │ • Tool Registry │
                    └─────────────────┘
```

## 🔄 **BIDIRECTIONAL MCP FLOW**

### **INTERNAL SERVICES → PLATFORM**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DOCKER        │    │   METAMCP       │    │     PLATFORM    │
│   SERVICES      │    │  (Internal:     │    │                 │
│                 │    │   4001)         │    │ • Forensic      │
│ • LiteLLM       │───▶│                 │───▶│   Analysis      │
│ • Neo4j Aura    │    │ • Route platform│    │ • Tool Registry │
│ • Chroma        │    │   requests      │    │ • Smart Router  │
│ • Directus      │    │ • Service       │    │ • MCP Gateway   │
│ • PhotoPrism    │    │   discovery     │    │ • Task Executor │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **PLATFORM → EXTERNAL CLIENTS**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     PLATFORM    │    │   METAMCP       │    │   EXTERNAL      │
│                 │    │  (External:     │    │   CLIENTS       │
│ • Forensic      │    │   4002)         │    │                 │
│   Analysis      │───▶│                 │───▶│ • Claude Code   │
│ • Tool Registry │    │ • Expose ALL    │    │ • Gemini CLI    │
│ • Workflows     │    │   tools         │    │ • Qwen Code     │
│ • Agents        │    │ • Client auth   │    │ • Desktop/Mobile│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🎯 **3-TIER VECTOR STORAGE COMPARISON**

| **Tier** | **Storage** | **TTL** | **Purpose** | **Use Case** |
|----------|-------------|---------|-------------|--------------|
| **Tier 1** | PGVector (PostgreSQL) | **Permanent** | Long-term evidence storage | 8yr messages, case context |
| **Tier 2** | Chroma VPS | **72 Hours** | Human-like short-term memory | Active processing, "what was I looking at?" |
| **Tier 3** | Chroma In-Process | **Session** | Multi-agent coordination | Agent handoffs, parallel processing |

### **Why This Design?**
```
HUMAN MEMORY SIMULATION:
├── Immediate Context (working memory)
├── Recent Context (72hr TTL - mimics human span)  
└── Long-term Memory (permanent - case facts)
```

## 🧠 **MESSAGE PROCESSING PIPELINE (8 Years)**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  MESSAGE        │    │     RAW         │    │   METADATA      │
│  EXPORTS        │    │   MESSAGES      │    │   EXTRACTION    │
│                 │    │                 │    │                 │
│ • SMS/iMessage  │───▶│ • Platform      │───▶│ • Sender        │
│ • Facebook      │    │   detection     │    │ • Recipient     │
│ • WhatsApp      │    │ • Content       │    │ • Timestamp     │
│ • 8yr dataset   │    │   parsing       │    │ • Platform      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   BEHAVIORAL    │    │   VECTOR        │    │   RELATIONSHIP  │
│   PATTERN       │    │   EMBEDDINGS    │    │   EXTRACTION    │
│   DETECTION     │    │                 │    │                 │
│                 │    │ • OpenAI/       │    │ • Entity        │
│ • Gaslighting   │◀───│   Transformers  │◀───│   extraction    │
│ • DARVO         │    │ • PGVector      │    │ • Temporal      │
│ • Manipulation  │    │   storage       │    │   relationships │
│ • Emotional     │    │ • Semantic      │    │ • Neo4j graph   │
│   abuse         │    │   search        │    │ • Graphiti      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       │                       │                       │
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PATTERN       │    │   CASE          │    │   SEARCHABLE    │
│   LIBRARY       │    │   CONTEXT       │    │   EVIDENCE      │
│   (256)         │    │                 │    │                 │
│                 │    │ • Project state │    │ • Cross-ref     │
│ • Custody       │    │ • Timeline      │    │ • Pattern       │
│   interference  │    │ • Analysis      │    │   matching      │
│ • Parental      │    │   history       │    │ • Semantic      │
│   alienation    │    │ • Cross-case    │    │   search        │
│ • Gaslighting    │    │   insights      │    │ • Timeline      │
│   patterns      │    │                 │    │   analysis      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ **TOOL REGISTRY & EXECUTION FLOW**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   TOOL          │    │    TOOL         │    │    TASK         │
│   REGISTRY      │    │   EXECUTOR      │    │   PROCESSING    │
│   (65 tools)    │    │                 │    │                 │
│                 │    │ • Content-      │    │ • Deduplication │
│ • Search (2)    │───▶│   addressed     │───▶│ • Checkpoint/   │
│ • Document (15) │    │ • Checkpoint    │    │   resume        │
│ • NLP (10)      │    │ • Backpressure  │    │ • Queue mgmt    │
│ • Forensics(20) │    │ • Error         │    │ • Error         │
│ • Rules (5)     │    │   handling      │    │   handling      │
│ • Diff (3)      │    │                 │    │                 │
│ • Filesystem(8) │    │                 │    │                 │
│ • ML (5)        │    │                 │    │                 │
│ • Retrieval(5)  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                    ┌─────────────────┐
                    │   RESULTS       │
                    │   STORAGE       │
                    │                 │
                    │ • PostgreSQL    │
                    │ • PGVector      │
                    │ • Neo4j         │
                    │ • Chroma        │
                    │ • Directus      │
                    └─────────────────┘
```

## 🔐 **AUTHENTICATION & INTEGRATION FLOW**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EXTERNAL      │    │   API KEY       │    │   SMART         │
│   LLM CLIENTS   │    │   MANAGEMENT    │    │   ROUTER        │
│                 │    │                 │    │                 │
│ • Claude Code   │───▶│ • AES-256       │───▶│ • Cost-based    │
│ • Gemini CLI    │    │   encryption    │    │ • Latency       │
│ • Qwen Code     │    │ • Pro accounts  │    │ • Capability    │
│ • ChatGPT UI    │    │ • API keys      │    │ • Failover      │
│ • Perplexity    │    │ • OAuth tokens  │    │ • Load balance  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VPS           │    │   CLI TOOLS     │    │   DIRECT        │
│   SERVICES      │    │   (KASM)        │    │   APIS          │
│                 │    │                 │    │                 │
│ • LiteLLM       │◀───│ • Claude Code   │◀───│ • OpenAI        │
│ • Neo4j Aura    │    │ • Gemini CLI    │    │ • Anthropic     │
│ • Chroma        │    │ • Qwen Code     │    │ • Groq          │
│ • PostgreSQL    │    │ • Pro accounts  │    │ • Local models  │
│ • Directus      │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ⚙️ **CONTEXT SYNCHRONIZATION**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VPS           │    │   SYNC          │    │   DESKTOP       │
│   (salem-forge) │◀──▶│   MECHANISM     │◀──▶│   (Home)        │
│                 │    │                 │    │                 │
│ • Full context  │    │ • Git-based     │    │ • Same files    │
│ • 8yr dataset   │    │ • File sync     │    │ • Same tools    │
│ • All evidence  │    │ • Ourclone/R    │    │ • Same session  │
│ • Tools/Workflows│   │   sync          │    │ • Same context  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │   MOBILE        │              │
         │              │   CLIENTS       │              │
         │              │                 │              │
         └──────────────│ • Continue      │              │
                        │   from anywhere │              │
                        │ • No context    │              │
                        │   loss          │              │
                        │ • Full tool     │              │
                        │   access        │              │
                        └─────────────────┘
```

This completes the comprehensive data flow documentation showing all the nuanced architectural decisions, especially the 3-tier vector storage system that mimics human memory patterns!