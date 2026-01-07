/**
 * Real Embedding Service
 * Integrates with Manus built-in LLM API for production embeddings
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface BatchEmbeddingRequest {
  texts: string[];
  model?: string;
  batch_size?: number;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface BatchEmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
  total_tokens: number;
}

// ============================================================================
// REAL EMBEDDING SERVICE
// ============================================================================

export class RealEmbeddingService {
  private apiUrl: string;
  private apiKey: string;
  private model: string;
  private maxRetries: number;
  private retryDelay: number;
  
  constructor(
    model: string = 'text-embedding-3-small',
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    this.apiUrl = process.env.BUILT_IN_FORGE_API_URL || '';
    this.apiKey = process.env.BUILT_IN_FORGE_API_KEY || '';
    this.model = model;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    
    if (!this.apiUrl || !this.apiKey) {
      console.warn('[RealEmbeddingService] API credentials not configured');
    }
  }
  
  /**
   * Generate embedding for single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }
    
    console.log(`[RealEmbeddingService] Generating embedding (${text.length} chars)`);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.apiUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: text,
            model: this.model
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // Handle OpenAI-style response
        if (data.data && Array.isArray(data.data) && data.data[0]?.embedding) {
          return data.data[0].embedding;
        }
        
        // Handle direct embedding response
        if (data.embedding && Array.isArray(data.embedding)) {
          return data.embedding;
        }
        
        throw new Error('Invalid response format');
      } catch (error: any) {
        console.error(`[RealEmbeddingService] Attempt ${attempt}/${this.maxRetries} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        } else {
          throw new Error(`Failed after ${this.maxRetries} attempts: ${error.message}`);
        }
      }
    }
    
    throw new Error('Unexpected error in generateEmbedding');
  }
  
  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(
    texts: string[],
    batchSize: number = 100
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    
    console.log(`[RealEmbeddingService] Generating ${texts.length} embeddings (batch size: ${batchSize})`);
    
    const embeddings: number[][] = [];
    
    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`[RealEmbeddingService] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
      
      try {
        const batchEmbeddings = await this.generateBatch(batch);
        embeddings.push(...batchEmbeddings);
      } catch (error: any) {
        console.error(`[RealEmbeddingService] Batch failed, falling back to sequential:`, error.message);
        
        // Fallback to sequential processing
        for (const text of batch) {
          try {
            const embedding = await this.generateEmbedding(text);
            embeddings.push(embedding);
          } catch (seqError: any) {
            console.error(`[RealEmbeddingService] Sequential embedding failed:`, seqError.message);
            // Push zero vector as placeholder
            embeddings.push(Array(1536).fill(0));
          }
        }
      }
    }
    
    return embeddings;
  }
  
  /**
   * Generate embeddings for a batch (internal)
   */
  private async generateBatch(texts: string[]): Promise<number[][]> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.apiUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: texts,
            model: this.model
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // Handle OpenAI-style response
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((item: any) => item.embedding);
        }
        
        // Handle direct embeddings response
        if (data.embeddings && Array.isArray(data.embeddings)) {
          return data.embeddings;
        }
        
        throw new Error('Invalid batch response format');
      } catch (error: any) {
        console.error(`[RealEmbeddingService] Batch attempt ${attempt}/${this.maxRetries} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Unexpected error in generateBatch');
  }
  
  /**
   * Generate embeddings with parallel requests
   */
  async generateEmbeddingsParallel(
    texts: string[],
    concurrency: number = 10
  ): Promise<number[][]> {
    console.log(`[RealEmbeddingService] Generating ${texts.length} embeddings (parallel, concurrency: ${concurrency})`);
    
    const embeddings: number[][] = new Array(texts.length);
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < texts.length; i++) {
      const promise = (async (index: number) => {
        try {
          embeddings[index] = await this.generateEmbedding(texts[index]);
        } catch (error: any) {
          console.error(`[RealEmbeddingService] Parallel embedding ${index} failed:`, error.message);
          embeddings[index] = Array(1536).fill(0); // Zero vector fallback
        }
      })(i);
      
      promises.push(promise);
      
      // Limit concurrency
      if (promises.length >= concurrency) {
        await Promise.race(promises);
        promises.splice(promises.findIndex(p => p === undefined), 1);
      }
    }
    
    // Wait for remaining
    await Promise.all(promises);
    
    return embeddings;
  }
  
  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get embedding dimensions for current model
   */
  getDimensions(): number {
    const dimensions: Record<string, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536
    };
    
    return dimensions[this.model] || 1536;
  }
}

// ============================================================================
// EMBEDDING CACHE
// ============================================================================

/**
 * Cache embeddings to avoid duplicate API calls
 */
export class EmbeddingCache {
  private cache: Map<string, number[]>;
  private maxSize: number;
  
  constructor(maxSize: number = 10000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  /**
   * Get embedding from cache
   */
  get(text: string): number[] | undefined {
    const key = this.hashText(text);
    return this.cache.get(key);
  }
  
  /**
   * Store embedding in cache
   */
  set(text: string, embedding: number[]): void {
    const key = this.hashText(text);
    
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, embedding);
  }
  
  /**
   * Check if text is in cache
   */
  has(text: string): boolean {
    return this.cache.has(this.hashText(text));
  }
  
  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // Would need hit/miss tracking
    };
  }
  
  /**
   * Hash text for cache key
   */
  private hashText(text: string): string {
    // Simple hash - in production use crypto.createHash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// ============================================================================
// CACHED EMBEDDING SERVICE
// ============================================================================

/**
 * Embedding service with caching
 */
export class CachedEmbeddingService extends RealEmbeddingService {
  private cache: EmbeddingCache;
  
  constructor(model?: string, maxRetries?: number, retryDelay?: number, cacheSize?: number) {
    super(model || 'text-embedding-3-small', maxRetries, retryDelay);
    this.cache = new EmbeddingCache(cacheSize);
  }
  
  /**
   * Generate embedding with cache
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cached = this.cache.get(text);
    if (cached) {
      console.log('[CachedEmbeddingService] Cache hit');
      return cached;
    }
    
    // Generate and cache
    const embedding = await super.generateEmbedding(text);
    this.cache.set(text, embedding);
    
    return embedding;
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Singleton instances
export const realEmbeddingService = new RealEmbeddingService();
export const cachedEmbeddingService = new CachedEmbeddingService();
