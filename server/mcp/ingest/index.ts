import { getDuckDBClient } from '../storage/duckdb';
import { SmsXmlReader } from './readers/SmsXmlReader';
import { BehavioralFlagExtractor } from './extractors/BehavioralFlagExtractor';
import { GlinerExtractor } from './extractors/GlinerExtractor';
import { RecognizersExtractor } from './extractors/RecognizersExtractor';
import { Document } from 'llamaindex';

export interface IngestionResult {
  documentId: string;
  sourceHash: string;
  status: string;
  chunksGenerated: number;
  flagsDetected: number;
  entitiesExtracted: number;
  structuredDataExtracted: number;
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
  let totalFlags = 0;
  let totalEntities = 0;
  let totalStructuredData = 0;
  
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

      // 3. Behavioral Flagging (Pass 1 Enrichment)
      console.log(`[Ingest] Running Behavioral Flag Extractor...`);
      const flagExtractor = new BehavioralFlagExtractor();
      const flagMetadataList = await flagExtractor.extract(chunks);

      chunks.forEach((chunk, idx) => {
        const extractedMeta = flagMetadataList[idx];
        if (extractedMeta && extractedMeta['forensic_flags']) {
          chunk.metadata = { ...chunk.metadata, ...extractedMeta };
          totalFlags += (extractedMeta['forensic_flags'] as any[]).length;
        }
      });
      console.log(`[Ingest] Forensic scanning complete. Found ${totalFlags} behavioral flags.`);

      // 4. GLiNER2 Entity Extraction (Names, Locations, Events)
      console.log(`[Ingest] Running GLiNER2 Entity Extractor...`);
      const glinerExtractor = new GlinerExtractor();
      const glinerMetadataList = await glinerExtractor.extract(chunks);

      chunks.forEach((chunk, idx) => {
        const extractedMeta = glinerMetadataList[idx];
        if (extractedMeta && extractedMeta['gliner_entities']) {
          chunk.metadata = { ...chunk.metadata, ...extractedMeta };
          totalEntities += (extractedMeta['gliner_entities'] as any[]).length;
        }
      });
      console.log(`[Ingest] GLiNER2 scanning complete. Found ${totalEntities} entities.`);

      // 5. Recognizers-Text Extraction (Dates, Currencies, Phones)
      console.log(`[Ingest] Running Recognizers-Text Extractor...`);
      const recognizersExtractor = new RecognizersExtractor();
      const recognizersMetadataList = await recognizersExtractor.extract(chunks);

      chunks.forEach((chunk, idx) => {
        const extractedMeta = recognizersMetadataList[idx];
        if (extractedMeta && extractedMeta['structured_entities']) {
          chunk.metadata = { ...chunk.metadata, ...extractedMeta };
          totalStructuredData += (extractedMeta['structured_entities'] as any[]).length;
        }
      });
      console.log(`[Ingest] Recognizers scanning complete. Found ${totalStructuredData} structured items.`);
    }
    // Future routes: .pdf -> Docling, .png -> Textract
  } catch (error) {
    console.error(`[Ingest] Parsing failed for ${sourceName}:`, error);
  }

  return {
    documentId: ingestion.id,
    sourceHash: ingestion.source_hash,
    status: 'processing', // Pass 1 processing started
    chunksGenerated: chunks.length,
    flagsDetected: totalFlags,
    entitiesExtracted: totalEntities,
    structuredDataExtracted: totalStructuredData
  };
}
