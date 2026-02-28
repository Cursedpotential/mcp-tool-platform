---
phase: "02"
plan: "05-recognizers-text-extraction"
type: "auto"
wave: 1
depends_on: ["02-04-gliner2-extraction"]
---

# Phase 2, Plan 5: Structured Data Extraction (Recognizers-Text)

## Objective
Implement Microsoft's `Recognizers-Text` as a LlamaIndex Extractor to handle deterministic, structured data extraction (Dates, Times, Currencies, and Numbers) natively within the Node.js ingestion pipeline.

## Context
While GLiNER2 handles semantic entities (Names, Locations), it is fundamentally an NLP model and struggles with exact math, date normalization, and currency calculations. `Recognizers-Text` solves this using robust, language-aware regex engines that run natively in Node.js at zero cost. This ensures the Neo4j timeline graph has mathematically precise timestamps and financial data.

## Tasks

### [Task 1] Create the Recognizers-Text Extractor
- **Type**: `auto`
- **Action**: Create `server/mcp/ingest/extractors/RecognizersExtractor.ts`.
  - Implement `BaseExtractor` from LlamaIndex.
  - Import `@microsoft/recognizers-text-suite`.
  - In the `extract()` method, run `recognizeDateTime` and `recognizeCurrency` on each text chunk.
  - Inject the structured date/time and financial data into the LlamaIndex `metadata.structured_entities` property.

### [Task 2] Wire into the Ingestion Router
- **Type**: `auto`
- **Action**: Update `server/mcp/ingest/index.ts`.
  - Add `RecognizersExtractor` to the pipeline after the `GlinerExtractor`.
  - Accumulate stats for testing (e.g., `datesExtracted`).

### [Task 3] Finalize Sprint 1 GSD Summaries
- **Type**: `auto`
- **Action**: Generate SUMMARY.md files for plans 02-03, 02-04, and 02-05 to close out the Sprint 1 Ingestion Pipeline phase.

## Verification
- Extractor compiles and implements the interface correctly.
- The "Front Door" (`ingest/index.ts`) successfully routes a chunk through all four layers:
  1. SmsXmlReader (Chunking & Forensic Block Check)
  2. BehavioralFlagExtractor (DARVO / Gaslighting Regex)
  3. GlinerExtractor (People, Locations)
  4. RecognizersExtractor (Dates, Currencies)

## Output
- New `server/mcp/ingest/extractors/RecognizersExtractor.ts`
- Updated `server/mcp/ingest/index.ts`
- GSD Summary files for 02-03, 02-04, 02-05
