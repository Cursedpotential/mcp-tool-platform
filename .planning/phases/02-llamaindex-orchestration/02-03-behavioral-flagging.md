---
phase: "02"
plan: "03-behavioral-flagging"
type: "auto"
wave: 1
depends_on: ["02-02-legacy-parser-porting"]
---

# Phase 2, Plan 3: Behavioral Flagging (ConflictAnalysisApp Port)

## Objective
Port the critical forensic flagging logic from the legacy `ConflictAnalysisApp/src/message_analyzer.py` into a modern LlamaIndex `BaseExtractor`. This ensures every chunk of text ingested by the platform is automatically scanned for behavioral patterns (mapping to MCL 722.23 factors) and forensically tagged before entering the vector database.

## Context
As requested by the user, the Desktop UI of ConflictAnalysisApp is deferred, but its underlying *analysis engine* is absolutely part of Sprint 1. By building this as a LlamaIndex Extractor, the flagging happens at the "Home Depot" backend layer. Any text (SMS, PDF, email) passing through the pipeline will inherit these behavioral metadata tags, making hybrid search extremely powerful.

## Tasks

### [Task 1] Create the Behavioral Regex Engine
- **Type**: `auto`
- **Action**: Create `server/mcp/ingest/extractors/BehavioralFlagExtractor.ts`.
  - Implement a class extending LlamaIndex's `BaseExtractor`.
  - Port the regex dictionaries from the legacy Python script:
    - Rule 2.1 Denial
    - Rule 3.1 Substance Accusation
    - Rule 5.1 Volatility/Threats
    - Rule X.2 Parental Leverage
    - Rule C Alienation
    - General Insults / Legal Threats
  - Override the `extract()` method so it iterates through each Document's `text` property, tests the regexes, and injects matched flags into the `metadata.forensic_flags` array.

### [Task 2] Wire the Extractor into the Pipeline
- **Type**: `auto`
- **Action**: Update `server/mcp/ingest/index.ts`.
  - Import the new `BehavioralFlagExtractor`.
  - After the `SmsXmlReader` creates chunks, run them through `BehavioralFlagExtractor.extract(chunks)`.
  - Log the total number of flags detected during ingestion for debugging.

## Verification
- Extractor compiles without type errors.
- Extractor successfully implements the LlamaIndex interface.
- Passing a mock chunk containing the word "meth" or "I'll kill you" successfully appends the correct forensic flag to its metadata.

## Output
- New `server/mcp/ingest/extractors/BehavioralFlagExtractor.ts`
- Updated `server/mcp/ingest/index.ts`
