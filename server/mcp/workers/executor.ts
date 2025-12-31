/**
 * Task Executor
 * 
 * Manages task execution with:
 * - Task graph with checkpoint/resume
 * - Content-addressed deduplication
 * - Backpressure handling
 * - Local and remote worker support
 */

import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import type {
  Task,
  TaskStatus,
  InvokeResult,
  InvokeMeta,
  ContentRef,
  StoredRef,
} from '../../../shared/mcp-types';
import { getContentStore } from '../store/content-store';

const MAX_INLINE_SIZE = 4096; // 4KB threshold for inline vs reference

export interface ExecuteRequest {
  toolName: string;
  args: Record<string, unknown>;
  options: {
    timeout?: number;
    maxOutputSize?: number;
    returnRef?: boolean;
    priority?: 'low' | 'normal' | 'high';
  };
  traceId: string;
  userId?: number;
}

export interface TaskCheckpoint {
  taskId: string;
  status: TaskStatus;
  progress: number;
  intermediateRef?: ContentRef;
  timestamp: number;
}

type ToolHandler = (args: Record<string, unknown>, traceId: string) => Promise<unknown>;

export class TaskExecutor {
  private tasks: Map<string, Task> = new Map();
  private checkpoints: Map<string, TaskCheckpoint> = new Map();
  private contentHashes: Map<string, string> = new Map(); // hash -> taskId for dedup
  private handlers: Map<string, ToolHandler> = new Map();
  private concurrencyLimit: number;
  private activeCount: number = 0;
  private queue: Array<{ request: ExecuteRequest; resolve: (result: InvokeResult) => void; reject: (error: Error) => void }> = [];

  constructor(concurrencyLimit: number = 10) {
    this.concurrencyLimit = concurrencyLimit;
    this.registerBuiltinHandlers();
  }

  /**
   * Execute a tool invocation
   */
  async execute(request: ExecuteRequest): Promise<InvokeResult> {
    const startTime = Date.now();
    const taskId = nanoid();

    // Check for duplicate work via content hash
    const inputHash = this.computeInputHash(request.toolName, request.args);
    const existingTaskId = this.contentHashes.get(inputHash);
    if (existingTaskId) {
      const existingTask = this.tasks.get(existingTaskId);
      if (existingTask && existingTask.status === 'completed' && existingTask.outputRef) {
        // Return cached result
        const store = await getContentStore();
        const meta = store.getMeta(existingTask.outputRef);
        return {
          success: true,
          ref: meta ?? undefined,
          meta: {
            toolName: request.toolName,
            executionTimeMs: 0,
            cacheHit: true,
            traceId: request.traceId,
          },
        };
      }
    }

    // Create task
    const task: Task = {
      id: taskId,
      type: request.toolName,
      status: 'pending',
      input: request.args,
      priority: request.options.priority === 'high' ? 2 : request.options.priority === 'low' ? 0 : 1,
      retries: 0,
      maxRetries: 3,
      createdAt: Date.now(),
      traceId: request.traceId,
      contentHash: inputHash,
    };

    this.tasks.set(taskId, task);
    this.contentHashes.set(inputHash, taskId);

    // Check backpressure
    if (this.activeCount >= this.concurrencyLimit) {
      // Queue the request
      return new Promise((resolve, reject) => {
        this.queue.push({ request, resolve, reject });
        task.status = 'queued';
      });
    }

    return this.executeTask(task, request, startTime);
  }

  /**
   * Execute a task
   */
  private async executeTask(task: Task, request: ExecuteRequest, startTime: number): Promise<InvokeResult> {
    this.activeCount++;
    task.status = 'running';
    task.startedAt = Date.now();

    try {
      const handler = this.handlers.get(request.toolName);
      if (!handler) {
        throw new Error(`No handler registered for tool: ${request.toolName}`);
      }

      // Execute with timeout
      const timeout = request.options.timeout ?? 30000;
      const result = await Promise.race([
        handler(request.args, request.traceId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timeout')), timeout)
        ),
      ]);

      // Store result
      const store = await getContentStore();
      const resultStr = JSON.stringify(result);
      const resultSize = Buffer.byteLength(resultStr, 'utf-8');

      let storedRef: StoredRef | undefined;
      let inlineData: unknown = undefined;

      if (resultSize > MAX_INLINE_SIZE || request.options.returnRef) {
        // Store as reference
        storedRef = await store.put(resultStr, 'application/json');
        task.outputRef = storedRef.ref;
      } else {
        // Return inline
        inlineData = result;
      }

      task.status = 'completed';
      task.completedAt = Date.now();
      task.output = typeof result === 'object' ? result as Record<string, unknown> : { value: result };

      const meta: InvokeMeta = {
        toolName: request.toolName,
        executionTimeMs: Date.now() - startTime,
        cacheHit: false,
        traceId: request.traceId,
      };

      return {
        success: true,
        data: inlineData,
        ref: storedRef,
        meta,
      };
    } catch (error) {
      task.status = 'failed';
      task.completedAt = Date.now();
      task.error = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      };

      return {
        success: false,
        error: task.error,
        meta: {
          toolName: request.toolName,
          executionTimeMs: Date.now() - startTime,
          traceId: request.traceId,
        },
      };
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.activeCount < this.concurrencyLimit) {
      const item = this.queue.shift();
      if (item) {
        const task = Array.from(this.tasks.values()).find(
          (t) => t.contentHash === this.computeInputHash(item.request.toolName, item.request.args)
        );
        if (task) {
          this.executeTask(task, item.request, Date.now())
            .then(item.resolve)
            .catch(item.reject);
        }
      }
    }
  }

  /**
   * Save checkpoint for a task
   */
  async saveCheckpoint(taskId: string, progress: number, intermediateData?: unknown): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    let intermediateRef: ContentRef | undefined;
    if (intermediateData) {
      const store = await getContentStore();
      const stored = await store.put(JSON.stringify(intermediateData), 'application/json');
      intermediateRef = stored.ref;
    }

    const checkpoint: TaskCheckpoint = {
      taskId,
      status: task.status,
      progress,
      intermediateRef,
      timestamp: Date.now(),
    };

    this.checkpoints.set(taskId, checkpoint);
    task.checkpointRef = intermediateRef;
  }

  /**
   * Resume a task from checkpoint
   */
  async resumeFromCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
    return this.checkpoints.get(taskId) ?? null;
  }

  /**
   * Get task status
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  listTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get executor stats
   */
  getStats(): {
    activeCount: number;
    queuedCount: number;
    completedCount: number;
    failedCount: number;
  } {
    let completed = 0;
    let failed = 0;
    this.tasks.forEach((task) => {
      if (task.status === 'completed') completed++;
      if (task.status === 'failed') failed++;
    });

    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      completedCount: completed,
      failedCount: failed,
    };
  }

  /**
   * Register a tool handler
   */
  registerHandler(toolName: string, handler: ToolHandler): void {
    this.handlers.set(toolName, handler);
  }

  /**
   * Compute content hash for deduplication
   */
  private computeInputHash(toolName: string, args: Record<string, unknown>): string {
    const content = JSON.stringify({ toolName, args });
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Register built-in handlers
   */
  private registerBuiltinHandlers(): void {
    // Placeholder handlers - will be implemented in plugin files
    this.registerHandler('search.ripgrep', async (args) => {
      // Delegate to search plugin
      const { searchRipgrep } = await import('../plugins/search');
      return searchRipgrep(args as unknown as { root: string; query: string; glob?: string; maxResults?: number });
    });

    this.registerHandler('search.ugrep', async (args) => {
      const { searchUgrep } = await import('../plugins/search');
      return searchUgrep(args as unknown as { root: string; query: string; include?: string; exclude?: string; maxResults?: number });
    });

    this.registerHandler('doc.convert_to_markdown', async (args) => {
      const { convertToMarkdown } = await import('../plugins/document');
      return convertToMarkdown(args as { path: string; format?: string; extractMetadata?: boolean });
    });

    this.registerHandler('doc.ocr_image_or_pdf', async (args) => {
      const { ocrImageOrPdf } = await import('../plugins/document');
      return ocrImageOrPdf(args as { path: string; language?: string; psm?: number; dpi?: number });
    });

    this.registerHandler('doc.segment', async (args) => {
      const { segmentText } = await import('../plugins/document');
      return segmentText(args as { textRef: string; strategy?: 'heading' | 'paragraph' | 'sentence' | 'fixed'; chunkSize?: number; overlap?: number });
    });

    this.registerHandler('nlp.detect_language', async (args) => {
      const { detectLanguage } = await import('../plugins/nlp');
      return detectLanguage(args as { textRef: string });
    });

    this.registerHandler('nlp.extract_entities', async (args) => {
      const { extractEntities } = await import('../plugins/nlp');
      return extractEntities(args as unknown as { textRef: string; provider?: string; types?: Array<'PERSON' | 'ORG' | 'GPE' | 'LOC' | 'DATE' | 'TIME' | 'MONEY' | 'PERCENT' | 'PRODUCT' | 'EVENT' | 'WORK_OF_ART' | 'LAW' | 'LANGUAGE' | 'CUSTOM'> });
    });

    this.registerHandler('nlp.extract_keywords', async (args) => {
      const { extractKeywords } = await import('../plugins/nlp');
      return extractKeywords(args as { textRef: string; method?: string; topK?: number });
    });

    this.registerHandler('nlp.analyze_sentiment', async (args) => {
      const { analyzeSentiment } = await import('../plugins/nlp');
      return analyzeSentiment(args as { textRef: string; provider?: string });
    });

    this.registerHandler('nlp.split_sentences', async (args) => {
      const { splitSentences } = await import('../plugins/nlp');
      return splitSentences(args as { textRef: string; provider?: string });
    });

    this.registerHandler('fs.list_dir', async (args) => {
      const { listDir } = await import('../plugins/filesystem');
      return listDir(args as { path: string; recursive?: boolean; glob?: string; maxDepth?: number });
    });

    this.registerHandler('fs.read_file', async (args) => {
      const { readFile } = await import('../plugins/filesystem');
      return readFile(args as { path: string; encoding?: BufferEncoding });
    });

    this.registerHandler('rules.evaluate', async (args) => {
      const { evaluateRules } = await import('../plugins/rules');
      return evaluateRules(args as { textRef: string; ruleSetId: string });
    });

    this.registerHandler('diff.text', async (args) => {
      const { diffText } = await import('../plugins/diff');
      return diffText(args as { refA: string; refB: string; format?: 'unified' | 'json' | 'inline'; contextLines?: number });
    });

    this.registerHandler('ml.embed', async (args) => {
      const { generateEmbeddings } = await import('../plugins/ml');
      return generateEmbeddings(args as { textRef: string; model?: string; chunkSize?: number });
    });

    this.registerHandler('ml.semantic_search', async (args) => {
      const { semanticSearch } = await import('../plugins/ml');
      return semanticSearch(args as { query: string; scopeRefs?: string[]; topK?: number; threshold?: number });
    });

    this.registerHandler('summarize.hierarchical', async (args) => {
      const { hierarchicalSummarize } = await import('../plugins/summarization');
      return hierarchicalSummarize(args as { textRef: string; maxLength?: number; style?: 'concise' | 'detailed' | 'bullet'; preserveCitations?: boolean });
    });

    this.registerHandler('retrieve.supporting_spans', async (args) => {
      const { retrieveSupportingSpans } = await import('../plugins/retrieval');
      return retrieveSupportingSpans(args as { question: string; docRef: string; topK?: number; useEmbeddings?: boolean });
    });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let executorInstance: TaskExecutor | null = null;

export async function getTaskExecutor(): Promise<TaskExecutor> {
  if (!executorInstance) {
    executorInstance = new TaskExecutor();
  }
  return executorInstance;
}
