/**
 * BERT Sentiment Analysis
 *
 * Specialized sentiment analysis using BERT models (not generic sentiment).
 * Focuses on nuanced emotional analysis for forensic text analysis.
 *
 * Features:
 * - BERT-based emotion detection
 * - Forensic-specific sentiment markers
 * - Confidence scoring and uncertainty handling
 * - Context-aware sentiment analysis
 */

import { pipeline, Pipeline } from '@huggingface/transformers';

// ============================================================================
// TYPES
// ============================================================================

export interface SentimentResult {
  text: string;
  overallSentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotions: EmotionScore[];
  forensicMarkers: ForensicMarker[];
  context: string;
  timestamp: string;
}

export interface EmotionScore {
  emotion: string;
  score: number;
  confidence: number;
}

export interface ForensicMarker {
  type: 'deception' | 'anger' | 'fear' | 'guilt' | 'manipulation' | 'love_bombing';
  score: number;
  indicators: string[];
}

// ============================================================================
// BERT SENTIMENT CLASS
// ============================================================================

export class BertSentimentAnalyzer {
  private sentimentPipeline: Pipeline | null = null;
  private emotionPipeline: Pipeline | null = null;
  private initialized: boolean = false;

  /**
   * Initialize BERT models
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[BERT] Initializing sentiment analysis models...');

      // Initialize sentiment analysis pipeline
      this.sentimentPipeline = await pipeline('sentiment-analysis', 'cardiffnlp/twitter-roberta-base-sentiment-latest');

      // Initialize emotion detection (using emotion-english-distilroberta-base)
      this.emotionPipeline = await pipeline('text-classification', 'j-hartmann/emotion-english-distilroberta-base');

      this.initialized = true;
      console.log('[BERT] Models initialized successfully');
    } catch (error) {
      console.error('[BERT] Failed to initialize models:', error);
      throw error;
    }
  }

  /**
   * Analyze sentiment using BERT models
   */
  async analyzeSentiment(text: string, context?: string): Promise<SentimentResult> {
    await this.initialize();

    if (!this.sentimentPipeline || !this.emotionPipeline) {
      throw new Error('BERT models not initialized');
    }

    try {
      // Get sentiment analysis
      const sentimentResult = await this.sentimentPipeline(text);

      // Get emotion analysis
      const emotionResult = await this.emotionPipeline(text);

      // Map sentiment to overall result
      const overallSentiment = this.mapSentimentLabel(sentimentResult[0].label);
      const confidence = sentimentResult[0].score;

      // Map emotions
      const emotions: EmotionScore[] = emotionResult.slice(0, 5).map(e => ({
        emotion: e.label.toLowerCase(),
        score: e.score,
        confidence: e.score
      }));

      // Detect forensic markers
      const forensicMarkers = this.detectForensicMarkers(text, emotions);

      return {
        text,
        overallSentiment,
        confidence,
        emotions,
        forensicMarkers,
        context: context || '',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[BERT] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Map BERT sentiment labels to our schema
   */
  private mapSentimentLabel(label: string): 'positive' | 'negative' | 'neutral' {
    switch (label.toLowerCase()) {
      case 'label_2':
      case 'positive':
        return 'positive';
      case 'label_0':
      case 'negative':
        return 'negative';
      case 'label_1':
      case 'neutral':
      default:
        return 'neutral';
    }
  }

  /**
   * Detect forensic-specific markers in text and emotions
   */
  private detectForensicMarkers(text: string, emotions: EmotionScore[]): ForensicMarker[] {
    const markers: ForensicMarker[] = [];
    const textLower = text.toLowerCase();

    // Deception markers
    const deceptionIndicators = this.checkDeceptionIndicators(textLower);
    if (deceptionIndicators.length > 0) {
      markers.push({
        type: 'deception',
        score: Math.min(deceptionIndicators.length * 0.3, 1.0),
        indicators: deceptionIndicators
      });
    }

    // Anger markers
    const angerScore = emotions.find(e => e.emotion === 'anger')?.score || 0;
    if (angerScore > 0.3) {
      markers.push({
        type: 'anger',
        score: angerScore,
        indicators: ['high anger emotion', 'emotional intensity']
      });
    }

    // Fear markers
    const fearScore = emotions.find(e => e.emotion === 'fear')?.score || 0;
    if (fearScore > 0.3) {
      markers.push({
        type: 'fear',
        score: fearScore,
        indicators: ['high fear emotion', 'anxiety indicators']
      });
    }

    // Guilt markers
    const guiltIndicators = this.checkGuiltIndicators(textLower);
    if (guiltIndicators.length > 0) {
      markers.push({
        type: 'guilt',
        score: Math.min(guiltIndicators.length * 0.25, 1.0),
        indicators: guiltIndicators
      });
    }

    // Manipulation markers
    const manipulationIndicators = this.checkManipulationIndicators(textLower, emotions);
    if (manipulationIndicators.length > 0) {
      markers.push({
        type: 'manipulation',
        score: Math.min(manipulationIndicators.length * 0.2, 1.0),
        indicators: manipulationIndicators
      });
    }

    // Love bombing markers
    const loveBombingIndicators = this.checkLoveBombingIndicators(textLower, emotions);
    if (loveBombingIndicators.length > 0) {
      markers.push({
        type: 'love_bombing',
        score: Math.min(loveBombingIndicators.length * 0.25, 1.0),
        indicators: loveBombingIndicators
      });
    }

    return markers;
  }

  /**
   * Check for deception indicators
   */
  private checkDeceptionIndicators(text: string): string[] {
    const indicators: string[] = [];

    // Overelaboration patterns
    if (text.includes('because') && text.includes('actually') && text.includes('honestly')) {
      indicators.push('overelaboration with qualifiers');
    }

    // Contradiction patterns
    if ((text.includes('i never') && text.includes('but actually')) ||
        (text.includes('i always') && text.includes('except when'))) {
      indicators.push('qualifier contradictions');
    }

    // Memory uncertainty
    if (text.includes('i think') && text.includes('maybe') && text.includes('not sure')) {
      indicators.push('memory uncertainty');
    }

    // Temporal inconsistencies
    if (text.includes('at first') && text.includes('but then') && text.includes('actually')) {
      indicators.push('temporal inconsistency');
    }

    return indicators;
  }

  /**
   * Check for guilt indicators
   */
  private checkGuiltIndicators(text: string): string[] {
    const indicators: string[] = [];

    if (text.includes("i'm sorry") && text.includes('my fault')) {
      indicators.push('excessive apologies');
    }

    if (text.includes('i feel bad') && text.includes('i regret')) {
      indicators.push('self-blame expressions');
    }

    if (text.includes('i should have') && text.includes('i could have')) {
      indicators.push('retrospective guilt');
    }

    if (text.includes('please forgive me') && text.includes('i promise')) {
      indicators.push('pleading for forgiveness');
    }

    return indicators;
  }

  /**
   * Check for manipulation indicators
   */
  private checkManipulationIndicators(text: string, emotions: EmotionScore[]): string[] {
    const indicators: string[] = [];

    // Emotional manipulation
    if (text.includes('if you loved me') && text.includes('you would')) {
      indicators.push('conditional love');
    }

    if (text.includes('after all i') && text.includes('done for you')) {
      indicators.push('debt reminders');
    }

    // Gaslighting attempts
    if (text.includes("you're imagining") || text.includes("you're crazy")) {
      indicators.push('reality distortion');
    }

    // Isolation tactics
    if (text.includes('they hate you') || text.includes('no one understands')) {
      indicators.push('relationship isolation');
    }

    return indicators;
  }

  /**
   * Check for love bombing indicators
   */
  private checkLoveBombingIndicators(text: string, emotions: EmotionScore[]): string[] {
    const indicators: string[] = [];

    const joyScore = emotions.find(e => e.emotion === 'joy')?.score || 0;
    const loveScore = emotions.find(e => e.emotion === 'love')?.score || 0;

    if (joyScore > 0.7 && loveScore > 0.6) {
      indicators.push('excessive positive emotion');
    }

    // Excessive praise
    if (text.includes('perfect') && text.includes('amazing') && text.includes('incredible')) {
      indicators.push('over-the-top praise');
    }

    // Future faking
    if (text.includes('forever') && text.includes('always') && text.includes('together')) {
      indicators.push('future promises');
    }

    // Dependency creation
    if (text.includes("can't live without") && text.includes('soulmate')) {
      indicators.push('dependency language');
    }

    return indicators;
  }

  /**
   * Batch analyze multiple texts
   */
  async analyzeBatch(texts: string[], contexts?: string[]): Promise<SentimentResult[]> {
    const results: SentimentResult[] = [];

    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.analyzeSentiment(texts[i], contexts?.[i]);
        results.push(result);
      } catch (error) {
        console.error(`[BERT] Failed to analyze text ${i}:`, error);
        // Add error result
        results.push({
          text: texts[i],
          overallSentiment: 'neutral',
          confidence: 0,
          emotions: [],
          forensicMarkers: [],
          context: contexts?.[i] || '',
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Get model status
   */
  getStatus(): { initialized: boolean; models: string[] } {
    return {
      initialized: this.initialized,
      models: this.initialized ? ['cardiffnlp/twitter-roberta-base-sentiment-latest', 'j-hartmann/emotion-english-distilroberta-base'] : []
    };
  }
}

// Export singleton instance
export const bertSentiment = new BertSentimentAnalyzer();

// ============================================================================
// MCP TOOL DEFINITIONS
// ============================================================================

export const bertSentimentTools = [
  {
    name: 'analyze_sentiment_bert',
    description: 'Analyze sentiment using BERT models for nuanced emotional detection',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to analyze' },
        context: { type: 'string', description: 'Optional context for analysis' }
      },
      required: ['text']
    }
  },
  {
    name: 'batch_sentiment_analysis',
    description: 'Analyze sentiment for multiple texts in batch',
    inputSchema: {
      type: 'object',
      properties: {
        texts: { type: 'array', items: { type: 'string' }, description: 'Array of texts to analyze' },
        contexts: { type: 'array', items: { type: 'string' }, description: 'Optional contexts for each text' }
      },
      required: ['texts']
    }
  }
];