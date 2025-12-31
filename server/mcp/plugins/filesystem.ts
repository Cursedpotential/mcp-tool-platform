/**
 * Filesystem Plugin
 * 
 * Provides filesystem operations with:
 * - Directory listing with metadata
 * - File reading into content store
 * - Gated write operations (require approval)
 * - Glob pattern matching
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getContentStore } from '../store/content-store';
import type { ContentRef } from '../../../shared/mcp-types';

// Allowed root directories for sandboxed operations
const ALLOWED_ROOTS = new Set([
  process.env.SANDBOX_ROOT ?? '/tmp/mcp-sandbox',
  process.env.DATA_ROOT ?? './data',
]);

interface ListDirArgs {
  path: string;
  recursive?: boolean;
  glob?: string;
  maxDepth?: number;
}

interface ReadFileArgs {
  path: string;
  encoding?: BufferEncoding;
}

interface WriteFileArgs {
  path: string;
  contentRef: string;
  createDirs?: boolean;
}

interface GlobArgs {
  pattern: string;
  root: string;
}

interface StatArgs {
  path: string;
}

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modified: number;
  created: number;
}

/**
 * List directory contents with metadata
 */
export async function listDir(args: ListDirArgs): Promise<{
  entries: FileEntry[];
  totalSize: number;
  fileCount: number;
  dirCount: number;
}> {
  validatePath(args.path);

  const entries: FileEntry[] = [];
  let totalSize = 0;
  let fileCount = 0;
  let dirCount = 0;

  const maxDepth = args.maxDepth ?? (args.recursive ? 10 : 1);

  async function walkDir(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        // Apply glob filter if specified
        if (args.glob) {
          const pattern = args.glob.replace(/\*/g, '.*').replace(/\?/g, '.');
          if (!new RegExp(pattern).test(item.name)) {
            continue;
          }
        }

        try {
          const stat = await fs.stat(fullPath);
          const entry: FileEntry = {
            name: item.name,
            path: fullPath,
            type: item.isDirectory() ? 'directory' : item.isSymbolicLink() ? 'symlink' : 'file',
            size: stat.size,
            modified: stat.mtimeMs,
            created: stat.birthtimeMs,
          };

          entries.push(entry);

          if (item.isDirectory()) {
            dirCount++;
            if (args.recursive && depth < maxDepth) {
              await walkDir(fullPath, depth + 1);
            }
          } else {
            fileCount++;
            totalSize += stat.size;
          }
        } catch {
          // Skip files we can't stat
        }
      }
    } catch (error) {
      throw new Error(`Failed to read directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  await walkDir(args.path, 1);

  return {
    entries,
    totalSize,
    fileCount,
    dirCount,
  };
}

/**
 * Read file contents into content store
 */
export async function readFile(args: ReadFileArgs): Promise<{
  ref: ContentRef;
  size: number;
  mime: string;
}> {
  validatePath(args.path);

  const store = await getContentStore();
  const encoding = args.encoding ?? 'utf-8';

  try {
    const content = await fs.readFile(args.path, encoding);
    const mime = getMimeType(args.path);
    const stored = await store.put(content, mime);

    return {
      ref: stored.ref,
      size: stored.size,
      mime,
    };
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Write content to file (requires approval)
 * Returns approval ID instead of writing directly
 */
export async function writeFile(args: WriteFileArgs): Promise<{
  success: boolean;
  approvalId: string;
  preview: string;
}> {
  validatePath(args.path);

  const store = await getContentStore();
  const content = await store.getString(args.contentRef as ContentRef);

  if (!content) {
    throw new Error(`Content not found: ${args.contentRef}`);
  }

  // Generate approval request
  const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Store the pending write operation
  const pendingOp = {
    type: 'write',
    path: args.path,
    contentRef: args.contentRef,
    createDirs: args.createDirs,
    timestamp: Date.now(),
  };

  await store.put(JSON.stringify(pendingOp), 'application/json');

  return {
    success: false, // Not yet executed
    approvalId,
    preview: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
  };
}

/**
 * Execute approved write operation
 */
export async function executeApprovedWrite(approvalId: string, contentRef: string, targetPath: string, createDirs?: boolean): Promise<{
  success: boolean;
  bytesWritten: number;
}> {
  validatePath(targetPath);

  const store = await getContentStore();
  const content = await store.getString(contentRef as ContentRef);

  if (!content) {
    throw new Error(`Content not found: ${contentRef}`);
  }

  if (createDirs) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
  }

  await fs.writeFile(targetPath, content, 'utf-8');

  return {
    success: true,
    bytesWritten: Buffer.byteLength(content, 'utf-8'),
  };
}

/**
 * Match files using glob pattern
 */
export async function glob(args: GlobArgs): Promise<{
  files: string[];
  count: number;
}> {
  validatePath(args.root);

  const files: string[] = [];
  const pattern = args.pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
  const regex = new RegExp(pattern);

  async function walkDir(dir: string): Promise<void> {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          await walkDir(fullPath);
        } else if (regex.test(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await walkDir(args.root);

  return {
    files,
    count: files.length,
  };
}

/**
 * Get file statistics
 */
export async function stat(args: StatArgs): Promise<{
  exists: boolean;
  type?: 'file' | 'directory' | 'symlink';
  size?: number;
  modified?: number;
  created?: number;
  permissions?: string;
}> {
  validatePath(args.path);

  try {
    const stats = await fs.stat(args.path);
    return {
      exists: true,
      type: stats.isDirectory() ? 'directory' : stats.isSymbolicLink() ? 'symlink' : 'file',
      size: stats.size,
      modified: stats.mtimeMs,
      created: stats.birthtimeMs,
      permissions: stats.mode.toString(8).slice(-3),
    };
  } catch {
    return { exists: false };
  }
}

/**
 * Move file or directory (requires approval)
 */
export async function movePath(args: { source: string; destination: string }): Promise<{
  approvalId: string;
  preview: string;
}> {
  validatePath(args.source);
  validatePath(args.destination);

  const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    approvalId,
    preview: `Move ${args.source} → ${args.destination}`,
  };
}

/**
 * Delete file or directory (requires approval)
 */
export async function deletePath(args: { path: string; recursive?: boolean }): Promise<{
  approvalId: string;
  preview: string;
}> {
  validatePath(args.path);

  const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    approvalId,
    preview: `Delete ${args.path}${args.recursive ? ' (recursive)' : ''}`,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function validatePath(filePath: string): void {
  const resolved = path.resolve(filePath);

  // Check if path is within allowed roots
  let allowed = false;
  for (const root of Array.from(ALLOWED_ROOTS)) {
    const resolvedRoot = path.resolve(root);
    if (resolved.startsWith(resolvedRoot)) {
      allowed = true;
      break;
    }
  }

  // Also allow paths in current working directory
  const cwd = process.cwd();
  if (resolved.startsWith(cwd)) {
    allowed = true;
  }

  if (!allowed) {
    throw new Error(`Path not allowed: ${filePath}`);
  }

  // Prevent path traversal
  if (filePath.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.html': 'text/html',
    '.css': 'text/css',
    '.xml': 'application/xml',
    '.yaml': 'application/yaml',
    '.yml': 'application/yaml',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };

  return mimeTypes[ext] ?? 'application/octet-stream';
}
