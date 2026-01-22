# System Router Integration Guide - Salem Forensic Trinity

**Component**: `TrinityRouter`  
**Location**: `server/mcp/storage/systemRouter.ts`  
**Role**: Orchestration of Tier 1 (Postgres, Graphiti, Directus) and Tier 2 (ChromaDB) storage.

---

## 1. Overview

The `TrinityRouter` acts as the **General Contractor** for the Salem Forensic system. instead of tools manually coordinating between vector databases, graph databases, and relational storage, they call the router.

### Key Capabilities

1. **Multi-System Writes**: Atomic coordination of data across 4 backend systems.
2. **Forensic Integrity**: Automatic SHA-256 hashing and audit logging.
3. **Temporal Awareness**: `valid_from` timestamps automatically applied to graph nodes.
4. **Smart Routing**: Queries automatically sent to the system best suited for the data type.

---

## 2. Basic Usage

### Initializing the Router

The router is exported as a singleton. You should call `initialize()` before use.

```typescript
import { trinityRouter } from '../mcp/storage';

async function setup() {
  const success = await trinityRouter.initialize();
  if (!success) {
    console.error("Failed to connect to storage tiers");
  }
}
```

### Storing Evidence

This single call writes to all 4 storage systems:

```typescript
await trinityRouter.storeEvidence({
  caseId: "CASE-2026-001",
  type: "document",
  content: "Suspect seen entering building at 10:00 PM",
  metadata: {
    source: "CCTV-04",
    entities: [
      { name: "Building A", type: "Location" },
      { name: "John Doe", type: "Person" }
    ]
  },
  file: {
    buffer: pdfBuffer,
    filename: "cctv_report.pdf",
    mimeType: "application/pdf"
  }
});
```

**What happens under the hood**:
1. **Directus**: Uploads PDF, stores metadata.
2. **Postgres**: Inserts into `audit_log` with SHA-256 hash. Inserts into `evidence` table.
3. **Graphiti**: Creates `Entity` nodes for "Building A" and "John Doe" with `valid_from` timestamps.
4. **ChromaDB**: Ingests content + metadata into working memory (72hr TTL).

---

## 3. Advanced Querying

The router provides specialized routing based on query type:

### Semantic Search (pgvector + Chroma)
Searches both working memory (recent) and long-term storage.

```typescript
const results = await trinityRouter.query({
  type: 'semantic',
  query: "Who was mentioned in the CCTV reports?",
  caseId: "CASE-2026-001",
  limit: 5
});
```

### Temporal Query (Graphiti)
Queries the knowledge graph as it existed at a specific point in time.

```typescript
const graphResults = await trinityRouter.query({
  type: 'temporal',
  query: "MATCH (p:Person)-[r]->(l:Location) RETURN p, r, l",
  asOfDate: "2026-01-15T00:00:00Z"
});
```

### Spatial Query (PostGIS)
Uses Postgres PostGIS for location-based evidence retrieval.

```typescript
const nearbyEvidence = await trinityRouter.query({
  type: 'spatial',
  query: "POINT(-122.4194 37.7749)", // WKT format
  caseId: "CASE-2026-001"
});
```

---

## 4. Forensic Verification

The router can verify if a piece of evidence is still intact across all systems.

```typescript
const verification = await trinityRouter.verifyIntegrity(evidencePostgresId);

if (verification.isValid) {
  console.log("Evidence integrity verified across all systems");
} else {
  console.warn("Integrity check failed!", verification.systems);
}
```

---

## 5. Integration into Tools

### MCP Tool Example

When building an MCP tool that processes data, use the router instead of individual clients:

```typescript
// server/mcp/tools/ingest.ts
export const ingestEvidenceTool = {
  name: 'ingest_evidence',
  execute: async (args) => {
    const result = await trinityRouter.storeEvidence({
      caseId: args.caseId,
      content: args.text,
      type: 'message',
      metadata: args.metadata
    });
    
    return {
      content: [{ type: 'text', text: `Evidence stored. Hash: ${result.hash}` }]
    };
  }
};
```

---

## 6. Environment Variables

Ensure these are set on VPS3 (salem-platform):

| Variable | Target System | Purpose |
|----------|---------------|---------|
| `DATABASE_URL` | Postgres (VPS1) | Relational & Vector |
| `CHROMA_URL` | Chroma (VPS2) | Working Memory |
| `DIRECTUS_URL` | Directus (VPS1) | File Vault |
| `GRAPHITI_URI` | Neo4j (Cloud) | Knowledge Graph |

**Note**: Use private network IPs (`10.10.0.2`, `10.10.0.3`) for internal connections.
