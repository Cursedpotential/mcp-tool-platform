/**
 * NLP-Based Classifier (No LLM)
 * Uses existing NLP tools: pattern-analyzer, nlp_runner, spaCy, NLTK
 * 
 * This is PRELIMINARY analysis - fast, objective, surface-level detection.
 * LLM is used ONLY in meta-analysis for contradiction detection.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

// Import existing pattern analyzer
import type { PatternMatch, AnalysisResult } from '../forensics/pattern-analyzer';

// ============================================================================
// TYPES
// ============================================================================

export interface NLPClassification {
  // Surface-level detection (no context)
  sentiment: {
    label: 'positive' | 'neutral' | 'negative' | 'hostile' | 'abusive';
    score: number;
    confidence: number;
    method: string;
  };
  
  // Pattern matches from pattern-analyzer
  patterns: {
    negative: string[];
    positive: string[];
    all: PatternMatch[];
  };
  
  // Entities extracted (people, places, dates)
  entities: Array<{
    text: string;
    type: string;
    start: number;
    end: number;
  }>;
  
  // Keywords extracted
  keywords: Array<{
    keyword: string;
    score: number;
    frequency: number;
  }>;
  
  // Severity (computed from patterns)
  severity: number; // 1-10
  
  // Confidence (based on number of matches)
  confidence: number; // 0-1
  
  // Metadata
  metadata: {
    text_length: number;
    word_count: number;
    sentence_count: number;
    processing_time_ms: number;
  };
}

// ============================================================================
// NLP CLASSIFIER
// ============================================================================

export class NLPClassifier {
  private nlpRunnerPath: string;
  private patternAnalyzer: any; // Will be dynamically imported
  
  constructor() {
    this.nlpRunnerPath = path.join(__dirname, '../../python-tools/nlp_runner.py');
  }
  
  /**
   * Classify text using NLP tools (no LLM)
   */
  async classify(text: string, context?: {
    caseId?: string;
    platform?: string;
    timestamp?: Date;
  }): Promise<NLPClassification> {
    const startTime = Date.now();
    
    console.log(`[NLPClassifier] Classifying text (${text.length} chars)`);
    
    // Run all NLP operations in parallel
    const [sentiment, entities, keywords, patterns] = await Promise.all([
      this.analyzeSentiment(text),
      this.extractEntities(text),
      this.extractKeywords(text),
      this.detectPatterns(text, context)
    ]);
    
    // Compute severity from pattern matches
    const severity = this.computeSeverity(patterns);
    
    // Compute confidence from number of matches
    const confidence = this.computeConfidence(patterns, sentiment);
    
    // Count sentences and words
    const wordCount = text.split(/\s+/).length;
    const sentenceCount = text.split(/[.!?]+/).length;
    
    const processingTime = Date.now() - startTime;
    
    return {
      sentiment,
      patterns: {
        negative: patterns.negativeMatches.map(m => m.moduleName),
        positive: patterns.positiveMatches.map(m => m.moduleName),
        all: [...patterns.negativeMatches, ...patterns.positiveMatches]
      },
      entities,
      keywords,
      severity,
      confidence,
      metadata: {
        text_length: text.length,
        word_count: wordCount,
        sentence_count: sentenceCount,
        processing_time_ms: processingTime
      }
    };
  }
  
  /**
   * Analyze sentiment using Python NLP tools
   */
  private async analyzeSentiment(text: string): Promise<NLPClassification['sentiment']> {
    try {
      const command = `python3 ${this.nlpRunnerPath} analyze_sentiment '${JSON.stringify({ text })}'`;
      const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      
      const result = JSON.parse(stdout);
      
      // Map to our sentiment labels
      let label: NLPClassification['sentiment']['label'] = 'neutral';
      
      if (result.label === 'positive') {
        label = 'positive';
      } else if (result.label === 'negative') {
        // Check severity to determine if hostile/abusive
        if (result.negative_matches > 5) {
          label = 'abusive';
        } else if (result.negative_matches > 2) {
          label = 'hostile';
        } else {
          label = 'negative';
        }
      }
      
      return {
        label,
        score: result.score,
        confidence: result.confidence,
        method: result.method
      };
    } catch (error: any) {
      console.error('[NLPClassifier] Sentiment analysis failed:', error.message);
      return {
        label: 'neutral',
        score: 0,
        confidence: 0,
        method: 'error'
      };
    }
  }
  
  /**
   * Extract entities using spaCy
   */
  private async extractEntities(text: string): Promise<NLPClassification['entities']> {
    try {
      const command = `python3 ${this.nlpRunnerPath} extract_entities '${JSON.stringify({ text })}'`;
      const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      
      const result = JSON.parse(stdout);
      return result.entities || [];
    } catch (error: any) {
      console.error('[NLPClassifier] Entity extraction failed:', error.message);
      return [];
    }
  }
  
  /**
   * Extract keywords using spaCy
   */
  private async extractKeywords(text: string): Promise<NLPClassification['keywords']> {
    try {
      const command = `python3 ${this.nlpRunnerPath} extract_keywords '${JSON.stringify({ text, topK: 10 })}'`;
      const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
      
      const result = JSON.parse(stdout);
      return result.keywords || [];
    } catch (error: any) {
      console.error('[NLPClassifier] Keyword extraction failed:', error.message);
      return [];
    }
  }
  
  /**
   * Detect patterns using pattern-analyzer
   */
  private async detectPatterns(text: string, context?: any): Promise<{
    negativeMatches: PatternMatch[];
    positiveMatches: PatternMatch[];
    totalMatches: number;
  }> {
    try {
      // Dynamically import pattern analyzer
      const { patternAnalyzer } = await import('../forensics/pattern-analyzer');
      
      const result = await patternAnalyzer.analyze(text, {
        includeContext: true,
        contextChars: 100
      });
      
      return {
        negativeMatches: result.negativeMatches || [],
        positiveMatches: result.positiveMatches || [],
        totalMatches: result.totalMatches || 0
      };
    } catch (error: any) {
      console.error('[NLPClassifier] Pattern detection failed:', error.message);
      return {
        negativeMatches: [],
        positiveMatches: [],
        totalMatches: 0
      };
    }
  }
  
  /**
   * Compute severity from pattern matches
   */
  private computeSeverity(patterns: {
    negativeMatches: PatternMatch[];
    positiveMatches: PatternMatch[];
  }): number {
    if (patterns.negativeMatches.length === 0) {
      return 1; // No negative patterns
    }
    
    // Average severity from negative matches
    const avgSeverity = patterns.negativeMatches.reduce((sum, m) => sum + (m.severity || 5), 0) / patterns.negativeMatches.length;
    
    // Boost severity if many negative patterns
    const countBoost = Math.min(patterns.negativeMatches.length * 0.5, 3);
    
    return Math.min(Math.round(avgSeverity + countBoost), 10);
  }
  
  /**
   * Compute confidence from matches and sentiment
   */
  private computeConfidence(
    patterns: { negativeMatches: PatternMatch[]; positiveMatches: PatternMatch[] },
    sentiment: NLPClassification['sentiment']
  ): number {
    const totalMatches = patterns.negativeMatches.length + patterns.positiveMatches.length;
    
    if (totalMatches === 0) {
      return sentiment.confidence;
    }
    
    // Higher confidence with more matches
    const matchConfidence = Math.min(totalMatches * 0.1, 0.9);
    
    // Average with sentiment confidence
    return (matchConfidence + sentiment.confidence) / 2;
  }
  
  /**
   * Batch classify multiple texts
   */
  async classifyBatch(
    chunks: Array<{ chunk_id: string; text: string }>,
    context?: any
  ): Promise<Array<{ chunk_id: string; classification: NLPClassification }>> {
    console.log(`[NLPClassifier] Batch classifying ${chunks.length} chunks`);
    
    const results: Array<{ chunk_id: string; classification: NLPClassification }> = [];
    
    // Process sequentially to avoid overwhelming the system
    for (const chunk of chunks) {
      try {
        const classification = await this.classify(chunk.text, context);
        results.push({
          chunk_id: chunk.chunk_id,
          classification
        });
      } catch (error: any) {
        console.error(`[NLPClassifier] Failed to classify chunk ${chunk.chunk_id}:`, error.message);
        // Push neutral classification on error
        results.push({
          chunk_id: chunk.chunk_id,
          classification: {
            sentiment: { label: 'neutral', score: 0, confidence: 0, method: 'error' },
            patterns: { negative: [], positive: [], all: [] },
            entities: [],
            keywords: [],
            severity: 5,
            confidence: 0,
            metadata: {
              text_length: chunk.text.length,
              word_count: 0,
              sentence_count: 0,
              processing_time_ms: 0
            }
          }
        });
      }
    }
    
    return results;
  }
}

// ============================================================================
// AGGREGATE ANALYSIS
// ============================================================================

/**
 * Aggregate NLP classifications for a document
 */
export function aggregateNLPClassifications(
  classifications: NLPClassification[]
): {
  overall_sentiment: string;
  avg_severity: number;
  pattern_frequency: Record<string, number>;
  high_severity_count: number;
  confidence_avg: number;
  entity_summary: Record<string, number>;
  top_keywords: Array<{ keyword: string; total_score: number }>;
} {
  if (classifications.length === 0) {
    return {
      overall_sentiment: 'neutral',
      avg_severity: 0,
      pattern_frequency: {},
      high_severity_count: 0,
      confidence_avg: 0,
      entity_summary: {},
      top_keywords: []
    };
  }
  
  // Sentiment distribution
  const sentimentCounts: Record<string, number> = {};
  let totalSeverity = 0;
  let totalConfidence = 0;
  let highSeverityCount = 0;
  const patternFrequency: Record<string, number> = {};
  const entityTypes: Record<string, number> = {};
  const keywordScores: Record<string, number> = {};
  
  for (const c of classifications) {
    sentimentCounts[c.sentiment.label] = (sentimentCounts[c.sentiment.label] || 0) + 1;
    totalSeverity += c.severity;
    totalConfidence += c.confidence;
    
    if (c.severity >= 7) {
      highSeverityCount++;
    }
    
    // Count pattern frequency
    for (const pattern of [...c.patterns.negative, ...c.patterns.positive]) {
      patternFrequency[pattern] = (patternFrequency[pattern] || 0) + 1;
    }
    
    // Count entity types
    for (const entity of c.entities) {
      entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
    }
    
    // Aggregate keyword scores
    for (const kw of c.keywords) {
      keywordScores[kw.keyword] = (keywordScores[kw.keyword] || 0) + kw.score;
    }
  }
  
  // Determine overall sentiment (most common)
  const overallSentiment = Object.entries(sentimentCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  // Top keywords
  const topKeywords = Object.entries(keywordScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword, total_score]) => ({ keyword, total_score }));
  
  return {
    overall_sentiment: overallSentiment,
    avg_severity: totalSeverity / classifications.length,
    pattern_frequency: patternFrequency,
    high_severity_count: highSeverityCount,
    confidence_avg: totalConfidence / classifications.length,
    entity_summary: entityTypes,
    top_keywords: topKeywords
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const nlpClassifier = new NLPClassifier();
