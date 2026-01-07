/**
 * AI-Powered MCP Config Generator
 * 
 * Generates platform-specific MCP configurations with skills, prompts,
 * and best practices using LLM assistance.
 */

import { LLMProviderHub } from '../llm/provider-hub';

// ============================================================================
// Types
// ============================================================================

export type Platform = 'claude' | 'gemini' | 'openai' | 'generic';

export interface MCPSkill {
  name: string;
  description: string;
  triggers: string[];
  toolChain: string[];
  systemPrompt: string;
  examples: { input: string; output: string }[];
}

export interface ClaudeMCPConfig {
  mcpServers: {
    [name: string]: {
      url: string;
      headers: { Authorization: string };
      tools?: string[];
      skills?: MCPSkill[];
    };
  };
}

export interface GeminiExtensionConfig {
  name: string;
  description: string;
  version: string;
  endpoint: string;
  auth: {
    type: 'bearer' | 'api_key';
    token?: string;
    header?: string;
  };
  functions: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }[];
  bestPractices?: string[];
}

export interface OpenAIFunctionConfig {
  tools: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
      };
    };
  }[];
  systemPrompt?: string;
}

export interface GenericMCPConfig {
  serverUrl: string;
  apiKey: string;
  tools: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }[];
  documentation: string;
}

// ============================================================================
// Config Templates
// ============================================================================

const CLAUDE_SKILLS_TEMPLATE: MCPSkill[] = [
  {
    name: 'document_preprocessing',
    description: 'Preprocess documents for analysis - OCR, conversion, chunking',
    triggers: ['process document', 'extract text', 'convert pdf', 'ocr'],
    toolChain: ['document.convert', 'document.ocr', 'document.chunk'],
    systemPrompt: `When the user wants to process a document:
1. First use document.convert to convert to markdown
2. If it's an image/scanned PDF, use document.ocr
3. Use document.chunk to split into manageable pieces
4. Store results in Chroma for further processing`,
    examples: [
      {
        input: 'Process this PDF for analysis',
        output: 'I\'ll preprocess this document using the document tools...',
      },
    ],
  },
  {
    name: 'entity_extraction',
    description: 'Extract entities, keywords, and relationships from text',
    triggers: ['extract entities', 'find names', 'identify keywords', 'analyze text'],
    toolChain: ['nlp.extract_entities', 'nlp.extract_keywords', 'nlp.detect_language'],
    systemPrompt: `For entity extraction tasks:
1. First detect the language with nlp.detect_language
2. Use nlp.extract_entities to find people, places, organizations
3. Use nlp.extract_keywords for important terms
4. Return structured results ready for graph database import`,
    examples: [
      {
        input: 'Extract all people and companies from this text',
        output: 'I\'ll analyze the text for entities...',
      },
    ],
  },
  {
    name: 'semantic_search',
    description: 'Search documents using semantic similarity',
    triggers: ['search for', 'find similar', 'look up', 'semantic search'],
    toolChain: ['ml.generate_embeddings', 'retrieval.bm25_search', 'retrieval.semantic_search'],
    systemPrompt: `For search tasks:
1. Generate embeddings for the query with ml.generate_embeddings
2. Use retrieval.bm25_search for keyword matching
3. Use retrieval.semantic_search for meaning-based results
4. Combine and rank results for best matches`,
    examples: [
      {
        input: 'Find documents about contract termination clauses',
        output: 'I\'ll search semantically for relevant documents...',
      },
    ],
  },
  {
    name: 'summarization_pipeline',
    description: 'Summarize large documents using hierarchical map-reduce',
    triggers: ['summarize', 'tldr', 'key points', 'overview'],
    toolChain: ['summarization.map_reduce', 'summarization.extract_outline'],
    systemPrompt: `For summarization:
1. For large docs, use summarization.map_reduce for hierarchical summary
2. Use summarization.extract_outline for structure
3. Preserve citations and source references
4. Aim for 85%+ token reduction while keeping key info`,
    examples: [
      {
        input: 'Summarize this 50-page report',
        output: 'I\'ll create a hierarchical summary preserving key details...',
      },
    ],
  },
];

const GEMINI_BEST_PRACTICES = [
  'Use Gemini\'s 2M token context for processing very large documents in a single pass',
  'Leverage grounding with Google Search for fact verification',
  'Use structured output mode for consistent JSON responses',
  'Enable code execution for data analysis tasks',
  'Use the thinking mode for complex multi-step reasoning',
];

const OPENAI_BEST_PRACTICES = [
  'Use function calling with strict mode for reliable tool use',
  'Leverage parallel function calling for batch operations',
  'Use JSON mode for structured outputs',
  'Consider using assistants API for stateful conversations',
  'Use seed parameter for reproducible outputs',
];

// ============================================================================
// Config Generator
// ============================================================================

export class MCPConfigGenerator {
  private llmHub: LLMProviderHub;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.llmHub = new LLMProviderHub();
    this.baseUrl = baseUrl;
  }

  /**
   * Generate platform-specific MCP config
   */
  async generateConfig(
    platform: Platform,
    apiKey: string,
    tools: { name: string; description: string; inputSchema: Record<string, unknown> }[],
    options?: {
      customSkills?: MCPSkill[];
      includeAllTools?: boolean;
      generateWithAI?: boolean;
    }
  ): Promise<ClaudeMCPConfig | GeminiExtensionConfig | OpenAIFunctionConfig | GenericMCPConfig> {
    switch (platform) {
      case 'claude':
        return this.generateClaudeConfig(apiKey, tools, options);
      case 'gemini':
        return this.generateGeminiConfig(apiKey, tools, options);
      case 'openai':
        return this.generateOpenAIConfig(apiKey, tools, options);
      default:
        return this.generateGenericConfig(apiKey, tools);
    }
  }

  /**
   * Generate Claude Desktop MCP config
   */
  private async generateClaudeConfig(
    apiKey: string,
    tools: { name: string; description: string; inputSchema: Record<string, unknown> }[],
    options?: { customSkills?: MCPSkill[]; generateWithAI?: boolean }
  ): Promise<ClaudeMCPConfig> {
    let skills = [...CLAUDE_SKILLS_TEMPLATE];

    if (options?.customSkills) {
      skills = [...skills, ...options.customSkills];
    }

    if (options?.generateWithAI) {
      const aiSkills = await this.generateSkillsWithAI(tools, 'claude');
      skills = [...skills, ...aiSkills];
    }

    return {
      mcpServers: {
        'preprocessing-toolshop': {
          url: `${this.baseUrl}/api/mcp`,
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          tools: tools.map(t => t.name),
          skills,
        },
      },
    };
  }

  /**
   * Generate Gemini Extension config
   */
  private async generateGeminiConfig(
    apiKey: string,
    tools: { name: string; description: string; inputSchema: Record<string, unknown> }[],
    options?: { generateWithAI?: boolean }
  ): Promise<GeminiExtensionConfig> {
    const functions = tools.map(tool => ({
      name: tool.name.replace(/\./g, '_'),
      description: tool.description,
      parameters: tool.inputSchema,
    }));

    return {
      name: 'MCP Preprocessing Toolshop',
      description: 'Document preprocessing, NLP, and analysis tools for AI workflows',
      version: '1.0.0',
      endpoint: `${this.baseUrl}/api/mcp`,
      auth: {
        type: 'bearer',
        token: apiKey,
      },
      functions,
      bestPractices: GEMINI_BEST_PRACTICES,
    };
  }

  /**
   * Generate OpenAI Function config
   */
  private async generateOpenAIConfig(
    apiKey: string,
    tools: { name: string; description: string; inputSchema: Record<string, unknown> }[],
    options?: { generateWithAI?: boolean }
  ): Promise<OpenAIFunctionConfig> {
    const openaiTools = tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name.replace(/\./g, '_'),
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: (tool.inputSchema as any).properties || {},
          required: (tool.inputSchema as any).required || [],
        },
      },
    }));

    let systemPrompt = `You have access to the MCP Preprocessing Toolshop via function calls.

Available tool categories:
- document.* - Document conversion, OCR, chunking
- nlp.* - Entity extraction, keywords, sentiment
- search.* - Text search with ripgrep/ugrep
- ml.* - Embeddings, semantic search (optional)
- retrieval.* - BM25 and semantic retrieval
- summarization.* - Hierarchical summarization

Best practices:
${OPENAI_BEST_PRACTICES.map(p => `- ${p}`).join('\n')}

The API endpoint is: ${this.baseUrl}/api/mcp
Use Bearer token: ${apiKey.substring(0, 12)}...`;

    return {
      tools: openaiTools,
      systemPrompt,
    };
  }

  /**
   * Generate generic MCP config
   */
  private generateGenericConfig(
    apiKey: string,
    tools: { name: string; description: string; inputSchema: Record<string, unknown> }[]
  ): GenericMCPConfig {
    return {
      serverUrl: `${this.baseUrl}/api/mcp`,
      apiKey,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
      documentation: `
# MCP Preprocessing Toolshop

## Authentication
Include the API key in the Authorization header:
\`\`\`
Authorization: Bearer ${apiKey}
\`\`\`

## Endpoints

### Search Tools
POST /api/mcp/search_tools
Body: { "query": "search term", "category": "optional" }

### Describe Tool
POST /api/mcp/describe_tool
Body: { "toolName": "tool.name" }

### Invoke Tool
POST /api/mcp/invoke_tool
Body: { "toolName": "tool.name", "args": { ... } }

### Get Reference
POST /api/mcp/get_ref
Body: { "ref": "sha256:...", "page": 1, "pageSize": 100 }

## Tool Categories
- document - Document processing (convert, OCR, chunk)
- nlp - Natural language processing
- search - Text search
- ml - Machine learning (embeddings, classification)
- retrieval - Information retrieval
- summarization - Document summarization
- rules - Pattern matching and rules engine
- diff - Text comparison
- filesystem - File operations
`,
    };
  }

  /**
   * Use AI to generate additional skills based on available tools
   */
  private async generateSkillsWithAI(
    tools: { name: string; description: string }[],
    platform: string
  ): Promise<MCPSkill[]> {
    const toolList = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

    const prompt = `Given these available tools:
${toolList}

Generate 3 additional skills for ${platform} that combine these tools effectively.
Each skill should have:
- name: snake_case identifier
- description: what the skill does
- triggers: phrases that should activate this skill
- toolChain: ordered list of tools to call
- systemPrompt: instructions for the AI on how to use this skill
- examples: input/output pairs

Return as JSON array of skills.`;

    try {
      const response = await this.llmHub.chat({
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content;
      if (content) {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
    } catch (error) {
      console.error('Failed to generate AI skills:', error);
    }

    return [];
  }

  /**
   * Generate a downloadable config file
   */
  generateConfigFile(config: unknown, platform: Platform): { filename: string; content: string } {
    const content = JSON.stringify(config, null, 2);
    
    const filenames: Record<Platform, string> = {
      claude: 'claude_desktop_config.json',
      gemini: 'gemini_extension.json',
      openai: 'openai_functions.json',
      generic: 'mcp_config.json',
    };

    return {
      filename: filenames[platform],
      content,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let configGenerator: MCPConfigGenerator | null = null;

export function getMCPConfigGenerator(baseUrl: string): MCPConfigGenerator {
  if (!configGenerator) {
    configGenerator = new MCPConfigGenerator(baseUrl);
  }
  return configGenerator;
}
