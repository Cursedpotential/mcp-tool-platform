import {
    mysqlTable,
    int,
    varchar,
    text,
    mysqlEnum,
    timestamp,
    boolean,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// System Prompts
export const systemPrompts = mysqlTable("systemPrompts", {
    id: int().autoincrement().notNull().primaryKey(),
    userId: int().notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    toolName: varchar({ length: 255 }),
    promptText: text().notNull(),
    variables: text(), // JSON string
    version: int().default(1).notNull(),
    parentId: int(),
    isActive: mysqlEnum(["true", "false"]).default("true").notNull(),
    successRate: int().default(0),
    avgLatencyMs: int().default(0),
    usageCount: int().default(0),
    createdAt: timestamp({ mode: "string" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp({ mode: "string" })
        .default(sql`CURRENT_TIMESTAMP`)
        .onUpdateNow()
        .notNull(),
});

// Workflow Templates
export const workflowTemplates = mysqlTable("workflowTemplates", {
    id: int().autoincrement().notNull().primaryKey(),
    userId: int().notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    category: varchar({ length: 100 }),
    steps: text().notNull(), // JSON string
    systemPromptId: int(),
    isPublic: mysqlEnum(["true", "false"]).default("false").notNull(),
    usageCount: int().default(0),
    createdAt: timestamp({ mode: "string" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp({ mode: "string" })
        .default(sql`CURRENT_TIMESTAMP`)
        .onUpdateNow()
        .notNull(),
});
