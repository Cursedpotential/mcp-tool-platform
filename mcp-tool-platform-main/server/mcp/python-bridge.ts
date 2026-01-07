/**
 * Python Bridge - Subprocess interface for Python NLP/ML tools
 * 
 * Calls Python scripts via child_process for heavy NLP operations.
 * Falls back to JS implementations if Python is unavailable.
 */

import { spawn } from 'child_process';
import { join } from 'path';

const PYTHON_TOOLS_DIR = join(process.cwd(), 'server', 'python-tools');
const NLP_RUNNER = join(PYTHON_TOOLS_DIR, 'nlp_runner.py');

interface PythonResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  method?: string;
}

/**
 * Execute a Python NLP command via subprocess
 */
export async function callPython(
  command: string,
  args: Record<string, unknown>,
  timeout = 30000
): Promise<PythonResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    // Try python3 first, then python
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const proc = spawn(pythonCmd, [NLP_RUNNER, command, JSON.stringify(args)], {
      cwd: PYTHON_TOOLS_DIR,
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const executionTime = Date.now() - startTime;
      
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve({
            success: true,
            data: { ...result, executionTimeMs: executionTime },
          });
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse Python output: ${stdout}`,
          });
        }
      } else {
        resolve({
          success: false,
          error: stderr || `Python process exited with code ${code}`,
        });
      }
    });

    proc.on('error', (err) => {
      // Python not available, will use JS fallback
      resolve({
        success: false,
        error: `Python not available: ${err.message}`,
        method: 'python_unavailable',
      });
    });
  });
}

/**
 * Check if Python and required packages are available
 */
export async function checkPythonAvailability(): Promise<{
  available: boolean;
  version?: string;
  packages?: string[];
  error?: string;
}> {
  return new Promise((resolve) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const proc = spawn(pythonCmd, ['--version'], {
      timeout: 5000,
    });

    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({
          available: true,
          version: stdout.trim(),
        });
      } else {
        resolve({
          available: false,
          error: 'Python not found',
        });
      }
    });

    proc.on('error', () => {
      resolve({
        available: false,
        error: 'Python not installed',
      });
    });
  });
}

// ============================================================================
// High-level NLP functions with JS fallbacks
// ============================================================================

/**
 * Detect language of text
 */
export async function detectLanguage(text: string): Promise<{
  language: string;
  confidence: number;
  method: string;
}> {
  const result = await callPython('detect_language', { text });
  
  if (result.success && result.data) {
    return result.data as { language: string; confidence: number; method: string };
  }
  
  // JS fallback: simple heuristic based on character sets
  const hasLatin = /[a-zA-Z]/.test(text);
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  const hasChinese = /[\u4E00-\u9FFF]/.test(text);
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  
  let language = 'en';
  if (hasCyrillic) language = 'ru';
  else if (hasChinese) language = 'zh';
  else if (hasArabic) language = 'ar';
  
  return { language, confidence: 0.5, method: 'js_fallback' };
}

/**
 * Extract named entities from text
 */
export async function extractEntities(
  text: string,
  types?: string[]
): Promise<{
  entities: Array<{
    text: string;
    type: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  method: string;
}> {
  const result = await callPython('extract_entities', { text, types });
  
  if (result.success && result.data) {
    return result.data as {
      entities: Array<{ text: string; type: string; start: number; end: number; confidence: number }>;
      method: string;
    };
  }
  
  // JS fallback: simple regex patterns
  const entities: Array<{ text: string; type: string; start: number; end: number; confidence: number }> = [];
  
  // Email pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: 'EMAIL',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.9,
    });
  }
  
  // URL pattern
  const urlRegex = /https?:\/\/[^\s]+/g;
  while ((match = urlRegex.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: 'URL',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.9,
    });
  }
  
  // Date patterns (simple)
  const dateRegex = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;
  while ((match = dateRegex.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: 'DATE',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.7,
    });
  }
  
  // Money patterns
  const moneyRegex = /\$[\d,]+(?:\.\d{2})?/g;
  while ((match = moneyRegex.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: 'MONEY',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.8,
    });
  }
  
  return { entities, method: 'js_fallback' };
}

/**
 * Extract keywords from text
 */
export async function extractKeywords(
  text: string,
  topK = 10
): Promise<{
  keywords: Array<{ keyword: string; score: number; frequency: number }>;
  method: string;
}> {
  const result = await callPython('extract_keywords', { text, topK });
  
  if (result.success && result.data) {
    return result.data as {
      keywords: Array<{ keyword: string; score: number; frequency: number }>;
      method: string;
    };
  }
  
  // JS fallback: word frequency
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
    'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also',
  ]);
  
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq: Record<string, number> = {};
  
  for (const word of words) {
    if (!stopWords.has(word)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }
  
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);
  
  const maxFreq = sorted[0]?.[1] || 1;
  
  return {
    keywords: sorted.map(([keyword, frequency]) => ({
      keyword,
      score: frequency / maxFreq,
      frequency,
    })),
    method: 'js_fallback',
  };
}

/**
 * Analyze sentiment of text
 */
export async function analyzeSentiment(text: string): Promise<{
  label: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  method: string;
}> {
  const result = await callPython('analyze_sentiment', { text });
  
  if (result.success && result.data) {
    return result.data as {
      label: 'positive' | 'negative' | 'neutral';
      score: number;
      confidence: number;
      method: string;
    };
  }
  
  // JS fallback: lexicon-based
  const positiveWords = new Set([
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
    'love', 'happy', 'best', 'perfect', 'beautiful', 'awesome', 'brilliant',
    'outstanding', 'superb', 'terrific', 'fabulous', 'marvelous',
  ]);
  
  const negativeWords = new Set([
    'bad', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'poor',
    'disappointing', 'sad', 'angry', 'ugly', 'boring', 'dreadful',
    'disgusting', 'pathetic', 'miserable', 'annoying',
  ]);
  
  const words = text.toLowerCase().split(/\s+/);
  let posCount = 0;
  let negCount = 0;
  
  for (const word of words) {
    if (positiveWords.has(word)) posCount++;
    if (negativeWords.has(word)) negCount++;
  }
  
  const total = posCount + negCount;
  const score = total === 0 ? 0 : (posCount - negCount) / total;
  
  let label: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 0.2) label = 'positive';
  else if (score < -0.2) label = 'negative';
  
  return {
    label,
    score,
    confidence: Math.min(0.5 + Math.abs(score) * 0.5, 1.0),
    method: 'js_fallback',
  };
}

/**
 * Split text into sentences
 */
export async function splitSentences(text: string): Promise<{
  sentences: Array<{ text: string; start: number; end: number; index: number }>;
  count: number;
  method: string;
}> {
  const result = await callPython('split_sentences', { text });
  
  if (result.success && result.data) {
    return result.data as {
      sentences: Array<{ text: string; start: number; end: number; index: number }>;
      count: number;
      method: string;
    };
  }
  
  // JS fallback: regex-based
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const sentences: Array<{ text: string; start: number; end: number; index: number }> = [];
  
  let match;
  let index = 0;
  while ((match = sentenceRegex.exec(text)) !== null) {
    sentences.push({
      text: match[0].trim(),
      start: match.index,
      end: match.index + match[0].length,
      index: index++,
    });
  }
  
  return { sentences, count: sentences.length, method: 'js_fallback' };
}

/**
 * Generate embeddings for text
 */
export async function embedText(
  texts: string[]
): Promise<{
  embeddings: number[][];
  model: string;
  dimensions: number;
  method: string;
}> {
  const result = await callPython('embed_text', { texts });
  
  if (result.success && result.data) {
    return {
      ...(result.data as { embeddings: number[][]; model: string; dimensions: number }),
      method: 'python',
    };
  }
  
  // JS fallback: simple bag-of-words hash (not real embeddings)
  const dimensions = 384;
  const embeddings = texts.map((text) => {
    const words = text.toLowerCase().split(/\s+/);
    const vec = new Array(dimensions).fill(0);
    
    for (const word of words) {
      // Simple hash to distribute words across dimensions
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
      const idx = Math.abs(hash) % dimensions;
      vec[idx] += 1;
    }
    
    // Normalize
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  });
  
  return {
    embeddings,
    model: 'js_bow_hash',
    dimensions,
    method: 'js_fallback',
  };
}

/**
 * Generate document outline
 */
export async function generateOutline(
  text: string,
  maxDepth = 3
): Promise<{
  outline: Array<{ level: number; title: string; line: number }>;
  depth: number;
  sections: number;
  method: string;
}> {
  const result = await callPython('generate_outline', { text, maxDepth });
  
  if (result.success && result.data) {
    return result.data as {
      outline: Array<{ level: number; title: string; line: number }>;
      depth: number;
      sections: number;
      method: string;
    };
  }
  
  // JS fallback
  const lines = text.split('\n');
  const outline: Array<{ level: number; title: string; line: number }> = [];
  
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Markdown headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      if (level <= maxDepth) {
        outline.push({ level, title: headingMatch[2], line: i + 1 });
      }
      return;
    }
    
    // All caps lines (likely headings)
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /[A-Z]/.test(trimmed)) {
      outline.push({ level: 1, title: trimmed, line: i + 1 });
    }
  });
  
  return { outline, depth: maxDepth, sections: outline.length, method: 'js_fallback' };
}
