import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { mcpGatewayRouter } from "./mcp/gateway";
import { getConfigManager } from "./mcp/config/config-manager";
import { getStatsCollector } from "./mcp/stats/collector";
import { getLLMHub } from "./mcp/llm/provider-hub";
import { getLogStream, type LogFilter } from "./mcp/realtime/log-stream";
import { getToolForkManager, type PlatformType, type ToolCustomization } from "./mcp/forking/tool-fork";
import { getMCPProxy, type ServerTransport } from "./mcp/proxy/mcp-proxy";
import { z } from "zod";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  logApiKeyUsage,
  type ApiKeyPermission,
} from "./mcp/auth/api-keys";
import {
  createPrompt,
  listPrompts,
  getPromptById,
  updatePrompt,
  deletePrompt,
  getPromptVersionHistory,
  createWorkflow,
  listWorkflows,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  getDefaultPrompt,
} from "./mcp/prompts/prompt-manager";
import {
  getWikiCategories,
  getWikiPage,
  getPagesByCategory,
  searchWiki,
  getAllWikiPages,
} from "./mcp/wiki/wiki-content";
import { getMCPConfigGenerator, type Platform } from "./mcp/config/mcp-generator";

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
// Real-time Logs Router
// ============================================================================

const logsRouter = router({
  recent: protectedProcedure
    .input(z.object({
      count: z.number().min(1).max(1000).optional().default(100),
      filter: z.object({
        levels: z.array(z.enum(['debug', 'info', 'warn', 'error', 'fatal'])).optional(),
        categories: z.array(z.string()).optional(),
        tools: z.array(z.string()).optional(),
        traceId: z.string().optional(),
        search: z.string().optional(),
        since: z.number().optional(),
      }).optional(),
    }).optional())
    .query(({ input }) => {
      return getLogStream().getRecentLogs(input?.count, input?.filter as LogFilter | undefined);
    }),

  query: protectedProcedure
    .input(z.object({
      filter: z.object({
        levels: z.array(z.enum(['debug', 'info', 'warn', 'error', 'fatal'])).optional(),
        categories: z.array(z.string()).optional(),
        tools: z.array(z.string()).optional(),
        traceId: z.string().optional(),
        search: z.string().optional(),
        since: z.number().optional(),
      }),
      limit: z.number().min(1).max(10000).optional().default(1000),
    }))
    .query(({ input }) => {
      return getLogStream().queryLogs(input.filter as LogFilter, input.limit);
    }),

  export: protectedProcedure
    .input(z.object({
      filter: z.object({
        levels: z.array(z.enum(['debug', 'info', 'warn', 'error', 'fatal'])).optional(),
        categories: z.array(z.string()).optional(),
        tools: z.array(z.string()).optional(),
        traceId: z.string().optional(),
        search: z.string().optional(),
        since: z.number().optional(),
      }).optional(),
    }).optional())
    .query(({ input }) => {
      return getLogStream().exportLogs(input?.filter as LogFilter | undefined);
    }),

  metrics: protectedProcedure.query(() => {
    return getLogStream().getMetricsSnapshot();
  }),
});

// ============================================================================
// Tool Forking Router
// ============================================================================

const forkRouter = router({
  list: protectedProcedure
    .input(z.object({
      platform: z.enum(['generic', 'claude-mcp', 'gemini-extension', 'openai-function']).optional(),
    }).optional())
    .query(({ ctx, input }) => {
      return getToolForkManager().listForks(ctx.user?.openId, input?.platform as PlatformType | undefined);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return getToolForkManager().getFork(input.id);
    }),

  create: protectedProcedure
    .input(z.object({
      parentToolName: z.string(),
      platform: z.enum(['generic', 'claude-mcp', 'gemini-extension', 'openai-function']),
      name: z.string().optional(),
      description: z.string().optional(),
      customizations: z.object({
        parameterOverrides: z.record(z.string(), z.object({
          default: z.unknown().optional(),
          required: z.boolean().optional(),
          description: z.string().optional(),
          hidden: z.boolean().optional(),
        })).optional(),
        additionalParameters: z.record(z.string(), z.object({
          type: z.string(),
          description: z.string(),
          required: z.boolean().optional(),
          default: z.unknown().optional(),
        })).optional(),
        platformConfig: z.record(z.string(), z.unknown()).optional(),
        hooks: z.object({
          preProcess: z.string().optional(),
          postProcess: z.string().optional(),
        }).optional(),
        rateLimit: z.object({
          maxCallsPerMinute: z.number().optional(),
          maxCallsPerHour: z.number().optional(),
        }).optional(),
      }).optional().default({}),
    }))
    .mutation(({ ctx, input }) => {
      // Get the parent tool spec from the registry
      const parentSpec = {
        name: input.parentToolName,
        category: 'custom',
        description: input.description || 'Custom tool fork',
        version: '1.0.0',
        tags: [],
        inputSchema: { type: 'object', properties: {}, required: [] },
        outputSchema: { type: 'object', properties: {} },
        permissions: [] as ('read:filesystem' | 'write:filesystem' | 'read:network' | 'write:network' | 'execute:process' | 'access:llm' | 'access:vectordb')[],
      };
      return getToolForkManager().createFork(
        parentSpec,
        input.platform as PlatformType,
        input.customizations as ToolCustomization,
        ctx.user?.openId || 'anonymous',
        input.name,
        input.description
      );
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      updates: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        version: z.string().optional(),
        customizations: z.object({
          parameterOverrides: z.record(z.string(), z.object({
            default: z.unknown().optional(),
            required: z.boolean().optional(),
            description: z.string().optional(),
            hidden: z.boolean().optional(),
          })).optional(),
          additionalParameters: z.record(z.string(), z.object({
            type: z.string(),
            description: z.string(),
            required: z.boolean().optional(),
            default: z.unknown().optional(),
          })).optional(),
        }).optional(),
      }),
    }))
    .mutation(({ input }) => {
      return getToolForkManager().updateFork(input.id, input.updates);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      return getToolForkManager().deleteFork(input.id);
    }),

  exportClaudeMCP: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return getToolForkManager().exportAsClaudeMCP(input.id);
    }),

  exportGeminiExtension: protectedProcedure
    .input(z.object({ id: z.string(), baseUrl: z.string() }))
    .query(({ input }) => {
      return getToolForkManager().exportAsGeminiExtension(input.id, input.baseUrl);
    }),

  exportOpenAIFunction: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return getToolForkManager().exportAsOpenAIFunction(input.id);
    }),

  exportPackage: protectedProcedure
    .input(z.object({ id: z.string(), baseUrl: z.string() }))
    .query(({ input }) => {
      return getToolForkManager().exportAsPackage(input.id, input.baseUrl);
    }),

  compare: protectedProcedure
    .input(z.object({ forkId1: z.string(), forkId2: z.string() }))
    .query(({ input }) => {
      return getToolForkManager().compareForks(input.forkId1, input.forkId2);
    }),
});

// ============================================================================
// MCP Proxy Router
// ============================================================================

const proxyRouter = router({
  listServers: protectedProcedure.query(() => {
    return getMCPProxy().listServers();
  }),

  getServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return getMCPProxy().getServer(input.id);
    }),

  registerServer: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      transport: z.enum(['stdio', 'http', 'websocket']),
      endpoint: z.string(),
      apiKey: z.string().optional(),
      headers: z.record(z.string(), z.string()).optional(),
      timeout: z.number().optional(),
      retryAttempts: z.number().optional(),
      enabled: z.boolean().default(true),
      tags: z.array(z.string()).optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return getMCPProxy().registerServer({
        ...input,
        transport: input.transport as ServerTransport,
      });
    }),

  updateServer: protectedProcedure
    .input(z.object({
      id: z.string(),
      updates: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        endpoint: z.string().optional(),
        apiKey: z.string().optional(),
        enabled: z.boolean().optional(),
        priority: z.number().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return getMCPProxy().updateServer(input.id, input.updates);
    }),

  unregisterServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return getMCPProxy().unregisterServer(input.id);
    }),

  refreshServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await getMCPProxy().refreshServer(input.id);
      return { success: true };
    }),

  getAllTools: protectedProcedure.query(() => {
    return getMCPProxy().getAllTools();
  }),

  invokeTool: protectedProcedure
    .input(z.object({
      serverId: z.string().optional(),
      toolName: z.string(),
      args: z.record(z.string(), z.unknown()),
      timeout: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return getMCPProxy().invokeTool(input);
    }),

  getMigrationConfig: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return getMCPProxy().generateMigrationConfig(input.id);
    }),
});

// ============================================================================
// API Keys Router
// ============================================================================

const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listApiKeys(ctx.user!.id);
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      permissions: z.array(z.object({
        resource: z.string(),
        actions: z.array(z.enum(['read', 'write', 'execute'])),
      })).optional(),
      expiresInDays: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createApiKey({
        userId: ctx.user!.id,
        name: input.name,
        permissions: input.permissions,
        expiresInDays: input.expiresInDays,
      });
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return revokeApiKey(input.id, ctx.user!.id);
    }),

  rotate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return rotateApiKey(input.id, ctx.user!.id);
    }),
});

// ============================================================================
// System Prompts Router
// ============================================================================

const promptsRouter = router({
  list: protectedProcedure
    .input(z.object({ toolName: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return listPrompts(ctx.user!.id, input?.toolName);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getPromptById(input.id);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      toolName: z.string().optional(),
      promptText: z.string(),
      variables: z.array(z.object({
        name: z.string(),
        description: z.string(),
        defaultValue: z.string().optional(),
        required: z.boolean(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createPrompt({ ...input, userId: ctx.user!.id });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      promptText: z.string().optional(),
      name: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return updatePrompt(input.id, ctx.user!.id, input);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deletePrompt(input.id, ctx.user!.id);
    }),

  getVersionHistory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getPromptVersionHistory(input.id);
    }),

  getDefault: protectedProcedure
    .input(z.object({ toolName: z.string() }))
    .query(({ input }) => {
      return getDefaultPrompt(input.toolName);
    }),
});

// ============================================================================
// Workflows Router
// ============================================================================

const workflowsRouter = router({
  list: protectedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return listWorkflows(ctx.user!.id, input?.category);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getWorkflowById(input.id);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      category: z.string().optional(),
      steps: z.array(z.object({
        toolName: z.string(),
        description: z.string(),
        inputMapping: z.record(z.string(), z.string()),
        outputKey: z.string(),
        optional: z.boolean().optional(),
        condition: z.string().optional(),
      })),
      systemPromptId: z.number().optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createWorkflow({ ...input, userId: ctx.user!.id });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      steps: z.array(z.object({
        toolName: z.string(),
        description: z.string(),
        inputMapping: z.record(z.string(), z.string()),
        outputKey: z.string(),
        optional: z.boolean().optional(),
        condition: z.string().optional(),
      })).optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return updateWorkflow(input.id, ctx.user!.id, input);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteWorkflow(input.id, ctx.user!.id);
    }),
});

// ============================================================================
// Wiki Router
// ============================================================================

const wikiRouter = router({
  categories: publicProcedure.query(() => {
    return getWikiCategories();
  }),

  page: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ input }) => {
      return getWikiPage(input.slug);
    }),

  pagesByCategory: publicProcedure
    .input(z.object({ category: z.string() }))
    .query(({ input }) => {
      return getPagesByCategory(input.category);
    }),

  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(({ input }) => {
      return searchWiki(input.query);
    }),

  all: publicProcedure.query(() => {
    return getAllWikiPages();
  }),
});

// ============================================================================
// MCP Config Generator Router
// ============================================================================

const mcpConfigRouter = router({
  generate: protectedProcedure
    .input(z.object({
      platform: z.enum(['claude', 'gemini', 'openai', 'generic']),
      includeAllTools: z.boolean().optional(),
      generateWithAI: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // First create an API key for this config
      const apiKeyResult = await createApiKey({
        userId: ctx.user!.id,
        name: `MCP Config - ${input.platform}`,
        permissions: [
          { resource: 'tools', actions: ['read', 'execute'] },
        ],
      });
      
      if (!apiKeyResult) {
        throw new Error('Failed to create API key');
      }

      // Get available tools (simplified for now)
      const tools = [
        { name: 'document.convert', description: 'Convert documents between formats', inputSchema: {} },
        { name: 'document.ocr', description: 'Extract text from images using OCR', inputSchema: {} },
        { name: 'document.chunk', description: 'Split documents into chunks', inputSchema: {} },
        { name: 'nlp.extract_entities', description: 'Extract named entities from text', inputSchema: {} },
        { name: 'nlp.extract_keywords', description: 'Extract keywords from text', inputSchema: {} },
        { name: 'nlp.detect_language', description: 'Detect text language', inputSchema: {} },
        { name: 'nlp.sentiment', description: 'Analyze text sentiment', inputSchema: {} },
        { name: 'search.ripgrep', description: 'Search files with ripgrep', inputSchema: {} },
        { name: 'summarization.map_reduce', description: 'Summarize large documents', inputSchema: {} },
        { name: 'retrieval.bm25_search', description: 'BM25 keyword search', inputSchema: {} },
      ];

      const baseUrl = process.env.VITE_APP_URL || 'https://your-domain.manus.space';
      const generator = getMCPConfigGenerator(baseUrl);
      
      const config = await generator.generateConfig(
        input.platform as Platform,
        apiKeyResult.plainKey,
        tools,
        {
          includeAllTools: input.includeAllTools,
          generateWithAI: input.generateWithAI,
        }
      );

      const file = generator.generateConfigFile(config, input.platform as Platform);

      return {
        config,
        file,
        apiKeyId: apiKeyResult.id,
        apiKeyName: apiKeyResult.name,
      };
    }),

  download: protectedProcedure
    .input(z.object({
      platform: z.enum(['claude', 'gemini', 'openai', 'generic']),
      apiKey: z.string(),
    }))
    .query(async ({ input }) => {
      const tools = [
        { name: 'document.convert', description: 'Convert documents between formats', inputSchema: {} },
        { name: 'nlp.extract_entities', description: 'Extract named entities from text', inputSchema: {} },
        { name: 'search.ripgrep', description: 'Search files with ripgrep', inputSchema: {} },
      ];

      const baseUrl = process.env.VITE_APP_URL || 'https://your-domain.manus.space';
      const generator = getMCPConfigGenerator(baseUrl);
      
      const config = await generator.generateConfig(
        input.platform as Platform,
        input.apiKey,
        tools
      );

      return generator.generateConfigFile(config, input.platform as Platform);
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

  // Real-time logs
  logs: logsRouter,

  // Tool forking
  fork: forkRouter,

  // MCP Server Proxy
  proxy: proxyRouter,

  // API Keys management
  apiKeys: apiKeysRouter,

  // System prompts
  prompts: promptsRouter,

  // Workflow templates
  workflows: workflowsRouter,

  // Wiki/Documentation
  wiki: wikiRouter,

  // MCP Config Generator
  mcpConfig: mcpConfigRouter,
});

export type AppRouter = typeof appRouter;
