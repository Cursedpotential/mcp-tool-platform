/**
 * Unstructured.io Document Loader
 * TypeScript wrapper for Python unstructured parser
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import type { LoadedDocument, DocumentChunk, DocumentMetadata } from './base-loader';

const execAsync = promisify(exec);

// ============================================================================
// TYPES
// ============================================================================

export interface UnstructuredParseOptions {
  strategy?: 'auto' | 'fast' | 'hi_res';
  extractTables?: boolean;
  extractImages?: boolean;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface UnstructuredResult {
  success: boolean;
  file_path: string;
  filename: string;
  file_size: number;
  format: string;
  metadata: Record<string, any>;
  full_text: string;
  element_count: number;
  chunks: Array<{
    index: number;
    text: string;
    type: string;
    metadata: Record<string, any>;
  }>;
  tables: Array<{
    index: number;
    text: string;
    html?: string;
    structured?: {
      headers: string[];
      rows: string[][];
      row_count: number;
      column_count: number;
    };
  }>;
  statistics: {
    total_characters: number;
    total_chunks: number;
    total_tables: number;
    avg_chunk_size: number;
  };
  error?: string;
}

// ============================================================================
// UNSTRUCTURED LOADER
// ============================================================================

export class UnstructuredLoader {
  private pythonScript: string;
  
  constructor() {
    this.pythonScript = path.join(
      __dirname,
      '../../python-tools/unstructured_parser.py'
    );
  }
  
  /**
   * Parse document using Unstructured.io
   */
  async parseDocument(
    filePath: string,
    options: UnstructuredParseOptions = {}
  ): Promise<UnstructuredResult> {
    const {
      strategy = 'auto',
      extractTables = true,
      extractImages = false,
      chunkSize = 1000,
      chunkOverlap = 200
    } = options;
    
    // Build command
    const args = [
      filePath,
      '--strategy', strategy,
      '--chunk-size', chunkSize.toString(),
      '--chunk-overlap', chunkOverlap.toString()
    ];
    
    if (!extractTables) {
      args.push('--no-tables');
    }
    
    if (extractImages) {
      args.push('--extract-images');
    }
    
    const command = `python3 ${this.pythonScript} ${args.join(' ')}`;
    
    console.log(`[UnstructuredLoader] Parsing: ${filePath}`);
    console.log(`[UnstructuredLoader] Strategy: ${strategy}, Chunks: ${chunkSize}/${chunkOverlap}`);
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large documents
      });
      
      if (stderr && !stderr.includes('UserWarning')) {
        console.warn(`[UnstructuredLoader] Warning: ${stderr}`);
      }
      
      const result: UnstructuredResult = JSON.parse(stdout);
      
      if (!result.success) {
        throw new Error(result.error || 'Parsing failed');
      }
      
      console.log(`[UnstructuredLoader] Parsed ${result.element_count} elements, ${result.chunks.length} chunks, ${result.tables.length} tables`);
      
      return result;
    } catch (error: any) {
      console.error(`[UnstructuredLoader] Error:`, error.message);
      throw new Error(`Failed to parse document: ${error.message}`);
    }
  }
  
  /**
   * Convert UnstructuredResult to LoadedDocument
   */
  toLoadedDocument(result: UnstructuredResult, platform: string = 'generic'): LoadedDocument {
    const chunks: DocumentChunk[] = result.chunks.map(chunk => ({
      chunk_id: `chunk_${result.filename}_${chunk.index}`,
      document_id: `doc_${result.filename}`,
      index: chunk.index,
      text: chunk.text,
      start_offset: chunk.metadata.start_offset || 0,
      end_offset: chunk.metadata.end_offset || chunk.text.length,
      metadata: {
        type: chunk.type,
        page_number: chunk.metadata.page_number,
        ...chunk.metadata
      }
    }));
    
    const metadata: DocumentMetadata = {
      filename: result.filename,
      source_path: result.file_path,
      file_size: result.file_size,
      mime_type: this.getMimeType(result.format),
      created_at: new Date(),
      modified_at: new Date(),
      custom_fields: {
        format: result.format,
        element_count: result.element_count,
        total_pages: result.metadata.total_pages,
        statistics: result.statistics
      }
    };
    
    return {
      id: `doc_${result.filename}_${Date.now()}`,
      platform: platform as any,
      content: result.full_text,
      metadata,
      chunks,
      entities: []
    };
  }
  
  /**
   * Get MIME type from file extension
   */
  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.doc': 'application/msword',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.txt': 'text/plain',
      '.md': 'text/markdown'
    };
    
    return mimeTypes[format] || 'application/octet-stream';
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Parse document and return LoadedDocument
 */
export async function parseDocument(
  filePath: string,
  options?: UnstructuredParseOptions
): Promise<LoadedDocument> {
  const loader = new UnstructuredLoader();
  const result = await loader.parseDocument(filePath, options);
  return loader.toLoadedDocument(result);
}

/**
 * Parse document and extract tables
 */
export async function extractTables(filePath: string): Promise<UnstructuredResult['tables']> {
  const loader = new UnstructuredLoader();
  const result = await loader.parseDocument(filePath, { extractTables: true });
  return result.tables;
}

/**
 * Parse large document with optimized settings
 */
export async function parseLargeDocument(
  filePath: string,
  chunkSize: number = 2000
): Promise<LoadedDocument> {
  const loader = new UnstructuredLoader();
  const result = await loader.parseDocument(filePath, {
    strategy: 'fast', // Faster for large documents
    chunkSize,
    chunkOverlap: 400,
    extractTables: true,
    extractImages: false
  });
  return loader.toLoadedDocument(result);
}

// Singleton instance
export const unstructuredLoader = new UnstructuredLoader();
