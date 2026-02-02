# Framework Decision Matrix

**Last Updated:** February 2, 2026
**Purpose:** Quick reference for framework vs custom implementation decisions

---

## 🚨 Mandatory Workflow

**BEFORE implementing ANY feature:**

1. ✅ Check **Composio** ([tools catalog](https://composio.dev/tools))
2. ✅ Check **CopilotKit** (UI components)
3. ✅ Check **LangChain** ([integrations](https://python.langchain.com/docs/integrations/))
4. ✅ Check **LangGraph** (workflow patterns)
5. ✅ Check **Community MCP Servers** ([mcpservers.org](https://mcpservers.org/))
6. ⚠️ Only implement custom if NO existing solution

---

## 📊 Decision Matrix for Current Features

| Feature | Composio | LangChain | MCP Server | Decision |
|---------|----------|-----------|------------|----------|
| **NotebookLM** | ❌ Not available | ❌ Not available | ✅ Community server exists | Use **PleasePrompto/notebooklm-mcp** |
| **pgvector (PostgreSQL)** | ✅ Via Supabase (79 tools) | ✅ Native integration | N/A | Use **LangChain pgvector** |
| **ChromaDB** | ❌ Not available | ✅ Native integration | N/A | Use **LangChain Chroma** |
| **Neo4j** | ❌ Not available | ❌ Not available | ⚠️ Generic exists | **Custom implementation** |
| **Graphiti** | ❌ Not available | ❌ Not available | ❌ No server | **Custom implementation** |
| **n8n** | ❌ Not available | ⚠️ Community tool | N/A | Use **n8n REST API** (VPS1) |
| **LLM Providers** | ❌ Limited | ✅ All major providers | N/A | Use **LangChain models** + LiteLLM |
| **Agent Orchestration** | ❌ Not a focus | ✅ LangGraph | N/A | Use **Native LangGraph** |
| **Chat UI** | ❌ Not a focus | ❌ Not a focus | N/A | Use **CopilotKit components** |
| **Entity Extraction** | ❌ Not available | ✅ Via LLM chains | N/A | Use **LangChain chains** |
| **Embeddings** | ✅ Via Pinecone | ✅ Multiple providers | N/A | Use **LangChain + Ollama** (VPS2) |

---

## 📦 Framework Capabilities Summary

### Composio (877 toolkits, 11,000+ tools)

**Strong Areas:**
- SaaS integrations (Slack, Gmail, GitHub, Notion, Jira)
- Cloud services (AWS, GCP, Azure)
- CRM/Business (Salesforce, HubSpot, Pipedrive)
- Vector databases (**Pinecone** - 30 tools)
- Cloud PostgreSQL (**Supabase** - 79 tools, **Neon** - 69 tools)

**Gaps for Our Project:**
- ❌ No NotebookLM
- ❌ No Neo4j or graph databases
- ❌ No direct PostgreSQL (only cloud providers)
- ❌ No Graphiti temporal graphs
- ❌ No n8n or workflow automation

**Best Use Cases:**
- External API integrations (if we need Slack, Discord, etc.)
- Cloud storage (if using S3, GCS, Azure Blob)
- SaaS tool integrations

### LangChain (Python/TypeScript)

**Strong Areas:**
- LLM providers (OpenAI, Anthropic, Google, Ollama, etc.)
- Vector stores (Chroma, FAISS, pgvector, Pinecone, Weaviate)
- Document loaders (PDF, CSV, JSON, HTML, etc.)
- Text splitters and chunking
- Chains and prompt templates
- Output parsers (structured data extraction)
- Memory buffers (conversation history)

**Gaps for Our Project:**
- ❌ No NotebookLM integration
- ❌ No Neo4j/Graphiti temporal graphs
- ❌ No forensic-specific tools
- ❌ No contradiction detection

**Best Use Cases:**
- ✅ LLM operations (entity extraction, summarization, classification)
- ✅ Vector database operations (Chroma, pgvector)
- ✅ Embeddings generation (OpenAI, Ollama)
- ✅ Agent orchestration (LangGraph)

### LangGraph

**Strong Areas:**
- Agent workflow orchestration
- State management
- Multi-step agent execution
- Human-in-the-loop integration
- Conditional routing

**Best Use Cases:**
- ✅ Evidence processing pipelines
- ✅ Multi-agent coordination
- ✅ Complex workflows with decision points

### CopilotKit

**Strong Areas:**
- React chat UI components
- Agent action integration
- Conversational interfaces
- Streaming responses
- Function calling UI

**Best Use Cases:**
- ✅ Chat interface for evidence search
- ✅ Agent interaction panels
- ✅ Conversational analysis UI

### Community MCP Servers

**Available:**
- ✅ NotebookLM servers (PleasePrompto, jacob-bd, Pantheon-Security)
- ✅ Brave Search, Tavily, Perplexity
- ✅ File system operations
- ✅ Various SaaS integrations

**Best Use Cases:**
- ✅ NotebookLM integration
- ✅ Search APIs
- ✅ Third-party services without official SDKs

---

## 🔨 Implementation Decisions

### ✅ USE EXISTING FRAMEWORKS

**1. Vector Operations → LangChain**
```typescript
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';

// Working memory (72hr TTL)
const chromaStore = await Chroma.fromExistingCollection(
  new OllamaEmbeddings({ baseUrl: 'http://10.10.0.3:11434' }),
  { collectionName: 'evidence', url: 'http://10.10.0.3:8000' }
);

// Permanent storage
const pgStore = await PGVectorStore.initialize(
  new OllamaEmbeddings({ baseUrl: 'http://10.10.0.3:11434' }),
  { connectionString: process.env.POSTGRES_URL, tableName: 'embeddings' }
);
```

**2. LLM Operations → LangChain + LiteLLM**
```typescript
import { ChatOpenAI } from '@langchain/openai';

// Point to LiteLLM gateway on VPS2
const model = new ChatOpenAI({
  basePath: 'http://10.10.0.3:4000/v1',
  apiKey: process.env.LITELLM_API_KEY,
  modelName: 'ollama/llama3.1'
});

// Entity extraction
const extractChain = prompt.pipe(model).pipe(entityParser);
const entities = await extractChain.invoke({ text });
```

**3. Agent Workflows → LangGraph**
```typescript
import { StateGraph } from '@langchain/langgraph';

const workflow = new StateGraph({
  channels: {
    evidence: { value: null },
    entities: { value: [] },
    analysis: { value: null }
  }
})
  .addNode('ingest', ingestEvidence)
  .addNode('extract', extractEntities)
  .addNode('analyze', analyzePatterns)
  .addEdge('ingest', 'extract')
  .addEdge('extract', 'analyze');

const app = workflow.compile();
```

**4. Chat UI → CopilotKit**
```typescript
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';

<CopilotKit runtimeUrl="/api/copilotkit">
  <YourApp />
  <CopilotSidebar
    labels={{
      title: "Forensic Analysis Assistant",
      initial: "How can I help analyze evidence?"
    }}
  />
</CopilotKit>
```

**5. NotebookLM → Community MCP Server** ✅ COMPLETE
```bash
# Configured in claude_desktop_config.json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "@pleaseprompto/notebooklm-mcp"]
    }
  }
}

# Removed custom implementation
# - Deleted server/mcp/plugins/notebooklm.ts (477 lines)
# - Now using community MCP server directly
```

### ⚠️ CUSTOM IMPLEMENTATION REQUIRED

**1. Neo4j + Graphiti Integration**
- **Reason**: No existing framework support for temporal knowledge graphs
- **Location**: `server/mcp/storage/graphiti-client.ts`
- **Complexity**: Medium (use neo4j-driver directly)

**2. Contradiction Detection**
- **Reason**: Forensic-specific logic not in any framework
- **Location**: `server/mcp/plugins/graphiti-memory.ts`
- **Complexity**: Medium (Cypher queries + LLM analysis)

**3. Network Analysis (Centrality, Communities)**
- **Reason**: Neo4j GDS (Graph Data Science) library required
- **Location**: `server/mcp/plugins/graph-analytics.ts`
- **Complexity**: High (requires Neo4j GDS installation)

**4. PostGIS Spatial Analysis**
- **Reason**: TraceIQ GPS-specific forensic requirements
- **Location**: `server/mcp/plugins/spatial-analytics.ts`
- **Complexity**: High (PostGIS functions, geofencing)

**5. Forensic Chain of Custody**
- **Reason**: Legal/compliance requirements specific to forensics
- **Location**: `server/mcp/plugins/evidence-hasher.ts` (exists)
- **Complexity**: Low (already implemented)

---

## 🎯 Revised Implementation Strategy

### Phase 1: Framework Integration (10 hours)
1. **LangChain Vector Stores** (3 hours)
   - Replace custom Chroma client with LangChain
   - Replace custom pgvector with LangChain
   - Wire to TrinityRouter

2. **LangChain LLMs** (2 hours)
   - Configure LiteLLM gateway
   - Replace custom LLM calls with LangChain models

3. **NotebookLM MCP** (1 hour)
   - Install community server
   - Remove custom plugin
   - Test integration

4. **CopilotKit UI** (4 hours)
   - Set up runtime endpoint
   - Wire evidence search actions
   - Replace custom chat UI

### Phase 2: Custom Core Logic (20 hours)
5. **Graphiti MCP Tools** (8 hours)
   - Create memory tools using LangChain for entity extraction
   - Implement temporal queries

6. **Contradiction Detection** (4 hours)
   - Cypher queries + LangChain for analysis

7. **Network Analysis** (8 hours)
   - Neo4j GDS integration
   - Community detection, centrality

### Phase 3: Advanced Features (28 hours)
8. **Temporal Patterns** (10 hours)
9. **Cross-Evidence Linking** (10 hours)
10. **Spatial Analysis** (8 hours)

**Total: 58 hours** (down from 70-78 hours with framework leverage)

---

## ✅ Pre-Implementation Checklist

Before writing ANY new feature:

- [ ] Searched Composio tool catalog (composio.dev/tools)
- [ ] Checked LangChain integrations docs
- [ ] Searched for community MCP servers (mcpservers.org)
- [ ] Checked CopilotKit for UI components
- [ ] Verified no existing solution exists
- [ ] Documented decision in this matrix

If framework exists: **Use it**
If no framework exists: **Document why custom needed**

---

**Sources:**
- [Composio Tools Catalog](https://composio.dev/tools)
- [Composio Documentation](https://docs.composio.dev/tools)
- [LangChain Vector Stores](https://python.langchain.com/docs/integrations/vectorstores/)
- [LangChain Google Vertex AI Vector Search](https://docs.langchain.com/oss/python/integrations/vectorstores/google_vertex_ai_vector_search)
- [NotebookLM MCP Servers](https://github.com/PleasePrompto/notebooklm-mcp)
- [MCP Servers Directory](https://mcpservers.org/)
