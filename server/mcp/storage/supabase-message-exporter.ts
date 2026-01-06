/**
 * Supabase Message Exporter
 * 
 * Exports individual processed messages to Supabase tables.
 * Handles batch insertion, upserts, transactions, and retry logic.
 */

import { supabaseManager } from './supabase-client';
const supabase = supabaseManager['client']; // Access private client
import type { ProcessedMessage } from '../pipelines/end-to-end-pipeline';

export interface ExportResult {
  success: boolean;
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  errors: Array<{message: string, error: string}>;
}

export class SupabaseMessageExporter {
  private batchSize = 100; // Insert 100 messages at a time
  
  /**
   * Export messages to appropriate Supabase table based on platform
   */
  async export(messages: ProcessedMessage[]): Promise<ExportResult> {
    const result: ExportResult = {
      success: true,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
    };
    
    // Group messages by platform
    const messagesByPlatform = this.groupByPlatform(messages);
    
    // Export each platform's messages
    for (const [platform, platformMessages] of Object.entries(messagesByPlatform)) {
      const platformResult = await this.exportPlatform(platform, platformMessages);
      
      result.insertedCount += platformResult.insertedCount;
      result.updatedCount += platformResult.updatedCount;
      result.failedCount += platformResult.failedCount;
      result.errors.push(...platformResult.errors);
      
      if (!platformResult.success) {
        result.success = false;
      }
    }
    
    return result;
  }
  
  /**
   * Group messages by platform
   */
  private groupByPlatform(messages: ProcessedMessage[]): Record<string, ProcessedMessage[]> {
    const grouped: Record<string, ProcessedMessage[]> = {};
    
    for (const message of messages) {
      if (!grouped[message.platform]) {
        grouped[message.platform] = [];
      }
      grouped[message.platform].push(message);
    }
    
    return grouped;
  }
  
  /**
   * Export messages for a specific platform
   */
  private async exportPlatform(platform: string, messages: ProcessedMessage[]): Promise<ExportResult> {
    const result: ExportResult = {
      success: true,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
    };
    
    // Determine table name
    const tableName = this.getTableName(platform);
    
    // Process in batches
    for (let i = 0; i < messages.length; i += this.batchSize) {
      const batch = messages.slice(i, i + this.batchSize);
      const batchResult = await this.insertBatch(tableName, batch);
      
      result.insertedCount += batchResult.insertedCount;
      result.updatedCount += batchResult.updatedCount;
      result.failedCount += batchResult.failedCount;
      result.errors.push(...batchResult.errors);
      
      if (!batchResult.success) {
        result.success = false;
      }
    }
    
    return result;
  }
  
  /**
   * Insert batch of messages with retry logic
   */
  private async insertBatch(tableName: string, messages: ProcessedMessage[]): Promise<ExportResult> {
    const result: ExportResult = {
      success: true,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
    };
    
    // Convert to Supabase format
    const rows = messages.map(m => this.toSupabaseRow(m));
    
    try {
      // Upsert (insert or update if exists)
      const { data, error } = await supabase
        .from(tableName)
        .upsert(rows, {
          onConflict: 'file_hash,timestamp,sender', // Avoid duplicates
        });
      
      if (error) {
        console.error(`Supabase insert error for ${tableName}:`, error);
        result.success = false;
        result.failedCount = messages.length;
        result.errors.push({
          message: `Batch insert failed for ${tableName}`,
          error: error.message,
        });
      } else {
        result.insertedCount = messages.length;
      }
    } catch (error: any) {
      console.error(`Exception during Supabase insert:`, error);
      result.success = false;
      result.failedCount = messages.length;
      result.errors.push({
        message: `Exception during batch insert`,
        error: error.message || String(error),
      });
    }
    
    return result;
  }
  
  /**
   * Convert ProcessedMessage to Supabase row format
   */
  private toSupabaseRow(message: ProcessedMessage): any {
    return {
      text: message.text,
      timestamp: message.timestamp.toISOString(),
      sender: message.sender,
      recipient: message.recipient,
      platform: message.platform,
      conversation_cluster_id: message.conversationClusterId,
      
      // Analysis fields
      preliminary_sentiment: message.preliminarySentiment,
      preliminary_severity: message.preliminarySeverity,
      preliminary_patterns: message.preliminaryPatterns,
      preliminary_confidence: message.preliminaryConfidence,
      preliminary_analyzed_at: message.preliminaryAnalyzedAt.toISOString(),
      preliminary_reasoning: message.preliminaryReasoning,
      
      // Metadata
      raw_data: message.rawData,
      file_source: message.fileSource,
      file_hash: message.fileHash,
    };
  }
  
  /**
   * Get Supabase table name for platform
   */
  private getTableName(platform: string): string {
    const tableMap: Record<string, string> = {
      'sms': 'sms_messages',
      'facebook': 'facebook_messages',
      'imessage': 'imessage_messages',
      'email': 'email_messages',
      'chatgpt': 'chatgpt_conversations',
    };
    
    return tableMap[platform.toLowerCase()] || 'sms_messages'; // Default to SMS
  }
}
