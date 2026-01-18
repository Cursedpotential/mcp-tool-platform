/**
 * Schema Resolver Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SchemaResolver, SchemaField, DetectedSchema, FieldType } from './schema-resolver';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SchemaResolver', () => {
  let resolver: SchemaResolver;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-schema-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    resolver = new SchemaResolver({ cacheDir: tempDir, enableAiFallback: false });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
    }
  });

  describe('detectSchema', () => {
    it('should detect string fields', async () => {
      const data = [{ name: 'John', message: 'Hello' }];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'name')?.type).toBe('string');
      expect(schema.fields.find(f => f.name === 'message')?.type).toBe('string');
    });

    it('should detect date fields from ISO format', async () => {
      const data = [
        { created: '2024-01-15T10:30:00Z', name: 'Test' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'created')?.type).toBe('date');
    });

    it('should detect date fields from timestamps', async () => {
      const data = [
        { timestamp: 1705315800000, name: 'Test' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'timestamp')?.type).toBe('date');
    });

    it('should detect email fields', async () => {
      const data = [
        { email: 'test@example.com', name: 'Test' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'email')?.type).toBe('email');
    });

    it('should detect phone fields', async () => {
      const data = [
        { phone: '+1 (555) 123-4567', name: 'Test' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'phone')?.type).toBe('phone');
    });

    it('should detect number fields', async () => {
      const data = [
        { amount: '123.45', count: 42, name: 'Test' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'count')?.type).toBe('number');
    });

    it('should detect boolean fields', async () => {
      const data = [
        { active: 'true', deleted: false, name: 'Test' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'deleted')?.type).toBe('boolean');
    });

    it('should handle empty array', async () => {
      const schema = await resolver.detectSchema([]);
      
      expect(schema.fields).toHaveLength(0);
      expect(schema.confidence).toBe(0);
    });

    it('should handle single object', async () => {
      const data = { id: 1, title: 'Test' };
      const schema = await resolver.detectSchema(data);

      expect(schema.fields).toHaveLength(2);
      expect(schema.fields.find(f => f.name === 'id')).toBeDefined();
      expect(schema.fields.find(f => f.name === 'title')).toBeDefined();
    });

    it('should calculate confidence scores', async () => {
      const data = [
        { email: 'test@example.com', email2: 'test2@example.com', unknown: 'xyz' }
      ];
      const schema = await resolver.detectSchema(data);

      const emailField = schema.fields.find(f => f.name === 'email');
      expect(emailField!.confidence).toBeGreaterThan(0.8);
    });

    it('should provide sample values', async () => {
      const data = [
        { name: 'John Doe', email: 'john@example.com' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'name')?.sample).toBe('John Doe');
      expect(schema.fields.find(f => f.name === 'email')?.sample).toBe('john@example.com');
    });

    it('should suggest canonical mappings', async () => {
      const data = [
        { sender_name: 'John', msg_body: 'Hello', sent_at: '2024-01-15' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.suggestedMapping['sender_name']).toBe('contactName');
      expect(schema.suggestedMapping['msg_body']).toBe('body');
      expect(schema.suggestedMapping['sent_at']).toBe('date');
    });
  });

  describe('mapToCanonical', () => {
    it('should map object fields according to mapping', async () => {
      const data = { sender_name: 'John', msg_body: 'Hello' };
      const mapping = { sender_name: 'contactName', msg_body: 'body' };

      const result = await resolver.mapToCanonical(data, mapping);

      expect(result).toEqual({ contactName: 'John', body: 'Hello' });
    });

    it('should map array of objects', async () => {
      const data = [
        { sender_name: 'John', msg_body: 'Hello' },
        { sender_name: 'Jane', msg_body: 'Hi' }
      ];
      const mapping = { sender_name: 'contactName', msg_body: 'body' };

      const result = await resolver.mapToCanonical(data, mapping);

      expect(result).toEqual([
        { contactName: 'John', body: 'Hello' },
        { contactName: 'Jane', body: 'Hi' }
      ]);
    });

    it('should preserve unmapped fields', async () => {
      const data = { name: 'John', unknown_field: 'value' };
      const mapping = { name: 'contactName' };

      const result = await resolver.mapToCanonical(data, mapping);

      expect(result).toEqual({ contactName: 'John', unknown_field: 'value' });
    });
  });

  describe('cacheSchema', () => {
    it('should cache schema by hash', async () => {
      const schema: DetectedSchema = {
        fields: [{ name: 'test', type: 'string', confidence: 1.0, sample: 'value' }],
        confidence: 1.0,
        suggestedMapping: {}
      };

      resolver.cacheSchema(schema, 'test-hash');

      const cached = await resolver.getCachedSchema('test-hash');
      expect(cached).not.toBeNull();
      expect(cached!.fields).toHaveLength(1);
    });

    it('should return null for non-existent hash', async () => {
      const result = await resolver.getCachedSchema('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const schema: DetectedSchema = {
        fields: [{ name: 'test', type: 'string', confidence: 1.0, sample: 'value' }],
        confidence: 1.0,
        suggestedMapping: {}
      };

      resolver.cacheSchema(schema, 'hash1');
      await resolver.clearCache();

      const stats = await resolver.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should return cache stats', async () => {
      const schema: DetectedSchema = {
        fields: [{ name: 'test', type: 'string', confidence: 1.0, sample: 'value' }],
        confidence: 1.0,
        suggestedMapping: {}
      };

      resolver.cacheSchema(schema, 'hash1');
      resolver.cacheSchema(schema, 'hash2');

      const stats = await resolver.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.hashes).toContain('hash1');
      expect(stats.hashes).toContain('hash2');
    });

    it('should persist cache between instances', async () => {
      const schema: DetectedSchema = {
        fields: [{ name: 'test', type: 'string', confidence: 1.0, sample: 'value' }],
        confidence: 1.0,
        suggestedMapping: {}
      };

      resolver.cacheSchema(schema, 'persisted-hash');

      const newResolver = new SchemaResolver({ cacheDir: tempDir });
      const cached = await newResolver.getCachedSchema('persisted-hash');

      expect(cached).not.toBeNull();
    });
  });

  describe('complex schemas', () => {
    it('should handle mixed data types', async () => {
      const data = [
        { id: 1, name: 'John', email: 'john@example.com', phone: '555-1234', active: true, amount: '99.99' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'id')?.type).toBe('number');
      expect(schema.fields.find(f => f.name === 'name')?.type).toBe('string');
      expect(schema.fields.find(f => f.name === 'email')?.type).toBe('email');
      expect(schema.fields.find(f => f.name === 'phone')?.type).toBe('phone');
      expect(schema.fields.find(f => f.name === 'active')?.type).toBe('boolean');
      expect(schema.fields.find(f => f.name === 'amount')?.type).toBe('number');
    });

    it('should handle multiple records', async () => {
      const data = [
        { name: 'John', date: '2024-01-01' },
        { name: 'Jane', date: '2024-01-02' },
        { name: 'Bob', date: '2024-01-03' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.fields.find(f => f.name === 'name')).toBeDefined();
      expect(schema.fields.find(f => f.name === 'date')).toBeDefined();
      expect(schema.confidence).toBeGreaterThan(0.5);
    });

    it('should suggest canonical names for various field variations', async () => {
      const data = [
        { full_name: 'John', message_content: 'Hello', created_timestamp: '2024-01-01', contact_email: 'john@test.com' }
      ];
      const schema = await resolver.detectSchema(data);

      expect(schema.suggestedMapping['full_name']).toBe('contactName');
      expect(schema.suggestedMapping['message_content']).toBe('body');
      expect(schema.suggestedMapping['created_timestamp']).toBe('date');
      expect(schema.suggestedMapping['contact_email']).toBe('email');
    });
  });
});

describe('FieldType detection patterns', () => {
  const resolver = new SchemaResolver({ enableAiFallback: false });

  it('should detect various email formats', async () => {
    const emails = [
      'test@example.com',
      'user.name@domain.org',
      'user+tag@example.co.uk'
    ];
    const data = emails.map(e => ({ email: e }));
    const schema = await resolver.detectSchema(data);

    expect(schema.fields.find(f => f.name === 'email')?.type).toBe('email');
  });

  it('should detect various phone formats', async () => {
    const phones = [
      '555-123-4567',
      '(555) 123-4567',
      '+1 555 123 4567'
    ];
    const data = phones.map(p => ({ phone: p }));
    const schema = await resolver.detectSchema(data);

    expect(schema.fields.find(f => f.name === 'phone')?.type).toBe('phone');
  });

  it('should detect date formats', async () => {
    const dates = [
      '2024-01-15',
      '2024-01-15T10:30:00',
      '01/15/2024',
      'Jan 15, 2024'
    ];
    const data = dates.map(d => ({ date: d }));
    const schema = await resolver.detectSchema(data);

    expect(schema.fields.find(f => f.name === 'date')?.type).toBe('date');
  });
});

describe('SchemaField interface', () => {
  it('should match expected structure', () => {
    const field: SchemaField = {
      name: 'email',
      type: 'email',
      confidence: 0.95,
      sample: 'test@example.com'
    };

    expect(field.name).toBe('email');
    expect(field.type).toBe('email');
    expect(field.confidence).toBe(0.95);
    expect(field.sample).toBe('test@example.com');
  });

  it('should accept all field types', () => {
    const types: FieldType[] = ['string', 'number', 'boolean', 'array', 'object', 'date', 'email', 'phone'];
    
    types.forEach(type => {
      const field: SchemaField = { name: 'test', type, confidence: 1.0, sample: '' };
      expect(field.type).toBe(type);
    });
  });
});

describe('DetectedSchema interface', () => {
  it('should match expected structure', () => {
    const schema: DetectedSchema = {
      fields: [
        { name: 'email', type: 'email', confidence: 0.9, sample: 'test@example.com' },
        { name: 'date', type: 'date', confidence: 0.85, sample: '2024-01-01' }
      ],
      confidence: 0.87,
      suggestedMapping: { email: 'address', date: 'date' }
    };

    expect(schema.fields).toHaveLength(2);
    expect(schema.confidence).toBe(0.87);
    expect(schema.suggestedMapping['email']).toBe('address');
  });
});
