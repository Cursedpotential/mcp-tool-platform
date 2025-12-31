/**
 * Search Plugin
 * 
 * Integrates ripgrep and ugrep for fast regex search with JSON output.
 * Falls back to JavaScript-based search if binaries are unavailable.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { getContentStore } from '../store/content-store';
import type { SearchMatch, SearchResult, ContentRef } from '../../../shared/mcp-types';

const MAX_RESULTS_DEFAULT = 100;
const CONTEXT_LINES_DEFAULT = 2;

interface SearchArgs {
  root: string;
  query: string;
  glob?: string;
  include?: string;
  exclude?: string;
  maxResults?: number;
  contextLines?: number;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

interface RipgrepMatch {
  type: 'match' | 'begin' | 'end' | 'summary';
  data?: {
    path?: { text: string };
    lines?: { text: string };
    line_number?: number;
    absolute_offset?: number;
    submatches?: Array<{ match: { text: string }; start: number; end: number }>;
  };
}

/**
 * Search using ripgrep with JSON output
 */
export async function searchRipgrep(args: SearchArgs): Promise<SearchResult> {
  const startTime = Date.now();
  const maxResults = args.maxResults ?? MAX_RESULTS_DEFAULT;
  const contextLines = args.contextLines ?? CONTEXT_LINES_DEFAULT;

  // Build ripgrep command
  const rgArgs: string[] = [
    '--json',
    '--max-count', String(maxResults),
    '--context', String(contextLines),
  ];

  if (args.glob) {
    rgArgs.push('--glob', args.glob);
  }

  if (args.caseSensitive === false) {
    rgArgs.push('--ignore-case');
  }

  if (args.wholeWord) {
    rgArgs.push('--word-regexp');
  }

  if (args.regex === false) {
    rgArgs.push('--fixed-strings');
  }

  rgArgs.push(args.query, args.root);

  try {
    const output = await runCommand('rg', rgArgs);
    const matches = parseRipgrepOutput(output);

    const result: SearchResult = {
      query: args.query,
      engine: 'ripgrep',
      totalMatches: matches.length,
      files: new Set(matches.map((m) => m.file)).size,
      matches: matches.slice(0, maxResults),
      truncated: matches.length > maxResults,
      executionTimeMs: Date.now() - startTime,
    };

    // Store large results as reference
    if (matches.length > 50) {
      const store = await getContentStore();
      const stored = await store.put(JSON.stringify(matches), 'application/json');
      result.ref = stored.ref;
      result.matches = matches.slice(0, 10); // Return preview
    }

    return result;
  } catch (error) {
    // Fallback to JavaScript search if ripgrep not available
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return searchJavaScript(args);
    }
    throw error;
  }
}

/**
 * Search using ugrep with JSON output
 */
export async function searchUgrep(args: SearchArgs): Promise<SearchResult> {
  const startTime = Date.now();
  const maxResults = args.maxResults ?? MAX_RESULTS_DEFAULT;
  const contextLines = args.contextLines ?? CONTEXT_LINES_DEFAULT;

  // Build ugrep command
  const ugArgs: string[] = [
    '--json',
    '--max-count=' + String(maxResults),
    '--context=' + String(contextLines),
  ];

  if (args.include) {
    ugArgs.push('--include=' + args.include);
  }

  if (args.exclude) {
    ugArgs.push('--exclude=' + args.exclude);
  }

  if (args.caseSensitive === false) {
    ugArgs.push('--ignore-case');
  }

  if (args.wholeWord) {
    ugArgs.push('--word-regexp');
  }

  ugArgs.push(args.query, args.root);

  try {
    const output = await runCommand('ugrep', ugArgs);
    const matches = parseUgrepOutput(output);

    const result: SearchResult = {
      query: args.query,
      engine: 'ugrep',
      totalMatches: matches.length,
      files: new Set(matches.map((m) => m.file)).size,
      matches: matches.slice(0, maxResults),
      truncated: matches.length > maxResults,
      executionTimeMs: Date.now() - startTime,
    };

    // Store large results as reference
    if (matches.length > 50) {
      const store = await getContentStore();
      const stored = await store.put(JSON.stringify(matches), 'application/json');
      result.ref = stored.ref;
      result.matches = matches.slice(0, 10);
    }

    return result;
  } catch (error) {
    // Fallback to ripgrep or JavaScript
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return searchRipgrep(args);
    }
    throw error;
  }
}

/**
 * Smart search - chooses best available engine
 */
export async function searchSmart(args: SearchArgs): Promise<SearchResult> {
  // Try ripgrep first (fastest)
  try {
    return await searchRipgrep(args);
  } catch {
    // Try ugrep
    try {
      return await searchUgrep(args);
    } catch {
      // Fallback to JavaScript
      return searchJavaScript(args);
    }
  }
}

/**
 * JavaScript-based search fallback
 */
async function searchJavaScript(args: SearchArgs): Promise<SearchResult> {
  const startTime = Date.now();
  const maxResults = args.maxResults ?? MAX_RESULTS_DEFAULT;
  const matches: SearchMatch[] = [];

  const regex = args.regex !== false
    ? new RegExp(args.query, args.caseSensitive ? 'g' : 'gi')
    : null;

  const searchInFile = async (filePath: string): Promise<void> => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      let offset = 0;

      for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
        const line = lines[i];
        let found = false;

        if (regex) {
          const match = regex.exec(line);
          if (match) {
            found = true;
            matches.push({
              file: filePath,
              lineNumber: i + 1,
              column: match.index + 1,
              matchText: match[0],
              contextBefore: lines.slice(Math.max(0, i - 2), i).join('\n'),
              contextAfter: lines.slice(i + 1, i + 3).join('\n'),
              absoluteOffset: offset + match.index,
            });
          }
          regex.lastIndex = 0; // Reset for next line
        } else {
          const idx = args.caseSensitive
            ? line.indexOf(args.query)
            : line.toLowerCase().indexOf(args.query.toLowerCase());
          if (idx !== -1) {
            found = true;
            matches.push({
              file: filePath,
              lineNumber: i + 1,
              column: idx + 1,
              matchText: line.slice(idx, idx + args.query.length),
              contextBefore: lines.slice(Math.max(0, i - 2), i).join('\n'),
              contextAfter: lines.slice(i + 1, i + 3).join('\n'),
              absoluteOffset: offset + idx,
            });
          }
        }

        offset += line.length + 1; // +1 for newline
      }
    } catch {
      // Skip files that can't be read
    }
  };

  const walkDir = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (matches.length >= maxResults) break;

      const fullPath = path.join(dir, entry.name);

      // Skip hidden and common ignore patterns
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile()) {
        // Check glob pattern if specified
        if (args.glob) {
          const pattern = args.glob.replace(/\*/g, '.*');
          if (!new RegExp(pattern).test(entry.name)) {
            continue;
          }
        }
        await searchInFile(fullPath);
      }
    }
  };

  await walkDir(args.root);

  return {
    query: args.query,
    engine: 'js',
    totalMatches: matches.length,
    files: new Set(matches.map((m) => m.file)).size,
    matches,
    truncated: matches.length >= maxResults,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Run a command and return stdout
 */
function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 || code === 1) {
        // ripgrep returns 1 when no matches found
        resolve(stdout);
      } else {
        reject(new Error(`Command failed: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse ripgrep JSON output
 */
function parseRipgrepOutput(output: string): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lines = output.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const parsed: RipgrepMatch = JSON.parse(line);
      if (parsed.type === 'match' && parsed.data) {
        const data = parsed.data;
        matches.push({
          file: data.path?.text ?? '',
          lineNumber: data.line_number ?? 0,
          column: data.submatches?.[0]?.start ?? 0,
          matchText: data.submatches?.[0]?.match?.text ?? '',
          absoluteOffset: data.absolute_offset ?? 0,
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return matches;
}

/**
 * Parse ugrep JSON output (similar format to ripgrep)
 */
function parseUgrepOutput(output: string): SearchMatch[] {
  // ugrep JSON format is similar to ripgrep
  return parseRipgrepOutput(output);
}
