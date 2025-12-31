import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * API keys for MCP client authentication
 */
export const apiKeys = mysqlTable("apiKeys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(), // User-friendly name
  keyHash: varchar("keyHash", { length: 255 }).notNull().unique(), // SHA-256 hash of the key
  keyPrefix: varchar("keyPrefix", { length: 16 }).notNull(), // First 8 chars for display
  permissions: text("permissions").notNull(), // JSON array of permissions
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  isActive: mysqlEnum("isActive", ["true", "false"]).default("true").notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * System prompts for tools and workflows
 */
export const systemPrompts = mysqlTable("systemPrompts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  toolName: varchar("toolName", { length: 255 }), // null for workflow templates
  promptText: text("promptText").notNull(),
  variables: text("variables"), // JSON array of variable names
  version: int("version").default(1).notNull(),
  parentId: int("parentId"), // For versioning
  isActive: mysqlEnum("isActive", ["true", "false"]).default("true").notNull(),
  successRate: int("successRate").default(0), // 0-100
  avgLatencyMs: int("avgLatencyMs").default(0),
  usageCount: int("usageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = typeof systemPrompts.$inferInsert;

/**
 * Workflow templates (multi-tool pipelines)
 */
export const workflowTemplates = mysqlTable("workflowTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  steps: text("steps").notNull(), // JSON array of tool calls
  systemPromptId: int("systemPromptId").references(() => systemPrompts.id),
  isPublic: mysqlEnum("isPublic", ["true", "false"]).default("false").notNull(),
  usageCount: int("usageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = typeof workflowTemplates.$inferInsert;

/**
 * API key usage logs for audit trail
 */
export const apiKeyUsageLogs = mysqlTable("apiKeyUsageLogs", {
  id: int("id").autoincrement().primaryKey(),
  apiKeyId: int("apiKeyId").notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
  toolName: varchar("toolName", { length: 255 }),
  method: varchar("method", { length: 50 }),
  statusCode: int("statusCode"),
  latencyMs: int("latencyMs"),
  tokensUsed: int("tokensUsed"),
  cost: int("cost"), // in cents
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiKeyUsageLog = typeof apiKeyUsageLogs.$inferSelect;
export type InsertApiKeyUsageLog = typeof apiKeyUsageLogs.$inferInsert;