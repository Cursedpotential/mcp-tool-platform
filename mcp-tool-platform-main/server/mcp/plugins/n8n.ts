/**
 * n8n Workflow Automation Integration
 * 
 * Provides integration with n8n for complex workflow orchestration:
 * - Trigger n8n workflows from MCP tools
 * - Register webhook endpoints for n8n to call back
 * - Check workflow execution status
 * - Pass credentials through for external services
 */

// ============================================================================
// Configuration
// ============================================================================

interface N8nConfig {
  enabled: boolean;
  url: string;
  apiKey?: string;
  webhookBaseUrl?: string;
}

const defaultConfig: N8nConfig = {
  enabled: false,
  url: process.env.N8N_URL || 'http://localhost:5678',
  apiKey: process.env.N8N_API_KEY,
  webhookBaseUrl: process.env.N8N_WEBHOOK_BASE_URL,
};

let config: N8nConfig = { ...defaultConfig };

/**
 * Configure n8n
 */
export function configureN8n(newConfig: Partial<N8nConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Check if n8n is enabled
 */
export function isN8nEnabled(): boolean {
  return config.enabled;
}

// ============================================================================
// Types
// ============================================================================

interface Workflow {
  id: string;
  name: string;
  active: boolean;
  nodes: number;
  createdAt: string;
  updatedAt: string;
}

interface Execution {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'error' | 'waiting';
  startedAt: string;
  finishedAt?: string;
  data?: unknown;
  error?: string;
}

interface WebhookRegistration {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  workflowId: string;
  fullUrl: string;
}

// ============================================================================
// Workflow Operations
// ============================================================================

/**
 * List all workflows
 */
export async function listWorkflows(args?: {
  active?: boolean;
  limit?: number;
}): Promise<{ workflows: Workflow[] }> {
  if (!config.enabled) {
    throw new Error('n8n is not enabled');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['X-N8N-API-KEY'] = config.apiKey;
  }
  
  const params = new URLSearchParams();
  if (args?.active !== undefined) {
    params.set('active', String(args.active));
  }
  if (args?.limit) {
    params.set('limit', String(args.limit));
  }
  
  const response = await fetch(`${config.url}/api/v1/workflows?${params}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`n8n list workflows failed: ${response.status}`);
  }
  
  const data = await response.json() as { data: Array<{ id: string; name: string; active: boolean; nodes: Array<unknown>; createdAt: string; updatedAt: string }> };
  
  return {
    workflows: (data.data || []).map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      nodes: w.nodes?.length || 0,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    })),
  };
}

/**
 * Get workflow details
 */
export async function getWorkflow(args: {
  id: string;
}): Promise<{ workflow: Workflow | null }> {
  if (!config.enabled) {
    throw new Error('n8n is not enabled');
  }
  
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['X-N8N-API-KEY'] = config.apiKey;
  }
  
  const response = await fetch(`${config.url}/api/v1/workflows/${args.id}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return { workflow: null };
    }
    throw new Error(`n8n get workflow failed: ${response.status}`);
  }
  
  const w = await response.json() as { id: string; name: string; active: boolean; nodes: Array<unknown>; createdAt: string; updatedAt: string };
  
  return {
    workflow: {
      id: w.id,
      name: w.name,
      active: w.active,
      nodes: w.nodes?.length || 0,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    },
  };
}

/**
 * Trigger a workflow execution
 */
export async function triggerWorkflow(args: {
  id: string;
  data?: Record<string, unknown>;
}): Promise<{ execution: Execution }> {
  if (!config.enabled) {
    throw new Error('n8n is not enabled');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['X-N8N-API-KEY'] = config.apiKey;
  }
  
  const response = await fetch(`${config.url}/api/v1/workflows/${args.id}/execute`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args.data || {}),
  });
  
  if (!response.ok) {
    throw new Error(`n8n trigger workflow failed: ${response.status}`);
  }
  
  const data = await response.json() as { data: { executionId: string } };
  
  return {
    execution: {
      id: data.data.executionId,
      workflowId: args.id,
      status: 'running',
      startedAt: new Date().toISOString(),
    },
  };
}

/**
 * Activate a workflow
 */
export async function activateWorkflow(args: {
  id: string;
  active: boolean;
}): Promise<{ workflow: Workflow }> {
  if (!config.enabled) {
    throw new Error('n8n is not enabled');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['X-N8N-API-KEY'] = config.apiKey;
  }
  
  const response = await fetch(`${config.url}/api/v1/workflows/${args.id}/${args.active ? 'activate' : 'deactivate'}`, {
    method: 'POST',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`n8n activate workflow failed: ${response.status}`);
  }
  
  const w = await response.json() as { id: string; name: string; active: boolean; nodes: Array<unknown>; createdAt: string; updatedAt: string };
  
  return {
    workflow: {
      id: w.id,
      name: w.name,
      active: w.active,
      nodes: w.nodes?.length || 0,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    },
  };
}

// ============================================================================
// Execution Operations
// ============================================================================

/**
 * Get execution status
 */
export async function getExecution(args: {
  id: string;
}): Promise<{ execution: Execution | null }> {
  if (!config.enabled) {
    throw new Error('n8n is not enabled');
  }
  
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['X-N8N-API-KEY'] = config.apiKey;
  }
  
  const response = await fetch(`${config.url}/api/v1/executions/${args.id}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return { execution: null };
    }
    throw new Error(`n8n get execution failed: ${response.status}`);
  }
  
  const e = await response.json() as { id: string; workflowId: string; status: string; startedAt: string; stoppedAt?: string; data?: unknown };
  
  return {
    execution: {
      id: e.id,
      workflowId: e.workflowId,
      status: e.status as Execution['status'],
      startedAt: e.startedAt,
      finishedAt: e.stoppedAt,
      data: e.data,
    },
  };
}

/**
 * List executions for a workflow
 */
export async function listExecutions(args: {
  workflowId?: string;
  status?: Execution['status'];
  limit?: number;
}): Promise<{ executions: Execution[] }> {
  if (!config.enabled) {
    throw new Error('n8n is not enabled');
  }
  
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['X-N8N-API-KEY'] = config.apiKey;
  }
  
  const params = new URLSearchParams();
  if (args.workflowId) {
    params.set('workflowId', args.workflowId);
  }
  if (args.status) {
    params.set('status', args.status);
  }
  if (args.limit) {
    params.set('limit', String(args.limit));
  }
  
  const response = await fetch(`${config.url}/api/v1/executions?${params}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`n8n list executions failed: ${response.status}`);
  }
  
  const data = await response.json() as { data: Array<{ id: string; workflowId: string; status: string; startedAt: string; stoppedAt?: string }> };
  
  return {
    executions: (data.data || []).map((e) => ({
      id: e.id,
      workflowId: e.workflowId,
      status: e.status as Execution['status'],
      startedAt: e.startedAt,
      finishedAt: e.stoppedAt,
    })),
  };
}

/**
 * Wait for execution to complete
 */
export async function waitForExecution(args: {
  id: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<{ execution: Execution; timedOut: boolean }> {
  if (!config.enabled) {
    throw new Error('n8n is not enabled');
  }
  
  const timeout = args.timeoutMs || 60000;
  const pollInterval = args.pollIntervalMs || 1000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const { execution } = await getExecution({ id: args.id });
    
    if (!execution) {
      throw new Error(`Execution ${args.id} not found`);
    }
    
    if (execution.status === 'success' || execution.status === 'error') {
      return { execution, timedOut: false };
    }
    
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
  
  const { execution } = await getExecution({ id: args.id });
  return {
    execution: execution || {
      id: args.id,
      workflowId: '',
      status: 'running',
      startedAt: '',
    },
    timedOut: true,
  };
}

// ============================================================================
// Webhook Operations
// ============================================================================

// In-memory webhook registry (in production, store in DB)
const webhookRegistry: Map<string, WebhookRegistration> = new Map();

/**
 * Register a webhook endpoint
 */
export async function registerWebhook(args: {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  workflowId: string;
}): Promise<{ webhook: WebhookRegistration }> {
  const method = args.method || 'POST';
  const id = `webhook-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  const webhook: WebhookRegistration = {
    id,
    path: args.path,
    method,
    workflowId: args.workflowId,
    fullUrl: `${config.webhookBaseUrl || config.url}/webhook/${args.path}`,
  };
  
  webhookRegistry.set(id, webhook);
  
  return { webhook };
}

/**
 * List registered webhooks
 */
export async function listWebhooks(): Promise<{ webhooks: WebhookRegistration[] }> {
  const webhooks: WebhookRegistration[] = [];
  webhookRegistry.forEach((webhook) => {
    webhooks.push(webhook);
  });
  return { webhooks };
}

/**
 * Unregister a webhook
 */
export async function unregisterWebhook(args: {
  id: string;
}): Promise<{ deleted: boolean }> {
  const deleted = webhookRegistry.delete(args.id);
  return { deleted };
}

/**
 * Call a webhook (for testing)
 */
export async function callWebhook(args: {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<{ status: number; data: unknown }> {
  const method = args.method || 'POST';
  const url = `${config.webhookBaseUrl || config.url}/webhook/${args.path}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...args.headers,
  };
  
  const response = await fetch(url, {
    method,
    headers,
    body: method !== 'GET' ? JSON.stringify(args.data || {}) : undefined,
  });
  
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = await response.text();
  }
  
  return {
    status: response.status,
    data,
  };
}

// ============================================================================
// Event Emission
// ============================================================================

/**
 * Emit an event to n8n (triggers webhook workflows)
 */
export async function emitEvent(args: {
  event: string;
  data: Record<string, unknown>;
  webhookPath?: string;
}): Promise<{ sent: boolean; response?: unknown }> {
  const path = args.webhookPath || `events/${args.event}`;
  
  try {
    const { status, data } = await callWebhook({
      path,
      method: 'POST',
      data: {
        event: args.event,
        timestamp: new Date().toISOString(),
        ...args.data,
      },
    });
    
    return {
      sent: status >= 200 && status < 300,
      response: data,
    };
  } catch (error) {
    console.warn('Failed to emit event to n8n:', error);
    return { sent: false };
  }
}

/**
 * Emit job completion event
 */
export async function emitJobComplete(args: {
  jobId: string;
  jobType: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
}): Promise<{ sent: boolean }> {
  return emitEvent({
    event: 'job.complete',
    data: {
      jobId: args.jobId,
      jobType: args.jobType,
      status: args.status,
      result: args.result,
      error: args.error,
    },
  });
}
