/**
 * Chain of Custody - Immutable Audit Trail for Forensic Evidence
 * 
 * Provides SHA-256 hashing at each processing stage with cryptographic chaining
 * of entries for tamper-evident audit logging. Exports to JSONL format for
 * legal admissibility.
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface ChainOfCustodyEntry {
  id: string;
  timestamp: string;
  stage: string;
  inputHash: string;
  outputHash: string;
  processingTime: number;
  metadata: Record<string, unknown>;
  previousEntryId: string | null;
}

export interface ChainOfCustodyOptions {
  storagePath?: string;
  enablePersistence?: boolean;
}

export class ChainOfCustody {
  private entries: Map<string, ChainOfCustodyEntry> = new Map();
  private headEntryId: string | null = null;
  private readonly storagePath: string;
  private readonly enablePersistence: boolean;

  constructor(options: ChainOfCustodyOptions = {}) {
    this.storagePath = options.storagePath || path.join(os.homedir(), '.mcp-tool-shop', 'chain-of-custody');
    this.enablePersistence = options.enablePersistence !== false;
  }

  private computeHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private computeEntryHash(entry: Omit<ChainOfCustodyEntry, 'id' | 'timestamp'>): string {
    const entryString = JSON.stringify({
      ...entry,
      timestamp: '__TIMESTAMP__'
    });
    const timestampedString = entryString.replace('"__TIMESTAMP__"', `"${new Date().toISOString()}"`);
    return this.computeHash(timestampedString);
  }

  async initialize(): Promise<void> {
    if (this.enablePersistence) {
      await fs.mkdir(this.storagePath, { recursive: true });
      await this.loadFromDisk();
    }
  }

  private async loadFromDisk(): Promise<void> {
    try {
      const entriesFile = path.join(this.storagePath, 'entries.jsonl');
      const stat = await fs.stat(entriesFile);
      
      if (!stat.isFile()) {
        return;
      }

      const content = await fs.readFile(entriesFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      for (const line of lines) {
        const entry = JSON.parse(line) as ChainOfCustodyEntry;
        this.entries.set(entry.id, entry);
        this.headEntryId = entry.id;
      }
    } catch (error) {
    }
  }

  private async saveToDisk(entry: ChainOfCustodyEntry): Promise<void> {
    if (!this.enablePersistence) {
      return;
    }

    const entriesFile = path.join(this.storagePath, 'entries.jsonl');
    await fs.appendFile(entriesFile, JSON.stringify(entry) + '\n');
  }

  async addEntry(
    entry: Omit<ChainOfCustodyEntry, 'id' | 'timestamp' | 'previousEntryId'>
  ): Promise<ChainOfCustodyEntry> {
    const timestamp = new Date().toISOString();
    
    const fullEntry: ChainOfCustodyEntry = {
      ...entry,
      id: '',
      timestamp,
      previousEntryId: this.headEntryId
    };

    const entryContent = JSON.stringify({
      stage: fullEntry.stage,
      inputHash: fullEntry.inputHash,
      outputHash: fullEntry.outputHash,
      processingTime: fullEntry.processingTime,
      metadata: fullEntry.metadata,
      previousEntryId: fullEntry.previousEntryId,
      timestamp
    });

    fullEntry.id = this.computeHash(entryContent);

    this.entries.set(fullEntry.id, fullEntry);
    this.headEntryId = fullEntry.id;

    await this.saveToDisk(fullEntry);

    return fullEntry;
  }

  async verifyIntegrity(): Promise<{
    valid: boolean;
    brokenChain?: string;
    tamperedEntry?: string;
    details: string;
  }> {
    const sortedEntries = Array.from(this.entries.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (sortedEntries.length === 0) {
      return { valid: true, details: 'No entries to verify' };
    }

    let previousEntryId: string | null = null;
    const expectedOrder: string[] = [];

    for (const entry of sortedEntries) {
      const expectedContent = JSON.stringify({
        stage: entry.stage,
        inputHash: entry.inputHash,
        outputHash: entry.outputHash,
        processingTime: entry.processingTime,
        metadata: entry.metadata,
        previousEntryId: entry.previousEntryId,
        timestamp: entry.timestamp
      });

      const computedId = this.computeHash(expectedContent);
      if (computedId !== entry.id) {
        return {
          valid: false,
          tamperedEntry: entry.id,
          details: `Entry ${entry.id} has been tampered with`
        };
      }

      if (entry.previousEntryId !== previousEntryId) {
        return {
          valid: false,
          brokenChain: entry.id,
          details: `Chain broken at entry ${entry.id}: expected previousEntryId ${previousEntryId}, got ${entry.previousEntryId}`
        };
      }

      expectedOrder.push(entry.id);
      previousEntryId = entry.id;
    }

    const chainComplete = previousEntryId === this.headEntryId;

    return {
      valid: true,
      details: chainComplete 
        ? `Chain verified: ${sortedEntries.length} entries, complete from genesis to head`
        : `Chain verified: ${sortedEntries.length} entries, head is ${this.headEntryId}`
    };
  }

  async getTrail(options: {
    fromStage?: string;
    toStage?: string;
    limit?: number;
  } = {}): Promise<ChainOfCustodyEntry[]> {
    let entries = Array.from(this.entries.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    if (options.fromStage) {
      entries = entries.filter(e => e.stage >= options.fromStage!);
    }

    if (options.toStage) {
      entries = entries.filter(e => e.stage <= options.toStage!);
    }

    if (options.limit) {
      entries = entries.slice(-options.limit);
    }

    return entries;
  }

  async exportAuditLog(options: {
    format?: 'jsonl' | 'json' | 'csv';
    includeMetadata?: boolean;
  } = {}): Promise<string> {
    const entries = await this.getTrail();
    const format = options.format || 'jsonl';

    if (format === 'jsonl') {
      return entries.map(e => {
        const exportEntry = {
          id: e.id,
          timestamp: e.timestamp,
          stage: e.stage,
          inputHash: e.inputHash,
          outputHash: e.outputHash,
          processingTime: e.processingTime,
          previousEntryId: e.previousEntryId,
          ...(options.includeMetadata !== false && { metadata: e.metadata })
        };
        return JSON.stringify(exportEntry);
      }).join('\n');
    }

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'stage', 'inputHash', 'outputHash', 'processingTime', 'previousEntryId'];
      const rows = entries.map(e => [
        e.id,
        e.timestamp,
        e.stage,
        e.inputHash,
        e.outputHash,
        e.processingTime.toString(),
        e.previousEntryId || ''
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  async generateIntegrityReport(): Promise<{
    summary: string;
    entries: ChainOfCustodyEntry[];
    verification: Awaited<ReturnType<typeof this.verifyIntegrity>>;
    export: string;
  }> {
    const entries = await this.getTrail();
    const verification = await this.verifyIntegrity();
    const export_ = await this.exportAuditLog();

    const summary = `
Chain of Custody Report
========================
Generated: ${new Date().toISOString()}
Total Entries: ${entries.length}
Head Entry ID: ${this.headEntryId || 'none'}
Integrity: ${verification.valid ? 'VALID' : 'INVALID'}

Entry Timeline:
${entries.map((e, i) => `  ${i + 1}. [${e.timestamp}] ${e.stage} (${e.id.slice(0, 8)}...)`).join('\n')}

${verification.valid ? '✓ All entries verified' : `✗ Verification failed: ${verification.details}`}
`.trim();

    return {
      summary,
      entries,
      verification,
      export: export_
    };
  }

  async getEntryById(id: string): Promise<ChainOfCustodyEntry | null> {
    return this.entries.get(id) || null;
  }

  async getHeadEntry(): Promise<ChainOfCustodyEntry | null> {
    if (!this.headEntryId) {
      return null;
    }
    return this.entries.get(this.headEntryId) || null;
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.headEntryId = null;

    if (this.enablePersistence) {
      try {
        const entriesFile = path.join(this.storagePath, 'entries.jsonl');
        await fs.unlink(entriesFile);
      } catch {
      }
    }
  }

  getEntryCount(): number {
    return this.entries.size;
  }
}

export function createHash(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function verifyHash(data: string | Buffer, expectedHash: string): boolean {
  const computed = createHash(data);
  return computed === expectedHash;
}

export const chainOfCustody = new ChainOfCustody();
