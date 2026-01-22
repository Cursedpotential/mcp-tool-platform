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

// Behavioral Patterns
export const behavioralPatterns = mysqlTable("behavioralPatterns", {
    id: int().autoincrement().notNull().primaryKey(),
    userId: int(), // Logical reference to users.id
    name: varchar({ length: 255 }).notNull(),
    category: varchar({ length: 100 }).notNull(),
    pattern: text().notNull(), // Regex pattern
    description: text(),
    severity: int().default(5).notNull(),
    mclFactors: text(), // JSON string
    examples: text(), // JSON string
    isActive: boolean().default(true).notNull(),
    isCustom: boolean().default(false).notNull(),
    matchCount: int().default(0).notNull(),
    createdAt: timestamp({ mode: "string" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp({ mode: "string" })
        .default(sql`CURRENT_TIMESTAMP`)
        .onUpdateNow()
        .notNull(),
});

// Pattern Categories
export const patternCategories = mysqlTable("patternCategories", {
    id: int().autoincrement().notNull().primaryKey(),
    userId: int(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    color: varchar({ length: 50 }),
    icon: varchar({ length: 100 }),
    defaultSeverity: int().default(5).notNull(),
    isActive: boolean().default(true).notNull(),
    createdAt: timestamp({ mode: "string" })
        .default(sql`CURRENT_TIMESTAMP`)
        .notNull(),
    updatedAt: timestamp({ mode: "string" })
        .default(sql`CURRENT_TIMESTAMP`)
        .onUpdateNow()
        .notNull(),
});
