/**
 * Classification System for Sentiment and Pattern Detection
 * Uses LLM for preliminary analysis of evidence chunks
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Classification {
  sentiment: 'positive' | 'neutral' | 'negative' | 'hostile' | 'abusive';
  severity: number; // 1-10 scale
  patterns: string[];
  confidence: number; // 0-1 scale
  reasoning: string;
}

export interface BatchClassification {
  chunk_id: string;
  text: string;
  classification: Classification;
}

export const NEGATIVE_PATTERNS = [
  'gaslighting',
  'manipulation',
  'intimidation',
  'blame_shifting',
  'minimization',
  'denial',
  'isolation',
  'financial_control',
  'threats',
  'stalking',
  'coordinated_abuse',
  'smear_campaign',
  'silent_treatment',
  'triangulation'
] as const;

export const POSITIVE_PATTERNS = [
  'love_bombing',
  'affirmations',
  'reassurances',
  'promises',
  'declarations_of_loyalty',
  'expressions_of_care',
  'future_planning',
  'apologies',
  'compliments',
  'gift_giving'
] as const;

export const ALL_PATTERNS = [...NEGATIVE_PATTERNS, ...POSITIVE_PATTERNS] as const;

export type NegativePattern = typeof NEGATIVE_PATTERNS[number];
export type PositivePattern = typeof POSITIVE_PATTERNS[number];
export type Pattern = typeof ALL_PATTERNS[number];

// ============================================================================
// CLASSIFIER
// ============================================================================

export class Classifier {
  private apiUrl: string;
  private apiKey: string;
  private model: string;
  
  constructor(model: string = 'gpt-4o-mini') {
    this.apiUrl = process.env.BUILT_IN_FORGE_API_URL || '';
    this.apiKey = process.env.BUILT_IN_FORGE_API_KEY || '';
    this.model = model;
    
    if (!this.apiUrl || !this.apiKey) {
      console.warn('[Classifier] API credentials not configured');
    }
  }
  
  /**
   * Classify single text chunk
   */
  async classify(text: string, context?: string): Promise<Classification> {
    console.log(`[Classifier] Classifying text (${text.length} chars)`);
    
    const prompt = this.buildPrompt(text, context);
    
    try {
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'classification',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  sentiment: {
                    type: 'string',
                    enum: ['positive', 'neutral', 'negative', 'hostile', 'abusive']
                  },
                  severity: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 10
                  },
                  patterns: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ALL_PATTERNS as any
                    }
                  },
                  confidence: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1
                  },
                  reasoning: {
                    type: 'string'
                  }
                },
                required: ['sentiment', 'severity', 'patterns', 'confidence', 'reasoning'],
                additionalProperties: false
              }
            }
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      const content = data.choices[0].message.content;
      const classification: Classification = JSON.parse(content);
      
      console.log(`[Classifier] Result: ${classification.sentiment} (severity: ${classification.severity}, patterns: ${classification.patterns.length})`);
      
      return classification;
    } catch (error: any) {
      console.error(`[Classifier] Error:`, error.message);
      
      // Return neutral classification on error
      return {
        sentiment: 'neutral',
        severity: 5,
        patterns: [],
        confidence: 0,
        reasoning: `Classification failed: ${error.message}`
      };
    }
  }
  
  /**
   * Classify multiple chunks in batch
   */
  async classifyBatch(
    chunks: Array<{ chunk_id: string; text: string }>,
    context?: string
  ): Promise<BatchClassification[]> {
    console.log(`[Classifier] Classifying ${chunks.length} chunks in batch`);
    
    const results: BatchClassification[] = [];
    
    // Process sequentially to avoid rate limits
    for (const chunk of chunks) {
      try {
        const classification = await this.classify(chunk.text, context);
        results.push({
          chunk_id: chunk.chunk_id,
          text: chunk.text,
          classification
        });
      } catch (error: any) {
        console.error(`[Classifier] Failed to classify chunk ${chunk.chunk_id}:`, error.message);
        results.push({
          chunk_id: chunk.chunk_id,
          text: chunk.text,
          classification: {
            sentiment: 'neutral',
            severity: 5,
            patterns: [],
            confidence: 0,
            reasoning: `Error: ${error.message}`
          }
        });
      }
    }
    
    return results;
  }
  
  /**
   * Classify with parallel processing
   */
  async classifyBatchParallel(
    chunks: Array<{ chunk_id: string; text: string }>,
    context?: string,
    concurrency: number = 5
  ): Promise<BatchClassification[]> {
    console.log(`[Classifier] Classifying ${chunks.length} chunks (parallel, concurrency: ${concurrency})`);
    
    const results: BatchClassification[] = new Array(chunks.length);
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const promise = (async (index: number) => {
        try {
          const classification = await this.classify(chunks[index].text, context);
          results[index] = {
            chunk_id: chunks[index].chunk_id,
            text: chunks[index].text,
            classification
          };
        } catch (error: any) {
          console.error(`[Classifier] Parallel classification ${index} failed:`, error.message);
          results[index] = {
            chunk_id: chunks[index].chunk_id,
            text: chunks[index].text,
            classification: {
              sentiment: 'neutral',
              severity: 5,
              patterns: [],
              confidence: 0,
              reasoning: `Error: ${error.message}`
            }
          };
        }
      })(i);
      
      promises.push(promise);
      
      // Limit concurrency
      if (promises.length >= concurrency) {
        await Promise.race(promises);
        promises.splice(promises.findIndex(p => p === undefined), 1);
      }
    }
    
    // Wait for remaining
    await Promise.all(promises);
    
    return results;
  }
  
  /**
   * Build classification prompt
   */
  private buildPrompt(text: string, context?: string): string {
    let prompt = `Analyze the following text and classify it:\n\n"${text}"\n\n`;
    
    if (context) {
      prompt += `Context: ${context}\n\n`;
    }
    
    prompt += `Provide a classification with:
- Sentiment: positive, neutral, negative, hostile, or abusive
- Severity: 1-10 scale (1=benign, 10=severe abuse)
- Patterns: List of abuse patterns detected (if any)
- Confidence: 0-1 scale for your classification confidence
- Reasoning: Brief explanation of your classification`;
    
    return prompt;
  }
  
  /**
   * Get system prompt for classifier
   */
  private getSystemPrompt(): string {
    return `You are a forensic analyst specializing in detecting patterns of psychological abuse, manipulation, and coordinated harassment in text communications.

Your task is to classify text messages for preliminary analysis. This is NOT the final assessment - full context analysis will happen later.

**CRITICAL**: You must detect BOTH negative AND positive patterns. Positive patterns (love bombing, affirmations) can later reveal manipulation when contradicted by actions.

Negative patterns to detect:
- gaslighting: Denying reality, making victim question their perception
- manipulation: Controlling behavior through deception
- intimidation: Threats, aggressive language
- blame_shifting: Redirecting responsibility to victim
- minimization: Downplaying harm or abuse
- denial: Refusing to acknowledge wrongdoing
- isolation: Cutting victim off from support
- financial_control: Restricting access to money/resources
- threats: Explicit or implicit threats of harm
- stalking: Unwanted monitoring or following
- coordinated_abuse: Multiple people targeting victim
- smear_campaign: Spreading false information
- silent_treatment: Withholding communication as punishment
- triangulation: Using third parties to manipulate

Positive patterns to detect (for later contradiction analysis):
- love_bombing: Excessive affection, over-the-top declarations of love
- affirmations: Positive statements about victim or relationship
- reassurances: "I'd never lie", "You can trust me", "I'm faithful"
- promises: Commitments to change, future plans together
- declarations_of_loyalty: "You're my everything", "I only love you"
- expressions_of_care: Concern for victim's wellbeing
- future_planning: Discussing long-term plans, marriage, children
- apologies: Saying sorry, taking responsibility
- compliments: Praising victim's appearance, personality
- gift_giving: Presents, gestures of affection

**Why detect positive patterns?**
When "I love you" (Day 1) is followed by cheating evidence (Day 3), the positive sentiment is reclassified as manipulative love bombing during meta-analysis. This creates forensic evidence of calculated deception.

Severity scale:
1-3: Minor issues, normal conflict
4-6: Concerning patterns, potential manipulation
7-8: Clear abuse patterns, significant harm
9-10: Severe abuse, immediate concern

Be objective and evidence-based. Err on the side of caution - it's better to flag potential issues for human review than to miss abuse patterns.`;
  }
}

// ============================================================================
// AGGREGATE ANALYSIS
// ============================================================================

/**
 * Aggregate classifications for a document
 */
export function aggregateClassifications(
  classifications: Classification[]
): {
  overall_sentiment: string;
  avg_severity: number;
  pattern_frequency: Record<string, number>;
  high_severity_count: number;
  confidence_avg: number;
} {
  if (classifications.length === 0) {
    return {
      overall_sentiment: 'neutral',
      avg_severity: 0,
      pattern_frequency: {},
      high_severity_count: 0,
      confidence_avg: 0
    };
  }
  
  // Sentiment distribution
  const sentimentCounts: Record<string, number> = {};
  let totalSeverity = 0;
  let totalConfidence = 0;
  let highSeverityCount = 0;
  const patternFrequency: Record<string, number> = {};
  
  for (const c of classifications) {
    sentimentCounts[c.sentiment] = (sentimentCounts[c.sentiment] || 0) + 1;
    totalSeverity += c.severity;
    totalConfidence += c.confidence;
    
    if (c.severity >= 7) {
      highSeverityCount++;
    }
    
    for (const pattern of c.patterns) {
      patternFrequency[pattern] = (patternFrequency[pattern] || 0) + 1;
    }
  }
  
  // Determine overall sentiment (most common)
  const overallSentiment = Object.entries(sentimentCounts)
    .sort((a, b) => b[1] - a[1])[0][0];
  
  return {
    overall_sentiment: overallSentiment,
    avg_severity: totalSeverity / classifications.length,
    pattern_frequency: patternFrequency,
    high_severity_count: highSeverityCount,
    confidence_avg: totalConfidence / classifications.length
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const classifier = new Classifier();
