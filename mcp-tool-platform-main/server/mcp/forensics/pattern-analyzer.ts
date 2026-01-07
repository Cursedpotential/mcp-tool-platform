/**
 * Communication Pattern Analyzer
 * 
 * Analyzes text for behavioral patterns in communication - both negative
 * (manipulation, gaslighting, threats) and positive (love bombing, affirmations).
 * 
 * This dual-polarity approach is essential for identifying narcissistic abuse
 * patterns where the abuser cycles between idealize → devalue → discard phases.
 * Tracking positive statements allows detection of contradictions and reversals.
 */

import { getDb } from '../../db';
import { behavioralPatterns, patternCategories, forensicResults, mclFactors } from '../../../drizzle/schema';
import { eq, and, inArray } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalysisModule {
  id: string;
  name: string;
  description: string;
  category: 'negative' | 'positive' | 'neutral';
  subcategory: string;
  enabled: boolean;
  weight: number;
  mclFactors?: string[];
}

export interface PatternMatch {
  moduleId: string;
  moduleName: string;
  patternId: number;
  patternName: string;
  matchedText: string;
  context: string;
  confidence: number;
  severity: number;
  category: 'negative' | 'positive' | 'neutral';
  position: { start: number; end: number };
  mclFactors?: string[];
}

export interface AnalysisResult {
  documentId: string;
  timestamp: string;
  modulesUsed: string[];
  totalMatches: number;
  negativeMatches: PatternMatch[];
  positiveMatches: PatternMatch[];
  neutralMatches: PatternMatch[];
  severityScore: number;
  mclFactorScores: Record<string, number>;
  contradictions: Contradiction[];
  timeline: TimelineEvent[];
  summary: string;
}

export interface Contradiction {
  positiveMatch: PatternMatch;
  negativeMatch: PatternMatch;
  timeDelta?: number; // milliseconds between statements
  description: string;
}

export interface TimelineEvent {
  timestamp?: string;
  type: 'negative' | 'positive' | 'neutral';
  match: PatternMatch;
}

// ============================================================================
// BUILT-IN ANALYSIS MODULES
// ============================================================================

export const BUILT_IN_MODULES: AnalysisModule[] = [
  // NEGATIVE PATTERNS - Manipulation & Control
  {
    id: 'gaslighting',
    name: 'Gaslighting Detection',
    description: 'Identifies reality-distorting statements that make the victim question their perception',
    category: 'negative',
    subcategory: 'manipulation',
    enabled: true,
    weight: 90,
    mclFactors: ['j', 'k', 'l'] // Domestic violence, willingness to facilitate relationship, other factors
  },
  {
    id: 'blame_shifting',
    name: 'Blame Shifting',
    description: 'Detects patterns where responsibility is deflected onto the victim',
    category: 'negative',
    subcategory: 'manipulation',
    enabled: true,
    weight: 85,
    mclFactors: ['j', 'l']
  },
  {
    id: 'minimization',
    name: 'Minimization & Dismissal',
    description: 'Identifies attempts to downplay concerns, feelings, or events',
    category: 'negative',
    subcategory: 'manipulation',
    enabled: true,
    weight: 75,
    mclFactors: ['f', 'j'] // Mental health, domestic violence
  },
  {
    id: 'threats_intimidation',
    name: 'Threats & Intimidation',
    description: 'Detects explicit or implicit threats, ultimatums, and intimidating language',
    category: 'negative',
    subcategory: 'control',
    enabled: true,
    weight: 95,
    mclFactors: ['j', 'l']
  },
  {
    id: 'isolation_tactics',
    name: 'Isolation Tactics',
    description: 'Identifies attempts to separate victim from support systems',
    category: 'negative',
    subcategory: 'control',
    enabled: true,
    weight: 85,
    mclFactors: ['j', 'k']
  },
  {
    id: 'financial_control',
    name: 'Financial Control',
    description: 'Detects financial manipulation and economic abuse patterns',
    category: 'negative',
    subcategory: 'control',
    enabled: true,
    weight: 80,
    mclFactors: ['c', 'j'] // Capacity to provide, domestic violence
  },
  {
    id: 'emotional_blackmail',
    name: 'Emotional Blackmail',
    description: 'Identifies FOG tactics (Fear, Obligation, Guilt)',
    category: 'negative',
    subcategory: 'manipulation',
    enabled: true,
    weight: 85,
    mclFactors: ['f', 'j']
  },
  {
    id: 'stonewalling',
    name: 'Stonewalling & Silent Treatment',
    description: 'Detects withdrawal, refusal to communicate, and silent treatment patterns',
    category: 'negative',
    subcategory: 'control',
    enabled: true,
    weight: 70,
    mclFactors: ['f', 'k']
  },
  {
    id: 'parental_alienation',
    name: 'Parental Alienation',
    description: 'Identifies attempts to damage child-parent relationships',
    category: 'negative',
    subcategory: 'custody',
    enabled: true,
    weight: 95,
    mclFactors: ['i', 'j', 'k'] // Reasonable preference, domestic violence, willingness to facilitate
  },
  {
    id: 'projection',
    name: 'Projection',
    description: 'Detects accusations that mirror the accuser\'s own behavior',
    category: 'negative',
    subcategory: 'manipulation',
    enabled: true,
    weight: 75,
    mclFactors: ['j', 'l']
  },

  // POSITIVE PATTERNS - Love Bombing & Affection
  {
    id: 'love_bombing',
    name: 'Love Bombing',
    description: 'Identifies excessive flattery, premature declarations of love, and overwhelming affection',
    category: 'positive',
    subcategory: 'affection',
    enabled: true,
    weight: 80,
    mclFactors: ['l'] // Other factors - pattern recognition
  },
  {
    id: 'future_faking',
    name: 'Future Faking',
    description: 'Detects grandiose promises about the future that may not be fulfilled',
    category: 'positive',
    subcategory: 'promises',
    enabled: true,
    weight: 75,
    mclFactors: ['l']
  },
  {
    id: 'affirmations',
    name: 'Positive Affirmations',
    description: 'Tracks genuine-seeming compliments and supportive statements',
    category: 'positive',
    subcategory: 'affection',
    enabled: true,
    weight: 50,
    mclFactors: []
  },
  {
    id: 'apologies',
    name: 'Apologies & Remorse',
    description: 'Identifies apologies and expressions of remorse (to track sincerity over time)',
    category: 'positive',
    subcategory: 'reconciliation',
    enabled: true,
    weight: 60,
    mclFactors: ['l']
  },
  {
    id: 'gift_giving',
    name: 'Gift Giving & Generosity',
    description: 'Tracks mentions of gifts, financial generosity, and material expressions of love',
    category: 'positive',
    subcategory: 'affection',
    enabled: true,
    weight: 55,
    mclFactors: ['c'] // Capacity to provide
  },

  // NEUTRAL PATTERNS - Context & Metadata
  {
    id: 'scheduling',
    name: 'Scheduling & Custody',
    description: 'Identifies discussions about custody schedules, visitation, and parenting time',
    category: 'neutral',
    subcategory: 'logistics',
    enabled: true,
    weight: 40,
    mclFactors: ['a', 'b', 'd'] // Love/affection, capacity to continue, length of time
  },
  {
    id: 'child_wellbeing',
    name: 'Child Wellbeing Mentions',
    description: 'Tracks references to children\'s health, education, and emotional state',
    category: 'neutral',
    subcategory: 'children',
    enabled: true,
    weight: 50,
    mclFactors: ['a', 'b', 'e', 'g'] // Love, capacity, home/school, mental/physical health
  }
];

// ============================================================================
// PATTERN DEFINITIONS (Built-in)
// ============================================================================

export const BUILT_IN_PATTERNS: Record<string, { patterns: string[]; examples: string[] }> = {
  gaslighting: {
    patterns: [
      'that never happened',
      'you\'re imagining things',
      'you\'re crazy',
      'you\'re being paranoid',
      'you\'re too sensitive',
      'you\'re overreacting',
      'i never said that',
      'you\'re making things up',
      'that\'s not what happened',
      'you have a bad memory',
      'no one else thinks that',
      'everyone agrees with me',
      'you\'re the only one who',
      'you always twist things',
      'you\'re delusional'
    ],
    examples: [
      'That conversation never happened, you must be imagining things.',
      'You\'re being paranoid again, I never said that.',
      'You\'re too sensitive, it was just a joke.'
    ]
  },
  blame_shifting: {
    patterns: [
      'this is your fault',
      'you made me',
      'if you hadn\'t',
      'because of you',
      'you started it',
      'look what you made me do',
      'you drove me to',
      'you pushed me to',
      'this wouldn\'t happen if you',
      'you bring out the worst',
      'you\'re the reason',
      'it\'s because you'
    ],
    examples: [
      'This is your fault for not listening to me.',
      'You made me act this way with your behavior.',
      'If you hadn\'t pushed me, this wouldn\'t have happened.'
    ]
  },
  minimization: {
    patterns: [
      'it\'s not a big deal',
      'you\'re blowing this out of proportion',
      'it wasn\'t that bad',
      'get over it',
      'move on already',
      'stop dwelling',
      'it\'s in the past',
      'let it go',
      'you\'re making a mountain',
      'calm down',
      'relax',
      'chill out',
      'it\'s nothing',
      'don\'t be dramatic'
    ],
    examples: [
      'It\'s not a big deal, you\'re blowing this out of proportion.',
      'That was nothing, just get over it already.',
      'Stop being so dramatic about everything.'
    ]
  },
  threats_intimidation: {
    patterns: [
      'you\'ll regret',
      'you\'ll be sorry',
      'i\'ll make sure',
      'you\'ll never see',
      'i\'ll take the kids',
      'i\'ll destroy',
      'i\'ll ruin',
      'you\'ll pay for',
      'watch what happens',
      'don\'t test me',
      'you don\'t want to',
      'i\'ll tell everyone',
      'i\'ll expose',
      'you\'ll lose everything',
      'or else'
    ],
    examples: [
      'You\'ll regret this decision, I\'ll make sure of it.',
      'If you leave, you\'ll never see the kids again.',
      'Don\'t test me, you don\'t want to see what happens.'
    ]
  },
  isolation_tactics: {
    patterns: [
      'your family is toxic',
      'your friends don\'t care',
      'they\'re using you',
      'they\'re against us',
      'you don\'t need them',
      'i\'m the only one',
      'no one understands you like i do',
      'they\'re jealous',
      'they\'re trying to break us up',
      'you spend too much time with',
      'choose me or them',
      'it\'s us against the world'
    ],
    examples: [
      'Your family is toxic, they\'re just trying to break us up.',
      'I\'m the only one who truly understands you.',
      'Your friends don\'t really care about you like I do.'
    ]
  },
  emotional_blackmail: {
    patterns: [
      'after everything i\'ve done',
      'if you loved me',
      'you owe me',
      'i sacrificed',
      'i gave up everything',
      'how could you do this to me',
      'you\'re hurting me',
      'you\'re breaking my heart',
      'i can\'t live without',
      'i\'ll hurt myself',
      'you\'ll destroy me',
      'i thought you cared'
    ],
    examples: [
      'After everything I\'ve done for you, this is how you repay me?',
      'If you really loved me, you wouldn\'t do this.',
      'I sacrificed everything for this family and you don\'t appreciate it.'
    ]
  },
  stonewalling: {
    patterns: [
      'i\'m not talking about this',
      'conversation is over',
      'i have nothing to say',
      'talk to my lawyer',
      'don\'t contact me',
      'leave me alone',
      'i\'m done',
      'whatever',
      'fine',
      'i don\'t care',
      'do what you want'
    ],
    examples: [
      'I\'m not talking about this anymore, conversation is over.',
      'Whatever. Do what you want, I don\'t care.',
      'Talk to my lawyer, I have nothing to say to you.'
    ]
  },
  parental_alienation: {
    patterns: [
      'your father doesn\'t love',
      'your mother doesn\'t love',
      'daddy doesn\'t care',
      'mommy doesn\'t care',
      'daddy doesn\'t love',
      'mommy doesn\'t love',
      'they abandoned',
      'they chose',
      'they don\'t want to see you',
      'it\'s their fault',
      'they\'re the bad guy',
      'don\'t tell them',
      'our little secret',
      'they\'ll be mad at you',
      'they don\'t understand',
      'you\'re better off without'
    ],
    examples: [
      'Your father doesn\'t really love you, he just pretends.',
      'Mommy chose her new boyfriend over you.',
      'Don\'t tell daddy about this, it\'s our little secret.'
    ]
  },
  love_bombing: {
    patterns: [
      'you\'re perfect',
      'you\'re my everything',
      'i\'ve never felt this way',
      'you\'re my soulmate',
      'we\'re meant to be',
      'i can\'t live without you',
      'you complete me',
      'you\'re the best thing',
      'i\'ve never loved anyone like',
      'you\'re amazing',
      'you\'re incredible',
      'i\'m so lucky',
      'you\'re too good for me'
    ],
    examples: [
      'You\'re absolutely perfect, I\'ve never felt this way about anyone.',
      'You\'re my soulmate, we were meant to be together.',
      'I can\'t live without you, you complete me.'
    ]
  },
  future_faking: {
    patterns: [
      'when we get married',
      'when we have kids',
      'i\'m going to buy you',
      'we\'ll travel the world',
      'i\'ll change',
      'things will be different',
      'i promise to',
      'next time',
      'soon we\'ll',
      'one day we\'ll',
      'i\'ll make it up to you',
      'just wait until'
    ],
    examples: [
      'When we get married, everything will be perfect.',
      'I promise I\'ll change, things will be different this time.',
      'Soon we\'ll travel the world together, just wait.'
    ]
  },
  apologies: {
    patterns: [
      'i\'m sorry',
      'i apologize',
      'please forgive me',
      'i was wrong',
      'i made a mistake',
      'i shouldn\'t have',
      'i regret',
      'i feel terrible',
      'i\'ll do better',
      'give me another chance',
      'i didn\'t mean to'
    ],
    examples: [
      'I\'m so sorry, I was completely wrong.',
      'Please forgive me, I made a terrible mistake.',
      'I regret everything, give me another chance.'
    ]
  },
  projection: {
    patterns: [
      'you\'re the one who',
      'you always',
      'you never',
      'you\'re cheating',
      'you\'re lying',
      'you\'re manipulating',
      'you\'re controlling',
      'you\'re abusive',
      'you\'re the narcissist',
      'you\'re gaslighting me'
    ],
    examples: [
      'You\'re the one who\'s always lying, not me.',
      'You\'re so controlling, you never let me do anything.',
      'You\'re the narcissist here, not me.'
    ]
  }
};

// ============================================================================
// ANALYZER CLASS
// ============================================================================

export class CommunicationPatternAnalyzer {
  private modules: AnalysisModule[] = [];
  private customPatterns: Map<string, { patterns: string[]; examples: string[] }> = new Map();

  constructor() {
    // Deep copy to avoid shared state mutation between instances
    this.modules = BUILT_IN_MODULES.map(m => ({ ...m, mclFactors: [...(m.mclFactors || [])] }));
  }

  /**
   * Load user's custom patterns and module preferences from database
   */
  async loadUserConfig(userId: number): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    // Load custom patterns
    const userPatterns = await db
      .select()
      .from(behavioralPatterns)
      .where(and(
        eq(behavioralPatterns.userId, userId),
        eq(behavioralPatterns.isActive, 'true')
      ));

    for (const p of userPatterns) {
      const moduleId = p.category?.toLowerCase().replace(/\s+/g, '_') || 'custom';
      const existing = this.customPatterns.get(moduleId) || { patterns: [], examples: [] };
      
      if (p.pattern) {
        existing.patterns.push(p.pattern);
      }
      if (p.examples) {
        try {
          const examples = JSON.parse(p.examples);
          existing.examples.push(...examples);
        } catch {
          // Not JSON, treat as single example
          existing.examples.push(p.examples);
        }
      }
      
      this.customPatterns.set(moduleId, existing);
    }
  }

  /**
   * Get available modules (built-in + user custom)
   */
  getModules(): AnalysisModule[] {
    return this.modules;
  }

  /**
   * Enable/disable specific modules
   */
  setModuleEnabled(moduleId: string, enabled: boolean): void {
    const module = this.modules.find(m => m.id === moduleId);
    if (module) {
      module.enabled = enabled;
    }
  }

  /**
   * Analyze text for patterns
   */
  async analyze(
    text: string,
    options: {
      moduleIds?: string[];
      includeContext?: boolean;
      contextChars?: number;
    } = {}
  ): Promise<AnalysisResult> {
    const {
      moduleIds,
      includeContext = true,
      contextChars = 100
    } = options;

    const enabledModules = moduleIds
      ? this.modules.filter(m => moduleIds.includes(m.id))
      : this.modules.filter(m => m.enabled);

    const negativeMatches: PatternMatch[] = [];
    const positiveMatches: PatternMatch[] = [];
    const neutralMatches: PatternMatch[] = [];
    const mclFactorCounts: Record<string, number> = {};

    const textLower = text.toLowerCase();

    for (const module of enabledModules) {
      const patterns = BUILT_IN_PATTERNS[module.id]?.patterns || [];
      const customPatterns = this.customPatterns.get(module.id)?.patterns || [];
      const allPatterns = [...patterns, ...customPatterns];

      for (const pattern of allPatterns) {
        const patternLower = pattern.toLowerCase();
        let index = textLower.indexOf(patternLower);
        
        while (index !== -1) {
          const match: PatternMatch = {
            moduleId: module.id,
            moduleName: module.name,
            patternId: 0, // Will be set if from DB
            patternName: pattern,
            matchedText: text.substring(index, index + pattern.length),
            context: includeContext
              ? this.extractContext(text, index, pattern.length, contextChars)
              : '',
            confidence: 80, // Base confidence, could be enhanced with ML
            severity: module.weight,
            category: module.category,
            position: { start: index, end: index + pattern.length },
            mclFactors: module.mclFactors
          };

          // Categorize match
          if (module.category === 'negative') {
            negativeMatches.push(match);
          } else if (module.category === 'positive') {
            positiveMatches.push(match);
          } else {
            neutralMatches.push(match);
          }

          // Count MCL factors
          for (const factor of module.mclFactors || []) {
            mclFactorCounts[factor] = (mclFactorCounts[factor] || 0) + 1;
          }

          // Find next occurrence
          index = textLower.indexOf(patternLower, index + 1);
        }
      }
    }

    // Calculate severity score (weighted average of negative matches)
    const severityScore = this.calculateSeverityScore(negativeMatches);

    // Detect contradictions (positive statement followed/preceded by contradicting negative)
    const contradictions = this.detectContradictions(positiveMatches, negativeMatches);

    // Build timeline
    const timeline = this.buildTimeline([...negativeMatches, ...positiveMatches, ...neutralMatches]);

    // Generate summary
    const summary = this.generateSummary(negativeMatches, positiveMatches, contradictions, severityScore);

    return {
      documentId: this.generateDocumentId(text),
      timestamp: new Date().toISOString(),
      modulesUsed: enabledModules.map(m => m.id),
      totalMatches: negativeMatches.length + positiveMatches.length + neutralMatches.length,
      negativeMatches,
      positiveMatches,
      neutralMatches,
      severityScore,
      mclFactorScores: mclFactorCounts,
      contradictions,
      timeline,
      summary
    };
  }

  private extractContext(text: string, index: number, matchLength: number, contextChars: number): string {
    const start = Math.max(0, index - contextChars);
    const end = Math.min(text.length, index + matchLength + contextChars);
    let context = text.substring(start, end);
    
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    
    return context;
  }

  private calculateSeverityScore(negativeMatches: PatternMatch[]): number {
    if (negativeMatches.length === 0) return 0;
    
    const totalWeight = negativeMatches.reduce((sum, m) => sum + m.severity, 0);
    const avgWeight = totalWeight / negativeMatches.length;
    
    // Scale by count (more matches = higher severity, with diminishing returns)
    const countMultiplier = Math.min(2, 1 + Math.log10(negativeMatches.length + 1));
    
    return Math.min(100, Math.round(avgWeight * countMultiplier));
  }

  private detectContradictions(
    positiveMatches: PatternMatch[],
    negativeMatches: PatternMatch[]
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];

    // Look for love bombing followed by devaluation
    const loveBombing = positiveMatches.filter(m => m.moduleId === 'love_bombing');
    const devaluation = negativeMatches.filter(m => 
      ['gaslighting', 'blame_shifting', 'minimization', 'threats_intimidation'].includes(m.moduleId)
    );

    for (const positive of loveBombing) {
      for (const negative of devaluation) {
        // If they're in proximity (within 500 chars), flag as potential contradiction
        const distance = Math.abs(positive.position.start - negative.position.start);
        if (distance < 2000) {
          contradictions.push({
            positiveMatch: positive,
            negativeMatch: negative,
            description: `Love bombing ("${positive.matchedText}") followed by ${negative.moduleName.toLowerCase()} ("${negative.matchedText}")`
          });
        }
      }
    }

    // Look for apologies followed by same behavior
    const apologies = positiveMatches.filter(m => m.moduleId === 'apologies');
    for (const apology of apologies) {
      for (const negative of negativeMatches) {
        if (negative.position.start > apology.position.start) {
          const distance = negative.position.start - apology.position.start;
          if (distance < 3000) {
            contradictions.push({
              positiveMatch: apology,
              negativeMatch: negative,
              description: `Apology ("${apology.matchedText}") contradicted by subsequent ${negative.moduleName.toLowerCase()}`
            });
          }
        }
      }
    }

    return contradictions;
  }

  private buildTimeline(matches: PatternMatch[]): TimelineEvent[] {
    return matches
      .sort((a, b) => a.position.start - b.position.start)
      .map(match => ({
        type: match.category,
        match
      }));
  }

  private generateSummary(
    negativeMatches: PatternMatch[],
    positiveMatches: PatternMatch[],
    contradictions: Contradiction[],
    severityScore: number
  ): string {
    const parts: string[] = [];

    if (negativeMatches.length > 0) {
      const topNegative = this.getTopPatterns(negativeMatches, 3);
      parts.push(`Detected ${negativeMatches.length} concerning patterns, primarily: ${topNegative.join(', ')}.`);
    }

    if (positiveMatches.length > 0) {
      const topPositive = this.getTopPatterns(positiveMatches, 3);
      parts.push(`Found ${positiveMatches.length} positive/affectionate patterns: ${topPositive.join(', ')}.`);
    }

    if (contradictions.length > 0) {
      parts.push(`Identified ${contradictions.length} potential contradictions between positive and negative statements.`);
    }

    if (severityScore > 0) {
      const level = severityScore >= 80 ? 'HIGH' : severityScore >= 50 ? 'MODERATE' : 'LOW';
      parts.push(`Overall severity: ${level} (${severityScore}/100).`);
    }

    return parts.join(' ') || 'No significant patterns detected.';
  }

  private getTopPatterns(matches: PatternMatch[], count: number): string[] {
    const counts = new Map<string, number>();
    for (const m of matches) {
      counts.set(m.moduleName, (counts.get(m.moduleName) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([name, count]) => `${name} (${count})`);
  }

  private generateDocumentId(text: string): string {
    // Simple hash for document identification
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 1000); i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `doc_${Math.abs(hash).toString(16)}_${Date.now().toString(36)}`;
  }

  /**
   * Save analysis result to database
   */
  async saveResult(userId: number, result: AnalysisResult): Promise<number> {
    const db = await getDb();
    if (!db) throw new Error('Database not initialized');
    
    const insertResult = await db.insert(forensicResults).values({
      userId,
      sourceHash: result.documentId,
      sourceType: 'text',
      analysisType: 'behavioral',
      results: JSON.stringify(result),
      matchCount: result.totalMatches,
      severityScore: result.severityScore,
      mclFactorsMatched: JSON.stringify(Object.keys(result.mclFactorScores)),
      processingTimeMs: 0,
      modelUsed: 'pattern-analyzer-v1'
    });

    return Number(insertResult[0].insertId);
  }
}

// Export singleton instance
export const patternAnalyzer = new CommunicationPatternAnalyzer();
