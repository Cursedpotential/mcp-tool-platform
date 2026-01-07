/**
 * Document Hierarchy Manager
 * 
 * Manages the hierarchy: Cases → Conversations → Documents → Chunks
 * Enables cross-platform evidence linking and forensic analysis.
 */

import type { LoadedDocument, DocumentChunk } from './base-loader';
import type { EmbeddingVector } from './embedding-pipeline';

// ============================================================================
// HIERARCHY TYPES
// ============================================================================

/**
 * Case (top-level container)
 */
export interface Case {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: Date;
  updated_at: Date;
  status: 'active' | 'archived' | 'closed';
  metadata: Record<string, any>;
}

/**
 * Conversation (cross-platform message grouping)
 */
export interface Conversation {
  id: string;
  case_id: string;
  name?: string;
  participants: string[];
  platforms: string[];
  start_date: Date;
  end_date: Date;
  message_count: number;
  document_ids: string[];
  metadata: Record<string, any>;
}

/**
 * Document reference in hierarchy
 */
export interface DocumentReference {
  id: string;
  conversation_id: string;
  case_id: string;
  platform: string;
  source_path: string;
  filename: string;
  chunk_count: number;
  indexed_at: Date;
  metadata: Record<string, any>;
}

/**
 * Chunk reference in hierarchy
 */
export interface ChunkReference {
  chunk_id: string;
  document_id: string;
  conversation_id: string;
  case_id: string;
  index: number;
  text: string;
  embedding_id?: string;
  metadata: Record<string, any>;
}

// ============================================================================
// DOCUMENT HIERARCHY MANAGER
// ============================================================================

export class DocumentHierarchyManager {
  /**
   * Create a new case
   */
  async createCase(
    name: string,
    ownerId: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<Case> {
    const caseId = `case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newCase: Case = {
      id: caseId,
      name,
      description,
      owner_id: ownerId,
      created_at: new Date(),
      updated_at: new Date(),
      status: 'active',
      metadata: metadata || {}
    };
    
    console.log(`[Hierarchy] Created case: ${caseId} - ${name}`);
    
    // In production, insert into Supabase:
    // const { createClient } = await import('@supabase/supabase-js');
    // const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
    // await supabase.from('cases').insert(newCase);
    
    return newCase;
  }
  
  /**
   * Create a conversation within a case
   */
  async createConversation(
    caseId: string,
    participants: string[],
    platforms: string[],
    name?: string,
    metadata?: Record<string, any>
  ): Promise<Conversation> {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const conversation: Conversation = {
      id: conversationId,
      case_id: caseId,
      name,
      participants,
      platforms,
      start_date: new Date(),
      end_date: new Date(),
      message_count: 0,
      document_ids: [],
      metadata: metadata || {}
    };
    
    console.log(`[Hierarchy] Created conversation: ${conversationId} in case ${caseId}`);
    
    // In production, insert into Supabase:
    // await supabase.from('conversations').insert(conversation);
    
    return conversation;
  }
  
  /**
   * Link document to conversation
   */
  async linkDocumentToConversation(
    document: LoadedDocument,
    conversationId: string,
    caseId: string
  ): Promise<DocumentReference> {
    const docRef: DocumentReference = {
      id: document.id,
      conversation_id: conversationId,
      case_id: caseId,
      platform: document.platform,
      source_path: document.metadata.source_path,
      filename: document.metadata.filename,
      chunk_count: document.chunks?.length || 0,
      indexed_at: new Date(),
      metadata: document.metadata
    };
    
    console.log(`[Hierarchy] Linked document ${document.id} to conversation ${conversationId}`);
    
    // In production, insert into Supabase:
    // await supabase.from('documents').insert(docRef);
    
    return docRef;
  }
  
  /**
   * Link chunks to document
   */
  async linkChunksToDocument(
    chunks: DocumentChunk[],
    documentId: string,
    conversationId: string,
    caseId: string
  ): Promise<ChunkReference[]> {
    const chunkRefs: ChunkReference[] = chunks.map(chunk => ({
      chunk_id: chunk.chunk_id,
      document_id: documentId,
      conversation_id: conversationId,
      case_id: caseId,
      index: chunk.index,
      text: chunk.text,
      metadata: chunk.metadata
    }));
    
    console.log(`[Hierarchy] Linked ${chunks.length} chunks to document ${documentId}`);
    
    // In production, insert into Supabase:
    // await supabase.from('chunks').insert(chunkRefs);
    
    return chunkRefs;
  }
  
  /**
   * Get full hierarchy for a case
   */
  async getCaseHierarchy(caseId: string): Promise<{
    case: Case;
    conversations: Conversation[];
    documents: DocumentReference[];
    chunk_count: number;
  }> {
    console.log(`[Hierarchy] Fetching hierarchy for case: ${caseId}`);
    
    // In production, query Supabase:
    // const { data: caseData } = await supabase.from('cases').select('*').eq('id', caseId).single();
    // const { data: conversations } = await supabase.from('conversations').select('*').eq('case_id', caseId);
    // const { data: documents } = await supabase.from('documents').select('*').eq('case_id', caseId);
    // const { count: chunkCount } = await supabase.from('chunks').select('*', { count: 'exact', head: true }).eq('case_id', caseId);
    
    // Mock data
    return {
      case: {
        id: caseId,
        name: 'Mock Case',
        owner_id: 'user_001',
        created_at: new Date(),
        updated_at: new Date(),
        status: 'active',
        metadata: {}
      },
      conversations: [],
      documents: [],
      chunk_count: 0
    };
  }
  
  /**
   * Get conversation with all documents and chunks
   */
  async getConversationDetails(conversationId: string): Promise<{
    conversation: Conversation;
    documents: DocumentReference[];
    chunks: ChunkReference[];
  }> {
    console.log(`[Hierarchy] Fetching details for conversation: ${conversationId}`);
    
    // In production, query Supabase with joins
    
    // Mock data
    return {
      conversation: {
        id: conversationId,
        case_id: 'case_001',
        participants: [],
        platforms: [],
        start_date: new Date(),
        end_date: new Date(),
        message_count: 0,
        document_ids: [],
        metadata: {}
      },
      documents: [],
      chunks: []
    };
  }
  
  /**
   * Find conversations by participants
   */
  async findConversationsByParticipants(
    caseId: string,
    participants: string[]
  ): Promise<Conversation[]> {
    console.log(`[Hierarchy] Finding conversations with participants: ${participants.join(', ')}`);
    
    // In production, query Supabase:
    // const { data } = await supabase
    //   .from('conversations')
    //   .select('*')
    //   .eq('case_id', caseId)
    //   .contains('participants', participants);
    
    return [];
  }
  
  /**
   * Get document timeline (chronological order)
   */
  async getDocumentTimeline(conversationId: string): Promise<{
    document_id: string;
    platform: string;
    timestamp: Date;
    chunk_count: number;
  }[]> {
    console.log(`[Hierarchy] Fetching timeline for conversation: ${conversationId}`);
    
    // In production, query with ordering:
    // const { data } = await supabase
    //   .from('documents')
    //   .select('id, platform, metadata, chunk_count')
    //   .eq('conversation_id', conversationId)
    //   .order('metadata->created_at', { ascending: true });
    
    return [];
  }
  
  /**
   * Update conversation date range based on documents
   */
  async updateConversationDateRange(conversationId: string): Promise<void> {
    console.log(`[Hierarchy] Updating date range for conversation: ${conversationId}`);
    
    // In production:
    // const { data: documents } = await supabase
    //   .from('documents')
    //   .select('metadata')
    //   .eq('conversation_id', conversationId);
    // 
    // const dates = documents.map(d => new Date(d.metadata.created_at));
    // const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
    // const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
    // 
    // await supabase
    //   .from('conversations')
    //   .update({ start_date: startDate, end_date: endDate })
    //   .eq('id', conversationId);
  }
  
  /**
   * Delete case and all related data (cascade)
   */
  async deleteCase(caseId: string): Promise<void> {
    console.log(`[Hierarchy] Deleting case: ${caseId} (cascade)`);
    
    // In production, delete with cascade:
    // await supabase.from('cases').delete().eq('id', caseId);
    // (Foreign key constraints will cascade to conversations, documents, chunks, embeddings)
  }
}

// ============================================================================
// CROSS-PLATFORM LINKING
// ============================================================================

/**
 * Link messages across platforms by participants and time proximity
 */
export async function linkCrossPlatformMessages(
  caseId: string,
  timeWindowMinutes: number = 60
): Promise<Conversation[]> {
  console.log(`[Hierarchy] Linking cross-platform messages for case: ${caseId}`);
  
  // In production:
  // 1. Get all documents for case
  // 2. Group by participants (normalize phone numbers, emails, usernames)
  // 3. Group by time proximity (within timeWindowMinutes)
  // 4. Create conversations for each group
  // 5. Link documents to conversations
  
  return [];
}

/**
 * Detect conversation threads across platforms
 */
export async function detectConversationThreads(
  caseId: string,
  similarityThreshold: number = 0.85
): Promise<{
  thread_id: string;
  messages: Array<{
    document_id: string;
    chunk_id: string;
    platform: string;
    timestamp: Date;
    similarity_to_previous: number;
  }>;
}[]> {
  console.log(`[Hierarchy] Detecting conversation threads for case: ${caseId}`);
  
  // In production:
  // 1. Get all chunks for case
  // 2. Use embedding similarity to find related messages
  // 3. Build conversation threads based on similarity + time proximity
  // 4. Return threads with similarity scores
  
  return [];
}

// ============================================================================
// EXPORTS
// ============================================================================

export const hierarchyManager = new DocumentHierarchyManager();
