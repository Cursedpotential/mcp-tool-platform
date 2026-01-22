// File: server/mcp/prompts/prompt-manager.ts | Date: 2026-01-22 | Agent: Antigravity
import { getMySqlDb } from "../../core/db.mysql";
import {
  systemPrompts,
  workflowTemplates,
} from "../../../drizzle/prompts-schema";
import { eq, and, desc, sql, or } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface PromptVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

export interface PromptVersion {
  id: number;
  version: number;
  promptText: string;
  createdAt: string;
  successRate: number;
  avgLatencyMs: number;
  usageCount: number;
}

export interface WorkflowStep {
  toolName: string;
  description: string;
  inputMapping: Record<string, string>;
  outputKey: string;
  optional?: boolean;
  condition?: string;
}

export interface CreatePromptRequest {
  userId: number;
  name: string;
  description?: string;
  toolName?: string;
  promptText: string;
  variables?: PromptVariable[];
}

export interface CreateWorkflowRequest {
  userId: number;
  name: string;
  description?: string;
  category?: string;
  steps: WorkflowStep[];
  systemPromptId?: number;
  isPublic?: boolean;
}

// ============================================================================
// Default Prompts
// ============================================================================

export const DEFAULT_TOOL_PROMPTS: Record<string, string> = {
  "document.convert": `Convert the document to the specified format.
Input: {{filePath}} - Path to the source document
Output format: {{format}} - Target format (markdown, text, html)

Guidelines:
- Preserve document structure (headings, lists, tables)
- Handle images by extracting alt text or descriptions
- Maintain code blocks with proper syntax highlighting
- Clean up formatting artifacts`,

  "document.ocr": `Extract text from image or scanned document using OCR.
Input: {{filePath}} - Path to image or PDF
Language: {{language}} - Expected language (default: auto-detect)

Guidelines:
- Use preprocessing for better accuracy (deskew, denoise)
- Preserve layout structure where possible
- Flag low-confidence regions
- Handle multi-column layouts`,

  "nlp.extract_entities": `Extract named entities from the provided text.
Text: {{text}}
Entity types: {{entityTypes}} - Types to extract (PERSON, ORG, LOCATION, DATE, etc.)

Guidelines:
- Return structured JSON with entity text, type, and position
- Include confidence scores
- Handle coreference (he/she/they → actual entity)
- Deduplicate entities across the text`,

  "nlp.extract_keywords": `Extract important keywords and phrases from text.
Text: {{text}}
Max keywords: {{maxKeywords}} - Maximum number to return (default: 20)

Guidelines:
- Use TF-IDF or similar ranking
- Include both single words and phrases
- Return with relevance scores
- Filter out common stop words`,

  "summarization.map_reduce": `Summarize a large document using hierarchical map-reduce.
Document ref: {{documentRef}}
Target length: {{targetLength}} - Approximate output length
Style: {{style}} - Summary style (executive, detailed, bullet-points)

Guidelines:
- Split into chunks, summarize each, then combine
- Preserve key facts and citations
- Maintain logical flow
- Aim for 85%+ token reduction`,

  "search.ripgrep": `Search files using ripgrep with the given pattern.
Pattern: {{pattern}} - Regex or literal search pattern
Path: {{path}} - Directory or file to search
Options: {{options}} - Additional ripgrep flags

Guidelines:
- Return matches with file path, line number, and context
- Respect .gitignore by default
- Stream results for large searches
- Include match highlighting`,
};

// ============================================================================
// Prompt CRUD
// ============================================================================

/**
 * Create a new system prompt
 */
export async function createPrompt(
  request: CreatePromptRequest
): Promise<any> {
  const db = await getMySqlDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(systemPrompts).values({
    userId: request.userId,
    name: request.name,
    description: request.description,
    toolName: request.toolName,
    promptText: request.promptText,
    variables: request.variables
      ? JSON.stringify(request.variables)
      : undefined,
    version: 1,
    isActive: "true",
  });

  const [created] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, result.insertId))
    .limit(1);

  if (!created) throw new Error("Failed to retrieve created prompt");

  return created;
}

/**
 * List prompts for a user
 */
export async function listPrompts(
  userId: number,
  toolName?: string
): Promise<any[]> {
  const db = await getMySqlDb();
  if (!db) return [];

  const conditions = [eq(systemPrompts.userId, userId)];
  if (toolName) {
    conditions.push(eq(systemPrompts.toolName, toolName));
  }

  return await db
    .select()
    .from(systemPrompts)
    .where(and(...conditions))
    .orderBy(desc(systemPrompts.createdAt));
}

/**
 * Get prompt by ID
 */
export async function getPromptById(id: number): Promise<any | null> {
  const db = await getMySqlDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, id))
    .limit(1);
  return result[0] || null;
}

/**
 * Get active prompt for a tool
 */
export async function getActivePromptForTool(
  userId: number,
  toolName: string
): Promise<any | null> {
  const db = await getMySqlDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(systemPrompts)
    .where(
      and(
        eq(systemPrompts.userId, userId),
        eq(systemPrompts.toolName, toolName),
        eq(systemPrompts.isActive, "true")
      )
    )
    .orderBy(desc(systemPrompts.version))
    .limit(1);

  return result[0] || null;
}

/**
 * Update a prompt (creates new version)
 */
export async function updatePrompt(
  id: number,
  userId: number,
  updates: { promptText?: string; name?: string; description?: string }
): Promise<any | null> {
  const db = await getMySqlDb();
  if (!db) return null;

  const existing = await getPromptById(id);
  if (!existing || existing.userId !== userId) return null;

  // Deactivate old version
  await db
    .update(systemPrompts)
    .set({ isActive: "false", updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(systemPrompts.id, id));

  // Insert new version
  const [result] = await db.insert(systemPrompts).values({
    userId,
    name: updates.name || existing.name,
    description: updates.description || existing.description,
    toolName: existing.toolName,
    promptText: updates.promptText || existing.promptText,
    variables: existing.variables,
    version: existing.version + 1,
    parentId: existing.id,
    isActive: "true",
  });

  const [created] = await db
    .select()
    .from(systemPrompts)
    .where(eq(systemPrompts.id, result.insertId))
    .limit(1);

  return created || null;
}

/**
 * Get version history for a prompt
 */
export async function getPromptVersionHistory(
  promptId: number
): Promise<PromptVersion[]> {
  const db = await getMySqlDb();
  if (!db) return [];

  const prompt = await getPromptById(promptId);
  if (!prompt) return [];

  const result = await db
    .select()
    .from(systemPrompts)
    .where(
      or(
        eq(systemPrompts.id, promptId),
        eq(systemPrompts.parentId, promptId)
      )
    )
    .orderBy(desc(systemPrompts.version));

  return result.map((p: any) => ({
    id: p.id,
    version: p.version,
    promptText: p.promptText,
    createdAt: p.createdAt,
    successRate: p.successRate || 0,
    avgLatencyMs: p.avgLatencyMs || 0,
    usageCount: p.usageCount || 0,
  }));
}

/**
 * Delete a prompt
 */
export async function deletePrompt(
  id: number,
  userId: number
): Promise<boolean> {
  const db = await getMySqlDb();
  if (!db) return false;

  const [result] = await db
    .delete(systemPrompts)
    .where(and(eq(systemPrompts.id, id), eq(systemPrompts.userId, userId)));

  return result.affectedRows > 0;
}

/**
 * Record prompt usage for metrics
 */
export async function recordPromptUsage(
  promptId: number,
  success: boolean,
  latencyMs: number
): Promise<void> {
  const db = await getMySqlDb();
  if (!db) return;

  const prompt = await getPromptById(promptId);
  if (!prompt) return;

  const newUsageCount = (prompt.usageCount || 0) + 1;
  const successCount =
    ((prompt.successRate || 0) / 100) * (prompt.usageCount || 0) +
    (success ? 1 : 0);
  const newSuccessRate = Math.round((successCount / newUsageCount) * 100);
  const newAvgLatency = Math.round(
    ((prompt.avgLatencyMs || 0) * (prompt.usageCount || 0) + latencyMs) /
    newUsageCount
  );

  await db
    .update(systemPrompts)
    .set({
      usageCount: newUsageCount,
      successRate: newSuccessRate,
      avgLatencyMs: newAvgLatency,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(systemPrompts.id, promptId));
}

// ============================================================================
// Workflow CRUD
// ============================================================================

/**
 * Create a new workflow template
 */
export async function createWorkflow(
  request: CreateWorkflowRequest
): Promise<any> {
  const db = await getMySqlDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(workflowTemplates).values({
    userId: request.userId,
    name: request.name,
    description: request.description,
    category: request.category,
    steps: JSON.stringify(request.steps),
    systemPromptId: request.systemPromptId,
    isPublic: request.isPublic ? "true" : "false",
  });

  const [created] = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.id, result.insertId))
    .limit(1);

  if (!created) throw new Error("Failed to retrieve created workflow");

  return created;
}

/**
 * List workflows for a user
 */
export async function listWorkflows(
  userId: number,
  category?: string
): Promise<any[]> {
  const db = await getMySqlDb();
  if (!db) return [];

  const conditions = [eq(workflowTemplates.userId, userId)];
  if (category) {
    conditions.push(eq(workflowTemplates.category, category));
  }

  return await db
    .select()
    .from(workflowTemplates)
    .where(and(...conditions))
    .orderBy(desc(workflowTemplates.createdAt));
}

/**
 * Get workflow by ID
 */
export async function getWorkflowById(
  id: number
): Promise<any | null> {
  const db = await getMySqlDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.id, id))
    .limit(1);
  return result[0] || null;
}

/**
 * Update a workflow
 */
export async function updateWorkflow(
  id: number,
  userId: number,
  updates: Partial<CreateWorkflowRequest>
): Promise<any | null> {
  const db = await getMySqlDb();
  if (!db) return null;

  const updateData: any = {};
  if (updates.name) updateData.name = updates.name;
  if (updates.description !== undefined)
    updateData.description = updates.description;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.steps) updateData.steps = JSON.stringify(updates.steps);
  if (updates.systemPromptId !== undefined)
    updateData.systemPromptId = updates.systemPromptId;
  if (updates.isPublic !== undefined)
    updateData.isPublic = updates.isPublic ? "true" : "false";

  updateData.updatedAt = sql`CURRENT_TIMESTAMP`;

  await db
    .update(workflowTemplates)
    .set(updateData)
    .where(and(eq(workflowTemplates.id, id), eq(workflowTemplates.userId, userId)));

  return getWorkflowById(id);
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(
  id: number,
  userId: number
): Promise<boolean> {
  const db = await getMySqlDb();
  if (!db) return false;

  const [result] = await db
    .delete(workflowTemplates)
    .where(
      and(eq(workflowTemplates.id, id), eq(workflowTemplates.userId, userId))
    );

  return result.affectedRows > 0;
}

// ============================================================================
// Template Rendering
// ============================================================================

/**
 * Render a prompt template with variables
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string>
): string {
  let rendered = template;

  for (const [key, value] of Object.entries(variables) as [string, string][]) {
    const regex = new RegExp(`\\\\{\\\\{\\\\s*${key}\\\\s*\\\\}\\\\}`, "g");
    rendered = rendered.replace(regex, value);
  }

  return rendered;
}

/**
 * Extract variables from a prompt template
 */
export function extractVariables(template: string): string[] {
  const regex = /\\\\{\\\\{\\\\s*(\\\\w+)\\\\s*\\\\}\\\\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }

  return variables;
}

/**
 * Get default prompt for a tool
 */
export function getDefaultPrompt(toolName: string): string | null {
  return DEFAULT_TOOL_PROMPTS[toolName] || null;
}
