/**
 * PDF iMessage Parser
 * 
 * Extracts iMessage conversations from PDF exports.
 * Uses Python bridge with pdfplumber for text extraction.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface ImessageMessage {
  text: string;
  timestamp: Date;
  sender: string;
  recipient?: string;
  isFromMe?: boolean;
  rawData?: any;
}

export class PDFImessageParser {
  /**
   * Parse PDF iMessage export
   * Uses Python pdfplumber for text extraction
   */
  async parse(filePath: string): Promise<ImessageMessage[]> {
    // Extract text from PDF using Python script
    const pythonScript = path.join(__dirname, '../../python-tools/pdf_extractor.py');
    
    try {
      const { stdout } = await execAsync(`python3 "${pythonScript}" "${filePath}"`);
      const extractedText = stdout.trim();
      
      // Parse extracted text into messages
      return this.parseExtractedText(extractedText);
    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  }
  
  /**
   * Parse extracted PDF text into structured messages
   * 
   * Expected format (varies by export tool):
   * - "John Doe [Jan 15, 2024 3:45 PM]: Hello there"
   * - "Me [Jan 15, 2024 3:46 PM]: Hi John!"
   */
  private parseExtractedText(text: string): ImessageMessage[] {
    const messages: ImessageMessage[] = [];
    const lines = text.split('\n');
    
    let currentMessage: Partial<ImessageMessage> | null = null;
    
    for (const line of lines) {
      // Pattern 1: "Sender [Timestamp]: Message"
      const pattern1 = /^(.+?)\s*\[(.+?)\]:\s*(.+)$/;
      const match1 = line.match(pattern1);
      
      if (match1) {
        // Save previous message if exists
        if (currentMessage && currentMessage.text) {
          messages.push(currentMessage as ImessageMessage);
        }
        
        const [, sender, timestampStr, text] = match1;
        currentMessage = {
          sender: sender.trim(),
          timestamp: this.parseTimestamp(timestampStr),
          text: text.trim(),
          isFromMe: sender.trim().toLowerCase() === 'me',
        };
      }
      // Pattern 2: "Timestamp - Sender: Message"
      else {
        const pattern2 = /^(.+?)\s*-\s*(.+?):\s*(.+)$/;
        const match2 = line.match(pattern2);
        
        if (match2) {
          if (currentMessage && currentMessage.text) {
            messages.push(currentMessage as ImessageMessage);
          }
          
          const [, timestampStr, sender, text] = match2;
          currentMessage = {
            sender: sender.trim(),
            timestamp: this.parseTimestamp(timestampStr),
            text: text.trim(),
            isFromMe: sender.trim().toLowerCase() === 'me',
          };
        }
        // Continuation of previous message (multi-line)
        else if (currentMessage && line.trim()) {
          currentMessage.text = (currentMessage.text || '') + ' ' + line.trim();
        }
      }
    }
    
    // Add last message
    if (currentMessage && currentMessage.text) {
      messages.push(currentMessage as ImessageMessage);
    }
    
    return messages.filter(m => m.text && m.text.trim().length > 0);
  }
  
  /**
   * Parse timestamp from various formats
   */
  private parseTimestamp(timestampStr: string): Date {
    try {
      const date = new Date(timestampStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      console.warn(`Could not parse timestamp: ${timestampStr}`);
      return new Date();
    } catch (error) {
      return new Date();
    }
  }
  
  /**
   * Detect if file is a PDF
   */
  static async detectFormat(filePath: string): Promise<boolean> {
    try {
      const buffer = await readFile(filePath);
      const header = buffer.toString('utf-8', 0, 5);
      return header === '%PDF-';
    } catch {
      return false;
    }
  }
}
