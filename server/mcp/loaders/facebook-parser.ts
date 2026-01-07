/**
 * Facebook HTML Parser
 * 
 * Handles excessively long Facebook HTML exports with nested threads.
 * Uses streaming parser to handle large files without loading entire file into memory.
 */

import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { parse } from 'node-html-parser';

export interface FacebookMessage {
  text: string;
  timestamp: Date;
  sender: string;
  recipient?: string;
  threadId?: string;
  messageType?: string;
  reactions?: Array<{emoji: string, user: string}>;
  rawData?: any;
}

export class FacebookHTMLParser {
  /**
   * Parse Facebook HTML export file
   * Uses streaming to handle large files (100MB+)
   */
  async parse(filePath: string): Promise<FacebookMessage[]> {
    const messages: FacebookMessage[] = [];
    let htmlBuffer = '';
    let insideMessage = false;
    let messageDepth = 0;
    
    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    
    for await (const line of rl) {
      // Detect message boundaries
      if (line.includes('<div class="pam _3-95') || line.includes('data-testid="message"')) {
        insideMessage = true;
        messageDepth++;
      }
      
      if (insideMessage) {
        htmlBuffer += line + '\n';
      }
      
      if (line.includes('</div>') && insideMessage) {
        messageDepth--;
        if (messageDepth === 0) {
          // Parse accumulated message HTML
          const message = this.parseMessageHTML(htmlBuffer);
          if (message) {
            messages.push(message);
          }
          htmlBuffer = '';
          insideMessage = false;
        }
      }
    }
    
    return messages;
  }
  
  /**
   * Parse individual message HTML block
   */
  private parseMessageHTML(html: string): FacebookMessage | null {
    try {
      const root = parse(html);
      
      // Extract sender
      const senderEl = root.querySelector('[data-testid="messenger_username"]') || 
                       root.querySelector('.actor') ||
                       root.querySelector('._3-96._2pio._2lek._2lel');
      const sender = senderEl?.text?.trim() || 'Unknown';
      
      // Extract message text
      const textEl = root.querySelector('[data-testid="messenger_message_text"]') ||
                     root.querySelector('._3-96._2let') ||
                     root.querySelector('.msg');
      const text = textEl?.text?.trim();
      
      if (!text) return null; // Skip empty messages
      
      // Extract timestamp
      const timestampEl = root.querySelector('[data-testid="messenger_timestamp"]') ||
                          root.querySelector('._3-94._2lem');
      const timestampStr = timestampEl?.text?.trim();
      const timestamp = timestampStr ? this.parseTimestamp(timestampStr) : new Date();
      
      // Extract thread ID (if available)
      const threadEl = root.querySelector('[data-thread-id]');
      const threadId = threadEl?.getAttribute('data-thread-id');
      
      // Extract reactions (if any)
      const reactions: Array<{emoji: string, user: string}> = [];
      const reactionEls = root.querySelectorAll('[data-testid="reaction"]');
      for (const reactionEl of reactionEls) {
        const emoji = reactionEl.querySelector('.emoji')?.text?.trim();
        const user = reactionEl.querySelector('.user')?.text?.trim();
        if (emoji && user) {
          reactions.push({ emoji, user });
        }
      }
      
      // Detect message type (text, photo, video, etc.)
      let messageType = 'text';
      if (root.querySelector('[data-testid="photo"]') || html.includes('photo.jpg')) {
        messageType = 'photo';
      } else if (root.querySelector('[data-testid="video"]') || html.includes('video.mp4')) {
        messageType = 'video';
      } else if (root.querySelector('[data-testid="audio"]') || html.includes('audio.mp3')) {
        messageType = 'audio';
      }
      
      return {
        text,
        timestamp,
        sender,
        threadId,
        messageType,
        reactions: reactions.length > 0 ? reactions : undefined,
        rawData: { html: html.substring(0, 500) }, // Store first 500 chars for debugging
      };
    } catch (error) {
      console.error('Failed to parse message HTML:', error);
      return null;
    }
  }
  
  /**
   * Parse Facebook timestamp formats
   * Examples: "Jan 15, 2024 at 3:45 PM", "Monday, January 15, 2024 at 3:45 PM"
   */
  private parseTimestamp(timestampStr: string): Date {
    try {
      // Remove day of week if present
      const cleaned = timestampStr.replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/i, '');
      
      // Try parsing with Date constructor
      const date = new Date(cleaned);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Fallback: current time
      console.warn(`Could not parse timestamp: ${timestampStr}`);
      return new Date();
    } catch (error) {
      console.error('Timestamp parse error:', error);
      return new Date();
    }
  }
  
  /**
   * Detect if file is a Facebook HTML export
   */
  static async detectFormat(filePath: string): Promise<boolean> {
    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    
    let lineCount = 0;
    for await (const line of rl) {
      if (line.includes('facebook') || 
          line.includes('messenger') ||
          line.includes('data-testid="message"')) {
        return true;
      }
      if (++lineCount > 100) break; // Only check first 100 lines
    }
    
    return false;
  }
}
