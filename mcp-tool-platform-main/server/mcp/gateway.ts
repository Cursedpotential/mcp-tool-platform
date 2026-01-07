/**
 * MCP Gateway API
 * 
 * Token-efficient gateway exposing 4 core endpoints:
 * - search_tools: Discover tools with minimal token overhead
 * - describe_tool: Get full tool specification on demand
 * - invoke_tool: Execute tools with reference-based returns
 * - get_ref: Retrieve content-addressed artifacts with paging
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { getContentStore } from './store/content-store';
import { getPluginRegistry } from './plugins/registry';
import { getTaskExecutor } from './workers/executor';
import { getMCPProxy } from './proxy/mcp-proxy';
import { importMcpServersFromConfig } from './proxy/mcp-config-import';
import { LLMProviderHub } from './llm/provider-hub';
import type {
  ToolCard,
  ToolSpec,
  InvokeRequest,
  InvokeResult,
  PagedContent,
  ContentRef,
  ApiResponse,
} from '../../shared/mcp-types';
import type { WorkflowTemplate } from '../../shared/workflow-types';
import { nanoid } from 'nanoid';

// ============================================================================
// Input Schemas
// ============================================================================

const searchToolsInput = z.object({
  query: z.string().min(1).max(200),
  topK: z.number().int().min(1).max(50).default(10),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const describeToolInput = z.object({
  toolName: z.string().min(1).max(100),
});

const invokeToolInput = z.object({
  toolName: z.string().min(1).max(100),
  args: z.record(z.string(), z.unknown()),
  options: z.object({
    timeout: z.number().int().min(1000).max(300000).optional(),
    maxOutputSize: z.number().int().min(1).max(10485760).optional(),
    returnRef: z.boolean().optional(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
  }).optional(),
});

const getRefInput = z.object({
  ref: z.string().refine((s): s is ContentRef => s.startsWith('sha256:'), {
    message: 'Invalid content reference format',
  }),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(256).max(65536).optional(),
});

const registerMcpServerInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  transport: z.enum(['http', 'websocket', 'stdio']).default('http'),
  endpoint: z.string().min(1),
  apiKey: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  timeout: z.number().int().positive().optional(),
  retryAttempts: z.number().int().nonnegative().optional(),
  enabled: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
});

const importMcpServersInput = z.object({
  config: z.unknown(),
  replaceExisting: z.boolean().optional(),
});

const unregisterMcpServerInput = z.object({
  serverId: z.string().min(1),
});

const refreshMcpServerInput = z.object({
  serverId: z.string().min(1),
});

const recommendToolsInput = z.object({
  intent: z.string().min(1).max(1000),
  sourceType: z.string().optional(),
  workflowOnly: z.boolean().optional(),
  maxTools: z.number().int().min(1).max(50).default(10),
  maxWorkflows: z.number().int().min(1).max(20).default(5),
  useLlm: z.boolean().optional(),
});

function filterToolCards(
  tools: ToolCard[],
  query: string,
  category?: string,
  tags?: string[]
): ToolCard[] {
  const normalizedQuery = query.toLowerCase();
  return tools.filter((tool) => {
    if (category && tool.category !== category) return false;
    if (tags && tags.length > 0 && !tags.every(tag => tool.tags.includes(tag))) {
      return false;
    }
    return (
      tool.name.toLowerCase().includes(normalizedQuery) ||
      tool.description.toLowerCase().includes(normalizedQuery) ||
      tool.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
    );
  });
}

const SOURCE_HINTS: Record<string, string[]> = {
  facebook: ['chat', 'messages', 'social', 'forensics'],
  instagram: ['chat', 'messages', 'social'],
  whatsapp: ['chat', 'messages', 'forensics'],
  sms: ['chat', 'messages'],
  transcript: ['transcript', 'document', 'analysis', 'nlp'],
  email: ['email', 'messages', 'document'],
  pdf: ['document', 'ocr', 'conversion'],
};

function tokenizeIntent(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function scoreToolCard(card: ToolCard, keywords: string[]): number {
  let score = 0;
  const name = card.name.toLowerCase();
  const description = card.description.toLowerCase();
  for (const keyword of keywords) {
    if (name.includes(keyword)) score += 5;
    if (description.includes(keyword)) score += 3;
    if (card.tags.some(tag => tag.toLowerCase().includes(keyword))) score += 2;
  }
  return score;
}

async function refineWithLlm(
  intent: string,
  candidates: ToolCard[],
  maxTools: number
): Promise<ToolCard[] | null> {
  const hub = new LLMProviderHub();
  const toolList = candidates.map(tool => tool.name);

  const prompt = [
    'Select the best tool names for the task.',
    'Return a JSON array of tool names only.',
    `Task: ${intent}`,
    `Tools: ${toolList.join(', ')}`,
  ].join('\n');

  const response = await hub.chat({
    messages: [
      { role: 'system', content: 'You select tool names for routing. Output JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    maxTokens: 200,
    task: 'tool_selection',
    complexity: 'simple',
  });

  try {
    const parsed = JSON.parse(response.content) as string[];
    const selected = new Set(parsed);
    const filtered = candidates.filter(tool => selected.has(tool.name));
    return filtered.slice(0, maxTools);
  } catch {
    return null;
  }
}

// ============================================================================
// MCP Gateway Router
// ============================================================================

export const mcpGatewayRouter = router({
  /**
   * search_tools - Discover available tools with minimal token overhead
   * 
   * Returns compact tool cards (name, category, description, tags) to minimize
   * context window usage. Use describe_tool for full specifications.
   */
  searchTools: publicProcedure
    .input(searchToolsInput)
    .query(async ({ input }): Promise<ApiResponse<ToolCard[]>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const registry = await getPluginRegistry();
        const proxy = getMCPProxy();
        const tools = registry.searchTools(input.query, {
          topK: input.topK,
          category: input.category,
          tags: input.tags,
        });
        const remoteTools = filterToolCards(
          proxy.getAllTools(),
          input.query,
          input.category,
          input.tags
        );

        // Return minimal tool cards for token efficiency
        const cards: ToolCard[] = tools.map((tool) => ({
          name: tool.name,
          category: tool.category,
          description: tool.description,
          tags: tool.tags,
        }));

        const combined = [...cards, ...remoteTools].slice(0, input.topK);

        return {
          success: true,
          data: combined,
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
            cached: false,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SEARCH_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * describe_tool - Get full tool specification on demand
   * 
   * Returns complete schema, examples, permissions, and cost estimates.
   * Only call when you need the full specification.
   */
  describeTool: publicProcedure
    .input(describeToolInput)
    .query(async ({ input }): Promise<ApiResponse<ToolSpec>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const registry = await getPluginRegistry();
        const tool = registry.getTool(input.toolName);
        const proxy = getMCPProxy();
        const remoteTool = tool ?? proxy.getToolSpec(input.toolName);

        if (!remoteTool) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Tool not found: ${input.toolName}`,
          });
        }

        return {
          success: true,
          data: remoteTool,
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return {
          success: false,
          error: {
            code: 'DESCRIBE_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * invoke_tool - Execute a tool with reference-based returns
   * 
   * For small outputs (<4KB), returns inline data.
   * For large outputs, returns a content reference for paged retrieval.
   */
  invokeTool: protectedProcedure
    .input(invokeToolInput)
    .mutation(async ({ input, ctx }): Promise<ApiResponse<InvokeResult>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const registry = await getPluginRegistry();
        const tool = registry.getTool(input.toolName);
        const proxy = getMCPProxy();

        if (!tool) {
          const proxyResult = await proxy.invokeTool({
            toolName: input.toolName,
            args: input.args,
            timeout: input.options?.timeout,
          });

          if (!proxyResult.success) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: proxyResult.error || `Tool not found: ${input.toolName}`,
            });
          }

          const result: InvokeResult = {
            success: true,
            data: proxyResult.data,
            meta: {
              toolName: input.toolName,
              traceId: traceId,
              cacheHit: false,
              executionTimeMs: proxyResult.latencyMs,
            },
          };

          return {
            success: true,
            data: result,
            meta: {
              traceId,
              executionTimeMs: Date.now() - startTime,
              cached: false,
            },
          };
        }

        // Check permissions
        const hasPermission = await registry.checkPermissions(
          input.toolName,
          ctx.user?.id ?? 0
        );
        if (!hasPermission) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions for this tool',
          });
        }

        // Execute via task executor
        const executor = await getTaskExecutor();
        const result = await executor.execute({
          toolName: input.toolName,
          args: input.args,
          options: input.options ?? {},
          traceId,
          userId: ctx.user?.id,
        });

        return {
          success: result.success,
          data: result,
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
            cached: result.meta.cacheHit,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return {
          success: false,
          error: {
            code: 'INVOKE_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * get_ref - Retrieve content-addressed artifacts with paging
   * 
   * Enables token-efficient retrieval of large outputs by fetching
   * only the pages needed for the current context.
   */
  getRef: publicProcedure
    .input(getRefInput)
    .query(async ({ input }): Promise<ApiResponse<PagedContent>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const store = await getContentStore();
        const content = await store.getPage({
          ref: input.ref as ContentRef,
          page: input.page,
          pageSize: input.pageSize,
        });

        if (!content) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Content not found: ${input.ref}`,
          });
        }

        return {
          success: true,
          data: content,
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return {
          success: false,
          error: {
            code: 'GET_REF_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * list_refs - List all stored content references
   * 
   * Returns metadata for all stored artifacts without loading content.
   */
  listRefs: protectedProcedure
    .query(async (): Promise<ApiResponse<{ refs: Array<{ ref: string; size: number; mime: string; preview?: string }> }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const store = await getContentStore();
        const refs = store.list().map((r) => ({
          ref: r.ref,
          size: r.size,
          mime: r.mime,
          preview: r.preview,
        }));

        return {
          success: true,
          data: { refs },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LIST_REFS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * list_tools - List all available tools (full catalog)
   * 
   * Returns complete tool catalog for agent discovery.
   * Agents can browse all tools without needing to search.
   */
  listTools: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
      offset: z.number().int().min(0).default(0),
    }).optional())
    .query(async ({ input }): Promise<ApiResponse<{ tools: ToolCard[]; total: number }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const registry = await getPluginRegistry();
        const proxy = getMCPProxy();
        let tools: ToolSpec[];

        if (input?.category) {
          tools = registry.getToolsByCategory(input.category);
        } else {
          // Get all tools from all categories
          const categories = registry.getCategories();
          tools = categories.flatMap(cat => registry.getToolsByCategory(cat));
        }

        const localCards: ToolCard[] = tools.map((tool) => ({
          name: tool.name,
          category: tool.category,
          description: tool.description,
          tags: tool.tags,
        }));

        const remoteCards = input?.category
          ? proxy.getAllTools().filter(tool => tool.category === input.category)
          : proxy.getAllTools();

        const allCards = [...localCards, ...remoteCards];
        const total = allCards.length;
        const offset = input?.offset || 0;
        const limit = input?.limit || 100;
        const paged = allCards.slice(offset, offset + limit);

        return {
          success: true,
          data: { tools: paged, total },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
            cached: false,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LIST_TOOLS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * list_categories - List all tool categories
   * 
   * Returns available categories for category-based navigation.
   */
  listCategories: publicProcedure
    .query(async (): Promise<ApiResponse<{ categories: Array<{ name: string; count: number }> }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const registry = await getPluginRegistry();
        const proxy = getMCPProxy();
        const categories = registry.getCategories();
        const remoteTools = proxy.getAllTools();
        const remoteCategoryCounts = remoteTools.reduce<Record<string, number>>((acc, tool) => {
          acc[tool.category] = (acc[tool.category] || 0) + 1;
          return acc;
        }, {});

        const categoriesWithCounts = categories.map(cat => ({
          name: cat,
          count: registry.getToolsByCategory(cat).length,
        }));

        for (const [category, count] of Object.entries(remoteCategoryCounts)) {
          const existing = categoriesWithCounts.find(c => c.name === category);
          if (existing) {
            existing.count += count;
          } else {
            categoriesWithCounts.push({ name: category, count });
          }
        }

        return {
          success: true,
          data: { categories: categoriesWithCounts },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LIST_CATEGORIES_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * get_tools_by_category - Get all tools in a specific category
   */
  getToolsByCategory: publicProcedure
    .input(z.object({ category: z.string() }))
    .query(async ({ input }): Promise<ApiResponse<ToolCard[]>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const registry = await getPluginRegistry();
        const proxy = getMCPProxy();
        const tools = registry.getToolsByCategory(input.category);
        const cards: ToolCard[] = tools.map((tool) => ({
          name: tool.name,
          category: tool.category,
          description: tool.description,
          tags: tool.tags,
        }));
        const remoteCards = proxy.getAllTools().filter(tool => tool.category === input.category);
        const combined = [...cards, ...remoteCards];

        return {
          success: true,
          data: combined,
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'GET_TOOLS_BY_CATEGORY_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * get_related_tools - Get tools related to a specific tool
   * 
   * Returns tools that are commonly used together or serve similar purposes.
   */
  getRelatedTools: publicProcedure
    .input(z.object({ toolName: z.string(), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ input }): Promise<ApiResponse<ToolCard[]>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const registry = await getPluginRegistry();
        const proxy = getMCPProxy();
        const tool = registry.getTool(input.toolName);
        const remoteTool = tool
          ? null
          : proxy.getAllTools().find(t => t.name === input.toolName) || null;

        if (!tool && !remoteTool) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Tool not found: ${input.toolName}`,
          });
        }

        // Find related tools by:
        // 1. Same category
        // 2. Shared tags
        const baseCategory = tool?.category ?? remoteTool?.category ?? 'remote';
        const baseTags = tool?.tags ?? remoteTool?.tags ?? [];

        const categoryTools = registry.getToolsByCategory(baseCategory)
          .filter(t => t.name !== input.toolName)
          .map((t) => ({
            name: t.name,
            category: t.category,
            description: t.description,
            tags: t.tags,
          }))
          .concat(
            proxy.getAllTools()
              .filter(t => t.category === baseCategory && t.name !== input.toolName)
          );

        const scored = categoryTools.map(t => {
          let score = 1; // Same category baseline
          
          // Add points for shared tags
          const sharedTags = baseTags.filter(tag => t.tags.includes(tag));
          score += sharedTags.length * 2;

          return { tool: t, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const cards: ToolCard[] = scored.slice(0, input.limit).map(s => s.tool);

        return {
          success: true,
          data: cards,
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return {
          success: false,
          error: {
            code: 'GET_RELATED_TOOLS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * list_workflows - List available workflow templates
   * 
   * Returns pre-built tool chains for common tasks.
   */
  listWorkflows: publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ input }): Promise<ApiResponse<WorkflowTemplate[]>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const { WORKFLOW_TEMPLATES } = await import('../../shared/workflow-types');
        
        let workflows = WORKFLOW_TEMPLATES;
        if (input?.category) {
          workflows = workflows.filter(w => w.category === input.category);
        }

        return {
          success: true,
          data: workflows,
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LIST_WORKFLOWS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * get_workflow - Get a specific workflow template
   */
  getWorkflow: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }): Promise<ApiResponse<WorkflowTemplate | null>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const { WORKFLOW_TEMPLATES } = await import('../../shared/workflow-types');
        const workflow = WORKFLOW_TEMPLATES.find(w => w.id === input.id);

        return {
          success: true,
          data: workflow || null,
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'GET_WORKFLOW_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * semantic_route - Match user intent to best tool or workflow
   * 
   * Helps agents discover the right tool without knowing exact names.
   */
  semanticRoute: publicProcedure
    .input(z.object({ intent: z.string() }))
    .query(async ({ input }): Promise<ApiResponse<{
      recommendedTool: string;
      alternativeTools?: string[];
      workflow?: string;
      confidence: number;
    }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const { SEMANTIC_ROUTES } = await import('../../shared/workflow-types');
        
        const query = input.intent.toLowerCase();
        
        // Find best matching route
        let bestMatch: typeof SEMANTIC_ROUTES[0] | null = null;
        let bestScore = 0;

        for (const route of SEMANTIC_ROUTES) {
          let score = 0;
          
          // Check if intent matches
          if (query.includes(route.intent.replace(/_/g, ' '))) {
            score += 10;
          }

          // Check keyword matches
          for (const keyword of route.keywords) {
            if (query.includes(keyword)) {
              score += 2;
            }
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = route;
          }
        }

        if (!bestMatch) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No matching tool found for intent',
          });
        }

        const confidence = Math.min(bestScore / 10, 1.0);

        return {
          success: true,
          data: {
            recommendedTool: bestMatch.recommendedTool,
            alternativeTools: bestMatch.alternativeTools,
            workflow: bestMatch.workflow,
            confidence,
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        return {
          success: false,
          error: {
            code: 'SEMANTIC_ROUTE_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * get_stats - Get gateway statistics
   */
  getStats: publicProcedure
    .query(async (): Promise<ApiResponse<{
      totalRefs: number;
      totalSize: number;
      toolCount: number;
      categories: string[];
    }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const store = await getContentStore();
        const registry = await getPluginRegistry();
        const proxy = getMCPProxy();
        const remoteTools = proxy.getAllTools();
        const categories = new Set<string>([
          ...registry.getCategories(),
          ...remoteTools.map(tool => tool.category),
        ]);

        return {
          success: true,
          data: {
            totalRefs: store.list().length,
            totalSize: store.getTotalSize(),
            toolCount: registry.getToolCount() + remoteTools.length,
            categories: Array.from(categories),
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'STATS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * list_mcp_servers - List registered MCP servers
   */
  listMcpServers: protectedProcedure
    .query(async (): Promise<ApiResponse<Array<{
      id: string;
      name: string;
      description?: string;
      transport: string;
      endpoint: string;
      enabled: boolean;
      status: string;
      toolCount: number;
      tags?: string[];
    }>>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const proxy = getMCPProxy();
        const servers = proxy.listServers().map(server => ({
          id: server.config.id,
          name: server.config.name,
          description: server.config.description,
          transport: server.config.transport,
          endpoint: server.config.endpoint,
          enabled: server.config.enabled,
          status: server.status,
          toolCount: server.tools.length,
          tags: server.config.tags,
        }));

        return {
          success: true,
          data: servers,
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LIST_MCP_SERVERS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * register_mcp_server - Register a remote MCP server
   */
  registerMcpServer: protectedProcedure
    .input(registerMcpServerInput)
    .mutation(async ({ input }): Promise<ApiResponse<{ serverId: string }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const proxy = getMCPProxy();
        const state = await proxy.registerServer({
          name: input.name,
          description: input.description,
          transport: input.transport,
          endpoint: input.endpoint,
          apiKey: input.apiKey,
          headers: input.headers,
          timeout: input.timeout,
          retryAttempts: input.retryAttempts,
          enabled: input.enabled,
          tags: input.tags,
          priority: input.priority,
        });

        return {
          success: true,
          data: { serverId: state.config.id },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REGISTER_MCP_SERVER_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * unregister_mcp_server - Remove a registered MCP server
   */
  unregisterMcpServer: protectedProcedure
    .input(unregisterMcpServerInput)
    .mutation(async ({ input }): Promise<ApiResponse<{ removed: boolean }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const proxy = getMCPProxy();
        const removed = await proxy.unregisterServer(input.serverId);

        return {
          success: true,
          data: { removed },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'UNREGISTER_MCP_SERVER_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * refresh_mcp_server - Refresh tool discovery for a server
   */
  refreshMcpServer: protectedProcedure
    .input(refreshMcpServerInput)
    .mutation(async ({ input }): Promise<ApiResponse<{ refreshed: boolean }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const proxy = getMCPProxy();
        await proxy.refreshServer(input.serverId);

        return {
          success: true,
          data: { refreshed: true },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'REFRESH_MCP_SERVER_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * import_mcp_servers - Import MCP server definitions from client config
   */
  importMcpServers: protectedProcedure
    .input(importMcpServersInput)
    .mutation(async ({ input }): Promise<ApiResponse<{
      imported: number;
      serverIds: string[];
      sources: string[];
    }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const proxy = getMCPProxy();
        if (input.replaceExisting) {
          await proxy.clearServers();
        }

        const imported = importMcpServersFromConfig(input.config);
        const serverIds: string[] = [];
        const sources = new Set<string>();

        for (const server of imported) {
          const state = await proxy.registerServer(server.config);
          serverIds.push(state.config.id);
          sources.add(server.source);
        }

        return {
          success: true,
          data: {
            imported: serverIds.length,
            serverIds,
            sources: Array.from(sources),
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'IMPORT_MCP_SERVERS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),

  /**
   * recommend_tools - Suggest tools/workflows based on intent and source
   */
  recommendTools: publicProcedure
    .input(recommendToolsInput)
    .query(async ({ input }): Promise<ApiResponse<{
      tools: ToolCard[];
      workflows: WorkflowTemplate[];
      rationale: string[];
    }>> => {
      const traceId = nanoid();
      const startTime = Date.now();

      try {
        const registry = await getPluginRegistry();
        const proxy = getMCPProxy();
        const { WORKFLOW_TEMPLATES, SEMANTIC_ROUTES } = await import('../../shared/workflow-types');

        const intentTokens = tokenizeIntent(input.intent);
        const sourceTokens = input.sourceType
          ? (SOURCE_HINTS[input.sourceType.toLowerCase()] || [input.sourceType.toLowerCase()])
          : [];
        const keywords = Array.from(new Set([...intentTokens, ...sourceTokens]));

        const localTools = registry.getCategories()
          .flatMap(cat => registry.getToolsByCategory(cat))
          .map((tool) => ({
            name: tool.name,
            category: tool.category,
            description: tool.description,
            tags: tool.tags,
          }));
        const remoteTools = proxy.getAllTools();
        const allTools = [...localTools, ...remoteTools];

        const workflowCandidates = WORKFLOW_TEMPLATES.filter((workflow) => {
          if (keywords.some(k => workflow.id.toLowerCase().includes(k))) return true;
          if (keywords.some(k => workflow.name.toLowerCase().includes(k))) return true;
          if (keywords.some(k => workflow.description.toLowerCase().includes(k))) return true;
          return workflow.tags.some(tag => keywords.includes(tag.toLowerCase()));
        });

        const workflowScores = workflowCandidates.map(workflow => ({
          workflow,
          score: scoreToolCard(
            {
              name: workflow.id,
              category: workflow.category,
              description: workflow.description,
              tags: workflow.tags,
            },
            keywords
          ),
        }));
        workflowScores.sort((a, b) => b.score - a.score);
        const workflows = workflowScores
          .slice(0, input.maxWorkflows)
          .map(entry => entry.workflow);

        const toolScores = allTools.map(tool => ({
          tool,
          score: scoreToolCard(tool, keywords),
        }));

        for (const route of SEMANTIC_ROUTES) {
          const matchesIntent = keywords.some(k =>
            route.intent.toLowerCase().includes(k) || route.keywords.some(kw => kw.includes(k))
          );
          if (!matchesIntent) continue;

          for (const entry of toolScores) {
            if (entry.tool.name === route.recommendedTool) {
              entry.score += 12;
            }
            if (route.alternativeTools?.includes(entry.tool.name)) {
              entry.score += 6;
            }
          }
        }

        toolScores.sort((a, b) => b.score - a.score);
        let tools = toolScores
          .filter(entry => entry.score > 0)
          .slice(0, input.maxTools)
          .map(entry => entry.tool);

        const rationale: string[] = [];
        if (input.sourceType) {
          rationale.push(`Matched sourceType="${input.sourceType}" to tags: ${sourceTokens.join(', ') || 'none'}`);
        }
        if (workflowScores.length > 0) {
          rationale.push('Ranked workflows by tag/name match.');
        }
        if (toolScores.length > 0) {
          rationale.push('Ranked tools by tag/name/description match.');
        }

        if (input.useLlm && tools.length > 0) {
          try {
            const refined = await refineWithLlm(input.intent, tools, input.maxTools);
            if (refined) {
              tools = refined;
              rationale.push('LLM refinement applied to tool ranking.');
            }
          } catch (error) {
            rationale.push(`LLM refinement skipped: ${error instanceof Error ? error.message : 'unknown error'}`);
          }
        }

        if (input.workflowOnly) {
          tools = [];
          rationale.push('workflowOnly=true; returned workflows only.');
        }

        return {
          success: true,
          data: {
            tools,
            workflows,
            rationale,
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'RECOMMEND_TOOLS_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          meta: {
            traceId,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }
    }),
});

export type McpGatewayRouter = typeof mcpGatewayRouter;
