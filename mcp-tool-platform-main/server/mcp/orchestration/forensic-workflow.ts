/**
 * Forensic Investigation Workflow
 * 
 * Pre-built LangGraph workflow for forensic document analysis.
 * Implements the full pipeline: preliminary → full context → meta-analysis → reconciliation
 */

import {
  langGraphAdapter,
  ForensicInvestigationState,
  DocumentProcessingState,
  GraphDefinition
} from './langgraph-adapter';
import { subAgents } from './sub-agents';

// ============================================================================
// FORENSIC INVESTIGATION WORKFLOW
// ============================================================================

/**
 * Create forensic investigation graph
 * 
 * Workflow stages:
 * 1. Preliminary Analysis (Chroma, 0-72h) - analyze without full context
 * 2. Export to Chroma - store preliminary findings
 * 3. [CHECKPOINT] Preliminary Approval - human validates initial findings
 * 4. Meta-Analysis (Neo4j, post-72h) - analyze with full corpus context
 * 5. Detect Contradictions - compare preliminary vs final assessments
 * 6. Export to Neo4j - store entity graph
 * 7. Export to Supabase - store structured data
 * 8. [CHECKPOINT] Meta-Analysis Approval - human validates final findings
 * 9. Complete - workflow finished
 */
export function createForensicInvestigationWorkflow(
  evidenceId: string,
  caseId: string
): GraphDefinition<ForensicInvestigationState> {
  const graph = langGraphAdapter.createGraph<ForensicInvestigationState>(
    'forensic_investigation',
    'Multi-stage forensic analysis with preliminary and full-context assessments',
    {
      workflow_id: `forensic_${Date.now()}`,
      stage: 'preliminary',
      evidence_id: evidenceId,
      case_id: caseId,
      timestamp: new Date(),
      metadata: {},
      audit_trail: []
    }
  );
  
  // Add nodes
  graph
    .addNode('preliminary_analysis', subAgents.forensics.preliminaryAnalysis)
    .addNode('export_to_chroma', subAgents.export.exportToChroma)
    .addNode('preliminary_approval', subAgents.approval.requestPreliminaryApproval)
    .addNode('meta_analysis', subAgents.forensics.metaAnalysis)
    .addNode('detect_contradictions', subAgents.forensics.detectContradictions)
    .addNode('export_to_neo4j', subAgents.export.exportToNeo4j)
    .addNode('export_to_supabase', subAgents.export.exportToSupabase)
    .addNode('meta_analysis_approval', subAgents.approval.requestMetaAnalysisApproval);
  
  // Add edges
  graph
    .addEdge('preliminary_analysis', 'export_to_chroma')
    .addEdge('export_to_chroma', 'preliminary_approval')
    .addEdge('preliminary_approval', 'meta_analysis')
    .addEdge('meta_analysis', 'detect_contradictions')
    .addEdge('detect_contradictions', 'export_to_neo4j')
    .addEdge('export_to_neo4j', 'export_to_supabase')
    .addEdge('export_to_supabase', 'meta_analysis_approval')
    .addEdge('meta_analysis_approval', 'END');
  
  // Set entry point
  graph.setEntryPoint('preliminary_analysis');
  
  // Add checkpoints for human approval
  graph.addCheckpoint('preliminary_approval');
  graph.addCheckpoint('meta_analysis_approval');
  
  return graph.build();
}

// ============================================================================
// DOCUMENT PROCESSING WORKFLOW
// ============================================================================

/**
 * Create document processing graph
 * 
 * Workflow stages:
 * 1. Type Detection - identify document format
 * 2. Content Extraction - extract text/metadata based on type
 * 3. Validation - verify extraction quality
 * 4. Storage - save to R2/Supabase/Directus
 */
export function createDocumentProcessingWorkflow(
  documentId: string,
  sourcePath: string
): GraphDefinition<DocumentProcessingState> {
  const graph = langGraphAdapter.createGraph<DocumentProcessingState>(
    'document_processing',
    'Multi-stage document ingestion and processing',
    {
      workflow_id: `doc_${Date.now()}`,
      stage: 'ingestion',
      document_id: documentId,
      source_path: sourcePath,
      timestamp: new Date(),
      metadata: {}
    }
  );
  
  // Add nodes
  graph
    .addNode('type_detection', subAgents.document.detectType)
    .addNode('content_extraction', subAgents.document.extractContent)
    .addNode('validation', subAgents.document.validateContent)
    .addNode('storage', async (state) => {
      console.log('[DocumentWorkflow] Storing document...');
      return {
        stage: 'complete',
        storage: {
          r2_key: `documents/${state.document_id}`,
          supabase_id: `supabase_${state.document_id}`,
          directus_id: `directus_${state.document_id}`
        }
      };
    });
  
  // Add conditional edge based on validation result
  graph
    .addEdge('type_detection', 'content_extraction')
    .addEdge('content_extraction', 'validation')
    .addConditionalEdge('validation', (state) => {
      if (state.validation?.passed) {
        return 'storage';
      } else {
        return 'END'; // Skip storage if validation failed
      }
    })
    .addEdge('storage', 'END');
  
  graph.setEntryPoint('type_detection');
  
  return graph.build();
}

// ============================================================================
// WORKFLOW EXECUTION HELPERS
// ============================================================================

/**
 * Execute forensic investigation workflow
 */
export async function executeForensicInvestigation(
  evidenceId: string,
  caseId: string
): Promise<ForensicInvestigationState> {
  const workflow = createForensicInvestigationWorkflow(evidenceId, caseId);
  const result = await langGraphAdapter.executeGraph(workflow, {});
  return result;
}

/**
 * Execute forensic investigation with streaming updates
 */
export async function* streamForensicInvestigation(
  evidenceId: string,
  caseId: string
): AsyncGenerator<ForensicInvestigationState> {
  const workflow = createForensicInvestigationWorkflow(evidenceId, caseId);
  yield* langGraphAdapter.streamGraph(workflow, {});
}

/**
 * Execute document processing workflow
 */
export async function executeDocumentProcessing(
  documentId: string,
  sourcePath: string
): Promise<DocumentProcessingState> {
  const workflow = createDocumentProcessingWorkflow(documentId, sourcePath);
  const result = await langGraphAdapter.executeGraph(workflow, {});
  return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const forensicWorkflows = {
  createForensicInvestigation: createForensicInvestigationWorkflow,
  createDocumentProcessing: createDocumentProcessingWorkflow,
  executeForensicInvestigation,
  streamForensicInvestigation,
  executeDocumentProcessing
};
