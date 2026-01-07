# GitHub Copilot Instructions for MCP Tool Platform

## Project Overview

The **MCP Tool Platform** is a token-efficient preprocessing and orchestration system designed to reduce LLM context consumption by 85%+ through intelligent data transformation, analysis, and routing. This platform serves as the "Home Depot of preprocessing tools"—a centralized gateway where heavy computational work happens before data flows into final storage systems (Neo4j, Supabase, Vector DBs) or orchestrating agents.

**Core Value**: Transform raw, unstructured data into pre-analyzed, structured, semantically-enriched artifacts that downstream systems can consume with minimal token overhead.

## Technology Stack

### Backend
- **Runtime**: Node.js 22+
- **Package Manager**: pnpm 10+
- **Framework**: Express 4 + tRPC 11
- **Language**: TypeScript 5.9.3
- **Database**: MySQL/TiDB with Drizzle ORM
- **Auth**: Manus OAuth with JWT sessions
- **Queue**: Redis (optional, for multi-worker)
- **Python**: 3.11+ for NLP/ML operations

### Frontend
- **Framework**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui (Radix UI primitives)
- **Router**: wouter
- **State Management**: tRPC hooks with @tanstack/react-query

### Storage & Databases
- **Vector DB**: Chroma (in-process working memory), pgvector (Supabase for persistence)
- **Graph DB**: Neo4j Aura with Graphiti for temporal relationships
- **Object Storage**: S3-compatible

### Python Stack
- graphiti-core (temporal graph operations)
- spacy (NLP operations)
- sentence-transformers (embeddings)
- transformers (ML models)

## Development Commands

```bash
# Install dependencies
pnpm install

# Database setup
pnpm db:push

# Development server (with hot reload)
pnpm dev

# Type checking
pnpm check

# Format code
pnpm format

# Run tests
pnpm test

# Build for production
pnpm build

# Start production server
pnpm start
```

## Code Style & Conventions

### TypeScript Standards
- Use **strict mode** (enabled in tsconfig.json)
- Prefer **explicit types** over implicit
- Use **type-safe queries** with Drizzle ORM
- Enable **esModuleInterop** and **skipLibCheck**
- Use path aliases: `@/*` for client, `@shared/*` for shared

### Naming Conventions
- **Files**: kebab-case (e.g., `content-store.ts`)
- **Components**: PascalCase (e.g., `HomePage.tsx`)
- **Functions**: camelCase (e.g., `invokeTool`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_PAGE_SIZE`)
- **Tools**: Namespaced dot notation (e.g., `nlp.extract_entities`, `document.parse`)

### Code Organization
- **Server code**: `/server` directory
- **Client code**: `/client/src` directory
- **Shared types**: `/shared` directory
- **Tests**: Co-located with source files (e.g., `gateway.test.ts` next to `gateway.ts`)
- **Python scripts**: `/server/python-tools` directory

### Import Order
1. External dependencies
2. Internal modules (using path aliases)
3. Relative imports
4. Type imports (if separate)

## Architecture Patterns

### 1. Tool Schema Pattern
Every tool must follow this structure:
```typescript
{
  name: 'category.action',           // Namespaced naming
  category: 'forensics',              // For grouping
  description: 'What it does',       // Human-readable
  version: '1.0.0',                  // Semantic versioning
  tags: ['tag1', 'tag2'],            // For search
  inputSchema: { /* JSON Schema */ },
  outputSchema: { /* JSON Schema */ },
  permissions: ['read:fs'],          // Security model
  costEstimate: { /* tokens/time */ }
}
```

### 2. Handler Registration Pattern
Handlers are registered in `server/mcp/workers/executor.ts`:
```typescript
this.registerHandler('tool.name', async (args) => {
  // 1. Validate input
  // 2. Call implementation (local or Python bridge)
  // 3. Return structured output
  // 4. Handle errors gracefully
});
```

### 3. Reference-Based Returns
Large outputs (>1MB) must be stored in ContentStore and returned as references:
```typescript
{
  success: true,
  ref: {
    id: 'ref-abc123',
    size: 5242880,
    mimeType: 'application/json',
    expiresAt: 1704499200000
  }
}
```

### 4. Python Bridge Pattern
For heavy NLP/ML operations, delegate to Python:
```typescript
import { callPython } from './server/mcp/python-bridge';

const result = await callPython('spacy_ner', {
  text: input.text,
  model: 'en_core_web_sm'
});
```

### 5. tRPC Router Pattern
Use tRPC for type-safe API endpoints:
```typescript
export const myRouter = router({
  myQuery: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Implementation
    }),
  myMutation: publicProcedure
    .input(z.object({ data: z.string() }))
    .mutate(async ({ input, ctx }) => {
      // Implementation
    })
});
```

## Testing Requirements

### Test Framework
- Use **vitest** for all tests
- Co-locate tests with source files: `filename.test.ts`
- Run tests with `pnpm test`

### Test Coverage
- All new handlers must have tests
- All new tRPC procedures should have tests
- Focus on unit tests for business logic
- Integration tests for API endpoints

### Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Test implementation
  });
});
```

## Security Guidelines

### Permission System
Tools must declare required permissions:
- `read:filesystem` - Read local files
- `write:filesystem` - Write local files
- `read:network` - Make HTTP requests
- `write:network` - Send data externally
- `execute:process` - Run subprocesses
- `access:llm` - Call LLM APIs
- `access:vectordb` - Query vector databases

### Authentication
- User auth via Manus OAuth
- API keys for programmatic access
- Never commit secrets or API keys
- Use environment variables for configuration

### Data Isolation
- Scope all data by `userId`
- Use user-specific Chroma collections
- Tag Neo4j entities with `sourceRef` for provenance

## Documentation Standards

### Code Comments
- Document **why**, not **what** (code should be self-explanatory)
- Use JSDoc for public APIs
- Add inline comments for complex logic only
- Keep comments up-to-date with code changes

### Documentation Files
- **README.md**: User-facing documentation, quick start guide
- **ARCHITECTURE.md**: System design, patterns, integration points (THIS IS THE SOURCE OF TRUTH)
- **CHANGELOG.md**: User-facing changes (follow Keep a Changelog format)
- **todo.md**: Current priorities and work items

## Key Architectural Concepts

### Token Efficiency (Primary Goal)
The platform's main purpose is to reduce LLM token consumption by 85%+ through:
- Document chunking and summarization
- Entity extraction and relationship mapping
- Semantic deduplication
- Temporal pattern analysis
- Reference-based returns for large data

### MCP Gateway API
Four core endpoints:
1. `search_tools` - Discover available tools
2. `describe_tool` - Get full tool specification
3. `invoke_tool` - Execute tools
4. `get_ref` - Retrieve content with pagination

### Three-Layer Architecture
1. **Gateway Layer** - MCP-compliant API exposing 65+ tools
2. **Execution Layer** - Task executor with 39+ handlers
3. **Storage Layer** - Multi-modal persistence (Chroma, pgvector, Neo4j, MySQL)

## Common Operations

### Adding a New Tool
1. Define tool schema in appropriate plugin file (e.g., `server/mcp/plugins/nlp.ts`)
2. Register handler in `server/mcp/workers/executor.ts`
3. Add to tool registry
4. Write tests in co-located test file
5. Update documentation if needed

### Adding a New tRPC Endpoint
1. Create or update router in `server/routers/`
2. Define input schema with Zod
3. Implement query or mutation
4. Add types to shared if needed
5. Write tests
6. Use in client with type-safe hooks

### Database Changes
1. Update schema in `server/db/schema.ts`
2. Run `pnpm db:push` to apply changes
3. Update related queries and mutations
4. Test database operations

## Dependencies

### Critical Dependencies
- **express**: Web server
- **@trpc/server**: Type-safe APIs
- **drizzle-orm**: Database ORM
- **zod**: Schema validation
- **react**: UI framework
- **tailwindcss**: Styling
- **vitest**: Testing framework

### Optional Dependencies
- **chromadb**: Vector database (in-process)
- **redis**: Queue for multi-worker
- **neo4j-driver**: Graph database connection

## Environment Variables

Required for full functionality:
- `DATABASE_URL` - MySQL/TiDB connection string
- `JWT_SECRET` - Authentication secret
- `OAUTH_SERVER_URL` - Manus OAuth endpoint
- `BUILT_IN_FORGE_API_URL` - Built-in API URL
- `BUILT_IN_FORGE_API_KEY` - Built-in API key

Optional:
- `NEO4J_URL`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` - Neo4j connection
- `SUPABASE_URL`, `SUPABASE_KEY` - Supabase connection
- `REDIS_URL` - Redis connection for multi-worker

## Best Practices

### When Adding Features
1. Read `todo.md` to see planned work
2. Check existing patterns before implementing
3. Follow the Design Patterns in ARCHITECTURE.md
4. Write tests for new functionality
5. Update `todo.md` with completed items
6. Keep changes minimal and focused

### When Fixing Bugs
1. Add bug to `todo.md` as `[ ] Fix: description`
2. Write a failing test that reproduces the bug
3. Fix the issue
4. Verify the test passes
5. Mark as complete in `todo.md`

### Error Handling
- Use structured error responses
- Include helpful error messages
- Log errors with context
- Handle edge cases gracefully
- Never expose sensitive information in errors

### Performance Considerations
- Use pagination for large datasets (default 4KB pages)
- Leverage content-addressed storage for deduplication
- Cache expensive operations when appropriate
- Use reference-based returns for large outputs (>1MB)
- Monitor execution time with `meta.executionTimeMs`

## References

- **Main Documentation**: See `README.md` for project overview
- **Architecture Details**: See `ARCHITECTURE.md` for system design (SOURCE OF TRUTH)
- **Current Work**: See `todo.md` for priorities
- **Project History**: See `CHANGELOG.md` for version history

## Special Notes for AI Agents

1. **Before making changes**: Always read `ARCHITECTURE.md` first—it's the source of truth
2. **Update todo.md**: Add unchecked items to `todo.md` BEFORE implementing features
3. **Follow existing patterns**: Don't reinvent patterns that already exist
4. **Write tests**: All new handlers and important functions need vitest tests
5. **Mark completed work**: Update `todo.md` with `[x]` when items are complete
6. **Check for TypeScript errors**: Run `pnpm check` before committing
7. **Verify tests pass**: Run `pnpm test` to ensure nothing is broken
8. **Minimal changes**: Make the smallest possible changes to achieve the goal

## Contact & Issues

- **Repository**: https://github.com/Cursedpotential/mcp-tool-platform
- **Issues**: Use GitHub Issues for bugs and feature requests
- **Questions**: Create a discussion in GitHub
