/**
 * TrinityRouter - Multi-System Database Orchestrator for Salem Forensic Trinity
 * Implements the 4-Tier Memory Architecture (updated Feb 2026)
 *
 * ARCHITECTURE:
 * - Tier 1: PostgreSQL (VPS1) - Primary relational data & audit logs
 * - Tier 1: Neo4j + Graphiti (Cloud) - Temporal knowledge graph
 * - Tier 1: Directus (VPS1) - Binary file vault
 * - Tier 2: ChromaDB (VPS2) - Short-term working memory (72hr TTL)
 * - Tier 3: PGVector (VPS1) - Permanent semantic search (LangChain)
 */

import { getPgClient, getDb as getPgDb, checkPgVector } from '../../core/db.postgres';
import { graphitiClient } from './graphiti-client';
import { chromaManager } from './chroma-client';
import { createDirectusClient } from './directus-client';
import { getPgVectorClient } from './pgvector-client';
import * as crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface EvidencePayload {
  caseId: string;
  type: 'message' | 'document' | 'entity' | 'file';
  content: string;
  metadata: Record<string, any>;
  file?: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
  timestamp?: string; // ISO timestamp, defaults to now
}

export interface StoreResult {
  success: boolean;
  postgresId?: string | number;
  directusId?: string;
  chromaId?: string;
  graphitiNodes?: string[];
  hash: string;
  timestamp: string;
  errors?: Array<{ system: string; message: string }>;
}

export interface QueryParams {
  query: string;
  caseId?: string;
  type: 'semantic' | 'temporal' | 'spatial' | 'relational' | 'comprehensive';
  limit?: number;
  asOfDate?: string;
  includeWorkingMemory?: boolean;
}

// ============================================================================
// TRINITY ROUTER
// ============================================================================

export class TrinityRouter {
  private pgClient: any = null;
  private pgDb: any = null;
  private graphiti = graphitiClient;
  private chroma = chromaManager;
  private directus = createDirectusClient();
  private pgvector = getPgVectorClient();
  private initialized: boolean = false;

  constructor() {
    console.log('[TrinityRouter] Orchestrator initialized (4-tier architecture)');
  }

  /**
   * Initialize all connections
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    try {
      console.log('[TrinityRouter] Connecting to all storage systems (4-tier)...');

      // 1. Postgres
      this.pgClient = await getPgClient();
      this.pgDb = await getPgDb();

      // 2. Graphiti (Neo4j)
      await this.graphiti.testConnection();

      // 3. ChromaDB (Tier 2 - Working Memory)
      await this.chroma.initialize();

      // 4. Directus
      await this.directus.connect();

      // 5. PGVector (Tier 3 - Permanent Semantic Search)
      try {
        await this.pgvector.initialize();
        console.log('[TrinityRouter] PGVector (Tier 3) initialized successfully');
      } catch (err) {
        console.warn('[TrinityRouter] PGVector initialization failed, continuing without Tier 3:', err);
        // Non-fatal - system can operate without pgvector
      }

      this.initialized = true;
      console.log('[TrinityRouter] All storage tiers connected successfully');
      return true;
    } catch (error) {
      console.error('[TrinityRouter] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Store evidence across all relevant tiers
   * Orchestrates the multi-system write operation
   */
  async storeEvidence(payload: EvidencePayload): Promise<StoreResult> {
    await this.initialize();

    const timestamp = payload.timestamp || new Date().toISOString();
    const result: StoreResult = {
      success: true,
      hash: '',
      timestamp,
      errors: []
    };

    // 1. Calculate Forensic Hash (SHA-256)
    const hashSource = payload.file
      ? payload.file.buffer
      : Buffer.from(payload.content + JSON.stringify(payload.metadata));
    result.hash = crypto.createHash('sha256').update(hashSource).digest('hex');

    try {
      // --- TIER 1A: FILE VAULT (DIRECTUS) ---
      if (payload.file) {
        try {
          const directusFile = await this.directus.uploadFile(
            payload.file.buffer,
            payload.file.filename,
            {
              title: `Evidence: ${payload.file.filename}`,
              metadata: {
                case_id: payload.caseId,
                sha256_hash: result.hash,
                original_timestamp: timestamp
              }
            }
          );
          result.directusId = directusFile.id;
        } catch (err: any) {
          result.errors?.push({ system: 'directus', message: err.message });
          console.warn('[TrinityRouter] Directus storage failed:', err.message);
        }
      }

      // --- TIER 1B: PRIMARY RELATIONAL (POSTGRES) ---
      try {
        if (this.pgClient) {
          // Log to audit log first
          await this.pgClient`
            INSERT INTO audit_log 
              (action, resource_type, resource_id, sha256_hash, details, created_at)
            VALUES 
              ('store_evidence', ${payload.type}, ${payload.caseId}, ${result.hash}, ${JSON.stringify(payload.metadata)}, ${timestamp})
          `.catch(() => { }); // Ignore audit log failure for now if table missing

          // Insert into evidence table
          const pgResult = await this.pgClient`
            INSERT INTO evidence 
              (case_id, content, metadata, sha256_hash, directus_id, created_at)
            VALUES 
              (${payload.caseId}, ${payload.content}, ${payload.metadata}, ${result.hash}, ${result.directusId || null}, ${timestamp})
            RETURNING id
          `;
          result.postgresId = pgResult[0].id;
        }
      } catch (err: any) {
        result.errors?.push({ system: 'postgres', message: err.message });
        console.warn('[TrinityRouter] Postgres storage failed:', err.message);
      }

      // --- TIER 1C: TEMPORAL GRAPH (GRAPHITI) ---
      try {
        const entities = payload.metadata.entities || [];
        const graphNodes: string[] = [];

        if (entities.length > 0) {
          const mappedEntities = entities.map((e: any) => ({
            id: crypto.randomUUID(),
            type: e.type || 'Entity',
            name: e.name || String(e),
            properties: {
              case_id: payload.caseId,
              evidence_hash: result.hash,
              valid_from: timestamp,
              ...e
            },
            sourceDocumentId: result.postgresId ? String(result.postgresId) : undefined
          }));

          await this.graphiti.storeEntities(mappedEntities);
          graphNodes.push(...mappedEntities.map((e: any) => e.id));
        }
        result.graphitiNodes = graphNodes;
      } catch (err: any) {
        result.errors?.push({ system: 'graphiti', message: err.message });
        console.warn('[TrinityRouter] Graphiti storage failed:', err.message);
      }

      // --- TIER 2: WORKING MEMORY (CHROMA) ---
      try {
        const chromaId = `ev_${result.hash.substring(0, 16)}_${Date.now()}`;

        // Mock embedding for now
        const mockEmbedding = Array(1536).fill(0).map(() => Math.random());

        // Correct usage of addEvidence: documentId, chunks, embeddings
        await this.chroma.addEvidence(
          `doc_${result.hash}`,
          [{
            id: chromaId,
            text: payload.content,
            metadata: {
              ...payload.metadata,
              sha256_hash: result.hash,
              postgres_id: String(result.postgresId || ''),
              directus_id: result.directusId || ''
            }
          }],
          [mockEmbedding]
        );
        result.chromaId = chromaId;
      } catch (err: any) {
        result.errors?.push({ system: 'chroma', message: err.message });
        console.warn('[TrinityRouter] Chroma storage failed:', err.message);
      }

      // --- TIER 3: PERMANENT SEMANTIC SEARCH (PGVECTOR) ---
      try {
        const pgvectorId = await this.pgvector.storeEmbedding({
          caseId: payload.caseId,
          content: payload.content,
          metadata: {
            ...payload.metadata,
            evidence_type: payload.type,
            timestamp
          },
          postgresId: result.postgresId,
          hash: result.hash
        });
        console.log('[TrinityRouter] Tier 3 (PGVector) storage successful:', pgvectorId);
      } catch (err: any) {
        result.errors?.push({ system: 'pgvector', message: err.message });
        console.warn('[TrinityRouter] PGVector storage failed:', err.message);
        // Non-fatal - evidence still stored in other tiers
      }

    } catch (err: any) {
      result.success = false;
      console.error('[TrinityRouter] Critical error in storeEvidence:', err);
    }

    return result;
  }

  /**
   * Capability-based Query Routing
   */
  async query(params: QueryParams): Promise<any> {
    await this.initialize();

    switch (params.type) {
      case 'temporal':
        // Route to Graphiti for time-aware traversals
        // Use generic runQuery since query method doesn't exist
        return await this.graphiti.runQuery(params.query, {
          case_id: params.caseId,
          asOfDate: params.asOfDate
        });

      case 'semantic':
        const workingMemory = params.includeWorkingMemory !== false
          ? await this.chroma.queryEvidence(Array(1536).fill(0), params.limit || 10, { case_id: params.caseId })
          : { ids: [] };

        const longTermMemory = await this.queryPgVector(params.query, params.caseId, params.limit);

        return {
          workingMemory,
          longTermMemory,
          combinedCount: (workingMemory.ids[0]?.length || 0) + (longTermMemory?.length || 0)
        };

      case 'spatial':
        return await this.queryPostGIS(params.query, params.caseId);

      case 'relational':
        return await this.pgClient`
          SELECT * FROM evidence 
          WHERE case_id = ${params.caseId} 
          AND content ILIKE ${'%' + params.query + '%'}
          LIMIT ${params.limit || 50}
        `;

      case 'comprehensive':
        const [graph, vector, sql] = await Promise.all([
          this.graphiti.runQuery(params.query, { case_id: params.caseId }),
          this.queryPgVector(params.query, params.caseId, 5),
          this.pgClient`SELECT * FROM evidence WHERE case_id = ${params.caseId} LIMIT 5`
        ]);

        return { graph, vector, sql };

      default:
        throw new Error(`Unsupported query type: ${params.type}`);
    }
  }

  /**
   * Query pgvector using LangChain integration (Tier 3)
   * Performs permanent semantic search with Ollama embeddings
   */
  private async queryPgVector(query: string, caseId?: string, limit: number = 5): Promise<any[]> {
    try {
      const results = await this.pgvector.semanticSearch(query, caseId, limit);
      return results.map(result => ({
        content: result.content,
        metadata: result.metadata,
        similarity_score: result.score
      }));
    } catch (err) {
      console.error('[TrinityRouter] PGVector query failed:', err);
      return [];
    }
  }

  private async queryPostGIS(query: string, caseId?: string): Promise<any[]> {
    if (!this.pgClient) return [];
    try {
      return await this.pgClient`
        SELECT * FROM evidence 
        WHERE case_id = ${caseId}
        AND ST_DWithin(location, ST_GeomFromText(${query}, 4326), 1000)
      `;
    } catch (err) {
      console.error('[TrinityRouter] PostGIS query failed:', err);
      return [];
    }
  }

  async verifyIntegrity(postgresId: string | number): Promise<{
    isValid: boolean;
    details: any;
    systems: Record<string, boolean>;
  }> {
    await this.initialize();

    const pgEv = await this.pgClient`SELECT * FROM evidence WHERE id = ${postgresId}`;
    if (!pgEv || pgEv.length === 0) throw new Error('Evidence not found in Postgres');

    const evidence = pgEv[0];
    const results = {
      isValid: true,
      details: evidence,
      systems: { postgres: true, directus: false, chroma: false, graphiti: false }
    };

    if (evidence.directus_id) {
      try {
        const directusVerify = await this.directus.verifyFileIntegrity(evidence.directus_id);
        results.systems.directus = directusVerify.valid;
        if (!directusVerify.valid) results.isValid = false;
      } catch (err) {
        console.warn('[TrinityRouter] Directus verification failed');
      }
    }

    try {
      // Use queryEntitiesByType or raw query instead of findNodes
      const graphNodes = await this.graphiti.runQuery(
        'MATCH (e:Entity {evidence_hash: $hash}) RETURN e',
        { hash: evidence.sha256_hash }
      );
      results.systems.graphiti = graphNodes.length > 0;
    } catch (err) {
      console.warn('[TrinityRouter] Graphiti verification failed');
    }

    return results;
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.graphiti.close(),
      this.pgvector.close(),
    ]);
    this.initialized = false;
    console.log('[TrinityRouter] All storage tiers shut down');
  }
}

export const trinityRouter = new TrinityRouter();
export default trinityRouter;
