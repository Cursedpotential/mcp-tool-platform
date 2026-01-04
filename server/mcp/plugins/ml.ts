/**
 * ML Plugin (Optional - Off by Default)
 * 
 * Provides machine learning capabilities:
 * - Embedding generation (local BERT or remote API)
 * - Semantic search over document corpus
 * - Text classification
 * - Uses Chroma as working memory for embeddings
 * 
 * Defaults to CPU; supports optional GPU remote runner.
 */

import { getContentStore } from '../store/content-store';
import type { ContentRef, EmbeddingResult } from '../../../shared/mcp-types';

// ============================================================================
// Configuration
// ============================================================================

interface MLConfig {
  enabled: boolean;
  embeddingProvider: 'local' | 'ollama' | 'openai' | 'gemini';
  embeddingModel: string;
  chromaPath: string;
  useGPU: boolean;
  remoteRunnerUrl?: string;
}

const defaultConfig: MLConfig = {
  enabled: false, // Off by default
  embeddingProvider: 'local',
  embeddingModel: 'all-MiniLM-L6-v2',
  chromaPath: './data/chroma',
  useGPU: false,
};

let config: MLConfig = { ...defaultConfig };

/**
 * Configure the ML plugin
 */
export function configureML(newConfig: Partial<MLConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Check if ML is enabled
 */
export function isMLEnabled(): boolean {
  return config.enabled;
}

// ============================================================================
// Embedding Storage (Chroma-like in-memory for now)
// ============================================================================

interface EmbeddingEntry {
  id: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  document?: string;
}

const embeddingStore: Map<string, EmbeddingEntry[]> = new Map();

// ============================================================================
// Public API
// ============================================================================

interface GenerateEmbeddingsArgs {
  textRef: string;
  model?: string;
  chunkSize?: number;
}

interface SemanticSearchArgs {
  query: string;
  scopeRefs?: string[];
  topK?: number;
  threshold?: number;
}

interface ClassifyArgs {
  textRef: string;
  labels: string[];
}

/**
 * Generate embeddings for text (stored server-side)
 */
export async function generateEmbeddings(args: GenerateEmbeddingsArgs): Promise<{
  embeddingIds: string[];
  dimensions: number;
  model: string;
  stored: boolean;
}> {
  if (!config.enabled) {
    throw new Error('ML plugin is disabled. Enable it in configuration.');
  }

  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);

  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const model = args.model ?? config.embeddingModel;
  const chunkSize = args.chunkSize ?? 512;

  // Split text into chunks
  const chunks = splitIntoChunks(text, chunkSize);

  // Generate embeddings for each chunk
  const embeddingIds: string[] = [];
  const entries: EmbeddingEntry[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateSingleEmbedding(chunks[i], model);
    const id = `emb-${args.textRef.slice(7, 15)}-${i}`;

    entries.push({
      id,
      embedding,
      metadata: {
        sourceRef: args.textRef,
        chunkIndex: i,
        model,
      },
      document: chunks[i],
    });

    embeddingIds.push(id);
  }

  // Store in embedding store
  const collectionKey = args.textRef;
  embeddingStore.set(collectionKey, entries);

  return {
    embeddingIds,
    dimensions: entries[0]?.embedding.length ?? 0,
    model,
    stored: true,
  };
}

/**
 * Semantic search over embedded documents
 */
export async function semanticSearch(args: SemanticSearchArgs): Promise<{
  results: Array<{
    id: string;
    score: number;
    document?: string;
    metadata: Record<string, unknown>;
  }>;
  resultsRef?: ContentRef;
}> {
  if (!config.enabled) {
    throw new Error('ML plugin is disabled. Enable it in configuration.');
  }

  const topK = args.topK ?? 10;
  const threshold = args.threshold ?? 0.5;

  // Generate query embedding
  const queryEmbedding = await generateSingleEmbedding(args.query, config.embeddingModel);

  // Collect all embeddings to search
  const candidates: Array<EmbeddingEntry & { collectionKey: string }> = [];

  if (args.scopeRefs && args.scopeRefs.length > 0) {
    for (const ref of args.scopeRefs) {
      const entries = embeddingStore.get(ref);
      if (entries) {
        candidates.push(...entries.map((e) => ({ ...e, collectionKey: ref })));
      }
    }
  } else {
    // Search all collections
    embeddingStore.forEach((entries, key) => {
      candidates.push(...entries.map((e) => ({ ...e, collectionKey: key })));
    });
  }

  // Calculate similarities
  const scored = candidates.map((entry) => ({
    ...entry,
    score: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  // Filter by threshold and sort
  const filtered = scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const results = filtered.map((r) => ({
    id: r.id,
    score: r.score,
    document: r.document?.slice(0, 200), // Preview only
    metadata: r.metadata,
  }));

  // Store large results as reference
  let resultsRef: ContentRef | undefined;
  if (results.length > 20) {
    const store = await getContentStore();
    const stored = await store.put(JSON.stringify(filtered), 'application/json');
    resultsRef = stored.ref;
  }

  return { results, resultsRef };
}

/**
 * Classify text into provided labels
 */
export async function classify(args: ClassifyArgs): Promise<{
  predictions: Array<{ label: string; probability: number }>;
  topLabel: string;
  confidence: number;
}> {
  if (!config.enabled) {
    throw new Error('ML plugin is disabled. Enable it in configuration.');
  }

  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);

  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  // Generate embedding for text
  const textEmbedding = await generateSingleEmbedding(text.slice(0, 1000), config.embeddingModel);

  // Generate embeddings for labels
  const labelEmbeddings = await Promise.all(
    args.labels.map(async (label) => ({
      label,
      embedding: await generateSingleEmbedding(label, config.embeddingModel),
    }))
  );

  // Calculate similarities
  const scores = labelEmbeddings.map((le) => ({
    label: le.label,
    score: cosineSimilarity(textEmbedding, le.embedding),
  }));

  // Normalize to probabilities using softmax
  const maxScore = Math.max(...scores.map((s) => s.score));
  const expScores = scores.map((s) => ({
    label: s.label,
    exp: Math.exp((s.score - maxScore) * 10), // Scale for better separation
  }));
  const sumExp = expScores.reduce((sum, s) => sum + s.exp, 0);

  const predictions = expScores
    .map((s) => ({
      label: s.label,
      probability: s.exp / sumExp,
    }))
    .sort((a, b) => b.probability - a.probability);

  return {
    predictions,
    topLabel: predictions[0]?.label ?? '',
    confidence: predictions[0]?.probability ?? 0,
  };
}

/**
 * Generate a single embedding vector for a raw text string
 */
export async function embedText(args: { text: string; model?: string }): Promise<number[]> {
  const model = args.model ?? config.embeddingModel;
  return generateSingleEmbedding(args.text, model);
}

/**
 * Clear embeddings for a document
 */
export async function clearEmbeddings(args: { textRef: string }): Promise<{ success: boolean }> {
  embeddingStore.delete(args.textRef);
  return { success: true };
}

/**
 * Get embedding statistics
 */
export async function getEmbeddingStats(): Promise<{
  collections: number;
  totalEmbeddings: number;
  dimensions: number;
}> {
  let totalEmbeddings = 0;
  let dimensions = 0;

  embeddingStore.forEach((entries) => {
    totalEmbeddings += entries.length;
    if (entries.length > 0 && entries[0].embedding) {
      dimensions = entries[0].embedding.length;
    }
  });

  return {
    collections: embeddingStore.size,
    totalEmbeddings,
    dimensions,
  };
}

// ============================================================================
// Embedding Generation
// ============================================================================

async function generateSingleEmbedding(text: string, model: string): Promise<number[]> {
  // For now, use a simple hash-based pseudo-embedding
  // In production, integrate with actual embedding models
  
  switch (config.embeddingProvider) {
    case 'local':
      return generateLocalEmbedding(text);
    case 'ollama':
      return generateOllamaEmbedding(text, model);
    case 'openai':
      return generateOpenAIEmbedding(text, model);
    case 'gemini':
      return generateGeminiEmbedding(text, model);
    default:
      return generateLocalEmbedding(text);
  }
}

/**
 * Local pseudo-embedding (for development/testing)
 * In production, use sentence-transformers or similar
 */
function generateLocalEmbedding(text: string): number[] {
  const dimensions = 384; // MiniLM dimension
  const embedding = new Array(dimensions).fill(0);

  // Simple hash-based embedding (NOT for production)
  const words = text.toLowerCase().match(/\b\w+\b/g) ?? [];
  
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash = hash & hash;
    }
    
    // Distribute hash across embedding dimensions
    for (let i = 0; i < dimensions; i++) {
      embedding[i] += Math.sin(hash * (i + 1)) * 0.01;
    }
  }

  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}

async function generateOllamaEmbedding(text: string, model: string): Promise<number[]> {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'nomic-embed-text',
        prompt: text,
      }),
    });

    if (!response.ok) {
      console.warn(`Ollama embedding failed (${response.status}), using local fallback`);
      return generateLocalEmbedding(text);
    }

    const data = await response.json() as { embedding: number[] };
    return data.embedding;
  } catch (error) {
    console.warn('Ollama embedding error, using local fallback:', error);
    return generateLocalEmbedding(text);
  }
}

async function generateOpenAIEmbedding(text: string, model: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OpenAI API key not set, using local fallback');
    return generateLocalEmbedding(text);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      console.warn(`OpenAI embedding failed (${response.status}), using local fallback`);
      return generateLocalEmbedding(text);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  } catch (error) {
    console.warn('OpenAI embedding error, using local fallback:', error);
    return generateLocalEmbedding(text);
  }
}

async function generateGeminiEmbedding(text: string, model: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('Google API key not set, using local fallback');
    return generateLocalEmbedding(text);
  }

  try {
    const embeddingModel = model || 'text-embedding-004';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${embeddingModel}`,
          content: { parts: [{ text }] },
        }),
      }
    );

    if (!response.ok) {
      console.warn(`Gemini embedding failed (${response.status}), using local fallback`);
      return generateLocalEmbedding(text);
    }

    const data = await response.json() as { embedding: { values: number[] } };
    return data.embedding.values;
  } catch (error) {
    console.warn('Gemini embedding error, using local fallback:', error);
    return generateLocalEmbedding(text);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const word of words) {
    if (currentSize + word.length + 1 > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(word);
    currentSize += word.length + 1;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
