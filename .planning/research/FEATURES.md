# Feature Research: Messaging Workflow

**Domain:** Forensic evidence preprocessing — messaging data for family court
**Researched:** 2026-02-25
**Confidence:** HIGH (grounded in codebase inspection, not theoretical)
**Mode:** Ecosystem — subsequent milestone, platform ~75-80% built

## Context

This is NOT a greenfield feature survey. The platform has ~80% of the backend built. The question is: **what features must be wired, fixed, or added for Matt to actually process messaging data end-to-end?**

The user (pro se litigant, 10 months without seeing his daughter) needs to:
1. Upload raw messaging exports (Facebook HTML, SMS XML, Snapchat HTML)
2. Have them parsed, NLP-tagged, and pattern-detected automatically
3. Browse results — messages, detected patterns, entity relationships, timelines
4. Review low-confidence pattern detections (HITL)
5. Export court-presentable evidence with forensic hashes

---

## Feature Landscape

### Table Stakes (Without These, the Platform Is Unusable)

These are the features that MUST work for the messaging workflow to function. The backend code largely exists — the gap is wiring, testing, and fixing what's broken.

| # | Feature | Why Required | Complexity | Existing Code | Gap |
|---|---------|-------------|------------|---------------|-----|
| T1 | **Build compiles clean (fix ~80 TS errors)** | Nothing works if the app doesn't build. Merge artifacts blocking all development. | MEDIUM | Entire codebase | ~80 TypeScript errors from branch merge. Must fix before anything else. |
| T2 | **File upload → ingestion pipeline** | Matt can't process anything without getting files into the system. Needs: upload UI, format detection, routing to correct parser. | MEDIUM | `ingestion.ts` router (326 lines), production-pipeline.ts (662 lines), end-to-end-pipeline.ts (244 lines) | No upload UI exists. Ingestion router exists but hasn't been tested E2E. Need file upload component → tRPC mutation → pipeline. |
| T3 | **Parser execution for Facebook + SMS** | These are the two largest data sources (8+ years). Parsers exist but haven't been tested with real data at scale. | LOW-MEDIUM | `facebook-parser.ts` (203 lines, streaming), `xml-sms-parser.ts`, `sms-loader.ts` (375 lines, multi-format), `pdf-imessage-parser.ts` | Parsers exist. Need integration testing with actual export files. May need format adjustments for real Facebook data download format (Facebook changes export format periodically). |
| T4 | **Pattern Library UI wired to backend** | 303 behavioral patterns are useless if you can't browse, search, test, or manage them. The UI is a shell with 21 TODOs. | MEDIUM | `PatternLibrary.tsx` (354 lines, 21 TODOs), `patterns.ts` router (458 lines, full CRUD), `pattern-analyzer.ts` (1659 lines) | UI has commented-out tRPC calls. Backend router is complete. Just needs uncommenting + connecting + testing. |
| T5 | **Message results browsing** | After ingestion, Matt needs to see what was processed — messages with their pattern tags, confidence scores, severity ratings. Without results viewing, you can't verify the system works. | MEDIUM-HIGH | Drizzle schemas (`messagingDocuments`, `messagingMessages`, `messagingBehaviors`), ingestion router writes data. | No "message browser" page exists in the UI. Need: message list with search/filter, pattern tag display, conversation threading, confidence scores. This is the most visible gap. |
| T6 | **Database connections verified** | PostgreSQL, Neo4j, ChromaDB all need to be reachable from the app. Broken connections = silent data loss in the pipeline. | LOW | Connection code exists for all databases. `KnowledgeGraph.tsx` already has a "Test Connection" button for Neo4j. | Need: connection health dashboard, startup validation, clear error messages when a service is down. Currently the pipeline would just throw unhandled errors. |
| T7 | **Pipeline progress feedback** | Processing thousands of messages takes time. Without progress indication, Matt won't know if it's working, stuck, or failed. | LOW | `ProductionPipelineOptions.onProgress` callback exists. `log-stream.ts` provides real-time streaming. | Need to wire onProgress to the UI. Server-Sent Events or WebSocket from log-stream to frontend progress component. |

### Differentiators (What Makes This Platform Uniquely Valuable)

These aren't required for basic functionality but are what make this platform worth building vs. just reading message exports manually. Several have substantial backend code already.

| # | Feature | Value Proposition | Complexity | Existing Code | Gap |
|---|---------|-------------------|------------|---------------|-----|
| D1 | **Behavioral pattern detection with MCL 722.23 mapping** | The killer feature. 303 patterns auto-tagged to Michigan custody best-interest factors. No other tool does this. Turns raw messages into evidence organized by legal relevance. | LOW (wiring) | `pattern-analyzer.ts` (1659 lines), 303 patterns with MCL factor mapping, dual-polarity analysis (positive + negative for NPD cycle detection) | Pattern analyzer exists and is sophisticated. Needs integration testing and UI to show results per-message. |
| D2 | **Knowledge graph visualization (Graphiti/Neo4j)** | See WHO communicated with WHOM, WHEN, about WHAT topics, with WHAT behavioral patterns — across 8 years. Temporal relationships reveal patterns invisible in message-by-message reading. | MEDIUM-HIGH | `graphiti-client.ts` (752 lines), `KnowledgeGraph.tsx` (217 lines, partially wired), graph analytics plugins (community detection, centrality, temporal patterns) | KnowledgeGraph page exists but has minimal visualization. Needs: graph rendering library (e.g., react-force-graph, vis-network, or cytoscape), query builder UI, temporal filtering. This is the highest-complexity differentiator. |
| D3 | **HITL approval workflow for low-confidence detections** | Pattern detection isn't perfect. Human review of edge cases prevents false accusations in court. Shows professional diligence. | LOW (wiring) | `hitl/approval.ts` (547 lines), `ApprovalDialog.tsx` component, `hitl.ts` router, `PatternApprovalWorkflow.tsx` component | Backend is complete. UI components exist. Need to wire the approval queue to show pending items and let Matt approve/reject. |
| D4 | **Semantic search across all messages (pgvector)** | "Show me every message about Kailah's school" across all platforms, all years. Vector search finds semantically similar messages even with different wording. | MEDIUM | `pgvector-client.ts`, `real-embedding-service.ts`, `embedding-pipeline.ts`, Ollama embeddings integration | Embedding infrastructure exists. Needs: search UI component, embedding generation during ingestion (may already happen in pipeline), results display. |
| D5 | **Forensic chain of custody with SHA-256 hashing** | Every piece of evidence has a verifiable hash trail. Court-admissible integrity proof. Content-addressed store ensures nothing is modified after ingestion. | LOW (exists) | `chain-custody.ts`, `content-store.ts` (285 lines), `identity-service.ts`, SHA-256 hashing throughout ingestion router | Already largely functional in the ingestion pipeline. Just needs verification testing and a UI to display chain-of-custody audit trail for any document. |
| D6 | **Snapchat message parser** | Snapchat messages are a data source. Without parser, that platform is excluded from evidence. | MEDIUM | Schema exists (`snapchat_messages.json` — CSS selectors defined), Facebook parser provides a template for HTML parsing | Need to build `snapchat-parser.ts` following the Facebook parser pattern. Schema gives CSS selectors. Moderate complexity — Snapchat export format may have quirks. |
| D7 | **Cross-platform timeline generation** | See all messages from all platforms in chronological order. Reveals patterns like: "abusive SMS at 2am, then love-bombing Facebook message at 8am." | MEDIUM | `timeline-generator.ts` (in forensics), `TimelineGeneratorAgent.tsx` (UI agent component), timeline-parser plugin | Backend exists. UI agent exists but may be static. Need to wire them together and render timeline visualization. |

### Anti-Features (Do NOT Build Right Now)

These are features that might seem valuable but would delay shipping the messaging workflow. Each has a clear "what to do instead."

| # | Anti-Feature | Why It Seems Useful | Why NOT Now | What to Do Instead |
|---|-------------|---------------------|-------------|-------------------|
| A1 | **Case Bible (Obsidian) integration** | Bidirectional sync between the platform and Matt's Obsidian vault would be powerful. | Obsidian vault is being reorganized by another agent. Building integration against a moving target wastes effort. Also requires designing a sync protocol — not trivial. | Process messages in the platform. Copy key findings to Obsidian manually for now. Build integration after both systems are stable. |
| A2 | **Automated court document generation** | Producing ready-to-file motions from evidence would save time. | Requires the entire evidence pipeline to be working first (garbage in = garbage out). Also requires deep legal formatting knowledge that's better handled by LLM agents with human review. | Export evidence summaries as structured data. Use AI agents (via MCP tools or Case Bible agents) to draft documents with human review. Don't automate filing. |
| A3 | **Multi-model LLM integration for pattern analysis** | The Provider Hub routes across 20+ LLM providers. Could use GPT-4 for deeper pattern analysis. | LLM API costs add up fast on 8+ years of messages. The rule-based pattern analyzer (303 patterns, 1659 lines) works without API calls. LLM adds latency, cost, and non-determinism. | Use rule-based pattern detection (already built). Reserve LLM for edge cases during HITL review, not bulk processing. The pattern library IS the analysis engine. |
| A4 | **CI/CD pipeline** | Automated testing and deployment sounds professional. | Solo user, single deployment target. Manual deploy via Docker Compose is fine. CI/CD adds config overhead for no audience. Zero tests exist — need tests before CI makes sense. | Deploy manually with `docker compose up`. Write tests first (a few critical path integration tests). CI/CD is a future milestone after deployment stabilizes. |
| A5 | **Voice/video processing** | Court evidence includes voicemails and videos. | Completely different processing pipeline (speech-to-text, video analysis). Would require new infrastructure and ML models. The messaging workflow isn't done yet. | Stay focused on text-based messaging. Voice/video is a separate GSD project after messaging works. |
| A6 | **Graph visualization with fancy interactive 3D rendering** | A spinning 3D knowledge graph looks impressive. | Performance nightmare with thousands of nodes. Hard to actually extract meaning from. Complexity of 3D rendering libraries is high. | Use a simple 2D force-directed graph (react-force-graph-2d or vis-network). Flat, fast, filterable. Good enough for court presentations. |
| A7 | **Real-time collaborative features** | Sharing evidence with an attorney in real-time. | Solo operator. No attorney yet. Multi-user adds auth complexity, WebSocket state management, conflict resolution. | Export static reports (PDF/HTML). Share via encrypted link or email. Collaboration is a post-case feature. |
| A8 | **TraceIQ integration** | Timeline forensics tool in the same workspace. | TraceIQ is in "disaster state" per PROJECT.md context. Integrating with a broken tool delays the working platform. | Build timeline features natively (TimelineGenerator already exists). Wire TraceIQ later via MCP gateway when it's stable. |

---

## Feature Dependencies

```
[T1] Fix TS Build Errors
    └── EVERYTHING depends on this. Nothing can be tested until the app compiles.

[T2] File Upload → Ingestion Pipeline
    ├── requires → [T1] (app must build)
    ├── requires → [T6] (databases must be reachable)
    └── enables → [T3] Parser Execution
                  [T5] Message Results Browsing
                  [D1] Pattern Detection
                  [D4] Semantic Search (embeddings generated during ingestion)
                  [D5] Chain of Custody (hashes computed during ingestion)

[T3] Parser Execution (Facebook + SMS)
    ├── requires → [T2] (ingestion pipeline)
    └── enables → [D7] Cross-Platform Timeline

[T4] Pattern Library UI Wiring
    ├── requires → [T1] (app must build)
    ├── requires → [T6] (database connection for pattern CRUD)
    └── enhances → [D1] Pattern Detection (manage the patterns being detected)

[T5] Message Results Browsing
    ├── requires → [T2] (data must exist to browse)
    └── enhances → [D1] (view pattern tags per message)
                   [D3] (HITL from results view)
                   [D4] (search triggers from results)

[T6] Database Connections Verified
    ├── requires → [T1] (app must build)
    └── enables → EVERYTHING that touches data

[T7] Pipeline Progress Feedback
    ├── requires → [T2] (pipeline must run)
    └── enhances → user confidence during processing

[D1] Pattern Detection (MCL mapping)
    ├── requires → [T2] (ingestion pipeline runs patterns)
    ├── enhances → [T5] (results show pattern tags)
    └── enables → [D3] (HITL reviews low-confidence matches)

[D2] Knowledge Graph Visualization
    ├── requires → [T6] (Neo4j connection)
    ├── requires → [T2] (entities extracted during ingestion)
    └── independent of other differentiators

[D3] HITL Approval Workflow
    ├── requires → [D1] (patterns must be detected first)
    ├── requires → [T5] (need results to review)
    └── enhances → evidence quality

[D6] Snapchat Parser
    ├── requires → [T2] (ingestion pipeline)
    ├── independent — can be built in parallel
    └── enables → processing Snapchat data source
```

### Dependency Notes

- **T1 (Build Fix) is the universal blocker.** Everything depends on a compiling app. This must be Phase 1 work.
- **T6 (Database Connections) is the second blocker.** Even if code is wired, broken connections mean no data flows.
- **T2 (Upload + Ingestion) is the critical path.** Once files get in, most other features become testable.
- **D2 (Knowledge Graph Viz) is the most independent differentiator.** Can be built in parallel once Neo4j is connected.
- **D6 (Snapchat Parser) is independently buildable** — no dependency on other features, just the ingestion pipeline.

---

## MVP Definition

### Ship First (Milestone Essentials)

The minimum for Matt to actually process messaging data:

- [x] **T1: Fix ~80 TS errors** — Unblocks all development
- [x] **T6: Verify database connections** — Unblocks all data flow
- [x] **T2: File upload → ingestion pipeline** — Gets data into the system
- [x] **T3: Test Facebook + SMS parsers with real data** — Validates the two largest data sources
- [x] **T5: Message results browser** — See what was processed
- [x] **T4: Wire Pattern Library UI** — Manage the 303 patterns (21 TODOs = uncomment tRPC calls)
- [x] **T7: Pipeline progress feedback** — Know processing status

### Add After Core Works (Milestone+1)

Features to add once the basic pipeline is flowing:

- [ ] **D1: Pattern detection results in message browser** — Show MCL factor tags per message
- [ ] **D3: HITL approval queue** — Review low-confidence detections
- [ ] **D4: Semantic search UI** — Find messages by meaning, not just keywords
- [ ] **D6: Snapchat parser** — Add third data source
- [ ] **D7: Cross-platform timeline view** — Chronological all-platform view

### Future Milestone (After Evidence Processing Works)

- [ ] **D2: Knowledge graph visualization** — Needs graph rendering library, complex UI
- [ ] **A1: Case Bible integration** — After Obsidian vault stabilizes
- [ ] **A2: Court document generation** — After evidence pipeline is proven reliable
- [ ] **Chain of custody audit UI** — Display hash trails and provenance for any document

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|-----------|--------------------:|----------|-----------|
| T1: Fix TS errors | CRITICAL | MEDIUM | **P0** | Universal blocker |
| T6: Database connections | CRITICAL | LOW | **P0** | Second blocker |
| T2: Upload → Ingestion | CRITICAL | MEDIUM | **P1** | Critical path |
| T3: Parser testing | HIGH | LOW | **P1** | Validates data sources |
| T5: Results browser | HIGH | MEDIUM-HIGH | **P1** | Must see output |
| T4: Pattern Library wiring | HIGH | LOW-MEDIUM | **P1** | 21 TODOs, mostly uncommenting |
| T7: Progress feedback | MEDIUM | LOW | **P2** | UX, not functionality |
| D1: MCL pattern display | HIGH | LOW | **P2** | Backend done, needs UI column |
| D3: HITL queue | MEDIUM | LOW | **P2** | Backend + components exist |
| D5: Chain of custody UI | MEDIUM | LOW | **P2** | Data exists, needs display |
| D4: Semantic search | MEDIUM | MEDIUM | **P2** | Infrastructure exists |
| D6: Snapchat parser | MEDIUM | MEDIUM | **P2** | New code needed |
| D7: Timeline view | MEDIUM | MEDIUM | **P2** | Backend exists, UI needed |
| D2: Knowledge graph viz | HIGH | HIGH | **P3** | Complex, needs graph library |

**Priority key:**
- **P0:** Must fix before anything else (blockers)
- **P1:** Must have for milestone completion (core workflow)
- **P2:** Should have, build if time allows or next milestone
- **P3:** Future milestone

---

## Competitor/Domain Analysis

This platform has no direct competitors (it's a custom forensic tool for one case). But the relevant domain patterns come from:

| Domain Tool | What It Does | What We Take | What We Skip |
|-------------|-------------|--------------|--------------|
| **Relativity / Nuix** | Enterprise e-discovery for law firms | Pattern-based document review, search + filter paradigm, chain of custody model | Enterprise licensing ($$$), multi-user, complex workflows |
| **Cellebrite UFED** | Mobile forensic data extraction | Hash-based integrity, timeline reconstruction, multi-platform parsing | Physical device extraction (we work with exports), $15K+ licensing |
| **X1 Social Discovery** | Social media evidence collection | Platform-specific parsers, metadata preservation, court-ready export | Auto-collection (we have manual exports), subscription model |
| **Obsidian + manual analysis** | What Matt does now | Knowledge linking, temporal notes, manual pattern recognition | No automation, no pattern detection, no forensic hashing |

**Our approach:** Combine the forensic rigor of e-discovery tools (hashing, chain of custody, audit trails) with domain-specific behavioral pattern detection (303 patterns, MCL 722.23 mapping) at zero licensing cost. The unique value is the behavioral pattern library and its legal factor mapping — no commercial tool has this.

---

## Sources

- **Codebase inspection** (HIGH confidence): Direct file reads of server/mcp/loaders/*, server/mcp/pipelines/*, server/mcp/forensics/*, server/api/routers/*, client/src/pages/*, client/src/agents/*
- **PROJECT.md** (HIGH confidence): Project definition with validated/active/out-of-scope features
- **Pattern Library TODOs** (HIGH confidence): 21 commented-out tRPC calls visible in PatternLibrary.tsx lines 50-68
- **Ingestion Router** (HIGH confidence): 326 lines of wired pipeline code in server/api/routers/ingestion.ts
- **Production Pipeline** (HIGH confidence): 662 lines with multi-stage processing in server/mcp/pipelines/production-pipeline.ts
- **Snapchat Schema** (HIGH confidence): CSS selectors defined in server/mcp/schemas/snapchat_messages.json, no loader implementation

---
*Feature research for: Forensic Messaging Evidence Platform — Messaging Workflow Milestone*
*Researched: 2026-02-25*
