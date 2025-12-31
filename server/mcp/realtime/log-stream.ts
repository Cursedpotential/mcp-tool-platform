/**
 * Real-time Log Streaming via WebSocket
 * 
 * Provides live log streaming to connected clients with filtering capabilities.
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: string;
  tool?: string;
  traceId?: string;
  message: string;
  data?: Record<string, unknown>;
  duration?: number;
  userId?: string;
}

export interface LogFilter {
  levels?: LogLevel[];
  categories?: string[];
  tools?: string[];
  traceId?: string;
  search?: string;
  since?: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  activeConnections: number;
  requestsPerSecond: number;
  avgLatencyMs: number;
  errorRate: number;
  queueDepth: number;
  cacheHitRate: number;
  toolCalls: Record<string, number>;
  providerUsage: Record<string, { calls: number; tokens: number; cost: number }>;
}

// ============================================================================
// Log Buffer (Ring Buffer for Recent Logs)
// ============================================================================

class LogBuffer {
  private buffer: LogEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  push(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getRecent(count: number = 100, filter?: LogFilter): LogEntry[] {
    let entries = this.buffer.slice(-count * 2); // Get more to account for filtering
    
    if (filter) {
      entries = this.applyFilter(entries, filter);
    }
    
    return entries.slice(-count);
  }

  query(filter: LogFilter, limit: number = 1000): LogEntry[] {
    return this.applyFilter(this.buffer, filter).slice(-limit);
  }

  private applyFilter(entries: LogEntry[], filter: LogFilter): LogEntry[] {
    return entries.filter(entry => {
      if (filter.levels && filter.levels.length > 0 && !filter.levels.includes(entry.level)) {
        return false;
      }
      if (filter.categories && filter.categories.length > 0 && !filter.categories.includes(entry.category)) {
        return false;
      }
      if (filter.tools && filter.tools.length > 0 && entry.tool && !filter.tools.includes(entry.tool)) {
        return false;
      }
      if (filter.traceId && entry.traceId !== filter.traceId) {
        return false;
      }
      if (filter.since && entry.timestamp < filter.since) {
        return false;
      }
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const messageMatch = entry.message.toLowerCase().includes(searchLower);
        const dataMatch = entry.data ? JSON.stringify(entry.data).toLowerCase().includes(searchLower) : false;
        if (!messageMatch && !dataMatch) {
          return false;
        }
      }
      return true;
    });
  }

  clear(): void {
    this.buffer = [];
  }

  size(): number {
    return this.buffer.length;
  }

  export(filter?: LogFilter): string {
    const entries = filter ? this.applyFilter(this.buffer, filter) : this.buffer;
    return entries.map(e => JSON.stringify(e)).join('\n');
  }
}

// ============================================================================
// Real-time Metrics Collector
// ============================================================================

class MetricsCollector {
  private requestCounts: number[] = [];
  private latencies: number[] = [];
  private errors: number = 0;
  private totalRequests: number = 0;
  private toolCalls: Map<string, number> = new Map();
  private providerUsage: Map<string, { calls: number; tokens: number; cost: number }> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private queueDepth: number = 0;
  private windowMs: number = 60000; // 1 minute window

  recordRequest(latencyMs: number, success: boolean): void {
    const now = Date.now();
    this.requestCounts.push(now);
    this.latencies.push(latencyMs);
    this.totalRequests++;
    
    if (!success) {
      this.errors++;
    }

    // Clean old entries
    const cutoff = now - this.windowMs;
    while (this.requestCounts.length > 0 && this.requestCounts[0] < cutoff) {
      this.requestCounts.shift();
      this.latencies.shift();
    }
  }

  recordToolCall(toolName: string): void {
    this.toolCalls.set(toolName, (this.toolCalls.get(toolName) || 0) + 1);
  }

  recordProviderUsage(provider: string, tokens: number, cost: number): void {
    const current = this.providerUsage.get(provider) || { calls: 0, tokens: 0, cost: 0 };
    current.calls++;
    current.tokens += tokens;
    current.cost += cost;
    this.providerUsage.set(provider, current);
  }

  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  setQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  getSnapshot(activeConnections: number): MetricsSnapshot {
    const now = Date.now();
    const windowSeconds = this.windowMs / 1000;
    
    const recentLatencies = this.latencies.slice(-100);
    const avgLatency = recentLatencies.length > 0
      ? recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length
      : 0;

    const toolCallsObj: Record<string, number> = {};
    for (const [tool, count] of Array.from(this.toolCalls.entries())) {
      toolCallsObj[tool] = count;
    }

    const providerUsageObj: Record<string, { calls: number; tokens: number; cost: number }> = {};
    for (const [provider, usage] of Array.from(this.providerUsage.entries())) {
      providerUsageObj[provider] = usage;
    }

    const totalCacheOps = this.cacheHits + this.cacheMisses;

    return {
      timestamp: now,
      activeConnections,
      requestsPerSecond: this.requestCounts.length / windowSeconds,
      avgLatencyMs: Math.round(avgLatency),
      errorRate: this.totalRequests > 0 ? this.errors / this.totalRequests : 0,
      queueDepth: this.queueDepth,
      cacheHitRate: totalCacheOps > 0 ? this.cacheHits / totalCacheOps : 0,
      toolCalls: toolCallsObj,
      providerUsage: providerUsageObj,
    };
  }

  reset(): void {
    this.requestCounts = [];
    this.latencies = [];
    this.errors = 0;
    this.totalRequests = 0;
    this.toolCalls.clear();
    this.providerUsage.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.queueDepth = 0;
  }
}

// ============================================================================
// Log Stream Manager (Singleton)
// ============================================================================

class LogStreamManager extends EventEmitter {
  private static instance: LogStreamManager | null = null;
  private buffer: LogBuffer;
  private metrics: MetricsCollector;
  private subscribers: Map<string, { filter: LogFilter; callback: (entry: LogEntry) => void }> = new Map();
  private metricsSubscribers: Map<string, (snapshot: MetricsSnapshot) => void> = new Map();
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private logIdCounter: number = 0;

  private constructor() {
    super();
    this.buffer = new LogBuffer(10000);
    this.metrics = new MetricsCollector();
    this.startMetricsBroadcast();
  }

  static getInstance(): LogStreamManager {
    if (!LogStreamManager.instance) {
      LogStreamManager.instance = new LogStreamManager();
    }
    return LogStreamManager.instance;
  }

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------

  log(level: LogLevel, category: string, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${++this.logIdCounter}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      tool: data?.tool as string | undefined,
      traceId: data?.traceId as string | undefined,
      duration: data?.duration as number | undefined,
      userId: data?.userId as string | undefined,
    };

    this.buffer.push(entry);
    this.emit('log', entry);

    // Notify subscribers
    for (const [, sub] of Array.from(this.subscribers.entries())) {
      if (this.matchesFilter(entry, sub.filter)) {
        try {
          sub.callback(entry);
        } catch (err) {
          console.error('Error in log subscriber callback:', err);
        }
      }
    }
  }

  debug(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('error', category, message, data);
  }

  fatal(category: string, message: string, data?: Record<string, unknown>): void {
    this.log('fatal', category, message, data);
  }

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  subscribe(id: string, filter: LogFilter, callback: (entry: LogEntry) => void): void {
    this.subscribers.set(id, { filter, callback });
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
  }

  subscribeMetrics(id: string, callback: (snapshot: MetricsSnapshot) => void): void {
    this.metricsSubscribers.set(id, callback);
  }

  unsubscribeMetrics(id: string): void {
    this.metricsSubscribers.delete(id);
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getRecentLogs(count: number = 100, filter?: LogFilter): LogEntry[] {
    return this.buffer.getRecent(count, filter);
  }

  queryLogs(filter: LogFilter, limit: number = 1000): LogEntry[] {
    return this.buffer.query(filter, limit);
  }

  exportLogs(filter?: LogFilter): string {
    return this.buffer.export(filter);
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  recordRequest(latencyMs: number, success: boolean): void {
    this.metrics.recordRequest(latencyMs, success);
  }

  recordToolCall(toolName: string): void {
    this.metrics.recordToolCall(toolName);
  }

  recordProviderUsage(provider: string, tokens: number, cost: number): void {
    this.metrics.recordProviderUsage(provider, tokens, cost);
  }

  recordCacheHit(hit: boolean): void {
    this.metrics.recordCacheHit(hit);
  }

  setQueueDepth(depth: number): void {
    this.metrics.setQueueDepth(depth);
  }

  getMetricsSnapshot(): MetricsSnapshot {
    return this.metrics.getSnapshot(this.subscribers.size);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    if (filter.levels && filter.levels.length > 0 && !filter.levels.includes(entry.level)) {
      return false;
    }
    if (filter.categories && filter.categories.length > 0 && !filter.categories.includes(entry.category)) {
      return false;
    }
    if (filter.tools && filter.tools.length > 0 && entry.tool && !filter.tools.includes(entry.tool)) {
      return false;
    }
    if (filter.traceId && entry.traceId !== filter.traceId) {
      return false;
    }
    return true;
  }

  private startMetricsBroadcast(): void {
    // Broadcast metrics every 2 seconds
    this.metricsInterval = setInterval(() => {
      const snapshot = this.getMetricsSnapshot();
      for (const [, callback] of Array.from(this.metricsSubscribers.entries())) {
        try {
          callback(snapshot);
        } catch (err) {
          console.error('Error in metrics subscriber callback:', err);
        }
      }
      this.emit('metrics', snapshot);
    }, 2000);
  }

  shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.subscribers.clear();
    this.metricsSubscribers.clear();
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getLogStream(): LogStreamManager {
  return LogStreamManager.getInstance();
}

export const logger = {
  debug: (category: string, message: string, data?: Record<string, unknown>) => 
    getLogStream().debug(category, message, data),
  info: (category: string, message: string, data?: Record<string, unknown>) => 
    getLogStream().info(category, message, data),
  warn: (category: string, message: string, data?: Record<string, unknown>) => 
    getLogStream().warn(category, message, data),
  error: (category: string, message: string, data?: Record<string, unknown>) => 
    getLogStream().error(category, message, data),
  fatal: (category: string, message: string, data?: Record<string, unknown>) => 
    getLogStream().fatal(category, message, data),
};
