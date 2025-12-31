/**
 * Configuration Manager
 * 
 * Manages all configurable aspects of the MCP Tool Platform:
 * - Tool definitions and patterns
 * - Behavioral analysis definitions
 * - Custom dictionaries
 * - LLM provider settings
 * - Import/export of all configurations
 */

import { nanoid } from 'nanoid';
import { getContentStore } from '../store/content-store';

// ============================================================================
// Types
// ============================================================================

export interface PatternDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  patterns: Pattern[];
  enabled: boolean;
  version: string;
  createdAt: number;
  updatedAt: number;
}

export interface Pattern {
  id: string;
  type: 'regex' | 'keyword' | 'phrase' | 'semantic';
  value: string;
  flags?: string; // For regex: 'gi', 'gm', etc.
  weight: number; // Importance weight 0-1
  metadata?: Record<string, unknown>;
}

export interface BehavioralDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  indicators: BehavioralIndicator[];
  thresholds: {
    low: number;
    medium: number;
    high: number;
  };
  enabled: boolean;
  version: string;
  createdAt: number;
  updatedAt: number;
}

export interface BehavioralIndicator {
  id: string;
  name: string;
  type: 'keyword' | 'pattern' | 'sentiment' | 'frequency' | 'context';
  value: string | string[];
  weight: number;
  polarity: 'positive' | 'negative' | 'neutral';
}

export interface CustomDictionary {
  id: string;
  name: string;
  description: string;
  language: string;
  entries: DictionaryEntry[];
  version: string;
  createdAt: number;
  updatedAt: number;
}

export interface DictionaryEntry {
  term: string;
  definition?: string;
  synonyms?: string[];
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolConfig {
  id: string;
  toolName: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  version: string;
  updatedAt: number;
}

export interface LLMProviderSettings {
  provider: string;
  enabled: boolean;
  apiKey?: string; // Stored encrypted
  baseUrl?: string;
  defaultModel?: string;
  embeddingModel?: string;
  priority: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  costTracking: boolean;
}

export interface ConfigExport {
  version: string;
  exportedAt: number;
  patterns: PatternDefinition[];
  behaviors: BehavioralDefinition[];
  dictionaries: CustomDictionary[];
  tools: ToolConfig[];
  llmProviders: LLMProviderSettings[];
  metadata: Record<string, unknown>;
}

export interface ConfigSchema {
  type: string;
  version: string;
  schema: Record<string, unknown>;
}

// ============================================================================
// Configuration Manager Class
// ============================================================================

class ConfigurationManager {
  private patterns: Map<string, PatternDefinition> = new Map();
  private behaviors: Map<string, BehavioralDefinition> = new Map();
  private dictionaries: Map<string, CustomDictionary> = new Map();
  private toolConfigs: Map<string, ToolConfig> = new Map();
  private llmProviders: Map<string, LLMProviderSettings> = new Map();

  // ============================================================================
  // Pattern Definitions
  // ============================================================================

  createPattern(definition: Omit<PatternDefinition, 'id' | 'createdAt' | 'updatedAt'>): PatternDefinition {
    const now = Date.now();
    const pattern: PatternDefinition = {
      ...definition,
      id: nanoid(),
      createdAt: now,
      updatedAt: now,
    };
    this.patterns.set(pattern.id, pattern);
    return pattern;
  }

  updatePattern(id: string, updates: Partial<PatternDefinition>): PatternDefinition | null {
    const existing = this.patterns.get(id);
    if (!existing) return null;

    const updated: PatternDefinition = {
      ...existing,
      ...updates,
      id, // Preserve ID
      updatedAt: Date.now(),
    };
    this.patterns.set(id, updated);
    return updated;
  }

  deletePattern(id: string): boolean {
    return this.patterns.delete(id);
  }

  getPattern(id: string): PatternDefinition | undefined {
    return this.patterns.get(id);
  }

  listPatterns(category?: string): PatternDefinition[] {
    const all = Array.from(this.patterns.values());
    if (category) {
      return all.filter(p => p.category === category);
    }
    return all;
  }

  // ============================================================================
  // Behavioral Definitions
  // ============================================================================

  createBehavior(definition: Omit<BehavioralDefinition, 'id' | 'createdAt' | 'updatedAt'>): BehavioralDefinition {
    const now = Date.now();
    const behavior: BehavioralDefinition = {
      ...definition,
      id: nanoid(),
      createdAt: now,
      updatedAt: now,
    };
    this.behaviors.set(behavior.id, behavior);
    return behavior;
  }

  updateBehavior(id: string, updates: Partial<BehavioralDefinition>): BehavioralDefinition | null {
    const existing = this.behaviors.get(id);
    if (!existing) return null;

    const updated: BehavioralDefinition = {
      ...existing,
      ...updates,
      id,
      updatedAt: Date.now(),
    };
    this.behaviors.set(id, updated);
    return updated;
  }

  deleteBehavior(id: string): boolean {
    return this.behaviors.delete(id);
  }

  getBehavior(id: string): BehavioralDefinition | undefined {
    return this.behaviors.get(id);
  }

  listBehaviors(category?: string): BehavioralDefinition[] {
    const all = Array.from(this.behaviors.values());
    if (category) {
      return all.filter(b => b.category === category);
    }
    return all;
  }

  // ============================================================================
  // Custom Dictionaries
  // ============================================================================

  createDictionary(dictionary: Omit<CustomDictionary, 'id' | 'createdAt' | 'updatedAt'>): CustomDictionary {
    const now = Date.now();
    const dict: CustomDictionary = {
      ...dictionary,
      id: nanoid(),
      createdAt: now,
      updatedAt: now,
    };
    this.dictionaries.set(dict.id, dict);
    return dict;
  }

  updateDictionary(id: string, updates: Partial<CustomDictionary>): CustomDictionary | null {
    const existing = this.dictionaries.get(id);
    if (!existing) return null;

    const updated: CustomDictionary = {
      ...existing,
      ...updates,
      id,
      updatedAt: Date.now(),
    };
    this.dictionaries.set(id, updated);
    return updated;
  }

  deleteDictionary(id: string): boolean {
    return this.dictionaries.delete(id);
  }

  getDictionary(id: string): CustomDictionary | undefined {
    return this.dictionaries.get(id);
  }

  listDictionaries(language?: string): CustomDictionary[] {
    const all = Array.from(this.dictionaries.values());
    if (language) {
      return all.filter(d => d.language === language);
    }
    return all;
  }

  // ============================================================================
  // Tool Configurations
  // ============================================================================

  setToolConfig(toolName: string, config: Partial<ToolConfig>): ToolConfig {
    const existing = this.toolConfigs.get(toolName);
    const updated: ToolConfig = {
      id: existing?.id || nanoid(),
      toolName,
      enabled: config.enabled ?? existing?.enabled ?? true,
      settings: { ...existing?.settings, ...config.settings },
      overrides: config.overrides ?? existing?.overrides,
      version: config.version ?? existing?.version ?? '1.0.0',
      updatedAt: Date.now(),
    };
    this.toolConfigs.set(toolName, updated);
    return updated;
  }

  getToolConfig(toolName: string): ToolConfig | undefined {
    return this.toolConfigs.get(toolName);
  }

  listToolConfigs(): ToolConfig[] {
    return Array.from(this.toolConfigs.values());
  }

  // ============================================================================
  // LLM Provider Settings
  // ============================================================================

  setLLMProvider(provider: string, settings: Partial<LLMProviderSettings>): LLMProviderSettings {
    const existing = this.llmProviders.get(provider);
    const updated: LLMProviderSettings = {
      provider,
      enabled: settings.enabled ?? existing?.enabled ?? false,
      apiKey: settings.apiKey ?? existing?.apiKey,
      baseUrl: settings.baseUrl ?? existing?.baseUrl,
      defaultModel: settings.defaultModel ?? existing?.defaultModel,
      embeddingModel: settings.embeddingModel ?? existing?.embeddingModel,
      priority: settings.priority ?? existing?.priority ?? 100,
      rateLimit: settings.rateLimit ?? existing?.rateLimit,
      costTracking: settings.costTracking ?? existing?.costTracking ?? true,
    };
    this.llmProviders.set(provider, updated);
    return updated;
  }

  getLLMProvider(provider: string): LLMProviderSettings | undefined {
    return this.llmProviders.get(provider);
  }

  listLLMProviders(): LLMProviderSettings[] {
    return Array.from(this.llmProviders.values());
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  async exportAll(): Promise<ConfigExport> {
    return {
      version: '1.0.0',
      exportedAt: Date.now(),
      patterns: this.listPatterns(),
      behaviors: this.listBehaviors(),
      dictionaries: this.listDictionaries(),
      tools: this.listToolConfigs(),
      llmProviders: this.listLLMProviders().map(p => ({
        ...p,
        apiKey: undefined, // Never export API keys
      })),
      metadata: {
        totalPatterns: this.patterns.size,
        totalBehaviors: this.behaviors.size,
        totalDictionaries: this.dictionaries.size,
        totalTools: this.toolConfigs.size,
        totalProviders: this.llmProviders.size,
      },
    };
  }

  async importAll(config: ConfigExport, options: { merge?: boolean; overwrite?: boolean } = {}): Promise<{
    imported: { patterns: number; behaviors: number; dictionaries: number; tools: number; providers: number };
    errors: string[];
  }> {
    const errors: string[] = [];
    const imported = { patterns: 0, behaviors: 0, dictionaries: 0, tools: 0, providers: 0 };

    // Clear existing if not merging
    if (!options.merge) {
      this.patterns.clear();
      this.behaviors.clear();
      this.dictionaries.clear();
      this.toolConfigs.clear();
      // Don't clear LLM providers - they have API keys
    }

    // Import patterns
    for (const pattern of config.patterns || []) {
      try {
        if (options.overwrite || !this.patterns.has(pattern.id)) {
          this.patterns.set(pattern.id, pattern);
          imported.patterns++;
        }
      } catch (e) {
        errors.push(`Pattern ${pattern.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Import behaviors
    for (const behavior of config.behaviors || []) {
      try {
        if (options.overwrite || !this.behaviors.has(behavior.id)) {
          this.behaviors.set(behavior.id, behavior);
          imported.behaviors++;
        }
      } catch (e) {
        errors.push(`Behavior ${behavior.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Import dictionaries
    for (const dict of config.dictionaries || []) {
      try {
        if (options.overwrite || !this.dictionaries.has(dict.id)) {
          this.dictionaries.set(dict.id, dict);
          imported.dictionaries++;
        }
      } catch (e) {
        errors.push(`Dictionary ${dict.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Import tool configs
    for (const tool of config.tools || []) {
      try {
        if (options.overwrite || !this.toolConfigs.has(tool.toolName)) {
          this.toolConfigs.set(tool.toolName, tool);
          imported.tools++;
        }
      } catch (e) {
        errors.push(`Tool ${tool.toolName}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Import LLM providers (without API keys)
    for (const provider of config.llmProviders || []) {
      try {
        const existing = this.llmProviders.get(provider.provider);
        this.llmProviders.set(provider.provider, {
          ...provider,
          apiKey: existing?.apiKey, // Preserve existing API key
        });
        imported.providers++;
      } catch (e) {
        errors.push(`Provider ${provider.provider}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    return { imported, errors };
  }

  // ============================================================================
  // Schema Definitions
  // ============================================================================

  getSchemas(): ConfigSchema[] {
    return [
      {
        type: 'pattern',
        version: '1.0.0',
        schema: {
          type: 'object',
          required: ['name', 'category', 'patterns'],
          properties: {
            name: { type: 'string', description: 'Pattern set name' },
            description: { type: 'string' },
            category: { type: 'string', description: 'Category for organization' },
            patterns: {
              type: 'array',
              items: {
                type: 'object',
                required: ['type', 'value'],
                properties: {
                  type: { type: 'string', enum: ['regex', 'keyword', 'phrase', 'semantic'] },
                  value: { type: 'string' },
                  flags: { type: 'string' },
                  weight: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
            },
            enabled: { type: 'boolean', default: true },
          },
        },
      },
      {
        type: 'behavior',
        version: '1.0.0',
        schema: {
          type: 'object',
          required: ['name', 'category', 'indicators', 'thresholds'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            indicators: {
              type: 'array',
              items: {
                type: 'object',
                required: ['name', 'type', 'value'],
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['keyword', 'pattern', 'sentiment', 'frequency', 'context'] },
                  value: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
                  weight: { type: 'number', minimum: 0, maximum: 1 },
                  polarity: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
                },
              },
            },
            thresholds: {
              type: 'object',
              required: ['low', 'medium', 'high'],
              properties: {
                low: { type: 'number' },
                medium: { type: 'number' },
                high: { type: 'number' },
              },
            },
            enabled: { type: 'boolean', default: true },
          },
        },
      },
      {
        type: 'dictionary',
        version: '1.0.0',
        schema: {
          type: 'object',
          required: ['name', 'language', 'entries'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            language: { type: 'string', description: 'ISO 639-1 language code' },
            entries: {
              type: 'array',
              items: {
                type: 'object',
                required: ['term'],
                properties: {
                  term: { type: 'string' },
                  definition: { type: 'string' },
                  synonyms: { type: 'array', items: { type: 'string' } },
                  category: { type: 'string' },
                },
              },
            },
          },
        },
      },
      {
        type: 'llm_provider',
        version: '1.0.0',
        schema: {
          type: 'object',
          required: ['provider'],
          properties: {
            provider: { type: 'string', description: 'Provider identifier' },
            enabled: { type: 'boolean', default: false },
            baseUrl: { type: 'string', format: 'uri' },
            defaultModel: { type: 'string' },
            embeddingModel: { type: 'string' },
            priority: { type: 'number', minimum: 1, description: 'Lower = higher priority' },
            rateLimit: {
              type: 'object',
              properties: {
                requestsPerMinute: { type: 'number' },
                tokensPerMinute: { type: 'number' },
              },
            },
            costTracking: { type: 'boolean', default: true },
          },
        },
      },
    ];
  }

  // ============================================================================
  // Validation
  // ============================================================================

  validatePattern(pattern: Partial<PatternDefinition>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!pattern.name) errors.push('Name is required');
    if (!pattern.category) errors.push('Category is required');
    if (!pattern.patterns || pattern.patterns.length === 0) {
      errors.push('At least one pattern is required');
    }

    // Validate regex patterns
    for (const p of pattern.patterns || []) {
      if (p.type === 'regex') {
        try {
          new RegExp(p.value, p.flags);
        } catch (e) {
          errors.push(`Invalid regex: ${p.value}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  validateBehavior(behavior: Partial<BehavioralDefinition>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!behavior.name) errors.push('Name is required');
    if (!behavior.category) errors.push('Category is required');
    if (!behavior.indicators || behavior.indicators.length === 0) {
      errors.push('At least one indicator is required');
    }
    if (!behavior.thresholds) {
      errors.push('Thresholds are required');
    } else {
      if (behavior.thresholds.low >= behavior.thresholds.medium) {
        errors.push('Low threshold must be less than medium');
      }
      if (behavior.thresholds.medium >= behavior.thresholds.high) {
        errors.push('Medium threshold must be less than high');
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let managerInstance: ConfigurationManager | null = null;

export function getConfigManager(): ConfigurationManager {
  if (!managerInstance) {
    managerInstance = new ConfigurationManager();
  }
  return managerInstance;
}

export { ConfigurationManager };
