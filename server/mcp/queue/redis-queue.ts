/**
 * Redis-backed Distributed Queue (Optional Mode)
 *
 * Enables multi-worker orchestration for horizontal scaling.
 * Falls back to in-memory queue if Redis is unavailable.
 */

import { nanoid } from "nanoid";
import { logger } from "../realtime/log-stream";

// ============================================================================
// Types
// ============================================================================

export interface QueueTask {
  id: string;
  type: string;
  payload: unknown;
  priority: number;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "processing" | "completed" | "failed";
  workerId?: string;
  result?: unknown;
  error?: string;
}

export interface QueueConfig {
  redisUrl?: string;
  maxConcurrent?: number;
  retryAttempts?: number;
  retryDelay?: number;
  taskTimeout?: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  workers: number;
}

// ============================================================================
// In-Memory Queue (Fallback)
// ============================================================================

class InMemoryQueue {
  private tasks: Map<string, QueueTask> = new Map();
  private pendingQueue: string[] = [];
  private processingSet: Set<string> = new Set();
  private completedSet: Set<string> = new Set();
  private failedSet: Set<string> = new Set();

  async push(
    task: Omit<QueueTask, "id" | "createdAt" | "attempts" | "status">
  ): Promise<string> {
    const id = nanoid();
    const fullTask: QueueTask = {
      ...task,
      id,
      createdAt: Date.now(),
      attempts: 0,
      status: "pending",
    };

    this.tasks.set(id, fullTask);

    // Insert by priority (higher priority first)
    const insertIndex = this.pendingQueue.findIndex(taskId => {
      const t = this.tasks.get(taskId);
      return t && t.priority < fullTask.priority;
    });

    if (insertIndex === -1) {
      this.pendingQueue.push(id);
    } else {
      this.pendingQueue.splice(insertIndex, 0, id);
    }

    logger.info("queue", `Task pushed: ${id}`, {
      type: task.type,
      priority: task.priority,
    });
    return id;
  }

  async pop(): Promise<QueueTask | null> {
    const id = this.pendingQueue.shift();
    if (!id) return null;

    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = "processing";
    task.attempts += 1;
    this.processingSet.add(id);

    return task;
  }

  async complete(taskId: string, result: unknown): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = "completed";
    task.result = result;
    this.processingSet.delete(taskId);
    this.completedSet.add(taskId);

    logger.info("queue", `Task completed: ${taskId}`);
  }

  async fail(taskId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.attempts < task.maxAttempts) {
      // Retry
      task.status = "pending";
      this.processingSet.delete(taskId);
      this.pendingQueue.push(taskId);
      logger.warn("queue", `Task retry: ${taskId}`, {
        attempt: task.attempts,
        maxAttempts: task.maxAttempts,
      });
    } else {
      // Failed permanently
      task.status = "failed";
      task.error = error;
      this.processingSet.delete(taskId);
      this.failedSet.add(taskId);
      logger.error("queue", `Task failed: ${taskId}`, { error });
    }
  }

  async getTask(taskId: string): Promise<QueueTask | null> {
    return this.tasks.get(taskId) || null;
  }

  async getStats(): Promise<QueueStats> {
    return {
      pending: this.pendingQueue.length,
      processing: this.processingSet.size,
      completed: this.completedSet.size,
      failed: this.failedSet.size,
      workers: 1, // In-memory is single-worker
    };
  }

  async clear(): Promise<void> {
    this.tasks.clear();
    this.pendingQueue = [];
    this.processingSet.clear();
    this.completedSet.clear();
    this.failedSet.clear();
  }
}

// ============================================================================
// Redis Queue (Distributed)
// ============================================================================

class RedisQueue {
  private redisUrl: string;
  private client: any; // ioredis client
  private connected: boolean = false;
  private prefix = "mcp:queue";

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  async connect(): Promise<void> {
    const Redis = (await import("ioredis")).default;
    this.client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on("connect", () => {
      this.connected = true;
      logger.info("queue", "Connected to Dragonfly/Redis");
    });

    this.client.on("error", (err: any) => {
      logger.error("queue", "Redis connection error", { error: err.message });
      this.connected = false;
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      this.client.once("ready", resolve);
      this.client.once("error", reject);
    });
  }

  async push(
    task: Omit<QueueTask, "id" | "createdAt" | "attempts" | "status">
  ): Promise<string> {
    if (!this.connected) await this.connect();

    const id = nanoid();
    const fullTask: QueueTask = {
      ...task,
      id,
      createdAt: Date.now(),
      attempts: 0,
      status: "pending",
    };

    const pipeline = this.client.pipeline();

    // Store task data
    pipeline.set(`${this.prefix}:task:${id}`, JSON.stringify(fullTask));

    // Add to pending sorted set (score = priority)
    // ZADD adds to a sorted set. We want higher priority popped first.
    // If we use ZREVRANGE later, higher score comes first.
    pipeline.zadd(`${this.prefix}:pending`, task.priority, id);

    await pipeline.exec();

    logger.info("queue", `Task pushed to Redis: ${id}`, {
      type: task.type,
      priority: task.priority,
    });
    return id;
  }

  async pop(): Promise<QueueTask | null> {
    if (!this.connected) await this.connect();

    // lua script to atomically pop highest priority task
    // ZREVRANGE index 0 0 -> get highest score
    // move to processing set
    // return task

    // Simple approach without blocking pop for priority queue:
    // 1. Watch pending
    // 2. Get highest priority
    // 3. Multi/Exec move
    // Or just use a lock/lua. 
    // Dragonfly supports Lua.

    const script = `
      local pending = KEYS[1]
      local processing = KEYS[2]
      local prefix = ARGV[1]
      
      -- Get highest priority task (with highest score)
      local result = redis.call('ZREVRANGE', pending, 0, 0)
      if #result == 0 then
        return nil
      end
      
      local taskId = result[1]
      
      -- Move to processing set
      redis.call('ZREM', pending, taskId)
      redis.call('SADD', processing, taskId)
      
      -- Get task data and update status
      local taskKey = prefix .. ':task:' .. taskId
      local taskJson = redis.call('GET', taskKey)
      
      return {taskId, taskJson}
    `;

    const result = await this.client.eval(
      script,
      2,
      `${this.prefix}:pending`,
      `${this.prefix}:processing`,
      this.prefix
    );

    if (!result) return null;

    const [taskId, taskJson] = result as [string, string];
    if (!taskJson) {
      // Data missing ? Clean up
      await this.client.srem(`${this.prefix}:processing`, taskId);
      return null;
    }

    const task: QueueTask = JSON.parse(taskJson);
    task.status = "processing";
    task.attempts += 1;

    // Update task in Redis with new status/attempts
    await this.client.set(`${this.prefix}:task:${taskId}`, JSON.stringify(task));

    return task;
  }

  async complete(taskId: string, result: unknown): Promise<void> {
    if (!this.connected) await this.connect();

    const taskJson = await this.client.get(`${this.prefix}:task:${taskId}`);
    if (!taskJson) return;

    const task: QueueTask = JSON.parse(taskJson);
    task.status = "completed";
    task.result = result;

    const pipeline = this.client.pipeline();
    pipeline.set(`${this.prefix}:task:${taskId}`, JSON.stringify(task));
    pipeline.srem(`${this.prefix}:processing`, taskId);
    pipeline.sadd(`${this.prefix}:completed`, taskId);

    // Set expiry for completed tasks (e.g. 24h) to clean up
    pipeline.expire(`${this.prefix}:task:${taskId}`, 86400);

    await pipeline.exec();
    logger.info("queue", `Task completed in Redis: ${taskId}`);
  }

  async fail(taskId: string, error: string): Promise<void> {
    if (!this.connected) await this.connect();

    const taskJson = await this.client.get(`${this.prefix}:task:${taskId}`);
    if (!taskJson) return;

    const task: QueueTask = JSON.parse(taskJson);

    if (task.attempts < task.maxAttempts) {
      // Retry
      task.status = "pending";

      const pipeline = this.client.pipeline();
      pipeline.set(`${this.prefix}:task:${taskId}`, JSON.stringify(task));
      pipeline.srem(`${this.prefix}:processing`, taskId);
      pipeline.zadd(`${this.prefix}:pending`, task.priority, taskId);
      await pipeline.exec();

      logger.warn("queue", `Task retry in Redis: ${taskId}`, {
        attempt: task.attempts,
        maxAttempts: task.maxAttempts,
      });
    } else {
      // Failed permanently
      task.status = "failed";
      task.error = error;

      const pipeline = this.client.pipeline();
      pipeline.set(`${this.prefix}:task:${taskId}`, JSON.stringify(task));
      pipeline.srem(`${this.prefix}:processing`, taskId);
      pipeline.sadd(`${this.prefix}:failed`, taskId);
      pipeline.expire(`${this.prefix}:task:${taskId}`, 86400); // 24h retention
      await pipeline.exec();

      logger.error("queue", `Task failed in Redis: ${taskId}`, { error });
    }
  }

  async getTask(taskId: string): Promise<QueueTask | null> {
    if (!this.connected) await this.connect();
    const json = await this.client.get(`${this.prefix}:task:${taskId}`);
    return json ? JSON.parse(json) : null;
  }

  async getStats(): Promise<QueueStats> {
    if (!this.connected) await this.connect();

    const [pending, processing, completed, failed] = await Promise.all([
      this.client.zcard(`${this.prefix}:pending`),
      this.client.scard(`${this.prefix}:processing`),
      this.client.scard(`${this.prefix}:completed`),
      this.client.scard(`${this.prefix}:failed`),
    ]);

    return {
      pending: pending || 0,
      processing: processing || 0,
      completed: completed || 0,
      failed: failed || 0,
      workers: 1, // Distributed, can't easily know total workers without heartbeat
    };
  }

  async clear(): Promise<void> {
    if (!this.connected) await this.connect();
    const keys = await this.client.keys(`${this.prefix}:*`);
    if (keys.length) {
      await this.client.del(...keys);
    }
  }
}

// ============================================================================
// Queue Manager
// ============================================================================

class QueueManager {
  private static instance: QueueManager | null = null;
  private queue: InMemoryQueue | RedisQueue;
  private config: QueueConfig;
  private mode: "memory" | "redis" = "memory";

  private constructor(config: QueueConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 10,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      taskTimeout: config.taskTimeout || 300000, // 5 minutes
      ...config,
    };

    // Try Redis first, fall back to in-memory
    if (config.redisUrl) {
      try {
        this.queue = new RedisQueue(config.redisUrl);
        this.mode = "redis";
        logger.info("queue", "Using Redis queue for distributed orchestration");
      } catch (error) {
        logger.warn(
          "queue",
          "Redis unavailable, falling back to in-memory queue"
        );
        this.queue = new InMemoryQueue();
        this.mode = "memory";
      }
    } else {
      this.queue = new InMemoryQueue();
      this.mode = "memory";
      logger.info("queue", "Using in-memory queue (single-worker mode)");
    }
  }

  static getInstance(config?: QueueConfig): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager(config);
    }
    return QueueManager.instance;
  }

  getMode(): "memory" | "redis" {
    return this.mode;
  }

  async enqueue(
    type: string,
    payload: unknown,
    options: { priority?: number; maxAttempts?: number } = {}
  ): Promise<string> {
    return this.queue.push({
      type,
      payload,
      priority: options.priority || 0,
      maxAttempts: options.maxAttempts || this.config.retryAttempts || 3,
    });
  }

  async dequeue(): Promise<QueueTask | null> {
    return this.queue.pop();
  }

  async completeTask(taskId: string, result: unknown): Promise<void> {
    return this.queue.complete(taskId, result);
  }

  async failTask(taskId: string, error: string): Promise<void> {
    return this.queue.fail(taskId, error);
  }

  async getTask(taskId: string): Promise<QueueTask | null> {
    return this.queue.getTask(taskId);
  }

  async getStats(): Promise<QueueStats & { mode: "memory" | "redis" }> {
    const stats = await this.queue.getStats();
    return { ...stats, mode: this.mode };
  }

  async clear(): Promise<void> {
    return this.queue.clear();
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getQueueManager(config?: QueueConfig): QueueManager {
  return QueueManager.getInstance(config);
}
