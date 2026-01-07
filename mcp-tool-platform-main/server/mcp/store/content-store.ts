/**
 * Content-Addressed Object Store
 * 
 * Manages large artifacts (OCR text, markdown, chunks, search results) using
 * SHA-256 content hashes. Supports paging and reference-based retrieval for
 * maximum token efficiency.
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { ContentRef, StoredRef, PagedContent, PageRequest } from '../../../shared/mcp-types';

const DEFAULT_PAGE_SIZE = 4096; // 4KB pages for token efficiency
const PREVIEW_LENGTH = 200;

export interface ContentStoreConfig {
  basePath: string;
  maxFileSize?: number;
  enableCompression?: boolean;
}

export class ContentStore {
  private basePath: string;
  private maxFileSize: number;
  private indexPath: string;
  private index: Map<string, StoredRef> = new Map();

  constructor(config: ContentStoreConfig) {
    this.basePath = config.basePath;
    this.maxFileSize = config.maxFileSize ?? 100 * 1024 * 1024; // 100MB default
    this.indexPath = path.join(this.basePath, 'index.json');
  }

  /**
   * Initialize the content store, creating directories and loading index
   */
  async init(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.mkdir(path.join(this.basePath, 'objects'), { recursive: true });
    await this.loadIndex();
  }

  /**
   * Store content and return a content-addressed reference
   */
  async put(content: string | Buffer, mime: string): Promise<StoredRef> {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    
    if (buffer.length > this.maxFileSize) {
      throw new Error(`Content exceeds maximum file size of ${this.maxFileSize} bytes`);
    }

    const hash = this.computeHash(buffer);
    const ref: ContentRef = `sha256:${hash}`;

    // Check if already exists (deduplication)
    const existing = this.index.get(hash);
    if (existing) {
      return existing;
    }

    // Store the content
    const objectPath = this.getObjectPath(hash);
    await fs.mkdir(path.dirname(objectPath), { recursive: true });
    await fs.writeFile(objectPath, buffer);

    // Create preview for text content
    let preview: string | undefined;
    if (mime.startsWith('text/') || mime === 'application/json') {
      const text = buffer.toString('utf-8');
      preview = text.slice(0, PREVIEW_LENGTH);
      if (text.length > PREVIEW_LENGTH) {
        preview += '...';
      }
    }

    const storedRef: StoredRef = {
      ref,
      hash,
      size: buffer.length,
      mime,
      preview,
      createdAt: Date.now(),
    };

    // Update index
    this.index.set(hash, storedRef);
    await this.saveIndex();

    return storedRef;
  }

  /**
   * Get full content by reference
   */
  async get(ref: ContentRef): Promise<Buffer | null> {
    const hash = this.parseRef(ref);
    if (!this.index.has(hash)) {
      return null;
    }

    const objectPath = this.getObjectPath(hash);
    try {
      return await fs.readFile(objectPath);
    } catch {
      return null;
    }
  }

  /**
   * Get content as string
   */
  async getString(ref: ContentRef): Promise<string | null> {
    const buffer = await this.get(ref);
    return buffer ? buffer.toString('utf-8') : null;
  }

  /**
   * Get paged content for large artifacts (token-efficient retrieval)
   */
  async getPage(request: PageRequest): Promise<PagedContent | null> {
    const hash = this.parseRef(request.ref);
    const storedRef = this.index.get(hash);
    if (!storedRef) {
      return null;
    }

    const pageSize = request.pageSize ?? DEFAULT_PAGE_SIZE;
    const totalPages = Math.ceil(storedRef.size / pageSize);
    const page = Math.max(1, Math.min(request.page, totalPages));

    const buffer = await this.get(request.ref);
    if (!buffer) {
      return null;
    }

    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, buffer.length);
    const content = buffer.slice(start, end).toString('utf-8');

    return {
      ref: request.ref,
      page,
      totalPages,
      totalSize: storedRef.size,
      content,
      hasMore: page < totalPages,
    };
  }

  /**
   * Get metadata for a reference without loading content
   */
  getMeta(ref: ContentRef): StoredRef | null {
    const hash = this.parseRef(ref);
    return this.index.get(hash) ?? null;
  }

  /**
   * Check if content exists
   */
  has(ref: ContentRef): boolean {
    const hash = this.parseRef(ref);
    return this.index.has(hash);
  }

  /**
   * Delete content by reference
   */
  async delete(ref: ContentRef): Promise<boolean> {
    const hash = this.parseRef(ref);
    if (!this.index.has(hash)) {
      return false;
    }

    const objectPath = this.getObjectPath(hash);
    try {
      await fs.unlink(objectPath);
      this.index.delete(hash);
      await this.saveIndex();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all stored references
   */
  list(): StoredRef[] {
    return Array.from(this.index.values());
  }

  /**
   * Get total storage size
   */
  getTotalSize(): number {
    let total = 0;
    this.index.forEach((ref) => {
      total += ref.size;
    });
    return total;
  }

  /**
   * Compute content hash from existing content (for dedup checking)
   */
  computeContentHash(content: string | Buffer): string {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    return this.computeHash(buffer);
  }

  /**
   * Create a reference from a hash
   */
  createRef(hash: string): ContentRef {
    return `sha256:${hash}`;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private computeHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private parseRef(ref: ContentRef): string {
    if (!ref.startsWith('sha256:')) {
      throw new Error(`Invalid content reference: ${ref}`);
    }
    return ref.slice(7);
  }

  private getObjectPath(hash: string): string {
    // Use first 2 chars as directory prefix for better filesystem performance
    const prefix = hash.slice(0, 2);
    return path.join(this.basePath, 'objects', prefix, hash);
  }

  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      const entries: [string, StoredRef][] = JSON.parse(data);
      this.index = new Map(entries);
    } catch {
      this.index = new Map();
    }
  }

  private async saveIndex(): Promise<void> {
    const entries = Array.from(this.index.entries());
    await fs.writeFile(this.indexPath, JSON.stringify(entries, null, 2));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let contentStoreInstance: ContentStore | null = null;

export async function getContentStore(config?: ContentStoreConfig): Promise<ContentStore> {
  if (!contentStoreInstance) {
    const defaultConfig: ContentStoreConfig = {
      basePath: process.env.CONTENT_STORE_PATH ?? './data/content-store',
      maxFileSize: 100 * 1024 * 1024,
    };
    contentStoreInstance = new ContentStore(config ?? defaultConfig);
    await contentStoreInstance.init();
  }
  return contentStoreInstance;
}
