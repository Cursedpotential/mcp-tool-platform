/**
 * MCP Preprocessing Tool Shop - Shared Types
 * 
 * Core type definitions for the token-efficient preprocessing platform.
 * Designed for 85%+ token reduction through reference-based returns,
 * structured metadata, and working memory patterns.
 */

// ============================================================================
// Content-Addressed Storage Types
// ============================================================================

/** SHA-256 content hash reference */
export type ContentRef = `sha256:${string}`;

/** Reference to stored content with metadata */
export interface StoredRef {
  ref: ContentRef;
  hash: string;
  size: number;
  mime: string;
  preview?: string;
  createdAt: number;
}

/** Paged content retrieval request */
export interface PageRequest {
  ref: ContentRef;
  page: number;
  pageSize?: number;
}

/** Paged content response */
export interface PagedContent {
  ref: ContentRef;
  page: number;
  totalPages: number;
  totalSize: number;
  content: string;
  hasMore: boolean;
}

// ============================================================================
// Tool Discovery & Invocation Types
// ============================================================================

/** Minimal tool card for search results (token-efficient) */
export interface ToolCard {
  name: string;
  category: string;
  description: string;
  tags: string[];
}

/** Full tool specification (on-demand) */
export interface ToolSpec {
  name: string;
  category: string;
  description: string;
  version: string;
  tags: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  examples?: ToolExample[];
  permissions: ToolPermission[];
  estimatedCost?: CostEstimate;
}

export interface ToolExample {
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export type ToolPermission = 
  | 'read:filesystem'
  | 'write:filesystem'
  | 'read:network'
  | 'write:network'
  | 'execute:process'
  | 'access:llm'
  | 'access:vectordb';

export interface CostEstimate {
  tokens?: number;
  timeMs?: number;
  apiCalls?: number;
}

/** Tool invocation request */
export interface InvokeRequest {
  toolName: string;
  args: Record<string, unknown>;
  options?: InvokeOptions;
}

export interface InvokeOptions {
  timeout?: number;
  maxOutputSize?: number;
  returnRef?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

/** Tool invocation result */
export interface InvokeResult {
  success: boolean;
  /** Inline result for small outputs */
  data?: unknown;
  /** Reference for large outputs */
  ref?: StoredRef;
  /** Execution metadata */
  meta: InvokeMeta;
  /** Error details if failed */
  error?: InvokeError;
}

export interface InvokeMeta {
  toolName: string;
  executionTimeMs: number;
  tokensUsed?: number;
  cacheHit?: boolean;
  workerId?: string;
  traceId: string;
}

export interface InvokeError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Task Graph & Worker Types
// ============================================================================

export type TaskStatus = 
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'waiting_approval';

export interface Task {
  id: string;
  type: string;
  status: TaskStatus;
  input: Record<string, unknown>;
  inputRefs?: ContentRef[];
  output?: Record<string, unknown>;
  outputRef?: ContentRef;
  parentId?: string;
  childIds?: string[];
  dependencies?: string[];
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  workerId?: string;
  checkpointRef?: ContentRef;
  contentHash?: string;
  traceId: string;
  error?: InvokeError;
}

export interface TaskGraph {
  id: string;
  name: string;
  rootTaskId: string;
  tasks: Map<string, Task>;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  checkpointRef?: ContentRef;
}

export interface WorkerInfo {
  id: string;
  type: 'local' | 'remote';
  status: 'idle' | 'busy' | 'offline';
  capabilities: string[];
  currentTaskId?: string;
  lastHeartbeat: number;
  metrics: WorkerMetrics;
}

export interface WorkerMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  avgExecutionTimeMs: number;
  bytesProcessed: number;
}

// ============================================================================
// Document Processing Types
// ============================================================================

export interface DocumentMeta {
  id: string;
  filename: string;
  mime: string;
  size: number;
  contentRef: ContentRef;
  markdownRef?: ContentRef;
  ocrRef?: ContentRef;
  chunksRef?: ContentRef;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  createdAt: number;
  processedAt?: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  index: number;
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'table' | 'image';
  content: string;
  startOffset: number;
  endOffset: number;
  level?: number;
  metadata?: Record<string, unknown>;
}

export interface DocumentSection {
  id: string;
  documentId: string;
  title: string;
  level: number;
  startOffset: number;
  endOffset: number;
  chunkIds: string[];
  summaryRef?: ContentRef;
}

// ============================================================================
// NLP & Entity Types
// ============================================================================

export type EntityType = 
  | 'PERSON'
  | 'ORG'
  | 'GPE'
  | 'LOC'
  | 'DATE'
  | 'TIME'
  | 'MONEY'
  | 'PERCENT'
  | 'PRODUCT'
  | 'EVENT'
  | 'WORK_OF_ART'
  | 'LAW'
  | 'LANGUAGE'
  | 'CUSTOM';

export interface Entity {
  text: string;
  type: EntityType;
  startOffset: number;
  endOffset: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface SentimentResult {
  label: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
}

export interface KeywordResult {
  keyword: string;
  score: number;
  frequency: number;
  positions: number[];
}

export interface SentenceSpan {
  text: string;
  startOffset: number;
  endOffset: number;
  index: number;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchMatch {
  file: string;
  lineNumber: number;
  column: number;
  matchText: string;
  contextBefore?: string;
  contextAfter?: string;
  absoluteOffset: number;
}

export interface SearchResult {
  query: string;
  engine: 'ripgrep' | 'ugrep' | 'js';
  totalMatches: number;
  files: number;
  matches: SearchMatch[];
  truncated: boolean;
  executionTimeMs: number;
  ref?: ContentRef;
}

// ============================================================================
// Rules Engine Types
// ============================================================================

export interface RuleSet {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: Rule[];
  enabled: boolean;
}

export interface Rule {
  id: string;
  name: string;
  type: 'regex' | 'keyword' | 'path' | 'structural' | 'semantic';
  pattern: string;
  action: RuleAction;
  priority: number;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export type RuleAction = 
  | { type: 'label'; labels: string[] }
  | { type: 'move'; destination: string }
  | { type: 'delete' }
  | { type: 'merge'; target: string }
  | { type: 'flag'; reason: string }
  | { type: 'transform'; transformer: string };

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  matchedText: string;
  startOffset: number;
  endOffset: number;
  proposedAction: RuleAction;
  confidence: number;
}

// ============================================================================
// Approval & HITL Types
// ============================================================================

export interface ApprovalRequest {
  id: string;
  type: 'write' | 'delete' | 'move' | 'merge' | 'execute';
  description: string;
  preview: string;
  diff?: string;
  rollbackRef?: ContentRef;
  taskId: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy?: string;
  approvedAt?: number;
}

export interface ApprovalResponse {
  approvalId: string;
  decision: 'approve' | 'reject';
  comment?: string;
}

// ============================================================================
// Export Pipeline Types
// ============================================================================

export interface ExportConfig {
  target: 'neo4j' | 'supabase' | 'vectordb' | 'json';
  options: Record<string, unknown>;
}

export interface Neo4jExportOptions {
  uri: string;
  database: string;
  nodeLabels: Record<string, string>;
  relationshipTypes: Record<string, string>;
  batchSize: number;
}

export interface VectorDBExportOptions {
  provider: 'chroma' | 'faiss' | 'pinecone' | 'qdrant';
  collection: string;
  embeddingModel: string;
  batchSize: number;
}

// ============================================================================
// LLM Provider Types
// ============================================================================

export type LLMProvider = 'ollama' | 'gemini' | 'openrouter' | 'local-bert' | 'openai';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  options?: Record<string, unknown>;
}

export interface EmbeddingRequest {
  text: string | string[];
  model?: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  tokensUsed: number;
}

export interface CompletionRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface CompletionResult {
  text: string;
  tokensUsed: number;
  finishReason: 'stop' | 'length' | 'error';
}

// ============================================================================
// Observability Types
// ============================================================================

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, string>;
  logs: TraceLog[];
}

export interface TraceLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, unknown>;
}

export interface Metrics {
  timestamp: number;
  name: string;
  value: number;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram';
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  traceId: string;
  executionTimeMs: number;
  cached?: boolean;
}

// ============================================================================
// Observability Types
// ============================================================================

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  serviceName: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, string>;
  logs: TraceLog[];
}

export interface TraceLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  fields?: Record<string, unknown>;
}

export interface Metrics {
  timestamp: number;
  name: string;
  value: number;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram';
}

