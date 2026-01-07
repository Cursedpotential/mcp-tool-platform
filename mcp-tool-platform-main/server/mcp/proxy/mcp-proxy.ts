/**
 * MCP Server Proxy/Aggregator
 * 
 * Consolidates multiple MCP servers into a single unified interface.
 * - Register remote MCP servers
 * - Proxy requests to appropriate servers
 * - Aggregate tools from all connected servers
 * - Health monitoring and load balancing
 */

import { nanoid } from 'nanoid';
import { logger } from '../realtime/log-stream';
import type { ToolSpec, ToolCard } from '../../../shared/mcp-types';

// ============================================================================
// Types
// ============================================================================

export type ServerTransport = 'stdio' | 'http' | 'websocket';
export type ServerStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: ServerTransport;
  endpoint: string; // URL for http/ws, command for stdio
  apiKey?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  enabled: boolean;
  tags?: string[];
  priority?: number; // For load balancing
}

export interface MCPServerState {
  config: MCPServerConfig;
  status: ServerStatus;
  lastHealthCheck: number;
  lastError?: string;
  latencyMs?: number;
  tools: ToolCard[];
  capabilities?: {
    supportsStreaming?: boolean;
    supportsCancel?: boolean;
    maxConcurrent?: number;
  };
}

export interface ProxyRequest {
  serverId?: string; // If specified, route to specific server
  toolName: string;
  args: Record<string, unknown>;
  timeout?: number;
}

export interface ProxyResponse {
  success: boolean;
  serverId: string;
  data?: unknown;
  error?: string;
  latencyMs: number;
}

// ============================================================================
// MCP Protocol Types (simplified)
// ============================================================================

interface MCPListToolsResponse {
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
  }>;
}

interface MCPCallToolResponse {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

// ============================================================================
// HTTP Transport Client
// ============================================================================

async function httpRequest<T>(
  endpoint: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
  timeout: number = 30000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json() as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// MCP Proxy Manager
// ============================================================================

class MCPProxyManager {
  private static instance: MCPProxyManager | null = null;
  private servers: Map<string, MCPServerState> = new Map();
  private toolToServer: Map<string, string[]> = new Map(); // toolName -> serverIds
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.startHealthChecks();
  }

  static getInstance(): MCPProxyManager {
    if (!MCPProxyManager.instance) {
      MCPProxyManager.instance = new MCPProxyManager();
    }
    return MCPProxyManager.instance;
  }

  // -------------------------------------------------------------------------
  // Server Management
  // -------------------------------------------------------------------------

  async registerServer(config: Omit<MCPServerConfig, 'id'>): Promise<MCPServerState> {
    const id = `server_${nanoid()}`;
    const fullConfig: MCPServerConfig = { ...config, id };

    const state: MCPServerState = {
      config: fullConfig,
      status: 'connecting',
      lastHealthCheck: 0,
      tools: [],
    };

    this.servers.set(id, state);

    // Try to connect and discover tools
    if (config.enabled) {
      await this.connectServer(id);
    }

    logger.info('proxy', `Registered MCP server: ${config.name}`, { serverId: id, endpoint: config.endpoint });
    return state;
  }

  async unregisterServer(serverId: string): Promise<boolean> {
    const state = this.servers.get(serverId);
    if (!state) return false;

    // Remove tool mappings
    for (const tool of state.tools) {
      const servers = this.toolToServer.get(tool.name);
      if (servers) {
        const filtered = servers.filter(s => s !== serverId);
        if (filtered.length > 0) {
          this.toolToServer.set(tool.name, filtered);
        } else {
          this.toolToServer.delete(tool.name);
        }
      }
    }

    this.servers.delete(serverId);
    logger.info('proxy', `Unregistered MCP server: ${state.config.name}`, { serverId });
    return true;
  }

  async updateServer(serverId: string, updates: Partial<MCPServerConfig>): Promise<MCPServerState | null> {
    const state = this.servers.get(serverId);
    if (!state) return null;

    state.config = { ...state.config, ...updates };

    // Reconnect if endpoint changed
    if (updates.endpoint || updates.transport) {
      await this.connectServer(serverId);
    }

    return state;
  }

  getServer(serverId: string): MCPServerState | undefined {
    return this.servers.get(serverId);
  }

  listServers(): MCPServerState[] {
    return Array.from(this.servers.values());
  }

  async clearServers(): Promise<void> {
    for (const serverId of Array.from(this.servers.keys())) {
      await this.unregisterServer(serverId);
    }
  }

  // -------------------------------------------------------------------------
  // Connection & Discovery
  // -------------------------------------------------------------------------

  private async connectServer(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) return;

    state.status = 'connecting';
    const startTime = Date.now();

    try {
      // Discover tools based on transport
      let tools: ToolCard[] = [];

      if (state.config.transport === 'http') {
        tools = await this.discoverHttpTools(state.config);
      } else if (state.config.transport === 'websocket') {
        tools = await this.discoverWebSocketTools(state.config);
      } else if (state.config.transport === 'stdio') {
        tools = await this.discoverStdioTools(state.config);
      }

      state.tools = tools;
      state.status = 'connected';
      state.latencyMs = Date.now() - startTime;
      state.lastHealthCheck = Date.now();
      state.lastError = undefined;

      // Update tool mappings
      for (const tool of tools) {
        const prefixedName = `${state.config.name}.${tool.name}`;
        const existing = this.toolToServer.get(prefixedName) || [];
        if (!existing.includes(serverId)) {
          this.toolToServer.set(prefixedName, [...existing, serverId]);
        }
      }

      logger.info('proxy', `Connected to MCP server: ${state.config.name}`, {
        serverId,
        toolCount: tools.length,
        latencyMs: state.latencyMs,
      });
    } catch (error) {
      state.status = 'error';
      state.lastError = error instanceof Error ? error.message : 'Unknown error';
      state.latencyMs = Date.now() - startTime;

      logger.error('proxy', `Failed to connect to MCP server: ${state.config.name}`, {
        serverId,
        error: state.lastError,
      });
    }
  }

  private async discoverHttpTools(config: MCPServerConfig): Promise<ToolCard[]> {
    const headers: Record<string, string> = { ...config.headers };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // Try MCP-style list_tools endpoint
    try {
      const response = await httpRequest<MCPListToolsResponse>(
        `${config.endpoint}/tools/list`,
        'POST',
        { method: 'tools/list' },
        headers,
        config.timeout || 10000
      );

      return response.tools.map(t => ({
        name: t.name,
        description: t.description || '',
        category: 'remote',
        tags: [],
      }));
    } catch {
      // Try alternative endpoint
      try {
        const response = await httpRequest<{ tools: ToolCard[] }>(
          `${config.endpoint}/api/tools`,
          'GET',
          undefined,
          headers,
          config.timeout || 10000
        );
        return response.tools.map(t => ({
          ...t,
          category: t.category || 'remote',
          tags: t.tags || [],
        }));
      } catch {
        return [];
      }
    }
  }

  private async discoverWebSocketTools(_config: MCPServerConfig): Promise<ToolCard[]> {
    // WebSocket discovery would require maintaining a connection
    // For now, return empty and let tools be discovered on first use
    logger.warn('proxy', 'WebSocket tool discovery not yet implemented');
    return [];
  }

  private async discoverStdioTools(_config: MCPServerConfig): Promise<ToolCard[]> {
    // Stdio discovery requires spawning the process
    // This would be implemented with child_process
    logger.warn('proxy', 'Stdio tool discovery not yet implemented');
    return [];
  }

  // -------------------------------------------------------------------------
  // Tool Invocation
  // -------------------------------------------------------------------------

  async invokeTool(request: ProxyRequest): Promise<ProxyResponse> {
    const startTime = Date.now();

    // Find server(s) that can handle this tool
    let serverId = request.serverId;

    if (!serverId) {
      const servers = this.toolToServer.get(request.toolName);
      if (!servers || servers.length === 0) {
        return {
          success: false,
          serverId: '',
          error: `No server found for tool: ${request.toolName}`,
          latencyMs: Date.now() - startTime,
        };
      }

      // Load balance: pick server with lowest latency that's connected
      serverId = this.selectBestServer(servers);
    }

    const state = this.servers.get(serverId);
    if (!state) {
      return {
        success: false,
        serverId: serverId || '',
        error: `Server not found: ${serverId}`,
        latencyMs: Date.now() - startTime,
      };
    }

    if (state.status !== 'connected') {
      return {
        success: false,
        serverId,
        error: `Server not connected: ${state.config.name} (${state.status})`,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      let result: unknown;

      // Extract the actual tool name (remove server prefix if present)
      const actualToolName = request.toolName.includes('.')
        ? request.toolName.split('.').slice(1).join('.')
        : request.toolName;

      if (state.config.transport === 'http') {
        result = await this.invokeHttpTool(state.config, actualToolName, request.args, request.timeout);
      } else {
        throw new Error(`Transport not supported for invocation: ${state.config.transport}`);
      }

      logger.info('proxy', `Tool invoked via proxy: ${request.toolName}`, {
        serverId,
        serverName: state.config.name,
        latencyMs: Date.now() - startTime,
      });

      return {
        success: true,
        serverId,
        data: result,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      logger.error('proxy', `Tool invocation failed: ${request.toolName}`, {
        serverId,
        serverName: state.config.name,
        error: errorMsg,
      });

      return {
        success: false,
        serverId,
        error: errorMsg,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private async invokeHttpTool(
    config: MCPServerConfig,
    toolName: string,
    args: Record<string, unknown>,
    timeout?: number
  ): Promise<unknown> {
    const headers: Record<string, string> = { ...config.headers };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // Try MCP-style call_tool endpoint
    try {
      const response = await httpRequest<MCPCallToolResponse>(
        `${config.endpoint}/tools/call`,
        'POST',
        {
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        },
        headers,
        timeout || config.timeout || 30000
      );

      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Tool returned error');
      }

      return response.content;
    } catch {
      // Try alternative endpoint
      const response = await httpRequest<{ success: boolean; data?: unknown; error?: string }>(
        `${config.endpoint}/api/tools/${toolName}/invoke`,
        'POST',
        args,
        headers,
        timeout || config.timeout || 30000
      );

      if (!response.success) {
        throw new Error(response.error || 'Tool invocation failed');
      }

      return response.data;
    }
  }

  private selectBestServer(serverIds: string[]): string {
    let bestServer = serverIds[0];
    let bestScore = Infinity;

    for (const serverId of serverIds) {
      const state = this.servers.get(serverId);
      if (!state || state.status !== 'connected') continue;

      // Score based on latency and priority
      const latencyScore = state.latencyMs || 1000;
      const priorityScore = (state.config.priority || 50) * 10;
      const score = latencyScore - priorityScore;

      if (score < bestScore) {
        bestScore = score;
        bestServer = serverId;
      }
    }

    return bestServer;
  }

  // -------------------------------------------------------------------------
  // Aggregated Tool Discovery
  // -------------------------------------------------------------------------

  getAllTools(): ToolCard[] {
    const tools: ToolCard[] = [];

    for (const state of Array.from(this.servers.values())) {
      if (state.status !== 'connected') continue;

      for (const tool of state.tools) {
      tools.push({
        name: `${state.config.name}.${tool.name}`,
        description: `[${state.config.name}] ${tool.description}`,
        category: tool.category || 'remote',
        tags: [...(tool.tags || []), state.config.name],
      });
      }
    }

    return tools;
  }

  getToolSpec(toolName: string): ToolSpec | null {
    const serverIds = this.toolToServer.get(toolName);
    if (!serverIds || serverIds.length === 0) return null;

    const state = this.servers.get(serverIds[0]);
    if (!state) return null;

    const actualToolName = toolName.includes('.')
      ? toolName.split('.').slice(1).join('.')
      : toolName;

    const tool = state.tools.find(t => t.name === actualToolName);
    if (!tool) return null;

    return {
      name: toolName,
      category: tool.category || 'remote',
      description: tool.description,
      version: '1.0.0',
      tags: [...(tool.tags || []), ...(state.config.tags || [])],
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      outputSchema: {
        type: 'object',
        properties: {},
      },
      permissions: ['read:network' as const],
    };
  }

  // -------------------------------------------------------------------------
  // Health Checks
  // -------------------------------------------------------------------------

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [serverId, state] of Array.from(this.servers.entries())) {
        if (!state.config.enabled) continue;

        const timeSinceLastCheck = Date.now() - state.lastHealthCheck;
        if (timeSinceLastCheck > 60000) { // Check every minute
          await this.checkServerHealth(serverId);
        }
      }
    }, 30000);
  }

  private async checkServerHealth(serverId: string): Promise<void> {
    const state = this.servers.get(serverId);
    if (!state) return;

    const startTime = Date.now();

    try {
      if (state.config.transport === 'http') {
        const headers: Record<string, string> = { ...state.config.headers };
        if (state.config.apiKey) {
          headers['Authorization'] = `Bearer ${state.config.apiKey}`;
        }

        await httpRequest<unknown>(
          `${state.config.endpoint}/health`,
          'GET',
          undefined,
          headers,
          5000
        );
      }

      state.status = 'connected';
      state.latencyMs = Date.now() - startTime;
      state.lastHealthCheck = Date.now();
      state.lastError = undefined;
    } catch (error) {
      state.status = 'error';
      state.lastError = error instanceof Error ? error.message : 'Health check failed';
      state.lastHealthCheck = Date.now();
    }
  }

  async refreshServer(serverId: string): Promise<void> {
    await this.connectServer(serverId);
  }

  // -------------------------------------------------------------------------
  // Migration Helper
  // -------------------------------------------------------------------------

  generateMigrationConfig(serverId: string): {
    dockerCompose: string;
    envVars: Record<string, string>;
    instructions: string;
  } | null {
    const state = this.servers.get(serverId);
    if (!state) return null;

    const envVars: Record<string, string> = {
      [`MCP_${state.config.name.toUpperCase()}_ENDPOINT`]: state.config.endpoint,
    };

    if (state.config.apiKey) {
      envVars[`MCP_${state.config.name.toUpperCase()}_API_KEY`] = '${SECRET}';
    }

    const dockerCompose = `
# Docker Compose configuration for ${state.config.name}
services:
  ${state.config.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}:
    image: your-mcp-server-image
    environment:
      - PORT=8080
    ports:
      - "8080:8080"
    restart: unless-stopped
`;

    const instructions = `
Migration Instructions for ${state.config.name}:

1. Deploy the MCP server using Docker or your preferred method
2. Update the endpoint URL in the proxy configuration
3. Set the API key if required
4. Test the connection using the health check endpoint
5. Verify tool discovery is working

Current Configuration:
- Transport: ${state.config.transport}
- Endpoint: ${state.config.endpoint}
- Tools: ${state.tools.length}
`;

    return { dockerCompose, envVars, instructions };
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.servers.clear();
    this.toolToServer.clear();
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getMCPProxy(): MCPProxyManager {
  return MCPProxyManager.getInstance();
}
