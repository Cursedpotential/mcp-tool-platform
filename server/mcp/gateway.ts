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
import type {
  ToolCard,
  ToolSpec,
  InvokeRequest,
  InvokeResult,
  PagedContent,
  ContentRef,
  ApiResponse,
} from '../../shared/mcp-types';
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
        const tools = registry.searchTools(input.query, {
          topK: input.topK,
          category: input.category,
          tags: input.tags,
        });

        // Return minimal tool cards for token efficiency
        const cards: ToolCard[] = tools.map((tool) => ({
          name: tool.name,
          category: tool.category,
          description: tool.description,
          tags: tool.tags,
        }));

        return {
          success: true,
          data: cards,
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

        if (!tool) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Tool not found: ${input.toolName}`,
          });
        }

        return {
          success: true,
          data: tool,
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

        if (!tool) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Tool not found: ${input.toolName}`,
          });
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

        return {
          success: true,
          data: {
            totalRefs: store.list().length,
            totalSize: store.getTotalSize(),
            toolCount: registry.getToolCount(),
            categories: registry.getCategories(),
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
});

export type McpGatewayRouter = typeof mcpGatewayRouter;
