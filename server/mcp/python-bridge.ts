/**
 * Python Bridge - Interface for Python NLP/ML tools
 * 
 * Supports two execution modes:
 * 1. Remote API (default for Manus hosting) - Calls salem-forge FastAPI server
 * 2. Local subprocess (for self-hosted) - Spawns Python processes directly
 * 
 * Set PYTHON_API_URL environment variable to use remote mode.
 * If not set, falls back to local subprocess, then JS fallbacks.
 */

import { spawn } from 'child_process';
import { join } from 'path';

const PYTHON_TOOLS_DIR = join(process.cwd(), 'server', 'python-tools');
const NLP_RUNNER = join(PYTHON_TOOLS_DIR, 'nlp_runner.py');

// Remote API configuration
const PYTHON_API_URL = process.env.PYTHON_API_URL || '';
const PYTHON_API_KEY = process.env.PYTHON_API_KEY || process.env.CLI_API_KEY || '';

interface PythonResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  method?: string;
}

// ============================================================================
// Remote API Execution (for Manus hosting)
// ============================================================================

/**
 * Execute Python command via remote API (salem-forge FastAPI)
 */
async function callPythonRemote(
  command: string,
  args: Record<string, unknown>,
  timeout = 30000
): Promise<PythonResult> {
  if (!PYTHON_API_URL) {
    return { success: false, error: 'PYTHON_API_URL not configured', method: 'remote_unavailable' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${PYTHON_API_URL}/python/${command}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PYTHON_API_KEY}`,
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `API error ${response.status}: ${errorText}`, method: 'remote' };
    }

    const data = await response.json();
    return { success: true, data, method: 'remote' };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Remote API timeout', method: 'remote' };
    }
    return { success: false, error: `Remote API error: ${error}`, method: 'remote' };
  }
}

// ============================================================================
// Local Subprocess Execution (for self-hosted deployments)
// ============================================================================

/**
 * Execute Python command via local subprocess
 * 
 * NOTE: This requires Python and all NLP packages to be installed locally.
 * On Manus hosting, use remote API instead (set PYTHON_API_URL).
 */
async function callPythonLocal(
  command: string,
  args: Record<string, unknown>,
  timeout = 30000
): Promise<PythonResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
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
            method: 'local',
          });
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse Python output: ${stdout}`,
            method: 'local',
          });
        }
      } else {
        resolve({
          success: false,
          error: stderr || `Python process exited with code ${code}`,
          method: 'local',
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: `Python not available: ${err.message}`,
        method: 'local_unavailable',
      });
    });
  });
}

// ============================================================================
// Main Entry Point - Auto-selects execution mode
// ============================================================================

/**
 * Execute a Python NLP command
 * 
 * Priority:
 * 1. Remote API (if PYTHON_API_URL is set)
 * 2. Local subprocess (if Python is available)
 * 3. JS fallback (always available)
 */
export async function callPython(
  command: string,
  args: Record<string, unknown>,
  timeout = 30000
): Promise<PythonResult> {
  // Try remote API first if configured
  if (PYTHON_API_URL) {
    const remoteResult = await callPythonRemote(command, args, timeout);
    if (remoteResult.success) {
      return remoteResult;
    }
    // Log remote failure but continue to fallback
    console.warn(`Remote Python API failed: ${remoteResult.error}, trying local...`);
  }

  // Try local subprocess
  const localResult = await callPythonLocal(command, args, timeout);
  if (localResult.success) {
    return localResult;
  }

  // Both failed, return the local error (JS fallback will be handled by caller)
  return localResult;
}

/**
 * Check if Python execution is available (remote or local)
 */
export async function checkPythonAvailability(): Promise<{
  available: boolean;
  mode: 'remote' | 'local' | 'none';
  version?: string;
  packages?: string[];
  error?: string;
}> {
  // Check remote first
  if (PYTHON_API_URL) {
    try {
      const response = await fetch(`${PYTHON_API_URL}/health`, {
        headers: { 'Authorization': `Bearer ${PYTHON_API_KEY}` },
      });
      if (response.ok) {
        return { available: true, mode: 'remote' };
      }
    } catch {
      // Remote not available, try local
    }
  }

  // Check local
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
          mode: 'local',
          version: stdout.trim(),
        });
      } else {
        resolve({
          available: false,
          mode: 'none',
          error: 'Python not found',
        });
      }
    });

    proc.on('error', () => {
      resolve({
        available: false,
        mode: 'none',
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
  
  // JS fallback: simple regex
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
 * Tokenize text
 */
export async function tokenize(text: string): Promise<{
  tokens: string[];
  count: number;
  method: string;
}> {
  const result = await callPython('tokenize', { text });
  
  if (result.success && result.data) {
    return result.data as { tokens: string[]; count: number; method: string };
  }
  
  // JS fallback: simple word tokenization
  const tokens = text.match(/\b\w+\b/g) || [];
  return { tokens, count: tokens.length, method: 'js_fallback' };
}

/**
 * Lemmatize text
 */
export async function lemmatize(text: string): Promise<{
  lemmas: Array<{ original: string; lemma: string }>;
  method: string;
}> {
  const result = await callPython('lemmatize', { text });
  
  if (result.success && result.data) {
    return result.data as {
      lemmas: Array<{ original: string; lemma: string }>;
      method: string;
    };
  }
  
  // JS fallback: no lemmatization, return original
  const words = text.match(/\b\w+\b/g) || [];
  return {
    lemmas: words.map(word => ({ original: word, lemma: word })),
    method: 'js_fallback',
  };
}
