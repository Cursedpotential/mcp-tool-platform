/**
 * Platform API Keys Router
 * Manages keys that grant external access to this platform
 */

import { z } from "zod";
import { protectedProcedure, router } from "../core/trpc";
import { getDb } from "../core/db.postgres";
import { apiKeys } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { hashApiKey, maskApiKey } from "../core/encryption";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";

export const apiKeysRouter = router({
    /**
     * List all active API keys for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        const keys = await db
            .select({
                id: apiKeys.id,
                name: apiKeys.name,
                keyPrefix: apiKeys.keyPrefix,
                permissions: apiKeys.permissions,
                lastUsedAt: apiKeys.lastUsedAt,
                expiresAt: apiKeys.expiresAt,
                isActive: apiKeys.isActive,
                createdAt: apiKeys.createdAt,
            })
            .from(apiKeys)
            .where(and(eq(apiKeys.userId, ctx.user.id), eq(apiKeys.isActive, true)));

        return keys.map(k => ({
            ...k,
            permissions: JSON.parse(k.permissions),
        }));
    }),

    /**
     * Create a new API key
     * Returns the full key ONLY this once
     */
    create: protectedProcedure
        .input(z.object({
            name: z.string().min(1),
            permissions: z.array(z.string()).default(["read"])
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

            // Generate a new key: sk-mcp-<32 random chars>
            const randomString = crypto.randomBytes(16).toString("hex");
            const fullKey = `sk-mcp-${randomString}`;

            const keyHash = hashApiKey(fullKey);
            const keyPrefix = fullKey.slice(0, 7); // "sk-mcp-" + first char of random or just "sk-mcp-"

            await db.insert(apiKeys).values({
                userId: ctx.user.id,
                name: input.name,
                keyHash,
                keyPrefix,
                permissions: JSON.stringify(input.permissions),
                isActive: true,
            });

            return {
                key: fullKey,
                name: input.name,
                permissions: input.permissions,
            };
        }),

    /**
     * Revoke an API key
     */
    revoke: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

            await db
                .update(apiKeys)
                .set({ isActive: false })
                .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)));

            return { success: true };
        }),

    /**
     * Rotate an API key (revoke old, create new)
     */
    rotate: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

            // 1. Get current key to copy permissions/name
            const existing = await db
                .select()
                .from(apiKeys)
                .where(and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.user.id)))
                .limit(1);

            if (existing.length === 0) {
                throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
            }

            // 2. Revoke old key
            await db
                .update(apiKeys)
                .set({ isActive: false })
                .where(eq(apiKeys.id, input.id));

            // 3. Create new key
            const randomString = crypto.randomBytes(16).toString("hex");
            const fullKey = `sk-mcp-${randomString}`;
            const keyHash = hashApiKey(fullKey);
            const keyPrefix = fullKey.slice(0, 7);

            await db.insert(apiKeys).values({
                userId: ctx.user.id,
                name: existing[0].name,
                keyHash,
                keyPrefix,
                permissions: existing[0].permissions,
                isActive: true,
            });

            return {
                key: fullKey,
                name: existing[0].name,
            };
        }),
});
