import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ingestEvidence } from './index';
import { SmsXmlReader } from './readers/SmsXmlReader';
import { BehavioralFlagExtractor } from './extractors/BehavioralFlagExtractor';
import { Document, MetadataMode } from 'llamaindex';
import * as fs from 'fs';
import * as path from 'path';

// Mock the heavy database clients
const mockLogIngestion = vi.fn().mockResolvedValue({
  id: 'mock-uuid-v7',
  source_hash: 'mock-sha256-hash',
  pass1_status: 'processing'
});

vi.mock('../storage/duckdb', () => ({
  getDuckDBClient: () => ({
    isInitialized: () => true,
    initialize: vi.fn().mockResolvedValue(true),
    logIngestion: mockLogIngestion
  })
}));

vi.mock('../storage/lancedb', () => ({
  getLanceDBClient: vi.fn(() => ({
    isInitialized: () => true,
    initialize: vi.fn().mockResolvedValue(true),
    addDocuments: vi.fn().mockResolvedValue(true)
  }))
}));

// Mock the readers and extractors so we can test the pipeline orchestration
vi.mock('./readers/SmsXmlReader', () => {
  return {
    SmsXmlReader: vi.fn().mockImplementation(() => ({
      loadData: vi.fn().mockResolvedValue([
        new Document({ text: 'You are crazy!', id_: 'chunk-1' }),
        new Document({ text: 'I will call my lawyer.', id_: 'chunk-2' })
      ])
    }))
  };
});

describe('Sprint 1: Ingestion Pipeline Orchestration', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a DocumentID and Hash via DuckDB at first-touch', async () => {
    const result = await ingestEvidence('text', 'test.txt', 'Raw text here');
    
    expect(result.documentId).toBe('mock-uuid-v7');
    expect(result.sourceHash).toBe('mock-sha256-hash');
    expect(result.status).toBe('processing');
    
    expect(mockLogIngestion).toHaveBeenCalledWith(
      'text', 'test.txt', 'Raw text here', null, expect.any(Object)
    );
  });

  it('should successfully route XML files to the SmsXmlReader', async () => {
    const mockXmlPath = '/mock/path/messages.xml';
    const result = await ingestEvidence('sms_backup_xml', 'messages.xml', null, mockXmlPath);
    expect(result.chunksGenerated).toBe(2);
  });

  it('should correctly flag DARVO behavioral patterns in text chunks', async () => {
    const flagExtractor = new BehavioralFlagExtractor();
    
    const mockNodes = [
      new Document({ text: "I never said that, you're making things up!" }),
      new Document({ text: "If you don't comply, I'll take you to court." }),
      new Document({ text: "Have a nice day." }) // Safe text
    ];

    const metadata = await flagExtractor.extract(mockNodes);

    expect(metadata[0].forensic_categories_string).toContain('Gaslighting');
    expect(metadata[1].forensic_categories_string).toContain('Legal/Court Intimidation');
    expect(metadata[2].forensic_flags).toBeUndefined(); // Safe text has no flags
  });

});
