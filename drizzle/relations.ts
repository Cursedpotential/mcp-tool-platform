import { relations } from "drizzle-orm/relations";
import { apiKeys, apiKeyUsageLogs, users, behavioralPatterns, bertConfigs, forensicResults, hurtlexCategories, hurtlexTerms, patternCategories, schemaResolvers, severityWeights, systemPrompts, workflowTemplates } from "./schema";

export const apiKeyUsageLogsRelations = relations(apiKeyUsageLogs, ({one}) => ({
	apiKey: one(apiKeys, {
		fields: [apiKeyUsageLogs.apiKeyId],
		references: [apiKeys.id]
	}),
}));

export const apiKeysRelations = relations(apiKeys, ({one, many}) => ({
	apiKeyUsageLogs: many(apiKeyUsageLogs),
	user: one(users, {
		fields: [apiKeys.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	apiKeys: many(apiKeys),
	behavioralPatterns: many(behavioralPatterns),
	bertConfigs: many(bertConfigs),
	forensicResults: many(forensicResults),
	hurtlexCategories: many(hurtlexCategories),
	hurtlexTerms: many(hurtlexTerms),
	patternCategories: many(patternCategories),
	schemaResolvers: many(schemaResolvers),
	severityWeights: many(severityWeights),
	systemPrompts: many(systemPrompts),
	workflowTemplates: many(workflowTemplates),
}));

export const behavioralPatternsRelations = relations(behavioralPatterns, ({one}) => ({
	user: one(users, {
		fields: [behavioralPatterns.userId],
		references: [users.id]
	}),
}));

export const bertConfigsRelations = relations(bertConfigs, ({one}) => ({
	user: one(users, {
		fields: [bertConfigs.userId],
		references: [users.id]
	}),
}));

export const forensicResultsRelations = relations(forensicResults, ({one}) => ({
	user: one(users, {
		fields: [forensicResults.userId],
		references: [users.id]
	}),
}));

export const hurtlexCategoriesRelations = relations(hurtlexCategories, ({one}) => ({
	user: one(users, {
		fields: [hurtlexCategories.userId],
		references: [users.id]
	}),
}));

export const hurtlexTermsRelations = relations(hurtlexTerms, ({one}) => ({
	user: one(users, {
		fields: [hurtlexTerms.userId],
		references: [users.id]
	}),
}));

export const patternCategoriesRelations = relations(patternCategories, ({one}) => ({
	user: one(users, {
		fields: [patternCategories.userId],
		references: [users.id]
	}),
}));

export const schemaResolversRelations = relations(schemaResolvers, ({one}) => ({
	user: one(users, {
		fields: [schemaResolvers.userId],
		references: [users.id]
	}),
}));

export const severityWeightsRelations = relations(severityWeights, ({one}) => ({
	user: one(users, {
		fields: [severityWeights.userId],
		references: [users.id]
	}),
}));

export const systemPromptsRelations = relations(systemPrompts, ({one, many}) => ({
	user: one(users, {
		fields: [systemPrompts.userId],
		references: [users.id]
	}),
	workflowTemplates: many(workflowTemplates),
}));

export const workflowTemplatesRelations = relations(workflowTemplates, ({one}) => ({
	user: one(users, {
		fields: [workflowTemplates.userId],
		references: [users.id]
	}),
	systemPrompt: one(systemPrompts, {
		fields: [workflowTemplates.systemPromptId],
		references: [systemPrompts.id]
	}),
}));