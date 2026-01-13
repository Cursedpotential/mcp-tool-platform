# MCP Gateway

**NAME**
    mcp-gateway - Token-efficient Model Context Protocol gateway for forensic analysis tools

**SYNOPSIS**
    The MCP Gateway provides 4 core endpoints for tool discovery, specification retrieval, execution, and content retrieval in a forensic legal case management system.

**DESCRIPTION**
    The MCP Gateway is the primary API interface for the MCP Tool Platform. It implements a token-efficient architecture that minimizes LLM context window usage through reference-based returns and compact tool cards.

    **Core Principles:**
    - **Token Efficiency**: Returns compact representations to minimize context usage
    - **Reference-Based Returns**: Large outputs (>4KB) return content references instead of inline data
    - **Content Addressing**: SHA-256 hashing ensures data integrity and deduplication
    - **Bidirectional Communication**: Supports both tool invocation and content retrieval

**ENDPOINTS**

**search_tools**
    Discovers available tools with minimal token overhead.

    **Input Schema:**
    ```typescript
    {
      query: string,        // Search query (1-200 chars)
      topK: number,         // Max results (1-50, default: 10)
      category?: string,    // Filter by category
      tags?: string[]       // Filter by tags
    }
    ```

    **Output Schema:**
    ```typescript
    {
      success: boolean,
      data: ToolCard[],     // Compact tool representations
      meta: {
        traceId: string,
        executionTimeMs: number
      }
    }
    ```

    **ToolCard Structure:**
    ```typescript
    {
      name: string,         // Tool identifier
      category: string,     // Tool category (document, nlp, search, etc.)
      description: string,  // Brief description
      tags: string[]        // Associated tags
    }
    ```

**describe_tool**
    Retrieves complete tool specification on demand.

    **Input Schema:**
    ```typescript
    {
      toolName: string      // Tool identifier (1-100 chars)
    }
    ```

    **Output Schema:**
    ```typescript
    {
      success: boolean,
      data: ToolSpec,       // Complete tool specification
      meta: {
        traceId: string,
        executionTimeMs: number
      }
    }
    ```

    **ToolSpec Structure:**
    ```typescript
    {
      name: string,
      category: string,
      description: string,
      tags: string[],
      inputSchema: ZodSchema,
      outputSchema: ZodSchema,
      examples: ToolExample[],
      permissions: Permission[],
      costEstimate?: CostInfo,
      timeout: number,
      maxOutputSize: number
    }
    ```

**invoke_tool**
    Executes a tool with reference-based returns for large outputs.

    **Input Schema:**
    ```typescript
    {
      toolName: string,
      args: Record<string, unknown>,
      options?: {
        timeout?: number,        // 1000-300000ms
        maxOutputSize?: number,  // 1-10485760 bytes
        returnRef?: boolean,     // Force reference return
        priority?: 'low' | 'normal' | 'high'
      }
    }
    ```

    **Output Schema:**
    ```typescript
    {
      success: boolean,
      data: InvokeResult,
      meta: {
        traceId: string,
        executionTimeMs: number,
        cached: boolean
      }
    }
    ```

    **InvokeResult Structure:**
    ```typescript
    {
      success: boolean,
      ref?: ContentRef,          // Reference for large outputs
      data?: unknown,            // Inline data for small outputs
      meta: {
        toolName: string,
        executionTimeMs: number,
        cacheHit: boolean,
        traceId: string
      }
    }
    ```

**get_ref**
    Retrieves content-addressed artifacts with paging support.

    **Input Schema:**
    ```typescript
    {
      ref: ContentRef,           // SHA-256 hash reference
      page: number,              // Page number (1-based)
      pageSize?: number          // Page size (256-65536 bytes)
    }
    ```

    **Output Schema:**
    ```typescript
    {
      success: boolean,
      data: PagedContent,
      meta: {
        traceId: string,
        executionTimeMs: number
      }
    }
    ```

    **PagedContent Structure:**
    ```typescript
    {
      ref: ContentRef,
      content: string | Buffer,
      mimeType: string,
      size: number,
      page: number,
      totalPages: number,
      hasNext: boolean,
      hasPrev: boolean
    }
    ```

**ARCHITECTURE**

**Request Processing Flow:**
```
Client Request → Input Validation → Tool Discovery/Execution → Content Store → Response
     ↓                 ↓                 ↓                 ↓                 ↓
  MCP Gateway    Zod Schema      Task Executor    SHA-256 Hash     API Response
  (4 endpoints)  Validation       (78 tools)       Addressing       (JSON/Refs)
```

**Key Components:**
- **Router**: tRPC-based type-safe API routing
- **Registry**: Tool discovery and permission checking
- **Executor**: Task execution with checkpoint/resume
- **Store**: Content-addressed artifact storage
- **Proxy**: External MCP server integration

**Performance Optimizations:**
- **Inline vs Reference**: <4KB = inline, >4KB = reference
- **Deduplication**: SHA-256 content hashing prevents redundant storage
- **Caching**: Task results cached by input hash
- **Pagination**: Large content delivered in 4KB pages

**Security Features:**
- **Authentication**: Protected procedures require user context
- **Authorization**: Tool permissions checked per user
- **Rate Limiting**: Configurable per-user limits
- **Audit Logging**: All invocations logged with trace IDs

**Error Handling:**
- **Validation Errors**: Invalid input schemas return 400
- **Permission Errors**: Unauthorized access returns 403
- **Not Found Errors**: Unknown tools return 404
- **Execution Errors**: Tool failures return 500 with details

**Integration Points:**
- **LiteLLM Proxy**: LLM routing and cost tracking
- **MetaMCP Server**: External tool exposure
- **Content Store**: Artifact persistence and retrieval
- **Tool Registry**: Dynamic tool loading and discovery

**SEE ALSO**
    tool-registry(7), task-executor(7), content-store(7), smart-router(7)

**AUTHOR**
    Claude Code - Opus 4.1

**VERSION**
    1.0.0

**DATE**
    January 11, 2026