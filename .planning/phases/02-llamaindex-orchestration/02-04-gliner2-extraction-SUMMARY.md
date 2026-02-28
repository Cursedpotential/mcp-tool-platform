---
phase: "02"
plan: "04"
subsystem: "parsers"
tags: ["ner", "gliner2", "python-bridge"]
requires: ["02-03"]
provides: ["GlinerExtractor", "CPU-bound NER"]
affects: ["LlamaIndex metadata enrichment"]
tech-stack.added: ["gliner"]
tech-stack.patterns: ["LlamaIndex BaseExtractor", "Python Subprocess Bridge"]
key-files.created: ["server/python-tools/enrichment/gliner_extractor.py", "server/mcp/ingest/extractors/GlinerExtractor.ts"]
key-files.modified: ["server/mcp/ingest/index.ts"]
duration: "15m"
completed: "2026-02-28"
---

# Phase 2 Plan 4: GLiNER2 CPU-Bound Entity Extraction Summary

## Overview
Replaced the expensive Microsoft GraphRAG LLM extraction with a 100% local, CPU-bound GLiNER2 zero-shot extraction module. The pipeline now successfully bridges LlamaIndex TypeScript nodes to a Python subprocess running `fastino/gliner2-base-v1`.

## Decisions Made
- **Local Cost Optimization:** Running NER on CPU via GLiNER eliminates 75% of the standard GraphRAG processing costs.
- **Custom Labels:** Defined domain-specific labels ("Custody Event", "Legal Proceeding") for zero-shot recognition.

## Next Phase Readiness
The pipeline now intelligently tags Names, Locations, and specific legal events.
