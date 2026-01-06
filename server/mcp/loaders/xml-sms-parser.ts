/**
 * XML SMS Parser
 * 
 * Handles multi-gigabyte XML SMS exports using streaming XML parser.
 * Does NOT load entire file into memory - processes messages one at a time.
 */

import { createReadStream } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { createInterface } from 'readline';

export interface SmsMessage {
  text: string;
  timestamp: Date;
  sender: string;
  recipient?: string;
  rawData?: any;
}

export class XMLSmsParser {
  private parser: XMLParser;
  
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }
  
  /**
   * Parse XML SMS export file using streaming
   * Handles multi-gig files by processing one message at a time
   */
  async parse(filePath: string): Promise<SmsMessage[]> {
    const messages: SmsMessage[] = [];
    let xmlBuffer = '';
    let insideMessage = false;
    let depth = 0;
    
    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    
    for await (const line of rl) {
      // Detect message start tags
      if (line.includes('<sms ') || line.includes('<mms ')) {
        insideMessage = true;
        depth++;
        xmlBuffer = line + '\n';
      } else if (insideMessage) {
        xmlBuffer += line + '\n';
        
        // Track depth for nested tags
        const openTags = (line.match(/<[^\/][^>]*>/g) || []).length;
        const closeTags = (line.match(/<\/[^>]+>/g) || []).length;
        depth += openTags - closeTags;
        
        // Message complete when depth returns to 0
        if (depth === 0) {
          const message = this.parseMessageXML(xmlBuffer);
          if (message) {
            messages.push(message);
          }
          xmlBuffer = '';
          insideMessage = false;
        }
      }
    }
    
    return messages;
  }
  
  /**
   * Parse individual SMS/MMS XML block
   */
  private parseMessageXML(xml: string): SmsMessage | null {
    try {
      const parsed = this.parser.parse(xml);
      const smsData = parsed.sms || parsed.mms;
      
      if (!smsData) return null;
      
      // Extract fields (attribute names vary by export tool)
      const text = smsData['@_body'] || smsData['@_text'] || smsData.body || smsData.text || '';
      const timestampMs = parseInt(smsData['@_date'] || smsData['@_timestamp'] || '0');
      const timestamp = timestampMs > 0 ? new Date(timestampMs) : new Date();
      
      // Determine sender (type=1 = received, type=2 = sent)
      const messageType = parseInt(smsData['@_type'] || '0');
      const address = smsData['@_address'] || smsData['@_from'] || 'Unknown';
      const contactName = smsData['@_contact_name'] || smsData['@_name'];
      
      let sender: string;
      let recipient: string | undefined;
      
      if (messageType === 1) {
        // Received message
        sender = contactName || address;
        recipient = 'Me';
      } else if (messageType === 2) {
        // Sent message
        sender = 'Me';
        recipient = contactName || address;
      } else {
        // Unknown type
        sender = contactName || address;
      }
      
      if (!text.trim()) return null; // Skip empty messages
      
      return {
        text: text.trim(),
        timestamp,
        sender,
        recipient,
        rawData: smsData,
      };
    } catch (error) {
      console.error('Failed to parse SMS XML:', error);
      return null;
    }
  }
  
  /**
   * Detect if file is an XML SMS export
   */
  static async detectFormat(filePath: string): Promise<boolean> {
    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    
    let lineCount = 0;
    for await (const line of rl) {
      if (line.includes('<smses') || 
          line.includes('<sms ') ||
          line.includes('<mms ')) {
        return true;
      }
      if (++lineCount > 100) break;
    }
    
    return false;
  }
}
