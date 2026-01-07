/**
 * OpenRouter Free Model Fetcher
 * 
 * Fetches and caches the list of free models from OpenRouter API.
 * Refreshes daily to keep the list up-to-date.
 */

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;  // Cost per token as string (e.g., "0" for free)
    completion: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
}

interface ModelCache {
  models: OpenRouterModel[];
  freeModels: OpenRouterModel[];
  lastFetched: number;
}

// Cache with 24-hour TTL
let modelCache: ModelCache | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch all models from OpenRouter API
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json() as { data: OpenRouterModel[] };
  return data.data || [];
}

/**
 * Filter for free models (pricing.prompt === "0" and pricing.completion === "0")
 */
export function filterFreeModels(models: OpenRouterModel[]): OpenRouterModel[] {
  return models.filter(model => 
    model.pricing.prompt === '0' && model.pricing.completion === '0'
  );
}

/**
 * Get cached models, fetching if cache is stale or empty
 */
export async function getOpenRouterModels(forceRefresh = false): Promise<ModelCache> {
  const now = Date.now();
  
  // Return cached data if valid
  if (modelCache && !forceRefresh && (now - modelCache.lastFetched) < CACHE_TTL_MS) {
    return modelCache;
  }

  try {
    const models = await fetchOpenRouterModels();
    const freeModels = filterFreeModels(models);

    modelCache = {
      models,
      freeModels,
      lastFetched: now,
    };

    console.log(`[OpenRouter] Fetched ${models.length} models, ${freeModels.length} free`);
    return modelCache;
  } catch (error) {
    // If fetch fails and we have cached data, return it
    if (modelCache) {
      console.warn('[OpenRouter] Fetch failed, using cached data:', error);
      return modelCache;
    }
    throw error;
  }
}

/**
 * Get only free models
 */
export async function getFreeModels(forceRefresh = false): Promise<OpenRouterModel[]> {
  const cache = await getOpenRouterModels(forceRefresh);
  return cache.freeModels;
}

/**
 * Get the best free model for a given task type
 */
export async function getBestFreeModel(taskType: 'chat' | 'code' | 'reasoning' | 'general' = 'general'): Promise<OpenRouterModel | null> {
  const freeModels = await getFreeModels();
  
  if (freeModels.length === 0) {
    return null;
  }

  // Sort by context length (larger is better for most tasks)
  const sorted = [...freeModels].sort((a, b) => b.context_length - a.context_length);

  // Task-specific model preferences
  const preferences: Record<string, string[]> = {
    chat: ['llama', 'mistral', 'gemma'],
    code: ['codellama', 'deepseek', 'starcoder', 'llama'],
    reasoning: ['llama', 'mistral', 'qwen'],
    general: ['llama', 'mistral', 'gemma'],
  };

  const preferredKeywords = preferences[taskType] || preferences.general;

  // Find first model matching preferred keywords
  for (const keyword of preferredKeywords) {
    const match = sorted.find(m => m.id.toLowerCase().includes(keyword));
    if (match) {
      return match;
    }
  }

  // Fallback to first model with largest context
  return sorted[0] || null;
}

/**
 * Get model statistics
 */
export async function getModelStats(): Promise<{
  totalModels: number;
  freeModels: number;
  lastUpdated: Date | null;
  topFreeModels: OpenRouterModel[];
}> {
  const cache = await getOpenRouterModels();
  
  // Get top 10 free models by context length
  const topFreeModels = [...cache.freeModels]
    .sort((a, b) => b.context_length - a.context_length)
    .slice(0, 10);

  return {
    totalModels: cache.models.length,
    freeModels: cache.freeModels.length,
    lastUpdated: cache.lastFetched ? new Date(cache.lastFetched) : null,
    topFreeModels,
  };
}

/**
 * Check if a specific model is free
 */
export async function isModelFree(modelId: string): Promise<boolean> {
  const cache = await getOpenRouterModels();
  return cache.freeModels.some(m => m.id === modelId);
}

/**
 * Search models by name or ID
 */
export async function searchModels(query: string, freeOnly = false): Promise<OpenRouterModel[]> {
  const cache = await getOpenRouterModels();
  const models = freeOnly ? cache.freeModels : cache.models;
  
  const lowerQuery = query.toLowerCase();
  return models.filter(m => 
    m.id.toLowerCase().includes(lowerQuery) ||
    m.name.toLowerCase().includes(lowerQuery) ||
    m.description?.toLowerCase().includes(lowerQuery)
  );
}
