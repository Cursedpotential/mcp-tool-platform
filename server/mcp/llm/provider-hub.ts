/**
 * LLM Provider Hub
 * 
 * Unified interface for ALL LLM providers with smart routing,
 * fallback chains, and cost tracking.
 * 
 * Supports:
 * - Local: Ollama, LM Studio, llama.cpp
 * - Cloud APIs: OpenAI, Anthropic, Google, Groq, Perplexity, OpenRouter, Together, Mistral, Cohere
 * - CLI Tools: Claude Code, Gemini CLI, aider
 */

import { spawn } from 'child_process';

// ============================================================================
// Types
// ============================================================================

export type ProviderType = 
  // Local
  | 'ollama'
  | 'lmstudio'
  | 'llamacpp'
  // Cloud APIs
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'perplexity'
  | 'openrouter'
  | 'together'
  | 'mistral'
  | 'cohere'
  // CLI Tools
  | 'claude-cli'
  | 'gemini-cli'
  | 'aider';

export type TaskComplexity = 'simple' | 'medium' | 'complex';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  task?: string; // For smart routing
  complexity?: TaskComplexity;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: ProviderType;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  latencyMs: number;
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  provider: ProviderType;
  dimensions: number;
  tokensUsed?: number;
}

export interface ProviderConfig {
  type: ProviderType;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  embeddingModel?: string;
  priority: number; // Lower = higher priority
  maxTokens?: number;
  costPer1kTokens?: { input: number; output: number };
  rateLimit?: { requestsPerMinute: number; tokensPerMinute: number };
  capabilities: {
    chat: boolean;
    embeddings: boolean;
    streaming: boolean;
    functionCalling: boolean;
  };
}

export interface ProviderStats {
  provider: ProviderType;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  lastUsed?: number;
  lastError?: string;
}

// ============================================================================
// Default Provider Configurations
// ============================================================================

const DEFAULT_CONFIGS: Record<ProviderType, Partial<ProviderConfig>> = {
  // Local Providers (Free, CPU-friendly)
  ollama: {
    type: 'ollama',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'qwen2.5:3b', // CPU-friendly
    embeddingModel: 'nomic-embed-text',
    priority: 1, // Highest priority (try first)
    capabilities: { chat: true, embeddings: true, streaming: true, functionCalling: false },
  },
  lmstudio: {
    type: 'lmstudio',
    baseUrl: 'http://localhost:1234/v1',
    priority: 2,
    capabilities: { chat: true, embeddings: true, streaming: true, functionCalling: false },
  },
  llamacpp: {
    type: 'llamacpp',
    baseUrl: 'http://localhost:8080',
    priority: 3,
    capabilities: { chat: true, embeddings: true, streaming: true, functionCalling: false },
  },

  // Cloud APIs (Paid, more capable)
  groq: {
    type: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-8b-instant', // Fast and cheap
    priority: 10,
    costPer1kTokens: { input: 0.00005, output: 0.00008 },
    capabilities: { chat: true, embeddings: false, streaming: true, functionCalling: true },
  },
  openrouter: {
    type: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
    priority: 11,
    capabilities: { chat: true, embeddings: false, streaming: true, functionCalling: true },
  },
  google: {
    type: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-1.5-flash',
    priority: 12,
    costPer1kTokens: { input: 0.000075, output: 0.0003 },
    capabilities: { chat: true, embeddings: true, streaming: true, functionCalling: true },
  },
  anthropic: {
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-haiku-20240307',
    priority: 13,
    costPer1kTokens: { input: 0.00025, output: 0.00125 },
    capabilities: { chat: true, embeddings: false, streaming: true, functionCalling: true },
  },
  openai: {
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    embeddingModel: 'text-embedding-3-small',
    priority: 14,
    costPer1kTokens: { input: 0.00015, output: 0.0006 },
    capabilities: { chat: true, embeddings: true, streaming: true, functionCalling: true },
  },
  perplexity: {
    type: 'perplexity',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'llama-3.1-sonar-small-128k-online',
    priority: 15,
    costPer1kTokens: { input: 0.0002, output: 0.0002 },
    capabilities: { chat: true, embeddings: false, streaming: true, functionCalling: false },
  },
  together: {
    type: 'together',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3-8b-chat-hf',
    priority: 16,
    costPer1kTokens: { input: 0.0002, output: 0.0002 },
    capabilities: { chat: true, embeddings: true, streaming: true, functionCalling: false },
  },
  mistral: {
    type: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    priority: 17,
    costPer1kTokens: { input: 0.001, output: 0.003 },
    capabilities: { chat: true, embeddings: true, streaming: true, functionCalling: true },
  },
  cohere: {
    type: 'cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    defaultModel: 'command-r',
    embeddingModel: 'embed-english-v3.0',
    priority: 18,
    costPer1kTokens: { input: 0.0005, output: 0.0015 },
    capabilities: { chat: true, embeddings: true, streaming: true, functionCalling: false },
  },

  // CLI Tools (Use your subscriptions)
  'claude-cli': {
    type: 'claude-cli',
    priority: 20,
    capabilities: { chat: true, embeddings: false, streaming: false, functionCalling: false },
  },
  'gemini-cli': {
    type: 'gemini-cli',
    priority: 21,
    capabilities: { chat: true, embeddings: false, streaming: false, functionCalling: false },
  },
  aider: {
    type: 'aider',
    priority: 22,
    capabilities: { chat: true, embeddings: false, streaming: false, functionCalling: false },
  },
};

// ============================================================================
// Task Routing Configuration
// ============================================================================

interface TaskRoute {
  tasks: string[];
  complexity: TaskComplexity;
  preferredProviders: ProviderType[];
}

const TASK_ROUTES: TaskRoute[] = [
  // Simple tasks → Local first
  {
    tasks: ['sentiment', 'keywords', 'language_detect', 'classify'],
    complexity: 'simple',
    preferredProviders: ['ollama', 'lmstudio', 'groq', 'openrouter'],
  },
  // Medium tasks → Local or cheap cloud
  {
    tasks: ['summarize_short', 'extract_entities', 'rewrite', 'translate'],
    complexity: 'medium',
    preferredProviders: ['ollama', 'groq', 'openrouter', 'google'],
  },
  // Complex tasks → Cloud APIs
  {
    tasks: ['summarize_long', 'analyze', 'generate', 'code', 'reason'],
    complexity: 'complex',
    preferredProviders: ['anthropic', 'openai', 'google', 'claude-cli', 'gemini-cli'],
  },
  // Embeddings → Local preferred
  {
    tasks: ['embed'],
    complexity: 'simple',
    preferredProviders: ['ollama', 'openai', 'cohere', 'together'],
  },
];

// ============================================================================
// Provider Hub Class
// ============================================================================

class LLMProviderHub {
  private configs: Map<ProviderType, ProviderConfig> = new Map();
  private stats: Map<ProviderType, ProviderStats> = new Map();
  private availableProviders: Set<ProviderType> = new Set();

  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    for (const [type, config] of Object.entries(DEFAULT_CONFIGS)) {
      this.configs.set(type as ProviderType, {
        ...config,
        type: type as ProviderType,
        enabled: false, // Disabled by default until configured
      } as ProviderConfig);

      this.stats.set(type as ProviderType, {
        provider: type as ProviderType,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalTokens: 0,
        totalCost: 0,
        avgLatencyMs: 0,
      });
    }
  }

  /**
   * Configure a provider with API key and settings
   */
  configureProvider(type: ProviderType, config: Partial<ProviderConfig>): void {
    const existing = this.configs.get(type) || DEFAULT_CONFIGS[type];
    this.configs.set(type, {
      ...existing,
      ...config,
      type,
      enabled: true,
    } as ProviderConfig);
  }

  /**
   * Check which providers are available (installed/configured)
   */
  async detectAvailableProviders(): Promise<ProviderType[]> {
    const available: ProviderType[] = [];

    // Check Ollama
    if (await this.checkOllama()) {
      available.push('ollama');
      this.availableProviders.add('ollama');
    }

    // Check LM Studio
    if (await this.checkLMStudio()) {
      available.push('lmstudio');
      this.availableProviders.add('lmstudio');
    }

    // Check CLI tools
    if (await this.checkCLI('claude')) {
      available.push('claude-cli');
      this.availableProviders.add('claude-cli');
    }
    if (await this.checkCLI('gemini')) {
      available.push('gemini-cli');
      this.availableProviders.add('gemini-cli');
    }
    if (await this.checkCLI('aider')) {
      available.push('aider');
      this.availableProviders.add('aider');
    }

    // Cloud APIs are available if API key is set
    for (const [type, cfg] of Array.from(this.configs.entries())) {
      if (cfg.apiKey && cfg.enabled) {
        available.push(type);
        this.availableProviders.add(type);
      }
    }

    return available;
  }

  private async checkOllama(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkLMStudio(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkCLI(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('which', [command], { timeout: 2000 });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /**
   * Get the best provider for a task based on routing rules
   */
  getProviderForTask(task: string, complexity?: TaskComplexity): ProviderType | null {
    // Find matching route
    const route = TASK_ROUTES.find(r => 
      r.tasks.includes(task) || (complexity && r.complexity === complexity)
    );

    const preferredOrder = route?.preferredProviders || 
      Array.from(this.configs.entries())
        .filter(([, c]) => c.enabled)
        .sort((a, b) => a[1].priority - b[1].priority)
        .map(([type]) => type);

    // Return first available provider
    for (const provider of preferredOrder) {
      if (this.availableProviders.has(provider) || this.configs.get(provider)?.enabled) {
        return provider;
      }
    }

    return null;
  }

  /**
   * Make a chat completion request with automatic routing and fallback
   */
  async chat(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Determine provider
    const provider = request.task 
      ? this.getProviderForTask(request.task, request.complexity)
      : this.getProviderForTask('general', 'medium');

    if (!provider) {
      throw new Error('No LLM provider available. Please configure at least one provider.');
    }

    const config = this.configs.get(provider)!;
    
    try {
      let response: LLMResponse;

      switch (provider) {
        case 'ollama':
          response = await this.chatOllama(request, config);
          break;
        case 'lmstudio':
        case 'openai':
        case 'groq':
        case 'openrouter':
        case 'together':
        case 'mistral':
          response = await this.chatOpenAICompatible(request, config);
          break;
        case 'anthropic':
          response = await this.chatAnthropic(request, config);
          break;
        case 'google':
          response = await this.chatGoogle(request, config);
          break;
        case 'claude-cli':
          response = await this.chatClaudeCLI(request);
          break;
        case 'gemini-cli':
          response = await this.chatGeminiCLI(request);
          break;
        default:
          throw new Error(`Provider ${provider} not implemented`);
      }

      // Update stats
      this.updateStats(provider, true, response.tokensUsed?.total || 0, response.cost || 0, Date.now() - startTime);
      
      return response;
    } catch (error) {
      // Update stats for failure
      this.updateStats(provider, false, 0, 0, Date.now() - startTime, error instanceof Error ? error.message : 'Unknown error');
      
      // Try fallback
      const fallback = this.getNextProvider(provider);
      if (fallback) {
        console.warn(`Provider ${provider} failed, falling back to ${fallback}`);
        return this.chat({ ...request, task: undefined }); // Retry without task routing
      }
      
      throw error;
    }
  }

  private getNextProvider(current: ProviderType): ProviderType | null {
    const currentPriority = this.configs.get(current)?.priority || 999;
    
    const next = Array.from(this.configs.entries())
      .filter(([type, config]) => 
        config.enabled && 
        config.priority > currentPriority &&
        this.availableProviders.has(type)
      )
      .sort((a, b) => a[1].priority - b[1].priority)[0];

    return next?.[0] || null;
  }

  // ============================================================================
  // Provider-Specific Implementations
  // ============================================================================

  private async chatOllama(request: LLMRequest, config: ProviderConfig): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = request.model || config.defaultModel || 'qwen2.5:3b';

    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens ?? 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.message?.content || '',
      model,
      provider: 'ollama',
      tokensUsed: {
        prompt: data.prompt_eval_count || 0,
        completion: data.eval_count || 0,
        total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      cost: 0, // Local = free
      latencyMs: Date.now() - startTime,
    };
  }

  private async chatOpenAICompatible(request: LLMRequest, config: ProviderConfig): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = request.model || config.defaultModel || 'gpt-4o-mini';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    // OpenRouter needs extra headers
    if (config.type === 'openrouter') {
      headers['HTTP-Referer'] = 'https://mcp-tool-platform.local';
      headers['X-Title'] = 'MCP Tool Platform';
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${config.type} error: ${error}`);
    }

    const data = await response.json();
    const usage = data.usage || {};
    
    // Calculate cost
    const cost = config.costPer1kTokens 
      ? (usage.prompt_tokens || 0) * config.costPer1kTokens.input / 1000 +
        (usage.completion_tokens || 0) * config.costPer1kTokens.output / 1000
      : 0;

    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || model,
      provider: config.type,
      tokensUsed: {
        prompt: usage.prompt_tokens || 0,
        completion: usage.completion_tokens || 0,
        total: usage.total_tokens || 0,
      },
      cost,
      latencyMs: Date.now() - startTime,
    };
  }

  private async chatAnthropic(request: LLMRequest, config: ProviderConfig): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = request.model || config.defaultModel || 'claude-3-haiku-20240307';

    // Convert messages format for Anthropic
    const systemMessage = request.messages.find(m => m.role === 'system')?.content || '';
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    const response = await fetch(`${config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 2048,
        system: systemMessage,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic error: ${error}`);
    }

    const data = await response.json();
    const usage = data.usage || {};
    
    const cost = config.costPer1kTokens 
      ? (usage.input_tokens || 0) * config.costPer1kTokens.input / 1000 +
        (usage.output_tokens || 0) * config.costPer1kTokens.output / 1000
      : 0;

    return {
      content: data.content?.[0]?.text || '',
      model: data.model || model,
      provider: 'anthropic',
      tokensUsed: {
        prompt: usage.input_tokens || 0,
        completion: usage.output_tokens || 0,
        total: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      },
      cost,
      latencyMs: Date.now() - startTime,
    };
  }

  private async chatGoogle(request: LLMRequest, config: ProviderConfig): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = request.model || config.defaultModel || 'gemini-1.5-flash';

    // Convert messages to Gemini format
    const contents = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = request.messages.find(m => m.role === 'system')?.content;

    const response = await fetch(
      `${config.baseUrl}/models/${model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens ?? 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google error: ${error}`);
    }

    const data = await response.json();
    const usage = data.usageMetadata || {};
    
    const cost = config.costPer1kTokens 
      ? (usage.promptTokenCount || 0) * config.costPer1kTokens.input / 1000 +
        (usage.candidatesTokenCount || 0) * config.costPer1kTokens.output / 1000
      : 0;

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      model,
      provider: 'google',
      tokensUsed: {
        prompt: usage.promptTokenCount || 0,
        completion: usage.candidatesTokenCount || 0,
        total: usage.totalTokenCount || 0,
      },
      cost,
      latencyMs: Date.now() - startTime,
    };
  }

  private async chatClaudeCLI(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Combine messages into a single prompt
    const prompt = request.messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    return new Promise((resolve, reject) => {
      const proc = spawn('claude', ['-p', prompt], {
        timeout: 120000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            content: stdout.trim(),
            model: 'claude-cli',
            provider: 'claude-cli',
            latencyMs: Date.now() - startTime,
          });
        } else {
          reject(new Error(`Claude CLI error: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Claude CLI not found: ${err.message}`));
      });
    });
  }

  private async chatGeminiCLI(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    const prompt = request.messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    return new Promise((resolve, reject) => {
      const proc = spawn('gemini', ['chat', prompt], {
        timeout: 120000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            content: stdout.trim(),
            model: 'gemini-cli',
            provider: 'gemini-cli',
            latencyMs: Date.now() - startTime,
          });
        } else {
          reject(new Error(`Gemini CLI error: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Gemini CLI not found: ${err.message}`));
      });
    });
  }

  // ============================================================================
  // Embeddings
  // ============================================================================

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const provider = this.getProviderForTask('embed', 'simple');
    
    if (!provider) {
      throw new Error('No embedding provider available');
    }

    const config = this.configs.get(provider)!;

    if (provider === 'ollama') {
      return this.embedOllama(request, config);
    }

    // OpenAI-compatible embedding
    return this.embedOpenAI(request, config);
  }

  private async embedOllama(request: EmbeddingRequest, config: ProviderConfig): Promise<EmbeddingResponse> {
    const model = request.model || config.embeddingModel || 'nomic-embed-text';
    const embeddings: number[][] = [];

    for (const text of request.texts) {
      const response = await fetch(`${config.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embedding error: ${response.statusText}`);
      }

      const data = await response.json();
      embeddings.push(data.embedding);
    }

    return {
      embeddings,
      model,
      provider: 'ollama',
      dimensions: embeddings[0]?.length || 0,
    };
  }

  private async embedOpenAI(request: EmbeddingRequest, config: ProviderConfig): Promise<EmbeddingResponse> {
    const model = request.model || config.embeddingModel || 'text-embedding-3-small';

    const response = await fetch(`${config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: request.texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding error: ${error}`);
    }

    const data = await response.json();
    
    return {
      embeddings: data.data.map((d: { embedding: number[] }) => d.embedding),
      model: data.model || model,
      provider: config.type,
      dimensions: data.data[0]?.embedding?.length || 0,
      tokensUsed: data.usage?.total_tokens,
    };
  }

  // ============================================================================
  // Stats & Management
  // ============================================================================

  private updateStats(
    provider: ProviderType,
    success: boolean,
    tokens: number,
    cost: number,
    latencyMs: number,
    error?: string
  ): void {
    const stats = this.stats.get(provider)!;
    stats.totalCalls++;
    if (success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
      stats.lastError = error;
    }
    stats.totalTokens += tokens;
    stats.totalCost += cost;
    stats.avgLatencyMs = (stats.avgLatencyMs * (stats.totalCalls - 1) + latencyMs) / stats.totalCalls;
    stats.lastUsed = Date.now();
  }

  getStats(): ProviderStats[] {
    return Array.from(this.stats.values());
  }

  getConfig(provider: ProviderType): ProviderConfig | undefined {
    return this.configs.get(provider);
  }

  getAllConfigs(): ProviderConfig[] {
    return Array.from(this.configs.values());
  }

  exportConfig(): Record<string, unknown> {
    const configs: Record<string, unknown> = {};
    for (const [type, cfg] of Array.from(this.configs.entries())) {
      // Don't export API keys
      const { apiKey, ...safeConfig } = cfg;
      configs[type] = { ...safeConfig, hasApiKey: !!apiKey };
    }
    return configs;
  }

  importConfig(config: Record<string, Partial<ProviderConfig>>): void {
    for (const [type, provConfig] of Object.entries(config)) {
      if (this.configs.has(type as ProviderType)) {
        this.configureProvider(type as ProviderType, provConfig);
      }
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let hubInstance: LLMProviderHub | null = null;

export function getLLMHub(): LLMProviderHub {
  if (!hubInstance) {
    hubInstance = new LLMProviderHub();
  }
  return hubInstance;
}

export { LLMProviderHub };
