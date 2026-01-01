/**
 * Smart LLM Provider Router
 * 
 * Routes LLM requests based on:
 * - Task type (simple/complex/creative)
 * - Cost constraints (free tier first, paid fallback)
 * - Latency requirements (local vs cloud)
 * - Context window needs (long documents)
 * - Provider health and rate limits
 */

import { LLMProviderHub, type ProviderType, type LLMRequest, type LLMResponse } from './provider-hub';

type LLMProvider = ProviderType;

// ============================================================================
// Types
// ============================================================================

export type TaskType = 'simple' | 'complex' | 'creative' | 'long-context' | 'embedding';

export type CostTier = 'free' | 'cheap' | 'moderate' | 'expensive';

export interface RoutingPolicy {
  // Task-based routing
  taskTypePreferences: Record<TaskType, LLMProvider[]>;
  
  // Cost-based routing
  maxCostPerRequest?: number;        // USD
  preferFreeTier: boolean;
  costTierOrder: CostTier[];
  
  // Latency-based routing
  maxLatency?: number;               // milliseconds
  preferLocal: boolean;
  
  // Context window routing
  minContextWindow?: number;         // tokens
  
  // Load balancing
  enableLoadBalancing: boolean;
  apiKeys: Record<LLMProvider, string[]>; // Multiple keys per provider
  
  // Failover
  enableFailover: boolean;
  maxRetries: number;
  retryDelay: number;                // milliseconds
  
  // Budget limits
  dailyBudget?: number;              // USD per day
  monthlyBudget?: number;            // USD per month
}

export interface ProviderMetrics {
  provider: LLMProvider;
  successRate: number;               // 0-1
  averageLatency: number;            // milliseconds
  currentLoad: number;               // 0-1
  rateLimitRemaining: number;
  costPerToken: number;              // USD
  contextWindow: number;             // tokens
  isAvailable: boolean;
  lastError?: string;
  lastErrorTime?: number;
}

export interface RoutingDecision {
  provider: LLMProvider;
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
  fallbackChain: LLMProvider[];
}

export interface BudgetTracker {
  dailySpent: number;
  monthlySpent: number;
  lastReset: number;
  perProviderSpent: Record<LLMProvider, number>;
}

// ============================================================================
// Provider Cost Database
// ============================================================================

const PROVIDER_COSTS: Record<ProviderType, { inputCost: number; outputCost: number; contextWindow: number; tier: CostTier }> = {
  // Local providers (free)
  'ollama': { inputCost: 0, outputCost: 0, contextWindow: 4096, tier: 'free' },
  'lmstudio': { inputCost: 0, outputCost: 0, contextWindow: 4096, tier: 'free' },
  'llamacpp': { inputCost: 0, outputCost: 0, contextWindow: 4096, tier: 'free' },
  // Major cloud providers
  'openai': { inputCost: 0.0015, outputCost: 0.002, contextWindow: 128000, tier: 'moderate' },
  'anthropic': { inputCost: 0.003, outputCost: 0.015, contextWindow: 200000, tier: 'expensive' },
  'google': { inputCost: 0.00025, outputCost: 0.0005, contextWindow: 2000000, tier: 'cheap' },
  'groq': { inputCost: 0.0001, outputCost: 0.0001, contextWindow: 32000, tier: 'cheap' },
  'openrouter': { inputCost: 0, outputCost: 0, contextWindow: 128000, tier: 'free' },
  'perplexity': { inputCost: 0.001, outputCost: 0.001, contextWindow: 127000, tier: 'moderate' },
  'together': { inputCost: 0.0002, outputCost: 0.0002, contextWindow: 32000, tier: 'cheap' },
  'mistral': { inputCost: 0.0007, outputCost: 0.0007, contextWindow: 32000, tier: 'moderate' },
  'cohere': { inputCost: 0.0015, outputCost: 0.0015, contextWindow: 128000, tier: 'moderate' },
  // Additional cloud providers
  'nvidia-nim': { inputCost: 0.0003, outputCost: 0.0003, contextWindow: 128000, tier: 'cheap' },
  'fireworks': { inputCost: 0.0002, outputCost: 0.0002, contextWindow: 128000, tier: 'cheap' },
  'replicate': { inputCost: 0.0005, outputCost: 0.0005, contextWindow: 8192, tier: 'moderate' },
  'deepseek': { inputCost: 0.00014, outputCost: 0.00028, contextWindow: 128000, tier: 'cheap' },
  'xai': { inputCost: 0.005, outputCost: 0.015, contextWindow: 131072, tier: 'expensive' },
  'ai21': { inputCost: 0.0002, outputCost: 0.0004, contextWindow: 256000, tier: 'cheap' },
  'cerebras': { inputCost: 0.0001, outputCost: 0.0001, contextWindow: 8192, tier: 'cheap' },
  'sambanova': { inputCost: 0.0001, outputCost: 0.0001, contextWindow: 8192, tier: 'cheap' },
  'lepton': { inputCost: 0.0002, outputCost: 0.0002, contextWindow: 8192, tier: 'cheap' },
  // CLI tools (subscription-based, effectively free per-call)
  'claude-cli': { inputCost: 0, outputCost: 0, contextWindow: 200000, tier: 'free' },
  'gemini-cli': { inputCost: 0, outputCost: 0, contextWindow: 2000000, tier: 'free' },
  'aider': { inputCost: 0, outputCost: 0, contextWindow: 128000, tier: 'free' },
};

// ============================================================================
// Smart Router
// ============================================================================

export class SmartLLMRouter {
  private hub: LLMProviderHub;
  private policy: RoutingPolicy;
  private metrics: Map<LLMProvider, ProviderMetrics> = new Map();
  private budget: BudgetTracker;
  private keyRotation: Map<LLMProvider, number> = new Map(); // Current key index per provider

  constructor(hub: LLMProviderHub, policy: Partial<RoutingPolicy> = {}) {
    this.hub = hub;
    this.policy = this.mergeWithDefaults(policy);
    this.budget = {
      dailySpent: 0,
      monthlySpent: 0,
      lastReset: Date.now(),
      perProviderSpent: {} as Record<LLMProvider, number>,
    };
    this.initializeMetrics();
  }

  private mergeWithDefaults(policy: Partial<RoutingPolicy>): RoutingPolicy {
    return {
      taskTypePreferences: policy.taskTypePreferences || {
        'simple': ['ollama', 'openrouter', 'groq', 'openai'],
        'complex': ['anthropic', 'openai', 'google', 'openrouter'],
        'creative': ['anthropic', 'openai', 'mistral', 'openrouter'],
        'long-context': ['google', 'anthropic', 'openai'],
        'embedding': ['ollama', 'openai', 'cohere'],
      },
      maxCostPerRequest: policy.maxCostPerRequest,
      preferFreeTier: policy.preferFreeTier ?? true,
      costTierOrder: policy.costTierOrder || ['free', 'cheap', 'moderate', 'expensive'],
      maxLatency: policy.maxLatency,
      preferLocal: policy.preferLocal ?? true,
      minContextWindow: policy.minContextWindow,
      enableLoadBalancing: policy.enableLoadBalancing ?? true,
      apiKeys: policy.apiKeys || {} as Record<LLMProvider, string[]>,
      enableFailover: policy.enableFailover ?? true,
      maxRetries: policy.maxRetries || 3,
      retryDelay: policy.retryDelay || 1000,
      dailyBudget: policy.dailyBudget,
      monthlyBudget: policy.monthlyBudget,
    };
  }

  private initializeMetrics(): void {
    for (const provider of Object.keys(PROVIDER_COSTS) as LLMProvider[]) {
      const cost = PROVIDER_COSTS[provider];
      this.metrics.set(provider, {
        provider,
        successRate: 1.0,
        averageLatency: provider === 'ollama' ? 100 : 500,
        currentLoad: 0,
        rateLimitRemaining: 1000,
        costPerToken: (cost.inputCost + cost.outputCost) / 2,
        contextWindow: cost.contextWindow,
        isAvailable: true,
      });
      this.keyRotation.set(provider, 0);
    }
  }

  // ---------------------------------------------------------------------------
  // Main Routing Logic
  // ---------------------------------------------------------------------------

  async route(request: LLMRequest, taskType: TaskType = 'simple'): Promise<LLMResponse> {
    this.resetBudgetIfNeeded();

    const decision = this.makeRoutingDecision(request, taskType);
    console.log(`[SmartRouter] Routing to ${decision.provider}: ${decision.reason}`);

    // Try primary provider
    try {
      const response = await this.callProvider(decision.provider, request);
      this.updateMetrics(decision.provider, true, response.latencyMs || 0);
      this.trackCost(decision.provider, decision.estimatedCost);
      return response;
    } catch (error) {
      console.error(`[SmartRouter] ${decision.provider} failed:`, error);
      this.updateMetrics(decision.provider, false, 0, error instanceof Error ? error.message : 'Unknown error');

      // Try fallback chain
      if (this.policy.enableFailover) {
        for (const fallbackProvider of decision.fallbackChain) {
          console.log(`[SmartRouter] Trying fallback: ${fallbackProvider}`);
          try {
            await this.sleep(this.policy.retryDelay);
            const response = await this.callProvider(fallbackProvider, request);
            this.updateMetrics(fallbackProvider, true, response.latencyMs || 0);
            this.trackCost(fallbackProvider, this.estimateCost(fallbackProvider, request));
            return response;
          } catch (fallbackError) {
            console.error(`[SmartRouter] Fallback ${fallbackProvider} failed:`, fallbackError);
            this.updateMetrics(fallbackProvider, false, 0, fallbackError instanceof Error ? fallbackError.message : 'Unknown error');
          }
        }
      }

      throw new Error(`All providers failed. Last error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  makeRoutingDecision(request: LLMRequest, taskType: TaskType): RoutingDecision {
    // Get candidate providers for this task type
    let candidates = this.policy.taskTypePreferences[taskType] || [];

    // Filter by context window requirements
    if (this.policy.minContextWindow) {
      candidates = candidates.filter(p => {
        const metrics = this.metrics.get(p);
        return metrics && metrics.contextWindow >= (this.policy.minContextWindow || 0);
      });
    }

    // Filter by cost tier if preferring free tier
    if (this.policy.preferFreeTier) {
      candidates = this.sortByCostTier(candidates);
    }

    // Filter by availability
    candidates = candidates.filter(p => {
      const metrics = this.metrics.get(p);
      return metrics && metrics.isAvailable && metrics.rateLimitRemaining > 0;
    });

    // Check budget constraints
    candidates = candidates.filter(p => {
      const estimatedCost = this.estimateCost(p, request);
      return this.canAfford(estimatedCost);
    });

    // Prefer local if policy says so
    if (this.policy.preferLocal && candidates.includes('ollama')) {
      const ollamaMetrics = this.metrics.get('ollama');
      if (ollamaMetrics && ollamaMetrics.isAvailable) {
        return {
          provider: 'ollama',
          reason: 'Local provider preferred',
          estimatedCost: 0,
          estimatedLatency: ollamaMetrics.averageLatency,
          fallbackChain: candidates.filter(p => p !== 'ollama'),
        };
      }
    }

    // Sort by latency if max latency is set
    if (this.policy.maxLatency) {
      candidates.sort((a, b) => {
        const aMetrics = this.metrics.get(a)!;
        const bMetrics = this.metrics.get(b)!;
        return aMetrics.averageLatency - bMetrics.averageLatency;
      });
    }

    // Load balancing: pick provider with lowest current load
    if (this.policy.enableLoadBalancing) {
      candidates.sort((a, b) => {
        const aMetrics = this.metrics.get(a)!;
        const bMetrics = this.metrics.get(b)!;
        return aMetrics.currentLoad - bMetrics.currentLoad;
      });
    }

    if (candidates.length === 0) {
      throw new Error('No suitable provider found for request');
    }

    const selectedProvider = candidates[0];
    const metrics = this.metrics.get(selectedProvider)!;

    return {
      provider: selectedProvider,
      reason: this.buildReason(selectedProvider, taskType),
      estimatedCost: this.estimateCost(selectedProvider, request),
      estimatedLatency: metrics.averageLatency,
      fallbackChain: candidates.slice(1),
    };
  }

  // ---------------------------------------------------------------------------
  // Provider Interaction
  // ---------------------------------------------------------------------------

  private async callProvider(provider: LLMProvider, request: LLMRequest): Promise<LLMResponse> {
    // Get API key (with rotation if multiple keys available)
    const apiKey = this.getNextApiKey(provider);
    
    // If we have a rotated API key, temporarily update the provider config
    if (apiKey) {
      const config = this.hub.getConfig(provider);
      if (config) {
        // Store original key and set rotated key
        const originalKey = config.apiKey;
        config.apiKey = apiKey;
        
        try {
          // Call the hub's chat method which handles provider-specific logic
          const response = await this.hub.chat({
            ...request,
            task: 'general', // Use the task from request or default
          });
          return response;
        } finally {
          // Restore original key
          config.apiKey = originalKey;
        }
      }
    }
    
    // Call the hub's chat method which handles provider-specific logic
    const response = await this.hub.chat({
      ...request,
      task: 'general',
    });
    
    return response;
  }

  private getNextApiKey(provider: LLMProvider): string | undefined {
    const keys = this.policy.apiKeys[provider];
    if (!keys || keys.length === 0) return undefined;

    const currentIndex = this.keyRotation.get(provider) || 0;
    const key = keys[currentIndex];
    
    // Rotate to next key
    this.keyRotation.set(provider, (currentIndex + 1) % keys.length);
    
    return key;
  }

  // ---------------------------------------------------------------------------
  // Metrics & Tracking
  // ---------------------------------------------------------------------------

  private updateMetrics(
    provider: LLMProvider,
    success: boolean,
    latency: number,
    error?: string
  ): void {
    const metrics = this.metrics.get(provider);
    if (!metrics) return;

    // Update success rate (exponential moving average)
    const alpha = 0.1;
    metrics.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * metrics.successRate;

    // Update average latency
    if (success && latency > 0) {
      metrics.averageLatency = alpha * latency + (1 - alpha) * metrics.averageLatency;
    }

    // Update availability
    metrics.isAvailable = success || metrics.successRate > 0.5;

    if (!success && error) {
      metrics.lastError = error;
      metrics.lastErrorTime = Date.now();
    }

    this.metrics.set(provider, metrics);
  }

  private trackCost(provider: LLMProvider, cost: number): void {
    this.budget.dailySpent += cost;
    this.budget.monthlySpent += cost;
    this.budget.perProviderSpent[provider] = (this.budget.perProviderSpent[provider] || 0) + cost;
  }

  private estimateCost(provider: LLMProvider, request: LLMRequest): number {
    const costs = PROVIDER_COSTS[provider];
    if (!costs) return 0;

    // Estimate token count (rough: 4 chars per token)
    const inputTokens = JSON.stringify(request.messages).length / 4;
    const outputTokens = (request.maxTokens || 1000);

    return (inputTokens * costs.inputCost + outputTokens * costs.outputCost) / 1000;
  }

  private canAfford(cost: number): boolean {
    if (this.policy.maxCostPerRequest && cost > this.policy.maxCostPerRequest) {
      return false;
    }
    if (this.policy.dailyBudget && this.budget.dailySpent + cost > this.policy.dailyBudget) {
      return false;
    }
    if (this.policy.monthlyBudget && this.budget.monthlySpent + cost > this.policy.monthlyBudget) {
      return false;
    }
    return true;
  }

  private resetBudgetIfNeeded(): void {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const monthMs = 30 * dayMs;

    if (now - this.budget.lastReset > dayMs) {
      this.budget.dailySpent = 0;
    }
    if (now - this.budget.lastReset > monthMs) {
      this.budget.monthlySpent = 0;
      this.budget.lastReset = now;
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private sortByCostTier(providers: LLMProvider[]): LLMProvider[] {
    const tierOrder = this.policy.costTierOrder;
    return providers.sort((a, b) => {
      const aTier = PROVIDER_COSTS[a]?.tier || 'expensive';
      const bTier = PROVIDER_COSTS[b]?.tier || 'expensive';
      return tierOrder.indexOf(aTier) - tierOrder.indexOf(bTier);
    });
  }

  private buildReason(provider: LLMProvider, taskType: TaskType): string {
    const metrics = this.metrics.get(provider);
    const cost = PROVIDER_COSTS[provider];
    
    const reasons: string[] = [];
    reasons.push(`Task type: ${taskType}`);
    reasons.push(`Cost tier: ${cost?.tier || 'unknown'}`);
    if (metrics) {
      reasons.push(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
      reasons.push(`Avg latency: ${metrics.averageLatency.toFixed(0)}ms`);
    }
    
    return reasons.join(', ');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getMetrics(): Map<LLMProvider, ProviderMetrics> {
    return new Map(this.metrics);
  }

  getBudget(): BudgetTracker {
    return { ...this.budget };
  }

  updatePolicy(policy: Partial<RoutingPolicy>): void {
    this.policy = this.mergeWithDefaults({ ...this.policy, ...policy });
  }
}
