/**
 * Settings Router - Complete Implementation
 *
 * Manages user settings, LLM provider API keys, topic/platform codes,
 * workflow configuration, and routing rules.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../../core/trpc";
import { getMySqlDb } from "../../core/db.mysql";
import {
  nlpConfig,
  llmProviders,
  topicCodes,
  platformCodes,
  llmRoutingRules,
  llmCostTracking,
} from "../../../drizzle/settings-schema";
import { users } from "../../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
} from "../../core/encryption";

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_NLP_CONFIG = {
  similarityThreshold: 75,
  timeGapMinutes: 30,
  chunkingStrategy: "semantic" as const,
  chunkSize: 512,
  chunkOverlap: 50,
};

const DEFAULT_WORKFLOW_CONFIG = {
  passesEnabled: [0, 1, 2, 3, 4, 5, 6],
  passWeights: {
    "0": 1.0, // Initial parse
    "1": 1.0, // Pattern matching
    "2": 1.0, // Sentiment analysis
    "3": 1.0, // Entity extraction
    "4": 1.0, // Relationship mapping
    "5": 1.0, // Contradiction detection
    "6": 1.0, // Final aggregation
  },
  severityThreshold: 8,
};

const DEFAULT_COLAB_CONFIG = {
  projectId: "",
  region: "",
  runtimeTemplate: "",
  serviceAccountJson: "",
  notebookPath: "",
  syncBucket: "",
};


// ============================================================================
// Settings Router
// ============================================================================

export const settingsRouter = router({
  // ============================================================================
  // NLP Configuration
  // ============================================================================

  getNlpConfig: protectedProcedure.query(async ({ ctx }) => {
    const db = await getMySqlDb();
    if (!db) return DEFAULT_NLP_CONFIG;

    const config = await db
      .select()
      .from(nlpConfig)
      .where(eq(nlpConfig.userId, ctx.user.id))
      .limit(1);

    if (config.length === 0) return DEFAULT_NLP_CONFIG;

    return {
      similarityThreshold: config[0].similarityThreshold,
      timeGapMinutes: config[0].timeGapMinutes,
      chunkingStrategy: config[0].chunkingStrategy,
      chunkSize: config[0].chunkSize,
      chunkOverlap: config[0].chunkOverlap,
    };
  }),

  updateNlpConfig: protectedProcedure
    .input(
      z.object({
        similarityThreshold: z.number().min(0).max(100),
        timeGapMinutes: z.number().min(1),
        chunkingStrategy: z.enum([
          "fixed_size",
          "semantic",
          "sliding_window",
          "conversation_turn",
          "paragraph",
        ]),
        chunkSize: z.number().min(128).max(2048),
        chunkOverlap: z.number().min(0).max(512),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(nlpConfig)
        .where(eq(nlpConfig.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(nlpConfig)
          .set(input)
          .where(eq(nlpConfig.id, existing[0].id));
      } else {
        await db.insert(nlpConfig).values({
          userId: ctx.user.id,
          ...input,
        });
      }

      return input;
    }),

  // ============================================================================
  // API Keys (LLM Providers)
  // ============================================================================

  getApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const db = await getMySqlDb();
    if (!db) return [];

    const providers = await db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.userId, ctx.user.id))
      .orderBy(desc(llmProviders.priority));

    return providers.map((p) => ({
      id: p.id,
      providerName: p.providerName,
      apiKeyMasked: maskApiKey(decryptApiKey(p.apiKeyEncrypted)),
      baseUrl: p.baseUrl,
      isActive: p.isActive === "true",
      priority: p.priority,
    }));
  }),

  addApiKey: protectedProcedure
    .input(
      z.object({
        providerName: z.string(),
        apiKey: z.string(),
        baseUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      const encrypted = encryptApiKey(input.apiKey);

      const [result] = await db.insert(llmProviders).values({
        userId: ctx.user.id,
        providerName: input.providerName,
        apiKeyEncrypted: encrypted,
        baseUrl: input.baseUrl || null,
        isActive: "true",
        priority: 0,
      });

      return {
        id: result.insertId,
        providerName: input.providerName,
        apiKeyMasked: maskApiKey(input.apiKey),
      };
    }),

  updateApiKey: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        apiKey: z.string().optional(),
        baseUrl: z.string().optional(),
        isActive: z.boolean().optional(),
        priority: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      // Verify ownership
      const existing = await db
        .select()
        .from(llmProviders)
        .where(
          and(eq(llmProviders.id, input.id), eq(llmProviders.userId, ctx.user.id))
        )
        .limit(1);

      if (existing.length === 0) {
        throw new Error("API key not found or not authorized");
      }

      const updateData: any = {};
      if (input.apiKey) updateData.apiKeyEncrypted = encryptApiKey(input.apiKey);
      if (input.baseUrl !== undefined) updateData.baseUrl = input.baseUrl;
      if (input.isActive !== undefined)
        updateData.isActive = input.isActive ? "true" : "false";
      if (input.priority !== undefined) updateData.priority = input.priority;

      await db
        .update(llmProviders)
        .set(updateData)
        .where(eq(llmProviders.id, input.id));

      return { success: true };
    }),

  deleteApiKey: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(llmProviders)
        .where(
          and(eq(llmProviders.id, input.id), eq(llmProviders.userId, ctx.user.id))
        );

      return { success: true };
    }),

  testSystemConnectivity: protectedProcedure
    .input(
      z.object({
        type: z.enum(["mysql", "neo4j", "llm_provider"]),
        providerId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, providerId } = input;
      let result = { success: false, message: "" };

      try {
        if (type === "mysql") {
          const db = await getMySqlDb();
          if (!db) throw new Error("MySQL database not available");
          await db.execute(sql`SELECT 1`);
          result = { success: true, message: "MySQL connection successful" };
        } else if (type === "neo4j") {
          const neo4j = await import("neo4j-driver");
          const uri = process.env.NEO4J_URI;
          const user = process.env.NEO4J_USERNAME;
          const password = process.env.NEO4J_PASSWORD;

          if (!uri || !user || !password) throw new Error("Missing Neo4j credentials in environment");

          const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
          const session = driver.session();

          try {
            await session.run("RETURN 1");
            result = { success: true, message: "Neo4j connection successful" };
          } finally {
            await session.close();
            await driver.close();
          }

        } else if (type === "llm_provider") {
          if (!providerId) throw new Error("Provider ID required for LLM test");

          const db = await getMySqlDb();
          if (!db) throw new Error("Database not available");

          const provider = await db
            .select()
            .from(llmProviders)
            .where(eq(llmProviders.id, providerId))
            .limit(1);

          if (provider.length === 0) throw new Error("Provider not found");

          const apiKey = decryptApiKey(provider[0].apiKeyEncrypted);
          const baseUrl = provider[0].baseUrl || "https://api.openai.com/v1"; // Default fallbacks

          // Simple test request (list models is standard usually, or a tiny completion)
          // Using axios directly to avoid dependency on specific SDKs
          const axios = (await import("axios")).default;

          // Construct request based on likely standards (OpenAI-compatible)
          await axios.get(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });

          result = { success: true, message: `Connected to ${provider[0].providerName}` };
        }
      } catch (error: any) {
        result = {
          success: false,
          message: `Connection failed: ${error.message || "Unknown error"}`
        };
      }

      return result;
    }),

  // ============================================================================
  // Database Connections
  // ============================================================================

  getDatabaseConfig: protectedProcedure.query(async ({ ctx }) => {
    // Return masked versions of database connection info
    return {
      mysql: {
        host: process.env.MYSQL_HOST || "localhost",
        user: process.env.MYSQL_USER || "root",
      },
      neo4j: {
        url: process.env.NEO4J_URI
          ? maskApiKey(process.env.NEO4J_URI)
          : "Not configured",
        username: process.env.NEO4J_USERNAME || "Not configured",
      },
      chroma: {
        path: process.env.CHROMA_PATH || "./chroma_data",
      },
    };
  }),

  // ============================================================================
  // Workflow Configuration
  // ============================================================================

  getWorkflowConfig: protectedProcedure.query(async ({ ctx }) => {
    const db = await getMySqlDb();
    if (!db) return DEFAULT_WORKFLOW_CONFIG;

    const workflows = await db
      .select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.userId, ctx.user.id),
          eq(workflowDefinitions.isActive, "true")
        )
      )
      .limit(1);

    if (workflows.length === 0) return DEFAULT_WORKFLOW_CONFIG;

    try {
      return JSON.parse(workflows[0].workflowJson);
    } catch {
      return DEFAULT_WORKFLOW_CONFIG;
    }
  }),

  updateWorkflowConfig: protectedProcedure
    .input(
      z.object({
        workflowName: z.string(),
        workflowJson: z.string(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(workflowDefinitions)
        .where(
          and(
            eq(workflowDefinitions.userId, ctx.user.id),
            eq(workflowDefinitions.workflowName, input.workflowName)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(workflowDefinitions)
          .set({
            workflowJson: input.workflowJson,
            isActive: input.isActive ? "true" : "false",
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(workflowDefinitions.id, existing[0].id));
      } else {
        await db.insert(workflowDefinitions).values({
          userId: ctx.user.id,
          workflowName: input.workflowName,
          workflowJson: input.workflowJson,
          isActive: input.isActive ? "true" : "false",
        });
      }

      return input;
    }),

  // ============================================================================
  // Colab Enterprise Configuration
  // ============================================================================

  getColabConfig: protectedProcedure.query(async ({ ctx }) => {
    const db = await getMySqlDb();
    if (!db) return DEFAULT_COLAB_CONFIG;

    const agents = await db
      .select()
      .from(agentConfigurations)
      .where(
        and(
          eq(agentConfigurations.userId, ctx.user.id),
          eq(agentConfigurations.agentType, "colab")
        )
      )
      .limit(1);

    if (agents.length === 0) return DEFAULT_COLAB_CONFIG;

    try {
      return JSON.parse(agents[0].memoryConfig || "{}");
    } catch {
      return DEFAULT_COLAB_CONFIG;
    }
  }),

  saveColabConfig: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        region: z.string(),
        runtimeTemplate: z.string(),
        serviceAccountJson: z.string().optional(),
        notebookPath: z.string().optional(),
        syncBucket: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(agentConfigurations)
        .where(
          and(
            eq(agentConfigurations.userId, ctx.user.id),
            eq(agentConfigurations.agentType, "colab")
          )
        )
        .limit(1);

      const memoryConfig = JSON.stringify(input);

      if (existing.length > 0) {
        await db
          .update(agentConfigurations)
          .set({
            memoryConfig,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(agentConfigurations.id, existing[0].id));
      } else {
        await db.insert(agentConfigurations).values({
          userId: ctx.user.id,
          agentName: "Colab Enterprise",
          agentType: "colab",
          tools: "[]",
          memoryConfig,
          isActive: "true",
        });
      }

      return { success: true, message: "Colab configuration saved" };
    }),

  testColabConfig: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        region: z.string(),
        runtimeTemplate: z.string(),
        serviceAccountJson: z.string().optional(),
        notebookPath: z.string().optional(),
        syncBucket: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Perform validation check
      if (!input.projectId || !input.region) {
        throw new Error("Project ID and Region are required");
      }

      // Validate Service Account JSON if provided
      if (input.serviceAccountJson) {
        try {
          const sa = JSON.parse(input.serviceAccountJson);
          if (!sa.project_id || !sa.private_key || !sa.client_email) {
            throw new Error("Invalid Service Account JSON format");
          }
          if (sa.project_id !== input.projectId) {
            throw new Error("Service Account project_id does not match configuration");
          }
        } catch (e: any) {
          throw new Error(`Service Account JSON error: ${e.message}`);
        }
      }

      return { success: true, message: "Colab configuration is valid (Validation Only)" };
    }),

  // ============================================================================
  // Topic & Platform Codes
  // ============================================================================

  getTopicCodes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getMySqlDb();
    if (!db) return [];

    const codes = await db
      .select()
      .from(topicCodes)
      .where(eq(topicCodes.userId, ctx.user.id))
      .orderBy(topicCodes.code);

    return codes.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      isActive: c.isActive === "true",
    }));
  }),

  addTopicCode: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      const [result] = await db.insert(topicCodes).values({
        userId: ctx.user.id,
        code: input.code,
        description: input.description || null,
        isActive: "true",
      });

      return {
        id: result.insertId,
        code: input.code,
        description: input.description || null,
        isActive: true,
      };
    }),

  updateTopicCode: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        code: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      const updateData: any = {};
      if (input.code !== undefined) updateData.code = input.code;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.isActive !== undefined)
        updateData.isActive = input.isActive ? "true" : "false";

      await db
        .update(topicCodes)
        .set(updateData)
        .where(
          and(eq(topicCodes.id, input.id), eq(topicCodes.userId, ctx.user.id))
        );

      return { success: true };
    }),

  deleteTopicCode: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(topicCodes)
        .where(
          and(eq(topicCodes.id, input.id), eq(topicCodes.userId, ctx.user.id))
        );

      return { success: true };
    }),

  getPlatformCodes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getMySqlDb();
    if (!db) return [];

    const codes = await db
      .select()
      .from(platformCodes)
      .where(eq(platformCodes.userId, ctx.user.id))
      .orderBy(platformCodes.code);

    return codes.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      isActive: c.isActive === "true",
    }));
  }),

  addPlatformCode: protectedProcedure
    .input(
      z.object({
        code: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      const [result] = await db.insert(platformCodes).values({
        userId: ctx.user.id,
        code: input.code,
        description: input.description || null,
        isActive: "true",
      });

      return {
        id: result.insertId,
        code: input.code,
        description: input.description || null,
        isActive: true,
      };
    }),

  // ============================================================================
  // LLM Routing Rules
  // ============================================================================

  getRoutingRules: protectedProcedure.query(async ({ ctx }) => {
    const db = await getMySqlDb();
    if (!db) return [];

    const rules = await db
      .select()
      .from(llmRoutingRules)
      .where(eq(llmRoutingRules.userId, ctx.user.id));

    // Get provider names for the rules
    const providers = await db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.userId, ctx.user.id));

    const providerMap = new Map(providers.map((p) => [p.id, p.providerName]));

    return rules.map((r) => ({
      id: r.id,
      taskType: r.taskType,
      primaryProvider: providerMap.get(r.primaryProviderId) || "Unknown",
      fallbackProvider: r.fallbackProviderId
        ? providerMap.get(r.fallbackProviderId) || null
        : null,
      isActive: r.isActive === "true",
    }));
  }),

  updateRoutingRules: protectedProcedure
    .input(
      z.object({
        rules: z.array(
          z.object({
            taskType: z.string(),
            primaryProviderId: z.number(),
            fallbackProviderId: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) throw new Error("Database not available");

      // Delete existing rules for this user
      await db
        .delete(llmRoutingRules)
        .where(eq(llmRoutingRules.userId, ctx.user.id));

      // Insert new rules
      if (input.rules.length > 0) {
        await db.insert(llmRoutingRules).values(
          input.rules.map((rule) => ({
            userId: ctx.user.id,
            taskType: rule.taskType,
            primaryProviderId: rule.primaryProviderId,
            fallbackProviderId: rule.fallbackProviderId || null,
            isActive: "true",
          }))
        );
      }

      return { success: true };
    }),

  // ============================================================================
  // Cost Tracking
  // ============================================================================

  getCostTracking: protectedProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        providerId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) return { totalCostCents: 0, byProvider: {}, byTaskType: {} };

      // Build where clause
      const whereClauses = [eq(llmCostTracking.userId, ctx.user.id)];
      if (input.providerId) {
        whereClauses.push(eq(llmCostTracking.providerId, input.providerId));
      }
      if (input.startDate) {
        whereClauses.push(sql`${llmCostTracking.timestamp} >= ${input.startDate}`);
      }
      if (input.endDate) {
        whereClauses.push(sql`${llmCostTracking.timestamp} <= ${input.endDate}`);
      }

      const costs = await db
        .select()
        .from(llmCostTracking)
        .where(and(...whereClauses));

      const providers = await db
        .select()
        .from(llmProviders)
        .where(eq(llmProviders.userId, ctx.user.id));

      const providerMap = new Map(providers.map((p) => [p.id, p.providerName]));

      const totalCostCents = costs.reduce((acc, curr) => acc + curr.costCents, 0);

      const byProvider: Record<string, number> = {};
      const byTaskType: Record<string, number> = {};

      costs.forEach((c) => {
        const providerName = providerMap.get(c.providerId) || "Unknown";
        byProvider[providerName] = (byProvider[providerName] || 0) + c.costCents;

        if (c.taskType) {
          byTaskType[c.taskType] =
            (byTaskType[c.taskType] || 0) + c.costCents;
        }
      });

      return {
        totalCostCents,
        byProvider,
        byTaskType,
      };
    }),
});
