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
}
