/**
 * NotebookLM Integration Plugin
 * 
 * Integrates with notebooklm-mcp to provide a shared knowledge hub
 * that all platforms (Claude, Gemini, Codex) can access.
 * 
 * NotebookLM provides zero-hallucination answers from curated documents.
 * Combined with Chroma for vector search, this creates a powerful
 * knowledge coordination layer for multi-agent workflows.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// NotebookLM MCP Tool definitions
export interface NotebookLMTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface NotebookInfo {
  id: string;
  name: string;
  url: string;
  tags: string[];
  description?: string;
  addedAt: string;
  lastUsed?: string;
}

export interface NotebookLMResponse {
  success: boolean;
  answer?: string;
  citations?: Array<{
    source: string;
    text: string;
    page?: number;
  }>;
  error?: string;
}

// NotebookLM MCP Client
export class NotebookLMClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private isConnected = false;
  private buffer = '';

  constructor(private profile: 'minimal' | 'standard' | 'full' = 'standard') {
    super();
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      // Spawn notebooklm-mcp process
      this.process = spawn('npx', ['notebooklm-mcp@latest'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NOTEBOOKLM_PROFILE: this.profile,
        },
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString();
        this.processBuffer();
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        console.error('[NotebookLM MCP]', data.toString());
      });

      this.process.on('error', (error) => {
        this.isConnected = false;
        reject(error);
      });

      this.process.on('close', (code) => {
        this.isConnected = false;
        this.emit('close', code);
      });

      // Wait for initialization
      setTimeout(() => {
        this.isConnected = true;
        resolve();
      }, 2000);
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);
          
          if (message.error) {
            reject(new Error(message.error.message || 'Unknown error'));
          } else {
            resolve(message.result);
          }
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.isConnected || !this.process) {
      throw new Error('NotebookLM MCP not connected');
    }

    const id = ++this.messageId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process!.stdin?.write(JSON.stringify(request) + '\n');

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 60000);
    });
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.isConnected = false;
  }

  // Tool implementations

  /**
   * Ask a question to the currently selected NotebookLM notebook
   */
  async askQuestion(question: string, notebookUrl?: string): Promise<NotebookLMResponse> {
    try {
      const result = await this.sendRequest('tools/call', {
        name: 'ask_question',
        arguments: {
          question,
          ...(notebookUrl && { notebook_url: notebookUrl }),
        },
      });
      return {
        success: true,
        answer: result.content?.[0]?.text || result.answer,
        citations: result.citations,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List all notebooks in the library
   */
  async listNotebooks(): Promise<NotebookInfo[]> {
    try {
      const result = await this.sendRequest('tools/call', {
        name: 'list_notebooks',
        arguments: {},
      });
      return result.notebooks || [];
    } catch (error) {
      console.error('Failed to list notebooks:', error);
      return [];
    }
  }

  /**
   * Select a notebook by name or URL
   */
  async selectNotebook(identifier: string): Promise<boolean> {
    try {
      await this.sendRequest('tools/call', {
        name: 'select_notebook',
        arguments: { identifier },
      });
      return true;
    } catch (error) {
      console.error('Failed to select notebook:', error);
      return false;
    }
  }

  /**
   * Add a notebook to the library
   */
  async addNotebook(url: string, name: string, tags: string[] = [], description?: string): Promise<boolean> {
    try {
      await this.sendRequest('tools/call', {
        name: 'add_notebook',
        arguments: {
          url,
          name,
          tags: tags.join(','),
          ...(description && { description }),
        },
      });
      return true;
    } catch (error) {
      console.error('Failed to add notebook:', error);
      return false;
    }
  }

  /**
   * Search notebooks by tags or name
   */
  async searchNotebooks(query: string): Promise<NotebookInfo[]> {
    try {
      const result = await this.sendRequest('tools/call', {
        name: 'search_notebooks',
        arguments: { query },
      });
      return result.notebooks || [];
    } catch (error) {
      console.error('Failed to search notebooks:', error);
      return [];
    }
  }

  /**
   * Remove a notebook from the library
   */
  async removeNotebook(identifier: string): Promise<boolean> {
    try {
      await this.sendRequest('tools/call', {
        name: 'remove_notebook',
        arguments: { identifier },
      });
      return true;
    } catch (error) {
      console.error('Failed to remove notebook:', error);
      return false;
    }
  }

  /**
   * Get library statistics
   */
  async getLibraryStats(): Promise<{
    totalNotebooks: number;
    totalQueries: number;
    tagCounts: Record<string, number>;
  }> {
    try {
      const result = await this.sendRequest('tools/call', {
        name: 'get_library_stats',
        arguments: {},
      });
      return result;
    } catch (error) {
      console.error('Failed to get library stats:', error);
      return { totalNotebooks: 0, totalQueries: 0, tagCounts: {} };
    }
  }
}

// Singleton instance
let notebookLMClient: NotebookLMClient | null = null;

export function getNotebookLMClient(): NotebookLMClient {
  if (!notebookLMClient) {
    notebookLMClient = new NotebookLMClient('standard');
  }
  return notebookLMClient;
}

// MCP Tool definitions for registry
export const NOTEBOOKLM_TOOLS: NotebookLMTool[] = [
  {
    name: 'notebooklm.ask',
    description: 'Ask a question to NotebookLM and get a zero-hallucination answer from your curated documents. Returns citation-backed responses.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to ask NotebookLM' },
        notebook_url: { type: 'string', description: 'Optional: specific notebook URL to query' },
      },
      required: ['question'],
    },
  },
  {
    name: 'notebooklm.list',
    description: 'List all notebooks in the NotebookLM library with their tags and descriptions.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'notebooklm.select',
    description: 'Select a notebook by name or URL to use for subsequent queries.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Notebook name or URL to select' },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'notebooklm.add',
    description: 'Add a new notebook to the library with tags for automatic selection.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'NotebookLM share URL' },
        name: { type: 'string', description: 'Display name for the notebook' },
        tags: { type: 'string', description: 'Comma-separated tags for categorization' },
        description: { type: 'string', description: 'Optional description of notebook contents' },
      },
      required: ['url', 'name'],
    },
  },
  {
    name: 'notebooklm.search',
    description: 'Search notebooks by tags or name to find relevant knowledge bases.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (tags or name)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'notebooklm.remove',
    description: 'Remove a notebook from the library.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Notebook name or URL to remove' },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'notebooklm.stats',
    description: 'Get library statistics including notebook count, query count, and tag distribution.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Tool executor
export async function executeNotebookLMTool(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  const client = getNotebookLMClient();
  
  // Ensure connected
  try {
    await client.connect();
  } catch (error) {
    return {
      success: false,
      error: 'Failed to connect to NotebookLM MCP. Make sure npx notebooklm-mcp is available.',
    };
  }

  switch (toolName) {
    case 'notebooklm.ask':
      return client.askQuestion(args.question, args.notebook_url);
    
    case 'notebooklm.list':
      return { success: true, notebooks: await client.listNotebooks() };
    
    case 'notebooklm.select':
      return { success: await client.selectNotebook(args.identifier) };
    
    case 'notebooklm.add':
      const tags = args.tags ? args.tags.split(',').map((t: string) => t.trim()) : [];
      return { success: await client.addNotebook(args.url, args.name, tags, args.description) };
    
    case 'notebooklm.search':
      return { success: true, notebooks: await client.searchNotebooks(args.query) };
    
    case 'notebooklm.remove':
      return { success: await client.removeNotebook(args.identifier) };
    
    case 'notebooklm.stats':
      return { success: true, ...(await client.getLibraryStats()) };
    
    default:
      return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
