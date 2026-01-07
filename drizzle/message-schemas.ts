/**
 * Stubbed Supabase Table Schemas for Platform-Specific Messages
 * 
 * NOTE: These are PLACEHOLDER schemas. User will provide real schemas later.
 * These define the common structure for storing individual messages from each platform.
 */

import { pgTable, text, timestamp, integer, jsonb, uuid, boolean } from 'drizzle-orm/pg-core';

/**
 * Common fields across all message tables:
 * - id: Unique message identifier
 * - text: Message content
 * - timestamp: When message was sent
 * - sender: Who sent the message
 * - recipient: Who received the message (optional)
 * - platform: Source platform (sms, facebook, imessage, etc.)
 * - conversation_cluster_id: Cluster ID (PLAT_YYMM_TOPIC_iii format)
 * 
 * Analysis fields (preliminary):
 * - preliminary_sentiment: Sentiment classification (positive, neutral, negative, hostile, abusive)
 * - preliminary_severity: Severity score (1-10)
 * - preliminary_patterns: Array of detected patterns
 * - preliminary_confidence: Confidence score (0-1)
 * - preliminary_analyzed_at: When preliminary analysis was performed
 * - preliminary_reasoning: Why these classifications were assigned
 * 
 * Metadata fields:
 * - raw_data: Original message data (JSON)
 * - file_source: Original file this message came from
 * - file_hash: SHA-256 hash of source file (chain of custody)
 * - created_at: When record was created in database
 */

export const smsMessages = pgTable('sms_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  sender: text('sender').notNull(),
  recipient: text('recipient'),
  platform: text('platform').default('sms'),
  conversationClusterId: text('conversation_cluster_id'),
  
  // Preliminary analysis fields
  preliminarySentiment: text('preliminary_sentiment'),
  preliminarySeverity: integer('preliminary_severity'),
  preliminaryPatterns: jsonb('preliminary_patterns').$type<string[]>(),
  preliminaryConfidence: integer('preliminary_confidence'), // 0-100
  preliminaryAnalyzedAt: timestamp('preliminary_analyzed_at'),
  preliminaryReasoning: text('preliminary_reasoning'),
  
  // Metadata
  rawData: jsonb('raw_data'),
  fileSource: text('file_source'),
  fileHash: text('file_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const facebookMessages = pgTable('facebook_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  sender: text('sender').notNull(),
  recipient: text('recipient'),
  platform: text('platform').default('facebook'),
  conversationClusterId: text('conversation_cluster_id'),
  
  // Facebook-specific fields
  threadId: text('thread_id'),
  messageType: text('message_type'), // text, photo, video, audio, etc.
  reactions: jsonb('reactions').$type<{emoji: string, user: string}[]>(),
  
  // Preliminary analysis fields
  preliminarySentiment: text('preliminary_sentiment'),
  preliminarySeverity: integer('preliminary_severity'),
  preliminaryPatterns: jsonb('preliminary_patterns').$type<string[]>(),
  preliminaryConfidence: integer('preliminary_confidence'),
  preliminaryAnalyzedAt: timestamp('preliminary_analyzed_at'),
  preliminaryReasoning: text('preliminary_reasoning'),
  
  // Metadata
  rawData: jsonb('raw_data'),
  fileSource: text('file_source'),
  fileHash: text('file_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const imessageMessages = pgTable('imessage_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  sender: text('sender').notNull(),
  recipient: text('recipient'),
  platform: text('platform').default('imessage'),
  conversationClusterId: text('conversation_cluster_id'),
  
  // iMessage-specific fields
  isFromMe: boolean('is_from_me'),
  chatIdentifier: text('chat_identifier'),
  attachmentType: text('attachment_type'), // photo, video, audio, document, etc.
  
  // Preliminary analysis fields
  preliminarySentiment: text('preliminary_sentiment'),
  preliminarySeverity: integer('preliminary_severity'),
  preliminaryPatterns: jsonb('preliminary_patterns').$type<string[]>(),
  preliminaryConfidence: integer('preliminary_confidence'),
  preliminaryAnalyzedAt: timestamp('preliminary_analyzed_at'),
  preliminaryReasoning: text('preliminary_reasoning'),
  
  // Metadata
  rawData: jsonb('raw_data'),
  fileSource: text('file_source'),
  fileHash: text('file_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const emailMessages = pgTable('email_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  sender: text('sender').notNull(),
  recipient: text('recipient'),
  platform: text('platform').default('email'),
  conversationClusterId: text('conversation_cluster_id'),
  
  // Email-specific fields
  subject: text('subject'),
  cc: jsonb('cc').$type<string[]>(),
  bcc: jsonb('bcc').$type<string[]>(),
  inReplyTo: text('in_reply_to'),
  
  // Preliminary analysis fields
  preliminarySentiment: text('preliminary_sentiment'),
  preliminarySeverity: integer('preliminary_severity'),
  preliminaryPatterns: jsonb('preliminary_patterns').$type<string[]>(),
  preliminaryConfidence: integer('preliminary_confidence'),
  preliminaryAnalyzedAt: timestamp('preliminary_analyzed_at'),
  preliminaryReasoning: text('preliminary_reasoning'),
  
  // Metadata
  rawData: jsonb('raw_data'),
  fileSource: text('file_source'),
  fileHash: text('file_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const chatgptConversations = pgTable('chatgpt_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  timestamp: timestamp('timestamp').notNull(),
  sender: text('sender').notNull(), // 'user' or 'assistant'
  recipient: text('recipient'),
  platform: text('platform').default('chatgpt'),
  conversationClusterId: text('conversation_cluster_id'),
  
  // ChatGPT-specific fields
  conversationId: text('conversation_id'),
  model: text('model'), // gpt-4, gpt-3.5-turbo, etc.
  role: text('role'), // user, assistant, system
  
  // Preliminary analysis fields
  preliminarySentiment: text('preliminary_sentiment'),
  preliminarySeverity: integer('preliminary_severity'),
  preliminaryPatterns: jsonb('preliminary_patterns').$type<string[]>(),
  preliminaryConfidence: integer('preliminary_confidence'),
  preliminaryAnalyzedAt: timestamp('preliminary_analyzed_at'),
  preliminaryReasoning: text('preliminary_reasoning'),
  
  // Metadata
  rawData: jsonb('raw_data'),
  fileSource: text('file_source'),
  fileHash: text('file_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Type exports for use in application code
 */
export type SmsMessage = typeof smsMessages.$inferSelect;
export type FacebookMessage = typeof facebookMessages.$inferSelect;
export type ImessageMessage = typeof imessageMessages.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type ChatgptConversation = typeof chatgptConversations.$inferSelect;

export type InsertSmsMessage = typeof smsMessages.$inferInsert;
export type InsertFacebookMessage = typeof facebookMessages.$inferInsert;
export type InsertImessageMessage = typeof imessageMessages.$inferInsert;
export type InsertEmailMessage = typeof emailMessages.$inferInsert;
export type InsertChatgptConversation = typeof chatgptConversations.$inferInsert;
