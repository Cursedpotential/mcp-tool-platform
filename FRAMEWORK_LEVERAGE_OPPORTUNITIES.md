# Framework Leverage Opportunities

**Last Updated:** February 1, 2026
**Purpose:** Replace custom implementations with existing frameworks
**Impact:** Reduce development effort by 40-60 hours

---

## 🎯 User Directive

> "We need to be looking at our other frameworks to help us expedite. Don't reinvent the wheel."

**Frameworks Already Installed:**
- ✅ **Composio** - 500+ tool integrations (@composio/core, @composio/langchain)
- ✅ **LangChain/LangGraph** - Agent orchestration (@langchain/core, @langchain/langgraph)
- ✅ **CopilotKit** - React UI components (@copilotkit/react-core, @copilotkit/react-ui)

**Available via NPM/MCP:**
- 🔄 **NotebookLM MCP** - Multiple community servers available
- 🔄 **n8n** - Workflow automation (already deployed on VPS1)
- 🔄 **Tavily/Perplexity** - Search APIs (mentioned in docs)

---

## 🔄 Replace Custom Code with Frameworks

### 1. NotebookLM - Use Existing MCP Server ⚠️

**Current State:**
- ❌ Custom implementation: `server/mcp/plugins/notebooklm.ts` (165 lines)
- ❌ Custom MCP client spawning child process
- ❌ Reinventing the wheel

**Solution - Use Community MCP Server:**

**Best Options (2026):**

1. **PleasePrompto/notebooklm-mcp** (Recommended)
   - Persistent auth, library management
   - Cross-client sharing (Claude Code, Codex share same library)
   - Zero hallucinations, citation-backed answers
   - Install: `npx -y @pleaseprompto/notebooklm-mcp`

2. **jacob-bd/notebooklm-mcp-cli**
   - Unified CLI + MCP server (one install)
   - Major refactor in Jan 2026
   - Install: `npm install -g notebooklm-mcp-cli`

3. **Pantheon-Security/notebooklm-mcp-secure**
   - Enterprise-grade security (14 hardening layers)
   - Post-quantum encryption
   - For sensitive forensic use cases
   - Install: `npx @pantheon-security/notebooklm-mcp-secure`

**Action Items:**
- [ ] Remove `server/mcp/plugins/notebooklm.ts`
- [ ] Add to `.mcp.json` or `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "@pleaseprompto/notebooklm-mcp"]
    }
  }
}
```
- [ ] Remove custom tool handlers from `executor.ts`
- [ ] Tools automatically available to all agents

**Effort Saved:** ~6 hours (no custom integration needed)

---

### 2. Workflow Automation - Use n8n (Already Deployed) ⚠️

**Current State:**
- 🟡 Custom implementation: `server/mcp/plugins/n8n.ts` (180 lines)
- ✅ n8n already running on VPS1:5678
- ❌ Custom wrapper instead of using n8n's native API

**Solution - Use n8n Native API:**

**n8n REST API (Already Available):**
```typescript
// Instead of custom plugin, use n8n API directly
import axios from 'axios';

const N8N_URL = process.env.N8N_URL || 'http://10.10.0.2:5678';
const N8N_API_KEY = process.env.N8N_API_KEY;

export async function triggerWorkflow(workflowId: string, data: any) {
  const response = await axios.post(
    `${N8N_URL}/webhook/${workflowId}`,
    data,
    { headers: { 'X-N8N-API-KEY': N8N_API_KEY } }
  );
  return response.data;
}
```

**Or use LangChain n8n integration:**
```typescript
import { N8nTool } from '@langchain/community/tools/n8n';

const n8nTool = new N8nTool({
  baseURL: process.env.N8N_URL,
  apiKey: process.env.N8N_API_KEY
});
```

**Action Items:**
- [ ] Replace custom n8n.ts with n8n REST API calls
- [ ] Or use LangChain's N8nTool wrapper
- [ ] Remove duplicate code

**Effort Saved:** ~4 hours

---

### 3. External Search - Use Composio or Existing MCPs ⚠️

**Current State:**
- 🟡 Custom implementation: `server/mcp/plugins/browser-search.ts` (275 lines)
- ❌ Custom Tavily/Perplexity wrappers
- ❌ Reinventing API clients

**Solution - Use Composio Tools:**

Composio provides 500+ integrations including:
- Search engines
- Social media platforms
- Knowledge bases
- APIs and webhooks

**Example (Composio):**
```typescript
import { Composio } from '@composio/core';

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

// Use existing integrations instead of custom code
const searchTool = await composio.getTools(['TAVILY_SEARCH', 'GOOGLE_SEARCH']);

// Execute search
const results = await composio.execute({
  action: 'TAVILY_SEARCH',
  params: { query: 'forensic timeline analysis' }
});
```

**Or use existing MCP servers:**
- `@modelcontextprotocol/server-brave-search`
- `mcp-server-tavily`
- Custom search APIs via Composio

**Action Items:**
- [ ] Evaluate Composio's search integrations
- [ ] Replace custom browser-search.ts
- [ ] Use Composio or community MCP servers

**Effort Saved:** ~6 hours

---

### 4. Python Bridge - Use LangChain Python Integration ⚠️

**Current State:**
- 🟡 Custom implementation: `server/mcp/plugins/python-tools.ts` (412 lines)
- ❌ Custom subprocess bridge
- ❌ Manual Python process management

**Solution - Use LangChain Python Bridge:**

```typescript
import { PythonInterpreterTool } from '@langchain/community/tools/python';

const pythonTool = new PythonInterpreterTool({
  pythonPath: process.env.PYTHON_PATH || 'python3'
});

// Execute Python code
const result = await pythonTool.invoke({
  code: `
import nltk
result = nltk.pos_tag(['forensic', 'analysis'])
print(result)
  `
});
```

**Or use Composio Python integration:**
```typescript
// Composio handles Python tool execution
const tools = await composio.getTools(['PYTHON_INTERPRETER']);
```

**Action Items:**
- [ ] Replace custom python-tools.ts with LangChain PythonInterpreterTool
- [ ] Or use Composio Python integration
- [ ] Remove subprocess management code

**Effort Saved:** ~8 hours

---

### 5. LLM Integration - Use LangChain Providers ⚠️

**Current State:**
- 🟡 Custom LLM provider management in `Settings.tsx`
- ❌ Manual API client creation
- ❌ Custom retry logic, error handling

**Solution - Use LangChain Models:**

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// LangChain handles provider switching
const model = settings.provider === 'openai'
  ? new ChatOpenAI({ modelName: 'gpt-4', apiKey: process.env.OPENAI_API_KEY })
  : new ChatAnthropic({ modelName: 'claude-3-opus-20240229', apiKey: process.env.ANTHROPIC_API_KEY });

// Use for entity extraction, summarization, etc.
const response = await model.invoke([
  { role: 'user', content: 'Extract entities from this text...' }
]);
```

**Or use LiteLLM (already on VPS2:4000):**
```typescript
// Point to your LiteLLM gateway
const model = new ChatOpenAI({
  basePath: 'http://10.10.0.3:4000/v1',
  apiKey: process.env.LITELLM_API_KEY,
  modelName: 'ollama/llama3.1'
});
```

**Action Items:**
- [ ] Replace custom LLM client code with LangChain models
- [ ] Point to LiteLLM gateway on VPS2 for unified routing
- [ ] Remove custom retry/error handling (LangChain has this)

**Effort Saved:** ~6 hours

---

### 6. Agent Orchestration - Use LangGraph ⚠️

**Current State:**
- 🟡 Custom implementation: `server/mcp/plugins/langgraph-plugin.ts` (298 lines)
- ❌ Reinventing LangGraph patterns
- ❌ Manual workflow execution

**Solution - Use LangGraph Directly:**

```typescript
import { StateGraph } from '@langchain/langgraph';

// Define agent workflow
const workflow = new StateGraph({
  channels: {
    evidence: { value: null },
    entities: { value: [] },
    analysis: { value: null }
  }
});

// Add nodes
workflow.addNode('ingest', ingestEvidence);
workflow.addNode('extract', extractEntities);
workflow.addNode('analyze', analyzePatterns);

// Add edges
workflow.addEdge('ingest', 'extract');
workflow.addEdge('extract', 'analyze');

// Compile and run
const app = workflow.compile();
const result = await app.invoke({ evidence: inputData });
```

**Action Items:**
- [ ] Replace custom langgraph-plugin.ts with native LangGraph
- [ ] Use LangGraph for evidence processing pipelines
- [ ] Remove custom workflow execution code

**Effort Saved:** ~8 hours

---

### 7. UI Components - Use CopilotKit ⚠️

**Current State:**
- ✅ CopilotKit installed but not integrated
- ❌ Custom UI components for agent interaction
- ❌ Custom chat interface components

**Solution - Use CopilotKit Components:**

**File:** `client/src/pages/Agents.tsx` (if exists)

```typescript
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar, CopilotChat } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';

export function AgentsPage() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="flex h-screen">
        <div className="flex-1">
          {/* Your main content */}
        </div>

        <CopilotSidebar
          labels={{
            title: "Evidence Analysis Assistant",
            initial: "How can I help you analyze evidence?"
          }}
        >
          <CopilotChat />
        </CopilotSidebar>
      </div>
    </CopilotKit>
  );
}
```

**Backend Runtime:**
```typescript
// server/api/copilotkit/route.ts
import { CopilotRuntime, OpenAIAdapter } from '@copilotkit/runtime';

export async function POST(req: Request) {
  const copilotKit = new CopilotRuntime({
    actions: [
      {
        name: 'search_evidence',
        description: 'Search for evidence in the database',
        parameters: z.object({
          query: z.string(),
          caseId: z.string()
        }),
        handler: async ({ query, caseId }) => {
          return await trinityRouter.query({
            type: 'semantic',
            query,
            caseId
          });
        }
      }
    ]
  });

  return copilotKit.response(req, new OpenAIAdapter());
}
```

**Action Items:**
- [ ] Replace custom chat UI with CopilotKit components
- [ ] Set up CopilotRuntime with evidence search actions
- [ ] Remove custom agent UI code

**Effort Saved:** ~12 hours

---

## 📊 Total Effort Reduction

| Replacement | Custom Lines | Framework Solution | Effort Saved |
|-------------|--------------|-------------------|--------------|
| NotebookLM | 165 lines | Use MCP server | 6 hours |
| n8n Integration | 180 lines | n8n REST API | 4 hours |
| Browser Search | 275 lines | Composio tools | 6 hours |
| Python Bridge | 412 lines | LangChain PythonTool | 8 hours |
| LLM Providers | ~300 lines | LangChain models | 6 hours |
| Agent Orchestration | 298 lines | Native LangGraph | 8 hours |
| Chat UI | ~400 lines | CopilotKit components | 12 hours |
| **TOTAL** | **~2,030 lines** | **Framework replacements** | **50 hours** |

---

## 🚀 Implementation Plan

### Phase 1: External Integrations (Low Risk)
1. **NotebookLM** - Add MCP server to config (30 min)
2. **n8n** - Replace with REST API calls (2 hours)
3. **Browser Search** - Evaluate Composio tools (4 hours)

### Phase 2: Core Replacements (Medium Risk)
4. **Python Bridge** - Switch to LangChain (4 hours)
5. **LLM Providers** - Migrate to LangChain models (6 hours)

### Phase 3: Orchestration (High Value)
6. **LangGraph** - Replace custom workflow (8 hours)
7. **CopilotKit UI** - Integrate chat components (12 hours)

**Total Replacement Time:** ~36 hours (saves 50 hours net = 14 hours gained)

---

## 📋 Specific Actions

### Action 1: Install NotebookLM MCP Server

**Choose one:**

**Option A: PleasePrompto/notebooklm-mcp (Recommended)**
```bash
# Install globally
npm install -g @pleaseprompto/notebooklm-mcp

# Add to MCP config
# File: ~/.config/claude/claude_desktop_config.json or .mcp.json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["-y", "@pleaseprompto/notebooklm-mcp"]
    }
  }
}
```

**Option B: jacob-bd/notebooklm-mcp-cli (CLI + MCP)**
```bash
npm install -g notebooklm-mcp-cli

# CLI usage
nlm create "My Research Notebook"
nlm add source https://example.com/doc.pdf
nlm ask "What are the key findings?"

# MCP automatically available
```

**Then remove:**
- `server/mcp/plugins/notebooklm.ts`
- Related handlers in `executor.ts`

---

### Action 2: Use Composio for External APIs

**Composio Supported Tools (Relevant to Project):**

```typescript
import { Composio } from '@composio/core';

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

// Get available tools
const tools = await composio.getTools([
  // Search & Research
  'TAVILY_SEARCH',
  'BRAVE_SEARCH',
  'GOOGLE_SEARCH',

  // File Storage
  'GOOGLE_DRIVE',
  'DROPBOX',
  'ONEDRIVE',

  // Communication
  'SLACK',
  'DISCORD',
  'TEAMS',

  // Databases
  'POSTGRES',
  'MYSQL',
  'MONGODB',

  // Cloud Services
  'AWS_S3',
  'GCP_STORAGE',
  'AZURE_BLOB'
]);

// Execute tools
const result = await composio.execute({
  action: 'TAVILY_SEARCH',
  params: { query: 'forensic evidence analysis' }
});
```

**Action Items:**
- [ ] Audit `server/mcp/plugins/` for Composio-replaceable tools
- [ ] Create Composio tools config
- [ ] Remove redundant custom implementations

**Effort Saved:** ~10 hours across multiple plugins

---

### Action 3: Use LangChain for LLM Operations

**Replace custom LLM code with LangChain:**

**Entity Extraction:**
```typescript
import { ChatOpenAI } from '@langchain/openai';
import { StructuredOutputParser } from 'langchain/output_parsers';

const model = new ChatOpenAI({ modelName: 'gpt-4' });
const parser = StructuredOutputParser.fromZodSchema(EntitySchema);

const chain = model.pipe(parser);
const entities = await chain.invoke({
  messages: [{
    role: 'user',
    content: `Extract entities from: ${text}`
  }]
});
```

**Summarization:**
```typescript
import { loadSummarizationChain } from 'langchain/chains';

const chain = loadSummarizationChain(model, { type: 'map_reduce' });
const summary = await chain.invoke({ input_documents: docs });
```

**Contradiction Detection:**
```typescript
import { ChatPromptTemplate } from '@langchain/core/prompts';

const prompt = ChatPromptTemplate.fromMessages([
  ['system', 'You are a forensic analyst detecting contradictions.'],
  ['user', 'Compare these statements: {fact1} vs {fact2}']
]);

const chain = prompt.pipe(model);
const result = await chain.invoke({ fact1, fact2 });
```

**Action Items:**
- [ ] Replace custom LLM calls in NLP plugins
- [ ] Use LangChain chains for complex operations
- [ ] Point to LiteLLM gateway (VPS2:4000) for unified routing

**Effort Saved:** ~8 hours

---

### Action 4: Integrate CopilotKit UI

**Current Custom UI (if exists):**
- Custom chat components
- Custom agent interaction panels
- Custom evidence browser

**Replace with CopilotKit:**

**Setup (one-time):**
```typescript
// server/api/copilotkit/route.ts
import { CopilotRuntime, OpenAIAdapter } from '@copilotkit/runtime';

export async function POST(req: Request) {
  const runtime = new CopilotRuntime({
    actions: [
      {
        name: 'search_evidence',
        description: 'Search evidence database',
        parameters: z.object({
          query: z.string(),
          caseId: z.string()
        }),
        handler: async ({ query, caseId }) => {
          return await trinityRouter.query({ type: 'semantic', query, caseId });
        }
      },
      {
        name: 'analyze_timeline',
        description: 'Analyze entity timeline',
        parameters: z.object({
          entityId: z.string(),
          startDate: z.string(),
          endDate: z.string()
        }),
        handler: async (params) => {
          return await graphitiClient.getTimeline(params);
        }
      },
      {
        name: 'detect_patterns',
        description: 'Detect behavioral patterns',
        parameters: z.object({
          caseId: z.string(),
          patternType: z.enum(['repeating', 'sequence', 'evolution'])
        }),
        handler: async (params) => {
          return await detectTemporalPatterns(params);
        }
      }
    ]
  });

  return runtime.response(req, new OpenAIAdapter({
    model: process.env.OPENAI_MODEL || 'gpt-4'
  }));
}
```

**Client Integration:**
```typescript
// client/src/App.tsx or specific pages
import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';

<CopilotKit runtimeUrl="/api/copilotkit">
  <YourApp />
  <CopilotSidebar
    defaultOpen={true}
    labels={{
      title: "Forensic Analysis Assistant",
      initial: "I can help you search evidence, analyze timelines, and detect patterns."
    }}
  />
</CopilotKit>
```

**Action Items:**
- [ ] Set up CopilotKit runtime endpoint
- [ ] Define actions for evidence operations
- [ ] Replace custom chat UI components
- [ ] Wire up to TrinityRouter and Graphiti

**Effort Saved:** ~12 hours

---

## ✅ Revised Timeline with Framework Leverage

### Original Gap Analysis (Custom Implementation)
- Priority 1: 14-18 hours
- Priority 2: 20-22 hours
- Priority 3: 36-38 hours
- **Total: 70-78 hours**

### With Framework Leverage
- Priority 1: 14-18 hours (core logic still needed)
- Priority 2: 20-22 hours (graph analytics still custom)
- Priority 3: 36-38 hours (forensic features still custom)
- **Subtotal: 70-78 hours**

**MINUS Framework Replacements:**
- NotebookLM: -6 hours
- n8n: -4 hours
- Search: -6 hours
- Python: -8 hours
- LLM: -6 hours
- LangGraph: -8 hours
- CopilotKit: -12 hours
- **Saved: -50 hours**

**Net Development Time: 20-28 hours** (instead of 70-78 hours)

---

## 🚨 Enforcement

**New Development Rule:**

Before implementing ANY feature, check:
1. ✅ Does Composio have a tool for this?
2. ✅ Is there a community MCP server?
3. ✅ Does LangChain have a built-in component?
4. ✅ Can CopilotKit handle the UI?

**Only write custom code if:**
- No existing solution exists
- Existing solution doesn't meet forensic requirements
- Custom implementation required for performance/security

---

**Sources:**
- [PleasePrompto/notebooklm-mcp](https://github.com/PleasePrompto/notebooklm-mcp)
- [jacob-bd/notebooklm-mcp-cli](https://github.com/jacob-bd/notebooklm-mcp-cli)
- [Pantheon-Security/notebooklm-mcp-secure](https://github.com/Pantheon-Security/notebooklm-mcp-secure)
- [NotebookLM MCP Setup Guide](https://juliangoldie.com/notebooklm-mcp-setup/)
- [Composio AI Integration Platform](https://composio.dev/blog/ai-agent-gtm-integrations-guide)
- [Supercharge NotebookLM With MCP](https://medium.com/the-context-layer/superpower-notebooklm-with-an-mcp-server-fe4d6038c3db)
