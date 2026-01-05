/**
 * LangGraph Plugin for MCP Gateway
 * 
 * Exposes LangGraph orchestration capabilities as MCP tools.
 * Allows AI agents to create, execute, and monitor multi-stage workflows.
 */

import type { ToolSpec } from '../../../shared/mcp-types/index';
import {
  langGraphAdapter,
  ForensicInvestigationState,
  DocumentProcessingState,
  BaseWorkflowState
} from '../orchestration/langgraph-adapter';
import {
  forensicWorkflows,
  executeForensicInvestigation,
  streamForensicInvestigation,
  executeDocumentProcessing
} from '../orchestration/forensic-workflow';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const langGraphTools: ToolSpec[] = [
  {
    name: 'langgraph.createGraph',
    description: 'Create a new LangGraph workflow definition with nodes, edges, and conditional routing. Returns a graph ID that can be executed.',
    category: 'orchestration',
    version: '1.0.0',
    tags: ['workflow', 'agent', 'state-machine', 'orchestration'],
    permissions: ['access:llm', 'write'],
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique name for the workflow'
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what the workflow does'
        },
        workflow_type: {
          type: 'string',
          enum: ['forensic_investigation', 'document_processing', 'custom'],
          description: 'Type of workflow to create. Use "custom" for user-defined workflows.'
        },
        initial_state: {
          type: 'object',
          description: 'Initial state object for the workflow',
          additionalProperties: true
        }
      },
      required: ['name', 'workflow_type']
    },
    outputSchema: {
      type: 'object',
      properties: {
        graph_id: { type: 'string', description: 'Unique identifier for the created graph' },
        name: { type: 'string', description: 'Graph name' },
        node_count: { type: 'number', description: 'Number of nodes in the graph' },
        checkpoint_count: { type: 'number', description: 'Number of human approval checkpoints' },
        entry_point: { type: 'string', description: 'Starting node name' }
      }
    }
  },
  {
    name: 'langgraph.executeGraph',
    description: 'Execute a LangGraph workflow and return the final state. Blocks until workflow completes or reaches a checkpoint requiring human approval.',
    category: 'orchestration',
    version: '1.0.0',
    tags: ['workflow', 'execution', 'agent'],
    permissions: ['access:llm', 'access:vectordb', 'access:graphdb', 'write'],
    inputSchema: {
      type: 'object',
      properties: {
        workflow_type: {
          type: 'string',
          enum: ['forensic_investigation', 'document_processing'],
          description: 'Type of workflow to execute'
        },
        evidence_id: {
          type: 'string',
          description: 'Evidence ID (required for forensic_investigation)'
        },
        case_id: {
          type: 'string',
          description: 'Case ID (required for forensic_investigation)'
        },
        document_id: {
          type: 'string',
          description: 'Document ID (required for document_processing)'
        },
        source_path: {
          type: 'string',
          description: 'Source file path (required for document_processing)'
        }
      },
      required: ['workflow_type']
    },
    outputSchema: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'Workflow execution ID' },
        stage: { type: 'string', description: 'Final stage reached' },
        status: { type: 'string', enum: ['completed', 'checkpoint', 'error'], description: 'Execution status' },
        final_state: { type: 'object', description: 'Final workflow state', additionalProperties: true },
        checkpoints_reached: { type: 'array', items: { type: 'string' }, description: 'List of checkpoint nodes reached' }
      }
    }
  },
  {
    name: 'langgraph.streamGraph',
    description: 'Execute a LangGraph workflow with streaming updates. Returns state snapshots after each node execution for real-time monitoring.',
    category: 'orchestration',
    version: '1.0.0',
    tags: ['workflow', 'streaming', 'real-time', 'monitoring'],
    permissions: ['access:llm', 'access:vectordb', 'access:graphdb', 'write'],
    inputSchema: {
      type: 'object',
      properties: {
        workflow_type: {
          type: 'string',
          enum: ['forensic_investigation', 'document_processing'],
          description: 'Type of workflow to execute'
        },
        evidence_id: {
          type: 'string',
          description: 'Evidence ID (required for forensic_investigation)'
        },
        case_id: {
          type: 'string',
          description: 'Case ID (required for forensic_investigation)'
        },
        document_id: {
          type: 'string',
          description: 'Document ID (required for document_processing)'
        },
        source_path: {
          type: 'string',
          description: 'Source file path (required for document_processing)'
        }
      },
      required: ['workflow_type']
    },
    outputSchema: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'Workflow execution ID' },
        snapshots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stage: { type: 'string', description: 'Current stage' },
              timestamp: { type: 'string', description: 'ISO timestamp' },
              state: { type: 'object', description: 'State snapshot', additionalProperties: true }
            }
          },
          description: 'State snapshots after each node execution'
        },
        total_nodes: { type: 'number', description: 'Total nodes executed' }
      }
    }
  },
  {
    name: 'langgraph.getGraphState',
    description: 'Get the current state of a running or paused workflow. Useful for resuming interrupted workflows or checking checkpoint status.',
    category: 'orchestration',
    version: '1.0.0',
    tags: ['workflow', 'state', 'resumability'],
    permissions: ['read:network'],
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'string',
          description: 'Workflow execution ID'
        }
      },
      required: ['workflow_id']
    },
    outputSchema: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string', description: 'Workflow ID' },
        stage: { type: 'string', description: 'Current stage' },
        status: { type: 'string', enum: ['running', 'paused', 'completed', 'error'], description: 'Workflow status' },
        state: { type: 'object', description: 'Current state', additionalProperties: true },
        next_checkpoint: { type: 'string', description: 'Next checkpoint node (if any)' }
      }
    }
  },
  {
    name: 'langgraph.listWorkflows',
    description: 'List all available workflow templates with descriptions and capabilities.',
    category: 'orchestration',
    version: '1.0.0',
    tags: ['workflow', 'discovery', 'templates'],
    permissions: ['read:network'],
    inputSchema: {
      type: 'object',
      properties: {}
    },
    outputSchema: {
      type: 'object',
      properties: {
        workflows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Workflow type identifier' },
              name: { type: 'string', description: 'Human-readable name' },
              description: { type: 'string', description: 'What the workflow does' },
              stages: { type: 'array', items: { type: 'string' }, description: 'List of stages' },
              checkpoints: { type: 'array', items: { type: 'string' }, description: 'Human approval points' },
              required_inputs: { type: 'array', items: { type: 'string' }, description: 'Required input parameters' }
            }
          }
        }
      }
    }
  }
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================

export const langGraphHandlers = {
  'langgraph.createGraph': async (params: any) => {
    const { name, description, workflow_type, initial_state = {} } = params;
    
    let graph;
    let graphId: string;
    
    switch (workflow_type) {
      case 'forensic_investigation':
        if (!params.evidence_id || !params.case_id) {
          throw new Error('evidence_id and case_id required for forensic_investigation');
        }
        graph = forensicWorkflows.createForensicInvestigation(
          params.evidence_id,
          params.case_id
        );
        graphId = `forensic_${params.evidence_id}`;
        break;
        
      case 'document_processing':
        if (!params.document_id || !params.source_path) {
          throw new Error('document_id and source_path required for document_processing');
        }
        graph = forensicWorkflows.createDocumentProcessing(
          params.document_id,
          params.source_path
        );
        graphId = `doc_${params.document_id}`;
        break;
        
      case 'custom':
        // For custom workflows, create empty graph
        graph = langGraphAdapter.createGraph(name, description || '', initial_state).build();
        graphId = `custom_${Date.now()}`;
        break;
        
      default:
        throw new Error(`Unknown workflow type: ${workflow_type}`);
    }
    
    return {
      graph_id: graphId,
      name: graph.name,
      node_count: graph.nodes.size,
      checkpoint_count: graph.checkpoints?.length || 0,
      entry_point: graph.entry_point
    };
  },
  
  'langgraph.executeGraph': async (params: any) => {
    const { workflow_type } = params;
    
    let result: BaseWorkflowState;
    let checkpointsReached: string[] = [];
    
    switch (workflow_type) {
      case 'forensic_investigation':
        if (!params.evidence_id || !params.case_id) {
          throw new Error('evidence_id and case_id required');
        }
        result = await executeForensicInvestigation(params.evidence_id, params.case_id);
        checkpointsReached = ['preliminary_approval', 'meta_analysis_approval'];
        break;
        
      case 'document_processing':
        if (!params.document_id || !params.source_path) {
          throw new Error('document_id and source_path required');
        }
        result = await executeDocumentProcessing(params.document_id, params.source_path);
        checkpointsReached = [];
        break;
        
      default:
        throw new Error(`Unknown workflow type: ${workflow_type}`);
    }
    
    return {
      workflow_id: result.workflow_id,
      stage: result.stage,
      status: 'completed',
      final_state: result,
      checkpoints_reached: checkpointsReached
    };
  },
  
  'langgraph.streamGraph': async (params: any) => {
    const { workflow_type } = params;
    
    const snapshots: any[] = [];
    
    switch (workflow_type) {
      case 'forensic_investigation':
        if (!params.evidence_id || !params.case_id) {
          throw new Error('evidence_id and case_id required');
        }
        
        for await (const state of streamForensicInvestigation(params.evidence_id, params.case_id)) {
          snapshots.push({
            stage: state.stage,
            timestamp: state.timestamp.toISOString(),
            state: state
          });
        }
        break;
        
      case 'document_processing':
        if (!params.document_id || !params.source_path) {
          throw new Error('document_id and source_path required');
        }
        
        // Document processing doesn't have streaming yet, execute normally
        const result = await executeDocumentProcessing(params.document_id, params.source_path);
        snapshots.push({
          stage: result.stage,
          timestamp: result.timestamp.toISOString(),
          state: result
        });
        break;
        
      default:
        throw new Error(`Unknown workflow type: ${workflow_type}`);
    }
    
    return {
      workflow_id: snapshots[0]?.state?.workflow_id || `stream_${Date.now()}`,
      snapshots,
      total_nodes: snapshots.length
    };
  },
  
  'langgraph.getGraphState': async (params: any) => {
    const { workflow_id } = params;
    
    // In production, this would query Supabase for persisted state
    const state = await langGraphAdapter.getGraphState(workflow_id);
    
    if (!state) {
      throw new Error(`Workflow not found: ${workflow_id}`);
    }
    
    return {
      workflow_id: state.workflow_id,
      stage: state.stage,
      status: 'completed',
      state: state,
      next_checkpoint: null
    };
  },
  
  'langgraph.listWorkflows': async () => {
    return {
      workflows: [
        {
          type: 'forensic_investigation',
          name: 'Forensic Investigation Workflow',
          description: 'Multi-stage forensic analysis: preliminary (Chroma, 0-72h) → meta-analysis (Neo4j, post-72h) → reconciliation',
          stages: [
            'preliminary_analysis',
            'export_to_chroma',
            'preliminary_approval',
            'meta_analysis',
            'detect_contradictions',
            'export_to_neo4j',
            'export_to_supabase',
            'meta_analysis_approval'
          ],
          checkpoints: ['preliminary_approval', 'meta_analysis_approval'],
          required_inputs: ['evidence_id', 'case_id']
        },
        {
          type: 'document_processing',
          name: 'Document Processing Workflow',
          description: 'Document ingestion pipeline: type detection → extraction → validation → storage (R2/Supabase/Directus)',
          stages: [
            'type_detection',
            'content_extraction',
            'validation',
            'storage'
          ],
          checkpoints: [],
          required_inputs: ['document_id', 'source_path']
        }
      ]
    };
  }
};
