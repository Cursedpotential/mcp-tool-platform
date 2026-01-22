/**
 * Settings Router - Complete Implementation
 *
 * Manages user settings, LLM provider API keys, topic/platform codes,
 * workflow configuration, and routing rules.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../core/trpc";
import { getDb } from "../core/db";
import {
  userSettings,
  llmProviders,
  topicCodes,
  platformCodes,
  routingRules,
} from "../../drizzle/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ============================================================================
// Encryption Utilities
// ============================================================================

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-32-char-key-change-me!!";
const ALGORITHM = "aes-256-gcm";

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) return encryptedText; // Return as-is if not encrypted format
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return encryptedText; // Return as-is if decryption fails
  }
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.substring(0, 4) + "..." + key.substring(key.length - 4);
}

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
    const db = await getDb();
    if (!db) return DEFAULT_NLP_CONFIG;

    const settings = await db
      .select()
      .from(userSettings)
      .where(
        and(
          eq(userSettings.userId, ctx.user.id),
          eq(userSettings.settingKey, "nlpConfig")
        )
      )
      .limit(1);

    if (settings.length === 0) return DEFAULT_NLP_CONFIG;

    try {
      return JSON.parse(settings[0].settingValue);
    } catch {
      return DEFAULT_NLP_CONFIG;
    }
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
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(userSettings)
        .where(
          and(
            eq(userSettings.userId, ctx.user.id),
            eq(userSettings.settingKey, "nlpConfig")
          )
        )
        .limit(1);

      const settingValue = JSON.stringify(input);

      if (existing.length > 0) {
        await db
          .update(userSettings)
          .set({ settingValue })
          .where(eq(userSettings.id, existing[0].id));
      } else {
        await db.insert(userSettings).values({
          userId: ctx.user.id,
          settingKey: "nlpConfig",
          settingValue,
        });
      }

      return input;
    }),

  // ============================================================================
  // API Keys (LLM Providers)
  // ============================================================================

  getApiKeys: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const providers = await db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.userId, ctx.user.id))
      .orderBy(desc(llmProviders.priority));

    return providers.map((p: any) => ({
      id: p.id,
      providerName: p.providerName,
      apiKeyMasked: maskApiKey(decrypt(p.apiKeyEncrypted)),
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
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const encrypted = encrypt(input.apiKey);

      const result = await db.insert(llmProviders).values({
        userId: ctx.user.id,
        providerName: input.providerName,
        apiKeyEncrypted: encrypted,
        baseUrl: input.baseUrl || null,
        isActive: "true",
        priority: 0,
        usageCount: 0,
        totalCostCents: 0,
      });

      const insertedId = Number(result[0].insertId);

      return {
        id: insertedId,
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
      const db = await getDb();
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

      const updateData: Record<string, unknown> = {};
      if (input.apiKey) updateData.apiKeyEncrypted = encrypt(input.apiKey);
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
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(llmProviders)
        .where(
          and(eq(llmProviders.id, input.id), eq(llmProviders.userId, ctx.user.id))
        );

      return { success: true };
    }),

  testConnection: protectedProcedure
    .input(
      z.object({
        type: z.enum(["supabase", "neo4j", "llm_provider"]),
        providerId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, providerId } = input;
      let result = { success: false, message: "" };

      try {
        if (type === "supabase") {
          const { createClient } = await import("@supabase/supabase-js");
          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

          if (!url || !key) throw new Error("Missing Supabase credentials in environment");

          const supabase = createClient(url, key);
          // Simple health check query
          const { error } = await supabase.from("user_settings").select("id").limit(1);

          if (error) throw error;
          result = { success: true, message: "Supabase connection successful" };

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

          const db = await getDb();
          if (!db) throw new Error("Database not available");

          const provider = await db.query.llmProviders.findFirst({
            where: eq(llmProviders.id, providerId),
          });

          if (!provider) throw new Error("Provider not found");

          const apiKey = decrypt(provider.apiKeyEncrypted);
          const baseUrl = provider.baseUrl || "https://api.openai.com/v1"; // Default fallbacks

          // Simple test request (list models is standard usually, or a tiny completion)
          // Using axios directly to avoid dependency on specific SDKs
          const axios = (await import("axios")).default;

          // Construct request based on likely standards (OpenAI-compatible)
          await axios.get(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });

          result = { success: true, message: `Connected to ${provider.providerName}` };
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
      supabase: {
        url: process.env.SUPABASE_URL
          ? maskApiKey(process.env.SUPABASE_URL)
          : "Not configured",
        key: process.env.SUPABASE_ANON_KEY ? "****...****" : "Not configured",
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
    const db = await getDb();
    if (!db) return DEFAULT_WORKFLOW_CONFIG;

    const settings = await db
      .select()
      .from(userSettings)
      .where(
        and(
          eq(userSettings.userId, ctx.user.id),
          eq(userSettings.settingKey, "workflowConfig")
        )
      )
      .limit(1);

    if (settings.length === 0) return DEFAULT_WORKFLOW_CONFIG;

    try {
      return JSON.parse(settings[0].settingValue);
    } catch {
      return DEFAULT_WORKFLOW_CONFIG;
    }
  }),

  updateWorkflowConfig: protectedProcedure
    .input(
      z.object({
        passesEnabled: z.array(z.number()),
        passWeights: z.record(z.string(), z.number()),
        severityThreshold: z.number().min(1).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(userSettings)
        .where(
          and(
            eq(userSettings.userId, ctx.user.id),
            eq(userSettings.settingKey, "workflowConfig")
          )
        )
        .limit(1);

      const settingValue = JSON.stringify(input);

      if (existing.length > 0) {
        await db
          .update(userSettings)
          .set({ settingValue })
          .where(eq(userSettings.id, existing[0].id));
      } else {
        await db.insert(userSettings).values({
          userId: ctx.user.id,
          settingKey: "workflowConfig",
          settingValue,
        });
      }

      return input;
    }),

  // ============================================================================
  // Colab Enterprise Configuration
  // ============================================================================

  getColabConfig: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return DEFAULT_COLAB_CONFIG;

    const settings = await db
      .select()
      .from(userSettings)
      .where(
        and(
          eq(userSettings.userId, ctx.user.id),
          eq(userSettings.settingKey, "colabConfig")
        )
      )
      .limit(1);

    if (settings.length === 0) return DEFAULT_COLAB_CONFIG;

    try {
      return JSON.parse(settings[0].settingValue);
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
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(userSettings)
        .where(
          and(
            eq(userSettings.userId, ctx.user.id),
            eq(userSettings.settingKey, "colabConfig")
          )
        )
        .limit(1);

      const settingValue = JSON.stringify(input);

      if (existing.length > 0) {
        await db
          .update(userSettings)
          .set({ settingValue })
          .where(eq(userSettings.id, existing[0].id));
      } else {
        await db.insert(userSettings).values({
          userId: ctx.user.id,
          settingKey: "colabConfig",
          settingValue,
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
    const db = await getDb();
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
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(topicCodes).values({
        userId: ctx.user.id,
        code: input.code,
        description: input.description || null,
        isActive: "true",
      });

      const insertedId = Number(result[0].insertId);

      return {
        id: insertedId,
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
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: Record<string, unknown> = {};
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
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(topicCodes)
        .where(
          and(eq(topicCodes.id, input.id), eq(topicCodes.userId, ctx.user.id))
        );

      return { success: true };
    }),

  getPlatformCodes: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
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
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(platformCodes).values({
        userId: ctx.user.id,
        code: input.code,
        description: input.description || null,
        isActive: "true",
      });

      const insertedId = Number(result[0].insertId);

      return {
        id: insertedId,
        code: input.code,
        description: input.description || null,
        isActive: true,
      };
    }),

  // ============================================================================
  // LLM Routing Rules
  // ============================================================================

  getRoutingRules: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const rules = await db
      .select()
      .from(routingRules)
      .where(eq(routingRules.userId, ctx.user.id));

    // Get provider names for the rules
    const providers = await db
      .select()
      .from(llmProviders)
      .where(eq(llmProviders.userId, ctx.user.id));

    const providerMap = new Map(providers.map((p: any) => [p.id, p.providerName]));

    return rules.map((r: any) => ({
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
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete existing rules for this user
      await db.delete(routingRules).where(eq(routingRules.userId, ctx.user.id));

      // Insert new rules
      if (input.rules.length > 0) {
        await db.insert(routingRules).values(
          input.rules.map((rule) => ({
            userId: ctx.user.id,
            taskType: rule.taskType,
            primaryProviderId: rule.primaryProviderId,
            fallbackProviderId: rule.fallbackProviderId || null,
            isActive: "true" as const,
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
      const db = await getDb();
      if (!db)
        return { totalCostCents: 0, byProvider: {}, byTaskType: {} };

      const providers = await db
        .select()
        .from(llmProviders)
        .where(eq(llmProviders.userId, ctx.user.id));

      const totalCostCents = providers.reduce(
        (sum: number, p: any) => sum + p.totalCostCents,
        0
      );
      const byProvider: Record<string, number> = {};

      for (const provider of providers) {
        byProvider[provider.providerName] = provider.totalCostCents;
      }

      return {
        totalCostCents,
        byProvider,
        byTaskType: {}, // Would need usage logs to populate this
      };
    }),
});
