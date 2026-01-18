/**
 * Schema Resolver Plugin - AI-powered field mapping for unknown formats
 * 
 * When standard parsing fails, uses heuristics + AI to:
 * 1. Detect field purposes from content patterns
 * 2. Map to standard schema (body, date, contactName, address)
 * 3. Cache mappings for reuse (hash-based lookup)
 * 
 * Minimizes LLM usage by trying heuristics first.
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'email' | 'phone';

export interface SchemaField {
  name: string;
  type: FieldType;
  confidence: number;
  sample: string;
}

export interface DetectedSchema {
  fields: SchemaField[];
  confidence: number;
  suggestedMapping: Record<string, string>;
}

export interface SchemaResolverOptions {
  cacheDir?: string;
  enableAiFallback?: boolean;
  llmEndpoint?: string;
  llmApiKey?: string;
}

interface CachedSchema {
  hash: string;
  schema: DetectedSchema;
  timestamp: string;
}

const CANONICAL_FIELDS: Record<string, string[]> = {
  body: ['body', 'text', 'message', 'msg_body', 'message_body', 'msg_body', 'messageContent', 'content', 'msg', 'sms_body', 'messageBody', 'description', 'summary', 'message_content'],
  date: ['date', 'timestamp', 'time', 'datetime', 'sent_at', 'created_at', 'sentAt', 'createdAt', 'updated_at', 'event_date', 'occurred', 'created_timestamp', 'sent_at', 'sentAt'],
  readableDate: ['readable_date', 'readableDate', 'formatted_date', 'formattedDate', 'dateString'],
  contactName: ['contact_name', 'contactName', 'sender', 'from', 'name', 'author', 'displayName', 'full_name', 'fullName', 'participant', 'user', 'sender_name'],
  address: ['address', 'phone', 'number', 'phone_number', 'phoneNumber', 'tel', 'recipient', 'to', 'target'],
  messageType: ['type', 'messageType', 'message_type', 'direction', 'msgType', 'category', 'status', 'label'],
  email: ['email', 'email_address', 'emailAddress', 'from_email', 'to_email', 'sender_email', 'contact_email'],
  location: ['location', 'address', 'city', 'state', 'zip', 'postal', 'country', 'lat', 'lng', 'latitude', 'longitude', 'coordinates'],
  amount: ['amount', 'value', 'price', 'cost', 'total', 'sum', 'balance', 'currency'],
  id: ['id', 'identifier', 'uuid', 'guid', 'case_id', 'caseId', 'record_id', 'recordId']
};

const TYPE_PATTERNS: Record<FieldType, RegExp[]> = {
  date: [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
    /^\d{10,13}$/,
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\w{3}\s\d{1,2},?\s\d{4}/,
    /^\d{2}-\d{2}-\d{4}/
  ],
  email: [
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  ],
  phone: [
    /^\+?[\d\s\-\(\)]{7,}$/,
    /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
    /^\+?\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}$/
  ],
  number: [
    /^-?\d+(\.\d+)?$/,
    /^-?\d{1,3}(,\d{3})*(\.\d+)?$/,
    /^\d+(\.\d+)?%?$/
  ],
  boolean: [
    /^(true|false|yes|no|1|0)$/i
  ],
  string: [],
  array: [],
  object: []
};

const CACHE_DIR_DEFAULT = path.join(os.homedir(), '.mcp-tool-shop', 'schema_cache');
const CACHE_FILE = 'detected_schemas.json';

let schemaCache: Map<string, CachedSchema> = new Map();
let cacheLoaded = false;
let cacheDir: string;

async function ensureCacheDir(): Promise<string> {
  if (!cacheDir) {
    cacheDir = CACHE_DIR_DEFAULT;
  }
  await fs.mkdir(cacheDir, { recursive: true });
  return cacheDir;
}

async function loadCache(): Promise<void> {
  if (cacheLoaded) return;
  
  try {
    const dir = await ensureCacheDir();
    const cachePath = path.join(dir, CACHE_FILE);
    const data = await fs.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(data);
    schemaCache = new Map(Object.entries(parsed));
    cacheLoaded = true;
  } catch {
    schemaCache = new Map();
    cacheLoaded = true;
  }
}

async function saveCache(): Promise<void> {
  const dir = await ensureCacheDir();
  const cachePath = path.join(dir, CACHE_FILE);
  const data = Object.fromEntries(schemaCache);
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
}

function computeContentHash(data: unknown): string {
  const normalized = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

function detectFieldType(values: unknown[]): FieldType {
  const samples: string[] = [];
  const numericValues: number[] = [];
  
  for (const val of values.slice(0, 50)) {
    if (val !== null && val !== undefined) {
      if (typeof val === 'number') {
        numericValues.push(val);
      } else if (typeof val === 'string') {
        samples.push(val);
      } else {
        samples.push(String(val));
      }
    }
  }

  if (samples.length === 0 && numericValues.length === 0) {
    return 'string';
  }

  const typeCounts: Record<FieldType, number> = {
    string: 0,
    number: 0,
    boolean: 0,
    array: 0,
    object: 0,
    date: 0,
    email: 0,
    phone: 0
  };

  const total = samples.length + numericValues.length;

  for (const num of numericValues) {
    if (num >= 1000000000 && num <= 9999999999999) {
      typeCounts.date++;
    } else {
      typeCounts.number++;
    }
  }

  for (const sample of samples) {
    if (Array.isArray(sample) || sample.startsWith('[')) {
      typeCounts.array++;
      continue;
    }

    if (typeof sample === 'object' && sample !== null || sample.startsWith('{')) {
      typeCounts.object++;
      continue;
    }

    for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
      if (type === 'string' || type === 'array' || type === 'object') continue;
      
      for (const pattern of patterns) {
        if (pattern.test(sample)) {
          typeCounts[type as FieldType]++;
          break;
        }
      }
    }

    if (!typeCounts.date && !typeCounts.email && !typeCounts.phone && !typeCounts.number && !typeCounts.boolean) {
      typeCounts.string++;
    }
  }

  const threshold = total * 0.6;

  if (typeCounts.email >= threshold) return 'email';
  if (typeCounts.phone >= threshold) return 'phone';
  if (typeCounts.date >= threshold) return 'date';
  if (typeCounts.number >= threshold) return 'number';
  if (typeCounts.boolean >= threshold) return 'boolean';
  if (typeCounts.array >= threshold) return 'array';
  if (typeCounts.object >= threshold) return 'object';

  return 'string';
}

function calculateStringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }

  return costs[s2.length];
}

function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_\-\s]+/g, '_')
    .replace(/id$/i, '_id')
    .replace(/num$/i, '_number')
    .replace(/amt$/i, '_amount')
    .trim();
}

function findCanonicalMapping(fieldName: string): { canonical: string; confidence: number } | null {
  const normalized = normalizeFieldName(fieldName);
  
  for (const [canonical, aliases] of Object.entries(CANONICAL_FIELDS)) {
    if (aliases.some(alias => normalizeFieldName(alias) === normalized)) {
      return { canonical, confidence: 1.0 };
    }
  }

  let bestMatch: { canonical: string; score: number } | null = null;
  
  for (const [canonical, aliases] of Object.entries(CANONICAL_FIELDS)) {
    for (const alias of aliases) {
      const score = calculateStringSimilarity(normalized, normalizeFieldName(alias));
      if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { canonical, score };
      }
    }
  }

  if (bestMatch) {
    return { canonical: bestMatch.canonical, confidence: bestMatch.score };
  }

  return null;
}

async function aiInferSchema(
  fields: string[],
  samples: Record<string, unknown>[],
  _options: SchemaResolverOptions
): Promise<DetectedSchema | null> {
  if (!options.enableAiFallback || !options.llmEndpoint) {
    return null;
  }

  const sampleData = JSON.stringify(samples.slice(0, 5), null, 2);
  const fieldList = fields.join(', ');

  const prompt = `Analyze the following JSON data and detect the schema. 
For each field, identify:
1. The data type (string, number, boolean, date, email, phone, array, object)
2. The likely semantic meaning (body, date, contactName, address, messageType, etc.)

Fields: ${fieldList}
Sample data:
${sampleData}

Respond with a JSON object containing:
{
  "fields": [{"name": "...", "type": "...", "confidence": 0.0-1.0, "sample": "..."}],
  "confidence": 0.0-1.0,
  "suggestedMapping": {"fieldName": "canonicalName"}
}`;

  try {
    const response = await fetch(options.llmEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.llmApiKey && { 'Authorization': `Bearer ${options.llmApiKey}` })
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    
    if (content) {
      return JSON.parse(content) as DetectedSchema;
    }
  } catch {
    return null;
  }

  return null;
}

let options: SchemaResolverOptions = {};

export class SchemaResolver {
  private cache: Map<string, CachedSchema> = schemaCache;

  constructor(customOptions?: SchemaResolverOptions) {
    options = customOptions || {};
    if (options.cacheDir) {
      cacheDir = options.cacheDir;
    }
  }

  async detectSchema(data: unknown): Promise<DetectedSchema> {
    await loadCache();

    const contentHash = computeContentHash(data);

    if (this.cache.has(contentHash)) {
      const cached = this.cache.get(contentHash)!;
      return cached.schema;
    }

    let records: Record<string, unknown>[];
    
    if (Array.isArray(data)) {
      records = data as Record<string, unknown>[];
    } else if (typeof data === 'object' && data !== null) {
      records = [data as Record<string, unknown>];
    } else {
      throw new Error('Data must be an object or array of objects');
    }

    if (records.length === 0) {
      return {
        fields: [],
        confidence: 0,
        suggestedMapping: {}
      };
    }

    const fields = Object.keys(records[0]);
    const detectedFields: SchemaField[] = [];
    const suggestedMapping: Record<string, string> = {};
    let totalConfidence = 0;

    for (const field of fields) {
      const values = records.map(r => r[field]).filter(v => v !== undefined && v !== null);
      const type = detectFieldType(values);
      const sample = values.length > 0 ? String(values[0]) : '';
      const mapping = findCanonicalMapping(field);
      
      let confidence = 0.7;

      if (mapping) {
        confidence = 0.6 + (mapping.confidence * 0.3);
        suggestedMapping[field] = mapping.canonical;
      }

      if (values.length > 0) {
        const typeConfidence = values.filter(v => {
          const str = String(v);
          if (type === 'date') {
            return TYPE_PATTERNS.date.some(p => p.test(str));
          }
          if (type === 'email') {
            return TYPE_PATTERNS.email.some(p => p.test(str));
          }
          if (type === 'phone') {
            return TYPE_PATTERNS.phone.some(p => p.test(str));
          }
          if (type === 'number') {
            return TYPE_PATTERNS.number.some(p => p.test(str));
          }
          if (type === 'boolean') {
            return TYPE_PATTERNS.boolean.some(p => p.test(str));
          }
          return true;
        }).length / values.length;
        confidence *= (0.5 + typeConfidence * 0.5);
      }

      detectedFields.push({
        name: field,
        type,
        confidence: Math.min(0.99, confidence),
        sample: sample.slice(0, 100)
      });

      totalConfidence += confidence;
    }

    const overallConfidence = fields.length > 0 
      ? totalConfidence / fields.length 
      : 0;

    const schema: DetectedSchema = {
      fields: detectedFields,
      confidence: overallConfidence,
      suggestedMapping
    };

    if (options.enableAiFallback && overallConfidence < 0.8) {
      const aiSchema = await aiInferSchema(fields, records, options);
      if (aiSchema && aiSchema.confidence > overallConfidence) {
        return aiSchema;
      }
    }

    this.cache.set(contentHash, {
      hash: contentHash,
      schema,
      timestamp: new Date().toISOString()
    });

    await saveCache();

    return schema;
  }

  async mapToCanonical(data: unknown, mapping: Record<string, string>): Promise<unknown> {
    if (Array.isArray(data)) {
      return Promise.all(data.map(item => this.mapToCanonical(item, mapping)));
    }

    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const newKey = mapping[key] || key;
      result[newKey] = value;
    }

    return result;
  }

  cacheSchema(schema: DetectedSchema, hash: string): void {
    this.cache.set(hash, {
      hash,
      schema,
      timestamp: new Date().toISOString()
    });
  }

  async getCachedSchema(hash: string): Promise<DetectedSchema | null> {
    await loadCache();
    return this.cache.get(hash)?.schema || null;
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    await saveCache();
  }

  async getCacheStats(): Promise<{ size: number; hashes: string[] }> {
    await loadCache();
    return {
      size: this.cache.size,
      hashes: Array.from(this.cache.keys())
    };
  }

  async autoResolve(data: unknown, useAi?: boolean): Promise<{
    success: boolean;
    schema: DetectedSchema;
    transformed: unknown;
    method: string;
  }> {
    const schema = await this.detectSchema(data);
    
    if (schema.fields.length === 0) {
      return { success: false, schema, transformed: data, method: 'failed' };
    }

    const transformed = await this.mapToCanonical(data, schema.suggestedMapping);
    
    return {
      success: true,
      schema,
      transformed,
      method: schema.confidence > 0.8 ? 'heuristics' : 'ai_fallback'
    };
  }
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

const schemaResolverTools: ToolDefinition[] = [
  {
    name: 'schema.detect',
    description: 'Detect schema from unknown JSON data including field types and canonical mappings',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'object', description: 'JSON data to analyze (object or array of objects)' }
      },
      required: ['data']
    },
    handler: async (params: { data: unknown }) => {
      return new SchemaResolver().detectSchema(params.data);
    }
  },
  {
    name: 'schema.map',
    description: 'Map fields to canonical names using detected or provided mappings',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'object', description: 'Data to transform' },
        mapping: { type: 'object', description: 'Field mapping dictionary' }
      },
      required: ['data', 'mapping']
    },
    handler: async (params: { data: unknown; mapping: Record<string, string> }) => {
      return new SchemaResolver().mapToCanonical(params.data, params.mapping);
    }
  },
  {
    name: 'schema.auto_resolve',
    description: 'Detect schema and transform data in one step',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'object', description: 'Data to resolve and transform' },
        useAi: { type: 'boolean', description: 'Use AI for low-confidence detections' }
      },
      required: ['data']
    },
    handler: async (params: { data: unknown; useAi?: boolean }) => {
      return new SchemaResolver().autoResolve(params.data, params.useAi);
    }
  },
  {
    name: 'schema.cache_get',
    description: 'Retrieve a cached schema by hash',
    inputSchema: {
      type: 'object',
      properties: {
        hash: { type: 'string', description: 'Schema hash to look up' }
      },
      required: ['hash']
    },
    handler: async (params: { hash: string }) => {
      const instance = new SchemaResolver();
      return instance.getCachedSchema(params.hash);
    }
  },
  {
    name: 'schema.cache_stats',
    description: 'Get cache statistics',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => new SchemaResolver().getCacheStats()
  },
  {
    name: 'schema.cache_clear',
    description: 'Clear all cached schemas',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      await new SchemaResolver().clearCache();
      return { success: true };
    }
  }
];

export const schemaResolver = new SchemaResolver();
export { detectFieldType, findCanonicalMapping, computeContentHash, schemaResolverTools };
export default schemaResolver;
