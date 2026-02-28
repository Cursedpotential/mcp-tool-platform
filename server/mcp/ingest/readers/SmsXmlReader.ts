import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { XMLParser } from 'fast-xml-parser';
import { Document } from 'llamaindex';

/**
 * LlamaIndex Custom Reader for Massive SMS/Call Backup XML Files
 * 
 * Based on legacy logic from `xml-sms-parser.ts` and `enhanced-xml-chunker.py`.
 * Uses stream-processing to handle multi-gigabyte XML files without blowing up RAM.
 */
export class SmsXmlReader {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      // We parse attributes as strings so large numbers (phone numbers, MS timestamps) aren't truncated
      parseAttributeValue: false 
    });
  }

  /**
   * Loads XML data and yields LlamaIndex Documents.
   * Can handle both <smses> and <calls> root schemas from "SMS Backup & Restore".
   */
  async loadData(filePath: string): Promise<Document[]> {
    const documents: Document[] = [];
    let xmlBuffer = '';
    let insideElement = false;
    let depth = 0;

    const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      // Clean stray control characters (from Python legacy code)
      const cleanLine = line.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

      // Detect start of individual message/call tags
      if (cleanLine.includes('<sms ') || cleanLine.includes('<mms ') || cleanLine.includes('<call ')) {
        insideElement = true;
        depth++;
        xmlBuffer = cleanLine + '\n';
      } else if (insideElement) {
        xmlBuffer += cleanLine + '\n';

        // Track XML depth to handle nested nodes
        const openTags = (cleanLine.match(/<[^\/][^>]*>/g) || []).length;
        const closeTags = (cleanLine.match(/<\/[^>]+>/g) || []).length;
        depth += openTags - closeTags;

        // When depth returns to 0, the node is fully buffered
        if (depth === 0) {
          const doc = this.parseElementToDocument(xmlBuffer);
          if (doc) {
            documents.push(doc);
          }
          // Reset for next element
          xmlBuffer = '';
          insideElement = false;
        }
      }
    }

    return documents;
  }

  /**
   * Converts a single raw XML block into a LlamaIndex Document
   */
  private parseElementToDocument(xml: string): Document | null {
    try {
      // Fix stray ampersands before parsing (Legacy Python fix)
      const sanitizedXml = xml.replace(/&(?!#\d+;|#x[0-9A-Fa-f]+;|[A-Za-z][A-Za-z0-9._-]*;)/g, '&amp;');
      
      const parsed = this.parser.parse(sanitizedXml);
      const data = parsed.sms || parsed.mms || parsed.call;

      if (!data) return null;

      const isCall = !!parsed.call;

      // Extract unified metadata
      const timestampMs = parseInt(data['@_date'] || data['@_timestamp'] || '0', 10);
      const timestamp = timestampMs > 0 ? new Date(timestampMs).toISOString() : new Date().toISOString();
      
      const address = data['@_address'] || data['@_number'] || data['@_from'] || 'Unknown';
      const contactName = data['@_contact_name'] || data['@_name'] || 'Unknown';
      const type = data['@_type'] || '0';

      let textContent = '';
      let sender = '';
      let recipient = '';

      if (isCall) {
        // Handle Call Log Schema including Forensic Block Indicators
        const callTypes: Record<string, string> = { 
          "1": "Incoming", 
          "2": "Outgoing", 
          "3": "Missed", 
          "4": "Voicemail", 
          "5": "Rejected",     // FORENSIC: Actively rejected
          "6": "Refused_List"  // FORENSIC: Number on block list
        };
        const duration = data['@_duration'] || '0';
        
        // Forensic Call Blocking Logic (Ported from ConflictAnalysisApp)
        const isBlockedIndicator = type === '5' || type === '6' || (type === '2' && duration === '0');
        const blockEvidence = [];
        if (type === '5') blockEvidence.push("Call actively rejected");
        if (type === '6') blockEvidence.push("Number on refuse/block list");
        if (type === '2' && duration === '0') blockEvidence.push("Outgoing call with 0 duration - did not connect");

        textContent = `${callTypes[type] || 'Unknown'} Call with ${contactName !== 'Unknown' ? contactName : address} (Duration: ${duration}s)`;
        
        if (isBlockedIndicator) {
           textContent += ` [FORENSIC FLAG: ${blockEvidence.join(', ')}]`;
        }

        sender = (type === '2') ? 'Me' : (contactName !== 'Unknown' ? contactName : address);
        recipient = (type === '2') ? (contactName !== 'Unknown' ? contactName : address) : 'Me';
      } else {
        // Handle SMS/MMS Schema
        textContent = data['@_body'] || data['@_text'] || data.body || data.text || '';
        
        if (type === '1') { // Received
          sender = contactName !== 'Unknown' ? contactName : address;
          recipient = 'Me';
        } else if (type === '2') { // Sent
          sender = 'Me';
          recipient = contactName !== 'Unknown' ? contactName : address;
        } else {
          sender = contactName !== 'Unknown' ? contactName : address;
          recipient = 'Unknown';
        }
      }

      if (!textContent.trim()) return null; // Skip empty messages

      // Return a standard LlamaIndex Document
      return new Document({
        text: textContent.trim(),
        metadata: {
          timestamp,
          sender,
          recipient,
          raw_address: address,
          contact_name: contactName,
          record_type: isCall ? 'call' : 'message',
          // We push the whole raw object into metadata so DuckDB can store it as JSON
          raw_data: JSON.stringify(data) 
        }
      });
    } catch (error) {
      console.error('Failed to parse XML node:', error);
      return null;
    }
  }
}
