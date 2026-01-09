# Handoff: GCP Integration & Cloud Services

**Thread:** 2 of 3
**Priority:** P1 - Enables advanced processing
**Date:** January 9, 2026

---

## ⚠️ CRITICAL: DELEGATE ALL CODING

You have access to Groq, Gemini, OpenRouter, Anthropic, and Cohere APIs through Manus settings. **DO NOT write boilerplate code yourself.** Delegate to external LLMs for:

- TypeScript error fixes
- API client code
- Docker configurations
- Test writing

Use Gemini specifically for GCP-related tasks since it has native understanding of Google Cloud services. Use your tokens for planning, debugging, and user communication only.

---

## Mission

Fix the GCP plugin TypeScript errors, deploy Graphiti to Cloud Run, and wire up Google Cloud AI services (Document AI, Vision, Natural Language, Speech, Video Intelligence) for advanced document processing.

---

## Current State

GCP plugins were generated via LLM but have TypeScript errors. They are currently in `/server/mcp/plugins-pending/` to avoid breaking the build:

| Plugin | Purpose | Status |
|--------|---------|--------|
| `gcp-document-ai.ts` | OCR, form parsing, entity extraction | TypeScript errors |
| `gcp-vision.ts` | Image analysis, face detection, labels | TypeScript errors |
| `gcp-natural-language.ts` | Sentiment, entities, syntax | TypeScript errors |
| `gcp-speech.ts` | Audio transcription | TypeScript errors |
| `gcp-video-intelligence.ts` | Video annotation | TypeScript errors |

Graphiti Cloud Run deployment files are in `/deploy/gcp/graphiti/`:
- `Dockerfile`
- `main.py` (FastAPI wrapper)
- `requirements.txt`
- `cloudbuild.yaml`

---

## Credentials

| Service | Variable | Value |
|---------|----------|-------|
| GCP API Key | `GCP_API_KEY` | `AIzaSyCmEDGGPNYFRKj4gnmJudWsJfQBQmeE-N8` |
| GCP Project | - | Check Cloudflare account for project ID |
| Neo4j URL | `NEO4J_URL` | In `.env.vps2-salem-forge` |
| Neo4j Username | `NEO4J_USERNAME` | In `.env.vps2-salem-forge` |
| Neo4j Password | `NEO4J_PASSWORD` | In `.env.vps2-salem-forge` |

---

## Tasks

### 1. Fix GCP Plugin TypeScript Errors

The plugins use the Google Cloud client libraries incorrectly. Common issues:

1. **Wrong import patterns** - Need to use the correct SDK imports
2. **Type mismatches** - Response types don't match what the code expects
3. **Async handling** - Some methods need different async patterns

For each plugin:

1. Read the current code in `/server/mcp/plugins-pending/`
2. Check the official Google Cloud Node.js SDK documentation
3. Fix the TypeScript errors
4. Move to `/server/mcp/plugins/`
5. Write vitest tests

**Delegation approach:** Send the broken code + error messages to Gemini and ask it to fix the TypeScript errors based on the official SDK.

### 2. Deploy Graphiti to Cloud Run

Graphiti provides temporal knowledge graph capabilities via Neo4j. Deploy it as a serverless Cloud Run service:

```bash
cd deploy/gcp/graphiti

# Build and push to GCR
gcloud builds submit --tag gcr.io/PROJECT_ID/graphiti

# Deploy to Cloud Run
gcloud run deploy graphiti \
  --image gcr.io/PROJECT_ID/graphiti \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NEO4J_URL=...,NEO4J_USERNAME=...,NEO4J_PASSWORD=...
```

After deployment:

1. Get the Cloud Run URL
2. Update the platform to call this URL instead of local Graphiti
3. Test the `/add_episode`, `/search`, and `/get_entity` endpoints

### 3. Wire GCP Services to Platform

Once plugins are fixed, register them in the executor:

1. Add imports to `/server/mcp/workers/executor.ts`
2. Register handlers for each GCP tool
3. Add the tools to the MCP gateway registry
4. Update the tool catalog documentation

### 4. Colab Enterprise Integration (Optional)

If time permits, set up Colab Enterprise for heavy ML workloads:

1. Create a Colab Enterprise workspace in GCP
2. Create notebook templates for:
   - Large document batch processing
   - Custom model fine-tuning
   - Heavy embedding generation
3. Implement API to trigger notebook execution
4. Wire results back to platform

---

## GCP Services Overview

| Service | Use Case | Endpoint |
|---------|----------|----------|
| **Document AI** | OCR, form parsing, invoice extraction | `documentai.googleapis.com` |
| **Vision** | Image labels, faces, text, objects | `vision.googleapis.com` |
| **Natural Language** | Entities, sentiment, syntax, categories | `language.googleapis.com` |
| **Speech-to-Text** | Audio transcription | `speech.googleapis.com` |
| **Video Intelligence** | Shot detection, labels, faces in video | `videointelligence.googleapis.com` |

All services use the same API key for authentication.

---

## Success Criteria

1. All 5 GCP plugins compile without TypeScript errors
2. Plugins are moved from `plugins-pending` to `plugins`
3. Graphiti is deployed to Cloud Run and accessible
4. Platform can call GCP services for document processing
5. Vitest tests pass for all GCP plugins

---

## Files to Reference

- `/server/mcp/plugins-pending/gcp-*.ts` - Broken plugins
- `/deploy/gcp/graphiti/` - Cloud Run deployment
- `/server/mcp/workers/executor.ts` - Handler registration
- `/docs/architecture/MCP_TOOL_CATALOG.md` - Tool documentation

---

## Notes

- The GCP API key is a general API key, not a service account. This works for most services but some (like Document AI) may need a service account for production.
- Graphiti connects to Neo4j Aura (cloud-hosted), not a local Neo4j instance.
- The platform already has Graphiti code in `/server/python-tools/graphiti_runner.py` - this needs to be updated to call Cloud Run instead.
