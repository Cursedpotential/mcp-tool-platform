import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../core/trpc";
import { settingsRouter } from "./settings";

// Stub routers with placeholder procedures for client compatibility
// These return empty/mock data until properly implemented

const authRouter = router({
  me: publicProcedure.query(() => null),
  logout: protectedProcedure.mutation(() => ({ success: true })),
});

const apiKeysRouter = router({
  list: protectedProcedure.query(() => []),
  create: protectedProcedure
    .input(z.object({ name: z.string(), permissions: z.array(z.string()) }))
    .mutation(() => ({ id: "stub", key: "stub-key", name: "stub" })),
  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => ({ success: true })),
  rotate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => ({ id: "stub", key: "new-stub-key" })),
});

const configRouter = router({
  listPatterns: protectedProcedure.query(() => []),
  listBehaviors: protectedProcedure.query(() => []),
  listDictionaries: protectedProcedure.query(() => []),
  exportAll: protectedProcedure.mutation(() => ({
    patterns: [],
    behaviors: [],
    dictionaries: [],
  })),
  importAll: protectedProcedure
    .input(z.object({ data: z.string() }))
    .mutation(() => ({ imported: 0 })),
  createPattern: protectedProcedure
    .input(
      z.object({ name: z.string(), pattern: z.string(), category: z.string() })
    )
    .mutation(() => ({ id: 1, name: "stub" })),
  deletePattern: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(() => ({ success: true })),
  createBehavior: protectedProcedure
    .input(
      z.object({ name: z.string(), pattern: z.string(), category: z.string() })
    )
    .mutation(() => ({ id: 1, name: "stub" })),
  deleteBehavior: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(() => ({ success: true })),
});

const forkRouter = router({
  list: protectedProcedure.query(() => []),
  create: protectedProcedure
    .input(z.object({ name: z.string(), description: z.string().optional() }))
    .mutation(() => ({ id: "stub", name: "stub" })),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => ({ success: true })),
  exportClaudeMCP: protectedProcedure
    .input(z.object({ forkId: z.string() }))
    .mutation(() => ({ config: {} })),
  exportGeminiExtension: protectedProcedure
    .input(z.object({ forkId: z.string() }))
    .mutation(() => ({ config: {} })),
  exportOpenAIFunction: protectedProcedure
    .input(z.object({ forkId: z.string() }))
    .mutation(() => ({ config: {} })),
});

const logsRouter = router({
  recent: protectedProcedure
    .input(z.object({ limit: z.number().optional() }))
    .query(() => []),
  metrics: protectedProcedure.query(() => ({
    total: 0,
    errors: 0,
    avgLatency: 0,
  })),
  export: protectedProcedure
    .input(z.object({ format: z.enum(["json", "csv"]) }))
    .mutation(() => ({ data: "" })),
});

const proxyRouter = router({
  listServers: protectedProcedure.query(() => []),
  getAllTools: protectedProcedure.query(() => []),
  registerServer: protectedProcedure
    .input(z.object({ name: z.string(), url: z.string() }))
    .mutation(() => ({ id: "stub", name: "stub" })),
  unregisterServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => ({ success: true })),
  refreshServer: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => ({ success: true })),
});

const mcpRouter = router({
  searchTools: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(() => []),
  describeTool: protectedProcedure
    .input(z.object({ toolId: z.string() }))
    .query(() => null),
  invokeTool: protectedProcedure
    .input(
      z.object({ toolId: z.string(), args: z.record(z.string(), z.unknown()) })
    )
    .mutation(() => ({ result: null })),
});

const mcpConfigRouter = router({
  generate: protectedProcedure
    .input(z.object({ format: z.string() }))
    .mutation(() => ({ config: {} })),
});

const llmRouter = router({
  listProviders: protectedProcedure.query(() => []),
  detectAvailable: protectedProcedure.mutation(() => []),
  configureProvider: protectedProcedure
    .input(
      z.object({
        providerId: z.string(),
        config: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(() => ({ success: true })),
  testProvider: protectedProcedure
    .input(z.object({ providerId: z.string() }))
    .mutation(() => ({ success: true, latency: 0 })),
});

const wikiRouter = router({
  categories: protectedProcedure.query(() => []),
  page: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(() => null),
  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(() => []),
});

export const appRouter = router({
  settings: settingsRouter,
  auth: authRouter,
  apiKeys: apiKeysRouter,
  config: configRouter,
  fork: forkRouter,
  logs: logsRouter,
  proxy: proxyRouter,
  mcp: mcpRouter,
  mcpConfig: mcpConfigRouter,
  llm: llmRouter,
  wiki: wikiRouter,
});

export type AppRouter = typeof appRouter;
