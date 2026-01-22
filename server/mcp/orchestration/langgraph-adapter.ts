/**
 * LangGraph Adapter for MCP Tool Platform
 *
 * Provides TypeScript-based state machine orchestration for multi-agent workflows.
 * Integrates with Python LangGraph via subprocess bridge for complex graph execution.
 */

import { spawn } from "child_process";
import path from "path";

// ============================================================================
// STATE SCHEMAS
// ============================================================================

export interface BaseWorkflowState {
  workflow_id: string;
  stage: string;
  timestamp: Date;
  metadata: Record<string, any>;
  error?: string;
}

export interface ForensicInvestigationState extends BaseWorkflowState {
  stage:
  | "preliminary"
  | "full_context"
  | "meta_analysis"
  | "reconciliation"
  | "complete";
  evidence_id: string;
  case_id: string;

  preliminary?: {
    timestamp: Date;
    classifications: ClassificationSnapshot;
    working_hypotheses: string[];
    uncertainty_flags: string[];
    chroma_collection_id: string;
  };

  full_context?: {
    timestamp: Date;
    classifications: ClassificationSnapshot;
    contradictions_found: number;
    pattern_sequences: PatternSequence[];
    neo4j_entity_ids: string[];
  };

  reconciliation?: {
    approved: boolean;
    investigator_notes: string;
    methodology_justification: string;
    checkpoint_id: string;
  };

  audit_trail: AnalysisSnapshot[];
}

export interface DocumentProcessingState extends BaseWorkflowState {
  stage:
  | "ingestion"
  | "type_detection"
  | "extraction"
  | "validation"
  | "storage"
  | "complete";
  document_id: string;
  source_path: string;

  detected_type?: {
    format: "pdf" | "html" | "docx" | "txt" | "image" | "unknown";
    confidence: number;
    mime_type: string;
  };

  extracted_content?: {
    text: string;
    metadata: Record<string, any>;
    chunks: DocumentChunk[];
    entities: ExtractedEntity[];
  };

  validation?: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };

  storage?: {
    r2_key: string;
    supabase_id: string;
    directus_id?: string;
  };
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface ClassificationSnapshot {
  severity: number;
  patterns: string[];
  sentiment: "positive" | "negative" | "neutral" | "manipulative";
  confidence: number;
  reasoning: string;
}

export interface PatternSequence {
  pattern_type: string;
  occurrences: number;
  date_range: [Date, Date];
  coordination_score: number;
  evidence_refs: string[];
}

export interface AnalysisSnapshot {
  timestamp: Date;
  source: "chroma_preliminary" | "full_context_meta" | "human_review";
  classifications: ClassificationSnapshot;
  reasoning: string;
}

export interface DocumentChunk {
  chunk_id: string;
  text: string;
  start_index: number;
  end_index: number;
  metadata: Record<string, any>;
}

export interface ExtractedEntity {
  entity_id: string;
  type: string;
  name: string;
  confidence: number;
  mentions: number;
}

// ============================================================================
// GRAPH NODE TYPES
// ============================================================================

export type GraphNode<T extends BaseWorkflowState> = (
  state: T
) => Promise<Partial<T>>;

export type ConditionalEdge<T extends BaseWorkflowState> = (state: T) => string;

export interface GraphDefinition<T extends BaseWorkflowState> {
  name: string;
  description: string;
  initial_state: Partial<T>;
  nodes: Map<string, GraphNode<T>>;
  edges: Map<string, string | ConditionalEdge<T>>;
  entry_point: string;
  checkpoints?: string[];
}

// ============================================================================
// LANGGRAPH ADAPTER CLASS
// ============================================================================

export class LangGraphAdapter {
  private pythonBridgePath: string;
  private stateStore: Map<string, any> = new Map(); // In-memory fallback

  constructor() {
    this.pythonBridgePath = path.join(
      __dirname,
      "../../python-tools/langgraph_runner.py"
    );
  }

  createGraph<T extends BaseWorkflowState>(
    name: string,
    description: string,
    initialState: Partial<T>
  ): GraphBuilder<T> {
    return new GraphBuilder<T>(name, description, initialState);
  }

  async executeGraph<T extends BaseWorkflowState>(
    graph: GraphDefinition<T>,
    initialState: Partial<T>
  ): Promise<T> {
    let currentState: T = { ...graph.initial_state, ...initialState } as T;
    let currentNode = graph.entry_point;

    while (currentNode !== "END") {
      if (graph.checkpoints?.includes(currentNode)) {
        console.log(`[LangGraph] Checkpoint reached: ${currentNode}. Saving state...`);
        await this.saveGraphState(currentState);
      }

      const nodeFunc = graph.nodes.get(currentNode);
      if (!nodeFunc) {
        throw new Error(`Node not found: ${currentNode}`);
      }

      console.log(`[LangGraph] Executing node: ${currentNode}`);
      try {
        const updates = await nodeFunc(currentState);
        currentState = { ...currentState, ...updates };
      } catch (error: any) {
        console.error(`[LangGraph] Node ${currentNode} failed:`, error.message);
        currentState.error = error.message;
        break;
      }

      const edge = graph.edges.get(currentNode);
      if (!edge) {
        throw new Error(`No edge defined for node: ${currentNode}`);
      }

      currentNode = typeof edge === "string" ? edge : edge(currentState);
    }

    return currentState;
  }

  async getGraphState(workflowId: string): Promise<BaseWorkflowState | null> {
    return this.stateStore.get(workflowId) || null;
  }

  async saveGraphState<T extends BaseWorkflowState>(state: T): Promise<void> {
    console.log(`[LangGraph] Persisting state for workflow: ${state.workflow_id}`);
    this.stateStore.set(state.workflow_id, state);
  }

  async executePythonGraph(graphSpec: any, initialState: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Use python if python3.11 is not available, but try preferred first
      const pythonCmd = process.platform === "win32" ? "python" : "python3";

      const process_p = spawn(pythonCmd, [
        this.pythonBridgePath,
        "execute_graph",
        JSON.stringify(graphSpec),
        JSON.stringify(initialState),
      ]);

      let stdout = "";
      let stderr = "";

      process_p.stdout.on("data", data => {
        stdout += data.toString();
      });

      process_p.stderr.on("data", data => {
        stderr += data.toString();
      });

      process_p.on("close", code => {
        if (code !== 0) {
          reject(new Error(`Python LangGraph failed: ${stderr}`));
        } else {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (err) {
            reject(new Error(`Failed to parse Python output. Raw: ${stdout}`));
          }
        }
      });
    });
  }
}

// ============================================================================
// GRAPH BUILDER (FLUENT API)
// ============================================================================

export class GraphBuilder<T extends BaseWorkflowState> {
  private graph: GraphDefinition<T>;

  constructor(name: string, description: string, initialState: Partial<T>) {
    this.graph = {
      name,
      description,
      initial_state: initialState,
      nodes: new Map(),
      edges: new Map(),
      entry_point: "",
      checkpoints: [],
    };
  }

  addNode(name: string, func: GraphNode<T>): this {
    this.graph.nodes.set(name, func);
    return this;
  }

  addEdge(from: string, to: string): this {
    this.graph.edges.set(from, to);
    return this;
  }

  addConditionalEdge(from: string, condition: ConditionalEdge<T>): this {
    this.graph.edges.set(from, condition);
    return this;
  }

  setEntryPoint(nodeName: string): this {
    this.graph.entry_point = nodeName;
    return this;
  }

  addCheckpoint(nodeName: string): this {
    if (!this.graph.checkpoints) {
      this.graph.checkpoints = [];
    }
    this.graph.checkpoints.push(nodeName);
    return this;
  }

  build(): GraphDefinition<T> {
    if (!this.graph.entry_point) {
      throw new Error("Entry point not set");
    }
    return this.graph;
  }
}

export const langGraphAdapter = new LangGraphAdapter();
