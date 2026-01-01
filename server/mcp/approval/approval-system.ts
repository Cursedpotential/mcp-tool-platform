/**
 * Human-in-the-Loop Approval System
 * 
 * Provides gating for destructive/sensitive operations:
 * - Write/move/delete/merge operations require approval
 * - Returns approval_id with preview/diff/rollback info
 * - Separate approve() call required to execute
 * - Full audit trail in JSONL/SQLite
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

// Operation types that require approval
type ApprovalRequiredOperation = 
  | 'file_write'
  | 'file_delete'
  | 'file_move'
  | 'file_merge'
  | 'db_write'
  | 'db_delete'
  | 'api_post'
  | 'api_delete'
  | 'config_change'
  | 'evidence_modify'
  | 'bulk_operation';

// Approval status
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'executed' | 'rolled_back';

// Approval request
interface ApprovalRequest {
  approvalId: string;
  operation: ApprovalRequiredOperation;
  description: string;
  createdAt: string;
  expiresAt: string;
  status: ApprovalStatus;
  
  // Plan details
  plan: {
    action: string;
    target: string;
    parameters: Record<string, any>;
  };
  
  // Preview/diff information
  preview: {
    type: 'diff' | 'summary' | 'list';
    before?: string;
    after?: string;
    summary?: string;
    affectedItems?: string[];
    itemCount?: number;
  };
  
  // Rollback information
  rollback: {
    available: boolean;
    method?: string;
    backupPath?: string;
    instructions?: string;
  };
  
  // Execution context
  context: {
    requestedBy: string;
    toolName: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  };
  
  // Approval/rejection details
  resolution?: {
    resolvedAt: string;
    resolvedBy: string;
    action: 'approved' | 'rejected';
    reason?: string;
  };
  
  // Execution result
  execution?: {
    executedAt: string;
    success: boolean;
    result?: any;
    error?: string;
  };
}

// Audit log entry
interface AuditEntry {
  timestamp: string;
  approvalId: string;
  event: 'created' | 'approved' | 'rejected' | 'executed' | 'rolled_back' | 'expired';
  actor: string;
  details: Record<string, any>;
}

// Storage paths
const APPROVAL_DIR = path.join(os.homedir(), '.mcp-tool-shop', 'approvals');
const PENDING_FILE = path.join(APPROVAL_DIR, 'pending.json');
const AUDIT_FILE = path.join(APPROVAL_DIR, 'audit.jsonl');
const BACKUP_DIR = path.join(APPROVAL_DIR, 'backups');

// In-memory pending approvals
let pendingApprovals: Map<string, ApprovalRequest> = new Map();
let initialized = false;

// Initialize storage
async function initialize(): Promise<void> {
  if (initialized) return;
  
  await fs.mkdir(APPROVAL_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  
  // Load pending approvals
  try {
    const data = await fs.readFile(PENDING_FILE, 'utf-8');
    const pending = JSON.parse(data) as ApprovalRequest[];
    pendingApprovals = new Map(pending.map(p => [p.approvalId, p]));
    
    // Expire old requests
    const now = Date.now();
    for (const [id, req] of Array.from(pendingApprovals.entries())) {
      if (new Date(req.expiresAt).getTime() < now && req.status === 'pending') {
        req.status = 'expired';
        await logAudit(id, 'expired', 'system', { reason: 'TTL exceeded' });
      }
    }
    await savePending();
  } catch {
    pendingApprovals = new Map();
  }
  
  initialized = true;
}

// Save pending approvals
async function savePending(): Promise<void> {
  const data = Array.from(pendingApprovals.values());
  await fs.writeFile(PENDING_FILE, JSON.stringify(data, null, 2));
}

// Log audit entry
async function logAudit(
  approvalId: string,
  event: AuditEntry['event'],
  actor: string,
  details: Record<string, any> = {}
): Promise<void> {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    approvalId,
    event,
    actor,
    details
  };
  
  await fs.appendFile(AUDIT_FILE, JSON.stringify(entry) + '\n');
}

// Generate approval ID
function generateApprovalId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `APR-${timestamp}-${random}`.toUpperCase();
}

// Create backup for rollback
async function createBackup(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath);
    const hash = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
    const backupName = `${path.basename(filePath)}.${hash}.backup`;
    const backupPath = path.join(BACKUP_DIR, backupName);
    await fs.writeFile(backupPath, content);
    return backupPath;
  } catch {
    return null;
  }
}

// Generate diff preview
function generateDiff(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  
  const diff: string[] = [];
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    
    if (b === undefined) {
      diff.push(`+ ${a}`);
    } else if (a === undefined) {
      diff.push(`- ${b}`);
    } else if (b !== a) {
      diff.push(`- ${b}`);
      diff.push(`+ ${a}`);
    } else {
      diff.push(`  ${b}`);
    }
  }
  
  return diff.join('\n');
}

// Request approval for an operation
async function requestApproval(
  operation: ApprovalRequiredOperation,
  plan: ApprovalRequest['plan'],
  preview: ApprovalRequest['preview'],
  context: ApprovalRequest['context'],
  options: {
    ttlMinutes?: number;
    backupPath?: string;
    rollbackInstructions?: string;
  } = {}
): Promise<ApprovalRequest> {
  await initialize();
  
  const approvalId = generateApprovalId();
  const ttl = (options.ttlMinutes || 60) * 60 * 1000;
  
  const request: ApprovalRequest = {
    approvalId,
    operation,
    description: `${operation}: ${plan.action} on ${plan.target}`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttl).toISOString(),
    status: 'pending',
    plan,
    preview,
    rollback: {
      available: !!options.backupPath,
      backupPath: options.backupPath,
      instructions: options.rollbackInstructions
    },
    context
  };
  
  pendingApprovals.set(approvalId, request);
  await savePending();
  await logAudit(approvalId, 'created', context.requestedBy, { operation, target: plan.target });
  
  return request;
}

// Approve a pending request
async function approve(
  approvalId: string,
  approvedBy: string,
  reason?: string
): Promise<ApprovalRequest> {
  await initialize();
  
  const request = pendingApprovals.get(approvalId);
  if (!request) {
    throw new Error(`Approval ${approvalId} not found`);
  }
  
  if (request.status !== 'pending') {
    throw new Error(`Approval ${approvalId} is ${request.status}, cannot approve`);
  }
  
  if (new Date(request.expiresAt).getTime() < Date.now()) {
    request.status = 'expired';
    await savePending();
    throw new Error(`Approval ${approvalId} has expired`);
  }
  
  request.status = 'approved';
  request.resolution = {
    resolvedAt: new Date().toISOString(),
    resolvedBy: approvedBy,
    action: 'approved',
    reason
  };
  
  await savePending();
  await logAudit(approvalId, 'approved', approvedBy, { reason });
  
  return request;
}

// Reject a pending request
async function reject(
  approvalId: string,
  rejectedBy: string,
  reason?: string
): Promise<ApprovalRequest> {
  await initialize();
  
  const request = pendingApprovals.get(approvalId);
  if (!request) {
    throw new Error(`Approval ${approvalId} not found`);
  }
  
  if (request.status !== 'pending') {
    throw new Error(`Approval ${approvalId} is ${request.status}, cannot reject`);
  }
  
  request.status = 'rejected';
  request.resolution = {
    resolvedAt: new Date().toISOString(),
    resolvedBy: rejectedBy,
    action: 'rejected',
    reason
  };
  
  await savePending();
  await logAudit(approvalId, 'rejected', rejectedBy, { reason });
  
  return request;
}

// Mark as executed
async function markExecuted(
  approvalId: string,
  success: boolean,
  result?: any,
  error?: string
): Promise<void> {
  await initialize();
  
  const request = pendingApprovals.get(approvalId);
  if (!request) return;
  
  request.status = success ? 'executed' : 'pending';
  request.execution = {
    executedAt: new Date().toISOString(),
    success,
    result,
    error
  };
  
  await savePending();
  await logAudit(approvalId, 'executed', 'system', { success, error });
}

// Rollback an executed operation
async function rollback(
  approvalId: string,
  rolledBackBy: string
): Promise<{ success: boolean; message: string }> {
  await initialize();
  
  const request = pendingApprovals.get(approvalId);
  if (!request) {
    return { success: false, message: `Approval ${approvalId} not found` };
  }
  
  if (!request.rollback.available || !request.rollback.backupPath) {
    return { success: false, message: 'Rollback not available for this operation' };
  }
  
  try {
    // Restore from backup
    const backup = await fs.readFile(request.rollback.backupPath);
    await fs.writeFile(request.plan.target, backup);
    
    request.status = 'rolled_back';
    await savePending();
    await logAudit(approvalId, 'rolled_back', rolledBackBy, { backupPath: request.rollback.backupPath });
    
    return { success: true, message: `Rolled back ${request.plan.target} from backup` };
  } catch (error: any) {
    return { success: false, message: `Rollback failed: ${error.message}` };
  }
}

// Get pending approvals
async function getPending(): Promise<ApprovalRequest[]> {
  await initialize();
  return Array.from(pendingApprovals.values()).filter(r => r.status === 'pending');
}

// Get approval by ID
async function getApproval(approvalId: string): Promise<ApprovalRequest | null> {
  await initialize();
  return pendingApprovals.get(approvalId) || null;
}

// Get audit log
async function getAuditLog(limit: number = 100): Promise<AuditEntry[]> {
  await initialize();
  
  try {
    const content = await fs.readFile(AUDIT_FILE, 'utf-8');
    const entries = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as AuditEntry)
      .reverse()
      .slice(0, limit);
    return entries;
  } catch {
    return [];
  }
}

// Tool definitions for MCP registry
export const approvalTools = [
  {
    name: 'approval.request',
    description: 'Request human approval for a destructive/sensitive operation. Returns approval_id that must be approved before execution.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['file_write', 'file_delete', 'file_move', 'file_merge', 'db_write', 'db_delete', 'api_post', 'api_delete', 'config_change', 'evidence_modify', 'bulk_operation'],
          description: 'Type of operation requiring approval'
        },
        action: { type: 'string', description: 'Action being performed' },
        target: { type: 'string', description: 'Target of the operation' },
        parameters: { type: 'object', description: 'Operation parameters' },
        previewType: { type: 'string', enum: ['diff', 'summary', 'list'], default: 'summary' },
        previewBefore: { type: 'string', description: 'Content before change (for diff)' },
        previewAfter: { type: 'string', description: 'Content after change (for diff)' },
        previewSummary: { type: 'string', description: 'Summary of changes' },
        affectedItems: { type: 'array', items: { type: 'string' }, description: 'List of affected items' },
        requestedBy: { type: 'string', description: 'Who is requesting', default: 'agent' },
        toolName: { type: 'string', description: 'Tool making the request' },
        ttlMinutes: { type: 'number', description: 'Time to live in minutes', default: 60 }
      },
      required: ['operation', 'action', 'target', 'toolName']
    },
    handler: async (params: any) => {
      // Create backup if it's a file operation
      let backupPath: string | undefined;
      if (['file_write', 'file_delete', 'file_move'].includes(params.operation)) {
        try {
          backupPath = await createBackup(params.target) || undefined;
        } catch {}
      }
      
      const preview: ApprovalRequest['preview'] = {
        type: params.previewType || 'summary',
        summary: params.previewSummary,
        affectedItems: params.affectedItems,
        itemCount: params.affectedItems?.length
      };
      
      if (params.previewType === 'diff' && params.previewBefore && params.previewAfter) {
        preview.before = params.previewBefore;
        preview.after = params.previewAfter;
      }
      
      const request = await requestApproval(
        params.operation,
        {
          action: params.action,
          target: params.target,
          parameters: params.parameters || {}
        },
        preview,
        {
          requestedBy: params.requestedBy || 'agent',
          toolName: params.toolName
        },
        {
          ttlMinutes: params.ttlMinutes || 60,
          backupPath
        }
      );
      
      return {
        requires_approval: true,
        approval_id: request.approvalId,
        operation: request.operation,
        description: request.description,
        expires_at: request.expiresAt,
        preview: request.preview,
        rollback_available: request.rollback.available,
        message: `Operation requires approval. Call approval.approve with approval_id="${request.approvalId}" to proceed.`
      };
    }
  },
  {
    name: 'approval.approve',
    description: 'Approve a pending operation request',
    inputSchema: {
      type: 'object',
      properties: {
        approvalId: { type: 'string', description: 'Approval ID to approve' },
        approvedBy: { type: 'string', description: 'Who is approving', default: 'user' },
        reason: { type: 'string', description: 'Reason for approval' }
      },
      required: ['approvalId']
    },
    handler: async (params: { approvalId: string; approvedBy?: string; reason?: string }) => {
      const request = await approve(params.approvalId, params.approvedBy || 'user', params.reason);
      return {
        success: true,
        approval_id: request.approvalId,
        status: request.status,
        message: 'Operation approved. You may now execute the operation.',
        plan: request.plan
      };
    }
  },
  {
    name: 'approval.reject',
    description: 'Reject a pending operation request',
    inputSchema: {
      type: 'object',
      properties: {
        approvalId: { type: 'string', description: 'Approval ID to reject' },
        rejectedBy: { type: 'string', description: 'Who is rejecting', default: 'user' },
        reason: { type: 'string', description: 'Reason for rejection' }
      },
      required: ['approvalId']
    },
    handler: async (params: { approvalId: string; rejectedBy?: string; reason?: string }) => {
      const request = await reject(params.approvalId, params.rejectedBy || 'user', params.reason);
      return {
        success: true,
        approval_id: request.approvalId,
        status: request.status,
        message: 'Operation rejected.'
      };
    }
  },
  {
    name: 'approval.check',
    description: 'Check if an approval has been granted',
    inputSchema: {
      type: 'object',
      properties: {
        approvalId: { type: 'string', description: 'Approval ID to check' }
      },
      required: ['approvalId']
    },
    handler: async (params: { approvalId: string }) => {
      const request = await getApproval(params.approvalId);
      if (!request) {
        return { found: false, approved: false };
      }
      return {
        found: true,
        approval_id: request.approvalId,
        status: request.status,
        approved: request.status === 'approved',
        plan: request.plan,
        resolution: request.resolution
      };
    }
  },
  {
    name: 'approval.mark_executed',
    description: 'Mark an approved operation as executed',
    inputSchema: {
      type: 'object',
      properties: {
        approvalId: { type: 'string' },
        success: { type: 'boolean' },
        result: { type: 'object' },
        error: { type: 'string' }
      },
      required: ['approvalId', 'success']
    },
    handler: async (params: { approvalId: string; success: boolean; result?: any; error?: string }) => {
      await markExecuted(params.approvalId, params.success, params.result, params.error);
      return { success: true };
    }
  },
  {
    name: 'approval.rollback',
    description: 'Rollback an executed operation using backup',
    inputSchema: {
      type: 'object',
      properties: {
        approvalId: { type: 'string', description: 'Approval ID to rollback' },
        rolledBackBy: { type: 'string', default: 'user' }
      },
      required: ['approvalId']
    },
    handler: async (params: { approvalId: string; rolledBackBy?: string }) => {
      return rollback(params.approvalId, params.rolledBackBy || 'user');
    }
  },
  {
    name: 'approval.list_pending',
    description: 'List all pending approval requests',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const pending = await getPending();
      return {
        count: pending.length,
        approvals: pending.map(p => ({
          approval_id: p.approvalId,
          operation: p.operation,
          description: p.description,
          expires_at: p.expiresAt,
          target: p.plan.target
        }))
      };
    }
  },
  {
    name: 'approval.audit_log',
    description: 'Get audit log of approval actions',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 100 }
      }
    },
    handler: async (params: { limit?: number }) => {
      const entries = await getAuditLog(params.limit || 100);
      return { entries };
    }
  }
];

export {
  requestApproval,
  approve,
  reject,
  markExecuted,
  rollback,
  getPending,
  getApproval,
  getAuditLog,
  createBackup,
  generateDiff
};
export default approvalTools;
