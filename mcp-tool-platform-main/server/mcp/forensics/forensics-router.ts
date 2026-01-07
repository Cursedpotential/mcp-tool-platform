/**
 * Forensics Router
 * 
 * tRPC router for Communication Pattern Analyzer and HurtLex features.
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../../_core/trpc';
import { patternAnalyzer, BUILT_IN_MODULES, BUILT_IN_PATTERNS } from './pattern-analyzer';
import { hurtlexFetcher, HURTLEX_CATEGORIES } from './hurtlex-fetcher';
import { getDb } from '../../db';
import { behavioralPatterns, patternCategories, forensicResults, mclFactors } from '../../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';

export const forensicsRouter = router({
  // ============================================================================
  // ANALYSIS MODULES
  // ============================================================================

  /**
   * Get available analysis modules
   */
  getModules: protectedProcedure.query(async () => {
    return {
      modules: BUILT_IN_MODULES,
      categories: {
        negative: BUILT_IN_MODULES.filter(m => m.category === 'negative'),
        positive: BUILT_IN_MODULES.filter(m => m.category === 'positive'),
        neutral: BUILT_IN_MODULES.filter(m => m.category === 'neutral')
      }
    };
  }),

  /**
   * Get pattern definitions for a module
   */
  getPatternDefinitions: protectedProcedure
    .input(z.object({ moduleId: z.string() }))
    .query(async ({ input }) => {
      const patterns = BUILT_IN_PATTERNS[input.moduleId];
      if (!patterns) {
        return { patterns: [], examples: [] };
      }
      return patterns;
    }),

  // ============================================================================
  // PATTERN ANALYSIS
  // ============================================================================

  /**
   * Analyze text for communication patterns
   */
  analyzeText: protectedProcedure
    .input(z.object({
      text: z.string().min(1),
      moduleIds: z.array(z.string()).optional(),
      saveResult: z.boolean().default(true)
    }))
    .mutation(async ({ ctx, input }) => {
      // Load user's custom patterns
      await patternAnalyzer.loadUserConfig(ctx.user.id);

      // Run analysis
      const result = await patternAnalyzer.analyze(input.text, {
        moduleIds: input.moduleIds,
        includeContext: true,
        contextChars: 150
      });

      // Save result if requested
      if (input.saveResult) {
        await patternAnalyzer.saveResult(ctx.user.id, result);
      }

      return result;
    }),

  /**
   * Get analysis history
   */
  getAnalysisHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { results: [], total: 0 };

      const results = await db
        .select()
        .from(forensicResults)
        .where(eq(forensicResults.userId, ctx.user.id))
        .orderBy(desc(forensicResults.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        results: results.map(r => ({
          id: r.id,
          sourceHash: r.sourceHash,
          sourceType: r.sourceType,
          analysisType: r.analysisType,
          matchCount: r.matchCount,
          severityScore: r.severityScore,
          mclFactorsMatched: r.mclFactorsMatched ? JSON.parse(r.mclFactorsMatched) : [],
          createdAt: r.createdAt
        })),
        total: results.length
      };
    }),

  /**
   * Get specific analysis result
   */
  getAnalysisResult: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const results = await db
        .select()
        .from(forensicResults)
        .where(and(
          eq(forensicResults.id, input.id),
          eq(forensicResults.userId, ctx.user.id)
        ))
        .limit(1);

      if (results.length === 0) return null;

      const r = results[0];
      return {
        ...r,
        results: r.results ? JSON.parse(r.results) : null,
        mclFactorsMatched: r.mclFactorsMatched ? JSON.parse(r.mclFactorsMatched) : []
      };
    }),

  // ============================================================================
  // CUSTOM PATTERNS
  // ============================================================================

  /**
   * Get user's custom patterns
   */
  getCustomPatterns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const patterns = await db
      .select()
      .from(behavioralPatterns)
      .where(eq(behavioralPatterns.userId, ctx.user.id))
      .orderBy(desc(behavioralPatterns.createdAt));

    return patterns.map(p => ({
      ...p,
      mclFactors: p.mclFactors ? JSON.parse(p.mclFactors) : [],
      examples: p.examples ? JSON.parse(p.examples) : []
    }));
  }),

  /**
   * Create custom pattern
   */
  createCustomPattern: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      category: z.string(),
      pattern: z.string().min(1),
      description: z.string().optional(),
      severity: z.number().min(0).max(100).default(50),
      mclFactors: z.array(z.string()).optional(),
      examples: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not initialized');

      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

      const result = await db.insert(behavioralPatterns).values({
        userId: ctx.user.id,
        name: input.name,
        category: input.category,
        pattern: input.pattern,
        description: input.description || null,
        severity: input.severity,
        mclFactors: input.mclFactors ? JSON.stringify(input.mclFactors) : null,
        examples: input.examples ? JSON.stringify(input.examples) : null,
        isActive: 'true',
        isCustom: 'true',
        matchCount: 0,
        createdAt: nowStr,
        updatedAt: nowStr
      });

      return { id: Number(result[0].insertId) };
    }),

  /**
   * Update custom pattern
   */
  updateCustomPattern: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      category: z.string().optional(),
      pattern: z.string().min(1).optional(),
      description: z.string().optional(),
      severity: z.number().min(0).max(100).optional(),
      mclFactors: z.array(z.string()).optional(),
      examples: z.array(z.string()).optional(),
      isActive: z.boolean().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not initialized');

      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const { id, ...updates } = input;

      const setData: Record<string, unknown> = { updatedAt: nowStr };
      if (updates.name !== undefined) setData.name = updates.name;
      if (updates.category !== undefined) setData.category = updates.category;
      if (updates.pattern !== undefined) setData.pattern = updates.pattern;
      if (updates.description !== undefined) setData.description = updates.description;
      if (updates.severity !== undefined) setData.severity = updates.severity;
      if (updates.mclFactors !== undefined) setData.mclFactors = JSON.stringify(updates.mclFactors);
      if (updates.examples !== undefined) setData.examples = JSON.stringify(updates.examples);
      if (updates.isActive !== undefined) setData.isActive = updates.isActive ? 'true' : 'false';

      await db
        .update(behavioralPatterns)
        .set(setData)
        .where(and(
          eq(behavioralPatterns.id, id),
          eq(behavioralPatterns.userId, ctx.user.id)
        ));

      return { success: true };
    }),

  /**
   * Delete custom pattern
   */
  deleteCustomPattern: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not initialized');

      await db
        .delete(behavioralPatterns)
        .where(and(
          eq(behavioralPatterns.id, input.id),
          eq(behavioralPatterns.userId, ctx.user.id),
          eq(behavioralPatterns.isCustom, 'true')
        ));

      return { success: true };
    }),

  // ============================================================================
  // PATTERN CATEGORIES
  // ============================================================================

  /**
   * Get pattern categories
   */
  getPatternCategories: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const categories = await db
      .select()
      .from(patternCategories)
      .where(eq(patternCategories.userId, ctx.user.id))
      .orderBy(patternCategories.sortOrder);

    return categories;
  }),

  /**
   * Create pattern category
   */
  createPatternCategory: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      icon: z.string().optional(),
      defaultSeverity: z.number().min(0).max(100).default(50)
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not initialized');

      const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

      // Get max sort order
      const existing = await db
        .select()
        .from(patternCategories)
        .where(eq(patternCategories.userId, ctx.user.id));
      const maxOrder = Math.max(0, ...existing.map(c => c.sortOrder));

      const result = await db.insert(patternCategories).values({
        userId: ctx.user.id,
        name: input.name,
        description: input.description || null,
        color: input.color || '#6366f1',
        icon: input.icon || null,
        defaultSeverity: input.defaultSeverity,
        isActive: 'true',
        sortOrder: maxOrder + 1,
        createdAt: nowStr,
        updatedAt: nowStr
      });

      return { id: Number(result[0].insertId) };
    }),

  // ============================================================================
  // HURTLEX
  // ============================================================================

  /**
   * Get HurtLex sync status
   */
  getHurtlexStatus: protectedProcedure.query(async () => {
    const statuses = await hurtlexFetcher.getAllSyncStatuses();
    return {
      statuses,
      supportedLanguages: ['EN', 'IT', 'ES', 'DE', 'FR', 'PT', 'RO', 'SL', 'HR', 'SQ', 'NL', 'PL'],
      categories: HURTLEX_CATEGORIES
    };
  }),

  /**
   * Sync HurtLex from GitHub
   */
  syncHurtlex: protectedProcedure
    .input(z.object({
      language: z.string().length(2),
      level: z.enum(['conservative', 'inclusive']).default('inclusive')
    }))
    .mutation(async ({ ctx, input }) => {
      const termCount = await hurtlexFetcher.syncToDatabase(
        input.language,
        ctx.user.id,
        input.level
      );
      return { termCount };
    }),

  /**
   * Get HurtLex terms
   */
  getHurtlexTerms: protectedProcedure
    .input(z.object({
      language: z.string().length(2),
      categories: z.array(z.string()).optional(),
      limit: z.number().min(1).max(1000).default(100),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input }) => {
      const terms = await hurtlexFetcher.getTerms(input.language, input.categories);
      return {
        terms: terms.slice(input.offset, input.offset + input.limit),
        total: terms.length
      };
    }),

  /**
   * Get HurtLex categories with counts
   */
  getHurtlexCategories: protectedProcedure.query(async ({ ctx }) => {
    return await hurtlexFetcher.getCategories(ctx.user.id);
  }),

  /**
   * Toggle HurtLex category
   */
  toggleHurtlexCategory: protectedProcedure
    .input(z.object({
      categoryCode: z.string(),
      isActive: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      await hurtlexFetcher.toggleCategory(ctx.user.id, input.categoryCode, input.isActive);
      return { success: true };
    }),

  /**
   * Add custom HurtLex term
   */
  addHurtlexTerm: protectedProcedure
    .input(z.object({
      term: z.string().min(1),
      category: z.string(),
      language: z.string().length(2).default('EN')
    }))
    .mutation(async ({ ctx, input }) => {
      await hurtlexFetcher.addCustomTerm(ctx.user.id, {
        term: input.term,
        category: input.category,
        language: input.language
      });
      return { success: true };
    }),

  // ============================================================================
  // MCL FACTORS
  // ============================================================================

  /**
   * Get MCL 722.23 factors
   */
  getMclFactors: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const factors = await db.select().from(mclFactors);
    
    // Return built-in factors if none in DB
    if (factors.length === 0) {
      return MCL_FACTORS;
    }

    return factors.map(f => ({
      letter: f.factorLetter,
      name: f.name,
      description: f.description,
      keywords: f.keywords ? JSON.parse(f.keywords) : [],
      patternCategories: f.patternCategories ? JSON.parse(f.patternCategories) : []
    }));
  })
});

// Built-in MCL 722.23 factors
const MCL_FACTORS = [
  { letter: 'a', name: 'Love, Affection, and Emotional Ties', description: 'The love, affection, and other emotional ties existing between the parties involved and the child.' },
  { letter: 'b', name: 'Capacity to Continue Education', description: 'The capacity and disposition of the parties involved to give the child love, affection, and guidance and to continue the education and raising of the child in his or her religion or creed.' },
  { letter: 'c', name: 'Capacity to Provide', description: 'The capacity and disposition of the parties involved to provide the child with food, clothing, medical care or other remedial care.' },
  { letter: 'd', name: 'Length of Time in Environment', description: 'The length of time the child has lived in a stable, satisfactory environment, and the desirability of maintaining continuity.' },
  { letter: 'e', name: 'Permanence of Family Unit', description: 'The permanence, as a family unit, of the existing or proposed custodial home or homes.' },
  { letter: 'f', name: 'Moral Fitness', description: 'The moral fitness of the parties involved.' },
  { letter: 'g', name: 'Mental and Physical Health', description: 'The mental and physical health of the parties involved.' },
  { letter: 'h', name: 'Home, School, and Community Record', description: 'The home, school, and community record of the child.' },
  { letter: 'i', name: 'Reasonable Preference of Child', description: 'The reasonable preference of the child, if the court considers the child to be of sufficient age to express preference.' },
  { letter: 'j', name: 'Domestic Violence', description: 'The willingness and ability of each of the parties to facilitate and encourage a close and continuing parent-child relationship between the child and the other parent or the child and the parents. A court may not consider negatively for the purposes of this factor any reasonable action taken by a parent to protect a child or that parent from sexual assault or domestic violence by the child\'s other parent.' },
  { letter: 'k', name: 'Willingness to Facilitate Relationship', description: 'Domestic violence, regardless of whether the violence was directed against or witnessed by the child.' },
  { letter: 'l', name: 'Other Factors', description: 'Any other factor considered by the court to be relevant to a particular child custody dispute.' }
];
