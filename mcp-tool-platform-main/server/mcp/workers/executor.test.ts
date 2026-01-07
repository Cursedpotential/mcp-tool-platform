/**
 * Executor Plugin Handler Tests
 * 
 * Tests for the newly wired plugin handlers:
 * - forensics.analyze_patterns
 * - forensics.score_severity
 * - forensics.get_modules
 * - forensics.detect_hurtlex
 * - text.mine
 * - format.convert
 * - format.parse
 * - schema.resolve
 * - schema.apply
 * - evidence.hash_file
 * - evidence.hash_content
 * - evidence.create_chain
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getTaskExecutor, TaskExecutor } from './executor';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Executor Plugin Handlers', () => {
  let executor: TaskExecutor;
  let testDir: string;
  let testFilePath: string;

  beforeAll(async () => {
    executor = await getTaskExecutor();
    
    // Create a temp directory for test files
    testDir = path.join(os.tmpdir(), `executor-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a test file
    testFilePath = path.join(testDir, 'test-document.txt');
    await fs.writeFile(testFilePath, 'This is a test document for analysis. It contains some text that can be searched and analyzed.');
  });

  describe('Forensics Plugin Handlers', () => {
    it('should execute forensics.analyze_patterns', async () => {
      const result = await executor.execute({
        toolName: 'forensics.analyze_patterns',
        args: {
          text: 'I love you so much, you are the best thing that ever happened to me. But sometimes you make me so angry.',
          includeContext: true,
          contextChars: 50
        },
        traceId: 'test-trace-1',
        options: { timeout: 10000 }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data).toHaveProperty('documentId');
        expect(data).toHaveProperty('totalMatches');
        expect(data).toHaveProperty('severityScore');
      }
    });

    it('should execute forensics.score_severity', async () => {
      const result = await executor.execute({
        toolName: 'forensics.score_severity',
        args: {
          text: 'You are worthless. Nobody else would ever want you. You should be grateful I put up with you.'
        },
        traceId: 'test-trace-2',
        options: { timeout: 10000 }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data).toHaveProperty('severityScore');
        expect(data).toHaveProperty('totalMatches');
        expect(data).toHaveProperty('summary');
      }
    });

    it('should execute forensics.get_modules', async () => {
      const result = await executor.execute({
        toolName: 'forensics.get_modules',
        args: {},
        traceId: 'test-trace-3',
        options: { timeout: 5000 }
      });

      expect(result.success).toBe(true);
      // Result might be in data or stored as ref for large results
      const hasData = result.data !== undefined || result.ref !== undefined;
      expect(hasData).toBe(true);
      if (result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data).toHaveProperty('modules');
        expect(data).toHaveProperty('activeModules');
        expect(Array.isArray(data.modules)).toBe(true);
      }
    });
  });

  describe('Evidence Hasher Plugin Handlers', () => {
    it('should execute evidence.hash_content', async () => {
      const result = await executor.execute({
        toolName: 'evidence.hash_content',
        args: {
          content: 'Test content for hashing'
        },
        traceId: 'test-trace-4',
        options: { timeout: 5000 }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data).toHaveProperty('hash');
        expect(data).toHaveProperty('algorithm');
        expect(data.algorithm).toBe('sha256');
        expect(typeof data.hash).toBe('string');
        expect((data.hash as string).length).toBe(64); // SHA-256 hex length
      }
    });

    it('should execute evidence.hash_file', async () => {
      const result = await executor.execute({
        toolName: 'evidence.hash_file',
        args: {
          filePath: testFilePath
        },
        traceId: 'test-trace-5',
        options: { timeout: 5000 }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data).toHaveProperty('hash');
        expect(data).toHaveProperty('algorithm');
        expect(data).toHaveProperty('fileSize');
        expect(data).toHaveProperty('filename');
        expect(data.algorithm).toBe('sha256');
      }
    });

    it('should execute evidence.hash (alias)', async () => {
      const result = await executor.execute({
        toolName: 'evidence.hash',
        args: {
          content: 'Test content'
        },
        traceId: 'test-trace-6',
        options: { timeout: 5000 }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data).toHaveProperty('hash');
        expect(data.type).toBe('content');
      }
    });
  });

  describe('Schema Resolver Plugin Handlers', () => {
    it('should execute schema.resolve', async () => {
      const result = await executor.execute({
        toolName: 'schema.resolve',
        args: {
          sourceFields: ['first_name', 'last_name', 'email_address', 'phone_number'],
          sample: [
            { first_name: 'John', last_name: 'Doe', email_address: 'john@example.com', phone_number: '555-1234' }
          ],
          useCache: false,
          useAi: false
        },
        traceId: 'test-trace-7',
        options: { timeout: 10000 }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data).toHaveProperty('mappings');
        expect(Array.isArray(data.mappings)).toBe(true);
      }
    });

    it('should execute schema.cache_stats', async () => {
      const result = await executor.execute({
        toolName: 'schema.cache_stats',
        args: {},
        traceId: 'test-trace-8',
        options: { timeout: 5000 }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Handler Registration', () => {
    it('should have all expected handlers registered', async () => {
      const handlers = [
        'forensics.analyze_patterns',
        'forensics.detect_hurtlex',
        'forensics.score_severity',
        'forensics.get_modules',
        'text.mine',
        'format.convert',
        'format.parse',
        'format.check_schema',
        'format.ocr',
        'schema.resolve',
        'schema.apply',
        'schema.cache_stats',
        'schema.clear_cache',
        'evidence.create_chain',
        'evidence.add_stage',
        'evidence.verify',
        'evidence.hash_file',
        'evidence.hash_content',
        'evidence.export',
        'evidence.generate_report',
        'evidence.hash'
      ];

      for (const handler of handlers) {
        // Test that handler exists by attempting to execute with invalid args
        // A missing handler throws "No handler registered" error
        const result = await executor.execute({
          toolName: handler,
          args: {},
          traceId: `test-handler-check-${handler}`,
          options: { timeout: 1000 }
        });

        // Handler exists if we don't get "No handler registered" error
        if (!result.success && result.error) {
          expect(result.error.message).not.toContain('No handler registered');
        }
      }
    });
  });
});
