// File: server/api/routers/patterns.ts | Date: 2026-01-22 | Agent: Antigravity
import { z } from "zod";
import { protectedProcedure, router } from "../../core/trpc";
import { getMySqlDb } from "../../core/db.mysql";
import {
  behavioralPatterns,
  patternCategories,
} from "../../../drizzle/patterns-schema";
import { eq, and, or, isNull, like, count, gt, lte, sql, desc } from "drizzle-orm";
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
      const db = await getMySqlDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const conditions = [
        or(
          eq(behavioralPatterns.userId, ctx.user.id),
          isNull(behavioralPatterns.userId)
        ),
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

      const patterns = await db
        .select()
        .from(behavioralPatterns)
        .where(whereClauses)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const [totalResult] = await db
        .select({ count: count() })
        .from(behavioralPatterns)
        .where(whereClauses);

      return {
        patterns,
        total: totalResult?.count || 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const pattern = await db
        .select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, input.id))
        .limit(1);

      if (!pattern || pattern.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pattern not found",
        });
      }

      const firstPattern = pattern[0];

      if (firstPattern.userId !== ctx.user.id && firstPattern.userId !== null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to access this pattern",
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
      const db = await getMySqlDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const [result] = await db.insert(behavioralPatterns).values({
        userId: ctx.user.id,
        name: input.name,
        category: input.category,
        pattern: input.pattern,
        description: input.description,
        severity: input.severity,
        mclFactors: JSON.stringify(input.mclFactors || []),
        examples: JSON.stringify(input.examples || []),
        isCustom: true,
        isActive: true,
      });

      const [newPattern] = await db
        .select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, result.insertId))
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
      const db = await getMySqlDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const existingPattern = await db
        .select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, input.id))
        .limit(1);

      if (!existingPattern || existingPattern.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pattern not found",
        });
      }

      const firstPattern = existingPattern[0];

      if (firstPattern.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this pattern",
        });
      }

      const updateValues: any = {};

      if (input.name !== undefined) updateValues.name = input.name;
      if (input.category !== undefined) updateValues.category = input.category;
      if (input.pattern !== undefined) updateValues.pattern = input.pattern;
      if (input.description !== undefined)
        updateValues.description = input.description;
      if (input.severity !== undefined) updateValues.severity = input.severity;
      if (input.mclFactors !== undefined)
        updateValues.mclFactors = JSON.stringify(input.mclFactors);
      if (input.examples !== undefined)
        updateValues.examples = JSON.stringify(input.examples);
      if (input.isActive !== undefined) updateValues.isActive = input.isActive;

      updateValues.updatedAt = sql`CURRENT_TIMESTAMP`;

      await db
        .update(behavioralPatterns)
        .set(updateValues)
        .where(eq(behavioralPatterns.id, input.id));

      const [updated] = await db
        .select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, input.id))
        .limit(1);

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const existingPattern = await db
        .select()
        .from(behavioralPatterns)
        .where(eq(behavioralPatterns.id, input.id))
        .limit(1);

      if (!existingPattern || existingPattern.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pattern not found",
        });
      }

      if (existingPattern[0].userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this pattern",
        });
      }

      await db
        .delete(behavioralPatterns)
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
    .mutation(async ({ input }) => {
      try {
        const regex = new RegExp(input.pattern, "gi");
        const matches = [];
        let match;

        while ((match = regex.exec(input.sampleText)) !== null) {
          matches.push({
            text: match[0],
            index: match.index,
          });
        }

        return { matches, matchCount: matches.length };
      } catch (error: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid regex: ${error.message}`,
        });
      }
    }),

  // ============================================================================
  // Pattern Statistics
  // ============================================================================

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getMySqlDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    const [totalRes] = await db
      .select({ count: count() })
      .from(behavioralPatterns);
    const [customRes] = await db
      .select({ count: count() })
      .from(behavioralPatterns)
      .where(eq(behavioralPatterns.userId, ctx.user.id));
    const [builtInRes] = await db
      .select({ count: count() })
      .from(behavioralPatterns)
      .where(isNull(behavioralPatterns.userId));

    const categories = await db
      .select({ category: behavioralPatterns.category })
      .from(behavioralPatterns);
    const byCategory: Record<string, number> = {};
    categories.forEach((c) => {
      byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    });

    const topMatched = await db
      .select()
      .from(behavioralPatterns)
      .orderBy(desc(behavioralPatterns.matchCount))
      .limit(10);

    return {
      totalPatterns: totalRes?.count || 0,
      customPatterns: customRes?.count || 0,
      builtInPatterns: builtInRes?.count || 0,
      byCategory,
      topMatched,
    };
  }),

  // ============================================================================
  // Pattern Categories
  // ============================================================================

  getCategories: protectedProcedure.query(async ({ ctx }) => {
    const db = await getMySqlDb();
    if (!db) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database not available",
      });
    }

    const categories = await db
      .select({
        id: patternCategories.id,
        name: patternCategories.name,
        description: patternCategories.description,
        color: patternCategories.color,
        icon: patternCategories.icon,
        defaultSeverity: patternCategories.defaultSeverity,
        isActive: patternCategories.isActive,
      })
      .from(patternCategories)
      .where(eq(patternCategories.isActive, true));

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
      const db = await getMySqlDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      const [result] = await db.insert(patternCategories).values({
        userId: ctx.user.id,
        name: input.name,
        description: input.description,
        color: input.color,
        icon: input.icon,
        defaultSeverity: input.defaultSeverity,
        isActive: true,
      });

      const [newCategory] = await db
        .select()
        .from(patternCategories)
        .where(eq(patternCategories.id, result.insertId))
        .limit(1);

      return newCategory;
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getMySqlDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not available",
        });
      }

      // Check if category has patterns (optional depending on UX requirements, but good safety)
      const existing = await db
        .select()
        .from(patternCategories)
        .where(eq(patternCategories.id, input.id))
        .limit(1);

      if (existing.length === 0 || existing[0].userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to delete this category",
        });
      }

      await db
        .delete(patternCategories)
        .where(eq(patternCategories.id, input.id));

      return { success: true };
    }),
});
