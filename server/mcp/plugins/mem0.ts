/**
 * mem0 Shared Context Plugin
 * 
 * Provides persistent memory layer for cross-agent context sharing.
 * Runs on Docker VPS, connected via Tailscale/Cloudflare Tunnel.
 * 
 * Features:
 * - Long-term memory storage
 * - Semantic memory search
 * - Memory scoping (agent, project, global)
 * - Cross-session context persistence
 */

// ============================================================================
// Configuration
// ============================================================================

interface Mem0Config {
  enabled: boolean;
  url: string;
  apiKey?: string;
  defaultUserId: string;
  defaultAgentId: string;
}

const defaultConfig: Mem0Config = {
  enabled: false,
  url: process.env.MEM0_URL || 'http://localhost:8000',
  apiKey: process.env.MEM0_API_KEY,
  defaultUserId: 'system',
  defaultAgentId: 'mcp-tool-shop',
};

let config: Mem0Config = { ...defaultConfig };

/**
 * Configure mem0
 */
export function configureMem0(newConfig: Partial<Mem0Config>): void {
  config = { ...config, ...newConfig };
}

/**
 * Check if mem0 is enabled
 */
export function isMem0Enabled(): boolean {
  return config.enabled;
}

// ============================================================================
// Types
// ============================================================================

interface Memory {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  userId?: string;
  agentId?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  score?: number;
}

type MemoryScope = 'agent' | 'project' | 'user' | 'global';

// ============================================================================
// Memory Operations
// ============================================================================

/**
 * Add a memory
 */
export async function addMemory(args: {
  content: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  agentId?: string;
  projectId?: string;
  scope?: MemoryScope;
}): Promise<{ memory: Memory; created: boolean }> {
  if (!config.enabled) {
    throw new Error('mem0 is not enabled');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  const body: Record<string, unknown> = {
    messages: [{ role: 'user', content: args.content }],
    user_id: args.userId || config.defaultUserId,
    agent_id: args.agentId || config.defaultAgentId,
    metadata: {
      ...args.metadata,
      scope: args.scope || 'agent',
      projectId: args.projectId,
    },
  };
  
  const response = await fetch(`${config.url}/v1/memories/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`mem0 add failed: ${response.status}`);
  }
  
  const data = await response.json() as { results: Array<{ id: string; memory: string; event: string }> };
  const result = data.results?.[0];
  
  const memory: Memory = {
    id: result?.id || `mem-${Date.now()}`,
    content: args.content,
    metadata: args.metadata || {},
    userId: args.userId,
    agentId: args.agentId,
    projectId: args.projectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  return {
    memory,
    created: result?.event === 'ADD',
  };
}

/**
 * Search memories semantically
 */
export async function searchMemories(args: {
  query: string;
  userId?: string;
  agentId?: string;
  projectId?: string;
  scope?: MemoryScope;
  limit?: number;
}): Promise<{ memories: Memory[] }> {
  if (!config.enabled) {
    throw new Error('mem0 is not enabled');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  const body: Record<string, unknown> = {
    query: args.query,
    user_id: args.userId || config.defaultUserId,
    agent_id: args.agentId || config.defaultAgentId,
    limit: args.limit || 10,
  };
  
  const response = await fetch(`${config.url}/v1/memories/search/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    throw new Error(`mem0 search failed: ${response.status}`);
  }
  
  const data = await response.json() as { results: Array<{ id: string; memory: string; score: number; metadata?: Record<string, unknown> }> };
  
  const memories: Memory[] = (data.results || []).map((r) => ({
    id: r.id,
    content: r.memory,
    metadata: r.metadata || {},
    score: r.score,
    createdAt: '',
    updatedAt: '',
  }));
  
  // Filter by scope/project if specified
  if (args.scope || args.projectId) {
    return {
      memories: memories.filter((m) => {
        if (args.scope && m.metadata.scope !== args.scope) return false;
        if (args.projectId && m.metadata.projectId !== args.projectId) return false;
        return true;
      }),
    };
  }
  
  return { memories };
}

/**
 * Get a specific memory by ID
 */
export async function getMemory(args: {
  id: string;
}): Promise<{ memory: Memory | null }> {
  if (!config.enabled) {
    throw new Error('mem0 is not enabled');
  }
  
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  const response = await fetch(`${config.url}/v1/memories/${args.id}/`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return { memory: null };
    }
    throw new Error(`mem0 get failed: ${response.status}`);
  }
  
  const data = await response.json() as { id: string; memory: string; metadata?: Record<string, unknown>; created_at?: string; updated_at?: string };
  
  return {
    memory: {
      id: data.id,
      content: data.memory,
      metadata: data.metadata || {},
      createdAt: data.created_at || '',
      updatedAt: data.updated_at || '',
    },
  };
}

/**
 * List all memories for a user/agent
 */
export async function listMemories(args: {
  userId?: string;
  agentId?: string;
  projectId?: string;
  scope?: MemoryScope;
  limit?: number;
  offset?: number;
}): Promise<{ memories: Memory[]; total: number }> {
  if (!config.enabled) {
    throw new Error('mem0 is not enabled');
  }
  
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  const params = new URLSearchParams();
  params.set('user_id', args.userId || config.defaultUserId);
  params.set('agent_id', args.agentId || config.defaultAgentId);
  if (args.limit) params.set('limit', String(args.limit));
  if (args.offset) params.set('offset', String(args.offset));
  
  const response = await fetch(`${config.url}/v1/memories/?${params}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`mem0 list failed: ${response.status}`);
  }
  
  const data = await response.json() as { results: Array<{ id: string; memory: string; metadata?: Record<string, unknown> }>; count?: number };
  
  let memories: Memory[] = (data.results || []).map((r) => ({
    id: r.id,
    content: r.memory,
    metadata: r.metadata || {},
    createdAt: '',
    updatedAt: '',
  }));
  
  // Filter by scope/project if specified
  if (args.scope || args.projectId) {
    memories = memories.filter((m) => {
      if (args.scope && m.metadata.scope !== args.scope) return false;
      if (args.projectId && m.metadata.projectId !== args.projectId) return false;
      return true;
    });
  }
  
  return {
    memories,
    total: data.count || memories.length,
  };
}

/**
 * Update a memory
 */
export async function updateMemory(args: {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<{ memory: Memory; updated: boolean }> {
  if (!config.enabled) {
    throw new Error('mem0 is not enabled');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  const response = await fetch(`${config.url}/v1/memories/${args.id}/`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      text: args.content,
      metadata: args.metadata,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`mem0 update failed: ${response.status}`);
  }
  
  return {
    memory: {
      id: args.id,
      content: args.content,
      metadata: args.metadata || {},
      createdAt: '',
      updatedAt: new Date().toISOString(),
    },
    updated: true,
  };
}

/**
 * Delete a memory
 */
export async function deleteMemory(args: {
  id: string;
}): Promise<{ deleted: boolean }> {
  if (!config.enabled) {
    throw new Error('mem0 is not enabled');
  }
  
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  const response = await fetch(`${config.url}/v1/memories/${args.id}/`, {
    method: 'DELETE',
    headers,
  });
  
  return { deleted: response.ok };
}

/**
 * Delete all memories for a user/agent
 */
export async function deleteAllMemories(args: {
  userId?: string;
  agentId?: string;
  projectId?: string;
}): Promise<{ deleted: number }> {
  if (!config.enabled) {
    throw new Error('mem0 is not enabled');
  }
  
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  const params = new URLSearchParams();
  params.set('user_id', args.userId || config.defaultUserId);
  params.set('agent_id', args.agentId || config.defaultAgentId);
  
  const response = await fetch(`${config.url}/v1/memories/?${params}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`mem0 delete all failed: ${response.status}`);
  }
  
  const data = await response.json() as { deleted?: number };
  return { deleted: data.deleted || 0 };
}

// ============================================================================
// Context Sharing Utilities
// ============================================================================

/**
 * Share context between agents
 */
export async function shareContext(args: {
  fromAgentId: string;
  toAgentId: string;
  query: string;
  limit?: number;
}): Promise<{ shared: Memory[]; count: number }> {
  if (!config.enabled) {
    throw new Error('mem0 is not enabled');
  }
  
  // Search memories from source agent
  const { memories } = await searchMemories({
    query: args.query,
    agentId: args.fromAgentId,
    limit: args.limit || 5,
  });
  
  // Copy to target agent
  const shared: Memory[] = [];
  for (const memory of memories) {
    const { memory: newMemory } = await addMemory({
      content: memory.content,
      metadata: {
        ...memory.metadata,
        sharedFrom: args.fromAgentId,
        originalId: memory.id,
      },
      agentId: args.toAgentId,
    });
    shared.push(newMemory);
  }
  
  return { shared, count: shared.length };
}

/**
 * Get conversation history for context
 */
export async function getConversationContext(args: {
  userId: string;
  agentId?: string;
  limit?: number;
}): Promise<{ context: string; memories: Memory[] }> {
  if (!config.enabled) {
    throw new Error('mem0 is not enabled');
  }
  
  const { memories } = await listMemories({
    userId: args.userId,
    agentId: args.agentId,
    limit: args.limit || 10,
  });
  
  const context = memories
    .map((m) => m.content)
    .join('\n\n');
  
  return { context, memories };
}

/**
 * Add memory from tool execution result
 */
export async function memorizeToolResult(args: {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  userId?: string;
  agentId?: string;
  projectId?: string;
}): Promise<{ memory: Memory }> {
  const content = `Tool: ${args.toolName}\nInput: ${JSON.stringify(args.input)}\nResult: ${JSON.stringify(args.output)}`;
  
  const { memory } = await addMemory({
    content,
    metadata: {
      type: 'tool_result',
      toolName: args.toolName,
      inputHash: hashObject(args.input),
    },
    userId: args.userId,
    agentId: args.agentId,
    projectId: args.projectId,
    scope: 'agent',
  });
  
  return { memory };
}

// ============================================================================
// Helpers
// ============================================================================

function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
