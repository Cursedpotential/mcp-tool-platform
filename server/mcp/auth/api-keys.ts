/**
 * API Key Management for MCP Client Authentication
 * 
 * Generates, validates, and manages API keys for external MCP clients.
 */

import { randomBytes, createHash } from 'crypto';
import { getDb } from '../../db';
import { apiKeys, apiKeyUsageLogs, type ApiKey, type InsertApiKey } from '../../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface ApiKeyPermission {
  resource: string; // e.g., 'tools', 'config', 'admin'
  actions: ('read' | 'write' | 'execute')[];
}

export interface CreateApiKeyRequest {
  userId: number;
  name: string;
  permissions?: ApiKeyPermission[];
  expiresInDays?: number;
}

export interface ApiKeyWithPlaintext extends Omit<ApiKey, 'keyHash'> {
  plainKey: string; // Only returned on creation
}

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  reason?: string;
}

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a new API key
 * Format: mcp_sk_{random_32_bytes_hex}
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(32).toString('hex');
  return `mcp_sk_${randomPart}`;
}

/**
 * Hash an API key for storage
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Extract prefix from key for display (first 12 chars)
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 12);
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new API key
 */
export async function createApiKey(request: CreateApiKeyRequest): Promise<ApiKeyWithPlaintext> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);
  const keyPrefix = getKeyPrefix(plainKey);

  const expiresAt = request.expiresInDays
    ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const insertData: InsertApiKey = {
    userId: request.userId,
    name: request.name,
    keyHash,
    keyPrefix,
    permissions: JSON.stringify(request.permissions || []),
    expiresAt: expiresAt || undefined,
    isActive: 'true',
    usageCount: 0,
  };

  const result = await db.insert(apiKeys).values(insertData);
  const insertedId = Number(result[0].insertId);

  const created = await db.select().from(apiKeys).where(eq(apiKeys.id, insertedId)).limit(1);
  if (!created[0]) throw new Error('Failed to retrieve created API key');

  return {
    ...created[0],
    plainKey, // Only returned once
  };
}

/**
 * List API keys for a user
 */
export async function listApiKeys(userId: number): Promise<ApiKey[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
}

/**
 * Get API key by ID
 */
export async function getApiKeyById(id: number): Promise<ApiKey | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .update(apiKeys)
    .set({ isActive: 'false' })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));

  return result[0].affectedRows > 0;
}

/**
 * Delete an API key
 */
export async function deleteApiKey(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));

  return result[0].affectedRows > 0;
}

/**
 * Rotate an API key (create new, revoke old)
 */
export async function rotateApiKey(id: number, userId: number): Promise<ApiKeyWithPlaintext | null> {
  const db = await getDb();
  if (!db) return null;

  // Get old key
  const oldKey = await getApiKeyById(id);
  if (!oldKey || oldKey.userId !== userId) return null;

  // Create new key with same permissions
  const newKey = await createApiKey({
    userId,
    name: `${oldKey.name} (rotated)`,
    permissions: JSON.parse(oldKey.permissions),
  });

  // Revoke old key
  await revokeApiKey(id, userId);

  return newKey;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate an API key from request header
 */
export async function validateApiKey(key: string): Promise<ApiKeyValidationResult> {
  if (!key || !key.startsWith('mcp_sk_')) {
    return { valid: false, reason: 'Invalid key format' };
  }

  const db = await getDb();
  if (!db) {
    return { valid: false, reason: 'Database not available' };
  }

  const keyHash = hashApiKey(key);
  const result = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);

  if (!result[0]) {
    return { valid: false, reason: 'Key not found' };
  }

  const apiKey = result[0];

  if (apiKey.isActive !== 'true') {
    return { valid: false, reason: 'Key is inactive' };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, reason: 'Key has expired' };
  }

  // Update last used timestamp and usage count
  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      usageCount: apiKey.usageCount + 1,
    })
    .where(eq(apiKeys.id, apiKey.id));

  return { valid: true, apiKey };
}

/**
 * Check if API key has permission for a resource/action
 */
export function hasPermission(
  apiKey: ApiKey,
  resource: string,
  action: 'read' | 'write' | 'execute'
): boolean {
  const permissions: ApiKeyPermission[] = JSON.parse(apiKey.permissions);
  
  // Check for wildcard permission
  const wildcardPerm = permissions.find(p => p.resource === '*');
  if (wildcardPerm && wildcardPerm.actions.includes('*' as any)) {
    return true;
  }

  // Check for specific resource permission
  const resourcePerm = permissions.find(p => p.resource === resource);
  if (resourcePerm && (resourcePerm.actions.includes(action) || resourcePerm.actions.includes('*' as any))) {
    return true;
  }

  return false;
}

// ============================================================================
// Usage Logging
// ============================================================================

/**
 * Log API key usage for audit trail
 */
export async function logApiKeyUsage(params: {
  apiKeyId: number;
  toolName?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
  tokensUsed?: number;
  cost?: number; // in cents
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(apiKeyUsageLogs).values({
    apiKeyId: params.apiKeyId,
    toolName: params.toolName,
    method: params.method,
    statusCode: params.statusCode,
    latencyMs: params.latencyMs,
    tokensUsed: params.tokensUsed,
    cost: params.cost,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Get usage stats for an API key
 */
export async function getApiKeyUsageStats(apiKeyId: number): Promise<{
  totalCalls: number;
  totalTokens: number;
  totalCost: number; // in cents
  avgLatencyMs: number;
  successRate: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalCalls: 0,
      totalTokens: 0,
      totalCost: 0,
      avgLatencyMs: 0,
      successRate: 0,
    };
  }

  const logs = await db.select().from(apiKeyUsageLogs).where(eq(apiKeyUsageLogs.apiKeyId, apiKeyId));

  const totalCalls = logs.length;
  const totalTokens = logs.reduce((sum, log) => sum + (log.tokensUsed || 0), 0);
  const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const avgLatencyMs = logs.length > 0
    ? logs.reduce((sum, log) => sum + (log.latencyMs || 0), 0) / logs.length
    : 0;
  const successfulCalls = logs.filter(log => log.statusCode && log.statusCode >= 200 && log.statusCode < 300).length;
  const successRate = totalCalls > 0 ? successfulCalls / totalCalls : 0;

  return {
    totalCalls,
    totalTokens,
    totalCost,
    avgLatencyMs,
    successRate,
  };
}
