import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { ContentStore } from './content-store';
import type { ContentRef } from '../../../shared/mcp-types';

describe('ContentStore', () => {
  const testBasePath = '/tmp/mcp-test-store-' + Date.now();
  let store: ContentStore;

  beforeEach(async () => {
    store = new ContentStore({ basePath: testBasePath });
    await store.init();
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('put and get', () => {
    it('should store and retrieve text content', async () => {
      const content = 'Hello, World!';
      const storedRef = await store.put(content, 'text/plain');

      expect(storedRef.ref).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(storedRef.size).toBe(Buffer.from(content).length);
      expect(storedRef.mime).toBe('text/plain');
      expect(storedRef.preview).toBe(content);

      const retrieved = await store.getString(storedRef.ref);
      expect(retrieved).toBe(content);
    });

    it('should deduplicate identical content', async () => {
      const content = 'Duplicate content';
      const ref1 = await store.put(content, 'text/plain');
      const ref2 = await store.put(content, 'text/plain');

      expect(ref1.ref).toBe(ref2.ref);
      expect(ref1.hash).toBe(ref2.hash);
    });

    it('should store and retrieve buffer content', async () => {
      const buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      const storedRef = await store.put(buffer, 'application/octet-stream');

      expect(storedRef.ref).toMatch(/^sha256:/);
      expect(storedRef.size).toBe(5);

      const retrieved = await store.get(storedRef.ref);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString()).toBe('Hello');
    });

    it('should return null for non-existent content', async () => {
      const fakeRef: ContentRef = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
      const result = await store.get(fakeRef);
      expect(result).toBeNull();
    });
  });

  describe('getPage', () => {
    it('should return paged content for large text', async () => {
      const content = 'A'.repeat(10000); // 10KB of 'A's
      const storedRef = await store.put(content, 'text/plain');

      const page1 = await store.getPage({
        ref: storedRef.ref,
        page: 1,
        pageSize: 1000,
      });

      expect(page1).not.toBeNull();
      expect(page1!.page).toBe(1);
      expect(page1!.totalPages).toBe(10);
      expect(page1!.content.length).toBe(1000);
      expect(page1!.hasMore).toBe(true);

      const page10 = await store.getPage({
        ref: storedRef.ref,
        page: 10,
        pageSize: 1000,
      });

      expect(page10).not.toBeNull();
      expect(page10!.page).toBe(10);
      expect(page10!.hasMore).toBe(false);
    });

    it('should handle single-page content', async () => {
      const content = 'Short content';
      const storedRef = await store.put(content, 'text/plain');

      const page = await store.getPage({
        ref: storedRef.ref,
        page: 1,
        pageSize: 4096,
      });

      expect(page).not.toBeNull();
      expect(page!.totalPages).toBe(1);
      expect(page!.content).toBe(content);
      expect(page!.hasMore).toBe(false);
    });
  });

  describe('getMeta', () => {
    it('should return metadata without loading content', async () => {
      const content = 'Test content for metadata';
      const storedRef = await store.put(content, 'text/plain');

      const meta = store.getMeta(storedRef.ref);

      expect(meta).not.toBeNull();
      expect(meta!.ref).toBe(storedRef.ref);
      expect(meta!.size).toBe(Buffer.from(content).length);
      expect(meta!.mime).toBe('text/plain');
    });

    it('should return null for non-existent ref', () => {
      const fakeRef: ContentRef = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
      const meta = store.getMeta(fakeRef);
      expect(meta).toBeNull();
    });
  });

  describe('preview generation', () => {
    it('should truncate long text previews', async () => {
      const content = 'X'.repeat(500);
      const storedRef = await store.put(content, 'text/plain');

      expect(storedRef.preview).toBeDefined();
      expect(storedRef.preview!.length).toBeLessThanOrEqual(203); // 200 + "..."
      expect(storedRef.preview!.endsWith('...')).toBe(true);
    });

    it('should not add ellipsis for short content', async () => {
      const content = 'Short';
      const storedRef = await store.put(content, 'text/plain');

      expect(storedRef.preview).toBe(content);
    });

    it('should generate preview for JSON content', async () => {
      const content = JSON.stringify({ key: 'value', nested: { a: 1 } });
      const storedRef = await store.put(content, 'application/json');

      expect(storedRef.preview).toBeDefined();
      expect(storedRef.preview).toContain('key');
    });
  });

  describe('content hash consistency', () => {
    it('should generate consistent hashes for same content', async () => {
      const content = 'Consistent content';
      
      const store1 = new ContentStore({ basePath: testBasePath + '-1' });
      await store1.init();
      
      const store2 = new ContentStore({ basePath: testBasePath + '-2' });
      await store2.init();

      const ref1 = await store1.put(content, 'text/plain');
      const ref2 = await store2.put(content, 'text/plain');

      expect(ref1.hash).toBe(ref2.hash);

      // Cleanup
      await fs.rm(testBasePath + '-1', { recursive: true, force: true });
      await fs.rm(testBasePath + '-2', { recursive: true, force: true });
    });
  });
});
