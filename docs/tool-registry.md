# Tool Registry

**NAME**
    tool-registry - Dynamic tool registration and discovery system

**SYNOPSIS**
    The Tool Registry manages 78+ forensic analysis tools with dynamic loading, permission checking, and efficient search capabilities.

**DESCRIPTION**
    The Tool Registry is the central catalog for all MCP tools in the platform. It provides token-efficient discovery, permission-based access control, and dynamic tool loading capabilities.

**CORE FEATURES**

**Dynamic Registration**
    Tools can be registered at runtime from plugin manifests or individual tool specifications.

    **Registration Methods:**
    - **Single Tool**: `registerTool(ToolSpec)`
    - **Plugin Bundle**: `registerPlugin(PluginManifest)`
    - **Hot Reload**: Tools can be added/removed without restarting

**Efficient Search**
    Token-efficient tool discovery with multiple filtering options.

    **Search Capabilities:**
    - **Text Query**: Fuzzy matching against name, description, tags
    - **Category Filter**: Restrict to specific tool categories
    - **Tag Filter**: Multi-tag intersection filtering
    - **Ranking**: Relevance-based result ordering

**Permission System**
    Fine-grained access control with user and tool-specific permissions.

    **Permission Types:**
    - **User Permissions**: Per-user tool access
    - **Tool Permissions**: Tool-specific requirements
    - **Category Permissions**: Category-level restrictions
    - **Audit Logging**: All permission checks logged

**DATA STRUCTURES**

**ToolSpec**
    Complete tool specification for execution.

    ```typescript
    interface ToolSpec {
      name: string;                    // Unique identifier
      category: string;               // Tool category
      description: string;            // Human-readable description
      tags: string[];                 // Search tags
      inputSchema: ZodSchema;         // Input validation
      outputSchema: ZodSchema;        // Output validation
      handler: ToolHandler;           // Execution function
      permissions?: Permission[];     // Access requirements
      costEstimate?: CostInfo;        // Resource costs
      timeout: number;                // Execution timeout (ms)
      maxOutputSize: number;          // Output size limit
      examples?: ToolExample[];       // Usage examples
      metadata?: Record<string, unknown>; // Additional data
    }
    ```

**PluginManifest**
    Bundle of related tools from a single provider.

    ```typescript
    interface PluginManifest {
      name: string;                   // Plugin identifier
      version: string;               // Semantic version
      description: string;           // Plugin description
      tools: ToolSpec[];             // Tool specifications
      author?: string;               // Plugin author
      homepage?: string;             // Plugin website
      dependencies?: string[];       // Required dependencies
    }
    ```

**ToolCard**
    Compact representation for token-efficient discovery.

    ```typescript
    interface ToolCard {
      name: string;                  // Tool name
      category: string;              // Category
      description: string;           // Brief description
      tags: string[];                // Associated tags
    }
    ```

**SearchOptions**
    Query parameters for tool discovery.

    ```typescript
    interface SearchOptions {
      query?: string;                // Search query
      topK?: number;                 // Max results (1-50)
      category?: string;             // Category filter
      tags?: string[];               // Tag filters
      includePermissions?: boolean;  // Include permission info
    }
    ```

**API METHODS**

**registerTool(spec: ToolSpec): void**
    Registers a single tool in the registry.

    **Parameters:**
    - `spec`: Complete tool specification

    **Effects:**
    - Adds tool to internal map
    - Updates category and tag indexes
    - Validates tool schema

**registerPlugin(manifest: PluginManifest): void**
    Registers multiple tools from a plugin manifest.

    **Parameters:**
    - `manifest`: Plugin definition with tools array

    **Effects:**
    - Registers all tools in manifest
    - Updates plugin metadata
    - Validates plugin dependencies

**getTool(name: string): ToolSpec | undefined**
    Retrieves complete tool specification by name.

    **Parameters:**
    - `name`: Tool identifier

    **Returns:**
    - Complete ToolSpec or undefined if not found

**searchTools(query: string, options?: SearchOptions): ToolSpec[]**
    Searches tools using fuzzy matching and filters.

    **Parameters:**
    - `query`: Search string
    - `options`: Search configuration

    **Returns:**
    - Array of matching ToolSpec objects

**getToolsByCategory(category: string): ToolSpec[]**
    Retrieves all tools in a specific category.

    **Parameters:**
    - `category`: Category name

    **Returns:**
    - Array of tools in category

**checkPermissions(toolName: string, userId: number): Promise<boolean>**
    Validates user permissions for tool access.

    **Parameters:**
    - `toolName`: Tool to check
    - `userId`: User identifier

    **Returns:**
    - Boolean permission status

**getCategories(): string[]**
    Returns all available tool categories.

    **Returns:**
    - Array of category names

**getToolCount(): number**
    Returns total number of registered tools.

    **Returns:**
    - Tool count

**TOOL CATEGORIES**

**Document Processing (15 tools)**
    - `document.parse` - Multi-format document parsing
    - `document.ocr` - Optical character recognition
    - `document.chunk` - Text chunking and segmentation
    - `document.extract` - Content extraction
    - `format.convert` - Format conversion (Pandoc)
    - `format.ocr` - Tesseract OCR integration
    - `stirling.pdf` - PDF manipulation
    - `unstructured.partition` - Document partitioning

**NLP & Analysis (12 tools)**
    - `nlp.sentiment` - Sentiment analysis
    - `nlp.entities` - Named entity extraction
    - `nlp.classify` - Text classification
    - `nlp.summarize` - Text summarization
    - `nlp.spacy` - spaCy integration
    - `nlp.nltk` - NLTK integration
    - `nlp.textblob` - TextBlob integration
    - `nlp.transformers` - Sentence transformers

**Forensic Analysis (20 tools)**
    - `forensics.analyze_patterns` - 256 behavioral patterns
    - `forensics.detect_hurtlex` - Offensive language detection
    - `forensics.score_severity` - Abuse severity scoring
    - `forensics.get_modules` - Analysis modules
    - `forensics.multi_pass_classifier` - 6-pass NLP classification
    - `forensics.priority_screener` - Immediate flag detection

**Search & Discovery (8 tools)**
    - `search.web` - General web search
    - `search.semantic` - Vector similarity search
    - `search.tavily` - LLM-optimized search
    - `search.perplexity` - AI-powered search
    - `search.serpapi` - Google search API
    - `browser.screenshot` - Web page screenshots
    - `browser.extract` - Web content extraction

**Vector Database (8 tools)**
    - `vector.add` - Store embeddings
    - `vector.search` - Semantic search
    - `vector.delete` - Remove embeddings
    - `vector.chroma` - Chroma integration (72hr TTL)
    - `vector.pgvector` - PostgreSQL integration
    - `vector.qdrant` - Qdrant integration

**Graph Database (6 tools)**
    - `graph.add_entity` - Add knowledge graph entities
    - `graph.add_relationship` - Add entity relationships
    - `graph.search_entities` - Query entities
    - `graph.timeline` - Entity history
    - `graph.contradictions` - Detect conflicting statements
    - `graph.neo4j` - Neo4j integration

**ML & AI (6 tools)**
    - `llm.invoke` - Call language models
    - `llm.embed` - Generate embeddings
    - `llm.smart_router` - Optimal LLM routing
    - `ml.classify` - Machine learning classification
    - `ml.cluster` - Text clustering
    - `ml.similarity` - Semantic similarity scoring

**Workflow & Orchestration (4 tools)**
    - `workflow.create` - Create tool chains
    - `workflow.execute` - Run workflows
    - `workflow.checkpoint` - Save workflow state
    - `workflow.resume` - Resume paused workflows

**PERMISSION SYSTEM**

**User Permissions**
    - **Admin**: Full access to all tools
    - **Analyst**: Forensic analysis tools only
    - **Viewer**: Read-only access to results

**Tool Permissions**
    - **Public**: Available to all authenticated users
    - **Restricted**: Requires specific user permissions
    - **Admin Only**: Administrative tools only

**Audit Logging**
    - All permission checks logged
    - Failed access attempts recorded
    - Tool usage tracked per user

**IMPLEMENTATION DETAILS**

**Index Structures**
    - **Tool Map**: `Map<string, ToolSpec>` for O(1) lookups
    - **Category Index**: `Map<string, Set<string>>` for category queries
    - **Tag Index**: `Map<string, Set<string>>` for tag filtering

**Search Algorithm**
    1. Tokenize query into terms
    2. Filter by category/tags if specified
    3. Score each tool by term matches
    4. Sort by relevance score
    5. Return top K results

**Performance Characteristics**
    - **Registration**: O(1) per tool
    - **Lookup**: O(1) by name
    - **Search**: O(n) where n = tool count (optimized with indexes)
    - **Memory**: ~50KB per tool specification

**Error Handling**
    - **Duplicate Registration**: Throws error on name conflicts
    - **Invalid Schema**: Validates Zod schemas on registration
    - **Missing Dependencies**: Checks plugin dependencies
    - **Permission Denied**: Returns false with audit logging

**SEE ALSO**
    mcp-gateway(7), task-executor(7), smart-router(7)

**AUTHOR**
    Claude Code - Opus 4.1

**VERSION**
    1.0.0

**DATE**
    January 11, 2026