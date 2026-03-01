# Zep-Mimic Architecture: Graphiti & Semantica Integration Blueprint

## 1. The Core Requirement: The Unbreakable Link
While Graphiti and Semantica provide high-level abstraction (episodic memory, temporal edges, and semantic decisions), **they must never sever the link to the raw evidence.** 

To achieve this, the architecture relies on the **UUIDv7 Backbone**:
- `DocumentID` (DuckDB: Raw 4GB XML and SHA-256 Hash)
- `ChunkID` (LanceDB: 100-message Vector Shard)
- `EntityID` / `DecisionID` (Neo4j: Graphiti/Semantica Graph Node)

**The Rule:** Every Node and Edge created by Graphiti or Semantica **MUST** contain the `chunk_id` and `document_id` in its properties. This ensures that no matter how abstract the graph becomes, any node can instantly be resolved back to its exact text shard in LanceDB and the full raw file in DuckDB.

---

## 2. The Python Memory Service (FastAPI)
To mimic Zep's async background processing, we will spin up a dedicated Python FastAPI service (`mcp-memory-service`). 
Instead of the Node.js API orchestrating the extraction step-by-step, Node.js acts as a router:
1. Node.js chunks the file and saves the raw text to DuckDB.
2. Node.js sends the `ChunkID` and raw text to the `mcp-memory-service` via an async background job.
3. The Node.js API returns `200 OK` to the frontend immediately, while the Python service does the heavy lifting.

---

## 3. Full Semantica Utilization (The Intelligence Layer)
We will leverage `Hawksight-AI/semantica` as the primary semantic orchestrator.

### A. AgentContext & PROV-O Lineage
Instead of passing strings around, every chunk enters a Semantica `AgentContext`.
- When GLiNER2 extracts "Jane", Semantica automatically attaches the W3C PROV-O metadata: `[Entity: Jane] -> wasDerivedFrom -> [ChunkID: uuid-123]`.
- This mathematically guarantees that if an LLM references "Jane", the UI can provide a hyperlink directly to the exact raw text shard.

### B. The Decision Ledger
When the Node.js `BehavioralFlagExtractor` (or the future Unsloth model) flags a message as **"DARVO: Deny"**, we record it using Semantica's native decision API:
```python
context.record_decision(
    category="behavioral_pattern",
    scenario="MCL 722.23 Factor (j)",
    reasoning="Matched DARVO regex pattern for denial",
    outcome="flagged_darvo",
    confidence=0.9,
    entities=["Person: Jane", "ChunkID: uuid-123"]
)
```
This turns behavioral flags into **Queryable Graph Nodes**, allowing an agent to ask: *"Show me all decisions where Jane was flagged for DARVO with >80% confidence."*

---

## 4. Full Graphiti Utilization (The Temporal Layer)
We will leverage `getzep/graphiti` to track how facts and relationships change over time.

### A. Episodic Memory
Every message or event is ingested as a Graphiti `Episode`. 
- `Episode 1:` Jane messages John (Jan 1, 2024).
- `Episode 2:` Custody exchange at Police Station (Jan 5, 2024).
Graphiti natively links these episodes chronologically.

### B. Temporal Edges (`valid_at` / `invalid_at`)
If a message in `Episode 1` states Jane lives in Flint, Graphiti creates an edge: `(Jane)-[LIVES_IN {valid_from: '2024-01-01', valid_to: None}]->(Flint)`.
If a later message in `Episode 50` states she moved to Detroit, Graphiti *invalidates* the old edge (`valid_to: '2024-06-01'`) and creates a new one.
- **Why this matters:** When an agent queries the graph, it can pass a timestamp: `graphiti.query(time="2024-03-01")`, and Graphiti will return the exact state of the world *on that specific day*, completely ignoring the future move to Detroit.

---

## 5. The Hybrid Retrieval API (Mimicking Zep)
When an LLM requests context via the MCP Tool Platform, the query hits our Zep-mimic endpoint.

**The Workflow:**
1. **Semantic Search:** LanceDB finds the top 10 most relevant text shards (Chunks) based on the user's prompt.
2. **Graph Traversal:** The `MemoryService` takes those 10 `ChunkIDs` and asks Neo4j: *"What entities, temporal episodes, and Semantica decisions are linked to these chunks?"*
3. **Full Text Hydration:** The service takes the resulting `ChunkIDs` and pulls the full, un-truncated text directly from DuckDB.
4. **The LLM Payload:** The LLM receives a perfectly formatted Zep-style context block:
   - The raw text shards (from DuckDB/LanceDB).
   - The verified timeline of events (from Graphiti).
   - The forensic behavioral flags and provenance (from Semantica).

### The Result
We achieve the exact power, speed, and temporal awareness of Zep, built entirely on our open-source 5-Tier architecture, without ever losing the mathematical link back to the raw, unadulterated evidence.