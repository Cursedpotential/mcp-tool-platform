/**
 * Production Document Processing Pipeline
 * 
 * Handles 400-page Facebook HTML, multi-gig XML SMS, PDF iMessage exports.
 * 
 * Architecture:
 * 1. Upload raw file → Directus → R2
 * 2. Detect format and parse
 * 3. Chunk messages for large documents
 * 4. Process each chunk
 * 5. Route to destinations:
 *    - Individual messages → Supabase (messaging_messages table)
 *    - Entities/relationships → Neo4j/Graphiti
 *    - Behaviors → Supabase (messaging_behaviors table)
 * 6. Clear Chroma after 72hrs
 */

import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import nlp from 'compromise';

import { FacebookHTMLParser } from '../loaders/facebook-parser';
import { XMLSmsParser } from '../loaders/xml-sms-parser';
import { PDFImessageParser } from '../loaders/pdf-imessage-parser';
import { MultiPassClassifier } from '../analysis/multi-pass-classifier';
import { ChromaManager } from '../storage/chroma-client';
import { supabaseManager } from '../storage/supabase-client';
import { graphitiClient } from '../storage/graphiti-client';

export interface ProductionPipelineOptions {
  userId: string;
  onProgress?: (current: number, total: number, message: string) => void;
  chunkSize?: number; // Max messages per chunk (default: 100)
}

export interface PipelineResult {
  success: boolean;
  documentId: string;
  conversationIds: string[];
  messageCount: number;
  behaviorCount: number;
  entityCount: number;
  errors: string[];
  processingTimeMs: number;
}

export class ProductionPipeline {
  private classifier: MultiPassClassifier;
  private chromaManager: ChromaManager;
  
  constructor() {
    this.classifier = new MultiPassClassifier();
    this.chromaManager = new ChromaManager();
  }
  
  /**
   * Process document end-to-end
   */
  async processDocument(
    filePath: string,
    options: ProductionPipelineOptions
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const result: PipelineResult = {
      success: true,
      documentId: '',
      conversationIds: [],
      messageCount: 0,
      behaviorCount: 0,
      entityCount: 0,
      errors: [],
      processingTimeMs: 0,
    };
    
    try {
      // Step 1: Upload raw file to Directus → R2
      options.onProgress?.(1, 100, 'Uploading raw file to R2 bucket...');
      const documentRecord = await this.uploadRawFile(filePath, options.userId);
      result.documentId = documentRecord.id;
      
      // Step 2: Detect format and parse
      options.onProgress?.(5, 100, 'Detecting format and parsing...');
      const messages = await this.parseDocument(filePath, documentRecord.fileType);
      
      // Step 3: Chunk messages for large documents
      options.onProgress?.(10, 100, `Chunking ${messages.length} messages...`);
      const chunks = this.chunkMessages(messages, options.chunkSize || 100);
      
      // Step 4: Process each chunk
      let processedCount = 0;
      const allConversations = new Map<string, any>();
      const allBehaviors: any[] = [];
      const allEntities: any[] = [];
      
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const progress = 10 + Math.floor((chunkIndex / chunks.length) * 70);
        options.onProgress?.(progress, 100, `Processing chunk ${chunkIndex + 1}/${chunks.length}...`);
        
        // Step 4a: Store chunk in Chroma (working memory)
        await this.storeChunkInChroma(chunk, documentRecord.id, chunkIndex);
        
        // Step 4b: Classify messages in chunk
        const classifiedMessages = await this.classifyChunk(chunk, options.userId);
        
        // Step 4c: Extract entities from chunk
        const entities = await this.extractEntities(classifiedMessages);
        allEntities.push(...entities);
        
        // Step 4d: Group messages into conversations
        const conversations = this.groupIntoConversations(classifiedMessages, documentRecord);
        conversations.forEach(conv => {
          const key = `${conv.platform}_${conv.primaryParticipant}`;
          if (!allConversations.has(key)) {
            allConversations.set(key, conv);
          } else {
            // Merge messages into existing conversation
            const existing = allConversations.get(key);
            existing.messages.push(...conv.messages);
          }
        });
        
        // Step 4e: Extract behaviors from classified messages
        const behaviors = this.extractBehaviors(classifiedMessages);
        allBehaviors.push(...behaviors);
        
        processedCount += chunk.length;
      }
      
      // Step 5: Insert into Supabase (document → conversations → messages → behaviors)
      options.onProgress?.(80, 100, 'Inserting into Supabase...');
      const conversationIds = await this.insertIntoSupabase(
        documentRecord,
        Array.from(allConversations.values()),
        allBehaviors
      );
      result.conversationIds = conversationIds;
      result.messageCount = processedCount;
      result.behaviorCount = allBehaviors.length;
      
      // Step 6: Insert entities into Neo4j/Graphiti
      options.onProgress?.(90, 100, 'Storing entities in Neo4j...');
      await this.insertEntitiesIntoNeo4j(allEntities, documentRecord.id);
      result.entityCount = allEntities.length;
      
      // Step 7: Schedule Chroma cleanup (72hr TTL)
      options.onProgress?.(95, 100, 'Scheduling Chroma cleanup...');
      await this.scheduleChromaCleanup(documentRecord.id);
      
      options.onProgress?.(100, 100, 'Complete!');
      
    } catch (error: any) {
      console.error('Pipeline error:', error);
      result.success = false;
      result.errors.push(error.message || String(error));
    }
    
    result.processingTimeMs = Date.now() - startTime;
    return result;
  }
  
  /**
   * Step 1: Upload raw file to Directus → R2
   */
  private async uploadRawFile(filePath: string, userId: string): Promise<any> {
    const fileBuffer = await readFile(filePath);
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    const fileName = path.basename(filePath);
    const fileSize = fileBuffer.length;
    const fileType = this.detectFileType(fileName);
    
    // Upload to R2 via Supabase Storage
    const r2Path = `documents/${fileHash}/${fileName}`;
    
    try {
      const { data: uploadData, error: uploadError } = await supabaseManager['client']
        .storage
        .from('evidence-files') // R2 bucket name
        .upload(r2Path, fileBuffer, {
          contentType: this.getContentType(fileType),
          upsert: false,
        });
      
      if (uploadError) {
        console.error('R2 upload failed:', uploadError);
        // Continue anyway, store metadata
      }
    } catch (error) {
      console.error('R2 upload error:', error);
      // Non-fatal, continue
    }
    
    // Create document record in Supabase
    const { data, error } = await supabaseManager['client']
      .from('messaging_documents')
      .insert({
        filename: fileName,
        file_hash: fileHash,
        file_size: fileSize,
        file_type: fileType,
        source_platform: this.detectSourcePlatform(fileType),
        acquired_by: 'Matt Salem',
        acquired_date: new Date().toISOString(),
        acquisition_method: 'User upload via MCP Tool Platform',
        storage_path: r2Path,
      })
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create document record: ${error.message}`);
    return data;
  }
  
  /**
   * Step 2: Parse document based on format
   */
  private async parseDocument(filePath: string, fileType: string): Promise<any[]> {
    const fileName = path.basename(filePath);
    
    if (fileType === 'facebook_html' || fileName.endsWith('.html')) {
      const parser = new FacebookHTMLParser();
      return await parser.parse(filePath);
    } else if (fileType === 'sms_xml' || fileName.endsWith('.xml')) {
      const parser = new XMLSmsParser();
      return await parser.parse(filePath);
    } else if (fileType === 'imessage_pdf' || fileName.endsWith('.pdf')) {
      const parser = new PDFImessageParser();
      return await parser.parse(filePath);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  }
  
  /**
   * Step 3: Chunk messages (prevent LLM choking on 400-page documents)
   */
  private chunkMessages(messages: any[], chunkSize: number): any[][] {
    const chunks: any[][] = [];
    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push(messages.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  /**
   * Step 4a: Store chunk in Chroma (working memory)
   */
  private async storeChunkInChroma(chunk: any[], documentId: string, chunkIndex: number): Promise<void> {
    const collectionName = `doc_${documentId}_processing`;
    
    const chunks = chunk.map((msg: any, idx: number) => ({
      id: `${documentId}_chunk${chunkIndex}_msg${idx}`,
      text: msg.text,
      metadata: {
        document_id: documentId,
        chunk_index: chunkIndex,
        message_index: idx,
        timestamp: msg.timestamp.toISOString(),
        sender: msg.sender,
        classification: 'preliminary',
      },
    }));
    
    // Generate embeddings (placeholder - will use real embedding service)
    const embeddings = chunks.map(() => Array(384).fill(0)); // Mock 384-dim embeddings
    
    await this.chromaManager.addEvidence(documentId, chunks, embeddings);
  }
  
  /**
   * Step 4b: Classify chunk with multi-pass NLP
   */
  private async classifyChunk(chunk: any[], userId: string): Promise<any[]> {
    const classified: any[] = [];
    
    for (const message of chunk) {
      const classification = await this.classifier.classify(message.text, { userId: parseInt(userId) });
      
      classified.push({
        ...message,
        classification,
      });
    }
    
    return classified;
  }
  
  /**
   * Step 4c: Extract entities (people, places, events)
   */
  private async extractEntities(messages: any[]): Promise<any[]> {
    const entities: any[] = [];
    
    // Use compromise.js for lightweight NER (no Python dependency)
    const nlp = require('compromise');
    
    for (const msg of messages) {
      if (!msg.text) continue;
      
      const doc = nlp(msg.text);
      
      // Extract people
      const people = doc.people().out('array');
      people.forEach((person: string) => {
        entities.push({
          type: 'PERSON',
          value: person,
          messageId: msg.id,
          confidence: 0.8,
        });
      });
      
      // Extract places
      const places = doc.places().out('array');
      places.forEach((place: string) => {
        entities.push({
          type: 'LOCATION',
          value: place,
          messageId: msg.id,
          confidence: 0.7,
        });
      });
      
      // Extract dates
      const dates = doc.dates().out('array');
      dates.forEach((date: string) => {
        entities.push({
          type: 'DATE',
          value: date,
          messageId: msg.id,
          confidence: 0.9,
        });
      });
      
      // Extract organizations
      const orgs = doc.organizations().out('array');
      orgs.forEach((org: string) => {
        entities.push({
          type: 'ORGANIZATION',
          value: org,
          messageId: msg.id,
          confidence: 0.7,
        });
      });
    }
    
    // Deduplicate entities
    const uniqueEntities = Array.from(
      new Map(entities.map(e => [`${e.type}_${e.value}`, e])).values()
    );
    
    return uniqueEntities;
  }
  
  /**
   * Step 4d: Group messages into conversations
   */
  private groupIntoConversations(messages: any[], documentRecord: any): any[] {
    const conversationMap = new Map<string, any>();
    
    for (const message of messages) {
      const key = `${message.platform || 'unknown'}_${message.sender}_${message.recipient}`;
      
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          documentId: documentRecord.id,
          platform: message.platform || 'unknown',
          participants: [message.sender, message.recipient].filter(Boolean),
          primaryParticipant: message.sender,
          messages: [],
        });
      }
      
      conversationMap.get(key).messages.push(message);
    }
    
    return Array.from(conversationMap.values());
  }
  
  /**
   * Step 4e: Extract behaviors from classified messages
   */
  private extractBehaviors(messages: any[]): any[] {
    const behaviors: any[] = [];
    
    for (const message of messages) {
      const classification = message.classification;
      if (!classification) continue;
      
      // Extract negative patterns
      for (const pattern of classification.patterns.negative) {
        behaviors.push({
          messageText: message.text,
          messageSender: message.sender,
          messageTimestamp: message.timestamp,
          category: pattern.category,
          subcategory: pattern.name,
          matchedPattern: pattern.name,
          matchedText: pattern.name, 
          confidence: pattern.score / 10, // Convert 1-10 to 0-1
          severity: this.mapSeverity(pattern.score),
          detectionMethod: 'multi_pass_nlp',
          ruleName: pattern.name,
        });
      }
      
      // Extract positive patterns
      for (const pattern of classification.patterns.positive) {
        behaviors.push({
          messageText: message.text,
          messageSender: message.sender,
          messageTimestamp: message.timestamp,
          category: pattern.category,
          subcategory: pattern.name,
          matchedPattern: pattern.name,
          matchedText: pattern.name,
          confidence: pattern.score / 10,
          severity: 'low', // Positive patterns are low severity
          detectionMethod: 'multi_pass_nlp',
          ruleName: pattern.name,
        });
      }
    }
    
    return behaviors;
  }
  
  /**
   * Step 5: Insert into Supabase (hierarchy: document → conversations → messages → behaviors)
   */
  private async insertIntoSupabase(
    documentRecord: any,
    conversations: any[],
    allBehaviors: any[]
  ): Promise<string[]> {
    const conversationIds: string[] = [];
    
    for (const conversation of conversations) {
      // Insert conversation
      const { data: convData, error: convError } = await supabaseManager['client']
        .from('messaging_conversations')
        .insert({
          document_id: documentRecord.id,
          platform: conversation.platform,
          participants: conversation.participants,
          participant_count: conversation.participants.length,
          primary_participant: conversation.primaryParticipant,
          started_at: conversation.messages[0]?.timestamp,
          ended_at: conversation.messages[conversation.messages.length - 1]?.timestamp,
          message_count: conversation.messages.length,
        })
        .select()
        .single();
      
      if (convError) {
        console.error('Failed to insert conversation:', convError);
        continue;
      }
      
      conversationIds.push(convData.id);
      
      // Insert messages
      const messageRecords = conversation.messages.map((msg: any, idx: number) => ({
        conversation_id: convData.id,
        document_id: documentRecord.id,
        serial_number: idx + 1,
        timestamp: msg.timestamp,
        sender: msg.sender,
        recipient: msg.recipient,
        body: msg.text,
        body_lower: msg.text.toLowerCase(),
        word_count: msg.text.split(/\s+/).length,
        character_count: msg.text.length,
        direction: this.detectDirection(msg.sender, documentRecord.userId),
        content_hash: createHash('sha256').update(msg.text).digest('hex'),
        // TODO: Add behavior flags, previous/next message linking
      }));
      
      const { data: msgData, error: msgError } = await supabaseManager['client']
        .from('messaging_messages')
        .insert(messageRecords)
        .select();
      
      if (msgError) {
        console.error('Failed to insert messages:', msgError);
        continue;
      }
      
      // Insert behaviors
      const behaviorRecords = allBehaviors
        .filter(b => conversation.messages.some((m: any) => m.text === b.messageText))
        .map(b => {
          const message = msgData.find((m: any) => m.body === b.messageText);
          if (!message) return null;
          
          return {
            message_id: message.id,
            category: b.category,
            subcategory: b.subcategory,
            matched_pattern: b.matchedPattern,
            matched_text: b.matchedText,
            confidence: b.confidence,
            severity: b.severity,
            detection_method: b.detectionMethod,
            rule_name: b.ruleName,
          };
        })
        .filter(Boolean);
      
      if (behaviorRecords.length > 0) {
        const { error: behaviorError } = await supabaseManager['client']
          .from('messaging_behaviors')
          .insert(behaviorRecords);
        
        if (behaviorError) {
          console.error('Failed to insert behaviors:', behaviorError);
        }
      }
    }
    
    return conversationIds;
  }
  
  /**
   * Step 6: Insert entities into Neo4j/Graphiti
   */
  private async insertEntitiesIntoNeo4j(entities: any[], documentId: string): Promise<void> {
    if (entities.length === 0) {
      console.log('No entities to insert into Neo4j');
      return;
    }
    
    try {
      // Use Graphiti client for entity storage
      for (const entity of entities) {
        await graphitiClient.addEntity({
          name: entity.value,
          type: entity.type,
          metadata: {
            documentId,
            messageId: entity.messageId,
            confidence: entity.confidence,
            extractedAt: new Date().toISOString(),
          },
        });
      }
      
      console.log(`✅ Inserted ${entities.length} entities into Neo4j for document ${documentId}`);
    } catch (error) {
      console.error('Failed to insert entities into Neo4j:', error);
      // Don't throw - entity insertion is non-critical
    }
  }
  
  /**
   * Step 7: Schedule Chroma cleanup (72hr TTL)
   */
  private async scheduleChromaCleanup(documentId: string): Promise<void> {
    // Chroma TTL is handled automatically by ChromaManager
    // This is just a placeholder for explicit cleanup scheduling if needed
    console.log(`Chroma cleanup scheduled for document ${documentId} (72hr TTL)`);
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  private detectFileType(fileName: string): string {
    if (fileName.endsWith('.html')) return 'facebook_html';
    if (fileName.endsWith('.xml')) return 'sms_xml';
    if (fileName.endsWith('.pdf')) return 'imessage_pdf';
    if (fileName.endsWith('.txt')) return 'whatsapp_txt';
    return 'unknown';
  }
  
  private detectSourcePlatform(fileType: string): string {
    if (fileType === 'facebook_html') return 'facebook';
    if (fileType === 'sms_xml') return 'android';
    if (fileType === 'imessage_pdf') return 'ios';
    if (fileType === 'whatsapp_txt') return 'whatsapp';
    return 'unknown';
  }
  
  private detectDirection(sender: string, userId: string): string {
    // Known user identifiers (Matt Salem)
    const userIdentifiers = [
      'matt salem',
      'matthew salem',
      'matt',
      'salem',
      'me',
      'you', // In some exports, user is "you"
    ];
    
    const senderLower = sender.toLowerCase().trim();
    
    // Check if sender matches known user
    for (const identifier of userIdentifiers) {
      if (senderLower.includes(identifier)) {
        return 'outgoing';
      }
    }
    
    // If not user, it's incoming
    return 'incoming';
  }
  
  private mapSeverity(score: number): string {
    if (score >= 9) return 'critical';
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }
  
  private getContentType(fileType: string): string {
    const contentTypes: Record<string, string> = {
      'facebook_html': 'text/html',
      'sms_xml': 'application/xml',
      'imessage_pdf': 'application/pdf',
    };
    return contentTypes[fileType] || 'application/octet-stream';
  }
}