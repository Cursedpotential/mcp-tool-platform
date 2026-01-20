# Task Executor

**NAME**
task-executor - Forensic analysis task execution engine with checkpoint/resume capabilities

**SYNOPSIS**
The Task Executor manages tool invocation with content-addressed deduplication, checkpoint/resume functionality, and backpressure handling for the 78+ forensic analysis tools.

**DESCRIPTION**
The Task Executor is the core execution engine for the MCP Tool Platform. It handles task lifecycle management, result caching, checkpointing, and provides a unified interface for executing forensic analysis tools.

**CORE FEATURES**

**Content-Addressed Deduplication**
Prevents redundant computation through SHA-256 input hashing.

    **Mechanism:**
    - Computes hash of tool name + arguments
    - Checks for existing results with same hash
    - Returns cached results if available
    - Stores new results with content hash

**Checkpoint/Resume**
Long-running tasks can be paused and resumed from interruption.

    **Checkpoint Data:**
    ```typescript
    interface TaskCheckpoint {
      taskId: string;
      status: TaskStatus;
      progress: number;           // 0-100
      intermediateRef?: ContentRef;
      timestamp: number;
    }
    ```

**Backpressure Handling**
Manages concurrent execution to prevent resource exhaustion.

    **Configuration:**
    - **Concurrency Limit**: Default 10 simultaneous tasks
    - **Queue Management**: FIFO with priority support
    - **Resource Monitoring**: Active task counting

**Task Lifecycle**
Complete task state management from creation to completion.

    **States:**
    - `pending` - Queued for execution
    - `running` - Currently executing
    - `paused` - Checkpointed, can resume
    - `completed` - Finished successfully
    - `failed` - Execution error
    - `cancelled` - Manually terminated

**DATA STRUCTURES**

**ExecuteRequest**
Task execution specification.

    ```typescript
    interface ExecuteRequest {
      toolName: string;                    // Tool to execute
      args: Record<string, unknown>;       // Tool arguments
      options: {
        timeout?: number;                  // Execution timeout (ms)
        maxOutputSize?: number;            // Output size limit
        returnRef?: boolean;               // Force reference return
        priority?: 'low' | 'normal' | 'high';
      };
      traceId: string;                     // Request tracing
      userId?: number;                     // User context
    }
    ```

**InvokeResult**
Task execution result.

    ```typescript
    interface InvokeResult {
      success: boolean;
      ref?: ContentRef;                    // Reference for large outputs
      data?: unknown;                      // Inline data for small outputs
      error?: {
        code: string;
        message: string;
      };
      meta: {
        toolName: string;
        executionTimeMs: number;
        cacheHit: boolean;
        traceId: string;
      };
    }
    ```

**Task**
Internal task representation.

    ```typescript
    interface Task {
      id: string;                         // Unique task identifier
      type: string;                       // Tool name
      status: TaskStatus;                 // Current execution state
      input: Record<string, unknown>;     // Execution arguments
      output?: InvokeResult;              // Execution result
      priority: number;                   // Execution priority (1-3)
      retries: number;                    // Retry count
      maxRetries: number;                 // Maximum retry attempts
      createdAt: number;                  // Creation timestamp
      startedAt?: number;                 // Execution start time
      completedAt?: number;               // Completion timestamp
      checkpoint?: TaskCheckpoint;        // Resume state
    }
    ```

**API METHODS**

**execute(request: ExecuteRequest): Promise<InvokeResult>**
Executes a tool with full lifecycle management.

    **Process Flow:**
    1. **Input Validation**: Validate request parameters
    2. **Deduplication Check**: Hash input, check cache
    3. **Permission Check**: Verify user access
    4. **Queue Management**: Add to execution queue
    5. **Execution**: Run tool with timeout handling
    6. **Result Storage**: Store output in content store
    7. **Cache Update**: Save result for future deduplication

    **Parameters:**
    - `request`: Complete execution specification

    **Returns:**
    - `InvokeResult` with success/error status

**registerHandler(toolName: string, handler: ToolHandler): void**
Registers a tool execution handler.

    **Parameters:**
    - `toolName`: Tool identifier
    - `handler`: Execution function

**getTaskStatus(taskId: string): Task | undefined**
Retrieves current task status.

    **Parameters:**
    - `taskId`: Task identifier

    **Returns:**
    - Task object or undefined if not found

**pauseTask(taskId: string): boolean**
Pauses a running task with checkpoint.

    **Parameters:**
    - `taskId`: Task to pause

    **Returns:**
    - Success status

**resumeTask(taskId: string): boolean**
Resumes a paused task from checkpoint.

    **Parameters:**
    - `taskId`: Task to resume

    **Returns:**
    - Success status

**cancelTask(taskId: string): boolean**
Cancels a pending or running task.

    **Parameters:**
    - `taskId`: Task to cancel

    **Returns:**
    - Success status

**EXECUTION ENGINE**

**Concurrency Control**
Manages simultaneous task execution.

    **Algorithm:**
    ```typescript
    async execute(request: ExecuteRequest): Promise<InvokeResult> {
      if (this.activeCount >= this.concurrencyLimit) {
        // Queue for later execution
        return new Promise((resolve, reject) => {
          this.queue.push({ request, resolve, reject });
        });
      }

      this.activeCount++;
      try {
        const result = await this.runTask(request);
        return result;
      } finally {
        this.activeCount--;
        this.processQueue(); // Start next queued task
      }
    }
    ```

**Deduplication Logic**
Prevents redundant computation.

    ```typescript
    private computeInputHash(toolName: string, args: Record<string, unknown>): string {
      const inputString = JSON.stringify({ toolName, args });
      return crypto.createHash('sha256').update(inputString).digest('hex');
    }

    private async checkCache(inputHash: string): Promise<InvokeResult | null> {
      const existingTaskId = this.contentHashes.get(inputHash);
      if (existingTaskId) {
        const existingTask = this.tasks.get(existingTaskId);
        if (existingTask?.status === 'completed' && existingTask.output) {
          return { ...existingTask.output, meta: { ...existingTask.output.meta, cacheHit: true } };
        }
      }
      return null;
    }
    ```

**Timeout Handling**
Prevents runaway task execution.

    ```typescript
    private async runWithTimeout<T>(
      operation: () => Promise<T>,
      timeoutMs: number
    ): Promise<T> {
      return Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Task timeout')), timeoutMs)
        )
      ]);
    }
    ```

**Result Storage**
Manages output persistence.

    **Strategy:**
    - **Small Outputs** (<4KB): Return inline
    - **Large Outputs** (>4KB): Store in content store, return reference
    - **Binary Data**: Always store as reference
    - **Metadata**: Store execution metadata with result

**ERROR HANDLING**

**Execution Errors** - **Timeout**: Task exceeded time limit - **Resource Exhaustion**: Memory/disk limits reached - **Tool Errors**: Tool-specific execution failures - **Network Errors**: External service failures

**Recovery Mechanisms** - **Retry Logic**: Automatic retry with exponential backoff - **Checkpoint Recovery**: Resume from saved state - **Graceful Degradation**: Fallback to simpler execution paths

**Monitoring** - **Execution Metrics**: Time, memory, CPU usage - **Error Rates**: Per-tool failure statistics - **Queue Depth**: Pending task backlog - **Cache Hit Rate**: Deduplication effectiveness

**INTEGRATION POINTS**

**Content Store** - Stores large outputs with SHA-256 addressing - Provides paging for large artifact retrieval - Maintains reference integrity

**Tool Registry** - Provides tool specifications and handlers - Validates permissions before execution - Supplies execution metadata

**MCP Gateway** - Receives execution requests via tRPC - Returns results with appropriate formatting - Handles reference-based returns

**Smart Router** - Routes tool execution to optimal providers - Manages cost and latency tradeoffs - Handles provider failover

**PERFORMANCE CHARACTERISTICS**

**Throughput** - **Concurrent Tasks**: Up to 10 simultaneous executions - **Queue Processing**: FIFO with priority support - **Memory Usage**: ~50MB baseline + per-task overhead

**Latency** - **Cache Hit**: <1ms (deduplication) - **Simple Tool**: 10-100ms - **Complex Analysis**: 1-30 seconds - **Large Document**: 30-300 seconds

**Scalability** - **Horizontal**: Multiple executor instances - **Vertical**: Increased concurrency limits - **Distributed**: Cross-instance task distribution

**SEE ALSO**
mcp-gateway(7), tool-registry(7), content-store(7), smart-router(7)

**AUTHOR**
Claude Code - Opus 4.1

**VERSION**
1.0.0

**DATE**
January 11, 2026
