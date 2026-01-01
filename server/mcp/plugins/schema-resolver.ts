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

// Standard schema fields
const STANDARD_FIELDS: Record<string, string[]> = {
  body: ['body', 'text', 'message', 'content', 'msg', 'sms_body', 'messageBody'],
  date: ['date', 'timestamp', 'time', 'datetime', 'sent_at', 'created_at', 'sentAt', 'createdAt'],
  readableDate: ['readable_date', 'readableDate', 'formatted_date', 'formattedDate', 'dateString'],
  contactName: ['contact_name', 'contactName', 'sender', 'from', 'name', 'author', 'displayName'],
  address: ['address', 'phone', 'number', 'phone_number', 'phoneNumber', 'tel', 'recipient'],
  messageType: ['type', 'messageType', 'message_type', 'direction', 'msgType']
};

// Field mapping result
interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'content' | 'ai' | 'cached';
}

// Schema mapping (cached)
interface SchemaMapping {
  sourceHash: string;
  sourceFields: string[];
  mappings: FieldMapping[];
  createdAt: string;
  usedCount: number;
}

// Cache storage
const CACHE_DIR = path.join(os.homedir(), '.mcp-tool-shop', 'schema_cache');
const CACHE_FILE = path.join(CACHE_DIR, 'mappings.json');

// In-memory cache
let mappingsCache: Map<string, SchemaMapping> = new Map();
let cacheLoaded = false;

// Load cache from disk
async function loadCache(): Promise<void> {
  if (cacheLoaded) return;
  
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    mappingsCache = new Map(Object.entries(parsed));
    cacheLoaded = true;
  } catch {
    mappingsCache = new Map();
    cacheLoaded = true;
  }
}

// Save cache to disk
async function saveCache(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const data = Object.fromEntries(mappingsCache);
  await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
}

// Hash field names for cache lookup
function hashFields(fields: string[]): string {
  const normalized = fields.map(f => f.toLowerCase()).sort().join('|');
  return crypto.createHash('md5').update(normalized).digest('hex').slice(0, 12);
}

// Exact match against standard field aliases
function exactMatch(sourceFields: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const sourceLower = new Map(sourceFields.map(f => [f.toLowerCase(), f]));
  
  for (const [target, aliases] of Object.entries(STANDARD_FIELDS)) {
    for (const alias of aliases) {
      const original = sourceLower.get(alias.toLowerCase());
      if (original) {
        mappings.push({
          sourceField: original,
          targetField: target,
          confidence: 1.0,
          method: 'exact'
        });
        break;
      }
    }
  }
  
  return mappings;
}

// Fuzzy match using substring matching
function fuzzyMatch(sourceFields: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const used = new Set<string>();
  
  for (const [target, aliases] of Object.entries(STANDARD_FIELDS)) {
    let bestMatch: { field: string; score: number } | null = null;
    
    for (const src of sourceFields) {
      if (used.has(src)) continue;
      
      for (const alias of aliases) {
        const srcLower = src.toLowerCase();
        const aliasLower = alias.toLowerCase();
        
        // Check if one contains the other
        if (srcLower.includes(aliasLower) || aliasLower.includes(srcLower)) {
          const score = Math.min(alias.length, src.length) / Math.max(alias.length, src.length);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { field: src, score };
          }
        }
      }
    }
    
    if (bestMatch && bestMatch.score > 0.3) {
      mappings.push({
        sourceField: bestMatch.field,
        targetField: target,
        confidence: bestMatch.score,
        method: 'fuzzy'
      });
      used.add(bestMatch.field);
    }
  }
  
  return mappings;
}

// Content-based analysis (detect field types from values)
function contentAnalysis(sample: Record<string, any>[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  const patterns: Map<string, string[]> = new Map();
  
  // Analyze first 10 records
  for (const rec of sample.slice(0, 10)) {
    for (const [field, val] of Object.entries(rec)) {
      if (!val) continue;
      
      const v = String(val);
      const types = patterns.get(field) || [];
      
      // Date patterns
      if (/^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{10,13}$/.test(v)) {
        types.push('date');
      }
      // Phone patterns
      else if (/^[\+\d\(\)\-\s]{7,}$/.test(v)) {
        types.push('phone');
      }
      // Long text (likely message body)
      else if (v.length > 50) {
        types.push('text');
      }
      // Short text (likely name)
      else if (v.length > 2 && v.length < 50 && /^[A-Za-z\s]+$/.test(v)) {
        types.push('name');
      }
      
      patterns.set(field, types);
    }
  }
  
  // Map detected types to standard fields
  const used = new Set<string>();
  
  for (const [field, types] of Array.from(patterns.entries())) {
    if (!types.length) continue;
    
    // Find most common type
    const counts = types.reduce((acc: Record<string, number>, t: string) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const sorted = Object.entries(counts).sort((a: [string, number], b: [string, number]) => b[1] - a[1]);
    const mostCommon = sorted.length > 0 ? sorted[0][0] : null;
    
    if (mostCommon === 'date' && !used.has('date')) {
      mappings.push({ sourceField: field, targetField: 'date', confidence: 0.7, method: 'content' });
      used.add('date');
    } else if (mostCommon === 'phone' && !used.has('address')) {
      mappings.push({ sourceField: field, targetField: 'address', confidence: 0.7, method: 'content' });
      used.add('address');
    } else if (mostCommon === 'text' && !used.has('body')) {
      mappings.push({ sourceField: field, targetField: 'body', confidence: 0.7, method: 'content' });
      used.add('body');
    } else if (mostCommon === 'name' && !used.has('contactName')) {
      mappings.push({ sourceField: field, targetField: 'contactName', confidence: 0.6, method: 'content' });
      used.add('contactName');
    }
  }
  
  return mappings;
}

// AI-powered resolution (last resort)
async function aiResolve(
  sourceFields: string[],
  sample: Record<string, any>[],
  llmEndpoint?: string
): Promise<FieldMapping[]> {
  // This would call the LLM provider hub
  // For now, return empty - implement when LLM integration is wired
  console.log('AI resolution requested but not yet implemented');
  return [];
}

// Main resolution function
async function resolve(
  sourceFields: string[],
  sample: Record<string, any>[] = [],
  useCache: boolean = true,
  useAi: boolean = false
): Promise<{ mappings: FieldMapping[]; method: string }> {
  await loadCache();
  
  const hash = hashFields(sourceFields);
  
  // Check cache first
  if (useCache && mappingsCache.has(hash)) {
    const cached = mappingsCache.get(hash)!;
    cached.usedCount++;
    await saveCache();
    return {
      mappings: cached.mappings.map(m => ({ ...m, method: 'cached' as const })),
      method: 'cached'
    };
  }
  
  // Try exact match
  let mappings = exactMatch(sourceFields);
  if (mappings.length >= 2) {
    return { mappings, method: 'exact' };
  }
  
  // Try fuzzy match
  const fuzzy = fuzzyMatch(sourceFields);
  const existingTargets = new Set(mappings.map(m => m.targetField));
  mappings.push(...fuzzy.filter(m => !existingTargets.has(m.targetField)));
  
  if (mappings.length >= 2) {
    return { mappings, method: 'fuzzy' };
  }
  
  // Try content analysis
  if (sample.length > 0) {
    const content = contentAnalysis(sample);
    const targets = new Set(mappings.map(m => m.targetField));
    mappings.push(...content.filter(m => !targets.has(m.targetField)));
  }
  
  if (mappings.length >= 1) {
    return { mappings, method: 'content' };
  }
  
  // AI resolution as last resort
  if (useAi) {
    const aiMappings = await aiResolve(sourceFields, sample);
    if (aiMappings.length > 0) {
      return { mappings: aiMappings, method: 'ai' };
    }
  }
  
  return { mappings, method: mappings.length > 0 ? 'partial' : 'failed' };
}

// Save mapping to cache
async function saveMapping(sourceFields: string[], mappings: FieldMapping[]): Promise<void> {
  await loadCache();
  
  const hash = hashFields(sourceFields);
  mappingsCache.set(hash, {
    sourceHash: hash,
    sourceFields,
    mappings,
    createdAt: new Date().toISOString(),
    usedCount: 1
  });
  
  await saveCache();
}

// Apply mapping to transform data
function applyMapping(data: Record<string, any>[], mappings: FieldMapping[]): Record<string, any>[] {
  const mappingDict = new Map(mappings.map(m => [m.sourceField, m.targetField]));
  
  return data.map(rec => {
    const transformed: Record<string, any> = {};
    for (const [key, val] of Object.entries(rec)) {
      const newKey = mappingDict.get(key) || `_orig_${key}`;
      transformed[newKey] = val;
    }
    return transformed;
  });
}

// Get cache statistics
async function getCacheStats(): Promise<{
  total: number;
  mappings: Array<{ hash: string; fields: string[]; used: number }>;
}> {
  await loadCache();
  
  return {
    total: mappingsCache.size,
    mappings: Array.from(mappingsCache.values()).map(m => ({
      hash: m.sourceHash,
      fields: m.sourceFields,
      used: m.usedCount
    }))
  };
}

// Clear cache
async function clearCache(): Promise<void> {
  mappingsCache.clear();
  await saveCache();
}

// Tool definitions for MCP registry
export const schemaResolverTools = [
  {
    name: 'schema.resolve',
    description: 'Resolve unknown field names to standard schema (body, date, contactName, address). Uses heuristics first, AI as last resort.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFields: { type: 'array', items: { type: 'string' }, description: 'Field names from source data' },
        sample: { type: 'array', items: { type: 'object' }, description: 'Sample records for content analysis' },
        useCache: { type: 'boolean', description: 'Use cached mappings', default: true },
        useAi: { type: 'boolean', description: 'Allow AI resolution as fallback', default: false }
      },
      required: ['sourceFields']
    },
    handler: async (params: {
      sourceFields: string[];
      sample?: Record<string, any>[];
      useCache?: boolean;
      useAi?: boolean;
    }) => {
      return resolve(
        params.sourceFields,
        params.sample || [],
        params.useCache !== false,
        params.useAi || false
      );
    }
  },
  {
    name: 'schema.apply',
    description: 'Apply field mappings to transform data to standard schema',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' }, description: 'Data to transform' },
        mappings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sourceField: { type: 'string' },
              targetField: { type: 'string' }
            }
          },
          description: 'Field mappings to apply'
        }
      },
      required: ['data', 'mappings']
    },
    handler: async (params: { data: Record<string, any>[]; mappings: FieldMapping[] }) => {
      const transformed = applyMapping(params.data, params.mappings);
      return {
        success: true,
        count: transformed.length,
        sample: transformed.slice(0, 5)
      };
    }
  },
  {
    name: 'schema.auto_resolve',
    description: 'Automatically resolve schema and transform data in one step',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' }, description: 'Raw data to resolve and transform' },
        useAi: { type: 'boolean', description: 'Allow AI resolution', default: false }
      },
      required: ['data']
    },
    handler: async (params: { data: Record<string, any>[]; useAi?: boolean }) => {
      if (!params.data.length) {
        return { success: false, error: 'Empty data', transformed: [], mappings: [], method: 'empty' };
      }
      
      const sourceFields = Object.keys(params.data[0]);
      const { mappings, method } = await resolve(sourceFields, params.data, true, params.useAi || false);
      
      if (!mappings.length) {
        return { success: false, error: 'Could not resolve schema', transformed: params.data, mappings: [], method };
      }
      
      const transformed = applyMapping(params.data, mappings);
      await saveMapping(sourceFields, mappings);
      
      return {
        success: true,
        method,
        mappings,
        transformed: transformed.slice(0, 10),
        totalCount: transformed.length
      };
    }
  },
  {
    name: 'schema.cache_stats',
    description: 'Get schema mapping cache statistics',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => getCacheStats()
  },
  {
    name: 'schema.clear_cache',
    description: 'Clear all cached schema mappings',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      await clearCache();
      return { success: true };
    }
  },
  {
    name: 'schema.save_mapping',
    description: 'Manually save a schema mapping to cache',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFields: { type: 'array', items: { type: 'string' } },
        mappings: { type: 'array', items: { type: 'object' } }
      },
      required: ['sourceFields', 'mappings']
    },
    handler: async (params: { sourceFields: string[]; mappings: FieldMapping[] }) => {
      await saveMapping(params.sourceFields, params.mappings);
      return { success: true, hash: hashFields(params.sourceFields) };
    }
  }
];

export { resolve, applyMapping, saveMapping, getCacheStats, clearCache };
export default schemaResolverTools;
