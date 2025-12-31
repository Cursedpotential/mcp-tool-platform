import { describe, expect, it, vi, beforeEach } from 'vitest';
import { appRouter } from '../routers';
import type { TrpcContext } from '../_core/context';

// Mock the plugin registry
vi.mock('./plugins/registry', () => ({
  getPluginRegistry: vi.fn().mockResolvedValue({
    searchTools: vi.fn().mockReturnValue([
      {
        name: 'search.ripgrep',
        category: 'search',
        description: 'Fast regex search using ripgrep',
        version: '1.0.0',
        tags: ['search', 'regex', 'ripgrep'],
        inputSchema: {},
        outputSchema: {},
        permissions: ['read:filesystem'],
      },
      {
        name: 'nlp.extract_entities',
        category: 'nlp',
        description: 'Extract named entities',
        version: '1.0.0',
        tags: ['nlp', 'entity', 'ner'],
        inputSchema: {},
        outputSchema: {},
        permissions: ['access:llm'],
      },
    ]),
    getTool: vi.fn().mockImplementation((name: string) => {
      if (name === 'search.ripgrep') {
        return {
          name: 'search.ripgrep',
          category: 'search',
          description: 'Fast regex search using ripgrep with JSON output',
          version: '1.0.0',
          tags: ['search', 'regex', 'ripgrep', 'grep', 'text'],
          inputSchema: {
            type: 'object',
            properties: {
              root: { type: 'string', description: 'Root directory to search' },
              query: { type: 'string', description: 'Search pattern (regex)' },
            },
            required: ['root', 'query'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              matches: { type: 'array' },
              totalMatches: { type: 'number' },
            },
          },
          permissions: ['read:filesystem'],
        };
      }
      return null;
    }),
    checkPermissions: vi.fn().mockResolvedValue(true),
  }),
}));

// Mock the task executor
vi.mock('./workers/executor', () => ({
  getTaskExecutor: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: { matches: [], totalMatches: 0 },
      meta: { cacheHit: false },
    }),
  }),
}));

// Mock the content store
vi.mock('./store/content-store', () => ({
  getContentStore: vi.fn().mockResolvedValue({
    getPage: vi.fn().mockResolvedValue({
      ref: 'sha256:abc123',
      page: 1,
      totalPages: 1,
      totalSize: 100,
      content: 'Test content',
      hasMore: false,
    }),
  }),
}));

function createTestContext(authenticated = false): TrpcContext {
  return {
    user: authenticated ? {
      id: 1,
      openId: 'test-user',
      email: 'test@example.com',
      name: 'Test User',
      loginMethod: 'manus',
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: {
      protocol: 'https',
      headers: {},
    } as TrpcContext['req'],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext['res'],
  };
}

describe('MCP Gateway API', () => {
  let ctx: TrpcContext;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    ctx = createTestContext();
    caller = appRouter.createCaller(ctx);
    vi.clearAllMocks();
  });

  describe('searchTools', () => {
    it('should return tool cards matching query', async () => {
      const result = await caller.mcp.searchTools({
        query: 'search',
        topK: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.meta).toBeDefined();
      expect(result.meta?.traceId).toBeDefined();
    });

    it('should respect topK parameter', async () => {
      const result = await caller.mcp.searchTools({
        query: 'nlp',
        topK: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter by category when provided', async () => {
      const result = await caller.mcp.searchTools({
        query: 'extract',
        category: 'nlp',
      });

      expect(result.success).toBe(true);
    });

    it('should filter by tags when provided', async () => {
      const result = await caller.mcp.searchTools({
        query: 'search',
        tags: ['regex'],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('describeTool', () => {
    it('should return full tool specification', async () => {
      const result = await caller.mcp.describeTool({
        toolName: 'search.ripgrep',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('search.ripgrep');
      expect(result.data?.inputSchema).toBeDefined();
      expect(result.data?.outputSchema).toBeDefined();
      expect(result.data?.permissions).toBeDefined();
    });

    it('should throw error for non-existent tool', async () => {
      await expect(
        caller.mcp.describeTool({
          toolName: 'nonexistent.tool',
        })
      ).rejects.toThrow('Tool not found');
    });
  });

  describe('invokeTool', () => {
    it('should execute tool and return result when authenticated', async () => {
      const authCtx = createTestContext(true);
      const authCaller = appRouter.createCaller(authCtx);
      
      const result = await authCaller.mcp.invokeTool({
        toolName: 'search.ripgrep',
        args: {
          root: '/tmp',
          query: 'test',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.meta?.traceId).toBeDefined();
    });

    it('should accept optional parameters when authenticated', async () => {
      const authCtx = createTestContext(true);
      const authCaller = appRouter.createCaller(authCtx);
      
      const result = await authCaller.mcp.invokeTool({
        toolName: 'search.ripgrep',
        args: {
          root: '/tmp',
          query: 'test',
        },
        options: {
          timeout: 30000,
          returnRef: true,
          priority: 'high',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      await expect(
        caller.mcp.invokeTool({
          toolName: 'search.ripgrep',
          args: { root: '/tmp', query: 'test' },
        })
      ).rejects.toThrow('Please login');
    });
  });

  describe('getRef', () => {
    it('should return paged content', async () => {
      const result = await caller.mcp.getRef({
        ref: 'sha256:abc123def456',
        page: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.content).toBeDefined();
      expect(result.data?.page).toBe(1);
    });

    it('should accept custom page size', async () => {
      const result = await caller.mcp.getRef({
        ref: 'sha256:abc123def456',
        page: 1,
        pageSize: 8192,
      });

      expect(result.success).toBe(true);
    });
  });
});

describe('MCP Gateway Input Validation', () => {
  let ctx: TrpcContext;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    ctx = createTestContext();
    caller = appRouter.createCaller(ctx);
  });

  it('should reject empty query in searchTools', async () => {
    await expect(
      caller.mcp.searchTools({
        query: '',
      })
    ).rejects.toThrow();
  });

  it('should reject invalid topK values', async () => {
    await expect(
      caller.mcp.searchTools({
        query: 'test',
        topK: 100, // Max is 50
      })
    ).rejects.toThrow();
  });

  it('should reject empty tool name in describeTool', async () => {
    await expect(
      caller.mcp.describeTool({
        toolName: '',
      })
    ).rejects.toThrow();
  });

  it('should reject invalid ref format in getRef', async () => {
    await expect(
      caller.mcp.getRef({
        ref: 'invalid-ref-format' as any,
        page: 1,
      })
    ).rejects.toThrow();
  });
});
