/**
 * SMS/iMessage Document Loader
 * 
 * Parses SMS/iMessage exports from various formats:
 * - iOS backup (SQLite)
 * - Android SMS backup (XML)
 * - CSV exports
 * - JSON exports
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  BaseDocumentLoader,
  LoadedDocument,
  DocumentMetadata
} from './base-loader';

// ============================================================================
// SMS MESSAGE TYPES
// ============================================================================

export interface SMSMessage {
  id: string;
  timestamp: Date;
  sender: string;
  recipient: string;
  text: string;
  type: 'sent' | 'received';
  thread_id?: string;
  attachments?: string[];
}

export interface SMSThread {
  thread_id: string;
  participants: string[];
  messages: SMSMessage[];
  start_date: Date;
  end_date: Date;
  message_count: number;
}

// ============================================================================
// SMS LOADER CLASS
// ============================================================================

export class SMSDocumentLoader extends BaseDocumentLoader {
  constructor() {
    super('sms');
  }
  
  /**
   * Load SMS export from file
   */
  async load(filePath: string): Promise<LoadedDocument> {
    const ext = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath, 'utf-8');
    
    let messages: SMSMessage[];
    
    switch (ext) {
      case '.json':
        messages = await this.parseJSON(content);
        break;
      case '.csv':
        messages = await this.parseCSV(content);
        break;
      case '.xml':
        messages = await this.parseXML(content);
        break;
      case '.txt':
        messages = await this.parsePlainText(content);
        break;
      default:
        throw new Error(`Unsupported SMS file format: ${ext}`);
    }
    
    const stats = await fs.stat(filePath);
    const threads = this.groupIntoThreads(messages);
    
    return {
      id: this.generateDocumentId(),
      platform: 'sms',
      content: this.formatAsText(messages),
      metadata: {
        filename: path.basename(filePath),
        source_path: filePath,
        file_size: stats.size,
        mime_type: this.getMimeType(ext),
        created_at: stats.birthtime,
        modified_at: stats.mtime,
        participants: this.extractParticipants(messages),
        message_count: messages.length,
        date_range: this.getDateRange(messages)
      },
      schema: await this.detectSchema(messages)
    };
  }
  
  /**
   * Load from raw content string
   */
  async loadFromContent(
    content: string,
    metadata: Partial<DocumentMetadata>
  ): Promise<LoadedDocument> {
    const messages = await this.parseJSON(content);
    
    return {
      id: this.generateDocumentId(),
      platform: 'sms',
      content: this.formatAsText(messages),
      metadata: {
        filename: metadata.filename || 'sms_export.json',
        source_path: metadata.source_path || '',
        file_size: Buffer.byteLength(content, 'utf-8'),
        mime_type: metadata.mime_type || 'application/json',
        created_at: metadata.created_at || new Date(),
        modified_at: metadata.modified_at || new Date(),
        participants: this.extractParticipants(messages),
        message_count: messages.length,
        date_range: this.getDateRange(messages)
      },
      schema: await this.detectSchema(messages)
    };
  }
  
  // ============================================================================
  // FORMAT PARSERS
  // ============================================================================
  
  /**
   * Parse JSON format
   */
  private async parseJSON(content: string): Promise<SMSMessage[]> {
    const data = JSON.parse(content);
    
    // Handle different JSON structures
    if (Array.isArray(data)) {
      return data.map(this.normalizeMessage.bind(this));
    }
    
    if (data.messages && Array.isArray(data.messages)) {
      return data.messages.map(this.normalizeMessage.bind(this));
    }
    
    throw new Error('Unrecognized JSON structure');
  }
  
  /**
   * Parse CSV format
   */
  private async parseCSV(content: string): Promise<SMSMessage[]> {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return [];
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const messages: SMSMessage[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const record: any = {};
      
      headers.forEach((header, index) => {
        record[header] = values[index];
      });
      
      messages.push(this.normalizeMessage(record));
    }
    
    return messages;
  }
  
  /**
   * Parse XML format (Android SMS Backup)
   */
  private async parseXML(content: string): Promise<SMSMessage[]> {
    // Simplified XML parsing - in production would use xml2js
    const messages: SMSMessage[] = [];
    const smsRegex = /<sms[^>]*>/g;
    const matches = content.match(smsRegex);
    
    if (!matches) {
      return [];
    }
    
    for (const match of matches) {
      const addressMatch = match.match(/address="([^"]*)"/);
      const bodyMatch = match.match(/body="([^"]*)"/);
      const dateMatch = match.match(/date="([^"]*)"/);
      const typeMatch = match.match(/type="([^"]*)"/);
      
      if (addressMatch && bodyMatch && dateMatch) {
        messages.push({
          id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(parseInt(dateMatch[1])),
          sender: typeMatch && typeMatch[1] === '2' ? 'me' : addressMatch[1],
          recipient: typeMatch && typeMatch[1] === '2' ? addressMatch[1] : 'me',
          text: bodyMatch[1],
          type: typeMatch && typeMatch[1] === '2' ? 'sent' : 'received'
        });
      }
    }
    
    return messages;
  }
  
  /**
   * Parse plain text format
   */
  private async parsePlainText(content: string): Promise<SMSMessage[]> {
    const messages: SMSMessage[] = [];
    const lines = content.split('\n');
    
    let currentMessage: Partial<SMSMessage> | null = null;
    
    for (const line of lines) {
      // Try to detect message start (common patterns)
      const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
      const senderMatch = line.match(/^([^:]+):/);
      
      if (timestampMatch && senderMatch) {
        // Save previous message
        if (currentMessage && currentMessage.text) {
          messages.push(currentMessage as SMSMessage);
        }
        
        // Start new message
        currentMessage = {
          id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(timestampMatch[1]),
          sender: senderMatch[1].trim(),
          recipient: 'unknown',
          text: line.substring(line.indexOf(':') + 1).trim(),
          type: 'received'
        };
      } else if (currentMessage) {
        // Append to current message
        currentMessage.text += '\n' + line;
      }
    }
    
    // Save last message
    if (currentMessage && currentMessage.text) {
      messages.push(currentMessage as SMSMessage);
    }
    
    return messages;
  }
  
  // ============================================================================
  // HELPERS
  // ============================================================================
  
  /**
   * Normalize message to standard format
   */
  private normalizeMessage(raw: any): SMSMessage {
    return {
      id: raw.id || raw._id || `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(raw.timestamp || raw.date || raw.time || Date.now()),
      sender: raw.sender || raw.from || raw.address || 'unknown',
      recipient: raw.recipient || raw.to || 'unknown',
      text: raw.text || raw.body || raw.message || '',
      type: raw.type || (raw.is_from_me ? 'sent' : 'received'),
      thread_id: raw.thread_id || raw.conversation_id,
      attachments: raw.attachments || []
    };
  }
  
  /**
   * Group messages into conversation threads
   */
  private groupIntoThreads(messages: SMSMessage[]): SMSThread[] {
    const threads: Map<string, SMSThread> = new Map();
    
    for (const msg of messages) {
      const threadKey = msg.thread_id || this.generateThreadKey(msg.sender, msg.recipient);
      
      if (!threads.has(threadKey)) {
        threads.set(threadKey, {
          thread_id: threadKey,
          participants: [msg.sender, msg.recipient],
          messages: [],
          start_date: msg.timestamp,
          end_date: msg.timestamp,
          message_count: 0
        });
      }
      
      const thread = threads.get(threadKey)!;
      thread.messages.push(msg);
      thread.message_count++;
      
      if (msg.timestamp < thread.start_date) {
        thread.start_date = msg.timestamp;
      }
      if (msg.timestamp > thread.end_date) {
        thread.end_date = msg.timestamp;
      }
    }
    
    return Array.from(threads.values());
  }
  
  /**
   * Generate thread key from participants
   */
  private generateThreadKey(sender: string, recipient: string): string {
    const participants = [sender, recipient].sort();
    return participants.join('_');
  }
  
  /**
   * Format messages as readable text
   */
  private formatAsText(messages: SMSMessage[]): string {
    return messages
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(msg => {
        const timestamp = msg.timestamp.toISOString();
        return `[${timestamp}] ${msg.sender}: ${msg.text}`;
      })
      .join('\n\n');
  }
  
  /**
   * Extract unique participants
   */
  private extractParticipants(messages: SMSMessage[]): string[] {
    const participants = new Set<string>();
    for (const msg of messages) {
      participants.add(msg.sender);
      participants.add(msg.recipient);
    }
    return Array.from(participants);
  }
  
  /**
   * Get date range of messages
   */
  private getDateRange(messages: SMSMessage[]): [Date, Date] {
    if (messages.length === 0) {
      const now = new Date();
      return [now, now];
    }
    
    const timestamps = messages.map(m => m.timestamp.getTime());
    return [
      new Date(Math.min(...timestamps)),
      new Date(Math.max(...timestamps))
    ];
  }
  
  /**
   * Get MIME type from extension
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.xml': 'application/xml',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
