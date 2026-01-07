/**
 * Base Document Loader for LlamaIndex Integration
 * 
 * Provides common interface for platform-specific parsers (SMS, Facebook, iMessage, etc.)
 * Supports schema detection, auto-mapping, and modular chunking strategies.
 */

// ============================================================================
// DOCUMENT TYPES
// ============================================================================

/**
 * Loaded document with metadata
 */
export interface LoadedDocument {
  id: string;
  platform: 'sms' | 'facebook' | 'imessage' | 'chatgpt' | 'email' | 'whatsapp' | 'generic';
  content: string;
  metadata: DocumentMetadata;
  chunks?: DocumentChunk[];
  entities?: ExtractedEntity[];
  schema?: DetectedSchema;
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  filename: string;
  source_path: string;
  file_size: number;
  mime_type: string;
  created_at: Date;
  modified_at: Date;
  participants?: string[];
  message_count?: number;
  date_range?: [Date, Date];
  custom_fields?: Record<string, any>;
}

/**
 * Document chunk for embedding
 */
export interface DocumentChunk {
  chunk_id: string;
  document_id: string;
  index: number;
  text: string;
  start_offset: number;
  end_offset: number;
  metadata: Record<string, any>;
}

/**
 * Extracted entity
 */
export interface ExtractedEntity {
  entity_id: string;
  type: string;
  name: string;
  confidence: number;
  mentions: number;
  first_mention_offset: number;
}

/**
 * Detected schema
 */
export interface DetectedSchema {
  fields: SchemaField[];
  confidence: number;
  sample_records: any[];
}

/**
 * Schema field definition
 */
export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  description?: string;
  example?: any;
}

// ============================================================================
// CHUNKING STRATEGIES
// ============================================================================

/**
 * Chunking strategy type
 */
export type ChunkingStrategy = 
  | 'fixed_size'
  | 'semantic'
  | 'sliding_window'
  | 'conversation_turn'
  | 'paragraph';

/**
 * Chunking options
 */
export interface ChunkingOptions {
  strategy: ChunkingStrategy;
  chunk_size?: number; // For fixed_size
  chunk_overlap?: number; // For sliding_window
  separator?: string; // For semantic
  preserve_structure?: boolean; // For conversation_turn
}

// ============================================================================
// BASE LOADER CLASS
// ============================================================================

/**
 * Base document loader interface
 * All platform-specific loaders extend this
 */
export abstract class BaseDocumentLoader {
  protected platform: LoadedDocument['platform'];
  
  constructor(platform: LoadedDocument['platform']) {
    this.platform = platform;
  }
  
  /**
   * Load document from file path
   */
  abstract load(filePath: string): Promise<LoadedDocument>;
  
  /**
   * Load document from raw content
   */
  abstract loadFromContent(content: string, metadata: Partial<DocumentMetadata>): Promise<LoadedDocument>;
  
  /**
   * Detect schema from sample data
   */
  async detectSchema(sampleData: any[]): Promise<DetectedSchema> {
    if (sampleData.length === 0) {
      return {
        fields: [],
        confidence: 0,
        sample_records: []
      };
    }
    
    // Extract field names from first record
    const firstRecord = sampleData[0];
    const fields: SchemaField[] = [];
    
    for (const [key, value] of Object.entries(firstRecord)) {
      const type = this.inferType(value);
      const required = sampleData.every(record => record[key] !== undefined && record[key] !== null);
      
      fields.push({
        name: key,
        type,
        required,
        example: value
      });
    }
    
    return {
      fields,
      confidence: 0.9,
      sample_records: sampleData.slice(0, 5)
    };
  }
  
  /**
   * Chunk document using specified strategy
   */
  async chunk(
    document: LoadedDocument,
    options: ChunkingOptions
  ): Promise<DocumentChunk[]> {
    switch (options.strategy) {
      case 'fixed_size':
        return this.chunkFixedSize(document, options.chunk_size || 512, options.chunk_overlap || 0);
      
      case 'sliding_window':
        return this.chunkSlidingWindow(document, options.chunk_size || 512, options.chunk_overlap || 128);
      
      case 'semantic':
        return this.chunkSemantic(document, options.separator || '\n\n');
      
      case 'conversation_turn':
        return this.chunkConversationTurn(document);
      
      case 'paragraph':
        return this.chunkParagraph(document);
      
      default:
        throw new Error(`Unknown chunking strategy: ${options.strategy}`);
    }
  }
  
  /**
   * Extract entities from document
   */
  async extractEntities(document: LoadedDocument): Promise<ExtractedEntity[]> {
    // Placeholder - would integrate with spaCy or other NER
    return [];
  }
  
  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================
  
  /**
   * Infer type from value
   */
  private inferType(value: any): SchemaField['type'] {
    if (value === null || value === undefined) {
      return 'string';
    }
    
    if (Array.isArray(value)) {
      return 'array';
    }
    
    if (typeof value === 'object') {
      // Check if it's a date
      if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
        return 'date';
      }
      return 'object';
    }
    
    if (typeof value === 'number') {
      return 'number';
    }
    
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    
    return 'string';
  }
  
  /**
   * Chunk with fixed size
   */
  private chunkFixedSize(
    document: LoadedDocument,
    chunkSize: number,
    overlap: number
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const text = document.content;
    let index = 0;
    let offset = 0;
    
    while (offset < text.length) {
      const end = Math.min(offset + chunkSize, text.length);
      const chunkText = text.slice(offset, end);
      
      chunks.push({
        chunk_id: `${document.id}_chunk_${index}`,
        document_id: document.id,
        index,
        text: chunkText,
        start_offset: offset,
        end_offset: end,
        metadata: {
          platform: document.platform,
          chunk_size: chunkText.length
        }
      });
      
      index++;
      offset = end - overlap;
    }
    
    return chunks;
  }
  
  /**
   * Chunk with sliding window
   */
  private chunkSlidingWindow(
    document: LoadedDocument,
    windowSize: number,
    overlap: number
  ): DocumentChunk[] {
    return this.chunkFixedSize(document, windowSize, overlap);
  }
  
  /**
   * Chunk by semantic separator
   */
  private chunkSemantic(
    document: LoadedDocument,
    separator: string
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const parts = document.content.split(separator);
    let offset = 0;
    
    parts.forEach((part, index) => {
      if (part.trim().length === 0) {
        offset += part.length + separator.length;
        return;
      }
      
      chunks.push({
        chunk_id: `${document.id}_chunk_${index}`,
        document_id: document.id,
        index,
        text: part.trim(),
        start_offset: offset,
        end_offset: offset + part.length,
        metadata: {
          platform: document.platform,
          separator
        }
      });
      
      offset += part.length + separator.length;
    });
    
    return chunks;
  }
  
  /**
   * Chunk by conversation turn (for chat platforms)
   */
  private chunkConversationTurn(document: LoadedDocument): DocumentChunk[] {
    // Placeholder - would parse conversation structure
    return this.chunkSemantic(document, '\n---\n');
  }
  
  /**
   * Chunk by paragraph
   */
  private chunkParagraph(document: LoadedDocument): DocumentChunk[] {
    return this.chunkSemantic(document, '\n\n');
  }
  
  /**
   * Generate unique document ID
   */
  protected generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// LOADER REGISTRY
// ============================================================================

/**
 * Registry for document loaders
 */
export class DocumentLoaderRegistry {
  private loaders: Map<string, typeof BaseDocumentLoader> = new Map();
  
  /**
   * Register a loader for a platform
   */
  register(platform: string, loader: typeof BaseDocumentLoader): void {
    this.loaders.set(platform, loader);
  }
  
  /**
   * Get loader for platform
   */
  get(platform: string): typeof BaseDocumentLoader | undefined {
    return this.loaders.get(platform);
  }
  
  /**
   * List all registered platforms
   */
  listPlatforms(): string[] {
    return Array.from(this.loaders.keys());
  }
}

// Singleton registry
export const loaderRegistry = new DocumentLoaderRegistry();
