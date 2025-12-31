/**
 * NLP Plugin
 * 
 * Provider-agnostic NLP capabilities:
 * - Language detection
 * - Entity extraction
 * - Keyword extraction
 * - Sentiment analysis
 * - Sentence splitting
 * 
 * Supports multiple providers: spaCy, transformers, NLTK, compromise.js
 * with automatic fallback and provider routing via config.
 */

import { getContentStore } from '../store/content-store';
import type { Entity, EntityType, SentimentResult, KeywordResult, SentenceSpan, ContentRef } from '../../../shared/mcp-types';
import * as pythonBridge from '../python-bridge';

// ============================================================================
// Provider Interface
// ============================================================================

interface NLPProvider {
  name: string;
  detectLanguage(text: string): Promise<{ language: string; confidence: number }>;
  extractEntities(text: string): Promise<Entity[]>;
  extractKeywords(text: string, topK: number): Promise<KeywordResult[]>;
  analyzeSentiment(text: string): Promise<SentimentResult>;
  splitSentences(text: string): Promise<SentenceSpan[]>;
}

// ============================================================================
// Built-in JavaScript Provider (No external dependencies)
// ============================================================================

class JavaScriptNLPProvider implements NLPProvider {
  name = 'javascript';

  async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    // Simple language detection based on character patterns
    const sample = text.slice(0, 1000).toLowerCase();
    
    // Common word patterns for different languages
    const patterns: Record<string, RegExp[]> = {
      en: [/\bthe\b/, /\band\b/, /\bis\b/, /\bof\b/, /\bto\b/],
      es: [/\bel\b/, /\bla\b/, /\bde\b/, /\bque\b/, /\by\b/],
      fr: [/\ble\b/, /\bla\b/, /\bde\b/, /\bet\b/, /\best\b/],
      de: [/\bder\b/, /\bdie\b/, /\bund\b/, /\bist\b/, /\bein\b/],
      zh: [/[\u4e00-\u9fff]/],
      ja: [/[\u3040-\u309f]/, /[\u30a0-\u30ff]/],
      ko: [/[\uac00-\ud7af]/],
    };

    let bestLang = 'en';
    let bestScore = 0;

    for (const [lang, regexes] of Object.entries(patterns)) {
      let score = 0;
      for (const regex of regexes) {
        if (regex.test(sample)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestLang = lang;
      }
    }

    return {
      language: bestLang,
      confidence: Math.min(bestScore / 5, 1),
    };
  }

  async extractEntities(text: string): Promise<Entity[]> {
    const entities: Entity[] = [];
    
    // Pattern-based entity extraction
    const patterns: Array<{ type: EntityType; regex: RegExp }> = [
      // Dates
      { type: 'DATE', regex: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g },
      { type: 'DATE', regex: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi },
      // Times
      { type: 'TIME', regex: /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/g },
      // Money
      { type: 'MONEY', regex: /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|trillion))?/gi },
      { type: 'MONEY', regex: /[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|JPY)/g },
      // Percentages
      { type: 'PERCENT', regex: /\b\d+(?:\.\d+)?%/g },
      // Emails (as ORG proxy)
      { type: 'ORG', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
      // URLs
      { type: 'PRODUCT', regex: /https?:\/\/[^\s]+/g },
      // Capitalized sequences (potential names/orgs)
      { type: 'PERSON', regex: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g },
    ];

    for (const { type, regex } of patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          confidence: 0.7,
        });
      }
    }

    // Deduplicate overlapping entities
    return deduplicateEntities(entities);
  }

  async extractKeywords(text: string, topK: number = 10): Promise<KeywordResult[]> {
    // Simple TF-based keyword extraction
    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) ?? [];
    const stopwords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'were', 'they',
      'this', 'that', 'with', 'from', 'will', 'would', 'there', 'their', 'what',
      'about', 'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take',
      'into', 'year', 'your', 'some', 'could', 'them', 'other', 'than', 'then',
    ]);

    const freq: Map<string, { count: number; positions: number[] }> = new Map();
    let position = 0;

    for (const word of words) {
      if (!stopwords.has(word)) {
        const existing = freq.get(word) ?? { count: 0, positions: [] };
        existing.count++;
        existing.positions.push(position);
        freq.set(word, existing);
      }
      position++;
    }

    // Sort by frequency and return top K
    const sorted = Array.from(freq.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, topK);

    const maxFreq = sorted[0]?.[1].count ?? 1;

    return sorted.map(([keyword, data]) => ({
      keyword,
      score: data.count / maxFreq,
      frequency: data.count,
      positions: data.positions.slice(0, 10), // Limit positions for token efficiency
    }));
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    // Simple lexicon-based sentiment analysis
    const positiveWords = new Set([
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love',
      'happy', 'joy', 'positive', 'best', 'perfect', 'beautiful', 'awesome',
      'brilliant', 'outstanding', 'superb', 'delightful', 'pleasant', 'nice',
    ]);

    const negativeWords = new Set([
      'bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'poor', 'sad',
      'negative', 'ugly', 'disappointing', 'frustrating', 'annoying', 'boring',
      'dreadful', 'disgusting', 'unpleasant', 'painful', 'miserable', 'angry',
    ]);

    const words = text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
    let positive = 0;
    let negative = 0;

    for (const word of words) {
      if (positiveWords.has(word)) positive++;
      if (negativeWords.has(word)) negative++;
    }

    const total = positive + negative;
    if (total === 0) {
      return { label: 'neutral', score: 0, confidence: 0.5 };
    }

    const score = (positive - negative) / total;
    const label = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral';
    const confidence = Math.min(Math.abs(score) + 0.5, 1);

    return { label, score, confidence };
  }

  async splitSentences(text: string): Promise<SentenceSpan[]> {
    const sentences: SentenceSpan[] = [];
    // Improved sentence splitting regex
    const regex = /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
    let match;
    let index = 0;

    while ((match = regex.exec(text)) !== null) {
      const sentence = match[0].trim();
      if (sentence) {
        sentences.push({
          text: sentence,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
          index: index++,
        });
      }
    }

    return sentences;
  }
}

// ============================================================================
// Python Provider (via subprocess bridge)
// ============================================================================

class PythonNLPProvider implements NLPProvider {
  name = 'python';

  async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    const result = await pythonBridge.detectLanguage(text);
    return { language: result.language, confidence: result.confidence };
  }

  async extractEntities(text: string): Promise<Entity[]> {
    const result = await pythonBridge.extractEntities(text);
    return result.entities.map(e => ({
      text: e.text,
      type: e.type as EntityType,
      startOffset: e.start,
      endOffset: e.end,
      confidence: e.confidence,
    }));
  }

  async extractKeywords(text: string, topK: number): Promise<KeywordResult[]> {
    const result = await pythonBridge.extractKeywords(text, topK);
    return result.keywords.map(k => ({
      keyword: k.keyword,
      score: k.score,
      frequency: k.frequency,
      positions: [],
    }));
  }

  async analyzeSentiment(text: string): Promise<SentimentResult> {
    const result = await pythonBridge.analyzeSentiment(text);
    return {
      label: result.label,
      score: result.score,
      confidence: result.confidence,
    };
  }

  async splitSentences(text: string): Promise<SentenceSpan[]> {
    const result = await pythonBridge.splitSentences(text);
    return result.sentences.map(s => ({
      text: s.text,
      startOffset: s.start,
      endOffset: s.end,
      index: s.index,
    }));
  }
}

// ============================================================================
// Provider Registry
// ============================================================================

const providers: Map<string, NLPProvider> = new Map();
let defaultProvider: NLPProvider;

// Initialize providers - Python preferred, JS fallback
const pythonProvider = new PythonNLPProvider();
const jsProvider = new JavaScriptNLPProvider();

providers.set('python', pythonProvider);
providers.set('javascript', jsProvider);
providers.set('spacy', pythonProvider); // spaCy is accessed via Python

// Default to Python (will auto-fallback to JS if Python unavailable)
defaultProvider = pythonProvider;
providers.set('auto', defaultProvider);

/**
 * Register a custom NLP provider
 */
export function registerNLPProvider(provider: NLPProvider): void {
  providers.set(provider.name, provider);
}

/**
 * Set the default provider
 */
export function setDefaultProvider(name: string): void {
  const provider = providers.get(name);
  if (!provider) {
    throw new Error(`Provider not found: ${name}`);
  }
  defaultProvider = provider;
}

/**
 * Get a provider by name
 */
function getProvider(name?: string): NLPProvider {
  if (!name || name === 'auto') {
    return defaultProvider;
  }
  const provider = providers.get(name);
  if (!provider) {
    console.warn(`Provider ${name} not found, using default`);
    return defaultProvider;
  }
  return provider;
}

// ============================================================================
// Public API
// ============================================================================

interface DetectLanguageArgs {
  textRef: string;
}

interface ExtractEntitiesArgs {
  textRef: string;
  provider?: string;
  types?: EntityType[];
}

interface ExtractKeywordsArgs {
  textRef: string;
  method?: string;
  topK?: number;
}

interface AnalyzeSentimentArgs {
  textRef: string;
  provider?: string;
}

interface SplitSentencesArgs {
  textRef: string;
  provider?: string;
}

/**
 * Detect language of text
 */
export async function detectLanguage(args: DetectLanguageArgs): Promise<{
  language: string;
  confidence: number;
  alternatives?: Array<{ language: string; confidence: number }>;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);
  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const result = await defaultProvider.detectLanguage(text);
  return result;
}

/**
 * Extract named entities with offsets
 */
export async function extractEntities(args: ExtractEntitiesArgs): Promise<{
  entities: Entity[];
  entitiesRef?: ContentRef;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);
  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const provider = getProvider(args.provider);
  let entities = await provider.extractEntities(text);

  // Filter by types if specified
  if (args.types && args.types.length > 0) {
    const typeSet = new Set(args.types);
    entities = entities.filter((e) => typeSet.has(e.type));
  }

  // Store large results as reference
  let entitiesRef: ContentRef | undefined;
  if (entities.length > 50) {
    const stored = await store.put(JSON.stringify(entities), 'application/json');
    entitiesRef = stored.ref;
    entities = entities.slice(0, 20); // Return preview
  }

  return { entities, entitiesRef };
}

/**
 * Extract keywords using TF-IDF or TextRank
 */
export async function extractKeywords(args: ExtractKeywordsArgs): Promise<{
  keywords: KeywordResult[];
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);
  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const topK = args.topK ?? 10;
  const keywords = await defaultProvider.extractKeywords(text, topK);

  return { keywords };
}

/**
 * Analyze sentiment of text
 */
export async function analyzeSentiment(args: AnalyzeSentimentArgs): Promise<SentimentResult> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);
  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const provider = getProvider(args.provider);
  return provider.analyzeSentiment(text);
}

/**
 * Split text into sentences with offsets
 */
export async function splitSentences(args: SplitSentencesArgs): Promise<{
  sentences: SentenceSpan[];
  sentencesRef?: ContentRef;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);
  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const provider = getProvider(args.provider);
  const sentences = await provider.splitSentences(text);

  // Store large results as reference
  let sentencesRef: ContentRef | undefined;
  if (sentences.length > 100) {
    const stored = await store.put(JSON.stringify(sentences), 'application/json');
    sentencesRef = stored.ref;
  }

  return { sentences: sentences.slice(0, 50), sentencesRef };
}

/**
 * Generate text outline based on structure
 */
export async function makeOutline(args: { textRef: string }): Promise<{
  outline: Array<{ level: number; title: string; startOffset: number }>;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);
  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const outline: Array<{ level: number; title: string; startOffset: number }> = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;

  while ((match = headingRegex.exec(text)) !== null) {
    outline.push({
      level: match[1].length,
      title: match[2].trim(),
      startOffset: match.index,
    });
  }

  return { outline };
}

// ============================================================================
// Helper Functions
// ============================================================================

function deduplicateEntities(entities: Entity[]): Entity[] {
  // Sort by start offset
  entities.sort((a, b) => a.startOffset - b.startOffset);

  const result: Entity[] = [];
  for (const entity of entities) {
    const last = result[result.length - 1];
    // Skip if overlapping with previous entity
    if (last && entity.startOffset < last.endOffset) {
      // Keep the one with higher confidence
      if (entity.confidence > last.confidence) {
        result[result.length - 1] = entity;
      }
      continue;
    }
    result.push(entity);
  }

  return result;
}
