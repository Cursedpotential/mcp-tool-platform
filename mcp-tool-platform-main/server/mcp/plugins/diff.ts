/**
 * Diff Plugin
 * 
 * Provides text comparison and merge capabilities:
 * - Text diff with unified/JSON/inline formats
 * - Similarity analysis
 * - Merge proposals with conflict detection
 * - Patch generation and application
 */

import { getContentStore } from '../store/content-store';
import type { ContentRef } from '../../../shared/mcp-types';

interface DiffTextArgs {
  refA: string;
  refB: string;
  format?: 'unified' | 'json' | 'inline';
  contextLines?: number;
}

interface SimilarityArgs {
  refA: string;
  refB: string;
  method?: 'levenshtein' | 'jaccard' | 'cosine';
}

interface MergeProposeArgs {
  baseRef: string;
  oursRef: string;
  theirsRef: string;
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: Array<{
    type: 'context' | 'add' | 'remove';
    content: string;
    oldLineNo?: number;
    newLineNo?: number;
  }>;
}

interface DiffResult {
  diffRef?: ContentRef;
  additions: number;
  deletions: number;
  similarity: number;
  hunks?: DiffHunk[];
  unified?: string;
}

/**
 * Compute diff between two text contents
 */
export async function diffText(args: DiffTextArgs): Promise<DiffResult> {
  const store = await getContentStore();
  const textA = await store.getString(args.refA as ContentRef);
  const textB = await store.getString(args.refB as ContentRef);

  if (!textA) {
    throw new Error(`Content not found: ${args.refA}`);
  }
  if (!textB) {
    throw new Error(`Content not found: ${args.refB}`);
  }

  const format = args.format ?? 'unified';
  const contextLines = args.contextLines ?? 3;

  const linesA = textA.split('\n');
  const linesB = textB.split('\n');

  // Compute LCS-based diff
  const diff = computeDiff(linesA, linesB);

  // Generate hunks
  const hunks = generateHunks(diff, linesA, linesB, contextLines);

  // Count additions and deletions
  let additions = 0;
  let deletions = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') additions++;
      if (line.type === 'remove') deletions++;
    }
  }

  // Calculate similarity
  const similarity = 1 - (additions + deletions) / Math.max(linesA.length + linesB.length, 1);

  const result: DiffResult = {
    additions,
    deletions,
    similarity,
  };

  if (format === 'unified') {
    result.unified = generateUnifiedDiff(hunks, 'a', 'b');
    
    // Store large diffs as reference
    if (result.unified.length > 4096) {
      const stored = await store.put(result.unified, 'text/plain');
      result.diffRef = stored.ref;
      result.unified = result.unified.slice(0, 1000) + '\n... (truncated)';
    }
  } else if (format === 'json') {
    result.hunks = hunks;
    
    // Store large diffs as reference
    if (hunks.length > 20) {
      const stored = await store.put(JSON.stringify(hunks), 'application/json');
      result.diffRef = stored.ref;
      result.hunks = hunks.slice(0, 5);
    }
  }

  return result;
}

/**
 * Calculate similarity between two texts
 */
export async function similarity(args: SimilarityArgs): Promise<{
  similarity: number;
  method: string;
  details: Record<string, number>;
}> {
  const store = await getContentStore();
  const textA = await store.getString(args.refA as ContentRef);
  const textB = await store.getString(args.refB as ContentRef);

  if (!textA) {
    throw new Error(`Content not found: ${args.refA}`);
  }
  if (!textB) {
    throw new Error(`Content not found: ${args.refB}`);
  }

  const method = args.method ?? 'jaccard';
  let similarity: number;
  const details: Record<string, number> = {};

  switch (method) {
    case 'levenshtein':
      const distance = levenshteinDistance(textA, textB);
      const maxLen = Math.max(textA.length, textB.length);
      similarity = 1 - distance / maxLen;
      details.distance = distance;
      details.maxLength = maxLen;
      break;

    case 'jaccard':
      const wordsA = new Set(textA.toLowerCase().match(/\b\w+\b/g) ?? []);
      const wordsB = new Set(textB.toLowerCase().match(/\b\w+\b/g) ?? []);
      const intersection = new Set(Array.from(wordsA).filter((x) => wordsB.has(x)));
      const union = new Set([...Array.from(wordsA), ...Array.from(wordsB)]);
      similarity = intersection.size / union.size;
      details.intersectionSize = intersection.size;
      details.unionSize = union.size;
      break;

    case 'cosine':
      similarity = cosineSimilarity(textA, textB);
      break;

    default:
      throw new Error(`Unknown similarity method: ${method}`);
  }

  return {
    similarity,
    method,
    details,
  };
}

/**
 * Propose a merge between three versions
 */
export async function mergePropose(args: MergeProposeArgs): Promise<{
  mergedRef: ContentRef;
  conflicts: Array<{
    startLine: number;
    endLine: number;
    ours: string;
    theirs: string;
    base: string;
  }>;
  hasConflicts: boolean;
  approvalId: string;
}> {
  const store = await getContentStore();
  const base = await store.getString(args.baseRef as ContentRef);
  const ours = await store.getString(args.oursRef as ContentRef);
  const theirs = await store.getString(args.theirsRef as ContentRef);

  if (!base || !ours || !theirs) {
    throw new Error('One or more content references not found');
  }

  const baseLines = base.split('\n');
  const ourLines = ours.split('\n');
  const theirLines = theirs.split('\n');

  // Simple three-way merge
  const { merged, conflicts } = threeWayMerge(baseLines, ourLines, theirLines);

  // Store merged result
  const mergedText = merged.join('\n');
  const stored = await store.put(mergedText, 'text/plain');

  const approvalId = `merge-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    mergedRef: stored.ref,
    conflicts,
    hasConflicts: conflicts.length > 0,
    approvalId,
  };
}

/**
 * Generate a patch from diff
 */
export async function generatePatch(args: { refA: string; refB: string }): Promise<{
  patchRef: ContentRef;
  size: number;
}> {
  const diffResult = await diffText({
    refA: args.refA,
    refB: args.refB,
    format: 'unified',
    contextLines: 3,
  });

  const store = await getContentStore();
  const patch = diffResult.unified ?? '';
  const stored = await store.put(patch, 'text/x-patch');

  return {
    patchRef: stored.ref,
    size: patch.length,
  };
}

// ============================================================================
// Diff Algorithm Implementation
// ============================================================================

interface DiffOp {
  type: 'equal' | 'insert' | 'delete';
  oldIdx: number;
  newIdx: number;
  line?: string;
}

function computeDiff(linesA: string[], linesB: string[]): DiffOp[] {
  // Myers diff algorithm (simplified)
  const n = linesA.length;
  const m = linesB.length;
  const max = n + m;

  const v: Map<number, number> = new Map();
  v.set(1, 0);

  const trace: Array<Map<number, number>> = [];

  for (let d = 0; d <= max; d++) {
    trace.push(new Map(v));

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0))) {
        x = v.get(k + 1) ?? 0;
      } else {
        x = (v.get(k - 1) ?? 0) + 1;
      }

      let y = x - k;

      while (x < n && y < m && linesA[x] === linesB[y]) {
        x++;
        y++;
      }

      v.set(k, x);

      if (x >= n && y >= m) {
        return backtrack(trace, linesA, linesB, d);
      }
    }
  }

  return [];
}

function backtrack(trace: Array<Map<number, number>>, linesA: string[], linesB: string[], d: number): DiffOp[] {
  const ops: DiffOp[] = [];
  let x = linesA.length;
  let y = linesB.length;

  for (let i = d; i > 0; i--) {
    const v = trace[i - 1];
    const k = x - y;

    let prevK: number;
    if (k === -i || (k !== i && (v.get(k - 1) ?? 0) < (v.get(k + 1) ?? 0))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }

    const prevX = v.get(prevK) ?? 0;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.unshift({ type: 'equal', oldIdx: x, newIdx: y, line: linesA[x] });
    }

    if (i > 0) {
      if (x === prevX) {
        ops.unshift({ type: 'insert', oldIdx: x, newIdx: y - 1, line: linesB[y - 1] });
        y--;
      } else {
        ops.unshift({ type: 'delete', oldIdx: x - 1, newIdx: y, line: linesA[x - 1] });
        x--;
      }
    }
  }

  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.unshift({ type: 'equal', oldIdx: x, newIdx: y, line: linesA[x] });
  }

  return ops;
}

function generateHunks(ops: DiffOp[], linesA: string[], linesB: string[], contextLines: number): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let contextBuffer: DiffOp[] = [];

  for (const op of ops) {
    if (op.type === 'equal') {
      if (currentHunk) {
        currentHunk.lines.push({
          type: 'context',
          content: op.line ?? '',
          oldLineNo: op.oldIdx + 1,
          newLineNo: op.newIdx + 1,
        });

        // Check if we should close the hunk
        const lastNonContext = currentHunk.lines.slice().reverse().findIndex((l) => l.type !== 'context');
        if (lastNonContext >= contextLines) {
          // Trim trailing context
          currentHunk.lines = currentHunk.lines.slice(0, currentHunk.lines.length - lastNonContext + contextLines);
          hunks.push(currentHunk);
          currentHunk = null;
          contextBuffer = [];
        }
      } else {
        contextBuffer.push(op);
        if (contextBuffer.length > contextLines) {
          contextBuffer.shift();
        }
      }
    } else {
      if (!currentHunk) {
        currentHunk = {
          oldStart: Math.max(1, (contextBuffer[0]?.oldIdx ?? op.oldIdx) + 1),
          oldLines: 0,
          newStart: Math.max(1, (contextBuffer[0]?.newIdx ?? op.newIdx) + 1),
          newLines: 0,
          lines: [],
        };

        // Add leading context
        for (const ctx of contextBuffer) {
          currentHunk.lines.push({
            type: 'context',
            content: ctx.line ?? '',
            oldLineNo: ctx.oldIdx + 1,
            newLineNo: ctx.newIdx + 1,
          });
        }
        contextBuffer = [];
      }

      currentHunk.lines.push({
        type: op.type === 'insert' ? 'add' : 'remove',
        content: op.line ?? '',
        oldLineNo: op.type === 'delete' ? op.oldIdx + 1 : undefined,
        newLineNo: op.type === 'insert' ? op.newIdx + 1 : undefined,
      });
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  // Update line counts
  for (const hunk of hunks) {
    hunk.oldLines = hunk.lines.filter((l) => l.type !== 'add').length;
    hunk.newLines = hunk.lines.filter((l) => l.type !== 'remove').length;
  }

  return hunks;
}

function generateUnifiedDiff(hunks: DiffHunk[], fileA: string, fileB: string): string {
  const lines: string[] = [
    `--- ${fileA}`,
    `+++ ${fileB}`,
  ];

  for (const hunk of hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
    for (const line of hunk.lines) {
      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
      lines.push(prefix + line.content);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Similarity Algorithms
// ============================================================================

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows instead of full matrix for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

function cosineSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().match(/\b\w+\b/g) ?? [];
  const wordsB = b.toLowerCase().match(/\b\w+\b/g) ?? [];

  const freqA: Map<string, number> = new Map();
  const freqB: Map<string, number> = new Map();

  for (const word of wordsA) {
    freqA.set(word, (freqA.get(word) ?? 0) + 1);
  }
  for (const word of wordsB) {
    freqB.set(word, (freqB.get(word) ?? 0) + 1);
  }

  const allWords = new Set([...Array.from(freqA.keys()), ...Array.from(freqB.keys())]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const word of Array.from(allWords)) {
    const a = freqA.get(word) ?? 0;
    const b = freqB.get(word) ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// Three-Way Merge
// ============================================================================

function threeWayMerge(
  base: string[],
  ours: string[],
  theirs: string[]
): {
  merged: string[];
  conflicts: Array<{ startLine: number; endLine: number; ours: string; theirs: string; base: string }>;
} {
  const merged: string[] = [];
  const conflicts: Array<{ startLine: number; endLine: number; ours: string; theirs: string; base: string }> = [];

  // Simple line-by-line merge
  const maxLen = Math.max(base.length, ours.length, theirs.length);

  for (let i = 0; i < maxLen; i++) {
    const baseLine = base[i] ?? '';
    const ourLine = ours[i] ?? '';
    const theirLine = theirs[i] ?? '';

    if (ourLine === theirLine) {
      // Both made same change or no change
      merged.push(ourLine);
    } else if (ourLine === baseLine) {
      // We didn't change, take theirs
      merged.push(theirLine);
    } else if (theirLine === baseLine) {
      // They didn't change, take ours
      merged.push(ourLine);
    } else {
      // Conflict
      conflicts.push({
        startLine: merged.length + 1,
        endLine: merged.length + 1,
        ours: ourLine,
        theirs: theirLine,
        base: baseLine,
      });
      merged.push(`<<<<<<< OURS`);
      merged.push(ourLine);
      merged.push(`=======`);
      merged.push(theirLine);
      merged.push(`>>>>>>> THEIRS`);
    }
  }

  return { merged, conflicts };
}
