import { mysqlTable, int, varchar, text, mysqlEnum, timestamp } from "drizzle-orm/mysql-core";
import { users } from "./schema";

// NLP Configuration
export const nlpConfig = mysqlTable("nlpConfig", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  similarityThreshold: int().default(75).notNull(), // 0-100
  timeGapMinutes: int().default(30).notNull(), // Minutes between conversation clusters
  chunkingStrategy: mysqlEnum(['fixed_size', 'semantic', 'sliding_window', 'conversation_turn', 'paragraph']).default('semantic').notNull(),
  chunkSize: int().default(512).notNull(), // Tokens
  chunkOverlap: int().default(50).notNull(), // Tokens
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// LLM Provider Configuration
export const llmProviders = mysqlTable("llmProviders", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  providerName: varchar({ length: 100 }).notNull(), // openai, gemini, cohere, groq, claude, etc.
  apiKeyEncrypted: text().notNull(), // Encrypted API key
  baseUrl: varchar({ length: 255 }), // Optional custom endpoint
  isActive: mysqlEnum(['true', 'false']).default('true').notNull(),
  priority: int().default(0).notNull(), // Higher = higher priority
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// LLM Routing Rules
export const llmRoutingRules = mysqlTable("llmRoutingRules", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  taskType: varchar({ length: 50 }).notNull(), // code, math, speed, multimodal, general
  primaryProviderId: int().notNull().references(() => llmProviders.id, { onDelete: "cascade" }),
  fallbackProviderId: int().references(() => llmProviders.id, { onDelete: "set null" }),
  isActive: mysqlEnum(['true', 'false']).default('true').notNull(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Cost Tracking
export const llmCostTracking = mysqlTable("llmCostTracking", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: int().notNull().references(() => llmProviders.id, { onDelete: "cascade" }),
  taskType: varchar({ length: 50 }),
  tokensUsed: int().notNull(),
  costCents: int().notNull(), // Cost in cents (e.g., 150 = $1.50)
  timestamp: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

// Prompt Versions
export const promptVersions = mysqlTable("promptVersions", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  promptName: varchar({ length: 255 }).notNull(), // system, classification_pass_0, etc.
  version: int().notNull(),
  template: text().notNull(),
  author: varchar({ length: 255 }),
  changeDescription: text(),
  isActive: mysqlEnum(['true', 'false']).default('false').notNull(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

// Workflow Definitions
export const workflowDefinitions = mysqlTable("workflowDefinitions", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  workflowName: varchar({ length: 255 }).notNull(),
  workflowJson: text().notNull(), // JSON representation of workflow graph
  description: text(),
  isActive: mysqlEnum(['true', 'false']).default('true').notNull(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Agent Configurations
export const agentConfigurations = mysqlTable("agentConfigurations", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  agentName: varchar({ length: 255 }).notNull(),
  agentType: varchar({ length: 100 }).notNull(), // forensic, document, approval, export, custom
  tools: text().notNull(), // JSON array of tool names
  memoryConfig: text(), // JSON config for memory (type, persistence, TTL)
  coordinationConfig: text(), // JSON config for coordination (parent, siblings, protocol)
  description: text(),
  isActive: mysqlEnum(['true', 'false']).default('true').notNull(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Export History
export const exportHistory = mysqlTable("exportHistory", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  exportType: varchar({ length: 100 }).notNull(), // analysis_results, pattern_library, etc.
  format: varchar({ length: 50 }).notNull(), // json, csv, pdf
  fileSizeBytes: int(),
  filePath: varchar({ length: 500 }),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

// Import History
export const importHistory = mysqlTable("importHistory", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  importType: varchar({ length: 100 }).notNull(), // pattern_library, workflow_definitions, etc.
  status: mysqlEnum(['pending', 'processing', 'success', 'error']).default('pending').notNull(),
  recordsImported: int().default(0).notNull(),
  errorLog: text(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

// Topic Codes
export const topicCodes = mysqlTable("topicCodes", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  code: varchar({ length: 50 }).notNull(), // KAILAH, VISITS, CUSTODY, etc.
  description: text(),
  isActive: mysqlEnum(['true', 'false']).default('true').notNull(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Platform Codes
export const platformCodes = mysqlTable("platformCodes", {
  id: int().autoincrement().notNull(),
  userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
  code: varchar({ length: 50 }).notNull(), // SMS, FB, IMSG, EMAIL, CHATGPT
  description: text(),
  isActive: mysqlEnum(['true', 'false']).default('true').notNull(),
  createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
  updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});
