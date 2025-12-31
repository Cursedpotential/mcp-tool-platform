/**
 * Tool Forking System
 * 
 * Create custom versions of tools with platform-specific adapters:
 * - Claude MCP format (tools + skills)
 * - Gemini Extension format (extension manifest)
 * - Generic MCP format
 */

import { nanoid } from 'nanoid';
import type { ToolSpec } from '../../../shared/mcp-types';

// ============================================================================
// Types
// ============================================================================

export type PlatformType = 'generic' | 'claude-mcp' | 'gemini-extension' | 'openai-function';

export interface ToolFork {
  id: string;
  parentId: string | null;
  name: string;
  version: string;
  description: string;
  platform: PlatformType;
  spec: ToolSpec;
  customizations: ToolCustomization;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

export interface ToolCustomization {
  // Override default parameters
  parameterOverrides?: Record<string, {
    default?: unknown;
    required?: boolean;
    description?: string;
    hidden?: boolean;
  }>;
  // Add new parameters
  additionalParameters?: Record<string, {
    type: string;
    description: string;
    required?: boolean;
    default?: unknown;
  }>;
  // Platform-specific settings
  platformConfig?: Record<string, unknown>;
  // Pre/post processing hooks
  hooks?: {
    preProcess?: string; // JavaScript code to run before tool execution
    postProcess?: string; // JavaScript code to run after tool execution
  };
  // Rate limiting
  rateLimit?: {
    maxCallsPerMinute?: number;
    maxCallsPerHour?: number;
  };
}

// ============================================================================
// Claude MCP Adapter
// ============================================================================

interface ClaudeMCPTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface ClaudeMCPSkill {
  name: string;
  description: string;
  instructions: string;
  tools: string[];
}

interface ClaudeMCPManifest {
  schema_version: '1.0';
  name: string;
  description: string;
  version: string;
  tools: ClaudeMCPTool[];
  skills?: ClaudeMCPSkill[];
  permissions?: string[];
}

function generateClaudeMCPManifest(fork: ToolFork): ClaudeMCPManifest {
  const inputProps = fork.spec.inputSchema?.properties as Record<string, unknown> | undefined;
  const inputRequired = fork.spec.inputSchema?.required as string[] | undefined;
  const tool: ClaudeMCPTool = {
    name: fork.name.replace(/\./g, '_'),
    description: fork.description,
    input_schema: {
      type: 'object',
      properties: { ...(inputProps || {}) },
      required: inputRequired,
    },
  };

  // Apply customizations
  if (fork.customizations.parameterOverrides) {
    for (const [param, override] of Object.entries(fork.customizations.parameterOverrides)) {
      if (override.hidden) {
        delete tool.input_schema.properties[param];
        if (tool.input_schema.required) {
          tool.input_schema.required = tool.input_schema.required.filter(r => r !== param);
        }
      } else if (tool.input_schema.properties[param]) {
        const prop = tool.input_schema.properties[param] as Record<string, unknown>;
        if (override.description) prop.description = override.description;
        if (override.default !== undefined) prop.default = override.default;
      }
    }
  }

  if (fork.customizations.additionalParameters) {
    for (const [param, config] of Object.entries(fork.customizations.additionalParameters)) {
      tool.input_schema.properties[param] = {
        type: config.type,
        description: config.description,
        default: config.default,
      };
      if (config.required && !tool.input_schema.required?.includes(param)) {
        tool.input_schema.required = [...(tool.input_schema.required || []), param];
      }
    }
  }

  return {
    schema_version: '1.0',
    name: fork.name,
    description: fork.description,
    version: fork.version,
    tools: [tool],
    permissions: ['network', 'filesystem'],
  };
}

// ============================================================================
// Gemini Extension Adapter
// ============================================================================

interface GeminiExtensionManifest {
  name: string;
  description: string;
  version: string;
  api_spec: {
    openapi: '3.0.0';
    info: {
      title: string;
      version: string;
      description: string;
    };
    paths: Record<string, {
      post: {
        operationId: string;
        summary: string;
        description: string;
        requestBody: {
          required: boolean;
          content: {
            'application/json': {
              schema: Record<string, unknown>;
            };
          };
        };
        responses: Record<string, unknown>;
      };
    }>;
  };
  authentication?: {
    type: 'none' | 'api_key' | 'oauth2';
    config?: Record<string, unknown>;
  };
}

function generateGeminiExtensionManifest(fork: ToolFork, baseUrl: string): GeminiExtensionManifest {
  const operationId = fork.name.replace(/\./g, '_');
  const inputProps = fork.spec.inputSchema?.properties as Record<string, unknown> | undefined;
  const inputRequired = fork.spec.inputSchema?.required as string[] | undefined;
  
  const requestSchema: Record<string, unknown> = {
    type: 'object',
    properties: { ...(inputProps || {}) },
    required: inputRequired,
  };

  // Apply customizations
  if (fork.customizations.parameterOverrides) {
    for (const [param, override] of Object.entries(fork.customizations.parameterOverrides)) {
      if (override.hidden) {
        delete (requestSchema.properties as Record<string, unknown>)[param];
        if (Array.isArray(requestSchema.required)) {
          requestSchema.required = requestSchema.required.filter(r => r !== param);
        }
      }
    }
  }

  return {
    name: fork.name,
    description: fork.description,
    version: fork.version,
    api_spec: {
      openapi: '3.0.0',
      info: {
        title: fork.name,
        version: fork.version,
        description: fork.description,
      },
      paths: {
        [`/api/tools/${fork.id}/invoke`]: {
          post: {
            operationId,
            summary: fork.description,
            description: fork.description,
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: requestSchema,
                },
              },
            },
            responses: {
              '200': {
                description: 'Successful response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        data: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    authentication: {
      type: 'api_key',
      config: {
        header_name: 'X-API-Key',
      },
    },
  };
}

// ============================================================================
// OpenAI Function Adapter
// ============================================================================

interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

function generateOpenAIFunction(fork: ToolFork): OpenAIFunction {
  const inputProps = fork.spec.inputSchema?.properties as Record<string, unknown> | undefined;
  const inputRequired = fork.spec.inputSchema?.required as string[] | undefined;
  const properties: Record<string, unknown> = { ...(inputProps || {}) };
  let required = [...(inputRequired || [])];

  // Apply customizations
  if (fork.customizations.parameterOverrides) {
    for (const [param, override] of Object.entries(fork.customizations.parameterOverrides)) {
      if (override.hidden) {
        delete properties[param];
        required = required.filter(r => r !== param);
      }
    }
  }

  return {
    name: fork.name.replace(/\./g, '_'),
    description: fork.description,
    parameters: {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    },
  };
}

// ============================================================================
// Fork Manager
// ============================================================================

class ToolForkManager {
  private static instance: ToolForkManager | null = null;
  private forks: Map<string, ToolFork> = new Map();
  private forksByParent: Map<string, Set<string>> = new Map();

  private constructor() {}

  static getInstance(): ToolForkManager {
    if (!ToolForkManager.instance) {
      ToolForkManager.instance = new ToolForkManager();
    }
    return ToolForkManager.instance;
  }

  // -------------------------------------------------------------------------
  // CRUD Operations
  // -------------------------------------------------------------------------

  createFork(
    parentSpec: ToolSpec,
    platform: PlatformType,
    customizations: ToolCustomization,
    userId: string,
    name?: string,
    description?: string
  ): ToolFork {
    const id = `fork_${nanoid()}`;
    const now = Date.now();

    const fork: ToolFork = {
      id,
      parentId: parentSpec.name,
      name: name || `${parentSpec.name}_custom`,
      version: '1.0.0',
      description: description || parentSpec.description,
      platform,
      spec: parentSpec,
      customizations,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    this.forks.set(id, fork);

    // Track parent relationship
    if (!this.forksByParent.has(parentSpec.name)) {
      this.forksByParent.set(parentSpec.name, new Set());
    }
    this.forksByParent.get(parentSpec.name)!.add(id);

    return fork;
  }

  getFork(id: string): ToolFork | undefined {
    return this.forks.get(id);
  }

  updateFork(id: string, updates: Partial<Pick<ToolFork, 'name' | 'description' | 'customizations' | 'version'>>): ToolFork | undefined {
    const fork = this.forks.get(id);
    if (!fork) return undefined;

    const updated: ToolFork = {
      ...fork,
      ...updates,
      updatedAt: Date.now(),
    };

    this.forks.set(id, updated);
    return updated;
  }

  deleteFork(id: string): boolean {
    const fork = this.forks.get(id);
    if (!fork) return false;

    this.forks.delete(id);

    if (fork.parentId) {
      const siblings = this.forksByParent.get(fork.parentId);
      if (siblings) {
        siblings.delete(id);
      }
    }

    return true;
  }

  listForks(userId?: string, platform?: PlatformType): ToolFork[] {
    let forks = Array.from(this.forks.values());

    if (userId) {
      forks = forks.filter(f => f.createdBy === userId);
    }

    if (platform) {
      forks = forks.filter(f => f.platform === platform);
    }

    return forks.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getForksByParent(parentId: string): ToolFork[] {
    const forkIds = this.forksByParent.get(parentId);
    if (!forkIds) return [];

    return Array.from(forkIds)
      .map(id => this.forks.get(id))
      .filter((f): f is ToolFork => f !== undefined);
  }

  // -------------------------------------------------------------------------
  // Export Functions
  // -------------------------------------------------------------------------

  exportAsClaudeMCP(forkId: string): ClaudeMCPManifest | null {
    const fork = this.forks.get(forkId);
    if (!fork) return null;
    return generateClaudeMCPManifest(fork);
  }

  exportAsGeminiExtension(forkId: string, baseUrl: string): GeminiExtensionManifest | null {
    const fork = this.forks.get(forkId);
    if (!fork) return null;
    return generateGeminiExtensionManifest(fork, baseUrl);
  }

  exportAsOpenAIFunction(forkId: string): OpenAIFunction | null {
    const fork = this.forks.get(forkId);
    if (!fork) return null;
    return generateOpenAIFunction(fork);
  }

  exportAsPackage(forkId: string, baseUrl: string): {
    fork: ToolFork;
    formats: {
      claudeMCP: ClaudeMCPManifest;
      geminiExtension: GeminiExtensionManifest;
      openaiFunction: OpenAIFunction;
    };
  } | null {
    const fork = this.forks.get(forkId);
    if (!fork) return null;

    return {
      fork,
      formats: {
        claudeMCP: generateClaudeMCPManifest(fork),
        geminiExtension: generateGeminiExtensionManifest(fork, baseUrl),
        openaiFunction: generateOpenAIFunction(fork),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Diff & Compare
  // -------------------------------------------------------------------------

  compareForks(forkId1: string, forkId2: string): {
    added: string[];
    removed: string[];
    modified: string[];
  } | null {
    const fork1 = this.forks.get(forkId1);
    const fork2 = this.forks.get(forkId2);
    if (!fork1 || !fork2) return null;

    const params1 = new Set(Object.keys(fork1.spec.inputSchema?.properties || {}));
    const params2 = new Set(Object.keys(fork2.spec.inputSchema?.properties || {}));

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    for (const param of Array.from(params2)) {
      if (!params1.has(param)) {
        added.push(param);
      }
    }

    for (const param of Array.from(params1)) {
      if (!params2.has(param)) {
        removed.push(param);
      } else {
        // Check if modified
        const props1 = fork1.spec.inputSchema?.properties as Record<string, unknown> | undefined;
        const props2 = fork2.spec.inputSchema?.properties as Record<string, unknown> | undefined;
        const prop1 = props1?.[param];
        const prop2 = props2?.[param];
        if (JSON.stringify(prop1) !== JSON.stringify(prop2)) {
          modified.push(param);
        }
      }
    }

    return { added, removed, modified };
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getToolForkManager(): ToolForkManager {
  return ToolForkManager.getInstance();
}

export {
  generateClaudeMCPManifest,
  generateGeminiExtensionManifest,
  generateOpenAIFunction,
};

export type {
  ClaudeMCPManifest,
  ClaudeMCPTool,
  ClaudeMCPSkill,
  GeminiExtensionManifest,
  OpenAIFunction,
};
