/**
 * Plugin Registry
 * 
 * Manages tool registration, discovery, and permission checking.
 * Supports dynamic tool loading and search with minimal token overhead.
 */

import type { ToolCard, ToolSpec, ToolPermission } from '../../../shared/mcp-types';

export interface SearchOptions {
  topK?: number;
  category?: string;
  tags?: string[];
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  tools: ToolSpec[];
}

export class PluginRegistry {
  private tools: Map<string, ToolSpec> = new Map();
  private categories: Set<string> = new Set();
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> tool names

  /**
   * Register a tool
   */
  registerTool(tool: ToolSpec): void {
    this.tools.set(tool.name, tool);
    this.categories.add(tool.category);

    // Index tags for search
    const tags = this.extractTags(tool);
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(tool.name);
    }
  }

  /**
   * Register multiple tools from a plugin manifest
   */
  registerPlugin(manifest: PluginManifest): void {
    for (const tool of manifest.tools) {
      this.registerTool(tool);
    }
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolSpec | undefined {
    return this.tools.get(name);
  }

  /**
   * Search tools with minimal token overhead
   */
  searchTools(query: string, options: SearchOptions = {}): ToolSpec[] {
    const { topK = 10, category, tags } = options;
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(Boolean);

    const scored: Array<{ tool: ToolSpec; score: number }> = [];

    this.tools.forEach((tool) => {
      // Filter by category if specified
      if (category && tool.category !== category) {
        return;
      }

      // Filter by tags if specified
      if (tags && tags.length > 0) {
        const toolTags = this.extractTags(tool);
        const hasAllTags = tags.every((tag) => toolTags.includes(tag.toLowerCase()));
        if (!hasAllTags) {
          return;
        }
      }

      // Score based on query match
      let score = 0;
      const nameLower = tool.name.toLowerCase();
      const descLower = tool.description.toLowerCase();

      for (const term of queryTerms) {
        // Exact name match
        if (nameLower === term) {
          score += 100;
        }
        // Name contains term
        else if (nameLower.includes(term)) {
          score += 50;
        }
        // Description contains term
        if (descLower.includes(term)) {
          score += 10;
        }
        // Tag match
        const toolTags = this.extractTags(tool);
        if (toolTags.some((t) => t.includes(term))) {
          score += 25;
        }
      }

      if (score > 0) {
        scored.push({ tool, score });
      }
    });

    // Sort by score and return top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.tool);
  }

  /**
   * Check if a user has permission to use a tool
   */
  async checkPermissions(toolName: string, userId: number): Promise<boolean> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return false;
    }

    // For now, allow all authenticated users
    // In production, implement proper RBAC
    return userId > 0;
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories);
  }

  /**
   * Get total tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Get all tools in a category
   */
  getToolsByCategory(category: string): ToolSpec[] {
    const result: ToolSpec[] = [];
    this.tools.forEach((tool) => {
      if (tool.category === category) {
        result.push(tool);
      }
    });
    return result;
  }

  /**
   * Extract tags from a tool (name parts, category, explicit tags)
   */
  private extractTags(tool: ToolSpec): string[] {
    const tags: string[] = [];

    // Add explicit tags if present
    if ('tags' in tool && Array.isArray((tool as ToolCard).tags)) {
      tags.push(...(tool as ToolCard).tags);
    }

    // Add category
    tags.push(tool.category.toLowerCase());

    // Add name parts
    const nameParts = tool.name.split(/[._-]/).filter(Boolean);
    tags.push(...nameParts.map((p) => p.toLowerCase()));

    return Array.from(new Set(tags));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let registryInstance: PluginRegistry | null = null;

export async function getPluginRegistry(): Promise<PluginRegistry> {
  if (!registryInstance) {
    registryInstance = new PluginRegistry();
    await registerBuiltinTools(registryInstance);
  }
  return registryInstance;
}

/**
 * Register built-in tools
 */
async function registerBuiltinTools(registry: PluginRegistry): Promise<void> {
  // Search tools
  registry.registerTool({
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
        glob: { type: 'string', description: 'File glob pattern' },
        maxResults: { type: 'number', description: 'Maximum results to return' },
        contextLines: { type: 'number', description: 'Lines of context around matches' },
      },
      required: ['root', 'query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        matches: { type: 'array' },
        totalMatches: { type: 'number' },
        ref: { type: 'string' },
      },
    },
    permissions: ['read:filesystem'],
  });

  registry.registerTool({
    name: 'search.ugrep',
    category: 'search',
    description: 'Universal grep with advanced filtering and JSON output',
    version: '1.0.0',
    tags: ['search', 'grep', 'ugrep', 'filter', 'text'],
    inputSchema: {
      type: 'object',
      properties: {
        root: { type: 'string', description: 'Root directory to search' },
        query: { type: 'string', description: 'Search pattern' },
        include: { type: 'string', description: 'Include file pattern' },
        exclude: { type: 'string', description: 'Exclude pattern' },
        maxResults: { type: 'number', description: 'Maximum results' },
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
  });

  // Document tools
  registry.registerTool({
    name: 'doc.convert_to_markdown',
    category: 'document',
    description: 'Convert documents to markdown using Pandoc',
    version: '1.0.0',
    tags: ['document', 'markdown', 'pandoc', 'convert', 'format'],
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to document or content ref' },
        format: { type: 'string', description: 'Input format (auto-detected if not specified)' },
        extractMetadata: { type: 'boolean', description: 'Extract document metadata' },
      },
      required: ['path'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        markdownRef: { type: 'string' },
        metadata: { type: 'object' },
        preview: { type: 'string' },
      },
    },
    permissions: ['read:filesystem', 'execute:process'],
  });

  registry.registerTool({
    name: 'doc.ocr_image_or_pdf',
    category: 'document',
    description: 'Extract text from images/PDFs using Tesseract OCR',
    version: '1.0.0',
    tags: ['document', 'ocr', 'tesseract', 'pdf', 'image', 'extract'],
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to image or PDF' },
        language: { type: 'string', description: 'OCR language (default: eng)' },
        psm: { type: 'number', description: 'Page segmentation mode' },
        dpi: { type: 'number', description: 'DPI for processing' },
      },
      required: ['path'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string' },
        pages: { type: 'number' },
        confidence: { type: 'number' },
      },
    },
    permissions: ['read:filesystem', 'execute:process'],
  });

  registry.registerTool({
    name: 'doc.segment',
    category: 'document',
    description: 'Segment text into sections and chunks with offsets',
    version: '1.0.0',
    tags: ['document', 'segment', 'chunk', 'split', 'section'],
    inputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string', description: 'Content reference to text' },
        strategy: { type: 'string', enum: ['heading', 'paragraph', 'sentence', 'fixed'] },
        chunkSize: { type: 'number', description: 'Target chunk size for fixed strategy' },
        overlap: { type: 'number', description: 'Overlap between chunks' },
      },
      required: ['textRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        chunksRef: { type: 'string' },
        chunkCount: { type: 'number' },
        sections: { type: 'array' },
      },
    },
    permissions: ['read:filesystem'],
  });

  // NLP tools
  registry.registerTool({
    name: 'nlp.detect_language',
    category: 'nlp',
    description: 'Detect the language of text',
    version: '1.0.0',
    tags: ['nlp', 'language', 'detect', 'identify'],
    inputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string', description: 'Content reference to text' },
      },
      required: ['textRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        language: { type: 'string' },
        confidence: { type: 'number' },
        alternatives: { type: 'array' },
      },
    },
    permissions: [],
  });

  registry.registerTool({
    name: 'nlp.extract_entities',
    category: 'nlp',
    description: 'Extract named entities with offsets and types',
    version: '1.0.0',
    tags: ['nlp', 'entity', 'ner', 'extract', 'named-entity'],
    inputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string', description: 'Content reference to text' },
        provider: { type: 'string', enum: ['auto', 'spacy', 'transformers', 'compromise'] },
        types: { type: 'array', description: 'Entity types to extract' },
      },
      required: ['textRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        entities: { type: 'array' },
        entitiesRef: { type: 'string' },
      },
    },
    permissions: ['access:llm'],
  });

  registry.registerTool({
    name: 'nlp.extract_keywords',
    category: 'nlp',
    description: 'Extract keywords using TextRank or TF-IDF',
    version: '1.0.0',
    tags: ['nlp', 'keyword', 'textrank', 'tfidf', 'extract'],
    inputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string', description: 'Content reference to text' },
        method: { type: 'string', enum: ['textrank', 'tfidf', 'rake'] },
        topK: { type: 'number', description: 'Number of keywords to extract' },
      },
      required: ['textRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        keywords: { type: 'array' },
      },
    },
    permissions: [],
  });

  registry.registerTool({
    name: 'nlp.analyze_sentiment',
    category: 'nlp',
    description: 'Analyze sentiment of text',
    version: '1.0.0',
    tags: ['nlp', 'sentiment', 'analyze', 'emotion', 'opinion'],
    inputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string', description: 'Content reference to text' },
        provider: { type: 'string', enum: ['auto', 'vader', 'transformers'] },
      },
      required: ['textRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        score: { type: 'number' },
        confidence: { type: 'number' },
      },
    },
    permissions: ['access:llm'],
  });

  registry.registerTool({
    name: 'nlp.split_sentences',
    category: 'nlp',
    description: 'Split text into sentences with offsets',
    version: '1.0.0',
    tags: ['nlp', 'sentence', 'split', 'tokenize'],
    inputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string', description: 'Content reference to text' },
        provider: { type: 'string', enum: ['auto', 'spacy', 'nltk', 'compromise'] },
      },
      required: ['textRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        sentences: { type: 'array' },
        sentencesRef: { type: 'string' },
      },
    },
    permissions: [],
  });

  // ML tools (optional)
  registry.registerTool({
    name: 'ml.embed',
    category: 'ml',
    description: 'Generate embeddings for text (stored server-side)',
    version: '1.0.0',
    tags: ['ml', 'embedding', 'vector', 'semantic'],
    inputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string', description: 'Content reference to text' },
        model: { type: 'string', description: 'Embedding model to use' },
        chunkSize: { type: 'number', description: 'Chunk size for long text' },
      },
      required: ['textRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        embeddingIds: { type: 'array' },
        dimensions: { type: 'number' },
        model: { type: 'string' },
      },
    },
    permissions: ['access:llm', 'access:vectordb'],
  });

  registry.registerTool({
    name: 'ml.semantic_search',
    category: 'ml',
    description: 'Semantic search over embedded documents',
    version: '1.0.0',
    tags: ['ml', 'semantic', 'search', 'vector', 'similarity'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        scopeRefs: { type: 'array', description: 'Content refs to search within' },
        topK: { type: 'number', description: 'Number of results' },
        threshold: { type: 'number', description: 'Minimum similarity score' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: { type: 'array' },
        resultsRef: { type: 'string' },
      },
    },
    permissions: ['access:vectordb'],
  });

  // Rules engine tools
  registry.registerTool({
    name: 'rules.evaluate',
    category: 'rules',
    description: 'Evaluate rule sets against content',
    version: '1.0.0',
    tags: ['rules', 'evaluate', 'pattern', 'match', 'action'],
    inputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string', description: 'Content reference to evaluate' },
        ruleSetId: { type: 'string', description: 'Rule set to apply' },
      },
      required: ['textRef', 'ruleSetId'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        matches: { type: 'array' },
        proposedActions: { type: 'array' },
      },
    },
    permissions: [],
  });

  // Diff/merge tools
  registry.registerTool({
    name: 'diff.text',
    category: 'diff',
    description: 'Compute diff between two text contents',
    version: '1.0.0',
    tags: ['diff', 'compare', 'text', 'similarity', 'merge'],
    inputSchema: {
      type: 'object',
      properties: {
        refA: { type: 'string', description: 'First content reference' },
        refB: { type: 'string', description: 'Second content reference' },
        format: { type: 'string', enum: ['unified', 'json', 'inline'] },
      },
      required: ['refA', 'refB'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        diffRef: { type: 'string' },
        additions: { type: 'number' },
        deletions: { type: 'number' },
        similarity: { type: 'number' },
      },
    },
    permissions: ['read:filesystem'],
  });

  // Filesystem tools
  registry.registerTool({
    name: 'fs.list_dir',
    category: 'filesystem',
    description: 'List directory contents with metadata',
    version: '1.0.0',
    tags: ['filesystem', 'directory', 'list', 'ls'],
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
        recursive: { type: 'boolean', description: 'Include subdirectories' },
        glob: { type: 'string', description: 'Filter pattern' },
      },
      required: ['path'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        entries: { type: 'array' },
        totalSize: { type: 'number' },
        fileCount: { type: 'number' },
      },
    },
    permissions: ['read:filesystem'],
  });

  registry.registerTool({
    name: 'fs.read_file',
    category: 'filesystem',
    description: 'Read file contents into content store',
    version: '1.0.0',
    tags: ['filesystem', 'file', 'read', 'content'],
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        encoding: { type: 'string', description: 'Text encoding' },
      },
      required: ['path'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string' },
        size: { type: 'number' },
        mime: { type: 'string' },
      },
    },
    permissions: ['read:filesystem'],
  });

  registry.registerTool({
    name: 'fs.write_file',
    category: 'filesystem',
    description: 'Write content to file (requires approval)',
    version: '1.0.0',
    tags: ['filesystem', 'file', 'write', 'save'],
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        contentRef: { type: 'string', description: 'Content reference to write' },
        createDirs: { type: 'boolean', description: 'Create parent directories' },
      },
      required: ['path', 'contentRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        approvalId: { type: 'string' },
      },
    },
    permissions: ['write:filesystem'],
  });

  // Summarization tools
  registry.registerTool({
    name: 'summarize.hierarchical',
    category: 'summarization',
    description: 'Hierarchical map-reduce summarization for large documents',
    version: '1.0.0',
    tags: ['summarization', 'map-reduce', 'document', 'compression'],
    inputSchema: {
      type: 'object',
      properties: {
        textRef: { type: 'string', description: 'Content reference to summarize' },
        maxLength: { type: 'number', description: 'Target summary length' },
        style: { type: 'string', enum: ['concise', 'detailed', 'bullet'] },
        preserveCitations: { type: 'boolean', description: 'Include source citations' },
      },
      required: ['textRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        summaryRef: { type: 'string' },
        citations: { type: 'array' },
        compressionRatio: { type: 'number' },
      },
    },
    permissions: ['access:llm'],
  });

  registry.registerTool({
    name: 'retrieve.supporting_spans',
    category: 'retrieval',
    description: 'Retrieve supporting spans for a question using BM25 + embeddings',
    version: '1.0.0',
    tags: ['retrieval', 'bm25', 'semantic', 'qa', 'search'],
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Question to find support for' },
        docRef: { type: 'string', description: 'Document content reference' },
        topK: { type: 'number', description: 'Number of spans to retrieve' },
        useEmbeddings: { type: 'boolean', description: 'Use semantic search' },
      },
      required: ['question', 'docRef'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        spans: { type: 'array' },
        citations: { type: 'array' },
      },
    },
    permissions: ['access:vectordb'],
  });

  // ============================================================================
  // DATABASE TOOLS
  // ============================================================================

  // Vector DB Tools
  registry.registerTool({
    name: 'vector.store',
    category: 'database',
    description: 'Store embeddings in vector database (Qdrant, pgvector, or Chroma)',
    version: '1.0.0',
    tags: ['vector', 'embedding', 'store', 'database'],
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection name' },
        vectors: { type: 'array', description: 'Array of {id, vector, metadata}' },
        provider: { type: 'string', enum: ['qdrant', 'pgvector', 'chroma'], description: 'Vector DB provider' },
      },
      required: ['collection', 'vectors'],
    },
    outputSchema: { type: 'object', properties: { stored: { type: 'number' } } },
    permissions: ['access:vectordb'],
  });

  registry.registerTool({
    name: 'vector.search',
    category: 'database',
    description: 'Semantic search in vector database',
    version: '1.0.0',
    tags: ['vector', 'search', 'semantic', 'database'],
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        query: { type: 'string', description: 'Text query or vector' },
        topK: { type: 'number', default: 10 },
        filter: { type: 'object', description: 'Metadata filter' },
      },
      required: ['collection', 'query'],
    },
    outputSchema: { type: 'object', properties: { results: { type: 'array' } } },
    permissions: ['access:vectordb'],
  });

  registry.registerTool({
    name: 'vector.delete',
    category: 'database',
    description: 'Delete vectors from database',
    version: '1.0.0',
    tags: ['vector', 'delete', 'database'],
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['collection', 'ids'],
    },
    outputSchema: { type: 'object', properties: { deleted: { type: 'number' } } },
    permissions: ['access:vectordb', 'write'],
  });

  // Graph DB Tools
  registry.registerTool({
    name: 'graph.create_entity',
    category: 'database',
    description: 'Create entity in graph database (Graphiti/Neo4j)',
    version: '1.0.0',
    tags: ['graph', 'entity', 'create', 'neo4j'],
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Entity type' },
        name: { type: 'string' },
        properties: { type: 'object' },
      },
      required: ['type', 'name'],
    },
    outputSchema: { type: 'object', properties: { entity: { type: 'object' }, created: { type: 'boolean' } } },
    permissions: ['access:graphdb', 'write'],
  });

  registry.registerTool({
    name: 'graph.create_relationship',
    category: 'database',
    description: 'Create relationship between entities',
    version: '1.0.0',
    tags: ['graph', 'relationship', 'create', 'neo4j'],
    inputSchema: {
      type: 'object',
      properties: {
        fromId: { type: 'string' },
        toId: { type: 'string' },
        type: { type: 'string', description: 'Relationship type' },
        properties: { type: 'object' },
      },
      required: ['fromId', 'toId', 'type'],
    },
    outputSchema: { type: 'object', properties: { relationship: { type: 'object' } } },
    permissions: ['access:graphdb', 'write'],
  });

  registry.registerTool({
    name: 'graph.query',
    category: 'database',
    description: 'Execute Cypher query on graph database',
    version: '1.0.0',
    tags: ['graph', 'query', 'cypher', 'neo4j'],
    inputSchema: {
      type: 'object',
      properties: {
        cypher: { type: 'string', description: 'Cypher query' },
        params: { type: 'object' },
      },
      required: ['cypher'],
    },
    outputSchema: { type: 'object', properties: { records: { type: 'array' } } },
    permissions: ['access:graphdb'],
  });

  registry.registerTool({
    name: 'graph.search',
    category: 'database',
    description: 'Search entities in graph database',
    version: '1.0.0',
    tags: ['graph', 'search', 'entity', 'neo4j'],
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        query: { type: 'string' },
        properties: { type: 'object' },
        limit: { type: 'number', default: 10 },
      },
    },
    outputSchema: { type: 'object', properties: { entities: { type: 'array' } } },
    permissions: ['access:graphdb'],
  });

  // ============================================================================
  // MEMORY/CONTEXT TOOLS
  // ============================================================================

  registry.registerTool({
    name: 'mem0.add',
    category: 'memory',
    description: 'Add memory to shared context store (mem0)',
    version: '1.0.0',
    tags: ['memory', 'context', 'store', 'mem0'],
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        metadata: { type: 'object' },
        scope: { type: 'string', enum: ['agent', 'project', 'user', 'global'] },
      },
      required: ['content'],
    },
    outputSchema: { type: 'object', properties: { memory: { type: 'object' } } },
    permissions: ['access:mem0', 'write'],
  });

  registry.registerTool({
    name: 'mem0.search',
    category: 'memory',
    description: 'Search memories semantically',
    version: '1.0.0',
    tags: ['memory', 'search', 'semantic', 'mem0'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        scope: { type: 'string' },
        limit: { type: 'number', default: 10 },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object', properties: { memories: { type: 'array' } } },
    permissions: ['access:mem0'],
  });

  registry.registerTool({
    name: 'mem0.share_context',
    category: 'memory',
    description: 'Share context between agents',
    version: '1.0.0',
    tags: ['memory', 'context', 'share', 'agent'],
    inputSchema: {
      type: 'object',
      properties: {
        fromAgentId: { type: 'string' },
        toAgentId: { type: 'string' },
        query: { type: 'string' },
      },
      required: ['fromAgentId', 'toAgentId', 'query'],
    },
    outputSchema: { type: 'object', properties: { shared: { type: 'array' } } },
    permissions: ['access:mem0', 'write'],
  });

  // ============================================================================
  // WORKFLOW TOOLS (n8n)
  // ============================================================================

  registry.registerTool({
    name: 'n8n.trigger',
    category: 'workflow',
    description: 'Trigger n8n workflow execution',
    version: '1.0.0',
    tags: ['workflow', 'n8n', 'automation', 'trigger'],
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['workflowId'],
    },
    outputSchema: { type: 'object', properties: { executionId: { type: 'string' } } },
    permissions: ['access:n8n'],
  });

  registry.registerTool({
    name: 'n8n.status',
    category: 'workflow',
    description: 'Check workflow execution status',
    version: '1.0.0',
    tags: ['workflow', 'n8n', 'status'],
    inputSchema: {
      type: 'object',
      properties: {
        executionId: { type: 'string' },
      },
      required: ['executionId'],
    },
    outputSchema: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object' } } },
    permissions: ['access:n8n'],
  });

  // ============================================================================
  // SEARCH/BROWSER TOOLS
  // ============================================================================

  registry.registerTool({
    name: 'search.web',
    category: 'search',
    description: 'LLM-optimized web search (Tavily, Perplexity, SerpAPI)',
    version: '1.0.0',
    tags: ['search', 'web', 'tavily', 'perplexity'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        type: { type: 'string', enum: ['web', 'news', 'research'] },
        maxResults: { type: 'number', default: 10 },
        provider: { type: 'string', enum: ['tavily', 'perplexity', 'serpapi'] },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object', properties: { results: { type: 'array' }, answer: { type: 'string' } } },
    permissions: ['network'],
  });

  registry.registerTool({
    name: 'search.news',
    category: 'search',
    description: 'Search recent news articles',
    version: '1.0.0',
    tags: ['search', 'news', 'current'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number', default: 10 },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object', properties: { results: { type: 'array' } } },
    permissions: ['network'],
  });

  registry.registerTool({
    name: 'search.research',
    category: 'search',
    description: 'Search academic/research content',
    version: '1.0.0',
    tags: ['search', 'academic', 'research', 'scholar'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number', default: 10 },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object', properties: { results: { type: 'array' } } },
    permissions: ['network'],
  });

  registry.registerTool({
    name: 'browser.navigate',
    category: 'browser',
    description: 'Navigate to URL and extract content',
    version: '1.0.0',
    tags: ['browser', 'navigate', 'scrape', 'extract'],
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        waitFor: { type: 'string', description: 'CSS selector to wait for' },
        javascript: { type: 'boolean', default: false },
      },
      required: ['url'],
    },
    outputSchema: { type: 'object', properties: { content: { type: 'object' } } },
    permissions: ['network'],
  });

  registry.registerTool({
    name: 'browser.screenshot',
    category: 'browser',
    description: 'Take screenshot of webpage',
    version: '1.0.0',
    tags: ['browser', 'screenshot', 'capture'],
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        fullPage: { type: 'boolean', default: false },
        selector: { type: 'string' },
      },
      required: ['url'],
    },
    outputSchema: { type: 'object', properties: { screenshot: { type: 'string' }, format: { type: 'string' } } },
    permissions: ['network'],
  });

  // ============================================================================
  // FORENSICS TOOLS
  // ============================================================================

  registry.registerTool({
    name: 'forensics.analyze_patterns',
    category: 'forensics',
    description: 'Analyze communication for behavioral patterns (manipulation, gaslighting, love-bombing)',
    version: '1.0.0',
    tags: ['forensics', 'patterns', 'manipulation', 'abuse', 'analysis'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        modules: { type: 'array', items: { type: 'string' }, description: 'Analysis modules to enable' },
        includePositive: { type: 'boolean', default: true },
      },
      required: ['text'],
    },
    outputSchema: { type: 'object', properties: { matches: { type: 'array' }, severity: { type: 'object' }, timeline: { type: 'array' } } },
    permissions: [],
  });

  registry.registerTool({
    name: 'forensics.detect_hurtlex',
    category: 'forensics',
    description: 'Detect HurtLex offensive/abusive terms',
    version: '1.0.0',
    tags: ['forensics', 'hurtlex', 'offensive', 'abuse'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        categories: { type: 'array', items: { type: 'string' } },
        language: { type: 'string', default: 'en' },
      },
      required: ['text'],
    },
    outputSchema: { type: 'object', properties: { matches: { type: 'array' }, categories: { type: 'object' } } },
    permissions: [],
  });

  registry.registerTool({
    name: 'forensics.score_severity',
    category: 'forensics',
    description: 'Score severity with MCL 722.23 factor mapping',
    version: '1.0.0',
    tags: ['forensics', 'severity', 'legal', 'mcl'],
    inputSchema: {
      type: 'object',
      properties: {
        matches: { type: 'array', description: 'Pattern matches from analyze_patterns' },
      },
      required: ['matches'],
    },
    outputSchema: { type: 'object', properties: { score: { type: 'number' }, factors: { type: 'object' }, level: { type: 'string' } } },
    permissions: [],
  });

  // ============================================================================
  // ETL TOOLS
  // ============================================================================

  registry.registerTool({
    name: 'text.mine',
    category: 'etl',
    description: 'Text mining with smart ugrep/ripgrep selection',
    version: '1.0.0',
    tags: ['text', 'mining', 'search', 'grep', 'ripgrep', 'ugrep'],
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string' },
        contentType: { type: 'string', enum: ['code', 'conversation', 'document', 'auto'] },
        options: { type: 'object' },
      },
      required: ['pattern', 'path'],
    },
    outputSchema: { type: 'object', properties: { matches: { type: 'array' }, engine: { type: 'string' } } },
    permissions: ['fs_read'],
  });

  registry.registerTool({
    name: 'format.convert',
    category: 'etl',
    description: 'Convert between document formats (PDF, DOCX, HTML, Markdown, etc.)',
    version: '1.0.0',
    tags: ['format', 'convert', 'document', 'pandoc'],
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input file path or content' },
        fromFormat: { type: 'string' },
        toFormat: { type: 'string' },
        options: { type: 'object' },
      },
      required: ['input', 'toFormat'],
    },
    outputSchema: { type: 'object', properties: { output: { type: 'string' }, format: { type: 'string' } } },
    permissions: ['fs_read', 'fs_write'],
  });

  registry.registerTool({
    name: 'schema.resolve',
    category: 'etl',
    description: 'AI-powered schema detection and field mapping',
    version: '1.0.0',
    tags: ['schema', 'mapping', 'ai', 'detection'],
    inputSchema: {
      type: 'object',
      properties: {
        sample: { type: 'string', description: 'Sample data' },
        targetSchema: { type: 'object', description: 'Target schema to map to' },
        platform: { type: 'string', description: 'Source platform hint' },
      },
      required: ['sample'],
    },
    outputSchema: { type: 'object', properties: { schema: { type: 'object' }, mappings: { type: 'array' }, confidence: { type: 'number' } } },
    permissions: ['access:llm'],
  });

  registry.registerTool({
    name: 'evidence.hash',
    category: 'etl',
    description: 'Generate cryptographic hash for chain of custody',
    version: '1.0.0',
    tags: ['evidence', 'hash', 'custody', 'forensics'],
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'File path or content' },
        algorithm: { type: 'string', enum: ['sha256', 'sha512', 'blake3'], default: 'sha256' },
        includeMetadata: { type: 'boolean', default: true },
      },
      required: ['input'],
    },
    outputSchema: { type: 'object', properties: { hash: { type: 'string' }, algorithm: { type: 'string' }, timestamp: { type: 'string' }, metadata: { type: 'object' } } },
    permissions: ['fs_read'],
  });

  // ============================================================================
  // INTEGRATION TOOLS
  // ============================================================================

  registry.registerTool({
    name: 'notebooklm.ask',
    category: 'integration',
    description: 'Query NotebookLM knowledge base',
    version: '1.0.0',
    tags: ['notebooklm', 'knowledge', 'query', 'google'],
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        notebookId: { type: 'string' },
      },
      required: ['question'],
    },
    outputSchema: { type: 'object', properties: { answer: { type: 'string' }, sources: { type: 'array' } } },
    permissions: ['access:notebooklm'],
  });

  registry.registerTool({
    name: 'notebooklm.add',
    category: 'integration',
    description: 'Add content to NotebookLM',
    version: '1.0.0',
    tags: ['notebooklm', 'add', 'knowledge'],
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        title: { type: 'string' },
        notebookId: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['content'],
    },
    outputSchema: { type: 'object', properties: { added: { type: 'boolean' }, sourceId: { type: 'string' } } },
    permissions: ['access:notebooklm', 'write'],
  });

  // ============================================================================
  // JAVASCRIPT NATIVE LIBRARIES
  // ============================================================================

  registry.registerTool({
    name: 'js.cheerio',
    category: 'library',
    description: 'Parse and manipulate HTML/XML with Cheerio (jQuery-like)',
    version: '1.0.0',
    tags: ['javascript', 'html', 'xml', 'parse', 'cheerio'],
    inputSchema: {
      type: 'object',
      properties: {
        html: { type: 'string' },
        selector: { type: 'string' },
        operation: { type: 'string', enum: ['text', 'html', 'attr', 'find', 'each'] },
        attribute: { type: 'string' },
      },
      required: ['html'],
    },
    outputSchema: { type: 'object', properties: { result: {} } },
    permissions: [],
  });

  registry.registerTool({
    name: 'js.xml_parse',
    category: 'library',
    description: 'Fast XML parsing with fast-xml-parser',
    version: '1.0.0',
    tags: ['javascript', 'xml', 'parse', 'fast'],
    inputSchema: {
      type: 'object',
      properties: {
        xml: { type: 'string' },
        options: { type: 'object' },
      },
      required: ['xml'],
    },
    outputSchema: { type: 'object', properties: { data: { type: 'object' } } },
    permissions: [],
  });

  registry.registerTool({
    name: 'js.json5',
    category: 'library',
    description: 'Parse JSON5 (comments, trailing commas)',
    version: '1.0.0',
    tags: ['javascript', 'json', 'json5', 'parse'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
      },
      required: ['text'],
    },
    outputSchema: { type: 'object', properties: { data: {} } },
    permissions: [],
  });

  registry.registerTool({
    name: 'js.yaml',
    category: 'library',
    description: 'Parse and stringify YAML',
    version: '1.0.0',
    tags: ['javascript', 'yaml', 'parse'],
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
        operation: { type: 'string', enum: ['parse', 'stringify'] },
      },
      required: ['input'],
    },
    outputSchema: { type: 'object', properties: { result: {} } },
    permissions: [],
  });

  registry.registerTool({
    name: 'js.csv',
    category: 'library',
    description: 'Parse and generate CSV',
    version: '1.0.0',
    tags: ['javascript', 'csv', 'parse', 'tabular'],
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
        operation: { type: 'string', enum: ['parse', 'stringify'] },
        options: { type: 'object' },
      },
      required: ['input'],
    },
    outputSchema: { type: 'object', properties: { data: { type: 'array' } } },
    permissions: [],
  });

  registry.registerTool({
    name: 'js.natural',
    category: 'library',
    description: 'NLP with Natural.js (tokenize, stem, classify, phonetics)',
    version: '1.0.0',
    tags: ['javascript', 'nlp', 'natural', 'tokenize', 'stem'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        operation: { type: 'string', enum: ['tokenize', 'stem', 'phonetics', 'sentiment', 'classify'] },
        options: { type: 'object' },
      },
      required: ['text', 'operation'],
    },
    outputSchema: { type: 'object', properties: { result: {} } },
    permissions: [],
  });

  registry.registerTool({
    name: 'js.compromise',
    category: 'library',
    description: 'NLP with Compromise.js (tagging, extraction)',
    version: '1.0.0',
    tags: ['javascript', 'nlp', 'compromise', 'tagging', 'extraction'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        operation: { type: 'string', enum: ['nouns', 'verbs', 'people', 'places', 'dates', 'topics'] },
      },
      required: ['text', 'operation'],
    },
    outputSchema: { type: 'object', properties: { result: { type: 'array' } } },
    permissions: [],
  });

  registry.registerTool({
    name: 'js.franc',
    category: 'library',
    description: 'Language detection with Franc',
    version: '1.0.0',
    tags: ['javascript', 'language', 'detection', 'franc'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        minLength: { type: 'number', default: 10 },
      },
      required: ['text'],
    },
    outputSchema: { type: 'object', properties: { language: { type: 'string' }, confidence: { type: 'number' } } },
    permissions: [],
  });

  registry.registerTool({
    name: 'js.string_similarity',
    category: 'library',
    description: 'String similarity comparison',
    version: '1.0.0',
    tags: ['javascript', 'string', 'similarity', 'fuzzy'],
    inputSchema: {
      type: 'object',
      properties: {
        string1: { type: 'string' },
        string2: { type: 'string' },
        algorithm: { type: 'string', enum: ['dice', 'levenshtein', 'jaro-winkler'] },
      },
      required: ['string1', 'string2'],
    },
    outputSchema: { type: 'object', properties: { similarity: { type: 'number' } } },
    permissions: [],
  });

  // ============================================================================
  // PYTHON LIBRARIES
  // ============================================================================

  registry.registerTool({
    name: 'py.spacy',
    category: 'library',
    description: 'Full NLP pipeline with spaCy',
    version: '1.0.0',
    tags: ['python', 'nlp', 'spacy', 'ner', 'pos', 'dependency'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        operations: { type: 'array', items: { type: 'string' }, description: 'tokenize, pos, ner, dependency, lemma' },
        model: { type: 'string', default: 'en_core_web_sm' },
      },
      required: ['text'],
    },
    outputSchema: { type: 'object', properties: { tokens: { type: 'array' }, entities: { type: 'array' }, dependencies: { type: 'array' } } },
    permissions: [],
  });

  registry.registerTool({
    name: 'py.nltk',
    category: 'library',
    description: 'NLP toolkit with NLTK',
    version: '1.0.0',
    tags: ['python', 'nlp', 'nltk', 'tokenize', 'stem', 'wordnet'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        operation: { type: 'string', enum: ['tokenize', 'stem', 'lemmatize', 'chunk', 'wordnet'] },
        options: { type: 'object' },
      },
      required: ['text', 'operation'],
    },
    outputSchema: { type: 'object', properties: { result: {} } },
    permissions: [],
  });

  registry.registerTool({
    name: 'py.transformers',
    category: 'library',
    description: 'BERT/Transformers for encoding, similarity, classification',
    version: '1.0.0',
    tags: ['python', 'bert', 'transformers', 'embedding', 'classification'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        operation: { type: 'string', enum: ['encode', 'similarity', 'classify', 'qa'] },
        model: { type: 'string' },
        options: { type: 'object' },
      },
      required: ['text', 'operation'],
    },
    outputSchema: { type: 'object', properties: { result: {} } },
    permissions: [],
  });

  registry.registerTool({
    name: 'py.beautifulsoup',
    category: 'library',
    description: 'HTML parsing with BeautifulSoup',
    version: '1.0.0',
    tags: ['python', 'html', 'parse', 'beautifulsoup'],
    inputSchema: {
      type: 'object',
      properties: {
        html: { type: 'string' },
        selector: { type: 'string' },
        operation: { type: 'string', enum: ['find', 'find_all', 'select', 'text', 'attrs'] },
      },
      required: ['html'],
    },
    outputSchema: { type: 'object', properties: { result: {} } },
    permissions: [],
  });

  registry.registerTool({
    name: 'py.pdfplumber',
    category: 'library',
    description: 'PDF text and table extraction with pdfplumber',
    version: '1.0.0',
    tags: ['python', 'pdf', 'extract', 'pdfplumber', 'tables'],
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        pages: { type: 'array', items: { type: 'number' } },
        extractTables: { type: 'boolean', default: false },
      },
      required: ['path'],
    },
    outputSchema: { type: 'object', properties: { text: { type: 'string' }, tables: { type: 'array' }, pages: { type: 'number' } } },
    permissions: ['fs_read'],
  });

  registry.registerTool({
    name: 'py.pandas',
    category: 'library',
    description: 'DataFrame operations with Pandas',
    version: '1.0.0',
    tags: ['python', 'pandas', 'dataframe', 'csv', 'excel'],
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'File path or JSON data' },
        operation: { type: 'string', enum: ['read', 'filter', 'groupby', 'merge', 'pivot', 'describe'] },
        options: { type: 'object' },
      },
      required: ['input', 'operation'],
    },
    outputSchema: { type: 'object', properties: { data: { type: 'array' }, columns: { type: 'array' }, shape: { type: 'array' } } },
    permissions: ['fs_read'],
  });

  // ============================================================================
  // DOCUMENT PROCESSING TOOLS
  // ============================================================================

  registry.registerTool({
    name: 'pandoc.convert',
    category: 'document',
    description: 'Universal document conversion with Pandoc',
    version: '1.0.0',
    tags: ['pandoc', 'convert', 'document', 'markdown', 'html', 'pdf', 'docx'],
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        options: { type: 'array', items: { type: 'string' } },
      },
      required: ['input', 'to'],
    },
    outputSchema: { type: 'object', properties: { output: { type: 'string' } } },
    permissions: ['fs_read', 'fs_write'],
  });

  registry.registerTool({
    name: 'tesseract.ocr',
    category: 'document',
    description: 'OCR with Tesseract',
    version: '1.0.0',
    tags: ['tesseract', 'ocr', 'image', 'text', 'extraction'],
    inputSchema: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Image path or base64' },
        language: { type: 'string', default: 'eng' },
        psm: { type: 'number', description: 'Page segmentation mode' },
      },
      required: ['image'],
    },
    outputSchema: { type: 'object', properties: { text: { type: 'string' }, confidence: { type: 'number' } } },
    permissions: ['fs_read'],
  });

  registry.registerTool({
    name: 'stirlingpdf.process',
    category: 'document',
    description: 'Advanced PDF processing with StirlingPDF',
    version: '1.0.0',
    tags: ['stirlingpdf', 'pdf', 'merge', 'split', 'compress', 'ocr'],
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['merge', 'split', 'compress', 'ocr', 'rotate', 'watermark', 'extract_images'] },
        files: { type: 'array', items: { type: 'string' } },
        options: { type: 'object' },
      },
      required: ['operation', 'files'],
    },
    outputSchema: { type: 'object', properties: { output: { type: 'string' }, pages: { type: 'number' } } },
    permissions: ['fs_read', 'fs_write', 'network'],
  });

  registry.registerTool({
    name: 'unstructured.partition',
    category: 'document',
    description: 'Document partitioning with Unstructured',
    version: '1.0.0',
    tags: ['unstructured', 'partition', 'document', 'extract'],
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        strategy: { type: 'string', enum: ['auto', 'fast', 'hi_res', 'ocr_only'] },
        extractImages: { type: 'boolean', default: false },
      },
      required: ['file'],
    },
    outputSchema: { type: 'object', properties: { elements: { type: 'array' }, metadata: { type: 'object' } } },
    permissions: ['fs_read'],
  });

  // ============================================================================
  // ML CLASSIFY TOOL
  // ============================================================================

  registry.registerTool({
    name: 'ml.classify',
    category: 'ml',
    description: 'Text classification (zero-shot or trained)',
    version: '1.0.0',
    tags: ['ml', 'classify', 'classification', 'text'],
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        multiLabel: { type: 'boolean', default: false },
      },
      required: ['text', 'labels'],
    },
    outputSchema: { type: 'object', properties: { label: { type: 'string' }, scores: { type: 'object' } } },
    permissions: [],
  });
}

