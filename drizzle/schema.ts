import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
  primaryKey
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// ANALYSIS & MODULES
// ============================================================================

export const analysisModules = pgTable(
  "analysisModules",
  {
    id: serial("id").primaryKey(),
    moduleId: varchar("moduleId", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 20 }).notNull(), // negative, positive, neutral
    subcategory: varchar("subcategory", { length: 100 }),
    isBuiltIn: boolean("isBuiltIn").default(true).notNull(),
    isEnabled: boolean("isEnabled").default(true).notNull(),
    severityWeight: integer("severityWeight").default(50),
    mclMapping: varchar("mclMapping", { length: 50 }),
    createdAt: timestamp("createdAt", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    moduleIdIdx: index("analysisModules_moduleId_unique").on(table.moduleId),
  })
);

export const analysisResults = pgTable("analysisResults", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  documentId: varchar("documentId", { length: 64 }),
  documentName: varchar("documentName", { length: 255 }),
  analysisType: varchar("analysisType", { length: 100 }).notNull(),
  modulesUsed: text("modulesUsed").notNull(),
  overallScore: integer("overallScore"),
  mclFactors: text("mclFactors"),
  findings: text("findings").notNull(),
  timeline: text("timeline"),
  contradictions: text("contradictions"),
  summary: text("summary"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  processingTimeMs: integer("processingTimeMs"),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

// ============================================================================
// API KEYS
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: varchar("role", { length: 20 }).default("user").notNull(),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    openIdIdx: index("users_openId_unique").on(table.openId),
  })
);

export const apiKeys = pgTable(
  "apiKeys",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: varchar("keyHash", { length: 255 }).notNull(),
    keyPrefix: varchar("keyPrefix", { length: 16 }).notNull(),
    permissions: text("permissions").notNull(),
    lastUsedAt: timestamp("lastUsedAt", { mode: "string" }),
    expiresAt: timestamp("expiresAt", { mode: "string" }),
    isActive: boolean("isActive").default(true).notNull(),
    usageCount: integer("usageCount").default(0).notNull(),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => ({
    keyHashIdx: index("apiKeys_keyHash_unique").on(table.keyHash),
  })
);

export const apiKeyUsageLogs = pgTable("apiKeyUsageLogs", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("apiKeyId")
    .notNull()
    .references(() => apiKeys.id, { onDelete: "cascade" }),
  toolName: varchar("toolName", { length: 255 }),
  method: varchar("method", { length: 50 }),
  statusCode: integer("statusCode"),
  latencyMs: integer("latencyMs"),
  tokensUsed: integer("tokensUsed"),
  cost: integer("cost"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
});

// ============================================================================
// PATTERNS & CONFIGS
// ============================================================================

export const behavioralPatterns = pgTable("behavioralPatterns", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  pattern: text("pattern").notNull(),
  description: text("description"),
  severity: integer("severity").default(5).notNull(),
  mclFactors: text("mclFactors"),
  examples: text("examples"),
  isActive: boolean("isActive").default(true).notNull(),
  isCustom: boolean("isCustom").default(false).notNull(),
  matchCount: integer("matchCount").default(0).notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const bertConfigs = pgTable("bertConfigs", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  modelName: varchar("modelName", { length: 255 }).notNull(),
  modelSource: varchar("modelSource", { length: 50 })
    .default("huggingface")
    .notNull(),
  taskType: varchar("taskType", { length: 50 }).notNull(),
  confidenceThreshold: integer("confidenceThreshold").default(70).notNull(),
  maxSequenceLength: integer("maxSequenceLength").default(512).notNull(),
  batchSize: integer("batchSize").default(8).notNull(),
  useGpu: boolean("useGpu").default(false).notNull(),
  customLabels: text("customLabels"),
  preprocessingSteps: text("preprocessingSteps"),
  isActive: boolean("isActive").default(true).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  avgLatencyMs: integer("avgLatencyMs").default(0),
  usageCount: integer("usageCount").default(0),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const forensicResults = pgTable("forensicResults", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  sourceHash: varchar("sourceHash", { length: 64 }).notNull(),
  sourceType: varchar("sourceType", { length: 50 }),
  analysisType: varchar("analysisType", { length: 50 }).notNull(),
  results: text("results").notNull(),
  matchCount: integer("matchCount").default(0),
  severityScore: integer("severityScore"),
  mclFactorsMatched: text("mclFactorsMatched"),
  processingTimeMs: integer("processingTimeMs"),
  modelUsed: varchar("modelUsed", { length: 255 }),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
});

export const hurtlexCategories = pgTable("hurtlexCategories", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  termCount: integer("termCount").default(0).notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const hurtlexSyncStatus = pgTable("hurtlexSyncStatus", {
  id: serial("id").primaryKey(),
  language: varchar("language", { length: 10 }).notNull(),
  lastSyncAt: timestamp("lastSyncAt", { mode: "string" }),
  termCount: integer("termCount").default(0).notNull(),
  sourceUrl: text("sourceUrl"),
  sourceCommit: varchar("sourceCommit", { length: 64 }),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const hurtlexTerms = pgTable("hurtlexTerms", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  term: varchar("term", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  language: varchar("language", { length: 10 }).default("en").notNull(),
  level: varchar("level", { length: 20 }),
  pos: varchar("pos", { length: 20 }),
  isActive: boolean("isActive").default(true).notNull(),
  isCustom: boolean("isCustom").default(false).notNull(),
  matchCount: integer("matchCount").default(0).notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const mclFactors = pgTable(
  "mclFactors",
  {
    id: serial("id").primaryKey(),
    factorLetter: varchar("factorLetter", { length: 5 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    keywords: text("keywords"),
    patternCategories: text("patternCategories"),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => ({
    factorLetterIdx: index("mclFactors_factorLetter_unique").on(
      table.factorLetter
    ),
  })
);

export const patternCategories = pgTable("patternCategories", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }),
  icon: varchar("icon", { length: 50 }),
  defaultSeverity: integer("defaultSeverity").default(5).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const schemaResolvers = pgTable("schemaResolvers", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  sourceFormat: varchar("sourceFormat", { length: 100 }),
  fieldMappings: text("fieldMappings").notNull(),
  aiGenerated: boolean("aiGenerated").default(false).notNull(),
  confidence: integer("confidence"),
  sampleData: text("sampleData"),
  isActive: boolean("isActive").default(true).notNull(),
  usageCount: integer("usageCount").default(0),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const severityWeights = pgTable("severityWeights", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 100 }).notNull(),
  weight: integer("weight").default(5).notNull(),
  description: text("description"),
  mclFactors: text("mclFactors"),
  escalationThreshold: integer("escalationThreshold"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const systemPrompts = pgTable("systemPrompts", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  toolName: varchar("toolName", { length: 255 }),
  promptText: text("promptText").notNull(),
  variables: text("variables"),
  version: integer("version").default(1).notNull(),
  parentId: integer("parentId"),
  isActive: boolean("isActive").default(true).notNull(),
  successRate: integer("successRate").default(0),
  avgLatencyMs: integer("avgLatencyMs").default(0),
  usageCount: integer("usageCount").default(0),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const workflowTemplates = pgTable("workflowTemplates", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  steps: text("steps").notNull(),
  systemPromptId: integer("systemPromptId").references(() => systemPrompts.id),
  isPublic: boolean("isPublic").default(false).notNull(),
  usageCount: integer("usageCount").default(0),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

// ============================================================================
// DOCUMENT INTELLIGENCE
// ============================================================================

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 512 }).notNull(),
    originalPath: varchar("originalPath", { length: 1024 }),
    mimeType: varchar("mimeType", { length: 128 }),
    fileSize: integer("fileSize"),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    processingStatus: varchar("processingStatus", { length: 20 })
      .default("pending")
      .notNull(),
    processingError: text("processingError"),
    totalSections: integer("totalSections").default(0),
    totalChunks: integer("totalChunks").default(0),
    totalEntities: integer("totalEntities").default(0),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => ({
    contentHashIdx: index("documents_contentHash_idx").on(table.contentHash),
    userIdIdx: index("documents_userId_idx").on(table.userId),
  })
);

export const documentSections = pgTable(
  "documentSections",
  {
    id: serial("id").primaryKey(),
    documentId: integer("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    parentSectionId: integer("parentSectionId"),
    sectionType: varchar("sectionType", { length: 64 }).notNull(),
    title: varchar("title", { length: 512 }),
    sequenceNum: integer("sequenceNum").notNull(),
    startOffset: integer("startOffset").notNull(),
    endOffset: integer("endOffset").notNull(),
    contentPreview: text("contentPreview"),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => ({
    docIdIdx: index("documentSections_documentId_idx").on(table.documentId),
    parentIdIdx: index("documentSections_parentId_idx").on(
      table.parentSectionId
    ),
  })
);

export const documentChunks = pgTable(
  "documentChunks",
  {
    id: serial("id").primaryKey(),
    documentId: integer("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    sectionId: integer("sectionId").references(() => documentSections.id, {
      onDelete: "set null",
    }),
    chunkIndex: integer("chunkIndex").notNull(),
    startOffset: integer("startOffset").notNull(),
    endOffset: integer("endOffset").notNull(),
    chunkSize: integer("chunkSize").notNull(),
    overlap: integer("overlap").default(0),
    content: text("content").notNull(),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    embeddingRef: varchar("embeddingRef", { length: 128 }),
    embeddingModel: varchar("embeddingModel", { length: 64 }),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => ({
    docIdIdx: index("documentChunks_documentId_idx").on(table.documentId),
    sectionIdIdx: index("documentChunks_sectionId_idx").on(table.sectionId),
    contentHashIdx: index("documentChunks_contentHash_idx").on(
      table.contentHash
    ),
  })
);

export const documentSpans = pgTable(
  "documentSpans",
  {
    id: serial("id").primaryKey(),
    documentId: integer("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkId: integer("chunkId").references(() => documentChunks.id, {
      onDelete: "set null",
    }),
    spanType: varchar("spanType", { length: 64 }).notNull(),
    label: varchar("label", { length: 255 }),
    startOffset: integer("startOffset").notNull(),
    endOffset: integer("endOffset").notNull(),
    matchedText: text("matchedText").notNull(),
    context: text("context"),
    confidence: integer("confidence"),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => ({
    docIdIdx: index("documentSpans_documentId_idx").on(table.documentId),
    chunkIdIdx: index("documentSpans_chunkId_idx").on(table.chunkId),
    spanTypeIdx: index("documentSpans_spanType_idx").on(table.spanType),
  })
);

export const documentSummaries = pgTable(
  "documentSummaries",
  {
    id: serial("id").primaryKey(),
    documentId: integer("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    sectionId: integer("sectionId").references(() => documentSections.id, {
      onDelete: "cascade",
    }),
    summaryLevel: varchar("summaryLevel", { length: 20 }).notNull(), // document, section, chunk
    summaryStyle: varchar("summaryStyle", { length: 32 }).default("concise"),
    content: text("content").notNull(),
    wordCount: integer("wordCount"),
    compressionRatio: integer("compressionRatio"),
    modelUsed: varchar("modelUsed", { length: 128 }),
    preserveCitations: boolean("preserveCitations").default(false),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => ({
    docIdIdx: index("documentSummaries_documentId_idx").on(table.documentId),
    sectionIdIdx: index("documentSummaries_sectionId_idx").on(table.sectionId),
  })
);

export const documentEntities = pgTable(
  "documentEntities",
  {
    id: serial("id").primaryKey(),
    documentId: integer("documentId")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    entityValue: varchar("entityValue", { length: 512 }).notNull(),
    normalizedValue: varchar("normalizedValue", { length: 512 }),
    occurrenceCount: integer("occurrenceCount").default(1),
    firstOccurrence: integer("firstOccurrence"),
    confidence: integer("confidence"),
    extractorModel: varchar("extractorModel", { length: 128 }),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => ({
    docIdIdx: index("documentEntities_documentId_idx").on(table.documentId),
    entityTypeIdx: index("documentEntities_entityType_idx").on(
      table.entityType
    ),
    entityValueIdx: index("documentEntities_entityValue_idx").on(
      table.entityValue
    ),
  })
);

export const evidenceChains = pgTable(
  "evidenceChains",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    evidenceId: varchar("evidenceId", { length: 64 }).notNull(),
    documentId: integer("documentId").references(() => documents.id, {
      onDelete: "set null",
    }),
    originalFilename: varchar("originalFilename", { length: 512 }).notNull(),
    originalHash: varchar("originalHash", { length: 64 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }),
    fileSize: integer("fileSize"),
    chainData: text("chainData").notNull(),
    isVerified: boolean("isVerified").default(true).notNull(),
    verificationErrors: text("verificationErrors"),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
  },
  (table) => ({
    evidenceIdIdx: index("evidenceChains_evidenceId_idx").on(table.evidenceId),
    userIdIdx: index("evidenceChains_userId_idx").on(table.userId),
    originalHashIdx: index("evidenceChains_originalHash_idx").on(
      table.originalHash
    ),
  })
);

// ============================================================================
// SETTINGS
// ============================================================================

export const userSettings = pgTable("userSettings", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  settingKey: varchar("settingKey", { length: 100 }).notNull(),
  settingValue: text("settingValue").notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const llmProviders = pgTable("llmProviders", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  providerName: varchar("providerName", { length: 100 }).notNull(),
  apiKeyEncrypted: text("apiKeyEncrypted").notNull(),
  baseUrl: varchar("baseUrl", { length: 512 }),
  isActive: boolean("isActive").default(true).notNull(),
  priority: integer("priority").default(0).notNull(),
  usageCount: integer("usageCount").default(0).notNull(),
  totalCostCents: integer("totalCostCents").default(0).notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const topicCodes = pgTable("topicCodes", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const platformCodes = pgTable("platformCodes", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

export const routingRules = pgTable("routingRules", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskType: varchar("taskType", { length: 100 }).notNull(),
  primaryProviderId: integer("primaryProviderId")
    .notNull()
    .references(() => llmProviders.id, { onDelete: "cascade" }),
  fallbackProviderId: integer("fallbackProviderId").references(
    () => llmProviders.id,
    { onDelete: "set null" }
  ),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { mode: "string" }).defaultNow().notNull(),
});

// ============================================================================
// TYPES
// ============================================================================

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyUsageLog = typeof apiKeyUsageLogs.$inferSelect;
export type InsertApiKeyUsageLog = typeof apiKeyUsageLogs.$inferInsert;
export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = typeof systemPrompts.$inferInsert;
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = typeof workflowTemplates.$inferInsert;
export type BehavioralPattern = typeof behavioralPatterns.$inferSelect;
export type InsertBehavioralPattern = typeof behavioralPatterns.$inferInsert;
export type PatternCategory = typeof patternCategories.$inferSelect;
export type InsertPatternCategory = typeof patternCategories.$inferInsert;
export type HurtlexTerm = typeof hurtlexTerms.$inferSelect;
export type InsertHurtlexTerm = typeof hurtlexTerms.$inferInsert;
export type HurtlexCategory = typeof hurtlexCategories.$inferSelect;
export type InsertHurtlexCategory = typeof hurtlexCategories.$inferInsert;
export type HurtlexSyncStatus = typeof hurtlexSyncStatus.$inferSelect;
export type InsertHurtlexSyncStatus = typeof hurtlexSyncStatus.$inferInsert;
export type BertConfig = typeof bertConfigs.$inferSelect;
export type InsertBertConfig = typeof bertConfigs.$inferInsert;
export type ForensicResult = typeof forensicResults.$inferSelect;
export type InsertForensicResult = typeof forensicResults.$inferInsert;
export type SchemaResolver = typeof schemaResolvers.$inferSelect;
export type InsertSchemaResolver = typeof schemaResolvers.$inferInsert;
export type SeverityWeight = typeof severityWeights.$inferSelect;
export type InsertSeverityWeight = typeof severityWeights.$inferInsert;
export type MclFactor = typeof mclFactors.$inferSelect;
export type InsertMclFactor = typeof mclFactors.$inferInsert;
export type AnalysisModule = typeof analysisModules.$inferSelect;
export type InsertAnalysisModule = typeof analysisModules.$inferInsert;
export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysisResult = typeof analysisResults.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type DocumentSection = typeof documentSections.$inferSelect;
export type InsertDocumentSection = typeof documentSections.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertDocumentChunk = typeof documentChunks.$inferInsert;
export type DocumentSpan = typeof documentSpans.$inferSelect;
export type InsertDocumentSpan = typeof documentSpans.$inferInsert;
export type DocumentSummary = typeof documentSummaries.$inferSelect;
export type InsertDocumentSummary = typeof documentSummaries.$inferInsert;
export type DocumentEntity = typeof documentEntities.$inferSelect;
export type InsertDocumentEntity = typeof documentEntities.$inferInsert;
export type EvidenceChain = typeof evidenceChains.$inferSelect;
export type InsertEvidenceChain = typeof evidenceChains.$inferInsert;
export type UserSetting = typeof userSettings.$inferSelect;
export type InsertUserSetting = typeof userSettings.$inferInsert;
export type LlmProvider = typeof llmProviders.$inferSelect;
export type InsertLlmProvider = typeof llmProviders.$inferInsert;
export type TopicCode = typeof topicCodes.$inferSelect;
export type InsertTopicCode = typeof topicCodes.$inferInsert;
export type PlatformCode = typeof platformCodes.$inferSelect;
export type InsertPlatformCode = typeof platformCodes.$inferInsert;
export type RoutingRule = typeof routingRules.$inferSelect;
export type InsertRoutingRule = typeof routingRules.$inferInsert;
