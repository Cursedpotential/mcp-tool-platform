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

    this.registerHandler('search.web', async (args) => {
      const { search } = await import('../plugins/browser-search');
      const { query, type, maxResults, provider } = args as {
        query: string;
        type?: 'web' | 'news' | 'research';
        maxResults?: number;
        provider?: 'tavily' | 'perplexity' | 'serpapi';
      };
      return search({ query, type, maxResults, preferredProvider: provider });
    });

    this.registerHandler('search.news', async (args) => {
      const { searchNews } = await import('../plugins/browser-search');
      return searchNews(args as { query: string; maxResults?: number });
    });

    this.registerHandler('search.research', async (args) => {
      const { searchResearch } = await import('../plugins/browser-search');
      return searchResearch(args as { query: string; maxResults?: number });
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

    // ========================================================================
    // BROWSER/NOTEBOOKLM/N8N/MEM0 HANDLERS
    // ========================================================================

    this.registerHandler('browser.navigate', async (args) => {
      const { navigate } = await import('../plugins/browser-search');
      return navigate(args as { url: string; waitFor?: string; timeout?: number; javascript?: boolean });
    });

    this.registerHandler('browser.screenshot', async (args) => {
      const { screenshot } = await import('../plugins/browser-search');
      return screenshot(args as { url: string; fullPage?: boolean; selector?: string; format?: 'png' | 'jpeg'; quality?: number });
    });

    this.registerHandler('browser.extract', async (args) => {
      const { extractContent } = await import('../plugins/browser-search');
      return extractContent(args as { url: string; selectors?: Record<string, string>; format?: 'text' | 'html' | 'markdown' });
    });

    this.registerHandler('browser.fill', async (args) => {
      const { fillForm } = await import('../plugins/browser-search');
      return fillForm(args as { url: string; fields: Record<string, string>; submitSelector?: string });
    });

    this.registerHandler('browser.click', async (args) => {
      const { click } = await import('../plugins/browser-search');
      return click(args as { url: string; selector: string; waitForNavigation?: boolean });
    });

    this.registerHandler('notebooklm.ask', async (args) => {
      const { executeNotebookLMTool } = await import('../plugins/notebooklm');
      return executeNotebookLMTool('notebooklm.ask', args);
    });

    this.registerHandler('notebooklm.list', async () => {
      const { executeNotebookLMTool } = await import('../plugins/notebooklm');
      return executeNotebookLMTool('notebooklm.list', {});
    });

    this.registerHandler('notebooklm.select', async (args) => {
      const { executeNotebookLMTool } = await import('../plugins/notebooklm');
      return executeNotebookLMTool('notebooklm.select', args);
    });

    this.registerHandler('notebooklm.add', async (args) => {
      const { executeNotebookLMTool } = await import('../plugins/notebooklm');
      return executeNotebookLMTool('notebooklm.add', args);
    });

    this.registerHandler('notebooklm.search', async (args) => {
      const { executeNotebookLMTool } = await import('../plugins/notebooklm');
      return executeNotebookLMTool('notebooklm.search', args);
    });

    this.registerHandler('notebooklm.remove', async (args) => {
      const { executeNotebookLMTool } = await import('../plugins/notebooklm');
      return executeNotebookLMTool('notebooklm.remove', args);
    });

    this.registerHandler('notebooklm.stats', async () => {
      const { executeNotebookLMTool } = await import('../plugins/notebooklm');
      return executeNotebookLMTool('notebooklm.stats', {});
    });

    this.registerHandler('mem0.add', async (args) => {
      const { addMemory } = await import('../plugins/mem0');
      return addMemory(args as {
        content: string;
        metadata?: Record<string, unknown>;
        userId?: string;
        agentId?: string;
        projectId?: string;
        scope?: 'agent' | 'project' | 'user' | 'global';
      });
    });

    this.registerHandler('mem0.search', async (args) => {
      const { searchMemories } = await import('../plugins/mem0');
      return searchMemories(args as {
        query: string;
        userId?: string;
        agentId?: string;
        projectId?: string;
        scope?: 'agent' | 'project' | 'user' | 'global';
        limit?: number;
      });
    });

    this.registerHandler('mem0.share_context', async (args) => {
      const { shareContext } = await import('../plugins/mem0');
      return shareContext(args as {
        fromAgentId: string;
        toAgentId: string;
        query: string;
        limit?: number;
      });
    });

    this.registerHandler('n8n.trigger', async (args) => {
      const { triggerWorkflow } = await import('../plugins/n8n');
      const { workflowId, data } = args as { workflowId: string; data?: Record<string, unknown> };
      const { execution } = await triggerWorkflow({ id: workflowId, data });
      return { executionId: execution.id, execution };
    });

    this.registerHandler('n8n.status', async (args) => {
      const { getExecution } = await import('../plugins/n8n');
      const { executionId } = args as { executionId: string };
      return getExecution({ id: executionId });
    });

    // ============================================================================
    // FORENSICS PLUGIN HANDLERS
    // ============================================================================

    this.registerHandler('forensics.analyze_patterns', async (args) => {
      const { patternAnalyzer } = await import('../forensics/pattern-analyzer');
      const { text, moduleIds, includeContext, contextChars } = args as {
        text: string;
        moduleIds?: string[];
        includeContext?: boolean;
        contextChars?: number;
      };
      return patternAnalyzer.analyze(text, { moduleIds, includeContext, contextChars });
    });

    this.registerHandler('forensics.detect_hurtlex', async (args) => {
      const { HurtLexFetcher } = await import('../forensics/hurtlex-fetcher');
      const { text, language, categories } = args as { text: string; language?: string; categories?: string[] };
      const fetcher = new HurtLexFetcher();
      const terms = await fetcher.getTerms(language || 'EN', categories);
      
      // Detect terms in text
      const textLower = text.toLowerCase();
      const matches: Array<{ term: string; category: string; position: number; context: string }> = [];
      
      for (const term of terms) {
        const termLower = term.term.toLowerCase();
        let idx = textLower.indexOf(termLower);
        while (idx !== -1) {
          const start = Math.max(0, idx - 50);
          const end = Math.min(text.length, idx + termLower.length + 50);
          matches.push({
            term: term.term,
            category: term.category,
            position: idx,
            context: text.slice(start, end)
          });
          idx = textLower.indexOf(termLower, idx + 1);
        }
      }
      
      return {
        totalTermsChecked: terms.length,
        matchCount: matches.length,
        matches,
        categoryCounts: matches.reduce((acc, m) => {
          acc[m.category] = (acc[m.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
    });

    this.registerHandler('forensics.score_severity', async (args) => {
      const { patternAnalyzer } = await import('../forensics/pattern-analyzer');
      const { text, moduleIds } = args as { text: string; moduleIds?: string[] };
      const result = await patternAnalyzer.analyze(text, { moduleIds });
      return {
        severityScore: result.severityScore,
        mclFactorScores: result.mclFactorScores,
        totalMatches: result.totalMatches,
        summary: result.summary
      };
    });

    this.registerHandler('forensics.get_modules', async () => {
      const { patternAnalyzer, BUILT_IN_MODULES } = await import('../forensics/pattern-analyzer');
      return {
        modules: BUILT_IN_MODULES,
        activeModules: patternAnalyzer.getModules().filter(m => m.enabled).map(m => m.id)
      };
    });

    // ============================================================================
    // TEXT MINER PLUGIN HANDLERS
    // ============================================================================

    this.registerHandler('text.mine', async (args) => {
      const { mineFiles, generateMarkdownReport } = await import('../plugins/text-miner');
      const { searchTerm, paths, options, generateReport } = args as {
        searchTerm: string;
        paths: string[];
        options?: {
          recursive?: boolean;
          contextLines?: number;
          caseInsensitive?: boolean;
          wholeWord?: boolean;
          regexMode?: boolean;
          fileTypes?: string[];
          engine?: 'ugrep' | 'ripgrep' | 'auto';
          maxResults?: number;
        };
        generateReport?: boolean;
      };
      const result = await mineFiles(searchTerm, paths, options);
      if (generateReport) {
        return {
          ...result,
          report: generateMarkdownReport(result)
        };
      }
      return result;
    });

    // ============================================================================
    // FORMAT CONVERTER PLUGIN HANDLERS
    // ============================================================================

    this.registerHandler('format.convert', async (args) => {
      const { parseFile, toJson, toCsv, toMarkdown } = await import('../plugins/format-converter');
      const { inputPath, outputFormat } = args as {
        inputPath: string;
        outputFormat?: 'json' | 'csv' | 'md';
      };
      const { messages, format } = await parseFile(inputPath);
      let output: string;
      switch (outputFormat) {
        case 'csv':
          output = toCsv(messages);
          break;
        case 'md':
          output = toMarkdown(messages);
          break;
        case 'json':
        default:
          output = toJson(messages);
          break;
      }
      return { messages, sourceFormat: format, outputFormat: outputFormat || 'json', output };
    });

    this.registerHandler('format.parse', async (args) => {
      const { parseFile } = await import('../plugins/format-converter');
      const { inputPath } = args as { inputPath: string };
      return parseFile(inputPath);
    });

    this.registerHandler('format.check_schema', async (args) => {
      const { checkSchema } = await import('../plugins/format-converter');
      const { inputPath, previewCount } = args as { inputPath: string; previewCount?: number };
      return checkSchema(inputPath, previewCount);
    });

    this.registerHandler('format.ocr', async (args) => {
      const { ocrImage, ocrPdf } = await import('../plugins/format-converter');
      const { inputPath, language } = args as { inputPath: string; language?: string };
      const ext = inputPath.toLowerCase();
      if (ext.endsWith('.pdf')) {
        return { text: await ocrPdf(inputPath, language), format: 'pdf-ocr' };
      }
      return { text: await ocrImage(inputPath, language), format: 'image-ocr' };
    });

    // ============================================================================
    // SCHEMA RESOLVER PLUGIN HANDLERS
    // ============================================================================

    this.registerHandler('schema.resolve', async (args) => {
      const { resolve } = await import('../plugins/schema-resolver');
      const { sourceFields, sample, useCache, useAi } = args as {
        sourceFields: string[];
        sample?: Record<string, any>[];
        useCache?: boolean;
        useAi?: boolean;
      };
      return resolve(sourceFields, sample, useCache, useAi);
    });

    this.registerHandler('schema.apply', async (args) => {
      const { resolve, applyMapping } = await import('../plugins/schema-resolver');
      const { data, sourceFields, useCache } = args as {
        data: Record<string, any>[];
        sourceFields?: string[];
        useCache?: boolean;
      };
      const fields = sourceFields || (data.length > 0 ? Object.keys(data[0]) : []);
      const { mappings } = await resolve(fields, data.slice(0, 5), useCache);
      return {
        transformedData: applyMapping(data, mappings),
        mappings
      };
    });

    this.registerHandler('schema.cache_stats', async () => {
      const { getCacheStats } = await import('../plugins/schema-resolver');
      return getCacheStats();
    });

    this.registerHandler('schema.clear_cache', async () => {
      const { clearCache } = await import('../plugins/schema-resolver');
      await clearCache();
      return { success: true, message: 'Schema cache cleared' };
    });

    // ============================================================================
    // EVIDENCE HASHER PLUGIN HANDLERS
    // ============================================================================

    this.registerHandler('evidence.create_chain', async (args) => {
      const { createChainOfCustody } = await import('../plugins/evidence-hasher');
      const { filePath, operator, metadata } = args as {
        filePath: string;
        operator?: string;
        metadata?: Record<string, any>;
      };
      const chain = await createChainOfCustody(filePath, operator, metadata);
      return { success: true, evidenceId: chain.evidenceId, originalHash: chain.originalHash, chain };
    });

    this.registerHandler('evidence.add_stage', async (args) => {
      const { addProcessingStage, hashFile, hashContent } = await import('../plugins/evidence-hasher');
      const { chain, stage, outputFilePath, outputContent, operator, notes } = args as {
        chain: any;
        stage: 'imported' | 'converted' | 'normalized' | 'analyzed' | 'redacted' | 'exported';
        outputFilePath?: string;
        outputContent?: string;
        operator?: string;
        notes?: string;
      };
      let outputHash: string;
      if (outputFilePath) {
        outputHash = await hashFile(outputFilePath);
      } else if (outputContent) {
        outputHash = hashContent(outputContent);
      } else {
        throw new Error('Either outputFilePath or outputContent required');
      }
      const updatedChain = addProcessingStage(chain, stage, outputHash, operator, notes);
      return { success: true, stage, hash: outputHash, chain: updatedChain };
    });

    this.registerHandler('evidence.verify', async (args) => {
      const { verifyChain } = await import('../plugins/evidence-hasher');
      const { chain } = args as { chain: any };
      return verifyChain(chain);
    });

    this.registerHandler('evidence.hash_file', async (args) => {
      const { hashFile } = await import('../plugins/evidence-hasher');
      const fs = await import('fs/promises');
      const path = await import('path');
      const { filePath } = args as { filePath: string };
      const hash = await hashFile(filePath);
      const stats = await fs.stat(filePath);
      return { hash, algorithm: 'sha256', fileSize: stats.size, filename: path.basename(filePath) };
    });

    this.registerHandler('evidence.hash_content', async (args) => {
      const { hashContent } = await import('../plugins/evidence-hasher');
      const { content } = args as { content: string };
      return { hash: hashContent(content), algorithm: 'sha256', contentLength: content.length };
    });

    this.registerHandler('evidence.export', async (args) => {
      const { exportChain } = await import('../plugins/evidence-hasher');
      const fs = await import('fs/promises');
      const { chain, format, outputPath } = args as {
        chain: any;
        format: 'evidence_json' | 'court_csv' | 'timeline_json' | 'forensic_report';
        outputPath?: string;
      };
      const content = exportChain(chain, format);
      if (outputPath) {
        await fs.writeFile(outputPath, content);
        return { success: true, format, outputPath, contentLength: content.length };
      }
      return { success: true, format, content };
    });

    this.registerHandler('evidence.generate_report', async (args) => {
      const { generateForensicReport, verifyChain } = await import('../plugins/evidence-hasher');
      const { chain } = args as { chain: any };
      const report = generateForensicReport(chain);
      const verification = verifyChain(chain);
      return { report, verification, evidenceId: chain.evidenceId };
    });

    this.registerHandler('evidence.hash', async (args) => {
      // Alias for evidence.hash_file for backward compatibility
      const { hashFile, hashContent } = await import('../plugins/evidence-hasher');
      const { filePath, content } = args as { filePath?: string; content?: string };
      if (filePath) {
        return { hash: await hashFile(filePath), algorithm: 'sha256', type: 'file' };
      } else if (content) {
        return { hash: hashContent(content), algorithm: 'sha256', type: 'content' };
      }
      throw new Error('Either filePath or content required');
    });

    // ========================================================================
    // LIBRARY TOOLS (JS)
    // ========================================================================

    this.registerHandler('js.cheerio', async (args) => {
      const { runCheerio } = await import('../plugins/library-tools');
      return runCheerio(args as {
        html: string;
        selector?: string;
        operation?: 'text' | 'html' | 'attr' | 'find' | 'each';
        attribute?: string;
      });
    });

    this.registerHandler('js.xml_parse', async (args) => {
      const { parseXml } = await import('../plugins/library-tools');
      return parseXml(args as { xml: string; options?: Record<string, unknown> });
    });

    this.registerHandler('js.json5', async (args) => {
      const { parseJson5 } = await import('../plugins/library-tools');
      return parseJson5(args as { text: string });
    });

    this.registerHandler('js.yaml', async (args) => {
      const { handleYaml } = await import('../plugins/library-tools');
      return handleYaml(args as { input: string; operation?: 'parse' | 'stringify' });
    });

    this.registerHandler('js.csv', async (args) => {
      const { handleCsv } = await import('../plugins/library-tools');
      return handleCsv(args as { input: string; operation?: 'parse' | 'stringify'; options?: Record<string, unknown> });
    });

    this.registerHandler('js.natural', async (args) => {
      const { runNatural } = await import('../plugins/library-tools');
      return runNatural(args as {
        text: string;
        operation: 'tokenize' | 'stem' | 'phonetics' | 'sentiment' | 'classify';
        options?: Record<string, unknown>;
      });
    });

    this.registerHandler('js.compromise', async (args) => {
      const { runCompromise } = await import('../plugins/library-tools');
      return runCompromise(args as {
        text: string;
        operation: 'nouns' | 'verbs' | 'people' | 'places' | 'dates' | 'topics';
      });
    });

    this.registerHandler('js.franc', async (args) => {
      const { detectFranc } = await import('../plugins/library-tools');
      return detectFranc(args as { text: string; minLength?: number });
    });

    this.registerHandler('js.string_similarity', async (args) => {
      const { compareStrings } = await import('../plugins/library-tools');
      return compareStrings(args as { string1: string; string2: string; algorithm?: 'dice' | 'levenshtein' | 'jaro-winkler' });
    });

    // ========================================================================
    // LLAMAINDEX (TYPESCRIPT)
    // ========================================================================

    this.registerHandler('llamaindex.chunk_text', async (args) => {
      const { chunkText } = await import('../plugins/llamaindex');
      return chunkText(args as { text: string; chunkSize?: number; chunkOverlap?: number });
    });

    // ========================================================================
    // LIBRARY TOOLS (PYTHON)
    // ========================================================================

    this.registerHandler('py.spacy', async (args) => {
      const { runSpacy } = await import('../plugins/python-tools');
      return runSpacy(args as { text: string; operations?: string[]; model?: string });
    });

    this.registerHandler('py.nltk', async (args) => {
      const { runNltk } = await import('../plugins/python-tools');
      return runNltk(args as { text: string; operation: 'tokenize' | 'stem' | 'lemmatize' | 'chunk' | 'wordnet' });
    });

    this.registerHandler('py.transformers', async (args) => {
      const { runTransformers } = await import('../plugins/python-tools');
      return runTransformers(args as {
        text: string;
        operation: 'encode' | 'similarity' | 'classify' | 'qa';
        model?: string;
        options?: Record<string, unknown>;
      });
    });

    this.registerHandler('py.beautifulsoup', async (args) => {
      const { runBeautifulSoup } = await import('../plugins/python-tools');
      return runBeautifulSoup(args as {
        html: string;
        selector?: string;
        operation: 'find' | 'find_all' | 'select' | 'text' | 'attrs';
      });
    });

    this.registerHandler('py.pdfplumber', async (args) => {
      const { runPdfPlumber } = await import('../plugins/python-tools');
      return runPdfPlumber(args as { path: string; pages?: number[]; extractTables?: boolean });
    });

    this.registerHandler('py.pandas', async (args) => {
      const { runPandas } = await import('../plugins/python-tools');
      return runPandas(args as {
        input: string;
        operation: 'read' | 'filter' | 'groupby' | 'merge' | 'pivot' | 'describe';
        options?: Record<string, unknown>;
      });
    });

    this.registerHandler('py.llamaindex', async (args) => {
      const { runLlamaIndexChunk } = await import('../plugins/python-tools');
      return runLlamaIndexChunk(args as { text: string; chunkSize?: number; chunkOverlap?: number });
    });

    // ========================================================================
    // LANGCHAIN / LANGGRAPH (PYTHON)
    // ========================================================================

    this.registerHandler('langchain.format_prompt', async (args) => {
      const { runLangChainPrompt } = await import('../plugins/python-tools');
      return runLangChainPrompt(args as { template: string; variables?: Record<string, string> });
    });

    this.registerHandler('langchain.split_text', async (args) => {
      const { runLangChainSplit } = await import('../plugins/python-tools');
      return runLangChainSplit(args as { text: string; chunkSize?: number; chunkOverlap?: number; separator?: string });
    });

    this.registerHandler('langgraph.run', async (args) => {
      const { runLangGraphFlow } = await import('../plugins/python-tools');
      return runLangGraphFlow(args as {
        states: Array<{ id: string; payload?: Record<string, unknown> }>;
        edges: Array<{ from: string; to: string }>;
        start: string;
        end: string;
      });
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
