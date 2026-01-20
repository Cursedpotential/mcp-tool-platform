// File: server/core/router.ts | Date: 2026-01-11 | Agent: Groq Llama 3.3 70B | Model: Opus 4.1
/**
 * Intelligent Routing Layer
 *
 * Routes requests to the optimal service based on availability and requirements:
 * 1. Manus built-in APIs (fastest, free)
 * 2. Docker VPS services (LiteLLM, Neo4j, Chroma, etc.)
 * 3. External APIs (direct to OpenAI, Anthropic, etc.)
 * 4. Databases (Supabase, Neo4j Aura)
 */

import { getPluginRegistry } from "../mcp/plugins/registry";
import { getMCPProxy } from "../mcp/proxy/mcp-proxy";

// ============================================================================
// Type Definitions
// ============================================================================

interface LLMRequest {
  provider?: string;
  endpoint?: string;
  apiKey?: string;
  model: string;
  messages: any[];
}

interface LLMProvider {
  type: "built-in" | string;
  endpoint: string;
  apiKey?: string;
}

interface MCPEndpoint {
  type: "local" | "remote";
  handler?: Function;
  serverId?: string;
  endpoint?: string;
}

interface VectorSearchRequest {
  collection: string;
  query: string;
  topK?: number;
}

interface VectorDBEndpoint {
  type: "chroma" | "qdrant";
  url: string;
  apiKey?: string;
  collection: string;
}

interface StorageRequest {
  filename: string;
  size: number;
  contentType: string;
}

interface StorageEndpoint {
  type: "s3" | "r2";
  endpoint: string;
  apiKey?: string;
  bucket: string;
}

interface HealthStatus {
  services: Array<{
    name: string;
    status: "healthy" | "unhealthy" | "unreachable" | "disabled";
    latency: number;
    error?: string;
  }>;
  timestamp: Date;
}

interface TimeRange {
  start: Date;
  end: Date;
}

interface CostMetrics {
  totalCost: number;
  totalTokens: number;
  breakdown: Array<{
    provider: string;
    model: string;
    cost: number;
    tokens: number;
  }>;
}

// ============================================================================
// LLM Router
// ============================================================================

/**
 * Route LLM request to optimal service
 * Priority: Manus built-in > LiteLLM (VPS) > Direct API
 */
export async function routeLLM(request: LLMRequest): Promise<LLMProvider> {
  try {
    if (process.env.BUILT_IN_FORGE_API_URL) {
      return {
        type: "built-in",
        endpoint: process.env.BUILT_IN_FORGE_API_URL,
        apiKey: process.env.BUILT_IN_FORGE_API_KEY,
      };
    }

    // Route to user provider (OpenAI, Anthropic, etc.)
    return {
      type: request.provider || "openai",
      endpoint: request.endpoint || "https://api.openai.com/v1",
      apiKey: request.apiKey,
    };
  } catch (error) {
    console.error("Error routing LLM request:", error);
    return {
      type: "openai",
      endpoint: "https://api.openai.com/v1",
      apiKey: "",
    };
  }
}

// ============================================================================
// MCP Tool Router
// ============================================================================

/**
 * Route MCP tool execution to optimal server
 * Priority: Local MCP gateway > MetaMCP (VPS) > Direct server
 */
export async function routeMCPTool(toolName: string): Promise<MCPEndpoint> {
  try {
    const registry = await getPluginRegistry();
    const localTool = registry.getTool(toolName);

    if (localTool) {
      return {
        type: "local",
        // Handler would be looked up separately from the registry
      };
    }

    // Check remote MCP servers
    const proxy = getMCPProxy();
    const remoteTool = proxy.getToolSpec(toolName);

    if (remoteTool) {
      return {
        type: "remote",
        // serverId and endpoint are looked up by the proxy when calling the tool
      };
    }

    return {
      type: "local",
      handler: () => {
        throw new Error(`Tool not found: ${toolName}`);
      },
    };
  } catch (error) {
    console.error("Error routing MCP tool:", error);
    return {
      type: "local",
      handler: () => {
        throw new Error(`Tool not found: ${toolName}`);
      },
    };
  }
}

// ============================================================================
// Vector Database Router
// ============================================================================

/**
 * Route vector search to optimal database
 * Priority: Chroma (in-process) for TTL > Chroma (VPS) for persistent > Supabase pgvector
 */
export async function routeVectorSearch(
  query: VectorSearchRequest
): Promise<VectorDBEndpoint> {
  try {
    // If QDRANT_URL is set and enabled, use Qdrant for persistent storage
    if (process.env.QDRANT_URL && process.env.ENABLE_VECTOR_DB === "true") {
      return {
        type: "qdrant",
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
        collection: `${process.env.QDRANT_COLLECTION_PREFIX || "mcp_"}${query.collection}`,
      };
    }

    // Otherwise use Chroma (in-process or local server)
    const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
    return {
      type: "chroma",
      url: chromaUrl,
      collection: query.collection,
    };
  } catch (error) {
    console.error("Error routing vector search:", error);
    return {
      type: "chroma",
      url: "http://localhost:8000",
      collection: query.collection,
    };
  }
}

// ============================================================================
// Storage Router
// ============================================================================

/**
 * Route storage upload to optimal service
 * Priority: Manus built-in > R2 (via Directus) > Direct R2
 */
export async function routeStorage(
  file: StorageRequest
): Promise<StorageEndpoint> {
  try {
    const fileSizeMB = file.size / (1024 * 1024);

    // Small files (<10MB) go to Manus built-in S3
    if (fileSizeMB < 10 && process.env.BUILT_IN_FORGE_API_URL) {
      return {
        type: "s3",
        endpoint: `${process.env.BUILT_IN_FORGE_API_URL}/storage`,
        apiKey: process.env.BUILT_IN_FORGE_API_KEY,
        bucket: "manus-mcp-storage",
      };
    }

    // Large files (>10MB) go to user's Cloudflare R2
    if (process.env.SUPABASE_URL) {
      return {
        type: "r2",
        endpoint: process.env.SUPABASE_URL,
        apiKey: process.env.SUPABASE_KEY,
        bucket: "user-storage",
      };
    }

    return {
      type: "s3",
      endpoint: "https://s3.amazonaws.com",
      apiKey: "",
      bucket: "default-bucket",
    };
  } catch (error) {
    console.error("Error routing storage:", error);
    return {
      type: "s3",
      endpoint: "https://s3.amazonaws.com",
      apiKey: "",
      bucket: "default-bucket",
    };
  }
}

// ============================================================================
// Health Checks
// ============================================================================

/**
 * Check health of all services
 */
export async function checkServiceHealth(): Promise<HealthStatus> {
  try {
    const services = [
      { name: "Neo4j", url: process.env.NEO4J_URL },
      { name: "Chroma", url: process.env.CHROMA_URL },
      { name: "Qdrant", url: process.env.QDRANT_URL },
      { name: "Ollama", url: process.env.OLLAMA_URL },
      { name: "LiteLLM", url: process.env.BUILT_IN_FORGE_API_URL },
    ];

    const results = await Promise.all(
      services.map(async service => {
        if (!service.url) {
          return {
            name: service.name,
            status: "disabled" as const,
            latency: 0,
          };
        }

        try {
          const start = Date.now();
          const response = await fetch(service.url, {
            method: "GET",
            signal: AbortSignal.timeout(5000),
          });
          const latency = Date.now() - start;

          const status: "healthy" | "unhealthy" = response.ok
            ? "healthy"
            : "unhealthy";
          return {
            name: service.name,
            status,
            latency,
          };
        } catch (error) {
          return {
            name: service.name,
            status: "unreachable" as const,
            latency: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    return {
      services: results,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("Error checking service health:", error);
    return {
      services: [],
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// Cost Tracking
// ============================================================================

/**
 * Track costs across all services
 */
export async function trackCosts(
  userId: number,
  timeRange: TimeRange
): Promise<CostMetrics> {
  try {
    // If using built-in LiteLLM proxy, query its metrics endpoint
    if (process.env.BUILT_IN_FORGE_API_URL) {
      const response = await fetch(
        `${process.env.BUILT_IN_FORGE_API_URL}/metrics/costs`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            startDate: timeRange.start,
            endDate: timeRange.end,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`LiteLLM metrics API error: ${response.status}`);
      }

      return await response.json();
    }

    // If not using LiteLLM, return empty metrics
    return {
      totalCost: 0,
      totalTokens: 0,
      breakdown: [],
    };
  } catch (error) {
    console.error("Error tracking costs:", error);
    return {
      totalCost: 0,
      totalTokens: 0,
      breakdown: [],
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const router = {
  llm: routeLLM,
  mcpTool: routeMCPTool,
  vectorSearch: routeVectorSearch,
  storage: routeStorage,
  health: checkServiceHealth,
  costs: trackCosts,
};
