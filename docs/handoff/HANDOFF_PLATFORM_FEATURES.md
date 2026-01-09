# Handoff: Platform Features & Cognitive Architecture

**Thread:** 3 of 3
**Priority:** P1 - Core functionality
**Date:** January 9, 2026

---

## ⚠️ CRITICAL: DELEGATE ALL CODING

You have access to Groq, Gemini, OpenRouter, Anthropic, and Cohere APIs through Manus settings. **DO NOT write boilerplate code yourself.** Delegate to external LLMs for:

- Agent class implementations
- Parser code
- UI components
- Test writing

Use your tokens for planning, architecture decisions, debugging, and user communication only.

---

## Mission

Implement the cognitive architecture (thinking types and memory processes), build the agent system, and complete the parser framework. This thread handles the core intelligence of the platform.

---

## BLOCKED: Cognitive Architecture Spec

The user is searching for a previous conversation that contains the specification for thinking types and memory processes. **Wait for this spec before implementing the cognitive architecture.**

In the meantime, work on the agent builder system and parser framework which are not blocked.

---

## Current State

### Memory Architecture (Implemented)

The three-tier memory system is designed but needs wiring:

| Tier | Implementation | Status |
|------|----------------|--------|
| **Persistent Context** | Graphiti + Neo4j | Graphiti deploying to Cloud Run (Thread 2) |
| **Working Memory** | Chroma (salem-forge) | Docker-compose ready, needs deployment (Thread 1) |
| **Scratch Space** | Manus ephemeral | Needs implementation |

### Agent System (Partial)

Base agent infrastructure exists but templates are incomplete:

- `/server/mcp/orchestration/` - LangGraph workflows exist
- Agent templates are stubbed but not implemented
- No agent coordination/swarm system yet

### Parser Framework (Partial)

Some parsers exist in `/server/mcp/plugins/`:

| Parser | Status |
|--------|--------|
| SMS | Stub exists |
| Facebook | Stub exists |
| iMessage | Stub exists |
| ChatGPT | Not started |
| Email | Not started |
| Google Timeline | Not started |

---

## Tasks

### 1. Agent Builder System

Create the agent infrastructure:

**Base Agent Class:**
```typescript
// server/mcp/agents/base-agent.ts
export abstract class BaseAgent {
  id: string;
  name: string;
  tools: string[];
  memory: MemoryInterface;
  state: AgentState;
  
  abstract async execute(input: any): Promise<any>;
  abstract async plan(goal: string): Promise<ActionPlan>;
}
```

**Agent Templates to Implement:**

| Agent | Purpose | Tools |
|-------|---------|-------|
| `ForensicAnalysisAgent` | Analyze evidence for patterns | pattern-detector, entity-extractor, timeline-builder |
| `DocumentProcessingAgent` | Parse and extract from documents | pdf-parser, ocr, unstructured |
| `PatternDetectionAgent` | Find behavioral patterns | ml-classifier, rules-engine |
| `EvidenceCollectionAgent` | Gather and organize evidence | search, filesystem, hasher |
| `MetaAnalysisAgent` | Synthesize findings across agents | summarizer, graph-query |

**Agent Coordinator:**
```typescript
// server/mcp/agents/coordinator.ts
export class AgentCoordinator {
  async orchestrate(agents: BaseAgent[], task: Task): Promise<Result>;
  async distribute(task: Task): Promise<AgentAssignment[]>;
  async aggregate(results: AgentResult[]): Promise<FinalResult>;
}
```

### 2. Parser Framework

Extract parsers from the Google Drive utilities project and create a unified interface:

**Unified Parser Interface:**
```typescript
interface Parser {
  name: string;
  supportedFormats: string[];
  parse(input: Buffer | string): Promise<ParsedDocument>;
  validate(input: any): boolean;
}

interface ParsedDocument {
  type: string;
  content: any;
  metadata: DocumentMetadata;
  entities: Entity[];
  timestamps: Timestamp[];
}
```

**Parsers to Implement:**

1. **ChatGPT Parser** - Extract conversation turns, identify entities, extract code artifacts
2. **Google Timeline Parser** - Parse semantic segments, detect multi-device patterns
3. **SMS Parser** - Group threads, detect participants, extract media references
4. **Facebook Parser** - Messages, reactions, attachments, thread structure
5. **iMessage Parser** - Conversations, tapbacks, media, group chats
6. **Email Parser** - Headers, threads, attachments, MIME parsing

### 3. Memory Coordination Layer

Once the cognitive spec is provided, implement the memory coordination:

```typescript
// server/mcp/memory/coordinator.ts
export class MemoryCoordinator {
  persistent: GraphitiClient;  // Neo4j via Graphiti
  working: ChromaClient;       // 72hr TTL
  scratch: InMemoryStore;      // Session only
  
  async store(item: MemoryItem, tier: MemoryTier): Promise<void>;
  async retrieve(query: string, tiers: MemoryTier[]): Promise<MemoryItem[]>;
  async promote(item: MemoryItem, from: MemoryTier, to: MemoryTier): Promise<void>;
  async cleanup(): Promise<void>;  // TTL enforcement
}
```

### 4. LangChain/LangGraph Wiring

Connect the memory system to LangChain:

1. Create custom LangChain memory class that uses MemoryCoordinator
2. Wire to existing LangGraph workflows in `/server/mcp/orchestration/`
3. Implement shared context for agent swarms
4. Add hypothesis evolution tracking

### 5. Frontend UI

Create the agent management interface:

| Page | Purpose |
|------|---------|
| `AgentBuilder.tsx` | Create and configure agents |
| `WorkflowExecution.tsx` | Run and monitor workflows |
| `AgentDashboard.tsx` | View active agents, tasks, metrics |
| `MemoryExplorer.tsx` | Browse memory tiers, view entities |

---

## Cognitive Architecture (BLOCKED)

When the user provides the thinking types spec, implement:

**Expected components (based on previous discussion):**

| Type | Description | Implementation |
|------|-------------|----------------|
| System 1 | Fast, intuitive processing | Pattern matching, quick classification |
| System 2 | Slow, deliberate reasoning | Deep analysis, chain-of-thought |
| Episodic Memory | Specific events/documents | Graphiti temporal storage |
| Semantic Memory | General knowledge/facts | Neo4j knowledge graph |
| Working Memory | Active processing buffer | Chroma 72hr TTL |
| Procedural Memory | How to do things | Workflow templates |

**Wait for user to provide the actual spec before implementing.**

---

## Success Criteria

1. Base agent class and 5 agent templates implemented
2. Agent coordinator handles multi-agent orchestration
3. All 6 parsers implemented with unified interface
4. Memory coordinator connects all three tiers
5. LangChain memory integration working
6. Frontend agent management UI functional
7. Cognitive architecture implemented (after spec received)

---

## Files to Reference

- `/server/mcp/orchestration/` - Existing LangGraph workflows
- `/server/mcp/plugins/` - Existing parser stubs
- `/server/mcp/workers/executor.ts` - Tool execution
- `/docs/architecture/ARCHITECTURE.md` - System design
- `/docs/architecture/LANGGRAPH_FORENSIC_WORKFLOWS.md` - Workflow patterns

---

## Notes

- The cognitive architecture is the most important part but is blocked on user input
- Start with agent builder and parsers while waiting
- The memory tiers depend on Thread 1 (VPS deployment) and Thread 2 (Graphiti Cloud Run)
- Coordinate with other threads on service availability
