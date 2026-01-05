/**
 * LangGraph Workflow Tests
 * 
 * Tests for LangGraph state machine framework, forensic workflows, and MCP integration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  langGraphAdapter,
  ForensicInvestigationState,
  DocumentProcessingState
} from './langgraph-adapter';
import {
  forensicWorkflows,
  executeForensicInvestigation,
  executeDocumentProcessing
} from './forensic-workflow';

describe('LangGraph Adapter', () => {
  describe('Graph Builder', () => {
    it('should create a graph with initial state', () => {
      const graph = langGraphAdapter.createGraph<{ stage: string }>(
        'test_graph',
        'Test graph',
        { stage: 'init' }
      );
      
      expect(graph).toBeDefined();
      expect(graph.name).toBe('test_graph');
      expect(graph.description).toBe('Test graph');
    });
    
    it('should add nodes to graph', () => {
      const graph = langGraphAdapter.createGraph('test', 'Test', { stage: 'init' });
      
      graph.addNode('step1', async (state) => {
        return { stage: 'step1_complete' };
      });
      
      graph.addNode('step2', async (state) => {
        return { stage: 'step2_complete' };
      });
      
      const built = graph.build();
      expect(built.nodes.size).toBe(2);
      expect(built.nodes.has('step1')).toBe(true);
      expect(built.nodes.has('step2')).toBe(true);
    });
    
    it('should add edges between nodes', () => {
      const graph = langGraphAdapter.createGraph('test', 'Test', { stage: 'init' });
      
      graph
        .addNode('step1', async (state) => ({ stage: 'step1' }))
        .addNode('step2', async (state) => ({ stage: 'step2' }))
        .addEdge('step1', 'step2')
        .setEntryPoint('step1');
      
      const built = graph.build();
      expect(built.edges.has('step1')).toBe(true);
      expect(built.edges.get('step1')).toBe('step2');
    });
    
    it('should add conditional edges', () => {
      const graph = langGraphAdapter.createGraph<{ value: number }>(
        'test',
        'Test',
        { value: 0 }
      );
      
      graph
        .addNode('check', async (state) => state)
        .addNode('high', async (state) => ({ value: 100 }))
        .addNode('low', async (state) => ({ value: 10 }))
        .addConditionalEdge('check', (state) => {
          return state.value > 50 ? 'high' : 'low';
        })
        .setEntryPoint('check');
      
      const built = graph.build();
      expect(built.conditionalEdges.has('check')).toBe(true);
    });
    
    it('should set entry point', () => {
      const graph = langGraphAdapter.createGraph('test', 'Test', { stage: 'init' });
      
      graph
        .addNode('start', async (state) => state)
        .setEntryPoint('start');
      
      const built = graph.build();
      expect(built.entry_point).toBe('start');
    });
    
    it('should add checkpoints', () => {
      const graph = langGraphAdapter.createGraph('test', 'Test', { stage: 'init' });
      
      graph
        .addNode('step1', async (state) => state)
        .addNode('approval', async (state) => state)
        .addCheckpoint('approval');
      
      const built = graph.build();
      expect(built.checkpoints).toContain('approval');
    });
  });
  
  describe('Graph Execution', () => {
    it('should execute simple linear graph', async () => {
      const graph = langGraphAdapter.createGraph<{ count: number }>(
        'counter',
        'Counter graph',
        { count: 0 }
      );
      
      graph
        .addNode('increment', async (state) => {
          return { count: state.count + 1 };
        })
        .addNode('double', async (state) => {
          return { count: state.count * 2 };
        })
        .addEdge('increment', 'double')
        .addEdge('double', 'END')
        .setEntryPoint('increment');
      
      const built = graph.build();
      const result = await langGraphAdapter.executeGraph(built, {});
      
      expect(result.count).toBe(2); // (0 + 1) * 2 = 2
    });
    
    it('should execute graph with conditional routing', async () => {
      const graph = langGraphAdapter.createGraph<{ value: number; path: string }>(
        'router',
        'Router graph',
        { value: 75, path: '' }
      );
      
      graph
        .addNode('check', async (state) => state)
        .addNode('high_path', async (state) => {
          return { ...state, path: 'high' };
        })
        .addNode('low_path', async (state) => {
          return { ...state, path: 'low' };
        })
        .addConditionalEdge('check', (state) => {
          return state.value > 50 ? 'high_path' : 'low_path';
        })
        .addEdge('high_path', 'END')
        .addEdge('low_path', 'END')
        .setEntryPoint('check');
      
      const built = graph.build();
      const result = await langGraphAdapter.executeGraph(built, {});
      
      expect(result.path).toBe('high');
    });
    
    it('should stream graph execution', async () => {
      const graph = langGraphAdapter.createGraph<{ step: number }>(
        'stepper',
        'Step graph',
        { step: 0 }
      );
      
      graph
        .addNode('step1', async (state) => ({ step: 1 }))
        .addNode('step2', async (state) => ({ step: 2 }))
        .addNode('step3', async (state) => ({ step: 3 }))
        .addEdge('step1', 'step2')
        .addEdge('step2', 'step3')
        .addEdge('step3', 'END')
        .setEntryPoint('step1');
      
      const built = graph.build();
      const snapshots: number[] = [];
      
      for await (const state of langGraphAdapter.streamGraph(built, {})) {
        snapshots.push(state.step);
      }
      
      expect(snapshots).toEqual([1, 2, 3]);
    });
  });
});

describe('Forensic Investigation Workflow', () => {
  const testEvidenceId = 'evidence_test_001';
  const testCaseId = 'case_test_001';
  
  describe('Workflow Creation', () => {
    it('should create forensic investigation workflow', () => {
      const workflow = forensicWorkflows.createForensicInvestigation(
        testEvidenceId,
        testCaseId
      );
      
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('forensic_investigation');
      expect(workflow.nodes.size).toBeGreaterThan(0);
      expect(workflow.checkpoints.length).toBe(2); // preliminary_approval, meta_analysis_approval
    });
    
    it('should have correct workflow stages', () => {
      const workflow = forensicWorkflows.createForensicInvestigation(
        testEvidenceId,
        testCaseId
      );
      
      const expectedNodes = [
        'preliminary_analysis',
        'export_to_chroma',
        'preliminary_approval',
        'meta_analysis',
        'detect_contradictions',
        'export_to_neo4j',
        'export_to_supabase',
        'meta_analysis_approval'
      ];
      
      for (const nodeName of expectedNodes) {
        expect(workflow.nodes.has(nodeName)).toBe(true);
      }
    });
    
    it('should have correct entry point', () => {
      const workflow = forensicWorkflows.createForensicInvestigation(
        testEvidenceId,
        testCaseId
      );
      
      expect(workflow.entry_point).toBe('preliminary_analysis');
    });
    
    it('should have checkpoints at approval stages', () => {
      const workflow = forensicWorkflows.createForensicInvestigation(
        testEvidenceId,
        testCaseId
      );
      
      expect(workflow.checkpoints).toContain('preliminary_approval');
      expect(workflow.checkpoints).toContain('meta_analysis_approval');
    });
  });
  
  describe('Workflow Execution', () => {
    it('should execute forensic investigation workflow', async () => {
      const result = await executeForensicInvestigation(
        testEvidenceId,
        testCaseId
      );
      
      expect(result).toBeDefined();
      expect(result.workflow_id).toContain('forensic_');
      expect(result.evidence_id).toBe(testEvidenceId);
      expect(result.case_id).toBe(testCaseId);
    });
    
    it('should progress through workflow stages', async () => {
      const stages: string[] = [];
      
      for await (const state of forensicWorkflows.streamForensicInvestigation(
        testEvidenceId,
        testCaseId
      )) {
        stages.push(state.stage);
      }
      
      expect(stages.length).toBeGreaterThan(0);
      expect(stages[0]).toBe('preliminary');
    });
    
    it('should maintain audit trail', async () => {
      const result = await executeForensicInvestigation(
        testEvidenceId,
        testCaseId
      );
      
      expect(result.audit_trail).toBeDefined();
      expect(Array.isArray(result.audit_trail)).toBe(true);
    });
  });
});

describe('Document Processing Workflow', () => {
  const testDocumentId = 'doc_test_001';
  const testSourcePath = '/test/document.pdf';
  
  describe('Workflow Creation', () => {
    it('should create document processing workflow', () => {
      const workflow = forensicWorkflows.createDocumentProcessing(
        testDocumentId,
        testSourcePath
      );
      
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('document_processing');
    });
    
    it('should have correct processing stages', () => {
      const workflow = forensicWorkflows.createDocumentProcessing(
        testDocumentId,
        testSourcePath
      );
      
      const expectedNodes = [
        'type_detection',
        'content_extraction',
        'validation',
        'storage'
      ];
      
      for (const nodeName of expectedNodes) {
        expect(workflow.nodes.has(nodeName)).toBe(true);
      }
    });
    
    it('should have conditional validation edge', () => {
      const workflow = forensicWorkflows.createDocumentProcessing(
        testDocumentId,
        testSourcePath
      );
      
      expect(workflow.conditionalEdges.has('validation')).toBe(true);
    });
  });
  
  describe('Workflow Execution', () => {
    it('should execute document processing workflow', async () => {
      const result = await executeDocumentProcessing(
        testDocumentId,
        testSourcePath
      );
      
      expect(result).toBeDefined();
      expect(result.workflow_id).toContain('doc_');
      expect(result.document_id).toBe(testDocumentId);
      expect(result.source_path).toBe(testSourcePath);
    });
    
    it('should detect document type', async () => {
      const result = await executeDocumentProcessing(
        testDocumentId,
        testSourcePath
      );
      
      expect(result.metadata).toBeDefined();
      expect(result.metadata.detected_type).toBeDefined();
    });
  });
});

describe('Graph State Management', () => {
  it('should save and retrieve graph state', async () => {
    const workflowId = 'test_workflow_123';
    const state: ForensicInvestigationState = {
      workflow_id: workflowId,
      stage: 'preliminary',
      evidence_id: 'evidence_001',
      case_id: 'case_001',
      timestamp: new Date(),
      metadata: { test: true },
      audit_trail: []
    };
    
    await langGraphAdapter.saveGraphState(workflowId, state);
    const retrieved = await langGraphAdapter.getGraphState(workflowId);
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.workflow_id).toBe(workflowId);
    expect(retrieved?.stage).toBe('preliminary');
  });
  
  it('should return null for non-existent workflow', async () => {
    const retrieved = await langGraphAdapter.getGraphState('non_existent_workflow');
    expect(retrieved).toBeNull();
  });
});
