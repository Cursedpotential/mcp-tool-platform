/**
 * Text Miner Plugin - Fast forensic text search with smart engine routing
 * 
 * Auto-selects between ugrep and ripgrep based on content type:
 * - ugrep: conversations, JSON, CSV, forensic data, Unicode, fuzzy matching
 * - ripgrep: code, repositories, .gitignore-aware, binary handling
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

// Search engine types
type SearchEngine = 'ugrep' | 'ripgrep' | 'auto';

// Content type categories
type ContentType = 'code' | 'conversation' | 'document' | 'mixed' | 'unknown';

// Match result structure
interface SearchMatch {
  file: string;
  line: number;
  content: string;
  timestamp?: string;
  context?: string[];
}

interface SearchResult {
  searchTerm: string;
  searchTime: string;
  engine: string;
  totalMatches: number;
  filesWithMatches: number;
  matches: SearchMatch[];
  byFile: Record<string, SearchMatch[]>;
  timeline: Array<{
    timestamp: string;
    content: string;
    file: string;
    line: number;
  }>;
  error?: string;
}

interface MineOptions {
  recursive?: boolean;
  contextLines?: number;
  caseInsensitive?: boolean;
  wholeWord?: boolean;
  regexMode?: boolean;
  fileTypes?: string[];
  engine?: SearchEngine;
  maxResults?: number;
}

// Check if a search engine is available
async function checkEngine(engine: 'ugrep' | 'ripgrep'): Promise<boolean> {
  const cmd = engine === 'ugrep' ? 'ugrep --version' : 'rg --version';
  try {
    await execAsync(cmd, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Detect content type from file extensions
function detectContentType(paths: string[]): ContentType {
  const codeExtensions = new Set(['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.cs', '.rb', '.php', '.swift', '.kt']);
  const conversationExtensions = new Set(['.json', '.csv', '.tsv', '.txt', '.log', '.xml']);
  const documentExtensions = new Set(['.md', '.html', '.htm', '.pdf', '.docx', '.doc']);
  
  let codeCount = 0;
  let conversationCount = 0;
  let documentCount = 0;
  
  for (const p of paths) {
    const ext = path.extname(p).toLowerCase();
    if (codeExtensions.has(ext)) codeCount++;
    else if (conversationExtensions.has(ext)) conversationCount++;
    else if (documentExtensions.has(ext)) documentCount++;
  }
  
  const total = codeCount + conversationCount + documentCount;
  if (total === 0) return 'unknown';
  
  if (codeCount > conversationCount && codeCount > documentCount) return 'code';
  if (conversationCount > codeCount && conversationCount > documentCount) return 'conversation';
  if (documentCount > codeCount && documentCount > conversationCount) return 'document';
  return 'mixed';
}

// Check if path looks like a git repository
async function isGitRepo(searchPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(searchPath, '.git'));
    return true;
  } catch {
    return false;
  }
}

// Smart engine selection
async function selectEngine(
  paths: string[],
  preferredEngine: SearchEngine
): Promise<'ugrep' | 'ripgrep'> {
  const [ugrepAvailable, ripgrepAvailable] = await Promise.all([
    checkEngine('ugrep'),
    checkEngine('ripgrep')
  ]);
  
  // If user specified a preference and it's available, use it
  if (preferredEngine === 'ugrep' && ugrepAvailable) return 'ugrep';
  if (preferredEngine === 'ripgrep' && ripgrepAvailable) return 'ripgrep';
  
  // Auto-select based on content type
  if (preferredEngine === 'auto') {
    const contentType = detectContentType(paths);
    const isRepo = paths.length === 1 && await isGitRepo(paths[0]);
    
    // Prefer ripgrep for code and git repos
    if ((contentType === 'code' || isRepo) && ripgrepAvailable) {
      return 'ripgrep';
    }
    
    // Prefer ugrep for conversations and forensic data
    if ((contentType === 'conversation' || contentType === 'document') && ugrepAvailable) {
      return 'ugrep';
    }
  }
  
  // Fallback to whatever is available
  if (ugrepAvailable) return 'ugrep';
  if (ripgrepAvailable) return 'ripgrep';
  
  throw new Error('No search engine available. Install ugrep or ripgrep.');
}

// Extract timestamp from text content
function extractTimestamp(text: string): string | undefined {
  const patterns = [
    /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/,  // ISO format
    /(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})/,  // US format
    /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2})/,  // Alt format
    /"date":\s*"([^"]+)"/,  // JSON date field
    /"readable_date":\s*"([^"]+)"/,  // JSON readable_date
    /"readableDate":\s*"([^"]+)"/,  // camelCase variant
    /"timestamp":\s*"?(\d+)"?/,  // Unix timestamp
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

// Build ugrep command
function buildUgrepCommand(
  searchTerm: string,
  paths: string[],
  options: MineOptions
): string {
  const args = ['ugrep', '-n', `--color=never`];
  
  if (options.contextLines) args.push(`-C${options.contextLines}`);
  if (options.caseInsensitive !== false) args.push('-i');
  if (options.wholeWord) args.push('-w');
  if (options.recursive) args.push('-r');
  if (!options.regexMode) args.push('-F');  // Fixed string
  if (options.maxResults) args.push(`-m${options.maxResults}`);
  
  if (options.fileTypes?.length) {
    for (const ft of options.fileTypes) {
      args.push('--include', `*.${ft}`);
    }
  }
  
  args.push('--', searchTerm);
  args.push(...paths);
  
  return args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ');
}

// Build ripgrep command
function buildRipgrepCommand(
  searchTerm: string,
  paths: string[],
  options: MineOptions
): string {
  const args = ['rg', '-n', '--color=never', '--no-heading'];
  
  if (options.contextLines) args.push(`-C${options.contextLines}`);
  if (options.caseInsensitive !== false) args.push('-i');
  if (options.wholeWord) args.push('-w');
  if (!options.recursive) args.push('--max-depth=1');
  if (!options.regexMode) args.push('-F');  // Fixed string
  if (options.maxResults) args.push(`-m${options.maxResults}`);
  
  if (options.fileTypes?.length) {
    for (const ft of options.fileTypes) {
      args.push('-g', `*.${ft}`);
    }
  }
  
  args.push('--', searchTerm);
  args.push(...paths);
  
  return args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ');
}

// Parse search output (both engines use similar format)
function parseSearchOutput(output: string): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    if (!line.trim() || line === '--') continue;
    
    // Parse file:line:content or file:line-content (context)
    const match = line.match(/^(.+?):(\d+)[:-](.*)$/);
    if (match) {
      const [, file, lineNum, content] = match;
      matches.push({
        file,
        line: parseInt(lineNum, 10),
        content: content.trim(),
        timestamp: extractTimestamp(content)
      });
    }
  }
  
  return matches;
}

// Main mining function
export async function mineFiles(
  searchTerm: string,
  paths: string[],
  options: MineOptions = {}
): Promise<SearchResult> {
  const result: SearchResult = {
    searchTerm,
    searchTime: new Date().toISOString(),
    engine: 'unknown',
    totalMatches: 0,
    filesWithMatches: 0,
    matches: [],
    byFile: {},
    timeline: []
  };
  
  try {
    // Select engine
    const engine = await selectEngine(paths, options.engine || 'auto');
    result.engine = engine;
    
    // Build command
    const cmd = engine === 'ugrep'
      ? buildUgrepCommand(searchTerm, paths, options)
      : buildRipgrepCommand(searchTerm, paths, options);
    
    // Execute search
    const { stdout } = await execAsync(cmd, { 
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024  // 50MB buffer for large results
    });
    
    // Parse results
    const matches = parseSearchOutput(stdout);
    result.matches = matches;
    result.totalMatches = matches.length;
    
    // Group by file
    for (const match of matches) {
      if (!result.byFile[match.file]) {
        result.byFile[match.file] = [];
      }
      result.byFile[match.file].push(match);
    }
    result.filesWithMatches = Object.keys(result.byFile).length;
    
    // Build timeline from timestamped matches
    result.timeline = matches
      .filter(m => m.timestamp)
      .map(m => ({
        timestamp: m.timestamp!,
        content: m.content.slice(0, 100),
        file: path.basename(m.file),
        line: m.line
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    
  } catch (error: any) {
    // ripgrep/ugrep return exit code 1 for no matches, which is not an error
    if (error.code === 1 && !error.stderr) {
      // No matches found - not an error
    } else if (error.killed) {
      result.error = 'Search timed out (120s limit)';
    } else {
      result.error = error.message || String(error);
    }
  }
  
  return result;
}

// Generate markdown report
export function generateMarkdownReport(results: SearchResult): string {
  if (results.error) {
    return `# ❌ Error\n\n${results.error}`;
  }
  
  let report = `# 🔍 Text Mining Report

**Search Term:** \`${results.searchTerm}\`
**Search Time:** ${results.searchTime}
**Engine:** ${results.engine}
**Total Matches:** ${results.totalMatches}
**Files With Matches:** ${results.filesWithMatches}

---

## Summary

`;
  
  if (results.totalMatches === 0) {
    report += '*No matches found.*\n';
    return report;
  }
  
  report += `Found **${results.totalMatches}** instances of \`${results.searchTerm}\` across **${results.filesWithMatches}** files.\n\n`;
  
  // By file breakdown
  report += '## Matches by File\n\n';
  for (const [filePath, matches] of Object.entries(results.byFile).sort()) {
    report += `### 📄 ${path.basename(filePath)}\n`;
    report += `*Path: ${filePath}* | *${matches.length} matches*\n\n`;
    
    for (const m of matches.slice(0, 10)) {
      const ts = m.timestamp ? ` **[${m.timestamp}]**` : '';
      const content = m.content.replace(/`/g, "'").slice(0, 120);
      report += `- **Line ${m.line}**${ts}\n`;
      report += `  \`\`\`\n  ${content}\n  \`\`\`\n`;
    }
    
    if (matches.length > 10) {
      report += `\n*...and ${matches.length - 10} more matches in this file*\n`;
    }
    report += '\n';
  }
  
  // Timeline
  if (results.timeline.length > 0) {
    report += '## Timeline of Matches\n\n';
    report += '| Timestamp | Content | File | Line |\n';
    report += '|-----------|---------|------|------|\n';
    
    for (const item of results.timeline.slice(0, 30)) {
      const content = item.content.replace(/\|/g, '\\|').slice(0, 50);
      report += `| ${item.timestamp} | ${content}... | ${item.file} | ${item.line} |\n`;
    }
    
    if (results.timeline.length > 30) {
      report += `\n*...and ${results.timeline.length - 30} more timestamped matches*\n`;
    }
  }
  
  // Forensic summary
  report += `
---

## Forensic Summary

This report documents all instances where the search term appeared in the analyzed communications.
Each match includes:
- **File path** for chain of custody
- **Line number** for precise location
- **Timestamp** (when parseable) for timeline construction
- **Context** for understanding surrounding content

This data can be used to establish patterns of behavior for legal proceedings.

**Hash Algorithm:** SHA-256 (apply to source files for integrity)
**Generated:** ${new Date().toISOString()}
`;
  
  return report;
}

// Tool definitions for MCP registry
export const textMinerTools = [
  {
    name: 'search.text_mine',
    description: 'Fast forensic text search with smart engine routing (ugrep for conversations, ripgrep for code). Extracts timestamps and generates timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        searchTerm: { type: 'string', description: 'Text or regex pattern to search for' },
        paths: { type: 'array', items: { type: 'string' }, description: 'Files or directories to search' },
        recursive: { type: 'boolean', description: 'Search directories recursively', default: false },
        contextLines: { type: 'number', description: 'Lines of context before/after match', default: 2 },
        caseInsensitive: { type: 'boolean', description: 'Ignore case', default: true },
        wholeWord: { type: 'boolean', description: 'Match whole words only', default: false },
        regexMode: { type: 'boolean', description: 'Treat searchTerm as regex', default: false },
        fileTypes: { type: 'array', items: { type: 'string' }, description: 'File extensions to include' },
        engine: { type: 'string', enum: ['auto', 'ugrep', 'ripgrep'], description: 'Search engine preference', default: 'auto' },
        maxResults: { type: 'number', description: 'Maximum results per file' }
      },
      required: ['searchTerm', 'paths']
    },
    handler: async (params: any) => {
      const result = await mineFiles(params.searchTerm, params.paths, params);
      return result;
    }
  },
  {
    name: 'search.text_mine_report',
    description: 'Run text mining and generate a forensic markdown report',
    inputSchema: {
      type: 'object',
      properties: {
        searchTerm: { type: 'string', description: 'Text or regex pattern to search for' },
        paths: { type: 'array', items: { type: 'string' }, description: 'Files or directories to search' },
        recursive: { type: 'boolean', default: true },
        engine: { type: 'string', enum: ['auto', 'ugrep', 'ripgrep'], default: 'auto' }
      },
      required: ['searchTerm', 'paths']
    },
    handler: async (params: any) => {
      const result = await mineFiles(params.searchTerm, params.paths, params);
      const report = generateMarkdownReport(result);
      return { report, stats: { totalMatches: result.totalMatches, filesWithMatches: result.filesWithMatches } };
    }
  },
  {
    name: 'search.smart',
    description: 'Auto-select best search engine based on content type and execute search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        path: { type: 'string', description: 'Path to search' },
        type: { type: 'string', enum: ['code', 'conversation', 'document', 'auto'], default: 'auto' }
      },
      required: ['query', 'path']
    },
    handler: async (params: any) => {
      const engine = params.type === 'code' ? 'ripgrep' : 
                     params.type === 'conversation' ? 'ugrep' : 'auto';
      return mineFiles(params.query, [params.path], { recursive: true, engine: engine as SearchEngine });
    }
  }
];

export default textMinerTools;
