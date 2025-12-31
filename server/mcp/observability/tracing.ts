/**
 * Observability & Tracing Module
 * 
 * Provides distributed tracing and metrics for:
 * - Task execution monitoring
 * - Tool invocation tracking
 * - Performance metrics
 * - Error tracking
 */

import { nanoid } from 'nanoid';
import type { TraceContext, TraceLog, Metrics } from '../../../shared/mcp-types';

// ============================================================================
// Trace Store
// ============================================================================

const traceStore: Map<string, TraceContext> = new Map();
const metricsStore: Metrics[] = [];
const MAX_TRACES = 10000;
const MAX_METRICS = 100000;

// ============================================================================
// Span Management
// ============================================================================

/**
 * Start a new trace
 */
export function startTrace(
  serviceName: string,
  operationName: string,
  parentSpanId?: string
): TraceContext {
  const traceId = parentSpanId ? getTraceIdFromSpan(parentSpanId) : nanoid();
  const spanId = nanoid();

  const context: TraceContext = {
    traceId,
    spanId,
    parentSpanId,
    serviceName,
    operationName,
    startTime: Date.now(),
    tags: {},
    logs: [],
  };

  traceStore.set(spanId, context);

  // Cleanup old traces if needed
  if (traceStore.size > MAX_TRACES) {
    const oldestKey = traceStore.keys().next().value;
    if (oldestKey) traceStore.delete(oldestKey);
  }

  return context;
}

/**
 * End a span and record duration
 */
export function endSpan(spanId: string): TraceContext | null {
  const context = traceStore.get(spanId);
  if (!context) return null;

  context.endTime = Date.now();
  return context;
}

/**
 * Add a tag to a span
 */
export function addTag(spanId: string, key: string, value: string): void {
  const context = traceStore.get(spanId);
  if (context) {
    context.tags[key] = value;
  }
}

/**
 * Add a log entry to a span
 */
export function addLog(
  spanId: string,
  level: TraceLog['level'],
  message: string,
  fields?: Record<string, unknown>
): void {
  const context = traceStore.get(spanId);
  if (context) {
    context.logs.push({
      timestamp: Date.now(),
      level,
      message,
      fields,
    });
  }
}

/**
 * Get a span by ID
 */
export function getSpan(spanId: string): TraceContext | null {
  return traceStore.get(spanId) ?? null;
}

/**
 * Get all spans for a trace
 */
export function getTrace(traceId: string): TraceContext[] {
  const spans: TraceContext[] = [];
  traceStore.forEach((context) => {
    if (context.traceId === traceId) {
      spans.push(context);
    }
  });
  return spans.sort((a, b) => a.startTime - b.startTime);
}

// ============================================================================
// Metrics Collection
// ============================================================================

/**
 * Record a counter metric
 */
export function incrementCounter(
  name: string,
  value: number = 1,
  tags: Record<string, string> = {}
): void {
  recordMetric(name, value, 'counter', tags);
}

/**
 * Record a gauge metric
 */
export function setGauge(
  name: string,
  value: number,
  tags: Record<string, string> = {}
): void {
  recordMetric(name, value, 'gauge', tags);
}

/**
 * Record a histogram metric
 */
export function recordHistogram(
  name: string,
  value: number,
  tags: Record<string, string> = {}
): void {
  recordMetric(name, value, 'histogram', tags);
}

function recordMetric(
  name: string,
  value: number,
  type: Metrics['type'],
  tags: Record<string, string>
): void {
  metricsStore.push({
    timestamp: Date.now(),
    name,
    value,
    tags,
    type,
  });

  // Cleanup old metrics if needed
  if (metricsStore.length > MAX_METRICS) {
    metricsStore.shift();
  }
}

/**
 * Get metrics by name and time range
 */
export function getMetrics(
  name: string,
  startTime?: number,
  endTime?: number
): Metrics[] {
  const start = startTime ?? 0;
  const end = endTime ?? Date.now();

  return metricsStore.filter(
    (m) => m.name === name && m.timestamp >= start && m.timestamp <= end
  );
}

/**
 * Get aggregated metrics
 */
export function getAggregatedMetrics(
  name: string,
  startTime?: number,
  endTime?: number
): {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
} {
  const metrics = getMetrics(name, startTime, endTime);

  if (metrics.length === 0) {
    return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
  }

  const values = metrics.map((m) => m.value);
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    count: metrics.length,
    sum,
    avg: sum / metrics.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

// ============================================================================
// Tool Execution Tracing
// ============================================================================

/**
 * Trace a tool invocation
 */
export async function traceToolInvocation<T>(
  toolName: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<{ result: T; spanId: string; durationMs: number }> {
  const span = startTrace('mcp-gateway', `tool:${toolName}`);
  addTag(span.spanId, 'tool.name', toolName);
  addTag(span.spanId, 'tool.args_size', JSON.stringify(args).length.toString());

  const startTime = Date.now();
  incrementCounter('tool.invocations', 1, { tool: toolName });

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    addTag(span.spanId, 'tool.status', 'success');
    addLog(span.spanId, 'info', `Tool ${toolName} completed`, { durationMs });
    recordHistogram('tool.duration_ms', durationMs, { tool: toolName });

    endSpan(span.spanId);

    return { result, spanId: span.spanId, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    addTag(span.spanId, 'tool.status', 'error');
    addTag(span.spanId, 'error', error instanceof Error ? error.message : 'Unknown error');
    addLog(span.spanId, 'error', `Tool ${toolName} failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs,
    });
    incrementCounter('tool.errors', 1, { tool: toolName });

    endSpan(span.spanId);
    throw error;
  }
}

/**
 * Trace a task execution
 */
export async function traceTaskExecution<T>(
  taskId: string,
  taskType: string,
  fn: () => Promise<T>
): Promise<{ result: T; spanId: string; durationMs: number }> {
  const span = startTrace('task-executor', `task:${taskType}`);
  addTag(span.spanId, 'task.id', taskId);
  addTag(span.spanId, 'task.type', taskType);

  const startTime = Date.now();
  incrementCounter('task.executions', 1, { type: taskType });

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;

    addTag(span.spanId, 'task.status', 'success');
    addLog(span.spanId, 'info', `Task ${taskId} completed`, { durationMs });
    recordHistogram('task.duration_ms', durationMs, { type: taskType });

    endSpan(span.spanId);

    return { result, spanId: span.spanId, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    addTag(span.spanId, 'task.status', 'error');
    addTag(span.spanId, 'error', error instanceof Error ? error.message : 'Unknown error');
    addLog(span.spanId, 'error', `Task ${taskId} failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs,
    });
    incrementCounter('task.errors', 1, { type: taskType });

    endSpan(span.spanId);
    throw error;
  }
}

// ============================================================================
// Dashboard Data
// ============================================================================

/**
 * Get dashboard summary
 */
export function getDashboardSummary(): {
  activeSpans: number;
  totalTraces: number;
  recentErrors: number;
  toolStats: Record<string, { invocations: number; errors: number; avgDurationMs: number }>;
  taskStats: Record<string, { executions: number; errors: number; avgDurationMs: number }>;
} {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Count active spans (no endTime)
  let activeSpans = 0;
  traceStore.forEach((ctx) => {
    if (!ctx.endTime) activeSpans++;
  });

  // Count recent errors
  const recentErrors = metricsStore.filter(
    (m) =>
      (m.name === 'tool.errors' || m.name === 'task.errors') &&
      m.timestamp >= oneHourAgo
  ).length;

  // Aggregate tool stats
  const toolStats: Record<string, { invocations: number; errors: number; avgDurationMs: number }> = {};
  const toolInvocations = getMetrics('tool.invocations', oneHourAgo);
  const toolErrors = getMetrics('tool.errors', oneHourAgo);
  const toolDurations = getMetrics('tool.duration_ms', oneHourAgo);

  for (const m of toolInvocations) {
    const tool = m.tags.tool ?? 'unknown';
    if (!toolStats[tool]) {
      toolStats[tool] = { invocations: 0, errors: 0, avgDurationMs: 0 };
    }
    toolStats[tool].invocations += m.value;
  }

  for (const m of toolErrors) {
    const tool = m.tags.tool ?? 'unknown';
    if (toolStats[tool]) {
      toolStats[tool].errors += m.value;
    }
  }

  for (const tool of Object.keys(toolStats)) {
    const durations = toolDurations.filter((m) => m.tags.tool === tool);
    if (durations.length > 0) {
      const sum = durations.reduce((a, b) => a + b.value, 0);
      toolStats[tool].avgDurationMs = Math.round(sum / durations.length);
    }
  }

  // Aggregate task stats
  const taskStats: Record<string, { executions: number; errors: number; avgDurationMs: number }> = {};
  const taskExecutions = getMetrics('task.executions', oneHourAgo);
  const taskErrors = getMetrics('task.errors', oneHourAgo);
  const taskDurations = getMetrics('task.duration_ms', oneHourAgo);

  for (const m of taskExecutions) {
    const type = m.tags.type ?? 'unknown';
    if (!taskStats[type]) {
      taskStats[type] = { executions: 0, errors: 0, avgDurationMs: 0 };
    }
    taskStats[type].executions += m.value;
  }

  for (const m of taskErrors) {
    const type = m.tags.type ?? 'unknown';
    if (taskStats[type]) {
      taskStats[type].errors += m.value;
    }
  }

  for (const type of Object.keys(taskStats)) {
    const durations = taskDurations.filter((m) => m.tags.type === type);
    if (durations.length > 0) {
      const sum = durations.reduce((a, b) => a + b.value, 0);
      taskStats[type].avgDurationMs = Math.round(sum / durations.length);
    }
  }

  return {
    activeSpans,
    totalTraces: traceStore.size,
    recentErrors,
    toolStats,
    taskStats,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getTraceIdFromSpan(spanId: string): string {
  const context = traceStore.get(spanId);
  return context?.traceId ?? nanoid();
}

/**
 * Export traces for external systems
 */
export function exportTraces(
  startTime?: number,
  endTime?: number
): TraceContext[] {
  const start = startTime ?? 0;
  const end = endTime ?? Date.now();
  const traces: TraceContext[] = [];

  traceStore.forEach((ctx) => {
    if (ctx.startTime >= start && ctx.startTime <= end) {
      traces.push(ctx);
    }
  });

  return traces.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Clear old traces and metrics
 */
export function cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): {
  tracesRemoved: number;
  metricsRemoved: number;
} {
  const cutoff = Date.now() - maxAgeMs;
  let tracesRemoved = 0;
  let metricsRemoved = 0;

  traceStore.forEach((ctx, spanId) => {
    if (ctx.startTime < cutoff) {
      traceStore.delete(spanId);
      tracesRemoved++;
    }
  });

  const initialMetricsCount = metricsStore.length;
  while (metricsStore.length > 0 && metricsStore[0].timestamp < cutoff) {
    metricsStore.shift();
    metricsRemoved++;
  }

  return { tracesRemoved, metricsRemoved };
}
