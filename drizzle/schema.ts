import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, int, varchar, text, mysqlEnum, timestamp, foreignKey } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const analysisModules = mysqlTable("analysisModules", {
	id: int().autoincrement().notNull(),
	moduleId: varchar({ length: 64 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	category: mysqlEnum(['negative','positive','neutral']).notNull(),
	subcategory: varchar({ length: 100 }),
	isBuiltIn: mysqlEnum(['true','false']).default('true').notNull(),
	isEnabled: mysqlEnum(['true','false']).default('true').notNull(),
	severityWeight: int().default(50),
	mclMapping: varchar({ length: 50 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("analysisModules_moduleId_unique").on(table.moduleId),
]);

export const analysisResults = mysqlTable("analysisResults", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	documentId: varchar({ length: 64 }),
	documentName: varchar({ length: 255 }),
	analysisType: varchar({ length: 100 }).notNull(),
	modulesUsed: text().notNull(),
	overallScore: int(),
	mclFactors: text(),
	findings: text().notNull(),
	timeline: text(),
	contradictions: text(),
	summary: text(),
	status: mysqlEnum(['pending','processing','completed','error']).default('pending').notNull(),
	processingTimeMs: int(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const apiKeyUsageLogs = mysqlTable("apiKeyUsageLogs", {
	id: int().autoincrement().notNull(),
	apiKeyId: int().notNull().references(() => apiKeys.id, { onDelete: "cascade" } ),
	toolName: varchar({ length: 255 }),
	method: varchar({ length: 50 }),
	statusCode: int(),
	latencyMs: int(),
	tokensUsed: int(),
	cost: int(),
	ipAddress: varchar({ length: 45 }),
	userAgent: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const apiKeys = mysqlTable("apiKeys", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	keyHash: varchar({ length: 255 }).notNull(),
	keyPrefix: varchar({ length: 16 }).notNull(),
	permissions: text().notNull(),
	lastUsedAt: timestamp({ mode: 'string' }),
	expiresAt: timestamp({ mode: 'string' }),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	usageCount: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("apiKeys_keyHash_unique").on(table.keyHash),
]);

export const behavioralPatterns = mysqlTable("behavioralPatterns", {
	id: int().autoincrement().notNull(),
	userId: int().references(() => users.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 100 }).notNull(),
	pattern: text().notNull(),
	description: text(),
	severity: int().default(5).notNull(),
	mclFactors: text(),
	examples: text(),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	isCustom: mysqlEnum(['true','false']).default('false').notNull(),
	matchCount: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const bertConfigs = mysqlTable("bertConfigs", {
	id: int().autoincrement().notNull(),
	userId: int().references(() => users.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	modelName: varchar({ length: 255 }).notNull(),
	modelSource: varchar({ length: 50 }).default('huggingface').notNull(),
	taskType: varchar({ length: 50 }).notNull(),
	confidenceThreshold: int().default(70).notNull(),
	maxSequenceLength: int().default(512).notNull(),
	batchSize: int().default(8).notNull(),
	useGpu: mysqlEnum(['true','false']).default('false').notNull(),
	customLabels: text(),
	preprocessingSteps: text(),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	isDefault: mysqlEnum(['true','false']).default('false').notNull(),
	avgLatencyMs: int().default(0),
	usageCount: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const forensicResults = mysqlTable("forensicResults", {
	id: int().autoincrement().notNull(),
	userId: int().references(() => users.id, { onDelete: "cascade" } ),
	sourceHash: varchar({ length: 64 }).notNull(),
	sourceType: varchar({ length: 50 }),
	analysisType: varchar({ length: 50 }).notNull(),
	results: text().notNull(),
	matchCount: int().default(0),
	severityScore: int(),
	mclFactorsMatched: text(),
	processingTimeMs: int(),
	modelUsed: varchar({ length: 255 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const hurtlexCategories = mysqlTable("hurtlexCategories", {
	id: int().autoincrement().notNull(),
	userId: int().references(() => users.id, { onDelete: "cascade" } ),
	code: varchar({ length: 20 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	termCount: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const hurtlexSyncStatus = mysqlTable("hurtlexSyncStatus", {
	id: int().autoincrement().notNull(),
	language: varchar({ length: 10 }).notNull(),
	lastSyncAt: timestamp({ mode: 'string' }),
	termCount: int().default(0).notNull(),
	sourceUrl: text(),
	sourceCommit: varchar({ length: 64 }),
	status: mysqlEnum(['pending','syncing','success','error']).default('pending').notNull(),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const hurtlexTerms = mysqlTable("hurtlexTerms", {
	id: int().autoincrement().notNull(),
	userId: int().references(() => users.id, { onDelete: "cascade" } ),
	term: varchar({ length: 255 }).notNull(),
	category: varchar({ length: 50 }).notNull(),
	language: varchar({ length: 10 }).default('en').notNull(),
	level: varchar({ length: 20 }),
	pos: varchar({ length: 20 }),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	isCustom: mysqlEnum(['true','false']).default('false').notNull(),
	matchCount: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const mclFactors = mysqlTable("mclFactors", {
	id: int().autoincrement().notNull(),
	factorLetter: varchar({ length: 5 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	keywords: text(),
	patternCategories: text(),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("mclFactors_factorLetter_unique").on(table.factorLetter),
]);

export const patternCategories = mysqlTable("patternCategories", {
	id: int().autoincrement().notNull(),
	userId: int().references(() => users.id, { onDelete: "cascade" } ),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	color: varchar({ length: 7 }),
	icon: varchar({ length: 50 }),
	defaultSeverity: int().default(5).notNull(),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	sortOrder: int().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const schemaResolvers = mysqlTable("schemaResolvers", {
	id: int().autoincrement().notNull(),
	userId: int().references(() => users.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	sourceFormat: varchar({ length: 100 }),
	fieldMappings: text().notNull(),
	aiGenerated: mysqlEnum(['true','false']).default('false').notNull(),
	confidence: int(),
	sampleData: text(),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	usageCount: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const severityWeights = mysqlTable("severityWeights", {
	id: int().autoincrement().notNull(),
	userId: int().references(() => users.id, { onDelete: "cascade" } ),
	category: varchar({ length: 100 }).notNull(),
	weight: int().default(5).notNull(),
	description: text(),
	mclFactors: text(),
	escalationThreshold: int(),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const systemPrompts = mysqlTable("systemPrompts", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	toolName: varchar({ length: 255 }),
	promptText: text().notNull(),
	variables: text(),
	version: int().default(1).notNull(),
	parentId: int(),
	isActive: mysqlEnum(['true','false']).default('true').notNull(),
	successRate: int().default(0),
	avgLatencyMs: int().default(0),
	usageCount: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['user','admin']).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("users_openId_unique").on(table.openId),
]);

export const workflowTemplates = mysqlTable("workflowTemplates", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id, { onDelete: "cascade" } ),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	category: varchar({ length: 100 }),
	steps: text().notNull(),
	systemPromptId: int().references(() => systemPrompts.id),
	isPublic: mysqlEnum(['true','false']).default('false').notNull(),
	usageCount: int().default(0),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

// Type exports for TypeScript
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
