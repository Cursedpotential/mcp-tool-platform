import { z } from 'zod';
import type { MCPServerConfig, ServerTransport } from './mcp-proxy';

export interface ImportedMcpServer {
  name: string;
  config: Omit<MCPServerConfig, 'id'>;
  source: string;
}

const mcpServerEntrySchema = z.object({
  url: z.string().optional(),
  endpoint: z.string().optional(),
  transport: z.enum(['http', 'websocket', 'stdio']).optional(),
  apiKey: z.string().optional(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
  retryAttempts: z.number().int().nonnegative().optional(),
  enabled: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
  description: z.string().optional(),
});

const mcpServersSchema = z.object({
  mcpServers: z.record(mcpServerEntrySchema),
});

const genericServersSchema = z.object({
  servers: z.array(z.object({
    name: z.string(),
    endpoint: z.string(),
    transport: z.enum(['http', 'websocket', 'stdio']).optional(),
    apiKey: z.string().optional(),
    headers: z.record(z.string()).optional(),
    timeout: z.number().int().positive().optional(),
    retryAttempts: z.number().int().nonnegative().optional(),
    enabled: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    priority: z.number().int().optional(),
    description: z.string().optional(),
  })),
});

function normalizeTransport(value: string | undefined): ServerTransport {
  if (value === 'websocket' || value === 'stdio') {
    return value;
  }
  return 'http';
}

function normalizeEndpoint(entry: z.infer<typeof mcpServerEntrySchema>): string | null {
  return entry.endpoint ?? entry.url ?? null;
}

export function importMcpServersFromConfig(payload: unknown): ImportedMcpServer[] {
  const servers: ImportedMcpServer[] = [];

  const parsedMcpServers = mcpServersSchema.safeParse(payload);
  if (parsedMcpServers.success) {
    for (const [name, entry] of Object.entries(parsedMcpServers.data.mcpServers)) {
      const endpoint = normalizeEndpoint(entry);
      if (!endpoint) continue;

      servers.push({
        name,
        source: 'mcpServers',
        config: {
          name,
          description: entry.description,
          transport: normalizeTransport(entry.transport),
          endpoint,
          apiKey: entry.apiKey,
          headers: entry.headers,
          timeout: entry.timeout,
          retryAttempts: entry.retryAttempts,
          enabled: entry.enabled ?? true,
          tags: entry.tags,
          priority: entry.priority,
        },
      });
    }
  }

  const parsedGeneric = genericServersSchema.safeParse(payload);
  if (parsedGeneric.success) {
    for (const entry of parsedGeneric.data.servers) {
      servers.push({
        name: entry.name,
        source: 'servers',
        config: {
          name: entry.name,
          description: entry.description,
          transport: normalizeTransport(entry.transport),
          endpoint: entry.endpoint,
          apiKey: entry.apiKey,
          headers: entry.headers,
          timeout: entry.timeout,
          retryAttempts: entry.retryAttempts,
          enabled: entry.enabled ?? true,
          tags: entry.tags,
          priority: entry.priority,
        },
      });
    }
  }

  return servers;
}
