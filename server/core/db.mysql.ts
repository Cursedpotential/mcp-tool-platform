// File: server/core/db.mysql.ts | Date: 2026-01-22 | Agent: Antigravity
/**
 * MySQL database helper
 * Supports internal site processes (settings, users, API keys)
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Get MySQL connection pool
 */
export async function getMySqlPool() {
    if (!_pool) {
        const host = process.env.MYSQL_HOST || "localhost";
        const port = parseInt(process.env.MYSQL_PORT || "3306");
        const user = process.env.MYSQL_USER || "salem_user";
        const password = process.env.MYSQL_PASSWORD;
        const database = process.env.MYSQL_DATABASE || "salem_app";

        if (!password) {
            console.warn("[MySQL] Warning: No password provided for MySQL connection");
        }

        try {
            _pool = mysql.createPool({
                host,
                port,
                user,
                password,
                database,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
            });

            // Test connection
            const connection = await _pool.getConnection();
            await connection.ping();
            connection.release();

            console.log("[MySQL] Connected successfully to", host);
        } catch (error) {
            console.error("[MySQL] Failed to connect:", error);
            _pool = null;
        }
    }
    return _pool;
}

/**
 * Get Drizzle ORM instance with MySQL
 */
export async function getMySqlDb() {
    if (!_db) {
        const pool = await getMySqlPool();
        if (pool) {
            try {
                // @ts-ignore - Handle mysql2 version mismatch in types
                _db = drizzle(pool);
                console.log("[Drizzle] MySQL instance ready");
            } catch (error) {
                console.error("[Drizzle] Failed to initialize MySQL:", error);
                _db = null;
            }
        }
    }
    return _db;
}

/**
 * Test MySQL connection
 */
export async function testMySqlConnection(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
}> {
    const start = Date.now();
    try {
        const pool = await getMySqlPool();
        if (!pool) {
            return { success: false, error: "MySQL pool not available" };
        }

        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();

        const latency = Date.now() - start;
        return { success: true, latency };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Close MySQL connections
 */
export async function closeMySql() {
    if (_pool) {
        await _pool.end();
        _pool = null;
        _db = null;
        console.log("[MySQL] Connection pool closed");
    }
}
