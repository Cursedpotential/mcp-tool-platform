/**
 * LangGraph Adapter for MCP Tool Platform
 * 
 * Provides TypeScript-based state machine orchestration for multi-agent workflows.
 * Integrates with Python LangGraph via subprocess bridge for complex graph execution.
 */

import { spawn } from 'child_process';
import path from 'path';

// ============================================================================
// STATE SCHEMAS
// ============================================================================

/**
 * Base state interface for all LangGraph workflows
 */
export interface BaseWorkflowState {
  workflow_id: string;
  stage: string;
  timestamp: Date;
  metadata: Record<string, any>;
  error?: string;
}

/**
 * Forensic investigation state machine
 * Tracks progression: preliminary → full_context → meta_analysis → reconciliation
 */
export interface ForensicInvestigationState extends BaseWorkflowState {
  stage: 'preliminary' | 'full_context' | 'meta_analysis' | 'reconciliation' | 'complete';
  evidence_id: string;
  case_id: string;
  
  // Preliminary findings (Chroma stage, 0-72h)
  preliminary?: {
    timestamp: Date;
    classifications: ClassificationSnapshot;
    working_hypotheses: string[];
    uncertainty_flags: string[];
    chroma_collection_id: string;
  };
  
  // Full context findings (Meta-analysis stage, post-72h)
  full_context?: {
    timestamp: Date;
    classifications: ClassificationSnapshot;
    contradictions_found: number;
    pattern_sequences: PatternSequence[];
    neo4j_entity_ids: string[];
  };
  
  // Reconciliation (Human-in-the-loop)
  reconciliation?: {
    approved: boolean;
    investigator_notes: string;
    methodology_justification: string;
    checkpoint_id: string;
  };
  
  // Audit trail (all analysis snapshots)
  audit_trail: AnalysisSnapshot[];
}

/**
 * Document processing state machine
 * Tracks: ingestion → type_detection → extraction → validation → storage
 */
export interface DocumentProcessingState extends BaseWorkflowState {
  stage: 'ingestion' | 'type_detection' | 'extraction' | 'validation' | 'storage' | 'complete';
  document_id: string;
  source_path: string;
  
  // Type detection results
  detected_type?: {
    format: 'pdf' | 'html' | 'docx' | 'txt' | 'image' | 'unknown';
    confidence: number;
    mime_type: string;
  };
  
  // Extraction results
  extracted_content?: {
    text: string;
    metadata: Record<string, any>;
    chunks: DocumentChunk[];
    entities: ExtractedEntity[];
  };
  
  // Validation results
  validation?: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
  
  // Storage references
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
  sentiment: 'positive' | 'negative' | 'neutral' | 'manipulative';
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
  source: 'chroma_preliminary' | 'full_context_meta' | 'human_review';
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

/**
 * Graph node function signature
 * Takes current state and returns updated state
 */
export type GraphNode<T extends BaseWorkflowState> = (state: T) => Promise<Partial<T>>;

/**
 * Conditional edge function signature
 * Returns next node name based on current state
 */
export type ConditionalEdge<T extends BaseWorkflowState> = (state: T) => string;

/**
 * Graph definition
 */
export interface GraphDefinition<T extends BaseWorkflowState> {
  name: string;
  description: string;
  initial_state: Partial<T>;
  nodes: Map<string, GraphNode<T>>;
  edges: Map<string, string | ConditionalEdge<T>>;
  entry_point: string;
  checkpoints?: string[]; // Node names where human approval is required
}

// ============================================================================
// LANGGRAPH ADAPTER CLASS
// ============================================================================

export class LangGraphAdapter {
  private pythonBridgePath: string;
  
  constructor() {
    this.pythonBridgePath = path.join(__dirname, '../../python-tools/langgraph_runner.py');
  }
  
  /**
   * Create a new graph definition
   */
  createGraph<T extends BaseWorkflowState>(
    name: string,
    description: string,
    initialState: Partial<T>
  ): GraphBuilder<T> {
    return new GraphBuilder<T>(name, description, initialState);
  }
  
  /**
   * Execute a graph with given initial state
   * Returns final state after all nodes complete
   */
  async executeGraph<T extends BaseWorkflowState>(
    graph: GraphDefinition<T>,
    initialState: Partial<T>
  ): Promise<T> {
    let currentState: T = { ...graph.initial_state, ...initialState } as T;
    let currentNode = graph.entry_point;
    
    while (currentNode !== 'END') {
      // Check if this is a checkpoint node
      if (graph.checkpoints?.includes(currentNode)) {
        console.log(`[LangGraph] Checkpoint reached: ${currentNode}`);
        // In production, this would pause and wait for human approval
        // For now, we continue automatically
      }
      
      // Execute current node
      const nodeFunc = graph.nodes.get(currentNode);
      if (!nodeFunc) {
        throw new Error(`Node not found: ${currentNode}`);
      }
      
      console.log(`[LangGraph] Executing node: ${currentNode}`);
      const updates = await nodeFunc(currentState);
      currentState = { ...currentState, ...updates };
      
      // Determine next node
      const edge = graph.edges.get(currentNode);
      if (!edge) {
        throw new Error(`No edge defined for node: ${currentNode}`);
      }
      
      if (typeof edge === 'string') {
        currentNode = edge;
      } else {
        currentNode = edge(currentState);
      }
      
      console.log(`[LangGraph] Next node: ${currentNode}`);
    }
    
    return currentState;
  }
  
  /**
   * Execute graph with streaming updates
   * Yields state after each node execution
   */
  async *streamGraph<T extends BaseWorkflowState>(
    graph: GraphDefinition<T>,
    initialState: Partial<T>
  ): AsyncGenerator<T> {
    let currentState: T = { ...graph.initial_state, ...initialState } as T;
    let currentNode = graph.entry_point;
    
    while (currentNode !== 'END') {
      const nodeFunc = graph.nodes.get(currentNode);
      if (!nodeFunc) {
        throw new Error(`Node not found: ${currentNode}`);
      }
      
      const updates = await nodeFunc(currentState);
      currentState = { ...currentState, ...updates };
      
      // Yield updated state
      yield currentState;
      
      // Determine next node
      const edge = graph.edges.get(currentNode);
      if (!edge) {
        throw new Error(`No edge defined for node: ${currentNode}`);
      }
      
      currentNode = typeof edge === 'string' ? edge : edge(currentState);
    }
  }
  
  /**
   * Get current state of a running graph (for resumability)
   */
  async getGraphState(workflowId: string): Promise<BaseWorkflowState | null> {
    // In production, this would query Supabase for persisted state
    // For now, return null (not implemented)
    return null;
  }
  
  /**
   * Save graph state for resumability
   */
  async saveGraphState<T extends BaseWorkflowState>(state: T): Promise<void> {
    // In production, this would persist to Supabase
    console.log(`[LangGraph] Saving state for workflow: ${state.workflow_id}`);
  }
  
  /**
   * Execute complex graph via Python LangGraph bridge
   * For workflows that require Python-specific libraries
   */
  async executePythonGraph(
    graphSpec: any,
    initialState: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn('python3.11', [
        this.pythonBridgePath,
        'execute_graph',
        JSON.stringify(graphSpec),
        JSON.stringify(initialState)
      ]);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python LangGraph failed: ${stderr}`));
        } else {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (err) {
            reject(new Error(`Failed to parse Python output: ${stdout}`));
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
      entry_point: '',
      checkpoints: []
    };
  }
  
  /**
   * Add a node to the graph
   */
  addNode(name: string, func: GraphNode<T>): this {
    this.graph.nodes.set(name, func);
    return this;
  }
  
  /**
   * Add a direct edge between two nodes
   */
  addEdge(from: string, to: string): this {
    this.graph.edges.set(from, to);
    return this;
  }
  
  /**
   * Add a conditional edge (routing based on state)
   */
  addConditionalEdge(from: string, condition: ConditionalEdge<T>): this {
    this.graph.edges.set(from, condition);
    return this;
  }
  
  /**
   * Set the entry point node
   */
  setEntryPoint(nodeName: string): this {
    this.graph.entry_point = nodeName;
    return this;
  }
  
  /**
   * Mark a node as a checkpoint (requires human approval)
   */
  addCheckpoint(nodeName: string): this {
    if (!this.graph.checkpoints) {
      this.graph.checkpoints = [];
    }
    this.graph.checkpoints.push(nodeName);
    return this;
  }
  
  /**
   * Build and return the graph definition
   */
  build(): GraphDefinition<T> {
    if (!this.graph.entry_point) {
      throw new Error('Entry point not set');
    }
    return this.graph;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const langGraphAdapter = new LangGraphAdapter();
