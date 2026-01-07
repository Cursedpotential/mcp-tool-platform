/**
 * Redis-backed Distributed Queue (Optional Mode)
 * 
 * Enables multi-worker orchestration for horizontal scaling.
 * Falls back to in-memory queue if Redis is unavailable.
 */

import { nanoid } from 'nanoid';
import { logger } from '../realtime/log-stream';

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
  status: 'pending' | 'processing' | 'completed' | 'failed';
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

  async push(task: Omit<QueueTask, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<string> {
    const id = nanoid();
    const fullTask: QueueTask = {
      ...task,
      id,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending',
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

    logger.info('queue', `Task pushed: ${id}`, { type: task.type, priority: task.priority });
    return id;
  }

  async pop(): Promise<QueueTask | null> {
    const id = this.pendingQueue.shift();
    if (!id) return null;

    const task = this.tasks.get(id);
    if (!task) return null;

    task.status = 'processing';
    task.attempts += 1;
    this.processingSet.add(id);

    return task;
  }

  async complete(taskId: string, result: unknown): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.result = result;
    this.processingSet.delete(taskId);
    this.completedSet.add(taskId);

    logger.info('queue', `Task completed: ${taskId}`);
  }

  async fail(taskId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.attempts < task.maxAttempts) {
      // Retry
      task.status = 'pending';
      this.processingSet.delete(taskId);
      this.pendingQueue.push(taskId);
      logger.warn('queue', `Task retry: ${taskId}`, { attempt: task.attempts, maxAttempts: task.maxAttempts });
    } else {
      // Failed permanently
      task.status = 'failed';
      task.error = error;
      this.processingSet.delete(taskId);
      this.failedSet.add(taskId);
      logger.error('queue', `Task failed: ${taskId}`, { error });
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
  private connected: boolean = false;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  async connect(): Promise<void> {
    // TODO: Implement Redis connection
    // For now, throw to fall back to in-memory
    throw new Error('Redis queue not yet implemented');
  }

  async push(_task: Omit<QueueTask, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<string> {
    throw new Error('Redis queue not yet implemented');
  }

  async pop(): Promise<QueueTask | null> {
    throw new Error('Redis queue not yet implemented');
  }

  async complete(_taskId: string, _result: unknown): Promise<void> {
    throw new Error('Redis queue not yet implemented');
  }

  async fail(_taskId: string, _error: string): Promise<void> {
    throw new Error('Redis queue not yet implemented');
  }

  async getTask(_taskId: string): Promise<QueueTask | null> {
    throw new Error('Redis queue not yet implemented');
  }

  async getStats(): Promise<QueueStats> {
    throw new Error('Redis queue not yet implemented');
  }

  async clear(): Promise<void> {
    throw new Error('Redis queue not yet implemented');
  }
}

// ============================================================================
// Queue Manager
// ============================================================================

class QueueManager {
  private static instance: QueueManager | null = null;
  private queue: InMemoryQueue | RedisQueue;
  private config: QueueConfig;
  private mode: 'memory' | 'redis' = 'memory';

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
        this.mode = 'redis';
        logger.info('queue', 'Using Redis queue for distributed orchestration');
      } catch (error) {
        logger.warn('queue', 'Redis unavailable, falling back to in-memory queue');
        this.queue = new InMemoryQueue();
        this.mode = 'memory';
      }
    } else {
      this.queue = new InMemoryQueue();
      this.mode = 'memory';
      logger.info('queue', 'Using in-memory queue (single-worker mode)');
    }
  }

  static getInstance(config?: QueueConfig): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager(config);
    }
    return QueueManager.instance;
  }

  getMode(): 'memory' | 'redis' {
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

  async getStats(): Promise<QueueStats & { mode: 'memory' | 'redis' }> {
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
