---
phase: "02"
plan: "01-ingest-chain-of-custody"
type: "auto"
wave: 1
---

# Phase 2, Plan 1: The "Front Door" (Ingestion & Chain of Custody)

## Objective
Establish the physical "Front Door" of the platform using the new LlamaIndex Orchestration architecture. This plan implements strict Chain of Custody (SHA-256) and Time-Ordered UUIDs (UUIDv7) for incoming files, securely logging them to DuckDB (Tier 1 Storage) before any processing begins.

## Context
As defined in `ARCHITECTURE_SSOT.md` and `SPRINT1_PORTING_PLAN.md`:
- Every piece of evidence entering the system must be cryptographically hashed (SHA-256) at the exact moment of ingestion (First-Touch).
- Every entity must be keyed using UUIDv7 to ensure natural chronological clustering in the database.
- `DuckDB` acts as the master clock and ETL staging ground.
- We must enforce these constraints at the API ingestion level before handing anything off to LlamaIndex extractors.

## Tasks

### [Task 1] Dependency Management
- **Type**: `auto`
- **Action**: Ensure `uuidv7`, `llamaindex`, and `@microsoft/recognizers-text-suite` are fully installed in `package.json` and available to the TypeScript backend. Note: We hit an npm cache error previously; we need to resolve it or bypass the cache to ensure the dependencies lock correctly.

### [Task 2] Upgrade DuckDB Schema (Chain of Custody Enforcement)
- **Type**: `auto`
- **Action**: Modify `server/mcp/storage/duckdb.ts`.
  - Update the `IngestionLog` interface and `CREATE TABLE` statements.
  - Ensure the `id` column strictly uses UUIDv7 (replace `randomUUID()`).
  - Verify that the `source_hash` column is enforced as a unique SHA-256 string.
  - Add a dedicated method: `createDocumentId(): string` to generate UUIDv7.

### [Task 3] Create the Ingest Router (The Front Door)
- **Type**: `auto`
- **Action**: Create `server/mcp/ingest/index.ts`.
  - This file serves as the unified entry point for all uploads.
  - Implement a function `ingestEvidence(fileBuffer, metadata)`.
  - This function must: 1) Generate the SHA-256 hash, 2) Generate the UUIDv7 `DocumentID`, 3) Write to DuckDB via `logIngestion`, and 4) Return the locked `DocumentID` for downstream processing.

## Verification
- DuckDB schema successfully compiles and initializes.
- A mock file buffer passed to `ingestEvidence` successfully generates a UUIDv7 ID and a SHA-256 hash.
- The `IngestionLog` table correctly stores the mock record.

## Output
- Modified `server/mcp/storage/duckdb.ts`
- New `server/mcp/ingest/index.ts`
- Updated `package.json`
