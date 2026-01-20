# TASK 02: Implement Core Router

**Priority:** CRITICAL  
**Estimated Time:** 2 hours  
**Delegate To:** Groq Llama 3.3 70B  
**Cost:** Free

---

## Context

The Core Router (`server/core/router.ts`) has all 6 routing functions stubbed with `throw new Error("TODO: Implement")`. This blocks smart routing for LLM providers, MCP tools, vector search, and storage.

---

## Functions to Implement

### 1. `routeLLM()`

**Purpose:** Route LLM requests to appropriate provider

**Logic:**

```typescript
async function routeLLM(request: LLMRequest): Promise<LLMProvider> {
  // Priority order:
  // 1. If BUILT_IN_FORGE_API_URL is set, use Manus built-in (LiteLLM proxy)
  // 2. Otherwise use user-configured provider from request

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
    endpoint: request.endpoint,
    apiKey: request.apiKey,
  };
}
```

---

### 2. `routeMCPTool()`

**Purpose:** Route MCP tool invocations to local or remote servers

**Logic:**

```typescript
async function routeMCPTool(toolName: string): Promise<MCPEndpoint> {
  const registry = await getPluginRegistry();
  const localTool = registry.getTool(toolName);

  if (localTool) {
    return {
      type: "local",
      handler: localTool.handler,
    };
  }

  // Check remote MCP servers
  const proxy = getMCPProxy();
  const remoteTool = proxy.getToolSpec(toolName);

  if (remoteTool) {
    return {
      type: "remote",
      serverId: remoteTool.serverId,
      endpoint: remoteTool.endpoint,
    };
  }

  throw new Error(`Tool not found: ${toolName}`);
}
```

---

### 3. `routeVectorSearch()`

**Purpose:** Route vector search to Chroma (in-process) or Qdrant (persistent)

**Logic:**

```typescript
async function routeVectorSearch(
  query: VectorSearchRequest
): Promise<VectorDBEndpoint> {
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
}
```

---

### 4. `routeStorage()`

**Purpose:** Route file storage to Manus S3 (<10MB) or user R2 (>10MB)

**Logic:**

```typescript
async function routeStorage(file: StorageRequest): Promise<StorageEndpoint> {
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

  throw new Error("No storage backend configured");
}
```

---

### 5. `checkServiceHealth()`

**Purpose:** Ping all VPS services and return health status

**Logic:**

```typescript
async function checkServiceHealth(): Promise<HealthStatus> {
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
        return { name: service.name, status: "disabled", latency: 0 };
      }

      try {
        const start = Date.now();
        const response = await fetch(service.url, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
        const latency = Date.now() - start;

        return {
          name: service.name,
          status: response.ok ? "healthy" : "unhealthy",
          latency,
        };
      } catch (error) {
        return {
          name: service.name,
          status: "unreachable",
          latency: 0,
          error: error.message,
        };
      }
    })
  );

  return {
    services: results,
    timestamp: new Date(),
  };
}
```

---

### 6. `trackCosts()`

**Purpose:** Query LiteLLM for cost metrics

**Logic:**

```typescript
async function trackCosts(
  userId: number,
  timeRange: TimeRange
): Promise<CostMetrics> {
  // If using built-in LiteLLM proxy, query its metrics endpoint
  if (process.env.BUILT_IN_FORGE_API_URL) {
    try {
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
    } catch (error) {
      console.error("Failed to fetch cost metrics:", error);
      return {
        totalCost: 0,
        totalTokens: 0,
        breakdown: [],
      };
    }
  }

  // If not using LiteLLM, return empty metrics
  return {
    totalCost: 0,
    totalTokens: 0,
    breakdown: [],
  };
}
```

---

## Type Definitions

Add these types to the file:

```typescript
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
```

---

## Imports Needed

```typescript
import { getPluginRegistry } from "../mcp/plugins/registry";
import { getMCPProxy } from "../mcp/proxy/mcp-proxy";
```

---

## Error Handling

- Use try-catch for all network requests
- Return sensible defaults on failure (don't throw)
- Log errors to console for debugging

---

## Testing Checklist

After implementation, test:

- [ ] LLM routing uses built-in when available
- [ ] MCP tool routing finds local tools first
- [ ] Vector search routes to Qdrant when configured
- [ ] Storage routing uses S3 for small files, R2 for large
- [ ] Health check pings all services
- [ ] Cost tracking queries LiteLLM metrics

---

## Files to Modify

1. `server/core/router.ts` - Main implementation file

---

## Output Format

Provide the complete updated `router.ts` file with all implementations.
