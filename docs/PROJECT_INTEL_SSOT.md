# 📜 SALEM FORENSIC TRINITY: MASTER SYSTEM SPECIFICATION
**Version:** 1.0.0-PROD
**Status:** ACTIVE / SOURCE OF TRUTH
**Last Updated:** January 18, 2026

---

## 1. MISSION & PHILOSOPHY
The **Salem Forensic Trinity** is a token-efficient, forensically sound orchestration platform designed to process massive evidentiary datasets (8 years of communication logs). It treats **AI as a Preprocessor**, transforming raw noise into structured, searchable intelligence while maintaining a strict **Chain of Custody**.

### **Core Mandates:**
*   **Claude-Last Policy:** Utilize local models (Ollama), free APIs (Groq, Gemini CLI), and paid APIs (DeepSeek) before falling back to high-cost Claude Pro accounts.
*   **Forensic Soundness:** Every byte must be hashed, every transformation audited, and every relationship timestamped.
*   **Memory Mimicry:** 3-tier memory model mimicking human short-term, long-term, and relational recall.

---

## 2. INFRASTRUCTURE TOPOLOGY (THE VPS MESH)
The system is distributed across two high-performance VPS nodes connected via **Tailscale MagicDNS**.

### **VPS1: `salem-nexus` (The Vault & Warehouse)**
*   **Primary Role:** Permanent persistence, archival, and evidentiary storage.
*   **Services:**
    *   **PostgreSQL 16 + PGVector:** Primary relational data & semantic embeddings. (Port 5432)
    *   **Neo4j Aura (Cloud/Local):** Graph relational memory. (Port 7687/7474)
    *   **Directus CMS:** Binary File Vault & Document Management. (Port 8055)
    *   **n8n:** Workflow automation and event-driven processing. (Port 5678)
    *   **MariaDB:** Media metadata for PhotoPrism. (Port 3306)

### **VPS2: `salem-forge` (The Compute Engine)**
*   **Primary Role:** AI Inference, OCR, NLP, and MCP Tool Gateway.
*   **Services:**
    *   **MCP Gateway:** Dual-port entry. (Internal: 4001 | External: 4002)
    *   **LiteLLM:** Universal API Proxy (100+ models). (Port 4000)
    *   **ChromaDB:** Ephemeral working memory (72hr TTL). (Port 8000)
    *   **Python Bridge:** FastAPI runner for spaCy, BERT, and Graphiti-core. (Port 8080)
    *   **Kasm Workspace:** Persistent Debian desktop for Pro-CLI tool execution.

---

## 3. COGNITIVE MEMORY ARCHITECTURE (3-TIER + TEMPORAL)
The platform uses a memory hierarchy to manage context window pollution.

### **Tier 1: Permanent Semantic Memory (Postgres/PGVector)**
*   **Scope:** All 8 years of messages, documents, and findings.
*   **Search:** Hybrid (BM25 Keyword + Vector Embedding).
*   **Persistence:** Eternal.

### **Tier 2: Short-Term Working Memory (Chroma VPS)**
*   **Scope:** Active investigation context (the "Last 3 Days").
*   **TTL:** 72 Hours (Auto-expiry).
*   **Purpose:** To prevent "context ghosting" where old, irrelevant data interferes with current analysis.

### **Tier 3: Relational/Temporal Memory (Neo4j + Graphiti)**
*   **Scope:** Relationships, entity evolution, and contradictions.
*   **Logic:** **Zep/Graphiti Pattern.**
    *   **Valid Ranges:** Every edge has `valid_from` and `valid_to`.
    *   **Fact Invalidation:** If a 2024 message contradicts a 2018 relationship, the old edge is marked "historical" and a new "active" edge is created.
    *   **Point-in-Time Queries:** Allows an agent to ask: *"What was the relationship status between X and Y on July 14, 2022?"*

---

## 4. THE FORENSIC INGESTION PIPELINE (DATA FLOW)
Every file follows a one-way, non-destructive path to the knowledge base.

1.  **Directus (Binary Ingestion):**
    *   File is uploaded to `directus_files`.
    *   **SHA-256 Hash** is generated and written to an immutable `evidence_chain` audit log.
2.  **Postgres (Metadata Extraction):**
    *   Record created in `documents` table.
    *   `directus_id` linked to `pg_doc_id`.
3.  **Forge (AI Processing):**
    *   **OCR/Parser:** Raw text extracted.
    *   **NLP Multi-Pass:** Preliminary sentiment, severity (1-10), and Pattern detection (DARVO, etc.).
    *   **Chunking:** Text split into 512-token chunks with 10% overlap.
4.  **PGVector (Semantic Indexing):**
    *   Chunks embedded via **AWS Bedrock/GCP** and stored with `pg_doc_id` references.
5.  **Graphiti (Temporal Linking):**
    *   Entities extracted (spaCy/BERT).
    *   Pushed to Neo4j as Nodes (`Person`, `Place`, `Event`).
    *   Relationships created with `valid_from` based on message timestamps.

---

## 5. PREMIUM TOOL & PROVIDER MAPPING
The system intelligently routes tasks to the best-fit cloud provider.

*   **AWS Bedrock:** Used for **Titan Embeddings** (cost-effective for millions of messages) and **Claude 3.5 Sonnet** for forensic report drafting.
*   **GCP Vertex AI:** **Gemini 1.5 Pro (2M Context)** used exclusively for "Deep Ingestion" of multi-gigabyte exports (5GB+ XML logs).
*   **Azure OpenAI:** Used for **Structured JSON Extraction** when high schema adherence is required for legal filings.
*   **PhotoPrism AI:** Handles facial recognition and object clustering, linking results back to Neo4j `Person` nodes.

---

## 6. MCP GATEWAY & REFERENCE PATTERNS
The system uses a **Reference-Addressing** pattern to handle large outputs without crashing the LLM context.

*   **Reference Threshold:** Any output >1MB (or 10k lines) is NOT returned directly.
*   **ContentRef:** The tool returns a JSON reference: `{ ref: "sha256:...", size: "4.2MB" }`.
*   **Paged Retrieval:** Agents use the `mcp.getRef` tool to "scroll" through large findings in 4KB chunks.
*   **Atomic vs. Workflow:**
    *   **Atomic:** `ocr.extract` (Single function).
    *   **Workflow:** `workflow.process_evidence_batch` (Orchestrates Directus -> Postgres -> Neo4j).

---

## 7. CURRENT PUNCHLIST (AGENT PRIORITIES)
1.  **🔴 Refactor `server/core/db.ts`:** Remove redundant logic. Implement the **System Router** that coordinates Postgres, Neo4j, and Directus connections.
2.  **🔴 Implement `DirectusVault` Client:** Build the service that handles SHA-256 verification and file retrieval from Directus.
3.  **🔴 Implement `GraphitiMemory` Tool:** Wire the Zep-style temporal memory search into the MCP gateway.
4.  **🔴 Pattern Library Sync:** Wire the 256 forensic patterns from `seed-patterns.ts` into the `behavioralPatterns` Postgres table for UI visibility.

---

### **⚠️ INSTRUCTIONS FOR NEW AGENTS:**
1.  **READ-ONLY FIRST:** Read this SSoT completely.
2.  **ABSOLUTE PATHS:** Use `C:\Users\matts\AI_Workspace\TheBigOne\01_MCP_Tool_Platform_Repo\` for all operations.
3.  **HYBRID SEARCH:** When searching for information, always query **Postgres (Semantic)** AND **Neo4j (Relational)** to get the full picture.
