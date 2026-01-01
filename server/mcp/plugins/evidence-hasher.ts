/**
 * Evidence Hasher Plugin - Chain of Custody for Forensic Evidence
 * 
 * Provides cryptographic integrity verification for evidence processing:
 * - SHA-256 hashing at each processing stage
 * - Chain of custody data structure
 * - Processing chain verification
 * - Forensic report generation
 * 
 * Critical for legal admissibility of digital evidence.
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

// Processing stage types
type ProcessingStage = 
  | 'original'
  | 'imported'
  | 'converted'
  | 'normalized'
  | 'analyzed'
  | 'redacted'
  | 'exported';

// Hash record for a single processing stage
interface HashRecord {
  stage: ProcessingStage;
  hash: string;
  timestamp: string;
  operator: string;
  tool: string;
  toolVersion: string;
  inputHash?: string;
  notes?: string;
}

// Chain of custody for a single evidence item
interface ChainOfCustody {
  evidenceId: string;
  originalFilename: string;
  originalPath: string;
  originalHash: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  chain: HashRecord[];
  metadata: Record<string, any>;
  verified: boolean;
  verificationErrors: string[];
}

// Verification result
interface VerificationResult {
  valid: boolean;
  evidenceId: string;
  chainLength: number;
  errors: string[];
  warnings: string[];
  lastVerifiedStage: ProcessingStage | null;
}

// Export format types
type ExportFormat = 'evidence_json' | 'court_csv' | 'timeline_json' | 'forensic_report';

// Tool version for audit trail
const TOOL_VERSION = '1.0.0';
const TOOL_NAME = 'mcp-evidence-hasher';

// Generate SHA-256 hash of content
function hashContent(content: Buffer | string): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}

// Generate hash of file
async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return hashContent(content);
}

// Generate evidence ID
function generateEvidenceId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `EVD-${timestamp}-${random}`.toUpperCase();
}

// Create initial chain of custody for new evidence
async function createChainOfCustody(
  filePath: string,
  operator: string = 'system',
  metadata: Record<string, any> = {}
): Promise<ChainOfCustody> {
  const stats = await fs.stat(filePath);
  const hash = await hashFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  // Determine MIME type from extension
  const mimeTypes: Record<string, string> = {
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.xml': 'application/xml',
  };
  
  const chain: ChainOfCustody = {
    evidenceId: generateEvidenceId(),
    originalFilename: path.basename(filePath),
    originalPath: path.resolve(filePath),
    originalHash: hash,
    mimeType: mimeTypes[ext] || 'application/octet-stream',
    fileSize: stats.size,
    createdAt: new Date().toISOString(),
    chain: [{
      stage: 'original',
      hash,
      timestamp: new Date().toISOString(),
      operator,
      tool: TOOL_NAME,
      toolVersion: TOOL_VERSION,
      notes: 'Initial evidence acquisition'
    }],
    metadata,
    verified: true,
    verificationErrors: []
  };
  
  return chain;
}

// Add processing stage to chain
function addProcessingStage(
  chain: ChainOfCustody,
  stage: ProcessingStage,
  outputHash: string,
  operator: string = 'system',
  notes?: string
): ChainOfCustody {
  const lastRecord = chain.chain[chain.chain.length - 1];
  
  const newRecord: HashRecord = {
    stage,
    hash: outputHash,
    timestamp: new Date().toISOString(),
    operator,
    tool: TOOL_NAME,
    toolVersion: TOOL_VERSION,
    inputHash: lastRecord.hash,
    notes
  };
  
  return {
    ...chain,
    chain: [...chain.chain, newRecord]
  };
}

// Verify chain integrity
function verifyChain(chain: ChainOfCustody): VerificationResult {
  const result: VerificationResult = {
    valid: true,
    evidenceId: chain.evidenceId,
    chainLength: chain.chain.length,
    errors: [],
    warnings: [],
    lastVerifiedStage: null
  };
  
  // Check chain has at least original record
  if (chain.chain.length === 0) {
    result.valid = false;
    result.errors.push('Chain is empty - no processing records');
    return result;
  }
  
  // Verify first record is original
  if (chain.chain[0].stage !== 'original') {
    result.valid = false;
    result.errors.push(`First stage should be 'original', found '${chain.chain[0].stage}'`);
  }
  
  // Verify original hash matches
  if (chain.chain[0].hash !== chain.originalHash) {
    result.valid = false;
    result.errors.push('Original hash mismatch');
  }
  
  // Verify chain continuity
  for (let i = 1; i < chain.chain.length; i++) {
    const current = chain.chain[i];
    const previous = chain.chain[i - 1];
    
    // Check input hash matches previous output hash
    if (current.inputHash && current.inputHash !== previous.hash) {
      result.valid = false;
      result.errors.push(`Chain break at stage ${i} (${current.stage}): input hash doesn't match previous output`);
    }
    
    // Check timestamps are sequential
    const currentTime = new Date(current.timestamp).getTime();
    const previousTime = new Date(previous.timestamp).getTime();
    if (currentTime < previousTime) {
      result.warnings.push(`Timestamp anomaly at stage ${i}: ${current.stage} is before ${previous.stage}`);
    }
  }
  
  if (result.valid) {
    result.lastVerifiedStage = chain.chain[chain.chain.length - 1].stage;
  }
  
  return result;
}

// Generate forensic report
function generateForensicReport(chain: ChainOfCustody): string {
  const verification = verifyChain(chain);
  
  let report = `# Forensic Evidence Report

## Evidence Summary

| Field | Value |
|-------|-------|
| Evidence ID | ${chain.evidenceId} |
| Original Filename | ${chain.originalFilename} |
| Original Path | ${chain.originalPath} |
| MIME Type | ${chain.mimeType} |
| File Size | ${chain.fileSize.toLocaleString()} bytes |
| Original Hash (SHA-256) | \`${chain.originalHash}\` |
| Acquisition Date | ${chain.createdAt} |
| Chain Length | ${chain.chain.length} stages |
| Verification Status | ${verification.valid ? '✅ VERIFIED' : '❌ FAILED'} |

## Chain of Custody

`;

  for (const record of chain.chain) {
    report += `### Stage: ${record.stage.toUpperCase()}

- **Timestamp:** ${record.timestamp}
- **Operator:** ${record.operator}
- **Tool:** ${record.tool} v${record.toolVersion}
- **Output Hash:** \`${record.hash}\`
${record.inputHash ? `- **Input Hash:** \`${record.inputHash}\`` : ''}
${record.notes ? `- **Notes:** ${record.notes}` : ''}

`;
  }

  if (verification.errors.length > 0) {
    report += `## Verification Errors

`;
    for (const error of verification.errors) {
      report += `- ❌ ${error}\n`;
    }
    report += '\n';
  }

  if (verification.warnings.length > 0) {
    report += `## Warnings

`;
    for (const warning of verification.warnings) {
      report += `- ⚠️ ${warning}\n`;
    }
    report += '\n';
  }

  if (Object.keys(chain.metadata).length > 0) {
    report += `## Metadata

\`\`\`json
${JSON.stringify(chain.metadata, null, 2)}
\`\`\`

`;
  }

  report += `---

**Report Generated:** ${new Date().toISOString()}
**Tool:** ${TOOL_NAME} v${TOOL_VERSION}
**Hash Algorithm:** SHA-256

*This report documents the chain of custody for digital evidence. Each processing stage is cryptographically linked to ensure integrity and admissibility.*
`;

  return report;
}

// Export chain in various formats
function exportChain(chain: ChainOfCustody, format: ExportFormat): string {
  switch (format) {
    case 'evidence_json':
      return JSON.stringify(chain, null, 2);
    
    case 'court_csv':
      const headers = ['Stage', 'Timestamp', 'Operator', 'Tool', 'Hash', 'Input Hash', 'Notes'];
      const rows = chain.chain.map(r => [
        r.stage,
        r.timestamp,
        r.operator,
        `${r.tool} v${r.toolVersion}`,
        r.hash,
        r.inputHash || '',
        r.notes || ''
      ].map(v => `"${v}"`).join(','));
      return [headers.join(','), ...rows].join('\n');
    
    case 'timeline_json':
      return JSON.stringify({
        evidenceId: chain.evidenceId,
        timeline: chain.chain.map(r => ({
          timestamp: r.timestamp,
          stage: r.stage,
          hash: r.hash.slice(0, 16) + '...',
          operator: r.operator
        }))
      }, null, 2);
    
    case 'forensic_report':
      return generateForensicReport(chain);
    
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}

// Tool definitions for MCP registry
export const evidenceHasherTools = [
  {
    name: 'evidence.create_chain',
    description: 'Create a new chain of custody for evidence file. Generates unique evidence ID and initial hash.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to evidence file' },
        operator: { type: 'string', description: 'Name of operator/analyst', default: 'system' },
        metadata: { type: 'object', description: 'Additional metadata (case number, source, etc.)' }
      },
      required: ['filePath']
    },
    handler: async (params: { filePath: string; operator?: string; metadata?: Record<string, any> }) => {
      const chain = await createChainOfCustody(
        params.filePath,
        params.operator || 'system',
        params.metadata || {}
      );
      return {
        success: true,
        evidenceId: chain.evidenceId,
        originalHash: chain.originalHash,
        chain
      };
    }
  },
  {
    name: 'evidence.add_stage',
    description: 'Add a processing stage to existing chain of custody',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'object', description: 'Existing chain of custody object' },
        stage: { 
          type: 'string', 
          enum: ['imported', 'converted', 'normalized', 'analyzed', 'redacted', 'exported'],
          description: 'Processing stage type' 
        },
        outputFilePath: { type: 'string', description: 'Path to output file (for hashing)' },
        outputContent: { type: 'string', description: 'Output content (alternative to file path)' },
        operator: { type: 'string', default: 'system' },
        notes: { type: 'string', description: 'Processing notes' }
      },
      required: ['chain', 'stage']
    },
    handler: async (params: {
      chain: ChainOfCustody;
      stage: ProcessingStage;
      outputFilePath?: string;
      outputContent?: string;
      operator?: string;
      notes?: string;
    }) => {
      let outputHash: string;
      
      if (params.outputFilePath) {
        outputHash = await hashFile(params.outputFilePath);
      } else if (params.outputContent) {
        outputHash = hashContent(params.outputContent);
      } else {
        throw new Error('Either outputFilePath or outputContent required');
      }
      
      const updatedChain = addProcessingStage(
        params.chain,
        params.stage,
        outputHash,
        params.operator || 'system',
        params.notes
      );
      
      return {
        success: true,
        stage: params.stage,
        hash: outputHash,
        chain: updatedChain
      };
    }
  },
  {
    name: 'evidence.verify',
    description: 'Verify integrity of chain of custody',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'object', description: 'Chain of custody to verify' }
      },
      required: ['chain']
    },
    handler: async (params: { chain: ChainOfCustody }) => {
      return verifyChain(params.chain);
    }
  },
  {
    name: 'evidence.hash_file',
    description: 'Generate SHA-256 hash of a file',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to file' }
      },
      required: ['filePath']
    },
    handler: async (params: { filePath: string }) => {
      const hash = await hashFile(params.filePath);
      const stats = await fs.stat(params.filePath);
      return {
        hash,
        algorithm: 'sha256',
        fileSize: stats.size,
        filename: path.basename(params.filePath)
      };
    }
  },
  {
    name: 'evidence.hash_content',
    description: 'Generate SHA-256 hash of content string',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to hash' }
      },
      required: ['content']
    },
    handler: async (params: { content: string }) => {
      return {
        hash: hashContent(params.content),
        algorithm: 'sha256',
        contentLength: params.content.length
      };
    }
  },
  {
    name: 'evidence.export',
    description: 'Export chain of custody in various formats for legal proceedings',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'object', description: 'Chain of custody to export' },
        format: { 
          type: 'string', 
          enum: ['evidence_json', 'court_csv', 'timeline_json', 'forensic_report'],
          description: 'Export format'
        },
        outputPath: { type: 'string', description: 'Optional output file path' }
      },
      required: ['chain', 'format']
    },
    handler: async (params: { chain: ChainOfCustody; format: ExportFormat; outputPath?: string }) => {
      const content = exportChain(params.chain, params.format);
      
      if (params.outputPath) {
        await fs.writeFile(params.outputPath, content);
        return {
          success: true,
          format: params.format,
          outputPath: params.outputPath,
          contentLength: content.length
        };
      }
      
      return {
        success: true,
        format: params.format,
        content
      };
    }
  },
  {
    name: 'evidence.generate_report',
    description: 'Generate comprehensive forensic report for evidence',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { type: 'object', description: 'Chain of custody' }
      },
      required: ['chain']
    },
    handler: async (params: { chain: ChainOfCustody }) => {
      const report = generateForensicReport(params.chain);
      const verification = verifyChain(params.chain);
      return {
        report,
        verification,
        evidenceId: params.chain.evidenceId
      };
    }
  }
];

export { 
  createChainOfCustody, 
  addProcessingStage, 
  verifyChain, 
  generateForensicReport, 
  exportChain,
  hashFile,
  hashContent
};
export default evidenceHasherTools;
