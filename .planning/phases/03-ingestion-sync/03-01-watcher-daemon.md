---
phase: "03"
plan: "01-watcher-daemon"
type: "auto"
wave: 1
depends_on: ["02-05-recognizers-text-extraction"]
---

# Phase 3, Plan 1: The Evidence Watcher Daemon

## Objective
Build the autonomous daemon that bridges the physical block storage to the Node.js ingestion pipeline. It must safely detect when Cloudflare R2 / Rclone drops a massive 4GB XML file onto the server, wait for the network transfer to finish, and automatically trigger the pipeline.

## Context
As discussed, HTTP uploads of 4GB files will crash the server. We rely on an out-of-band transfer (Rclone) to the `/app/data/evidence_drop` volume. The Node.js server needs a watcher script that boots on startup and handles "transfer stabilization" (ensuring the file size stops growing) before it attempts to run the SHA-256 stream hasher and the `SmsXmlReader`.

## Tasks

### [Task 1] Build the Watcher Daemon
- **Type**: `auto`
- **Action**: Create `server/mcp/ingest/watcher.ts`.
  - Use `fs.watch` or `chokidar` to monitor the block storage directory.
  - Implement a `waitForFileStabilization` mechanism (e.g., check file size every 5 seconds until it stops changing).
  - Once stable, call `ingestEvidence(binaryPath)`.

### [Task 2] Wire into Server Startup
- **Type**: `auto`
- **Action**: Update `server/core/index.ts`.
  - Inject `initAllDatabases()` from `db.ts` to ensure DuckDB, LanceDB, and MySQL are ready.
  - Inject `startEvidenceWatcher()` so the daemon runs in the background instantly when the Express app boots.

## Verification
- Daemon code successfully handles asynchronous file size checking.
- The `index.ts` file properly initializes the 5-Tier DBs and the Watcher without blocking the Express server listen port.

## Output
- New `server/mcp/ingest/watcher.ts`
- Modified `server/core/index.ts`
