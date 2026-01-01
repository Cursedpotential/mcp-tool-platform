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

// ============================================================================
// DOCUMENT INTELLIGENCE TABLES
// ============================================================================

// Documents table - stores metadata about processed documents
export const documents = mysqlTable("documents", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
	filename: varchar({ length: 512 }).notNull(),
	originalPath: varchar({ length: 1024 }),
	mimeType: varchar({ length: 128 }),
	fileSize: int(),
	contentHash: varchar({ length: 64 }).notNull(),
	processingStatus: mysqlEnum(['pending','processing','completed','error']).default('pending').notNull(),
	processingError: text(),
	totalSections: int().default(0),
	totalChunks: int().default(0),
	totalEntities: int().default(0),
	metadata: text(), // JSON: source, platform, date range, etc.
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("documents_contentHash_idx").on(table.contentHash),
	index("documents_userId_idx").on(table.userId),
]);

// Document sections - logical divisions (chapters, conversations, threads)
export const documentSections = mysqlTable("documentSections", {
	id: int().autoincrement().notNull(),
	documentId: int().notNull().references(() => documents.id, { onDelete: "cascade" }),
	parentSectionId: int(), // For nested sections
	sectionType: varchar({ length: 64 }).notNull(), // 'chapter', 'conversation', 'thread', 'paragraph'
	title: varchar({ length: 512 }),
	sequenceNum: int().notNull(), // Order within parent
	startOffset: int().notNull(), // Character offset in original
	endOffset: int().notNull(),
	contentPreview: text(), // First 500 chars for quick reference
	metadata: text(), // JSON: participants, date, platform, etc.
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("documentSections_documentId_idx").on(table.documentId),
	index("documentSections_parentId_idx").on(table.parentSectionId),
]);

// Document chunks - fixed-size pieces for embedding/retrieval
export const documentChunks = mysqlTable("documentChunks", {
	id: int().autoincrement().notNull(),
	documentId: int().notNull().references(() => documents.id, { onDelete: "cascade" }),
	sectionId: int().references(() => documentSections.id, { onDelete: "set null" }),
	chunkIndex: int().notNull(), // Sequential index
	startOffset: int().notNull(),
	endOffset: int().notNull(),
	chunkSize: int().notNull(),
	overlap: int().default(0), // Overlap with previous chunk
	content: text().notNull(),
	contentHash: varchar({ length: 64 }).notNull(),
	embeddingRef: varchar({ length: 128 }), // Reference to vector store
	embeddingModel: varchar({ length: 64 }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("documentChunks_documentId_idx").on(table.documentId),
	index("documentChunks_sectionId_idx").on(table.sectionId),
	index("documentChunks_contentHash_idx").on(table.contentHash),
]);

// Document spans - annotated regions (matches, citations, highlights)
export const documentSpans = mysqlTable("documentSpans", {
	id: int().autoincrement().notNull(),
	documentId: int().notNull().references(() => documents.id, { onDelete: "cascade" }),
	chunkId: int().references(() => documentChunks.id, { onDelete: "set null" }),
	spanType: varchar({ length: 64 }).notNull(), // 'pattern_match', 'entity', 'citation', 'highlight'
	label: varchar({ length: 255 }),
	startOffset: int().notNull(),
	endOffset: int().notNull(),
	matchedText: text().notNull(),
	context: text(), // Surrounding text for reference
	confidence: int(), // 0-100
	metadata: text(), // JSON: pattern_id, entity_type, severity, etc.
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("documentSpans_documentId_idx").on(table.documentId),
	index("documentSpans_chunkId_idx").on(table.chunkId),
	index("documentSpans_spanType_idx").on(table.spanType),
]);

// Document summaries - hierarchical summaries at different levels
export const documentSummaries = mysqlTable("documentSummaries", {
	id: int().autoincrement().notNull(),
	documentId: int().notNull().references(() => documents.id, { onDelete: "cascade" }),
	sectionId: int().references(() => documentSections.id, { onDelete: "cascade" }),
	summaryLevel: mysqlEnum(['document','section','chunk']).notNull(),
	summaryStyle: varchar({ length: 32 }).default('concise'), // 'concise', 'detailed', 'bullet'
	content: text().notNull(),
	wordCount: int(),
	compressionRatio: int(), // Original words / summary words * 100
	modelUsed: varchar({ length: 128 }),
	preserveCitations: mysqlEnum(['true','false']).default('false'),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("documentSummaries_documentId_idx").on(table.documentId),
	index("documentSummaries_sectionId_idx").on(table.sectionId),
]);

// Document entities - extracted named entities with relationships
export const documentEntities = mysqlTable("documentEntities", {
	id: int().autoincrement().notNull(),
	documentId: int().notNull().references(() => documents.id, { onDelete: "cascade" }),
	entityType: varchar({ length: 64 }).notNull(), // 'PERSON', 'ORG', 'DATE', 'LOCATION', etc.
	entityValue: varchar({ length: 512 }).notNull(),
	normalizedValue: varchar({ length: 512 }), // Canonical form
	occurrenceCount: int().default(1),
	firstOccurrence: int(), // Character offset
	confidence: int(), // 0-100
	extractorModel: varchar({ length: 128 }),
	metadata: text(), // JSON: aliases, relationships, context
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
},
(table) => [
	index("documentEntities_documentId_idx").on(table.documentId),
	index("documentEntities_entityType_idx").on(table.entityType),
	index("documentEntities_entityValue_idx").on(table.entityValue),
]);

// Evidence chains - chain of custody tracking for forensic evidence
export const evidenceChains = mysqlTable("evidenceChains", {
	id: int().autoincrement().notNull(),
	userId: int().notNull().references(() => users.id, { onDelete: "cascade" }),
	evidenceId: varchar({ length: 64 }).notNull(), // EVD-xxx-xxx format
	documentId: int().references(() => documents.id, { onDelete: "set null" }),
	originalFilename: varchar({ length: 512 }).notNull(),
	originalHash: varchar({ length: 64 }).notNull(),
	mimeType: varchar({ length: 128 }),
	fileSize: int(),
	chainData: text().notNull(), // JSON: full chain of custody
	isVerified: mysqlEnum(['true','false']).default('true').notNull(),
	verificationErrors: text(),
	metadata: text(), // JSON: case number, source, etc.
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("evidenceChains_evidenceId_idx").on(table.evidenceId),
	index("evidenceChains_userId_idx").on(table.userId),
	index("evidenceChains_originalHash_idx").on(table.originalHash),
]);

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
