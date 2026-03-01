/**
 * Production Message Schemas
 * 
 * Based on user's 900-line production schema.
 * Implements full forensic chain of custody and MCL factor tracking.
 */

import { mysqlTable, varchar, varchar, text, timestamp, integer, boolean, json, decimal, real, pgEnum } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const directionEnum = pgEnum('direction', ['inbound', 'outbound', 'unknown']);
export const severityEnum = pgEnum('severity', ['low', 'medium', 'high', 'critical']);
export const timestampPrecisionEnum = pgEnum('timestamp_precision', ['exact', 'approximate', 'inferred']);

// ============================================================================
// REFERENCE TABLES
// ============================================================================

/**
 * MCL 722.23 Best Interest Factors (Michigan Custody Law)
 */
export const mclFactors = mysqlTable('mcl_factors', {
  id: varchar({ length: 255 }).name('id', { length: 2 }).primaryKey(), // A through L
  name: varchar({ length: 255 }).name('name', { length: 200 }).notNull(),
  description: text('description'),
  statutoryText: text('statutory_text'),
});

/**
 * Behavior Categories (18 types)
 */
export const behaviorCategories = mysqlTable('behavior_categories', {
  id: varchar({ length: 255 }).name('id', { length: 50 }).primaryKey(),
  name: varchar({ length: 255 }).name('name', { length: 100 }).notNull(),
  description: text('description'),
  severityDefault: varchar({ length: 255 }).name('severity_default', { length: 20 }).default('medium'),
  mclFactors: varchar({ length: 255 }).name('mcl_factors', { length: 2 }).array(),
});

// ============================================================================
// CORE TABLES
// ============================================================================

/**
 * Source File Tracking (Chain of Custody)
 */
export const messagingDocuments = mysqlTable('messaging_documents', {
  id: varchar({ length: 255 }).name('id').primaryKey().defaultRandom(),
  filename: varchar({ length: 255 }).name('filename', { length: 500 }).notNull(),
  fileHash: varchar({ length: 255 }).name('file_hash', { length: 64 }).notNull(), // SHA-256
  fileSize: integer('file_size'),
  fileType: varchar({ length: 255 }).name('file_type', { length: 50 }), // 'sms_xml', 'facebook_html', etc.
  sourcePlatform: varchar({ length: 255 }).name('source_platform', { length: 50 }), // 'android', 'ios', 'facebook', 'snapchat'
  
  // Chain of custody
  acquiredBy: varchar({ length: 255 }).name('acquired_by', { length: 100 }).default('Matt Salem'),
  acquiredDate: datetime('acquired_date', { withTimezone: true }).notNull().defaultNow(),
  acquisitionMethod: text('acquisition_method'),
  verifiedBy: varchar({ length: 255 }).name('verified_by', { length: 100 }),
  verifiedDate: datetime('verified_date', { withTimezone: true }),
  
  // Storage location
  storagePath: text('storage_path'), // R2 bucket path
  
  metadata: json('metadata').default('{}'),
});

/**
 * Conversation Thread Grouping
 */
export const messagingConversations = mysqlTable('messaging_conversations', {
  id: varchar({ length: 255 }).name('id').primaryKey().defaultRandom(),
  documentId: varchar({ length: 255 }).name('document_id').references(() => messagingDocuments.id),
  
  platform: varchar({ length: 255 }).name('platform', { length: 50 }).notNull(), // 'sms', 'facebook', 'snapchat', 'whatsapp', 'instagram'
  platformId: varchar({ length: 255 }).name('platform_id', { length: 255 }), // Platform-specific thread ID
  
  participants: text('participants').array().notNull(),
  participantCount: integer('participant_count').notNull(),
  primaryParticipant: varchar({ length: 255 }).name('primary_participant', { length: 255 }),
  primaryParticipantNormalized: varchar({ length: 255 }).name('primary_participant_normalized', { length: 255 }), // E.164 format
  
  startedAt: datetime('started_at', { withTimezone: true }),
  endedAt: datetime('ended_at', { withTimezone: true }),
  messageCount: integer('message_count').default(0),
  
  isGroup: boolean('is_group').default(false),
  behaviorSummary: json('behavior_summary').default('{}'),
  
  // Evidence tracking
  isEvidence: boolean('is_evidence').default(false),
  exhibitNumber: varchar({ length: 255 }).name('exhibit_number', { length: 50 }),
  relevanceScore: decimal('relevance_score', { precision: 3, scale: 2 }),
});

/**
 * Individual Messages (Core Forensic Record)
 */
export const messagingMessages = mysqlTable('messaging_messages', {
  id: varchar({ length: 255 }).name('id').primaryKey().defaultRandom(),
  conversationId: varchar({ length: 255 }).name('conversation_id').notNull().references(() => messagingConversations.id),
  documentId: varchar({ length: 255 }).name('document_id').references(() => messagingDocuments.id),
  
  externalId: varchar({ length: 255 }).name('external_id', { length: 200 }), // Platform-specific message ID
  serialNumber: integer('serial_number'), // Sequence in conversation
  
  // Timestamp fields
  timestamp: datetime('timestamp', { withTimezone: true }).notNull(),
  timestampPrecision: varchar({ length: 255 }).name('timestamp_precision', { length: 20 }).default('exact'),
  timezone: varchar({ length: 255 }).name('timezone', { length: 50 }),
  dateUs: text('date_us'), // MM/DD/YYYY
  time12h: text('time_12h'), // 12-hour format
  
  // Participants
  sender: varchar({ length: 255 }).name('sender', { length: 255 }).notNull(),
  senderNormalized: varchar({ length: 255 }).name('sender_normalized', { length: 255 }), // E.164 for phones
  senderName: varchar({ length: 255 }).name('sender_name', { length: 255 }),
  recipient: varchar({ length: 255 }).name('recipient', { length: 255 }),
  recipientNormalized: varchar({ length: 255 }).name('recipient_normalized', { length: 255 }),
  
  // Content
  body: text('body'),
  bodyLower: text('body_lower'), // For search
  wordCount: integer('word_count'),
  characterCount: integer('character_count'),
  
  direction: text('direction').notNull(), // 'inbound', 'outbound', 'unknown'
  messageType: text('message_type').default('text'),
  status: text('status'),
  isRead: integer('is_read'),
  
  // Attachments
  hasAttachments: integer('has_attachments').default(0),
  attachmentCount: integer('attachment_count').default(0),
  
  // Thread linking
  previousMessageId: text('previous_message_id'),
  nextMessageId: text('next_message_id'),
  timeSincePreviousSeconds: integer('time_since_previous_seconds'),
  
  // Behavior flags
  hasBehaviors: integer('has_behaviors').default(0),
  behaviorCount: integer('behavior_count').default(0),
  behaviorCategories: text('behavior_categories'), // JSON array
  maxSeverity: text('max_severity'),
  containsApology: integer('contains_apology').default(0),
  containsBlame: integer('contains_blame').default(0),
  containsThreat: integer('contains_threat').default(0),
  containsMinimizing: integer('contains_minimizing').default(0),
  
  // Evidence tracking
  isEvidence: integer('is_evidence').default(0),
  evidenceItemId: text('evidence_item_id'),
  isRedacted: integer('is_redacted').default(0),
  
  // Raw data
  rawData: text('raw_data'), // JSON
  contentHash: varchar({ length: 255 }).name('content_hash', { length: 64 }), // SHA-256 of body
});

/**
 * MMS/Media Attachments
 */
export const messagingAttachments = mysqlTable('messaging_attachments', {
  id: varchar({ length: 255 }).name('id').primaryKey().defaultRandom(),
  messageId: varchar({ length: 255 }).name('message_id').notNull().references(() => messagingMessages.id),
  
  filename: text('filename'),
  fileType: text('file_type').notNull(),
  mimeType: text('mime_type'),
  fileHash: text('file_hash'),
  fileSize: integer('file_size'),
  
  storagePath: text('storage_path'),
  thumbnailPath: text('thumbnail_path'),
  
  width: integer('width'),
  height: integer('height'),
  durationSeconds: integer('duration_seconds'),
  
  ocrText: text('ocr_text'),
  transcription: text('transcription'),
  
  containsFaces: integer('contains_faces'),
  isScreenshot: integer('is_screenshot'),
  exifData: text('exif_data'), // JSON
});

/**
 * Detected Behaviors (Pattern Matches)
 */
export const messagingBehaviors = mysqlTable('messaging_behaviors', {
  id: varchar({ length: 255 }).name('id').primaryKey().defaultRandom(),
  messageId: varchar({ length: 255 }).name('message_id').notNull().references(() => messagingMessages.id),
  
  category: text('category').notNull(), // FK to behavior_categories
  subcategory: text('subcategory'),
  
  matchedPattern: text('matched_pattern'),
  matchedText: text('matched_text'),
  startChar: integer('start_char'),
  endChar: integer('end_char'),
  contextBefore: text('context_before'),
  contextAfter: text('context_after'),
  
  confidence: real('confidence').notNull(),
  severity: text('severity').notNull(), // 'low', 'medium', 'high', 'critical'
  
  detectionMethod: text('detection_method').notNull(),
  ruleName: text('rule_name'),
  
  isVerified: integer('is_verified').default(0),
  verifiedBy: text('verified_by'),
  verifiedAt: text('verified_at'),
});

/**
 * Court-Ready Evidence Items
 */
export const messagingEvidenceItems = mysqlTable('messaging_evidence_items', {
  id: varchar({ length: 255 }).name('id').primaryKey().defaultRandom(),
  messageId: varchar({ length: 255 }).name('message_id').references(() => messagingMessages.id),
  
  exhibitNumber: varchar({ length: 255 }).name('exhibit_number', { length: 50 }),
  title: text('title'),
  description: text('description'),
  
  mclFactors: text('mcl_factors').array(),
  relevanceScore: integer('relevance_score'),
  
  verifiedBy: text('verified_by'),
  verifiedAt: datetime('verified_at', { withTimezone: true }),
});

/**
 * Links Evidence to MCL Factors
 */
export const messagingFactorCitations = mysqlTable('messaging_factor_citations', {
  id: varchar({ length: 255 }).name('id').primaryKey().defaultRandom(),
  evidenceItemId: varchar({ length: 255 }).name('evidence_item_id').references(() => messagingEvidenceItems.id),
  factorId: varchar({ length: 255 }).name('factor_id', { length: 2 }).references(() => mclFactors.id),
  
  supportingText: text('supporting_text'),
  relevanceExplanation: text('relevance_explanation'),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const messagingDocumentsRelations = relations(messagingDocuments, ({ many }) => ({
  conversations: many(messagingConversations),
  messages: many(messagingMessages),
}));

export const messagingConversationsRelations = relations(messagingConversations, ({ one, many }) => ({
  document: one(messagingDocuments, {
    fields: [messagingConversations.documentId],
    references: [messagingDocuments.id],
  }),
  messages: many(messagingMessages),
}));

export const messagingMessagesRelations = relations(messagingMessages, ({ one, many }) => ({
  conversation: one(messagingConversations, {
    fields: [messagingMessages.conversationId],
    references: [messagingConversations.id],
  }),
  document: one(messagingDocuments, {
    fields: [messagingMessages.documentId],
    references: [messagingDocuments.id],
  }),
  attachments: many(messagingAttachments),
  behaviors: many(messagingBehaviors),
  evidenceItems: many(messagingEvidenceItems),
}));

export const messagingBehaviorsRelations = relations(messagingBehaviors, ({ one }) => ({
  message: one(messagingMessages, {
    fields: [messagingBehaviors.messageId],
    references: [messagingMessages.id],
  }),
}));

export const messagingEvidenceItemsRelations = relations(messagingEvidenceItems, ({ one, many }) => ({
  message: one(messagingMessages, {
    fields: [messagingEvidenceItems.messageId],
    references: [messagingMessages.id],
  }),
  factorCitations: many(messagingFactorCitations),
}));
