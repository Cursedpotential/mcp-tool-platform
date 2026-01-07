/**
 * Summarization Plugin
 * 
 * Provides hierarchical summarization capabilities:
 * - Map-reduce processing for large documents
 * - Citation tracking
 * - Multiple summary styles (concise, detailed, bullet)
 * - Token-efficient chunked processing
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
// Configuration
// ============================================================================

interface SummarizationConfig {
  maxChunkSize: number;
  maxOutputTokens: number;
  llmProvider: 'local' | 'ollama' | 'openai' | 'gemini';
}

const defaultConfig: SummarizationConfig = {
  maxChunkSize: 4000,
  maxOutputTokens: 1000,
  llmProvider: 'local',
};

let config = { ...defaultConfig };

/**
 * Configure summarization
 */
export function configureSummarization(newConfig: Partial<SummarizationConfig>): void {
  config = { ...config, ...newConfig };
}

// ============================================================================
// Public API
// ============================================================================

interface HierarchicalSummarizeArgs {
  textRef: string;
  maxLength?: number;
  style?: 'concise' | 'detailed' | 'bullet';
  preserveCitations?: boolean;
}

interface ExtractiveArgs {
  textRef: string;
  numSentences?: number;
  method?: 'textrank' | 'position' | 'tfidf';
}

/**
 * Hierarchical map-reduce summarization for large documents
 */
export async function hierarchicalSummarize(args: HierarchicalSummarizeArgs): Promise<{
  summaryRef: ContentRef;
  citations: Citation[];
  compressionRatio: number;
  preview: string;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);

  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const maxLength = args.maxLength ?? 500;
  const style = args.style ?? 'concise';
  const preserveCitations = args.preserveCitations ?? true;

  // Split into chunks
  const chunks = splitIntoChunks(text, config.maxChunkSize);
  const citations: Citation[] = [];

  // Map phase: summarize each chunk
  const chunkSummaries: string[] = [];
  let offset = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const summary = await summarizeChunk(chunk, style, maxLength / chunks.length);
    chunkSummaries.push(summary);

    // Track citations
    if (preserveCitations) {
      const sentences = extractKeySentences(chunk, 2);
      for (const sentence of sentences) {
        const sentenceOffset = text.indexOf(sentence, offset);
        if (sentenceOffset !== -1) {
          citations.push({
            id: `cite-${i}-${citations.length}`,
            text: sentence.slice(0, 100),
            sourceRef: args.textRef,
            startOffset: sentenceOffset,
            endOffset: sentenceOffset + sentence.length,
            relevanceScore: 0.8,
          });
        }
      }
    }

    offset += chunk.length;
  }

  // Reduce phase: combine chunk summaries
  let finalSummary: string;

  if (chunkSummaries.length === 1) {
    finalSummary = chunkSummaries[0];
  } else {
    // Recursively summarize if still too long
    const combined = chunkSummaries.join('\n\n');
    if (combined.length > maxLength * 2) {
      const combinedRef = await store.put(combined, 'text/plain');
      const result = await hierarchicalSummarize({
        textRef: combinedRef.ref,
        maxLength,
        style,
        preserveCitations: false, // Already have citations
      });
      finalSummary = await store.getString(result.summaryRef) ?? combined;
    } else {
      finalSummary = await summarizeChunk(combined, style, maxLength);
    }
  }

  // Format based on style
  if (style === 'bullet') {
    finalSummary = formatAsBullets(finalSummary);
  }

  // Store result
  const stored = await store.put(finalSummary, 'text/plain');

  const compressionRatio = text.length / finalSummary.length;

  return {
    summaryRef: stored.ref,
    citations: citations.slice(0, 10), // Limit citations for token efficiency
    compressionRatio,
    preview: finalSummary.slice(0, 300) + (finalSummary.length > 300 ? '...' : ''),
  };
}

/**
 * Extractive summarization (select key sentences)
 */
export async function extractiveSummarize(args: ExtractiveArgs): Promise<{
  summaryRef: ContentRef;
  selectedSentences: Array<{ text: string; score: number; offset: number }>;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);

  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const numSentences = args.numSentences ?? 5;
  const method = args.method ?? 'textrank';

  // Split into sentences
  const sentences = splitIntoSentences(text);

  // Score sentences
  let scored: Array<{ text: string; score: number; offset: number; index: number }>;

  switch (method) {
    case 'textrank':
      scored = scoreByTextRank(sentences, text);
      break;
    case 'position':
      scored = scoreByPosition(sentences, text);
      break;
    case 'tfidf':
      scored = scoreByTfIdf(sentences, text);
      break;
    default:
      scored = scoreByPosition(sentences, text);
  }

  // Select top sentences
  const selected = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, numSentences)
    .sort((a, b) => a.index - b.index); // Restore original order

  const summary = selected.map((s) => s.text).join(' ');
  const stored = await store.put(summary, 'text/plain');

  return {
    summaryRef: stored.ref,
    selectedSentences: selected.map((s) => ({
      text: s.text,
      score: s.score,
      offset: s.offset,
    })),
  };
}

/**
 * Generate outline from document
 */
export async function generateOutline(args: { textRef: string }): Promise<{
  outline: Array<{ level: number; title: string; summary: string }>;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);

  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const outline: Array<{ level: number; title: string; summary: string }> = [];

  // Extract headings
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  let lastEnd = 0;

  while ((match = headingRegex.exec(text)) !== null) {
    const level = match[1].length;
    const title = match[2].trim();

    // Get content until next heading
    const nextMatch = headingRegex.exec(text);
    const contentEnd = nextMatch ? nextMatch.index : text.length;
    headingRegex.lastIndex = match.index + match[0].length; // Reset for next iteration

    const content = text.slice(match.index + match[0].length, contentEnd).trim();
    const summary = content.slice(0, 150) + (content.length > 150 ? '...' : '');

    outline.push({ level, title, summary });
  }

  // If no headings found, create outline from paragraphs
  if (outline.length === 0) {
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 50);
    for (let i = 0; i < Math.min(paragraphs.length, 10); i++) {
      const para = paragraphs[i].trim();
      const firstSentence = para.match(/^[^.!?]+[.!?]/)?.[0] ?? para.slice(0, 50);
      outline.push({
        level: 1,
        title: `Section ${i + 1}`,
        summary: firstSentence,
      });
    }
  }

  return { outline };
}

// ============================================================================
// Helper Functions
// ============================================================================

function splitIntoChunks(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += para + '\n\n';
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function splitIntoSentences(text: string): string[] {
  const regex = /[^.!?]+[.!?]+/g;
  const sentences: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const sentence = match[0].trim();
    if (sentence.length > 10) {
      sentences.push(sentence);
    }
  }

  return sentences;
}

async function summarizeChunk(text: string, style: string, maxLength: number): Promise<string> {
  // For now, use extractive summarization
  // In production, integrate with LLM
  
  const sentences = splitIntoSentences(text);
  const scored = scoreByTextRank(sentences, text);
  
  // Select sentences until we reach maxLength
  const selected: string[] = [];
  let totalLength = 0;
  
  for (const s of scored.sort((a, b) => b.score - a.score)) {
    if (totalLength + s.text.length > maxLength) break;
    selected.push(s.text);
    totalLength += s.text.length;
  }

  // Sort by original position
  selected.sort((a, b) => text.indexOf(a) - text.indexOf(b));

  return selected.join(' ');
}

function extractKeySentences(text: string, count: number): string[] {
  const sentences = splitIntoSentences(text);
  const scored = scoreByTextRank(sentences, text);
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((s) => s.text);
}

function formatAsBullets(text: string): string {
  const sentences = splitIntoSentences(text);
  return sentences.map((s) => `• ${s.trim()}`).join('\n');
}

function scoreByTextRank(
  sentences: string[],
  fullText: string
): Array<{ text: string; score: number; offset: number; index: number }> {
  // Simplified TextRank using word overlap
  const wordSets = sentences.map((s) => 
    new Set(s.toLowerCase().match(/\b\w{3,}\b/g) ?? [])
  );

  const scores = sentences.map((_, i) => {
    let score = 0;
    for (let j = 0; j < sentences.length; j++) {
      if (i !== j) {
    const intersection = new Set(Array.from(wordSets[i]).filter((w) => wordSets[j].has(w)));
    const union = new Set([...Array.from(wordSets[i]), ...Array.from(wordSets[j])]);
        score += intersection.size / Math.max(union.size, 1);
      }
    }
    return score;
  });

  return sentences.map((text, index) => ({
    text,
    score: scores[index],
    offset: fullText.indexOf(text),
    index,
  }));
}

function scoreByPosition(
  sentences: string[],
  fullText: string
): Array<{ text: string; score: number; offset: number; index: number }> {
  // First and last sentences get higher scores
  return sentences.map((text, index) => {
    let score = 0;
    if (index < 3) score = 1 - index * 0.2; // First sentences
    else if (index >= sentences.length - 2) score = 0.6; // Last sentences
    else score = 0.3; // Middle sentences

    return {
      text,
      score,
      offset: fullText.indexOf(text),
      index,
    };
  });
}

function scoreByTfIdf(
  sentences: string[],
  fullText: string
): Array<{ text: string; score: number; offset: number; index: number }> {
  // Calculate TF-IDF scores
  const allWords = fullText.toLowerCase().match(/\b\w{3,}\b/g) ?? [];
  const docFreq: Map<string, number> = new Map();
  const termFreq: Map<string, Map<string, number>> = new Map();

  // Calculate term frequencies per sentence
  for (let i = 0; i < sentences.length; i++) {
    const words = sentences[i].toLowerCase().match(/\b\w{3,}\b/g) ?? [];
    const tf: Map<string, number> = new Map();
    
    for (const word of words) {
      tf.set(word, (tf.get(word) ?? 0) + 1);
      docFreq.set(word, (docFreq.get(word) ?? 0) + 1);
    }
    
    termFreq.set(String(i), tf);
  }

  // Calculate scores
  return sentences.map((text, index) => {
    const tf = termFreq.get(String(index)) ?? new Map();
    let score = 0;

    tf.forEach((freq, word) => {
      const df = docFreq.get(word) ?? 1;
      const idf = Math.log(sentences.length / df);
      score += freq * idf;
    });

    return {
      text,
      score,
      offset: fullText.indexOf(text),
      index,
    };
  });
}
