---
phase: "02"
plan: "02-legacy-parser-porting"
type: "auto"
wave: 1
depends_on: ["02-01-ingest-chain-of-custody"]
---

# Phase 2, Plan 2: Porting Legacy Parsers to LlamaIndex

## Objective
Harvest the proven message parsing logic from the legacy `D:` drive workspace (`xml-sms-parser.ts`, etc.) and upgrade it into robust LlamaIndex `BaseReader` components. This allows the system to natively chunk massive XML message dumps while maintaining semantic boundaries.

## Context
As defined in `SPRINT1_PORTING_PLAN.md`:
- We are ignoring the broken TraceIQ timeline elements.
- We are specifically targeting `xml-sms-parser.ts` and `enhanced-xml-chunker.py` to handle "very very very large XML files".
- We need to wrap this legacy logic in the new LlamaIndex TypeScript architecture so that the chunks automatically inherit `ChunkID` (UUIDv7) and link back to the parent `DocumentID`.

## Tasks

### [Task 1] Extract & Analyze Legacy Parsers
- **Type**: `auto`
- **Action**: Read the specific legacy files from `D:\AI_Workspace\Projects\TheBigOne\MCP_Tool_Platform\MCP_Tool_Platform_Repo\server\mcp\loaders\xml-sms-parser.ts`. Analyze the core logic for message boundary detection and XML streaming.

### [Task 2] Create the LlamaIndex MessageReader
- **Type**: `auto`
- **Action**: Create `server/mcp/ingest/readers/SmsXmlReader.ts`.
  - Implement the LlamaIndex `BaseReader` interface.
  - Port the legacy XML boundary logic into the `loadData()` method.
  - Ensure that the output chunks respect message threads rather than arbitrarily splitting text mid-sentence.

### [Task 3] Wire Reader to the Front Door
- **Type**: `auto`
- **Action**: Update `server/mcp/ingest/index.ts`.
  - After a file is logged in DuckDB (from Plan 01), detect if it is an XML message dump.
  - If so, pass the file to the new `SmsXmlReader` to generate the initial chunks.
  - Update DuckDB `pass1_status` to processing.

## Verification
- `SmsXmlReader.ts` successfully implements the LlamaIndex interface without type errors.
- The legacy XML boundary logic is successfully translated to the new architecture.

## Output
- New `server/mcp/ingest/readers/SmsXmlReader.ts`
- Updated `server/mcp/ingest/index.ts`
