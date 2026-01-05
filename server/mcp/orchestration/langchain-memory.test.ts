/**
 * LangChain Memory System Tests
 * 
 * Tests for ForensicInvestigationMemory, hypothesis tracking, and analysis deltas.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ForensicInvestigationMemory,
  createForensicMemory,
  Hypothesis,
  AnalysisDelta
} from './langchain-memory';

describe('ForensicInvestigationMemory', () => {
  let memory: ForensicInvestigationMemory;
  const testCaseId = 'case_test_001';
  const testEvidenceId = 'evidence_test_001';
  
  beforeEach(async () => {
    memory = createForensicMemory(testCaseId, testEvidenceId);
    await memory.clear();
  });
  
  describe('Memory Initialization', () => {
    it('should create memory instance', () => {
      expect(memory).toBeDefined();
    });
    
    it('should load empty memory variables initially', async () => {
      const vars = await memory.loadMemoryVariables();
      
      expect(vars.preliminary_hypotheses).toEqual([]);
      expect(vars.full_context_findings).toEqual([]);
      expect(vars.contradiction_log).toEqual([]);
      expect(vars.investigator_reasoning).toEqual([]);
      expect(vars.current_stage).toBe('preliminary');
    });
  });
  
  describe('Hypothesis Recording', () => {
    it('should record preliminary hypothesis', async () => {
      const hypId = await memory.recordHypothesis(
        'Suspect shows signs of gaslighting behavior',
        'preliminary',
        0.75,
        ['msg_001', 'msg_002']
      );
      
      expect(hypId).toBeDefined();
      expect(hypId).toContain('hyp_');
      
      const vars = await memory.loadMemoryVariables();
      expect(vars.preliminary_hypotheses.length).toBe(1);
      expect(vars.preliminary_hypotheses[0].hypothesis).toContain('gaslighting');
      expect(vars.preliminary_hypotheses[0].confidence).toBe(0.75);
    });
    
    it('should record full context hypothesis', async () => {
      await memory.recordHypothesis(
        'Pattern confirmed across multiple platforms',
        'full_context',
        0.92,
        ['msg_001', 'msg_002', 'email_001']
      );
      
      const vars = await memory.loadMemoryVariables();
      expect(vars.full_context_findings.length).toBe(1);
      expect(vars.full_context_findings[0].source).toBe('full_context');
    });
    
    it('should record human review hypothesis', async () => {
      await memory.recordHypothesis(
        'Investigator confirms coordinated abuse pattern',
        'human_review',
        1.0,
        ['analysis_001']
      );
      
      const vars = await memory.loadMemoryVariables();
      const allHypotheses = [
        ...vars.preliminary_hypotheses,
        ...vars.full_context_findings
      ];
      
      const humanHyp = allHypotheses.find(h => h.source === 'human_review');
      expect(humanHyp).toBeDefined();
      expect(humanHyp?.confidence).toBe(1.0);
    });
    
    it('should track evidence references', async () => {
      const evidenceRefs = ['msg_001', 'msg_002', 'msg_003'];
      
      await memory.recordHypothesis(
        'Test hypothesis',
        'preliminary',
        0.8,
        evidenceRefs
      );
      
      const vars = await memory.loadMemoryVariables();
      expect(vars.preliminary_hypotheses[0].evidence_refs).toEqual(evidenceRefs);
    });
  });
  
  describe('Hypothesis Evolution', () => {
    it('should track hypothesis changes', async () => {
      const hyp1Id = await memory.recordHypothesis(
        'Initial assessment: minor conflict',
        'preliminary',
        0.5,
        ['msg_001']
      );
      
      const hyp2Id = await memory.recordHypothesis(
        'Revised assessment: systematic gaslighting',
        'full_context',
        0.9,
        ['msg_001', 'msg_002', 'msg_003']
      );
      
      const vars = await memory.loadMemoryVariables();
      const hyp1 = vars.preliminary_hypotheses.find(h => h.id === hyp1Id);
      const hyp2 = vars.full_context_findings.find(h => h.id === hyp2Id);
      
      await memory.recordHypothesisChange(
        hyp1!,
        hyp2!,
        'Full context revealed coordinated pattern across platforms'
      );
      
      const reasoning = await memory.getReasoningTrail();
      expect(reasoning.length).toBeGreaterThan(0);
      expect(reasoning[0]).toContain('Hypothesis evolved');
      expect(reasoning[0]).toContain('Full context revealed');
    });
    
    it('should mark superseded hypotheses', async () => {
      const hyp1Id = await memory.recordHypothesis(
        'Old hypothesis',
        'preliminary',
        0.6,
        []
      );
      
      const hyp2Id = await memory.recordHypothesis(
        'New hypothesis',
        'full_context',
        0.95,
        []
      );
      
      const vars1 = await memory.loadMemoryVariables();
      const hyp1 = vars1.preliminary_hypotheses.find(h => h.id === hyp1Id)!;
      const hyp2 = vars1.full_context_findings.find(h => h.id === hyp2Id)!;
      
      await memory.recordHypothesisChange(hyp1, hyp2, 'Better evidence found');
      
      const vars2 = await memory.loadMemoryVariables();
      const updatedHyp1 = vars2.preliminary_hypotheses.find(h => h.id === hyp1Id);
      
      expect(updatedHyp1?.superseded_by).toBe(hyp2Id);
    });
  });
  
  describe('Analysis Delta Recording', () => {
    it('should record analysis delta', async () => {
      const delta: AnalysisDelta = {
        evidence_ref: 'msg_001',
        preliminary_analysis: {
          timestamp: new Date('2024-01-01'),
          assessment: {
            sentiment: 'neutral',
            severity: 3,
            patterns: ['minor_disagreement'],
            confidence: 0.6
          },
          confidence: 0.6,
          working_memory_active: true
        },
        final_analysis: {
          timestamp: new Date('2024-01-10'),
          assessment: {
            sentiment: 'hostile',
            severity: 8,
            patterns: ['gaslighting', 'manipulation'],
            confidence: 0.92
          },
          confidence: 0.92,
          full_context_available: true
        },
        delta: {
          severity_change: 5,
          confidence_change: 0.32,
          pattern_reclassification: ['gaslighting', 'manipulation'],
          contradiction_count: 2,
          forensic_significance: 'gaslighting_evidence'
        }
      };
      
      await memory.recordAnalysisDelta(delta);
      
      const vars = await memory.loadMemoryVariables();
      expect(vars.contradiction_log.length).toBe(1);
      expect(vars.contradiction_log[0].delta.severity_change).toBe(5);
    });
    
    it('should log significant contradictions', async () => {
      const delta: AnalysisDelta = {
        evidence_ref: 'msg_002',
        preliminary_analysis: {
          timestamp: new Date(),
          assessment: { sentiment: 'positive', severity: 1, patterns: [], confidence: 0.7 },
          confidence: 0.7,
          working_memory_active: true
        },
        final_analysis: {
          timestamp: new Date(),
          assessment: { sentiment: 'abusive', severity: 9, patterns: ['coordinated_abuse'], confidence: 0.95 },
          confidence: 0.95,
          full_context_available: true
        },
        delta: {
          severity_change: 8,
          confidence_change: 0.25,
          pattern_reclassification: ['coordinated_abuse'],
          contradiction_count: 3,
          forensic_significance: 'coordinated_abuse'
        }
      };
      
      await memory.recordAnalysisDelta(delta);
      
      const reasoning = await memory.getReasoningTrail();
      expect(reasoning.some(r => r.includes('Contradiction detected'))).toBe(true);
      expect(reasoning.some(r => r.includes('coordinated_abuse'))).toBe(true);
    });
    
    it('should track human annotations', async () => {
      const delta: AnalysisDelta = {
        evidence_ref: 'msg_003',
        preliminary_analysis: {
          timestamp: new Date(),
          assessment: { sentiment: 'neutral', severity: 4, patterns: [], confidence: 0.5 },
          confidence: 0.5,
          working_memory_active: true
        },
        final_analysis: {
          timestamp: new Date(),
          assessment: { sentiment: 'manipulative', severity: 7, patterns: ['gaslighting'], confidence: 0.88 },
          confidence: 0.88,
          full_context_available: true
        },
        delta: {
          severity_change: 3,
          confidence_change: 0.38,
          pattern_reclassification: ['gaslighting'],
          contradiction_count: 1,
          forensic_significance: 'gaslighting_evidence'
        },
        human_annotation: {
          investigator_note: 'Classic gaslighting pattern confirmed by forensic psychologist',
          methodology_justification: 'Cross-referenced with DSM-5 criteria and established case law',
          evidence_admissibility: 'conclusive'
        }
      };
      
      await memory.recordAnalysisDelta(delta);
      
      const allDeltas = await memory.getAllDeltas();
      expect(allDeltas[0].human_annotation).toBeDefined();
      expect(allDeltas[0].human_annotation?.evidence_admissibility).toBe('conclusive');
    });
  });
  
  describe('Temporal Queries', () => {
    it('should retrieve analysis at specific date', async () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-15');
      
      await memory.storeChromaAnalysis('msg_001', {
        timestamp: date1,
        sentiment: 'neutral',
        severity: 3,
        patterns: [],
        confidence: 0.6
      });
      
      const analysis = await memory.getAnalysisAt(date2);
      expect(analysis.length).toBeGreaterThan(0);
    });
    
    it('should not return future analyses', async () => {
      const futureDate = new Date('2025-12-31');
      const pastDate = new Date('2024-01-01');
      
      await memory.storeChromaAnalysis('msg_001', {
        timestamp: futureDate,
        sentiment: 'test',
        severity: 5,
        patterns: [],
        confidence: 0.8
      });
      
      const analysis = await memory.getAnalysisAt(pastDate);
      expect(analysis.length).toBe(0);
    });
  });
  
  describe('Context Saving', () => {
    it('should save reasoning from outputs', async () => {
      await memory.saveContext(
        { input: 'test' },
        { reasoning: 'Analysis shows pattern X', stage: 'full_context' }
      );
      
      const vars = await memory.loadMemoryVariables();
      expect(vars.investigator_reasoning).toContain('Analysis shows pattern X');
      expect(vars.current_stage).toBe('full_context');
    });
    
    it('should update current stage', async () => {
      await memory.saveContext({}, { stage: 'meta_analysis' });
      
      const vars = await memory.loadMemoryVariables();
      expect(vars.current_stage).toBe('meta_analysis');
    });
  });
  
  describe('Memory Export', () => {
    it('should export complete memory for forensic report', async () => {
      await memory.recordHypothesis('Test hypothesis 1', 'preliminary', 0.7, ['msg_001']);
      await memory.recordHypothesis('Test hypothesis 2', 'full_context', 0.9, ['msg_001', 'msg_002']);
      
      const delta: AnalysisDelta = {
        evidence_ref: 'msg_001',
        preliminary_analysis: {
          timestamp: new Date(),
          assessment: { sentiment: 'neutral', severity: 3, patterns: [], confidence: 0.6 },
          confidence: 0.6,
          working_memory_active: true
        },
        final_analysis: {
          timestamp: new Date(),
          assessment: { sentiment: 'hostile', severity: 7, patterns: ['gaslighting'], confidence: 0.9 },
          confidence: 0.9,
          full_context_available: true
        },
        delta: {
          severity_change: 4,
          confidence_change: 0.3,
          pattern_reclassification: ['gaslighting'],
          contradiction_count: 1,
          forensic_significance: 'gaslighting_evidence'
        }
      };
      
      await memory.recordAnalysisDelta(delta);
      
      const exported = await memory.exportForReport();
      
      expect(exported.caseId).toBe(testCaseId);
      expect(exported.evidenceId).toBe(testEvidenceId);
      expect(exported.hypotheses.length).toBe(2);
      expect(exported.deltas.length).toBe(1);
      expect(exported.timeline.length).toBeGreaterThan(0);
    });
    
    it('should include chronological timeline', async () => {
      await memory.recordHypothesis('Early hypothesis', 'preliminary', 0.6, []);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await memory.recordHypothesis('Later hypothesis', 'full_context', 0.9, []);
      
      const exported = await memory.exportForReport();
      
      expect(exported.timeline.length).toBe(2);
      expect(exported.timeline[0].timestamp.getTime()).toBeLessThan(
        exported.timeline[1].timestamp.getTime()
      );
    });
  });
  
  describe('Memory Clearing', () => {
    it('should clear all memory', async () => {
      await memory.recordHypothesis('Test', 'preliminary', 0.5, []);
      await memory.clear();
      
      const vars = await memory.loadMemoryVariables();
      expect(vars.preliminary_hypotheses.length).toBe(0);
      expect(vars.full_context_findings.length).toBe(0);
      expect(vars.contradiction_log.length).toBe(0);
      expect(vars.investigator_reasoning.length).toBe(0);
    });
  });
});

describe('Memory Factory', () => {
  it('should create memory instance with factory', () => {
    const memory = createForensicMemory('case_001', 'evidence_001');
    expect(memory).toBeInstanceOf(ForensicInvestigationMemory);
  });
});
