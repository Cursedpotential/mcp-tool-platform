/**
 * Rules Engine Plugin
 * 
 * Provides rule-based content analysis:
 * - YAML/JSON rule set loading
 * - Regex, keyword, and path pattern matching
 * - Structural hints and semantic rules
 * - Action proposals (move/delete/merge/label)
 * - All actions require approval gating
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getContentStore } from '../store/content-store';
import type { RuleSet, Rule, RuleAction, RuleMatch, ContentRef } from '../../../shared/mcp-types';

// ============================================================================
// Rule Set Storage
// ============================================================================

const ruleSets: Map<string, RuleSet> = new Map();
const RULES_DIR = process.env.RULES_DIR ?? './data/rules';

/**
 * Load a rule set from file
 */
export async function loadRuleSet(args: { path: string }): Promise<{
  ruleSetId: string;
  name: string;
  ruleCount: number;
}> {
  const content = await fs.readFile(args.path, 'utf-8');
  const ext = path.extname(args.path).toLowerCase();

  let ruleSet: RuleSet;

  if (ext === '.json') {
    ruleSet = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    ruleSet = parseYamlRuleSet(content);
  } else {
    throw new Error(`Unsupported rule set format: ${ext}`);
  }

  // Validate and normalize
  validateRuleSet(ruleSet);
  ruleSets.set(ruleSet.id, ruleSet);

  return {
    ruleSetId: ruleSet.id,
    name: ruleSet.name,
    ruleCount: ruleSet.rules.length,
  };
}

/**
 * List available rule sets
 */
export async function listRuleSets(): Promise<{
  ruleSets: Array<{ id: string; name: string; description: string; ruleCount: number; enabled: boolean }>;
}> {
  const result: Array<{ id: string; name: string; description: string; ruleCount: number; enabled: boolean }> = [];

  ruleSets.forEach((rs) => {
    result.push({
      id: rs.id,
      name: rs.name,
      description: rs.description,
      ruleCount: rs.rules.length,
      enabled: rs.enabled,
    });
  });

  return { ruleSets: result };
}

/**
 * Describe a rule set in detail
 */
export async function describeRuleSet(args: { ruleSetId: string }): Promise<RuleSet | null> {
  return ruleSets.get(args.ruleSetId) ?? null;
}

/**
 * Evaluate rules against content
 */
export async function evaluateRules(args: {
  textRef: string;
  ruleSetId: string;
}): Promise<{
  matches: RuleMatch[];
  proposedActions: Array<{ ruleId: string; action: RuleAction; target: string }>;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);

  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const ruleSet = ruleSets.get(args.ruleSetId);
  if (!ruleSet) {
    throw new Error(`Rule set not found: ${args.ruleSetId}`);
  }

  if (!ruleSet.enabled) {
    return { matches: [], proposedActions: [] };
  }

  const matches: RuleMatch[] = [];
  const proposedActions: Array<{ ruleId: string; action: RuleAction; target: string }> = [];

  for (const rule of ruleSet.rules) {
    if (!rule.enabled) continue;

    const ruleMatches = evaluateRule(rule, text);
    matches.push(...ruleMatches);

    // Generate proposed actions for matches
    for (const match of ruleMatches) {
      proposedActions.push({
        ruleId: rule.id,
        action: rule.action,
        target: match.matchedText,
      });
    }
  }

  // Sort by priority
  matches.sort((a, b) => {
    const ruleA = ruleSet.rules.find((r) => r.id === a.ruleId);
    const ruleB = ruleSet.rules.find((r) => r.id === b.ruleId);
    return (ruleB?.priority ?? 0) - (ruleA?.priority ?? 0);
  });

  return { matches, proposedActions };
}

/**
 * Suggest appropriate rule set for content
 */
export async function suggestRuleSet(args: { textRef: string }): Promise<{
  suggestions: Array<{ ruleSetId: string; confidence: number; reason: string }>;
}> {
  const store = await getContentStore();
  const text = await store.getString(args.textRef as ContentRef);

  if (!text) {
    throw new Error(`Content not found: ${args.textRef}`);
  }

  const suggestions: Array<{ ruleSetId: string; confidence: number; reason: string }> = [];

  // Simple heuristic-based suggestion
  ruleSets.forEach((rs) => {
    let score = 0;
    let reason = '';

    // Check if any rules would match
    for (const rule of rs.rules) {
      if (!rule.enabled) continue;

      const matches = evaluateRule(rule, text.slice(0, 5000)); // Sample first 5KB
      if (matches.length > 0) {
        score += matches.length * 0.1;
        reason = `Found ${matches.length} potential matches`;
      }
    }

    if (score > 0) {
      suggestions.push({
        ruleSetId: rs.id,
        confidence: Math.min(score, 1),
        reason,
      });
    }
  });

  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return { suggestions: suggestions.slice(0, 5) };
}

/**
 * Create a new rule set
 */
export async function createRuleSet(args: {
  name: string;
  description: string;
  rules: Rule[];
}): Promise<{ ruleSetId: string }> {
  const id = `ruleset-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const ruleSet: RuleSet = {
    id,
    name: args.name,
    description: args.description,
    version: '1.0.0',
    rules: args.rules,
    enabled: true,
  };

  validateRuleSet(ruleSet);
  ruleSets.set(id, ruleSet);

  return { ruleSetId: id };
}

/**
 * Enable or disable a rule set
 */
export async function toggleRuleSet(args: { ruleSetId: string; enabled: boolean }): Promise<{
  success: boolean;
}> {
  const ruleSet = ruleSets.get(args.ruleSetId);
  if (!ruleSet) {
    throw new Error(`Rule set not found: ${args.ruleSetId}`);
  }

  ruleSet.enabled = args.enabled;
  return { success: true };
}

// ============================================================================
// Rule Evaluation
// ============================================================================

function evaluateRule(rule: Rule, text: string): RuleMatch[] {
  const matches: RuleMatch[] = [];

  switch (rule.type) {
    case 'regex':
      return evaluateRegexRule(rule, text);
    case 'keyword':
      return evaluateKeywordRule(rule, text);
    case 'path':
      return evaluatePathRule(rule, text);
    case 'structural':
      return evaluateStructuralRule(rule, text);
    case 'semantic':
      return evaluateSemanticRule(rule, text);
    default:
      return matches;
  }
}

function evaluateRegexRule(rule: Rule, text: string): RuleMatch[] {
  const matches: RuleMatch[] = [];

  try {
    const regex = new RegExp(rule.pattern, 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matchedText: match[0],
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        proposedAction: rule.action,
        confidence: 1.0,
      });

      // Prevent infinite loops on zero-length matches
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }
  } catch (error) {
    console.warn(`Invalid regex in rule ${rule.id}: ${rule.pattern}`);
  }

  return matches;
}

function evaluateKeywordRule(rule: Rule, text: string): RuleMatch[] {
  const matches: RuleMatch[] = [];
  const keywords = rule.pattern.split(',').map((k) => k.trim().toLowerCase());
  const textLower = text.toLowerCase();

  for (const keyword of keywords) {
    let idx = 0;
    while ((idx = textLower.indexOf(keyword, idx)) !== -1) {
      matches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matchedText: text.slice(idx, idx + keyword.length),
        startOffset: idx,
        endOffset: idx + keyword.length,
        proposedAction: rule.action,
        confidence: 0.9,
      });
      idx += keyword.length;
    }
  }

  return matches;
}

function evaluatePathRule(rule: Rule, text: string): RuleMatch[] {
  const matches: RuleMatch[] = [];

  // Path rules match file paths in text
  const pathPattern = rule.pattern.replace(/\*/g, '[^/\\s]*').replace(/\?/g, '[^/\\s]');
  const regex = new RegExp(pathPattern, 'gi');
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      ruleId: rule.id,
      ruleName: rule.name,
      matchedText: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      proposedAction: rule.action,
      confidence: 0.8,
    });
  }

  return matches;
}

function evaluateStructuralRule(rule: Rule, text: string): RuleMatch[] {
  const matches: RuleMatch[] = [];

  // Structural rules look for document patterns
  const structuralPatterns: Record<string, RegExp> = {
    'has-heading': /^#{1,6}\s+.+$/gm,
    'has-list': /^[-*+]\s+.+$/gm,
    'has-code-block': /```[\s\S]*?```/g,
    'has-table': /\|.+\|/g,
    'has-link': /\[.+\]\(.+\)/g,
    'has-image': /!\[.+\]\(.+\)/g,
  };

  const pattern = structuralPatterns[rule.pattern];
  if (pattern) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matchedText: match[0].slice(0, 100), // Truncate for token efficiency
        startOffset: match.index,
        endOffset: match.index + match[0].length,
        proposedAction: rule.action,
        confidence: 0.95,
      });
    }
  }

  return matches;
}

function evaluateSemanticRule(rule: Rule, text: string): RuleMatch[] {
  // Semantic rules would use NLP/embeddings - placeholder for now
  // In production, integrate with NLP plugin
  return [];
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseYamlRuleSet(content: string): RuleSet {
  // Simple YAML parser for rule sets
  const lines = content.split('\n');
  const ruleSet: Partial<RuleSet> = {
    rules: [],
  };

  let currentRule: Partial<Rule> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

    if (key === 'id') ruleSet.id = value;
    else if (key === 'name') ruleSet.name = value;
    else if (key === 'description') ruleSet.description = value;
    else if (key === 'version') ruleSet.version = value;
    else if (key === 'enabled') ruleSet.enabled = value === 'true';
    else if (key === '- id') {
      if (currentRule) {
        ruleSet.rules!.push(currentRule as Rule);
      }
      currentRule = { id: value };
    } else if (currentRule) {
      if (key === 'name') currentRule.name = value;
      else if (key === 'type') currentRule.type = value as Rule['type'];
      else if (key === 'pattern') currentRule.pattern = value;
      else if (key === 'priority') currentRule.priority = parseInt(value);
      else if (key === 'enabled') currentRule.enabled = value === 'true';
    }
  }

  if (currentRule) {
    ruleSet.rules!.push(currentRule as Rule);
  }

  return ruleSet as RuleSet;
}

function validateRuleSet(ruleSet: RuleSet): void {
  if (!ruleSet.id) {
    throw new Error('Rule set must have an id');
  }
  if (!ruleSet.name) {
    throw new Error('Rule set must have a name');
  }
  if (!Array.isArray(ruleSet.rules)) {
    throw new Error('Rule set must have a rules array');
  }

  for (const rule of ruleSet.rules) {
    if (!rule.id) {
      throw new Error('Each rule must have an id');
    }
    if (!rule.type) {
      throw new Error(`Rule ${rule.id} must have a type`);
    }
    if (!rule.pattern) {
      throw new Error(`Rule ${rule.id} must have a pattern`);
    }
    if (!rule.action) {
      // Default action
      rule.action = { type: 'flag', reason: 'Matched rule: ' + rule.name };
    }
    if (rule.priority === undefined) {
      rule.priority = 0;
    }
    if (rule.enabled === undefined) {
      rule.enabled = true;
    }
  }

  if (ruleSet.enabled === undefined) {
    ruleSet.enabled = true;
  }
}

// ============================================================================
// Initialize Built-in Rule Sets
// ============================================================================

async function initBuiltinRuleSets(): Promise<void> {
  // PII Detection Rule Set
  const piiRuleSet: RuleSet = {
    id: 'builtin-pii-detection',
    name: 'PII Detection',
    description: 'Detect personally identifiable information',
    version: '1.0.0',
    enabled: true,
    rules: [
      {
        id: 'pii-email',
        name: 'Email Address',
        type: 'regex',
        pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
        action: { type: 'flag', reason: 'Contains email address' },
        priority: 10,
        enabled: true,
      },
      {
        id: 'pii-phone',
        name: 'Phone Number',
        type: 'regex',
        pattern: '\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b',
        action: { type: 'flag', reason: 'Contains phone number' },
        priority: 10,
        enabled: true,
      },
      {
        id: 'pii-ssn',
        name: 'Social Security Number',
        type: 'regex',
        pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
        action: { type: 'flag', reason: 'Contains SSN' },
        priority: 20,
        enabled: true,
      },
      {
        id: 'pii-credit-card',
        name: 'Credit Card Number',
        type: 'regex',
        pattern: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b',
        action: { type: 'flag', reason: 'Contains credit card number' },
        priority: 20,
        enabled: true,
      },
    ],
  };

  ruleSets.set(piiRuleSet.id, piiRuleSet);

  // Code Quality Rule Set
  const codeQualityRuleSet: RuleSet = {
    id: 'builtin-code-quality',
    name: 'Code Quality',
    description: 'Detect code quality issues',
    version: '1.0.0',
    enabled: true,
    rules: [
      {
        id: 'code-todo',
        name: 'TODO Comment',
        type: 'keyword',
        pattern: 'TODO,FIXME,HACK,XXX',
        action: { type: 'label', labels: ['needs-attention'] },
        priority: 5,
        enabled: true,
      },
      {
        id: 'code-console-log',
        name: 'Console Log',
        type: 'regex',
        pattern: 'console\\.log\\s*\\(',
        action: { type: 'flag', reason: 'Contains console.log' },
        priority: 3,
        enabled: true,
      },
      {
        id: 'code-debugger',
        name: 'Debugger Statement',
        type: 'keyword',
        pattern: 'debugger',
        action: { type: 'flag', reason: 'Contains debugger statement' },
        priority: 10,
        enabled: true,
      },
    ],
  };

  ruleSets.set(codeQualityRuleSet.id, codeQualityRuleSet);
}

// Initialize on module load
initBuiltinRuleSets().catch(console.error);
