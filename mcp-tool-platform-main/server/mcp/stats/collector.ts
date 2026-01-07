/**
 * Stats Collector
 * 
 * Tracks all tool usage, performance metrics, and costs.
 * Provides data for the analytics dashboard.
 */

import { nanoid } from 'nanoid';

// ============================================================================
// Types
// ============================================================================

export interface ToolCall {
  id: string;
  toolName: string;
  category: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  inputSize: number;
  outputSize: number;
  tokensUsed?: number;
  cost?: number;
  provider?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface HourlyStats {
  hour: string;
  calls: number;
  successes: number;
  failures: number;
  totalDuration: number;
  totalTokens: number;
  totalCost: number;
  toolBreakdown: Record<string, number>;
  providerBreakdown: Record<string, number>;
}

export interface ToolStats {
  toolName: string;
  category: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  totalTokens: number;
  totalCost: number;
  lastUsed?: number;
  lastError?: string;
}

export interface ProviderStats {
  provider: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgLatency: number;
  totalTokens: number;
  totalCost: number;
  lastUsed?: number;
}

export interface DashboardData {
  summary: {
    totalCalls: number;
    successRate: number;
    avgLatency: number;
    totalTokens: number;
    totalCost: number;
    activeTools: number;
    activeProviders: number;
  };
  recentCalls: ToolCall[];
  topTools: Array<{ name: string; calls: number; avgDuration: number }>;
  hourlyTrend: HourlyStats[];
  toolStats: ToolStats[];
  providerStats: ProviderStats[];
  errors: Array<{ timestamp: number; tool: string; error: string }>;
  heatmap: Array<{ hour: number; day: number; value: number }>;
}

// ============================================================================
// Stats Collector Class
// ============================================================================

class StatsCollector {
  private calls: ToolCall[] = [];
  private toolStats: Map<string, ToolStats> = new Map();
  private providerStats: Map<string, ProviderStats> = new Map();
  private hourlyStats: Map<string, HourlyStats> = new Map();
  private maxCallHistory = 10000;

  recordCall(call: Omit<ToolCall, 'id'>): ToolCall {
    const fullCall: ToolCall = { ...call, id: nanoid() };
    this.calls.push(fullCall);
    if (this.calls.length > this.maxCallHistory) {
      this.calls.shift();
    }
    this.updateToolStats(fullCall);
    if (fullCall.provider) {
      this.updateProviderStats(fullCall);
    }
    this.updateHourlyStats(fullCall);
    return fullCall;
  }

  private updateToolStats(call: ToolCall): void {
    const existing = this.toolStats.get(call.toolName) || {
      toolName: call.toolName,
      category: call.category,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
      totalTokens: 0,
      totalCost: 0,
    };

    existing.totalCalls++;
    if (call.success) {
      existing.successfulCalls++;
    } else {
      existing.failedCalls++;
      existing.lastError = call.error;
    }
    existing.avgDuration = (existing.avgDuration * (existing.totalCalls - 1) + call.duration) / existing.totalCalls;
    existing.totalTokens += call.tokensUsed || 0;
    existing.totalCost += call.cost || 0;
    existing.lastUsed = call.timestamp;

    this.toolStats.set(call.toolName, existing);
  }

  private updateProviderStats(call: ToolCall): void {
    if (!call.provider) return;
    const existing = this.providerStats.get(call.provider) || {
      provider: call.provider,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgLatency: 0,
      totalTokens: 0,
      totalCost: 0,
    };

    existing.totalCalls++;
    if (call.success) {
      existing.successfulCalls++;
    } else {
      existing.failedCalls++;
    }
    existing.avgLatency = (existing.avgLatency * (existing.totalCalls - 1) + call.duration) / existing.totalCalls;
    existing.totalTokens += call.tokensUsed || 0;
    existing.totalCost += call.cost || 0;
    existing.lastUsed = call.timestamp;

    this.providerStats.set(call.provider, existing);
  }

  private updateHourlyStats(call: ToolCall): void {
    const hourKey = new Date(call.timestamp).toISOString().slice(0, 13) + ':00:00Z';
    const existing = this.hourlyStats.get(hourKey) || {
      hour: hourKey,
      calls: 0,
      successes: 0,
      failures: 0,
      totalDuration: 0,
      totalTokens: 0,
      totalCost: 0,
      toolBreakdown: {},
      providerBreakdown: {},
    };

    existing.calls++;
    if (call.success) existing.successes++;
    else existing.failures++;
    existing.totalDuration += call.duration;
    existing.totalTokens += call.tokensUsed || 0;
    existing.totalCost += call.cost || 0;
    existing.toolBreakdown[call.toolName] = (existing.toolBreakdown[call.toolName] || 0) + 1;
    if (call.provider) {
      existing.providerBreakdown[call.provider] = (existing.providerBreakdown[call.provider] || 0) + 1;
    }

    this.hourlyStats.set(hourKey, existing);
  }

  getDashboardData(): DashboardData {
    const allCalls = this.calls;
    const recentCalls = allCalls.slice(-100).reverse();
    
    const totalCalls = allCalls.length;
    const successfulCalls = allCalls.filter(c => c.success).length;
    const successRate = totalCalls > 0 ? successfulCalls / totalCalls : 0;
    const avgLatency = totalCalls > 0 
      ? allCalls.reduce((sum, c) => sum + c.duration, 0) / totalCalls : 0;
    const totalTokens = allCalls.reduce((sum, c) => sum + (c.tokensUsed || 0), 0);
    const totalCost = allCalls.reduce((sum, c) => sum + (c.cost || 0), 0);

    const toolCallCounts = new Map<string, { calls: number; totalDuration: number }>();
    for (const call of allCalls) {
      const existing = toolCallCounts.get(call.toolName) || { calls: 0, totalDuration: 0 };
      existing.calls++;
      existing.totalDuration += call.duration;
      toolCallCounts.set(call.toolName, existing);
    }
    const topTools = Array.from(toolCallCounts.entries())
      .map(([name, data]) => ({ name, calls: data.calls, avgDuration: data.totalDuration / data.calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    const now = Date.now();
    const hourlyTrend: HourlyStats[] = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now - i * 60 * 60 * 1000);
      const hourKey = hourStart.toISOString().slice(0, 13) + ':00:00Z';
      hourlyTrend.push(this.hourlyStats.get(hourKey) || {
        hour: hourKey, calls: 0, successes: 0, failures: 0,
        totalDuration: 0, totalTokens: 0, totalCost: 0,
        toolBreakdown: {}, providerBreakdown: {},
      });
    }

    const errors = allCalls
      .filter(c => !c.success && c.error)
      .slice(-20)
      .map(c => ({ timestamp: c.timestamp, tool: c.toolName, error: c.error || 'Unknown' }))
      .reverse();

    const heatmap: Array<{ hour: number; day: number; value: number }> = [];
    const heatmapData = new Map<string, number>();
    for (const call of allCalls) {
      const date = new Date(call.timestamp);
      const key = `${date.getDay()}-${date.getHours()}`;
      heatmapData.set(key, (heatmapData.get(key) || 0) + 1);
    }
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmap.push({ day, hour, value: heatmapData.get(`${day}-${hour}`) || 0 });
      }
    }

    return {
      summary: { totalCalls, successRate, avgLatency, totalTokens, totalCost,
        activeTools: this.toolStats.size, activeProviders: this.providerStats.size },
      recentCalls, topTools, hourlyTrend,
      toolStats: Array.from(this.toolStats.values()),
      providerStats: Array.from(this.providerStats.values()),
      errors, heatmap,
    };
  }

  getToolStats(toolName?: string): ToolStats[] {
    if (toolName) {
      const stats = this.toolStats.get(toolName);
      return stats ? [stats] : [];
    }
    return Array.from(this.toolStats.values());
  }

  getProviderStats(provider?: string): ProviderStats[] {
    if (provider) {
      const stats = this.providerStats.get(provider);
      return stats ? [stats] : [];
    }
    return Array.from(this.providerStats.values());
  }

  getRecentCalls(limit = 100, toolName?: string): ToolCall[] {
    let calls = this.calls;
    if (toolName) calls = calls.filter(c => c.toolName === toolName);
    return calls.slice(-limit).reverse();
  }

  exportStats() {
    return {
      calls: this.calls,
      toolStats: Array.from(this.toolStats.values()),
      providerStats: Array.from(this.providerStats.values()),
      hourlyStats: Array.from(this.hourlyStats.values()),
    };
  }

  reset(): void {
    this.calls = [];
    this.toolStats.clear();
    this.providerStats.clear();
    this.hourlyStats.clear();
  }
}

let collectorInstance: StatsCollector | null = null;

export function getStatsCollector(): StatsCollector {
  if (!collectorInstance) {
    collectorInstance = new StatsCollector();
  }
  return collectorInstance;
}

export { StatsCollector };
