---
phase: "02"
plan: "04-gliner2-extraction"
type: "auto"
wave: 1
depends_on: ["02-03-behavioral-flagging"]
---

# Phase 2, Plan 4: GLiNER2 CPU-Bound Entity Extraction

## Objective
Implement `GLiNER2` as a custom LlamaIndex Extractor to handle zero-shot entity recognition (NER) for Names, Locations, and specific Custody Events during Pass 1 ingestion. This must run entirely on the local CPU to avoid API costs and GPU bottlenecks.

## Context
As defined in the Two-Pass Enrichment Compute Strategy, Pass 1 must be strictly CPU-bound. GLiNER2 (Fastino) is a ~200M parameter model that excels at zero-shot NER and runs incredibly fast on standard CPUs. We will wrap it in a Python script that the LlamaIndex TypeScript pipeline can call via the `python-bridge`.

## Tasks

### [Task 1] Create the Python GLiNER2 Script
- **Type**: `auto`
- **Action**: Create `server/python-tools/enrichment/gliner_extractor.py`.
  - Import the `gliner` package.
  - Load the `fastino/gliner2-base-v1` model (will auto-download on first run).
  - Define custom entity labels: `["Person", "Location", "Organization", "Custody Event", "Legal Proceeding", "Communication"]`.
  - Set up a simple CLI interface using `argparse` or `sys.stdin` to accept JSON text chunks and return JSON entity arrays.

### [Task 2] Create the TypeScript LlamaIndex Extractor Wrapper
- **Type**: `auto`
- **Action**: Create `server/mcp/ingest/extractors/GlinerExtractor.ts`.
  - Implement `BaseExtractor` from LlamaIndex.
  - In the `extract()` method, batch the text chunks and send them to the `python-bridge` (which calls `gliner_extractor.py`).
  - Merge the returned entities into the LlamaIndex `metadata.entities` property.

### [Task 3] Wire into the Ingestion Router
- **Type**: `auto`
- **Action**: Update `server/mcp/ingest/index.ts`.
  - Add `GlinerExtractor` to the pipeline after the `BehavioralFlagExtractor`.

## Verification
- Running a mock chunk containing "John met Jane at the Flint Police Station for a custody exchange" successfully extracts:
  - Person: John
  - Person: Jane
  - Location: Flint Police Station
  - Custody Event: custody exchange
- The extraction runs locally without requiring a GPU.

## Output
- New `server/python-tools/enrichment/gliner_extractor.py`
- New `server/mcp/ingest/extractors/GlinerExtractor.ts`
- Updated `server/mcp/ingest/index.ts`
