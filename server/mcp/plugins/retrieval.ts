/**
 * Retrieval Plugin
 * 
 * Provides retrieval capabilities:
 * - BM25 retrieval for keyword matching
 * - Supporting span retrieval for questions
 * - Citation tracking
 * - Hybrid retrieval (BM25 + embeddings)
 */

import { getContentStore } from '../store/content-store';
import type { ContentRef } from '../../../shared/mcp-types';

interface Citation {
  id: string;
  text: string;
  sourceRef: string;
  startOffset: number;
  endOffset: number;
  relevanceScore: number;
}

// ============================================================================
// BM25 Parameters
// ============================================================================

const BM25_K1 = 1.2;
const BM25_B = 0.75;

// ============================================================================
// Public API
// ============================================================================

interface RetrieveSupportingSpansArgs {
  question: string;
  docRef: string;
  topK?: number;
  useEmbeddings?: boolean;
}

interface BM25SearchArgs {
  query: string;
  docRefs: string[];
  topK?: number;
}

interface HybridSearchArgs {
  query: string;
  docRefs: string[];
  topK?: number;
  bm25Weight?: number;
}

/**
 * Retrieve supporting spans for a question
 */
export async function retrieveSupportingSpans(args: RetrieveSupportingSpansArgs): Promise<{
  spans: Array<{
    text: string;
    score: number;
    startOffset: number;
    endOffset: number;
  }>;
  citations: Citation[];
}> {
  const store = await getContentStore();
  const text = await store.getString(args.docRef as ContentRef);

  if (!text) {
    throw new Error(`Content not found: ${args.docRef}`);
  }

  const topK = args.topK ?? 5;

  // Split document into passages
  const passages = splitIntoPassages(text);

  // Score passages using BM25
  const queryTerms = tokenize(args.question);
  const scored = scorePassagesBM25(passages, queryTerms, text);

  // Optionally enhance with embeddings
  if (args.useEmbeddings) {
    // In production, integrate with ML plugin
    // For now, just use BM25 scores
  }

  // Select top passages
  const topPassages = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Generate citations
  const citations: Citation[] = topPassages.map((p, i) => ({
    id: `cite-${i}`,
    text: p.text.slice(0, 100),
    sourceRef: args.docRef,
    startOffset: p.startOffset,
    endOffset: p.endOffset,
    relevanceScore: p.score,
  }));

  return {
    spans: topPassages.map((p) => ({
      text: p.text,
      score: p.score,
      startOffset: p.startOffset,
      endOffset: p.endOffset,
    })),
    citations,
  };
}

/**
 * BM25 search across multiple documents
 */
export async function bm25Search(args: BM25SearchArgs): Promise<{
  results: Array<{
    docRef: string;
    score: number;
    topPassage: string;
    passageOffset: number;
  }>;
}> {
  const store = await getContentStore();
  const topK = args.topK ?? 10;
  const queryTerms = tokenize(args.query);

  const results: Array<{
    docRef: string;
    score: number;
    topPassage: string;
    passageOffset: number;
  }> = [];

  for (const docRef of args.docRefs) {
    const text = await store.getString(docRef as ContentRef);
    if (!text) continue;

    const passages = splitIntoPassages(text);
    const scored = scorePassagesBM25(passages, queryTerms, text);

    if (scored.length > 0) {
      const best = scored.sort((a, b) => b.score - a.score)[0];
      results.push({
        docRef,
        score: best.score,
        topPassage: best.text.slice(0, 200),
        passageOffset: best.startOffset,
      });
    }
  }

  return {
    results: results.sort((a, b) => b.score - a.score).slice(0, topK),
  };
}

/**
 * Hybrid search combining BM25 and semantic similarity
 */
export async function hybridSearch(args: HybridSearchArgs): Promise<{
  results: Array<{
    docRef: string;
    bm25Score: number;
    semanticScore: number;
    combinedScore: number;
    topPassage: string;
  }>;
}> {
  const store = await getContentStore();
  const topK = args.topK ?? 10;
  const bm25Weight = args.bm25Weight ?? 0.5;
  const queryTerms = tokenize(args.query);

  const results: Array<{
    docRef: string;
    bm25Score: number;
    semanticScore: number;
    combinedScore: number;
    topPassage: string;
  }> = [];

  for (const docRef of args.docRefs) {
    const text = await store.getString(docRef as ContentRef);
    if (!text) continue;

    const passages = splitIntoPassages(text);
    const bm25Scored = scorePassagesBM25(passages, queryTerms, text);

    if (bm25Scored.length > 0) {
      const best = bm25Scored.sort((a, b) => b.score - a.score)[0];
      
      // Placeholder for semantic score - in production, use ML plugin
      const semanticScore = 0.5;
      
      const combinedScore = bm25Weight * best.score + (1 - bm25Weight) * semanticScore;

      results.push({
        docRef,
        bm25Score: best.score,
        semanticScore,
        combinedScore,
        topPassage: best.text.slice(0, 200),
      });
    }
  }

  return {
    results: results.sort((a, b) => b.combinedScore - a.combinedScore).slice(0, topK),
  };
}

/**
 * Find passages that answer a specific question
 */
export async function findAnswerPassages(args: {
  question: string;
  docRef: string;
  maxPassages?: number;
}): Promise<{
  passages: Array<{
    text: string;
    confidence: number;
    offset: number;
  }>;
  bestAnswer?: string;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.docRef as ContentRef);

  if (!text) {
    throw new Error(`Content not found: ${args.docRef}`);
  }

  const maxPassages = args.maxPassages ?? 3;

  // Extract question type
  const questionType = classifyQuestion(args.question);

  // Split into passages
  const passages = splitIntoPassages(text);

  // Score based on question type and content
  const scored = passages.map((passage) => {
    let score = 0;

    // BM25 base score
    const queryTerms = tokenize(args.question);
    score += calculateBM25Score(passage.text, queryTerms, passages.length, getAverageLength(passages));

    // Boost based on question type patterns
    if (questionType === 'what' && /\b(is|are|means?|defined?)\b/i.test(passage.text)) {
      score *= 1.2;
    }
    if (questionType === 'how' && /\b(steps?|process|method|way)\b/i.test(passage.text)) {
      score *= 1.2;
    }
    if (questionType === 'why' && /\b(because|reason|cause|due to)\b/i.test(passage.text)) {
      score *= 1.2;
    }
    if (questionType === 'when' && /\b\d{4}\b|\b(date|time|year|month)\b/i.test(passage.text)) {
      score *= 1.2;
    }
    if (questionType === 'who' && /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(passage.text)) {
      score *= 1.2;
    }

    return {
      ...passage,
      confidence: Math.min(score, 1),
    };
  });

  const topPassages = scored
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxPassages);

  // Extract best answer sentence
  let bestAnswer: string | undefined;
  if (topPassages.length > 0) {
    const sentences = topPassages[0].text.match(/[^.!?]+[.!?]+/g) ?? [];
    if (sentences.length > 0) {
      // Find sentence with highest query term overlap
      const queryTerms = new Set(tokenize(args.question));
      let bestSentence = sentences[0];
      let bestOverlap = 0;

      for (const sentence of sentences) {
        const sentenceTerms = new Set(tokenize(sentence));
        const overlap = Array.from(queryTerms).filter((t) => sentenceTerms.has(t)).length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestSentence = sentence;
        }
      }

      bestAnswer = bestSentence ? bestSentence.trim() : undefined;
    }
  }

  return {
    passages: topPassages.map((p) => ({
      text: p.text,
      confidence: p.confidence,
      offset: p.startOffset,
    })),
    bestAnswer,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface Passage {
  text: string;
  startOffset: number;
  endOffset: number;
}

interface ScoredPassage extends Passage {
  score: number;
}

function splitIntoPassages(text: string, maxLength: number = 500): Passage[] {
  const passages: Passage[] = [];
  const paragraphs = text.split(/\n\n+/);
  let offset = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length < 20) {
      offset += para.length + 2;
      continue;
    }

    // Split long paragraphs
    if (trimmed.length > maxLength) {
      const sentences = trimmed.match(/[^.!?]+[.!?]+/g) ?? [trimmed];
      let currentPassage = '';
      let passageStart = offset;

      for (const sentence of sentences) {
        if (currentPassage.length + sentence.length > maxLength && currentPassage.length > 0) {
          passages.push({
            text: currentPassage.trim(),
            startOffset: passageStart,
            endOffset: passageStart + currentPassage.length,
          });
          currentPassage = '';
          passageStart = offset + trimmed.indexOf(sentence);
        }
        currentPassage += sentence;
      }

      if (currentPassage.trim()) {
        passages.push({
          text: currentPassage.trim(),
          startOffset: passageStart,
          endOffset: passageStart + currentPassage.length,
        });
      }
    } else {
      const startOffset = text.indexOf(trimmed, offset);
      passages.push({
        text: trimmed,
        startOffset,
        endOffset: startOffset + trimmed.length,
      });
    }

    offset += para.length + 2;
  }

  return passages;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\b\w{2,}\b/g) ?? [])
    .filter((word) => !STOPWORDS.has(word));
}

function scorePassagesBM25(passages: Passage[], queryTerms: string[], fullText: string): ScoredPassage[] {
  const avgLength = getAverageLength(passages);
  const N = passages.length;

  return passages.map((passage) => ({
    ...passage,
    score: calculateBM25Score(passage.text, queryTerms, N, avgLength),
  }));
}

function calculateBM25Score(text: string, queryTerms: string[], N: number, avgDl: number): number {
  const terms = tokenize(text);
  const termFreq: Map<string, number> = new Map();

  for (const term of terms) {
    termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
  }

  let score = 0;
  const dl = terms.length;

  for (const queryTerm of queryTerms) {
    const tf = termFreq.get(queryTerm) ?? 0;
    if (tf === 0) continue;

    // Simplified IDF (assuming each query term appears in ~10% of documents)
    const df = Math.max(1, N * 0.1);
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

    const numerator = tf * (BM25_K1 + 1);
    const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * (dl / avgDl));

    score += idf * (numerator / denominator);
  }

  return score;
}

function getAverageLength(passages: Passage[]): number {
  if (passages.length === 0) return 100;
  const totalLength = passages.reduce((sum, p) => sum + tokenize(p.text).length, 0);
  return totalLength / passages.length;
}

function classifyQuestion(question: string): string {
  const lower = question.toLowerCase();
  if (lower.startsWith('what')) return 'what';
  if (lower.startsWith('how')) return 'how';
  if (lower.startsWith('why')) return 'why';
  if (lower.startsWith('when')) return 'when';
  if (lower.startsWith('who')) return 'who';
  if (lower.startsWith('where')) return 'where';
  if (lower.startsWith('which')) return 'which';
  return 'other';
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where',
  'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'also',
]);
