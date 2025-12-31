/**
 * Streaming File Processor
 * 
 * Handles 5GB+ files by:
 * 1. Streaming reads (never load full file into memory)
 * 2. SAX-style XML parsing for element-aware chunking
 * 3. Progress tracking with resume capability
 * 4. Backpressure handling for slow consumers
 */

import { createReadStream, statSync } from 'fs';
import { createInterface } from 'readline';
import { Transform, Readable } from 'stream';
import { getWorkingMemory, type ChunkingOptions } from './working-memory';

// ============================================================================
// Types
// ============================================================================

export interface ProcessingOptions extends Partial<ChunkingOptions> {
  jobName: string;
  generateEmbeddings?: boolean;
  batchSize?: number;          // Chunks per batch before storing
  onProgress?: (progress: ProcessingProgress) => void;
  onChunk?: (chunk: ChunkData) => void;
  resumeFromOffset?: number;
}

export interface ProcessingProgress {
  jobId: string;
  bytesProcessed: number;
  totalBytes: number;
  percentComplete: number;
  chunksCreated: number;
  currentOffset: number;
  estimatedTimeRemaining?: number;
  processingRate: number;      // bytes per second
}

export interface ChunkData {
  content: string;
  offset: number;
  metadata: {
    xpath?: string;
    elementName?: string;
    lineNumber?: number;
    attributes?: Record<string, string>;
    [key: string]: unknown;
  };
}

export interface ProcessingResult {
  jobId: string;
  success: boolean;
  chunksCreated: number;
  bytesProcessed: number;
  duration: number;
  error?: string;
}

// ============================================================================
// XML Streaming Parser
// ============================================================================

class XMLStreamChunker extends Transform {
  private buffer: string = '';
  private currentPath: string[] = [];
  private currentOffset: number = 0;
  private lineNumber: number = 1;
  private chunkSize: number;
  private overlapSize: number;
  private preserveElements: boolean;
  private pendingChunks: ChunkData[] = [];
  private elementBuffer: string = '';
  private inElement: boolean = false;
  private currentElementName: string = '';
  private currentAttributes: Record<string, string> = {};

  constructor(options: ChunkingOptions) {
    super({ objectMode: true });
    this.chunkSize = options.chunkSize;
    this.overlapSize = options.overlapSize;
    this.preserveElements = options.preserveElements;
  }

  _transform(chunk: Buffer, encoding: string, callback: () => void): void {
    const text = chunk.toString('utf-8');
    this.buffer += text;
    this.processBuffer();
    callback();
  }

  _flush(callback: () => void): void {
    // Process any remaining buffer
    if (this.buffer.length > 0) {
      this.emitChunk(this.buffer, {});
    }
    callback();
  }

  private processBuffer(): void {
    if (this.preserveElements) {
      this.processXMLBuffer();
    } else {
      this.processTextBuffer();
    }
  }

  private processXMLBuffer(): void {
    // Simple XML-aware chunking that tries to keep elements intact
    let i = 0;
    while (i < this.buffer.length) {
      const char = this.buffer[i];

      if (char === '\n') {
        this.lineNumber++;
      }

      if (char === '<') {
        // Check if we have enough content to emit a chunk
        if (this.elementBuffer.length >= this.chunkSize) {
          this.emitChunk(this.elementBuffer, {
            xpath: '/' + this.currentPath.join('/'),
            lineNumber: this.lineNumber,
          });
          // Keep overlap
          this.elementBuffer = this.elementBuffer.slice(-this.overlapSize);
        }

        // Find the end of this tag
        const tagEnd = this.buffer.indexOf('>', i);
        if (tagEnd === -1) {
          // Incomplete tag, wait for more data
          this.buffer = this.buffer.slice(i);
          return;
        }

        const tag = this.buffer.slice(i, tagEnd + 1);
        this.elementBuffer += tag;
        
        // Parse tag
        if (tag.startsWith('</')) {
          // Closing tag
          const tagName = tag.slice(2, -1).trim();
          if (this.currentPath[this.currentPath.length - 1] === tagName) {
            this.currentPath.pop();
          }
        } else if (!tag.startsWith('<?') && !tag.startsWith('<!')) {
          // Opening tag (not processing instruction or comment)
          const match = tag.match(/^<(\w+)/);
          if (match) {
            const tagName = match[1];
            if (!tag.endsWith('/>')) {
              this.currentPath.push(tagName);
            }
            this.currentElementName = tagName;
            
            // Extract attributes
            this.currentAttributes = {};
            const attrRegex = /(\w+)=["']([^"']*)["']/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(tag)) !== null) {
              this.currentAttributes[attrMatch[1]] = attrMatch[2];
            }
          }
        }

        i = tagEnd + 1;
        this.currentOffset = i;
      } else {
        this.elementBuffer += char;
        i++;
      }
    }

    // Keep unprocessed buffer
    this.buffer = '';
  }

  private processTextBuffer(): void {
    // Simple text chunking without XML awareness
    while (this.buffer.length >= this.chunkSize) {
      const chunk = this.buffer.slice(0, this.chunkSize);
      this.emitChunk(chunk, { lineNumber: this.lineNumber });
      
      // Move buffer forward, keeping overlap
      this.buffer = this.buffer.slice(this.chunkSize - this.overlapSize);
      this.currentOffset += this.chunkSize - this.overlapSize;
      
      // Count newlines in the chunk we're removing
      const removed = chunk.slice(0, this.chunkSize - this.overlapSize);
      this.lineNumber += (removed.match(/\n/g) || []).length;
    }
  }

  private emitChunk(content: string, metadata: Record<string, unknown>): void {
    if (content.trim().length === 0) return;
    
    const chunk: ChunkData = {
      content,
      offset: this.currentOffset,
      metadata: {
        ...metadata,
        elementName: this.currentElementName,
        attributes: { ...this.currentAttributes },
      },
    };
    this.push(chunk);
  }
}

// ============================================================================
// JSON Streaming Parser
// ============================================================================

class JSONStreamChunker extends Transform {
  private buffer: string = '';
  private depth: number = 0;
  private currentOffset: number = 0;
  private chunkSize: number;
  private overlapSize: number;
  private objectBuffer: string = '';
  private inString: boolean = false;
  private escapeNext: boolean = false;

  constructor(options: ChunkingOptions) {
    super({ objectMode: true });
    this.chunkSize = options.chunkSize;
    this.overlapSize = options.overlapSize;
  }

  _transform(chunk: Buffer, encoding: string, callback: () => void): void {
    const text = chunk.toString('utf-8');
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      this.objectBuffer += char;

      if (this.escapeNext) {
        this.escapeNext = false;
        continue;
      }

      if (char === '\\') {
        this.escapeNext = true;
        continue;
      }

      if (char === '"') {
        this.inString = !this.inString;
        continue;
      }

      if (this.inString) continue;

      if (char === '{' || char === '[') {
        this.depth++;
      } else if (char === '}' || char === ']') {
        this.depth--;
        
        // If we're back to depth 1 (inside root array) or 0, we have a complete object
        if (this.depth <= 1 && this.objectBuffer.length >= this.chunkSize) {
          this.emitChunk(this.objectBuffer);
          this.objectBuffer = '';
          this.currentOffset += this.objectBuffer.length;
        }
      }
    }

    callback();
  }

  _flush(callback: () => void): void {
    if (this.objectBuffer.trim().length > 0) {
      this.emitChunk(this.objectBuffer);
    }
    callback();
  }

  private emitChunk(content: string): void {
    const chunk: ChunkData = {
      content,
      offset: this.currentOffset,
      metadata: {
        depth: this.depth,
      },
    };
    this.push(chunk);
  }
}

// ============================================================================
// Text Streaming Chunker
// ============================================================================

class TextStreamChunker extends Transform {
  private buffer: string = '';
  private currentOffset: number = 0;
  private lineNumber: number = 1;
  private chunkSize: number;
  private overlapSize: number;

  constructor(options: ChunkingOptions) {
    super({ objectMode: true });
    this.chunkSize = options.chunkSize;
    this.overlapSize = options.overlapSize;
  }

  _transform(chunk: Buffer, encoding: string, callback: () => void): void {
    this.buffer += chunk.toString('utf-8');
    
    while (this.buffer.length >= this.chunkSize) {
      // Try to break at sentence or paragraph boundary
      let breakPoint = this.chunkSize;
      
      // Look for paragraph break
      const paragraphBreak = this.buffer.lastIndexOf('\n\n', this.chunkSize);
      if (paragraphBreak > this.chunkSize * 0.5) {
        breakPoint = paragraphBreak + 2;
      } else {
        // Look for sentence break
        const sentenceBreak = this.buffer.lastIndexOf('. ', this.chunkSize);
        if (sentenceBreak > this.chunkSize * 0.5) {
          breakPoint = sentenceBreak + 2;
        }
      }

      const content = this.buffer.slice(0, breakPoint);
      this.emitChunk(content);
      
      // Count newlines
      this.lineNumber += (content.match(/\n/g) || []).length;
      
      // Keep overlap
      const overlapStart = Math.max(0, breakPoint - this.overlapSize);
      this.buffer = this.buffer.slice(overlapStart);
      this.currentOffset += overlapStart;
    }

    callback();
  }

  _flush(callback: () => void): void {
    if (this.buffer.length > 0) {
      this.emitChunk(this.buffer);
    }
    callback();
  }

  private emitChunk(content: string): void {
    const chunk: ChunkData = {
      content,
      offset: this.currentOffset,
      metadata: {
        lineNumber: this.lineNumber,
      },
    };
    this.push(chunk);
  }
}

// ============================================================================
// Main Stream Processor
// ============================================================================

export class StreamProcessor {
  private workingMemory = getWorkingMemory();

  async processFile(
    filePath: string,
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    let chunksCreated = 0;
    let bytesProcessed = 0;

    try {
      // Get file size
      const stats = statSync(filePath);
      const totalBytes = stats.size;

      // Create processing job
      const job = await this.workingMemory.createJob(
        options.jobName,
        filePath,
        totalBytes,
        {
          chunkSize: options.chunkSize || 4000,
          overlapSize: options.overlapSize || 200,
          preserveElements: options.preserveElements ?? true,
          maxChunkSize: options.maxChunkSize || 10000,
        }
      );

      await this.workingMemory.setJobStatus(job.id, 'processing');

      // Determine file type and create appropriate chunker
      const fileType = this.detectFileType(filePath);
      const chunker = this.createChunker(fileType, {
        chunkSize: options.chunkSize || 4000,
        overlapSize: options.overlapSize || 200,
        preserveElements: options.preserveElements ?? true,
        maxChunkSize: options.maxChunkSize || 10000,
      });

      // Create read stream
      const readStream = createReadStream(filePath, {
        highWaterMark: 64 * 1024, // 64KB chunks
        start: options.resumeFromOffset || 0,
      });

      // Batch chunks for storage
      const batchSize = options.batchSize || 100;
      let batch: ChunkData[] = [];
      let lastProgressUpdate = Date.now();

      // Process stream
      await new Promise<void>((resolve, reject) => {
        readStream
          .pipe(chunker)
          .on('data', async (chunk: ChunkData) => {
            batch.push(chunk);
            chunksCreated++;
            bytesProcessed += chunk.content.length;

            if (options.onChunk) {
              options.onChunk(chunk);
            }

            // Store batch when full
            if (batch.length >= batchSize) {
              chunker.pause();
              
              await this.workingMemory.storeChunks(
                job.id,
                batch.map(c => ({
                  content: c.content,
                  offset: c.offset,
                  metadata: c.metadata,
                })),
                options.generateEmbeddings ?? true
              );
              
              batch = [];
              chunker.resume();
            }

            // Progress callback (throttled to every 500ms)
            if (options.onProgress && Date.now() - lastProgressUpdate > 500) {
              const elapsed = (Date.now() - startTime) / 1000;
              const rate = bytesProcessed / elapsed;
              const remaining = (totalBytes - bytesProcessed) / rate;

              options.onProgress({
                jobId: job.id,
                bytesProcessed,
                totalBytes,
                percentComplete: (bytesProcessed / totalBytes) * 100,
                chunksCreated,
                currentOffset: chunk.offset,
                estimatedTimeRemaining: remaining,
                processingRate: rate,
              });

              lastProgressUpdate = Date.now();
            }
          })
          .on('end', async () => {
            // Store remaining batch
            if (batch.length > 0) {
              await this.workingMemory.storeChunks(
                job.id,
                batch.map(c => ({
                  content: c.content,
                  offset: c.offset,
                  metadata: c.metadata,
                })),
                options.generateEmbeddings ?? true
              );
            }
            resolve();
          })
          .on('error', reject);
      });

      await this.workingMemory.setJobStatus(job.id, 'completed');

      return {
        jobId: job.id,
        success: true,
        chunksCreated,
        bytesProcessed,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        jobId: '',
        success: false,
        chunksCreated,
        bytesProcessed,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private detectFileType(filePath: string): 'xml' | 'json' | 'text' {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    if (ext === 'xml') return 'xml';
    if (ext === 'json' || ext === 'jsonl') return 'json';
    return 'text';
  }

  private createChunker(
    fileType: 'xml' | 'json' | 'text',
    options: ChunkingOptions
  ): Transform {
    switch (fileType) {
      case 'xml':
        return new XMLStreamChunker(options);
      case 'json':
        return new JSONStreamChunker(options);
      default:
        return new TextStreamChunker(options);
    }
  }

  async resumeJob(jobId: string, options: Omit<ProcessingOptions, 'jobName'>): Promise<ProcessingResult> {
    const job = this.workingMemory.getJob(jobId);
    if (!job) {
      return {
        jobId,
        success: false,
        chunksCreated: 0,
        bytesProcessed: 0,
        duration: 0,
        error: 'Job not found',
      };
    }

    return this.processFile(job.sourceFile, {
      ...options,
      jobName: job.name,
      resumeFromOffset: job.progress.lastOffset,
    });
  }
}

// ============================================================================
// Singleton
// ============================================================================

let processorInstance: StreamProcessor | null = null;

export function getStreamProcessor(): StreamProcessor {
  if (!processorInstance) {
    processorInstance = new StreamProcessor();
  }
  return processorInstance;
}
