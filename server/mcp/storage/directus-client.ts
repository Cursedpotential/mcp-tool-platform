/**
 * Directus CMS Client - File Vault Operations
 * Self-hosted Directus for binary file management (PDF, images, exports)
 * 
 * ARCHITECTURE (Per PROJECT_INTEL_SSOT.md):
 * - Directus (VPS1): Binary file vault and metadata
 * - PostgreSQL (VPS1): Structured relational data + PGVector
 * 
 * This client handles:
 * - File upload/download with SHA-256 verification
 * - Collection management for evidence types
 * - Forensic chain-of-custody tracking
 */

import { Readable } from 'stream';
import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface DirectusConfig {
  url: string;
  email: string;
  password: string;
}

export interface DirectusFile {
  id: string;
  storage: string;
  filename_disk: string;
  filename_download: string;
  title: string;
  type: string;
  size: number;
  folder: string | null;
  uploaded_by: string | null;
  uploaded_on: string;
  modified_by: string | null;
  modified_on: string;
  sha256_hash: string | null;
  metadata: Record<string, any> | null;
}

export interface DirectusCollection {
  collection: string;
  meta: {
    collection: string;
    icon: string | null;
    color: string | null;
    item_duplication_fields: string[] | null;
    sort: string | null;
    sort_field: string | null;
    accountability: string;
    archive_field: string | null;
    archive_value: string | null;
    unarchive_value: string | null;
    slug: string;
  };
  schema: {
    name: string;
    collection: string;
    primary: string;
    singleton: boolean;
  };
}

export interface UploadOptions {
  title?: string;
  folder?: string;
  metadata?: Record<string, any>;
}

export interface QueryOptions {
  filter?: Record<string, any>;
  sort?: string[];
  limit?: number;
  offset?: number;
  fields?: string[];
}

// ============================================================================
// DIRECTUS CLIENT
// ============================================================================

export class DirectusClient {
  private config: DirectusConfig;
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private baseUrl: string;

  constructor(config: DirectusConfig) {
    this.config = config;
    // Remove trailing slash from URL
    this.baseUrl = config.url.replace(/\/$/, '');
    console.log('[DirectusClient] Initialized for:', this.baseUrl);
  }

  /**
   * Authenticate and get access token
   */
  private async authenticate(): Promise<string> {
    // Check if token is still valid
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    console.log('[DirectusClient] Authenticating...');

    const response = await this.request<{ data: { access_token: string; expires_at: number } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: this.config.email,
        password: this.config.password
      })
    });

    this.token = response.data.access_token;
    this.tokenExpiry = response.data.expires_at;

    console.log('[DirectusClient] Authenticated successfully');
    return this.token;
  }

  /**
   * Make authenticated request
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/server${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    // Add auth token if available
    if (this.token && Date.now() < this.tokenExpiry) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Directus API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make authenticated request for files endpoint
   */
  private async filesRequest<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/files${path}`;

    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {})
    };

    if (this.token && Date.now() < this.tokenExpiry) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Directus Files API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Connect to Directus
   */
  async connect(): Promise<boolean> {
    try {
      await this.authenticate();
      console.log('[DirectusClient] Connected to Directus');
      return true;
    } catch (error) {
      console.error('[DirectusClient] Connection failed:', error);
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request<{ status: string }>('/health');
      return response.status === 'ok';
    } catch {
      return false;
    }
  }

  // ============================================================================
  // FILE OPERATIONS (FORENSIC VAULT)
  // ============================================================================

  /**
   * Calculate SHA-256 hash of a buffer
   */
  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Upload a file to the vault
   * Returns file ID with SHA-256 hash for chain of custody
   */
  async uploadFile(
    fileBuffer: Buffer,
    filename: string,
    options: UploadOptions = {}
  ): Promise<DirectusFile> {
    const token = await this.authenticate();

    // Calculate forensic hash
    const sha256 = this.calculateHash(fileBuffer);
    console.log(`[DirectusClient] Uploading ${filename} (SHA-256: ${sha256.substring(0, 16)}...)`);

    // Create form data using Node.js Buffer directly
    const formData = new FormData();
    (formData as any).append('file', new Blob([new Uint8Array(fileBuffer)]), filename);
    if (options.title) {
      formData.append('title', options.title);
    }
    if (options.folder) {
      formData.append('folder', options.folder);
    }
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${error}`);
    }

    const file: DirectusFile = await response.json();

    // Update file with SHA-256 hash
    await this.updateFile(file.id, {
      metadata: {
        ...(file.metadata || {}),
        sha256_hash: sha256,
        forensic_upload_timestamp: new Date().toISOString()
      }
    });

    console.log(`[DirectusClient] File uploaded: ${file.id} (${file.size} bytes)`);

    return await this.getFile(file.id) as DirectusFile;
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string): Promise<DirectusFile | null> {
    try {
      const response = await this.filesRequest<{ data: DirectusFile }>(`/${fileId}`);
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Get file download URL
   */
  getFileUrl(fileId: string): string {
    return `${this.baseUrl}/assets/${fileId}`;
  }

  /**
   * Download file as buffer
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    const token = await this.authenticate();

    const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Download and verify SHA-256 hash
   */
  async downloadAndVerify(fileId: string, expectedHash: string): Promise<Buffer> {
    const buffer = await this.downloadFile(fileId);
    const actualHash = this.calculateHash(buffer);

    if (actualHash !== expectedHash) {
      throw new Error(`Hash mismatch: expected ${expectedHash}, got ${actualHash}`);
    }

    console.log(`[DirectusClient] File verified: ${fileId}`);
    return buffer;
  }

  /**
   * Update file metadata
   */
  async updateFile(fileId: string, updates: Partial<{
    title: string;
    folder: string;
    metadata: Record<string, any>;
  }>): Promise<DirectusFile> {
    const token = await this.authenticate();

    const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`Update failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<void> {
    const token = await this.authenticate();

    const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    console.log(`[DirectusClient] File deleted: ${fileId}`);
  }

  /**
   * List files with filtering
   */
  async listFiles(options: QueryOptions = {}): Promise<DirectusFile[]> {
    const token = await this.authenticate();

    const params = new URLSearchParams();
    if (options.filter) {
      params.append('filter', JSON.stringify(options.filter));
    }
    if (options.sort) {
      params.append('sort', JSON.stringify(options.sort));
    }
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options.offset) {
      params.append('offset', options.offset.toString());
    }
    if (options.fields) {
      params.append('fields', options.fields.join(','));
    }

    const response = await this.filesRequest<{ data: DirectusFile[] }>(`?${params}`);
    return response.data;
  }

  /**
   * Get files by SHA-256 hash (for forensic verification)
   */
  async getFilesByHash(hash: string): Promise<DirectusFile[]> {
    return this.listFiles({
      filter: {
        metadata: {
          sha256_hash: { _eq: hash }
        }
      }
    });
  }

  // ============================================================================
  // FOLDER OPERATIONS
  // ============================================================================

  /**
   * Get or create a folder
   */
  async getOrCreateFolder(name: string, parentId?: string): Promise<string> {
    const token = await this.authenticate();

    // Try to find existing folder
    const response = await this.request<{ data: Array<{ id: string; name: string }> }>('/folders', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const existing = response.data.find(f => f.name === name);
    if (existing) {
      return existing.id;
    }

    // Create new folder
    const createResponse = await fetch(`${this.baseUrl}/folders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        parent: parentId || null
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Folder creation failed: ${createResponse.status}`);
    }

    const folder = await createResponse.json();
    return folder.data.id;
  }

  // ============================================================================
  // COLLECTION MANAGEMENT
  // ============================================================================

  /**
   * List all collections
   */
  async listCollections(): Promise<DirectusCollection[]> {
    const response = await this.request<{ data: DirectusCollection[] }>('/collections');
    return response.data;
  }

  // ============================================================================
  // FORENSIC UTILITIES
  // ============================================================================

  /**
   * Verify file integrity by hash
   */
  async verifyFileIntegrity(fileId: string): Promise<{
    valid: boolean;
    storedHash: string | null;
    computedHash: string;
  }> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const buffer = await this.downloadFile(fileId);
    const computedHash = this.calculateHash(buffer);
    const storedHash = file.metadata?.sha256_hash || null;

    return {
      valid: storedHash === computedHash,
      storedHash,
      computedHash
    };
  }

  /**
   * Get file chain of custody (audit trail)
   */
  async getChainOfCustody(fileId: string): Promise<{
    uploaded: { timestamp: string; user: string | null };
    modified: Array<{ timestamp: string; user: string | null; changes: string }>;
  }> {
    const file = await this.getFile(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    return {
      uploaded: {
        timestamp: file.uploaded_on,
        user: file.uploaded_by
      },
      modified: []
      // In a full implementation, this would query the activity API
    };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createDirectusClient(config?: Partial<DirectusConfig>): DirectusClient {
  return new DirectusClient({
    url: config?.url || process.env.DIRECTUS_URL || 'http://localhost:8055',
    email: config?.email || process.env.DIRECTUS_EMAIL || '',
    password: config?.password || process.env.DIRECTUS_PASSWORD || ''
  });
}

export default { DirectusClient, createDirectusClient };
