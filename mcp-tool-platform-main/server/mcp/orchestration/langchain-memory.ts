/**
 * LangChain Memory System for Forensic Investigations
 * 
 * Preserves investigator's evolving hypotheses and analysis deltas.
 * Tracks preliminary vs final assessments for court-admissible audit trails.
 */

import { ClassificationSnapshot, AnalysisSnapshot } from './langgraph-adapter';

// ============================================================================
// MEMORY TYPES
// ============================================================================

/**
 * Hypothesis about evidence or patterns
 */
export interface Hypothesis {
  id: string;
  timestamp: Date;
  source: 'preliminary' | 'full_context' | 'human_review';
  hypothesis: string;
  confidence: number;
  evidence_refs: string[];
  superseded_by?: string; // ID of hypothesis that replaced this one
}

/**
 * Analysis delta showing evolution of understanding
 */
export interface AnalysisDelta {
  evidence_ref: string;
  preliminary_analysis: {
    timestamp: Date;
    assessment: ClassificationSnapshot;
    confidence: number;
    working_memory_active: boolean; // Was Chroma TTL still active?
  };
  final_analysis: {
    timestamp: Date;
    assessment: ClassificationSnapshot;
    confidence: number;
    full_context_available: boolean;
  };
  delta: {
    severity_change: number;
    confidence_change: number;
    pattern_reclassification: string[];
    contradiction_count: number;
    forensic_significance: 'gaslighting_evidence' | 'coordinated_abuse' | 'manipulation_pattern' | 'benign';
  };
  human_annotation?: {
    investigator_note: string;
    methodology_justification: string;
    evidence_admissibility: 'conclusive' | 'corroborating' | 'suspicious' | 'benign';
  };
}

/**
 * Memory variables for LangChain context
 */
export interface ForensicMemoryVariables {
  preliminary_hypotheses: Hypothesis[];
  full_context_findings: Hypothesis[];
  contradiction_log: AnalysisDelta[];
  investigator_reasoning: string[];
  current_stage: 'preliminary' | 'full_context' | 'meta_analysis' | 'reconciliation';
}

// ============================================================================
// FORENSIC INVESTIGATION MEMORY CLASS
// ============================================================================

/**
 * LangChain-compatible memory for forensic investigations
 * 
 * Stores NOT JUST chat history, but analysis hypotheses over time.
 * Enables retrieval of "what we thought on Day X" for audit trails.
 */
export class ForensicInvestigationMemory {
  private hypotheses: Map<string, Hypothesis> = new Map();
  private deltas: Map<string, AnalysisDelta> = new Map();
  private reasoningTrail: string[] = [];
  private currentStage: 'preliminary' | 'full_context' | 'meta_analysis' | 'reconciliation' = 'preliminary';
  
  // In-memory storage for now, would be Supabase in production
  private chromaAnalyses: Map<string, AnalysisSnapshot> = new Map();
  private neo4jAnalyses: Map<string, AnalysisSnapshot> = new Map();
  
  constructor(
    private caseId: string,
    private evidenceId: string
  ) {}
  
  /**
   * Load memory variables for LangChain context
   */
  async loadMemoryVariables(): Promise<ForensicMemoryVariables> {
    const preliminary = Array.from(this.hypotheses.values())
      .filter(h => h.source === 'preliminary')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const fullContext = Array.from(this.hypotheses.values())
      .filter(h => h.source === 'full_context')
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const contradictions = Array.from(this.deltas.values())
      .filter(d => d.delta.contradiction_count > 0);
    
    return {
      preliminary_hypotheses: preliminary,
      full_context_findings: fullContext,
      contradiction_log: contradictions,
      investigator_reasoning: this.reasoningTrail,
      current_stage: this.currentStage
    };
  }
  
  /**
   * Save context from LangChain execution
   */
  async saveContext(
    inputs: Record<string, any>,
    outputs: Record<string, any>
  ): Promise<void> {
    // Extract reasoning from outputs
    if (outputs.reasoning) {
      this.reasoningTrail.push(outputs.reasoning);
    }
    
    // Update current stage
    if (outputs.stage) {
      this.currentStage = outputs.stage;
    }
  }
  
  /**
   * Record a new hypothesis
   */
  async recordHypothesis(
    hypothesis: string,
    source: 'preliminary' | 'full_context' | 'human_review',
    confidence: number,
    evidenceRefs: string[]
  ): Promise<string> {
    const id = `hyp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const hyp: Hypothesis = {
      id,
      timestamp: new Date(),
      source,
      hypothesis,
      confidence,
      evidence_refs: evidenceRefs
    };
    
    this.hypotheses.set(id, hyp);
    return id;
  }
  
  /**
   * Record hypothesis evolution (when understanding changes)
   */
  async recordHypothesisChange(
    from: Hypothesis,
    to: Hypothesis,
    reason: string
  ): Promise<void> {
    // Mark old hypothesis as superseded
    from.superseded_by = to.id;
    this.hypotheses.set(from.id, from);
    
    // Store reasoning for the change
    this.reasoningTrail.push(
      `[${new Date().toISOString()}] Hypothesis evolved: "${from.hypothesis}" → "${to.hypothesis}". Reason: ${reason}`
    );
  }
  
  /**
   * Record analysis delta (preliminary vs final assessment)
   */
  async recordAnalysisDelta(delta: AnalysisDelta): Promise<void> {
    this.deltas.set(delta.evidence_ref, delta);
    
    // Log significant contradictions
    if (delta.delta.contradiction_count > 0) {
      this.reasoningTrail.push(
        `[${new Date().toISOString()}] Contradiction detected for ${delta.evidence_ref}: ` +
        `Severity changed by ${delta.delta.severity_change}, ` +
        `${delta.delta.pattern_reclassification.length} patterns reclassified. ` +
        `Forensic significance: ${delta.delta.forensic_significance}`
      );
    }
  }
  
  /**
   * Get analysis state at a specific date (temporal query)
   */
  async getAnalysisAt(date: Date): Promise<AnalysisSnapshot[]> {
    const timestamp = date.getTime();
    
    // Return Chroma assessments from that date
    const chromaSnapshots = Array.from(this.chromaAnalyses.values())
      .filter(s => s.timestamp.getTime() <= timestamp)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return chromaSnapshots;
  }
  
  /**
   * Store Chroma preliminary analysis
   */
  async storeChromaAnalysis(
    evidenceRef: string,
    snapshot: AnalysisSnapshot
  ): Promise<void> {
    this.chromaAnalyses.set(evidenceRef, snapshot);
  }
  
  /**
   * Store Neo4j full context analysis
   */
  async storeNeo4jAnalysis(
    evidenceRef: string,
    snapshot: AnalysisSnapshot
  ): Promise<void> {
    this.neo4jAnalyses.set(evidenceRef, snapshot);
  }
  
  /**
   * Get all analysis deltas (for forensic reports)
   */
  async getAllDeltas(): Promise<AnalysisDelta[]> {
    return Array.from(this.deltas.values());
  }
  
  /**
   * Get reasoning trail (for audit logs)
   */
  async getReasoningTrail(): Promise<string[]> {
    return [...this.reasoningTrail];
  }
  
  /**
   * Export memory for forensic report
   */
  async exportForReport(): Promise<{
    caseId: string;
    evidenceId: string;
    hypotheses: Hypothesis[];
    deltas: AnalysisDelta[];
    reasoningTrail: string[];
    timeline: Array<{ timestamp: Date; event: string; source: string }>;
  }> {
    // Build timeline from all events
    const timeline: Array<{ timestamp: Date; event: string; source: string }> = [];
    
    // Add hypothesis events
    for (const hyp of Array.from(this.hypotheses.values())) {
      timeline.push({
        timestamp: hyp.timestamp,
        event: `Hypothesis: ${hyp.hypothesis}`,
        source: hyp.source
      });
    }
    
    // Add delta events
    for (const delta of Array.from(this.deltas.values())) {
      timeline.push({
        timestamp: delta.preliminary_analysis.timestamp,
        event: `Preliminary analysis: severity ${delta.preliminary_analysis.assessment.severity}`,
        source: 'chroma_preliminary'
      });
      timeline.push({
        timestamp: delta.final_analysis.timestamp,
        event: `Final analysis: severity ${delta.final_analysis.assessment.severity} (Δ${delta.delta.severity_change})`,
        source: 'full_context_meta'
      });
    }
    
    // Sort timeline chronologically
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return {
      caseId: this.caseId,
      evidenceId: this.evidenceId,
      hypotheses: Array.from(this.hypotheses.values()),
      deltas: Array.from(this.deltas.values()),
      reasoningTrail: this.reasoningTrail,
      timeline
    };
  }
  
  /**
   * Clear memory (for testing)
   */
  async clear(): Promise<void> {
    this.hypotheses.clear();
    this.deltas.clear();
    this.reasoningTrail = [];
    this.chromaAnalyses.clear();
    this.neo4jAnalyses.clear();
    this.currentStage = 'preliminary';
  }
}

// ============================================================================
// MEMORY FACTORY
// ============================================================================

/**
 * Create a new forensic investigation memory instance
 */
export function createForensicMemory(
  caseId: string,
  evidenceId: string
): ForensicInvestigationMemory {
  return new ForensicInvestigationMemory(caseId, evidenceId);
}

// ============================================================================
// MEMORY PERSISTENCE (Supabase Integration)
// ============================================================================

/**
 * Save memory to Supabase for persistence
 * In production, this would store to analysis_deltas, hypotheses, and audit_trail tables
 */
export async function persistMemoryToSupabase(
  memory: ForensicInvestigationMemory
): Promise<void> {
  const exported = await memory.exportForReport();
  
  // In production:
  // 1. Insert hypotheses into hypotheses table
  // 2. Insert deltas into analysis_deltas table
  // 3. Insert reasoning trail into audit_trail table
  // 4. Link everything with case_id and evidence_id
  
  console.log('[Memory] Would persist to Supabase:', {
    hypotheses: exported.hypotheses.length,
    deltas: exported.deltas.length,
    reasoningSteps: exported.reasoningTrail.length
  });
}

/**
 * Load memory from Supabase
 */
export async function loadMemoryFromSupabase(
  caseId: string,
  evidenceId: string
): Promise<ForensicInvestigationMemory> {
  const memory = createForensicMemory(caseId, evidenceId);
  
  // In production:
  // 1. Query hypotheses table by case_id and evidence_id
  // 2. Query analysis_deltas table
  // 3. Query audit_trail table
  // 4. Reconstruct memory state
  
  console.log('[Memory] Would load from Supabase:', { caseId, evidenceId });
  
  return memory;
}
