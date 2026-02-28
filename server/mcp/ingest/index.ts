import { getDuckDBClient } from '../storage/duckdb';
import { SmsXmlReader } from './readers/SmsXmlReader';
import { Document } from 'llamaindex';

export interface IngestionResult {
  documentId: string;
  sourceHash: string;
  status: string;
  chunksGenerated: number;
}

/**
 * The "Front Door" - Secures Chain of Custody before passing to LlamaIndex/Parsers
 */
export async function ingestEvidence(
  sourceType: string,
  sourceName: string,
  rawContent: string | null = null,
  binaryPath: string | null = null,
  metadata: Record<string, unknown> = {}
): Promise<IngestionResult> {
  const duckdb = getDuckDBClient();
  
  // Ensure DB is ready
  if (!duckdb.isInitialized()) {
    await duckdb.initialize();
  }

  // 1. Log Ingestion (Generates SHA-256 and UUIDv7 internally)
  const ingestion = await duckdb.logIngestion(
    sourceType,
    sourceName,
    rawContent,
    binaryPath,
    metadata
  );

  console.log(`[Ingest] Successfully ingested ${sourceName} -> DocID: ${ingestion.id} (Hash: ${ingestion.source_hash})`);

  // 2. Document Routing (Modular parsing)
  let chunks: Document[] = [];
  
  try {
    if (sourceName.toLowerCase().endsWith('.xml') && binaryPath) {
      console.log(`[Ingest] XML detected. Routing to SmsXmlReader...`);
      const reader = new SmsXmlReader();
      chunks = await reader.loadData(binaryPath);
      
      // Inherit parent DocumentID for chain of custody
      chunks.forEach(chunk => {
        chunk.metadata['parent_document_id'] = ingestion.id;
        chunk.metadata['source_hash'] = ingestion.source_hash;
      });
      
      console.log(`[Ingest] Successfully chunked into ${chunks.length} LlamaIndex documents.`);
    }
    // Future routes: .pdf -> Docling, .png -> Textract
  } catch (error) {
    console.error(`[Ingest] Parsing failed for ${sourceName}:`, error);
  }

  return {
    documentId: ingestion.id,
    sourceHash: ingestion.source_hash,
    status: 'processing', // Pass 1 processing started
    chunksGenerated: chunks.length
  };
}
