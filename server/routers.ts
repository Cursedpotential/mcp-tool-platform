import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { mcpGatewayRouter } from "./mcp/gateway";
import { getConfigManager } from "./mcp/config/config-manager";
import { getStatsCollector } from "./mcp/stats/collector";
import { getLLMHub } from "./mcp/llm/provider-hub";
import { z } from "zod";

// ============================================================================
// Config Router - Manage definitions, patterns, dictionaries
// ============================================================================

const configRouter = router({
  // Pattern Definitions
  listPatterns: protectedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(({ input }) => {
      return getConfigManager().listPatterns(input?.category);
    }),

  getPattern: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return getConfigManager().getPattern(input.id);
    }),

  createPattern: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional().default(''),
      category: z.string(),
      patterns: z.array(z.object({
        id: z.string().optional(),
        type: z.enum(['regex', 'keyword', 'phrase', 'semantic']),
        value: z.string(),
        flags: z.string().optional(),
        weight: z.number().min(0).max(1).default(1),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })),
      enabled: z.boolean().default(true),
      version: z.string().default('1.0.0'),
    }))
    .mutation(({ input }) => {
      const patterns = input.patterns.map((p, i) => ({
        ...p,
        id: p.id || `p-${i}`,
      }));
      return getConfigManager().createPattern({ ...input, patterns });
    }),

  updatePattern: protectedProcedure
    .input(z.object({
      id: z.string(),
      updates: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        patterns: z.array(z.object({
          id: z.string(),
          type: z.enum(['regex', 'keyword', 'phrase', 'semantic']),
          value: z.string(),
          flags: z.string().optional(),
          weight: z.number().min(0).max(1),
          metadata: z.record(z.string(), z.unknown()).optional(),
        })).optional(),
        enabled: z.boolean().optional(),
        version: z.string().optional(),
      }),
    }))
    .mutation(({ input }) => {
      return getConfigManager().updatePattern(input.id, input.updates);
    }),

  deletePattern: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      return getConfigManager().deletePattern(input.id);
    }),

  // Behavioral Definitions
  listBehaviors: protectedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(({ input }) => {
      return getConfigManager().listBehaviors(input?.category);
    }),

  getBehavior: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return getConfigManager().getBehavior(input.id);
    }),

  createBehavior: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional().default(''),
      category: z.string(),
      indicators: z.array(z.object({
        id: z.string().optional(),
        name: z.string(),
        type: z.enum(['keyword', 'pattern', 'sentiment', 'frequency', 'context']),
        value: z.union([z.string(), z.array(z.string())]),
        weight: z.number().min(0).max(1).default(1),
        polarity: z.enum(['positive', 'negative', 'neutral']).default('neutral'),
      })),
      thresholds: z.object({
        low: z.number(),
        medium: z.number(),
        high: z.number(),
      }),
      enabled: z.boolean().default(true),
      version: z.string().default('1.0.0'),
    }))
    .mutation(({ input }) => {
      const indicators = input.indicators.map((ind, i) => ({
        ...ind,
        id: ind.id || `ind-${i}`,
      }));
      return getConfigManager().createBehavior({ ...input, indicators });
    }),

  updateBehavior: protectedProcedure
    .input(z.object({
      id: z.string(),
      updates: z.record(z.string(), z.unknown()),
    }))
    .mutation(({ input }) => {
      return getConfigManager().updateBehavior(input.id, input.updates as Partial<{ name: string; description: string; category: string; enabled: boolean; version: string }>);
    }),

  deleteBehavior: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      return getConfigManager().deleteBehavior(input.id);
    }),

  // Dictionaries
  listDictionaries: protectedProcedure
    .input(z.object({ language: z.string().optional() }).optional())
    .query(({ input }) => {
      return getConfigManager().listDictionaries(input?.language);
    }),

  getDictionary: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return getConfigManager().getDictionary(input.id);
    }),

  createDictionary: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional().default(''),
      language: z.string().default('en'),
      entries: z.array(z.object({
        term: z.string(),
        definition: z.string().optional(),
        synonyms: z.array(z.string()).optional(),
        category: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })),
      version: z.string().default('1.0.0'),
    }))
    .mutation(({ input }) => {
      return getConfigManager().createDictionary(input);
    }),

  deleteDictionary: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      return getConfigManager().deleteDictionary(input.id);
    }),

  // Import/Export
  exportAll: protectedProcedure.query(async () => {
    return getConfigManager().exportAll();
  }),

  importAll: protectedProcedure
    .input(z.object({
      config: z.any(),
      options: z.object({
        merge: z.boolean().optional(),
        overwrite: z.boolean().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      return getConfigManager().importAll(input.config, input.options);
    }),

  getSchemas: publicProcedure.query(() => {
    return getConfigManager().getSchemas();
  }),
});

// ============================================================================
// Stats Router - Analytics and metrics
// ============================================================================

const statsRouter = router({
  dashboard: protectedProcedure.query(() => {
    return getStatsCollector().getDashboardData();
  }),

  toolStats: protectedProcedure
    .input(z.object({ toolName: z.string().optional() }).optional())
    .query(({ input }) => {
      return getStatsCollector().getToolStats(input?.toolName);
    }),

  providerStats: protectedProcedure
    .input(z.object({ provider: z.string().optional() }).optional())
    .query(({ input }) => {
      return getStatsCollector().getProviderStats(input?.provider);
    }),

  recentCalls: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(1000).optional().default(100),
      toolName: z.string().optional(),
    }).optional())
    .query(({ input }) => {
      return getStatsCollector().getRecentCalls(input?.limit, input?.toolName);
    }),

  export: protectedProcedure.query(() => {
    return getStatsCollector().exportStats();
  }),

  reset: protectedProcedure.mutation(() => {
    getStatsCollector().reset();
    return { success: true };
  }),
});

// ============================================================================
// LLM Provider Router - Manage LLM providers
// ============================================================================

const llmRouter = router({
  listProviders: protectedProcedure.query(() => {
    return getLLMHub().getAllConfigs();
  }),

  getProvider: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .query(({ input }) => {
      return getLLMHub().getConfig(input.provider as Parameters<ReturnType<typeof getLLMHub>['getConfig']>[0]);
    }),

  configureProvider: protectedProcedure
    .input(z.object({
      provider: z.string(),
      config: z.object({
        enabled: z.boolean().optional(),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
        defaultModel: z.string().optional(),
        embeddingModel: z.string().optional(),
        priority: z.number().optional(),
      }),
    }))
    .mutation(({ input }) => {
      getLLMHub().configureProvider(
        input.provider as Parameters<ReturnType<typeof getLLMHub>['configureProvider']>[0],
        input.config
      );
      return { success: true };
    }),

  detectAvailable: protectedProcedure.query(async () => {
    return getLLMHub().detectAvailableProviders();
  }),

  getStats: protectedProcedure.query(() => {
    return getLLMHub().getStats();
  }),

  testProvider: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const hub = getLLMHub();
        const response = await hub.chat({
          messages: [{ role: 'user', content: 'Say "OK" if you can hear me.' }],
          maxTokens: 10,
        });
        return { success: true, response: response.content, latency: response.latencyMs };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }),

  chat: protectedProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })),
      model: z.string().optional(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional(),
      task: z.string().optional(),
      complexity: z.enum(['simple', 'medium', 'complex']).optional(),
    }))
    .mutation(async ({ input }) => {
      return getLLMHub().chat(input);
    }),

  embed: protectedProcedure
    .input(z.object({
      texts: z.array(z.string()),
      model: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return getLLMHub().embed(input);
    }),

  exportConfig: protectedProcedure.query(() => {
    return getLLMHub().exportConfig();
  }),

  importConfig: protectedProcedure
    .input(z.object({ config: z.record(z.string(), z.any()) }))
    .mutation(({ input }) => {
      getLLMHub().importConfig(input.config as Record<string, Record<string, unknown>>);
      return { success: true };
    }),
});

// ============================================================================
// Main Router
// ============================================================================

export const appRouter = router({
  // System and auth routes
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // MCP Gateway API - Token-efficient tool orchestration
  mcp: mcpGatewayRouter,

  // Configuration management - patterns, behaviors, dictionaries
  config: configRouter,

  // Analytics and metrics
  stats: statsRouter,

  // LLM provider management
  llm: llmRouter,
});

export type AppRouter = typeof appRouter;
