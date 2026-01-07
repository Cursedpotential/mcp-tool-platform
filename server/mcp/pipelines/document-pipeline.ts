/**
 * End-to-End Document Processing Pipeline
 * A → B: Document Ingestion → Classification → Embedding → Database Storage
 */

import { unstructuredLoader } from '../loaders/unstructured-loader';
import { cachedEmbeddingService } from '../loaders/real-embedding-service';
import { chromaManager } from '../storage/chroma-client';
import { supabaseManager } from '../storage/supabase-client';
import { classifier, aggregateClassifications } from '../analysis/classifier';
import type { Classification } from '../analysis/classifier';
import type { UnstructuredResult } from '../loaders/unstructured-loader';

// ============================================================================
// TYPES
// ============================================================================

export interface PipelineOptions {
  caseId: string;
  platform: string;
  chunkSize?: number;
  chunkOverlap?: number;
  extractTables?: boolean;
  skipClassification?: boolean;
  skipEmbedding?: boolean;
  skipChroma?: boolean;
  skipSupabase?: boolean;
}

export interface PipelineResult {
  success: boolean;
  document_id: string;
  filename: string;
  statistics: {
    total_chunks: number;
    total_characters: number;
    processing_time_ms: number;
    classifications?: {
      overall_sentiment: string;
      avg_severity: number;
      pattern_frequency: Record<string, number>;
      high_severity_count: number;
    };
  };
  errors?: string[];
}

export interface PipelineProgress {
  stage: 'parsing' | 'classifying' | 'embedding' | 'storing_chroma' | 'storing_supabase' | 'complete';
  progress: number; // 0-100
  message: string;
}

// ============================================================================
// DOCUMENT PIPELINE
// ============================================================================

export class DocumentPipeline {
  private progressCallback?: (progress: PipelineProgress) => void;
  
  /**
   * Set progress callback
   */
  onProgress(callback: (progress: PipelineProgress) => void): void {
    this.progressCallback = callback;
  }
  
  /**
   * Report progress
   */
  private reportProgress(stage: PipelineProgress['stage'], progress: number, message: string): void {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
    console.log(`[Pipeline] [${stage}] ${progress}% - ${message}`);
  }
  
  /**
   * Process document end-to-end
   */
  async processDocument(
    filePath: string,
    options: PipelineOptions
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    console.log(`[Pipeline] Starting processing: ${filePath}`);
    console.log(`[Pipeline] Case: ${options.caseId}, Platform: ${options.platform}`);
    
    try {
      // ========================================================================
      // STAGE 1: Parse Document
      // ========================================================================
      this.reportProgress('parsing', 0, 'Parsing document...');
      
      const parseResult = await unstructuredLoader.parseDocument(filePath, {
        strategy: 'auto',
        extractTables: options.extractTables ?? true,
        chunkSize: options.chunkSize ?? 1000,
        chunkOverlap: options.chunkOverlap ?? 200
      });
      
      if (!parseResult.success) {
        throw new Error(`Parsing failed: ${parseResult.error}`);
      }
      
      const documentId = `doc_${options.caseId}_${Date.now()}`;
      const chunks = parseResult.chunks;
      
      this.reportProgress('parsing', 20, `Parsed ${chunks.length} chunks`);
      
      // ========================================================================
      // STAGE 2: Classify Chunks
      // ========================================================================
      let classifications: Classification[] = [];
      
      if (!options.skipClassification) {
        this.reportProgress('classifying', 20, 'Classifying chunks...');
        
        const classificationResults = await classifier.classifyBatch(
          chunks.map(c => ({
            chunk_id: `${documentId}_chunk_${c.index}`,
            text: c.text
          })),
          `Case: ${options.caseId}, Platform: ${options.platform}`
        );
        
        classifications = classificationResults.map(r => r.classification);
        
        this.reportProgress('classifying', 40, `Classified ${classifications.length} chunks`);
      } else {
        this.reportProgress('classifying', 40, 'Skipped classification');
      }
      
      // ========================================================================
      // STAGE 3: Generate Embeddings
      // ========================================================================
      let embeddings: number[][] = [];
      
      if (!options.skipEmbedding) {
        this.reportProgress('embedding', 40, 'Generating embeddings...');
        
        embeddings = await cachedEmbeddingService.generateEmbeddings(
          chunks.map(c => c.text),
          100 // batch size
        );
        
        this.reportProgress('embedding', 60, `Generated ${embeddings.length} embeddings`);
      } else {
        this.reportProgress('embedding', 60, 'Skipped embeddings');
      }
      
      // ========================================================================
      // STAGE 4: Store in Chroma (72hr TTL)
      // ========================================================================
      if (!options.skipChroma && embeddings.length > 0) {
        this.reportProgress('storing_chroma', 60, 'Storing in Chroma...');
        
        try {
          await chromaManager.initialize();
          
          await chromaManager.addEvidence(
            documentId,
            chunks.map((c, i) => ({
              id: `${documentId}_chunk_${c.index}`,
              text: c.text,
              metadata: {
                ...c.metadata,
                case_id: options.caseId,
                platform: options.platform,
                chunk_index: c.index,
                preliminary_classification: classifications[i] ? JSON.stringify(classifications[i]) : undefined
              }
            })),
            embeddings
          );
          
          this.reportProgress('storing_chroma', 75, 'Stored in Chroma');
        } catch (error: any) {
          console.error('[Pipeline] Chroma storage failed:', error.message);
          errors.push(`Chroma: ${error.message}`);
        }
      } else {
        this.reportProgress('storing_chroma', 75, 'Skipped Chroma');
      }
      
      // ========================================================================
      // STAGE 5: Store in Supabase (Permanent)
      // ========================================================================
      if (!options.skipSupabase) {
        this.reportProgress('storing_supabase', 75, 'Storing in Supabase...');
        
        try {
          // Aggregate classifications
          const aggregated = aggregateClassifications(classifications);
          
          // Prepare document metadata
          const documentRow = {
            id: documentId,
            case_id: options.caseId,
            platform: options.platform,
            source_path: filePath,
            filename: parseResult.filename,
            chunk_count: chunks.length,
            metadata: {
              file_size: parseResult.file_size,
              format: parseResult.format,
              element_count: parseResult.element_count,
              statistics: parseResult.statistics,
              preliminary_analysis: {
                overall_sentiment: aggregated.overall_sentiment,
                avg_severity: aggregated.avg_severity,
                pattern_frequency: aggregated.pattern_frequency,
                high_severity_count: aggregated.high_severity_count
              }
            }
          };
          
          // Prepare chunks
          const chunkRows = chunks.map((c, i) => ({
            chunk_id: `${documentId}_chunk_${c.index}`,
            document_id: documentId,
            case_id: options.caseId,
            index: c.index,
            text: c.text,
            metadata: {
              ...c.metadata,
              preliminary_classification: classifications[i] || null
            }
          }));
          
          // Prepare embeddings
          const embeddingRows = embeddings.length > 0 ? chunks.map((c, i) => ({
            id: `${documentId}_emb_${c.index}`,
            document_id: documentId,
            chunk_id: `${documentId}_chunk_${c.index}`,
            embedding: embeddings[i],
            text: c.text,
            metadata: {
              case_id: options.caseId,
              platform: options.platform,
              chunk_index: c.index
            }
          })) : [];
          
          // Insert all data
          await supabaseManager.insertDocumentComplete(
            documentRow,
            chunkRows,
            embeddingRows
          );
          
          this.reportProgress('storing_supabase', 95, 'Stored in Supabase');
        } catch (error: any) {
          console.error('[Pipeline] Supabase storage failed:', error.message);
          errors.push(`Supabase: ${error.message}`);
        }
      } else {
        this.reportProgress('storing_supabase', 95, 'Skipped Supabase');
      }
      
      // ========================================================================
      // COMPLETE
      // ========================================================================
      const processingTime = Date.now() - startTime;
      const aggregated = aggregateClassifications(classifications);
      
      this.reportProgress('complete', 100, 'Processing complete');
      
      return {
        success: errors.length === 0,
        document_id: documentId,
        filename: parseResult.filename,
        statistics: {
          total_chunks: chunks.length,
          total_characters: parseResult.statistics.total_characters,
          processing_time_ms: processingTime,
          classifications: {
            overall_sentiment: aggregated.overall_sentiment,
            avg_severity: aggregated.avg_severity,
            pattern_frequency: aggregated.pattern_frequency,
            high_severity_count: aggregated.high_severity_count
          }
        },
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error: any) {
      console.error('[Pipeline] Fatal error:', error.message);
      
      return {
        success: false,
        document_id: '',
        filename: filePath,
        statistics: {
          total_chunks: 0,
          total_characters: 0,
          processing_time_ms: Date.now() - startTime
        },
        errors: [error.message]
      };
    }
  }
  
  /**
   * Process multiple documents
   */
  async processDocuments(
    filePaths: string[],
    options: PipelineOptions
  ): Promise<PipelineResult[]> {
    console.log(`[Pipeline] Processing ${filePaths.length} documents`);
    
    const results: PipelineResult[] = [];
    
    for (let i = 0; i < filePaths.length; i++) {
      console.log(`[Pipeline] Document ${i + 1}/${filePaths.length}`);
      
      const result = await this.processDocument(filePaths[i], options);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`[Pipeline] Batch complete: ${successCount}/${filePaths.length} successful`);
    
    return results;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Process single document with default options
 */
export async function processDocument(
  filePath: string,
  caseId: string,
  platform: string
): Promise<PipelineResult> {
  const pipeline = new DocumentPipeline();
  return pipeline.processDocument(filePath, { caseId, platform });
}

/**
 * Process document with progress tracking
 */
export async function processDocumentWithProgress(
  filePath: string,
  caseId: string,
  platform: string,
  onProgress: (progress: PipelineProgress) => void
): Promise<PipelineResult> {
  const pipeline = new DocumentPipeline();
  pipeline.onProgress(onProgress);
  return pipeline.processDocument(filePath, { caseId, platform });
}

// ============================================================================
// SINGLETON
// ============================================================================

export const documentPipeline = new DocumentPipeline();
