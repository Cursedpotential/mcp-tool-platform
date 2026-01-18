/**
 * Chain of Custody Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChainOfCustody, createHash, verifyHash, ChainOfCustodyEntry } from './chain-custody';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ChainOfCustody', () => {
  let chain: ChainOfCustody;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-coc-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    chain = new ChainOfCustody({
      storagePath: tempDir,
      enablePersistence: true
    });
    await chain.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
    }
  });

  describe('addEntry', () => {
    it('should create entry with SHA-256 hash id', async () => {
      const entry = await chain.addEntry({
        stage: 'import',
        inputHash: 'abc123',
        outputHash: 'def456',
        processingTime: 100,
        metadata: { source: 'test' }
      });

      expect(entry.id).toBeDefined();
      expect(entry.id).toHaveLength(64);
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(entry.previousEntryId).toBeNull();
    });

    it('should chain entries with previousEntryId', async () => {
      const entry1 = await chain.addEntry({
        stage: 'import',
        inputHash: 'hash1',
        outputHash: 'hash2',
        processingTime: 100,
        metadata: {}
      });

      const entry2 = await chain.addEntry({
        stage: 'analyze',
        inputHash: entry1.outputHash,
        outputHash: 'hash4',
        processingTime: 200,
        metadata: {}
      });

      expect(entry2.previousEntryId).toBe(entry1.id);
    });

    it('should include processing time and metadata', async () => {
      const entry = await chain.addEntry({
        stage: 'report',
        inputHash: 'input',
        outputHash: 'output',
        processingTime: 1500,
        metadata: { userId: 123, caseId: 'case-456' }
      });

      expect(entry.processingTime).toBe(1500);
      expect(entry.metadata).toEqual({ userId: 123, caseId: 'case-456' });
    });
  });

  describe('verifyIntegrity', () => {
    it('should return valid for empty chain', async () => {
      const result = await chain.verifyIntegrity();
      expect(result.valid).toBe(true);
    });

    it('should verify complete chain', async () => {
      await chain.addEntry({
        stage: 'import',
        inputHash: 'a',
        outputHash: 'b',
        processingTime: 100,
        metadata: {}
      });

      await chain.addEntry({
        stage: 'analyze',
        inputHash: 'b',
        outputHash: 'c',
        processingTime: 200,
        metadata: {}
      });

      const result = await chain.verifyIntegrity();
      expect(result.valid).toBe(true);
    });
  });

  describe('getTrail', () => {
    it('should return all entries in chronological order', async () => {
      await chain.addEntry({ stage: 'import', inputHash: 'a', outputHash: 'b', processingTime: 100, metadata: {} });
      await chain.addEntry({ stage: 'analyze', inputHash: 'b', outputHash: 'c', processingTime: 200, metadata: {} });
      await chain.addEntry({ stage: 'report', inputHash: 'c', outputHash: 'd', processingTime: 300, metadata: {} });

      const trail = await chain.getTrail();

      expect(trail).toHaveLength(3);
      expect(trail[0].stage).toBe('import');
      expect(trail[1].stage).toBe('analyze');
      expect(trail[2].stage).toBe('report');
    });

    it('should filter by stage', async () => {
      await chain.addEntry({ stage: 'import', inputHash: 'a', outputHash: 'b', processingTime: 100, metadata: {} });
      await chain.addEntry({ stage: 'analyze', inputHash: 'b', outputHash: 'c', processingTime: 200, metadata: {} });
      await chain.addEntry({ stage: 'report', inputHash: 'c', outputHash: 'd', processingTime: 300, metadata: {} });

      const importOnly = await chain.getTrail({ fromStage: 'import', toStage: 'import' });

      expect(importOnly).toHaveLength(1);
      expect(importOnly[0].stage).toBe('import');
    });

    it('should limit results', async () => {
      for (let i = 0; i < 5; i++) {
        await chain.addEntry({ stage: `stage_${i}`, inputHash: 'a', outputHash: 'b', processingTime: 100, metadata: {} });
      }

      const limited = await chain.getTrail({ limit: 3 });

      expect(limited).toHaveLength(3);
    });
  });

  describe('exportAuditLog', () => {
    it('should export as JSONL format', async () => {
      await chain.addEntry({
        stage: 'import',
        inputHash: 'a',
        outputHash: 'b',
        processingTime: 100,
        metadata: { test: true }
      });

      const export_ = await chain.exportAuditLog({ format: 'jsonl' });

      const lines = export_.split('\n').filter(Boolean);
      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.stage).toBe('import');
      expect(parsed.inputHash).toBe('a');
    });

    it('should export as JSON format', async () => {
      await chain.addEntry({ stage: 'test', inputHash: 'a', outputHash: 'b', processingTime: 100, metadata: {} });

      const export_ = await chain.exportAuditLog({ format: 'json' });
      const parsed = JSON.parse(export_);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].stage).toBe('test');
    });

    it('should export as CSV format', async () => {
      await chain.addEntry({ stage: 'test', inputHash: 'a', outputHash: 'b', processingTime: 100, metadata: {} });

      const export_ = await chain.exportAuditLog({ format: 'csv' });

      const lines = export_.split('\n');
      expect(lines[0]).toBe('id,timestamp,stage,inputHash,outputHash,processingTime,previousEntryId');
      expect(lines[1]).toContain('test');
    });

    it('should optionally exclude metadata', async () => {
      await chain.addEntry({
        stage: 'test',
        inputHash: 'a',
        outputHash: 'b',
        processingTime: 100,
        metadata: { secret: 'data' }
      });

      const export_ = await chain.exportAuditLog({ includeMetadata: false });
      const parsed = JSON.parse(export_.split('\n')[0]);

      expect(parsed.metadata).toBeUndefined();
    });
  });

  describe('generateIntegrityReport', () => {
    it('should generate comprehensive report', async () => {
      await chain.addEntry({ stage: 'import', inputHash: 'a', outputHash: 'b', processingTime: 100, metadata: {} });
      await chain.addEntry({ stage: 'analyze', inputHash: 'b', outputHash: 'c', processingTime: 200, metadata: {} });

      const report = await chain.generateIntegrityReport();

      expect(report.summary).toContain('import');
      expect(report.summary).toContain('analyze');
      expect(report.verification.valid).toBe(true);
      expect(report.export).toBeDefined();
    });
  });

  describe('getEntryById', () => {
    it('should retrieve entry by id', async () => {
      const added = await chain.addEntry({
        stage: 'test',
        inputHash: 'a',
        outputHash: 'b',
        processingTime: 100,
        metadata: {}
      });

      const retrieved = await chain.getEntryById(added.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.stage).toBe('test');
    });

    it('should return null for non-existent id', async () => {
      const result = await chain.getEntryById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getHeadEntry', () => {
    it('should return the last entry', async () => {
      const entry1 = await chain.addEntry({ stage: 'a', inputHash: '1', outputHash: '2', processingTime: 100, metadata: {} });
      const entry2 = await chain.addEntry({ stage: 'b', inputHash: '2', outputHash: '3', processingTime: 200, metadata: {} });

      const head = await chain.getHeadEntry();

      expect(head!.id).toBe(entry2.id);
    });

    it('should return null for empty chain', async () => {
      const head = await chain.getHeadEntry();
      expect(head).toBeNull();
    });
  });

  describe('persistence', () => {
    it('should persist and reload entries', async () => {
      await chain.addEntry({ stage: 'persist', inputHash: 'a', outputHash: 'b', processingTime: 100, metadata: {} });

      const newChain = new ChainOfCustody({ storagePath: tempDir, enablePersistence: true });
      await newChain.initialize();

      const entries = await newChain.getTrail();
      expect(entries).toHaveLength(1);
      expect(entries[0].stage).toBe('persist');
    });
  });

  describe('createHash', () => {
    it('should create consistent SHA-256 hashes', () => {
      const hash1 = createHash('test');
      const hash2 = createHash('test');
      const hash3 = createHash('different');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64);
    });

    it('should handle buffers', () => {
      const hash = createHash(Buffer.from('test'));
      expect(hash).toHaveLength(64);
    });
  });

  describe('verifyHash', () => {
    it('should verify correct hashes', () => {
      const hash = createHash('test');
      expect(verifyHash('test', hash)).toBe(true);
    });

    it('should reject incorrect hashes', () => {
      expect(verifyHash('test', 'wronghash')).toBe(false);
    });
  });
});

describe('ChainOfCustodyEntry interface', () => {
  it('should match expected structure', () => {
    const entry: ChainOfCustodyEntry = {
      id: 'a'.repeat(64),
      timestamp: new Date().toISOString(),
      stage: 'import',
      inputHash: 'abc',
      outputHash: 'def',
      processingTime: 100,
      metadata: { test: true },
      previousEntryId: null
    };

    expect(entry.id).toBeDefined();
    expect(entry.previousEntryId).toBeNull();
  });
});
