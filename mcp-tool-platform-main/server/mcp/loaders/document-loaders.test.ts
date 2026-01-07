/**
 * Document Loaders Tests
 * 
 * Tests for BaseDocumentLoader, SMSDocumentLoader, and chunking strategies.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BaseDocumentLoader, ChunkingOptions } from './base-loader';
import { SMSDocumentLoader, SMSMessage } from './sms-loader';
import * as fs from 'fs/promises';
import * as path from 'path';

// Test implementation of BaseDocumentLoader
class TestDocumentLoader extends BaseDocumentLoader {
  constructor() {
    super('generic');
  }
  
  async load(filePath: string) {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.loadFromContent(content, {
      filename: path.basename(filePath),
      source_path: filePath
    });
  }
  
  async loadFromContent(content: string, metadata: any) {
    return {
      id: this.generateDocumentId(),
      platform: this.platform,
      content,
      metadata: {
        filename: metadata.filename || 'test.txt',
        source_path: metadata.source_path || '',
        file_size: Buffer.byteLength(content, 'utf-8'),
        mime_type: 'text/plain',
        created_at: new Date(),
        modified_at: new Date()
      }
    };
  }
}

describe('BaseDocumentLoader', () => {
  let loader: TestDocumentLoader;
  
  beforeEach(() => {
    loader = new TestDocumentLoader();
  });
  
  describe('Schema Detection', () => {
    it('should detect schema from sample data', async () => {
      const sampleData = [
        { id: 1, name: 'Alice', age: 30, active: true },
        { id: 2, name: 'Bob', age: 25, active: false },
        { id: 3, name: 'Charlie', age: 35, active: true }
      ];
      
      const schema = await loader.detectSchema(sampleData);
      
      expect(schema.fields.length).toBe(4);
      expect(schema.fields.find(f => f.name === 'id')?.type).toBe('number');
      expect(schema.fields.find(f => f.name === 'name')?.type).toBe('string');
      expect(schema.fields.find(f => f.name === 'age')?.type).toBe('number');
      expect(schema.fields.find(f => f.name === 'active')?.type).toBe('boolean');
    });
    
    it('should detect required fields', async () => {
      const sampleData = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: null },
        { id: 3, name: 'Charlie', email: 'charlie@example.com' }
      ];
      
      const schema = await loader.detectSchema(sampleData);
      
      const idField = schema.fields.find(f => f.name === 'id');
      const emailField = schema.fields.find(f => f.name === 'email');
      
      expect(idField?.required).toBe(true);
      expect(emailField?.required).toBe(false);
    });
    
    it('should detect date fields', async () => {
      const sampleData = [
        { timestamp: '2024-01-01T00:00:00Z', value: 100 },
        { timestamp: '2024-01-02T00:00:00Z', value: 200 }
      ];
      
      const schema = await loader.detectSchema(sampleData);
      
      const timestampField = schema.fields.find(f => f.name === 'timestamp');
      expect(timestampField?.type).toBe('date');
    });
    
    it('should detect array fields', async () => {
      const sampleData = [
        { tags: ['tag1', 'tag2'], count: 5 },
        { tags: ['tag3'], count: 3 }
      ];
      
      const schema = await loader.detectSchema(sampleData);
      
      const tagsField = schema.fields.find(f => f.name === 'tags');
      expect(tagsField?.type).toBe('array');
    });
    
    it('should return empty schema for empty data', async () => {
      const schema = await loader.detectSchema([]);
      
      expect(schema.fields.length).toBe(0);
      expect(schema.confidence).toBe(0);
    });
  });
  
  describe('Chunking Strategies', () => {
    const testDocument = {
      id: 'test_doc_001',
      platform: 'generic' as const,
      content: 'This is sentence one. This is sentence two. This is sentence three. This is sentence four.',
      metadata: {
        filename: 'test.txt',
        source_path: '/test/test.txt',
        file_size: 100,
        mime_type: 'text/plain',
        created_at: new Date(),
        modified_at: new Date()
      }
    };
    
    it('should chunk with fixed size', async () => {
      const options: ChunkingOptions = {
        strategy: 'fixed_size',
        chunk_size: 20,
        chunk_overlap: 0
      };
      
      const chunks = await loader.chunk(testDocument, options);
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].text.length).toBeLessThanOrEqual(20);
      expect(chunks[0].chunk_id).toContain('test_doc_001');
    });
    
    it('should chunk with sliding window', async () => {
      const options: ChunkingOptions = {
        strategy: 'sliding_window',
        chunk_size: 30,
        chunk_overlap: 10
      };
      
      const chunks = await loader.chunk(testDocument, options);
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Check overlap
      if (chunks.length > 1) {
        const chunk1End = chunks[0].text.slice(-10);
        const chunk2Start = chunks[1].text.slice(0, 10);
        // There should be some overlap
        expect(chunk2Start).toBeTruthy();
      }
    });
    
    it('should chunk by semantic separator', async () => {
      const docWithSeparators = {
        ...testDocument,
        content: 'Section 1\n\nSection 2\n\nSection 3'
      };
      
      const options: ChunkingOptions = {
        strategy: 'semantic',
        separator: '\n\n'
      };
      
      const chunks = await loader.chunk(docWithSeparators, options);
      
      expect(chunks.length).toBe(3);
      expect(chunks[0].text).toBe('Section 1');
      expect(chunks[1].text).toBe('Section 2');
      expect(chunks[2].text).toBe('Section 3');
    });
    
    it('should chunk by paragraph', async () => {
      const docWithParagraphs = {
        ...testDocument,
        content: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.'
      };
      
      const options: ChunkingOptions = {
        strategy: 'paragraph'
      };
      
      const chunks = await loader.chunk(docWithParagraphs, options);
      
      expect(chunks.length).toBe(3);
    });
    
    it('should preserve metadata in chunks', async () => {
      const options: ChunkingOptions = {
        strategy: 'fixed_size',
        chunk_size: 50
      };
      
      const chunks = await loader.chunk(testDocument, options);
      
      expect(chunks[0].metadata.platform).toBe('generic');
      expect(chunks[0].document_id).toBe('test_doc_001');
    });
  });
});

describe('SMSDocumentLoader', () => {
  let loader: SMSDocumentLoader;
  
  beforeEach(() => {
    loader = new SMSDocumentLoader();
  });
  
  describe('JSON Parsing', () => {
    it('should parse JSON array format', async () => {
      const jsonContent = JSON.stringify([
        {
          id: 'msg_001',
          timestamp: '2024-01-01T10:00:00Z',
          sender: 'Alice',
          recipient: 'Bob',
          text: 'Hello Bob!',
          type: 'sent'
        },
        {
          id: 'msg_002',
          timestamp: '2024-01-01T10:05:00Z',
          sender: 'Bob',
          recipient: 'Alice',
          text: 'Hi Alice!',
          type: 'received'
        }
      ]);
      
      const doc = await loader.loadFromContent(jsonContent, {
        filename: 'sms_export.json',
        mime_type: 'application/json'
      });
      
      expect(doc.platform).toBe('sms');
      expect(doc.metadata.message_count).toBe(2);
      expect(doc.metadata.participants).toContain('Alice');
      expect(doc.metadata.participants).toContain('Bob');
    });
    
    it('should parse JSON object format with messages array', async () => {
      const jsonContent = JSON.stringify({
        export_date: '2024-01-01',
        messages: [
          {
            id: 'msg_001',
            from: 'Alice',
            to: 'Bob',
            body: 'Test message',
            date: '2024-01-01T10:00:00Z'
          }
        ]
      });
      
      const doc = await loader.loadFromContent(jsonContent, {
        filename: 'sms_export.json'
      });
      
      expect(doc.metadata.message_count).toBe(1);
      expect(doc.content).toContain('Test message');
    });
  });
  
  describe('CSV Parsing', () => {
    it('should parse CSV format', async () => {
      const csvContent = `id,timestamp,sender,recipient,text,type
msg_001,2024-01-01T10:00:00Z,Alice,Bob,Hello,sent
msg_002,2024-01-01T10:05:00Z,Bob,Alice,Hi,received`;
      
      const doc = await loader.loadFromContent(csvContent, {
        filename: 'sms_export.csv',
        mime_type: 'text/csv'
      });
      
      expect(doc.platform).toBe('sms');
      expect(doc.metadata.message_count).toBe(2);
    });
  });
  
  describe('XML Parsing', () => {
    it('should parse Android SMS Backup XML format', async () => {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<smses>
  <sms address="+1234567890" body="Test message 1" date="1704096000000" type="2" />
  <sms address="+1234567890" body="Test message 2" date="1704096300000" type="1" />
</smses>`;
      
      const doc = await loader.loadFromContent(xmlContent, {
        filename: 'sms_backup.xml',
        mime_type: 'application/xml'
      });
      
      expect(doc.platform).toBe('sms');
      expect(doc.metadata.message_count).toBeGreaterThan(0);
    });
  });
  
  describe('Plain Text Parsing', () => {
    it('should parse plain text format', async () => {
      const textContent = `[2024-01-01 10:00:00] Alice: Hello Bob!
[2024-01-01 10:05:00] Bob: Hi Alice!
[2024-01-01 10:10:00] Alice: How are you?`;
      
      const doc = await loader.loadFromContent(textContent, {
        filename: 'sms_export.txt',
        mime_type: 'text/plain'
      });
      
      expect(doc.platform).toBe('sms');
      expect(doc.metadata.message_count).toBeGreaterThan(0);
    });
  });
  
  describe('Metadata Extraction', () => {
    it('should extract participants', async () => {
      const messages: SMSMessage[] = [
        {
          id: 'msg_001',
          timestamp: new Date(),
          sender: 'Alice',
          recipient: 'Bob',
          text: 'Test',
          type: 'sent'
        },
        {
          id: 'msg_002',
          timestamp: new Date(),
          sender: 'Bob',
          recipient: 'Alice',
          text: 'Reply',
          type: 'received'
        },
        {
          id: 'msg_003',
          timestamp: new Date(),
          sender: 'Charlie',
          recipient: 'Alice',
          text: 'Another message',
          type: 'received'
        }
      ];
      
      const jsonContent = JSON.stringify(messages);
      const doc = await loader.loadFromContent(jsonContent, {
        filename: 'test.json'
      });
      
      expect(doc.metadata.participants?.length).toBe(3);
      expect(doc.metadata.participants).toContain('Alice');
      expect(doc.metadata.participants).toContain('Bob');
      expect(doc.metadata.participants).toContain('Charlie');
    });
    
    it('should extract date range', async () => {
      const messages: SMSMessage[] = [
        {
          id: 'msg_001',
          timestamp: new Date('2024-01-01'),
          sender: 'Alice',
          recipient: 'Bob',
          text: 'First',
          type: 'sent'
        },
        {
          id: 'msg_002',
          timestamp: new Date('2024-01-15'),
          sender: 'Bob',
          recipient: 'Alice',
          text: 'Last',
          type: 'received'
        }
      ];
      
      const jsonContent = JSON.stringify(messages);
      const doc = await loader.loadFromContent(jsonContent, {
        filename: 'test.json'
      });
      
      expect(doc.metadata.date_range).toBeDefined();
      expect(doc.metadata.date_range![0].toISOString()).toContain('2024-01-01');
      expect(doc.metadata.date_range![1].toISOString()).toContain('2024-01-15');
    });
  });
  
  describe('Schema Detection', () => {
    it('should detect SMS message schema', async () => {
      const messages = [
        {
          id: 'msg_001',
          timestamp: new Date().toISOString(),
          sender: 'Alice',
          recipient: 'Bob',
          text: 'Hello',
          type: 'sent'
        }
      ];
      
      const jsonContent = JSON.stringify(messages);
      const doc = await loader.loadFromContent(jsonContent, {
        filename: 'test.json'
      });
      
      expect(doc.schema).toBeDefined();
      expect(doc.schema!.fields.length).toBeGreaterThan(0);
      
      const senderField = doc.schema!.fields.find(f => f.name === 'sender');
      expect(senderField?.type).toBe('string');
    });
  });
  
  describe('Content Formatting', () => {
    it('should format messages as readable text', async () => {
      const messages: SMSMessage[] = [
        {
          id: 'msg_001',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          sender: 'Alice',
          recipient: 'Bob',
          text: 'Hello',
          type: 'sent'
        },
        {
          id: 'msg_002',
          timestamp: new Date('2024-01-01T10:05:00Z'),
          sender: 'Bob',
          recipient: 'Alice',
          text: 'Hi',
          type: 'received'
        }
      ];
      
      const jsonContent = JSON.stringify(messages);
      const doc = await loader.loadFromContent(jsonContent, {
        filename: 'test.json'
      });
      
      expect(doc.content).toContain('Alice: Hello');
      expect(doc.content).toContain('Bob: Hi');
      expect(doc.content).toContain('2024-01-01');
    });
    
    it('should sort messages chronologically', async () => {
      const messages: SMSMessage[] = [
        {
          id: 'msg_002',
          timestamp: new Date('2024-01-01T10:05:00Z'),
          sender: 'Bob',
          recipient: 'Alice',
          text: 'Second',
          type: 'received'
        },
        {
          id: 'msg_001',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          sender: 'Alice',
          recipient: 'Bob',
          text: 'First',
          type: 'sent'
        }
      ];
      
      const jsonContent = JSON.stringify(messages);
      const doc = await loader.loadFromContent(jsonContent, {
        filename: 'test.json'
      });
      
      const firstIndex = doc.content.indexOf('First');
      const secondIndex = doc.content.indexOf('Second');
      
      expect(firstIndex).toBeLessThan(secondIndex);
    });
  });
  
  describe('Conversation Turn Chunking', () => {
    it('should chunk by conversation turns', async () => {
      const messages: SMSMessage[] = [
        {
          id: 'msg_001',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          sender: 'Alice',
          recipient: 'Bob',
          text: 'Message 1',
          type: 'sent'
        },
        {
          id: 'msg_002',
          timestamp: new Date('2024-01-01T10:05:00Z'),
          sender: 'Bob',
          recipient: 'Alice',
          text: 'Message 2',
          type: 'received'
        }
      ];
      
      const jsonContent = JSON.stringify(messages);
      const doc = await loader.loadFromContent(jsonContent, {
        filename: 'test.json'
      });
      
      const chunks = await loader.chunk(doc, {
        strategy: 'conversation_turn'
      });
      
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
