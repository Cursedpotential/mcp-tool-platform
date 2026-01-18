// File: server/api/routers/patterns.ts | Date: 2026-01-11 | Agent: Claude Code | Model: Opus 4.1
import { z } from "zod";
import { protectedProcedure, router } from "../../core/trpc";
import { getDb } from "../../core/db";
import { behavioralPatterns, patternCategories } from "../../../drizzle/schema";
import { eq, and, or, isNull, like, count, gt, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const patternsRouter = router({
  // ============================================================================
  // Pattern CRUD Operations
  // ============================================================================

  list: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(50),
        search: z.string().optional(),
        category: z.string().optional(),
        severityMin: z.number().optional(),
        severityMax: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      const conditions = [
        or(
          eq(behavioralPatterns.userId, ctx.user.id),
          isNull(behavioralPatterns.userId)
        )
      ];

      if (input.search) {
        conditions.push(
          or(
            like(behavioralPatterns.name, `%${input.search}%`),
            like(behavioralPatterns.description, `%${input.search}%`)
          )
        );
      }

      if (input.category) {
        conditions.push(eq(behavioralPatterns.category, input.category));
      }

      if (input.severityMin !== undefined) {
        conditions.push(gt(behavioralPatterns.severity, input.severityMin - 1));
      }

      if (input.severityMax !== undefined) {
        conditions.push(lte(behavioralPatterns.severity, input.severityMax));
      }

      const whereClauses = and(...conditions);

      const patterns = await db.select()
        .from(behavioralPatterns)
        .where(whereClauses)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const total = await db.select({ count: count() })
        .from(behavioralPatterns)
        .where(whereClauses);

      return {
        patterns,
        total: total[0]?.count || 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      const pattern = await db.select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, input.id))
        .limit(1);

      if (!pattern || pattern.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pattern not found',
        });
      }

      const firstPattern = pattern[0];

      if (firstPattern.userId !== ctx.user.id && firstPattern.userId !== null) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this pattern',
        });
      }

      return firstPattern;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        category: z.string(),
        pattern: z.string(), // Regex pattern
        description: z.string().optional(),
        severity: z.number().min(1).max(10),
        mclFactors: z.array(z.string()).optional(),
        examples: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      const result = await db.insert(behavioralPatterns)
        .values({
          userId: ctx.user.id,
          name: input.name,
          category: input.category,
          pattern: input.pattern,
          description: input.description,
          severity: input.severity,
          mclFactors: JSON.stringify(input.mclFactors || []),
          examples: JSON.stringify(input.examples || []),
          isCustom: 'true',
          isActive: 'true',
        });

      const insertId = Number((result as any).insertId);
      const [newPattern] = await db.select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, insertId))
        .limit(1);

      return newPattern;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        category: z.string().optional(),
        pattern: z.string().optional(),
        description: z.string().optional(),
        severity: z.number().min(1).max(10).optional(),
        mclFactors: z.array(z.string()).optional(),
        examples: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      const existingPattern = await db.select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, input.id))
        .limit(1);

      if (!existingPattern || existingPattern.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pattern not found',
        });
      }

      const firstPattern = existingPattern[0];

      if (firstPattern.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not own this pattern',
        });
      }

      if (firstPattern.userId === null) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot update built-in patterns',
        });
      }

      const updateValues: {
        name?: string;
        category?: string;
        pattern?: string;
        description?: string;
        severity?: number;
        mclFactors?: string;
        examples?: string;
        isActive?: 'true' | 'false';
      } = {};

      if (input.name !== undefined) {
        updateValues.name = input.name;
      }
      if (input.category !== undefined) {
        updateValues.category = input.category;
      }
      if (input.pattern !== undefined) {
        updateValues.pattern = input.pattern;
      }
      if (input.description !== undefined) {
        updateValues.description = input.description;
      }
      if (input.severity !== undefined) {
        updateValues.severity = input.severity;
      }
      if (input.mclFactors !== undefined) {
        updateValues.mclFactors = JSON.stringify(input.mclFactors);
      }
      if (input.examples !== undefined) {
        updateValues.examples = JSON.stringify(input.examples);
      }
      if (input.isActive !== undefined) {
        updateValues.isActive = input.isActive ? 'true' : 'false';
      }

      await db.update(behavioralPatterns)
        .set(updateValues)
        .where(eq(behavioralPatterns.id, input.id));

      const [updated] = await db.select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, input.id))
        .limit(1);

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      const existingPattern = await db.select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, input.id))
        .limit(1);

      if (!existingPattern || existingPattern.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Pattern not found',
        });
      }

      const firstPattern = existingPattern[0];

      if (firstPattern.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not own this pattern',
        });
      }

      if (firstPattern.userId === null) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot delete built-in patterns',
        });
      }

      await db.delete(behavioralPatterns)
        .where(eq(behavioralPatterns.id, input.id));

      return { success: true };
    }),

  // ============================================================================
  // Pattern Testing
  // ============================================================================

  testPattern: protectedProcedure
    .input(
      z.object({
        pattern: z.string(), // Regex pattern
        sampleText: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const regex = new RegExp(input.pattern, 'gi');
        const matches = [];
        let match;

        while ((match = regex.exec(input.sampleText)) !== null) {
          matches.push(match[0]);
        }

        return { matches, matchCount: matches.length };
      } catch (error: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid regex: ${error.message}`,
        });
      }
    }),

  // ============================================================================
  // Pattern Import/Export
  // ============================================================================

  import: protectedProcedure
    .input(
      z.object({
        patterns: z.array(
          z.object({
            name: z.string(),
            category: z.string(),
            pattern: z.string(),
            description: z.string().optional(),
            severity: z.number(),
            mclFactors: z.array(z.string()).optional(),
            examples: z.array(z.string()).optional(),
          })
        ),
        conflictResolution: z.enum(['overwrite', 'skip', 'rename']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const patternData of input.patterns) {
        try {
          const existingPattern = await db.select()
            .from(behavioralPatterns)
            .where(eq(behavioralPatterns.name, patternData.name))
            .limit(1);

          if (existingPattern.length > 0) {
            const existing = existingPattern[0];
            if (input.conflictResolution === 'skip') {
              skipped++;
              continue;
            } else if (input.conflictResolution === 'overwrite') {
              await db.update(behavioralPatterns)
                .set({
                  category: patternData.category,
                  pattern: patternData.pattern,
                  description: patternData.description,
                  severity: patternData.severity,
                  mclFactors: JSON.stringify(patternData.mclFactors || []),
                  examples: JSON.stringify(patternData.examples || []),
                })
                .where(eq(behavioralPatterns.id, existing.id));
              imported++;
            } else if (input.conflictResolution === 'rename') {
              let newName = patternData.name + " (imported)";
              let counter = 1;
              while (true) {
                const checkName = await db.select().from(behavioralPatterns).where(eq(behavioralPatterns.name, newName)).limit(1);
                if (checkName.length === 0) break;
                newName = patternData.name + ` (imported ${counter++})`;
              }

              await db.insert(behavioralPatterns)
                .values({
                  userId: ctx.user.id,
                  name: newName,
                  category: patternData.category,
                  pattern: patternData.pattern,
                  description: patternData.description,
                  severity: patternData.severity,
                  mclFactors: JSON.stringify(patternData.mclFactors || []),
                  examples: JSON.stringify(patternData.examples || []),
                  isCustom: 'true',
                  isActive: 'true',
                });
              imported++;
            }
          } else {
            await db.insert(behavioralPatterns)
              .values({
                userId: ctx.user.id,
                name: patternData.name,
                category: patternData.category,
                pattern: patternData.pattern,
                description: patternData.description,
                severity: patternData.severity,
                mclFactors: JSON.stringify(patternData.mclFactors || []),
                examples: JSON.stringify(patternData.examples || []),
                isCustom: 'true',
                isActive: 'true',
              });
            imported++;
          }
        } catch (error: any) {
          errors.push(`Error importing ${patternData.name}: ${error.message}`);
        }
      }

      return { imported, skipped, errors };
    }),

  export: protectedProcedure
    .input(
      z.object({
        format: z.enum(['json', 'csv']),
        includeBuiltIn: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      const whereClauses = input.includeBuiltIn
        ? or(eq(behavioralPatterns.userId, ctx.user.id), isNull(behavioralPatterns.userId))
        : eq(behavioralPatterns.userId, ctx.user.id);

      const patterns = await db.select()
        .from(behavioralPatterns)
        .where(whereClauses);

      if (input.format === 'json') {
        return JSON.stringify(patterns, null, 2);
      } else if (input.format === 'csv') {
        if (patterns.length === 0) return "";
        const header = Object.keys(patterns[0]).join(',');
        const rows = patterns.map(pattern => Object.values(pattern).map(value => typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value).join(',')).join('\n');
        return `${header}\n${rows}`;
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid format',
      });
    }),

  // ============================================================================
  // Pattern Statistics
  // ============================================================================

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Database not available'
      });
    }

    const totalPatterns = await db.select({ count: count() }).from(behavioralPatterns);
    const customPatterns = await db.select({ count: count() }).from(behavioralPatterns).where(eq(behavioralPatterns.userId, ctx.user.id));
    const builtInPatterns = await db.select({ count: count() }).from(behavioralPatterns).where(isNull(behavioralPatterns.userId));

    const categories = await db.select({ category: behavioralPatterns.category }).from(behavioralPatterns);
    const byCategory: { [key: string]: number } = {};
    categories.forEach(c => {
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    });

    const topMatched = await db.select().from(behavioralPatterns).orderBy(behavioralPatterns.matchCount).limit(10);

    return {
      totalPatterns: totalPatterns[0]?.count || 0,
      customPatterns: customPatterns[0]?.count || 0,
      builtInPatterns: builtInPatterns[0]?.count || 0,
      byCategory,
      topMatched,
    };
  }),

  // ============================================================================
  // Pattern Categories
  // ============================================================================

  getCategories: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Database not available'
      });
    }

    const categories = await db.select({
      id: patternCategories.id,
      name: patternCategories.name,
      description: patternCategories.description,
      color: patternCategories.color,
      icon: patternCategories.icon,
      defaultSeverity: patternCategories.defaultSeverity,
      patternCount: count(behavioralPatterns.id),
    })
      .from(patternCategories)
      .leftJoin(behavioralPatterns, eq(patternCategories.name, behavioralPatterns.category))
      .groupBy(patternCategories.id);

    return categories;
  }),

  createCategory: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
        defaultSeverity: z.number().min(1).max(10).default(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      const result = await db.insert(patternCategories)
        .values({
          name: input.name,
          description: input.description,
          color: input.color,
          icon: input.icon,
          defaultSeverity: input.defaultSeverity,
        });

      const insertId = Number((result as any).insertId);
      const [newCategory] = await db.select()
        .from(patternCategories)
        .where(eq(patternCategories.id, insertId))
        .limit(1);

      return newCategory;
    }),

  updateCategory: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
        defaultSeverity: z.number().min(1).max(10).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      const updateValues: {
        name?: string;
        description?: string;
        color?: string;
        icon?: string;
        defaultSeverity?: number;
      } = {};

      if (input.name !== undefined) {
        updateValues.name = input.name;
      }
      if (input.description !== undefined) {
        updateValues.description = input.description;
      }
      if (input.color !== undefined) {
        updateValues.color = input.color;
      }
      if (input.icon !== undefined) {
        updateValues.icon = input.icon;
      }
      if (input.defaultSeverity !== undefined) {
        updateValues.defaultSeverity = input.defaultSeverity;
      }

      await db.update(patternCategories)
        .set(updateValues)
        .where(eq(patternCategories.id, input.id));

      const [updatedCategory] = await db.select()
        .from(patternCategories)
        .where(eq(patternCategories.id, input.id))
        .limit(1);

      return updatedCategory;
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available'
        });
      }

      const patternCount = await db.select({ count: count() })
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.category, (await db.select().from(patternCategories).where(eq(patternCategories.id, input.id)).limit(1))[0]?.name || ""));

      if (patternCount[0]?.count && patternCount[0].count > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot delete category with existing patterns',
        });
      }

      await db.delete(patternCategories)
        .where(eq(patternCategories.id, input.id));

      return { success: true };
    }),
});