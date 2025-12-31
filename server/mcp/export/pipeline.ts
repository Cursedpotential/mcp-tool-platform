/**
 * Export Pipeline
 * 
 * Handles export of preprocessed data to final destinations:
 * - Neo4j graph database
 * - Supabase (PostgreSQL)
 * - Vector databases (Chroma, FAISS, etc.)
 * - JSON/CSV file export
 * 
 * This is the final stage before data flows to the orchestrating agent.
 */

import { getContentStore } from '../store/content-store';
import type { ContentRef, Entity, DocumentChunk } from '../../../shared/mcp-types';

interface Citation {
  id: string;
  text: string;
  sourceRef: string;
  startOffset: number;
  endOffset: number;
  relevanceScore: number;
}

// ============================================================================
// Types
// ============================================================================

export interface ExportConfig {
  neo4j?: {
    uri: string;
    username: string;
    password: string;
    database?: string;
  };
  supabase?: {
    url: string;
    key: string;
  };
  vectorDb?: {
    type: 'chroma' | 'faiss' | 'pinecone';
    config: Record<string, unknown>;
  };
}

export interface ExportResult {
  success: boolean;
  destination: string;
  recordsExported: number;
  errors?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProcessedDocument {
  id: string;
  sourceRef: ContentRef;
  title?: string;
  content: string;
  chunks: DocumentChunk[];
  entities: Entity[];
  keywords: Array<{ keyword: string; score: number }>;
  sentiment?: { label: string; score: number };
  citations?: Citation[];
  metadata: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, unknown>;
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export processed document to Neo4j
 */
export async function exportToNeo4j(
  doc: ProcessedDocument,
  config: ExportConfig['neo4j']
): Promise<ExportResult> {
  if (!config) {
    return {
      success: false,
      destination: 'neo4j',
      recordsExported: 0,
      errors: ['Neo4j configuration not provided'],
    };
  }

  try {
    // Generate Cypher statements for the document
    const statements = generateNeo4jStatements(doc);

    // In production, execute via Neo4j driver
    // For now, return the statements as metadata
    return {
      success: true,
      destination: 'neo4j',
      recordsExported: statements.length,
      metadata: {
        statements: statements.slice(0, 5), // Preview
        totalStatements: statements.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      destination: 'neo4j',
      recordsExported: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Export processed document to Supabase
 */
export async function exportToSupabase(
  doc: ProcessedDocument,
  config: ExportConfig['supabase']
): Promise<ExportResult> {
  if (!config) {
    return {
      success: false,
      destination: 'supabase',
      recordsExported: 0,
      errors: ['Supabase configuration not provided'],
    };
  }

  try {
    // Generate SQL/records for Supabase
    const records = generateSupabaseRecords(doc);

    // In production, use Supabase client
    // For now, return the records as metadata
    return {
      success: true,
      destination: 'supabase',
      recordsExported: records.documents.length + records.chunks.length + records.entities.length,
      metadata: {
        documentCount: records.documents.length,
        chunkCount: records.chunks.length,
        entityCount: records.entities.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      destination: 'supabase',
      recordsExported: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Export embeddings to vector database
 */
export async function exportToVectorDb(
  doc: ProcessedDocument,
  embeddings: Array<{ chunkId: string; vector: number[] }>,
  config: ExportConfig['vectorDb']
): Promise<ExportResult> {
  if (!config) {
    return {
      success: false,
      destination: 'vectordb',
      recordsExported: 0,
      errors: ['Vector DB configuration not provided'],
    };
  }

  try {
    // Format for vector DB
    const vectors = embeddings.map((e) => ({
      id: e.chunkId,
      values: e.vector,
      metadata: {
        documentId: doc.id,
        sourceRef: doc.sourceRef,
      },
    }));

    // In production, use appropriate vector DB client
    return {
      success: true,
      destination: `vectordb:${config.type}`,
      recordsExported: vectors.length,
      metadata: {
        dimensions: embeddings[0]?.vector.length ?? 0,
        vectorCount: vectors.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      destination: 'vectordb',
      recordsExported: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Export to JSON file
 */
export async function exportToJson(
  doc: ProcessedDocument
): Promise<{
  ref: ContentRef;
  size: number;
}> {
  const store = await getContentStore();
  const json = JSON.stringify(doc, null, 2);
  const stored = await store.put(json, 'application/json');

  return {
    ref: stored.ref,
    size: stored.size,
  };
}

/**
 * Export to CSV format
 */
export async function exportToCsv(
  doc: ProcessedDocument,
  options: { includeChunks?: boolean; includeEntities?: boolean }
): Promise<{
  refs: Array<{ type: string; ref: ContentRef }>;
}> {
  const store = await getContentStore();
  const refs: Array<{ type: string; ref: ContentRef }> = [];

  // Document metadata CSV
  const docCsv = [
    'id,title,source_ref,chunk_count,entity_count,sentiment_label,sentiment_score',
    `"${doc.id}","${doc.title ?? ''}","${doc.sourceRef}",${doc.chunks.length},${doc.entities.length},"${doc.sentiment?.label ?? ''}",${doc.sentiment?.score ?? ''}`,
  ].join('\n');

  const docStored = await store.put(docCsv, 'text/csv');
  refs.push({ type: 'document', ref: docStored.ref });

  // Chunks CSV
  if (options.includeChunks && doc.chunks.length > 0) {
    const chunkLines = ['chunk_id,document_id,index,type,start_offset,end_offset,content'];
    for (const chunk of doc.chunks) {
      chunkLines.push(
        `"${chunk.id}","${chunk.documentId}",${chunk.index},"${chunk.type}",${chunk.startOffset},${chunk.endOffset},"${escapeCSV(chunk.content)}"`
      );
    }
    const chunkStored = await store.put(chunkLines.join('\n'), 'text/csv');
    refs.push({ type: 'chunks', ref: chunkStored.ref });
  }

  // Entities CSV
  if (options.includeEntities && doc.entities.length > 0) {
    const entityLines = ['entity_text,entity_type,start_offset,end_offset,confidence'];
    for (const entity of doc.entities) {
      entityLines.push(
        `"${escapeCSV(entity.text)}","${entity.type}",${entity.startOffset},${entity.endOffset},${entity.confidence}`
      );
    }
    const entityStored = await store.put(entityLines.join('\n'), 'text/csv');
    refs.push({ type: 'entities', ref: entityStored.ref });
  }

  return { refs };
}

/**
 * Batch export multiple documents
 */
export async function batchExport(
  docs: ProcessedDocument[],
  config: ExportConfig
): Promise<{
  results: ExportResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}> {
  const results: ExportResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const doc of docs) {
    // Export to each configured destination
    if (config.neo4j) {
      const result = await exportToNeo4j(doc, config.neo4j);
      results.push(result);
      if (result.success) successful++;
      else failed++;
    }

    if (config.supabase) {
      const result = await exportToSupabase(doc, config.supabase);
      results.push(result);
      if (result.success) successful++;
      else failed++;
    }
  }

  return {
    results,
    summary: {
      total: docs.length,
      successful,
      failed,
    },
  };
}

// ============================================================================
// Graph Generation for Neo4j
// ============================================================================

function generateNeo4jStatements(doc: ProcessedDocument): string[] {
  const statements: string[] = [];

  // Create document node
  statements.push(`
    MERGE (d:Document {id: "${doc.id}"})
    SET d.title = "${doc.title ?? ''}"
    SET d.sourceRef = "${doc.sourceRef}"
    SET d.chunkCount = ${doc.chunks.length}
    SET d.entityCount = ${doc.entities.length}
  `.trim());

  // Create chunk nodes and relationships
  for (const chunk of doc.chunks) {
    statements.push(`
      MERGE (c:Chunk {id: "${chunk.id}"})
      SET c.index = ${chunk.index}
      SET c.type = "${chunk.type}"
      SET c.startOffset = ${chunk.startOffset}
      SET c.endOffset = ${chunk.endOffset}
      WITH c
      MATCH (d:Document {id: "${doc.id}"})
      MERGE (d)-[:HAS_CHUNK]->(c)
    `.trim());
  }

  // Create entity nodes and relationships
  const entityMap = new Map<string, string>();
  for (const entity of doc.entities) {
    const entityId = `${entity.type}-${entity.text}`.replace(/[^a-zA-Z0-9-]/g, '_');
    if (!entityMap.has(entityId)) {
      entityMap.set(entityId, entity.text);
      statements.push(`
        MERGE (e:Entity:${entity.type} {id: "${entityId}"})
        SET e.text = "${escapeNeo4j(entity.text)}"
        SET e.type = "${entity.type}"
      `.trim());
    }

    statements.push(`
      MATCH (d:Document {id: "${doc.id}"})
      MATCH (e:Entity {id: "${entityId}"})
      MERGE (d)-[:MENTIONS {offset: ${entity.startOffset}, confidence: ${entity.confidence}}]->(e)
    `.trim());
  }

  // Create keyword relationships
  for (const kw of doc.keywords) {
    statements.push(`
      MERGE (k:Keyword {text: "${escapeNeo4j(kw.keyword)}"})
      WITH k
      MATCH (d:Document {id: "${doc.id}"})
      MERGE (d)-[:HAS_KEYWORD {score: ${kw.score}}]->(k)
    `.trim());
  }

  return statements;
}

// ============================================================================
// Supabase Record Generation
// ============================================================================

function generateSupabaseRecords(doc: ProcessedDocument): {
  documents: Array<Record<string, unknown>>;
  chunks: Array<Record<string, unknown>>;
  entities: Array<Record<string, unknown>>;
} {
  const documents = [
    {
      id: doc.id,
      title: doc.title,
      source_ref: doc.sourceRef,
      chunk_count: doc.chunks.length,
      entity_count: doc.entities.length,
      sentiment_label: doc.sentiment?.label,
      sentiment_score: doc.sentiment?.score,
      keywords: doc.keywords,
      metadata: doc.metadata,
      created_at: new Date().toISOString(),
    },
  ];

  const chunks = doc.chunks.map((chunk) => ({
    id: chunk.id,
    document_id: doc.id,
    index: chunk.index,
    type: chunk.type,
    content: chunk.content,
    start_offset: chunk.startOffset,
    end_offset: chunk.endOffset,
    level: chunk.level,
  }));

  const entities = doc.entities.map((entity, i) => ({
    id: `${doc.id}-entity-${i}`,
    document_id: doc.id,
    text: entity.text,
    type: entity.type,
    start_offset: entity.startOffset,
    end_offset: entity.endOffset,
    confidence: entity.confidence,
  }));

  return { documents, chunks, entities };
}

// ============================================================================
// Helper Functions
// ============================================================================

function escapeCSV(str: string): string {
  return str.replace(/"/g, '""').replace(/\n/g, '\\n');
}

function escapeNeo4j(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
}

/**
 * Create a processing summary for the orchestrating agent
 */
export function createProcessingSummary(doc: ProcessedDocument): {
  documentId: string;
  tokenReduction: number;
  extractedData: {
    entities: number;
    keywords: number;
    chunks: number;
    citations: number;
  };
  readyForIngestion: boolean;
  exportFormats: string[];
} {
  const originalSize = doc.content.length;
  const processedSize =
    JSON.stringify(doc.entities).length +
    JSON.stringify(doc.keywords).length +
    JSON.stringify(doc.chunks.map((c) => ({ ...c, content: c.content.slice(0, 100) }))).length;

  const tokenReduction = Math.round((1 - processedSize / originalSize) * 100);

  return {
    documentId: doc.id,
    tokenReduction,
    extractedData: {
      entities: doc.entities.length,
      keywords: doc.keywords.length,
      chunks: doc.chunks.length,
      citations: doc.citations?.length ?? 0,
    },
    readyForIngestion: true,
    exportFormats: ['neo4j', 'supabase', 'vectordb', 'json', 'csv'],
  };
}
