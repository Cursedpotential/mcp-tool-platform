/**
 * ChromaDB Client Tests
 * Tests for vector storage, evidence management, and TTL handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock chromadb
vi.mock("chromadb", () => ({
    ChromaClient: vi.fn().mockImplementation(() => ({
        getOrCreateCollection: vi.fn().mockResolvedValue({
            add: vi.fn().mockResolvedValue(undefined),
            query: vi.fn().mockResolvedValue({
                ids: [["id1", "id2"]],
                distances: [[0.1, 0.2]],
                metadatas: [[{ key: "value" }, { key: "value2" }]],
                documents: [["doc1", "doc2"]],
            }),
            get: vi.fn().mockResolvedValue({
                ids: ["id1"],
                documents: ["test document"],
                metadatas: [{ test: "meta" }],
            }),
            update: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
        }),
        createCollection: vi.fn().mockResolvedValue({
            add: vi.fn(),
        }),
        deleteCollection: vi.fn().mockResolvedValue(undefined),
        heartbeat: vi.fn().mockResolvedValue(1234567890),
    })),
}));

describe("ChromaManager", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("CHROMA_URL", "http://localhost:8000");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    describe("Initialization", () => {
        it("should initialize with default URL", async () => {
            const { ChromaManager } = await import("../../mcp/storage/chroma-client");
            const manager = new ChromaManager();

            expect(manager).toBeDefined();
        });

        it("should initialize with custom URL", async () => {
            const { ChromaManager } = await import("../../mcp/storage/chroma-client");
            const manager = new ChromaManager("http://custom:8000");

            expect(manager).toBeDefined();
        });

        it("should create collections on initialize", async () => {
            const { ChromaManager } = await import("../../mcp/storage/chroma-client");
            const manager = new ChromaManager();

            await expect(manager.initialize()).resolves.not.toThrow();
        });
    });

    describe("Evidence Processing (72hr TTL)", () => {
        it("should add evidence with TTL metadata", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            const documentId = "doc-123";
            const chunks = [
                { id: "chunk-1", text: "Test content", metadata: { case_id: "case-1" } },
            ];
            const embeddings = [[0.1, 0.2, 0.3]];

            await expect(
                chromaManager.addEvidence(documentId, chunks, embeddings)
            ).resolves.not.toThrow();
        });

        it("should query evidence by embedding", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            const queryEmbedding = Array(1536).fill(0).map(() => Math.random());
            const result = await chromaManager.queryEvidence(queryEmbedding, 10);

            expect(result).toHaveProperty("ids");
            expect(result).toHaveProperty("distances");
        });

        it("should get evidence by document ID", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            const result = await chromaManager.getEvidenceByDocument("doc-123");

            expect(Array.isArray(result)).toBe(true);
        });

        it("should update evidence classification", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            const classification = {
                sentiment: "negative",
                severity: 7,
                patterns: ["threat", "manipulation"],
                confidence: 0.85,
            };

            await expect(
                chromaManager.updateEvidenceClassification("chunk-1", classification)
            ).resolves.not.toThrow();
        });

        it("should cleanup expired evidence", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            const cleanedCount = await chromaManager.cleanupExpiredEvidence();

            expect(typeof cleanedCount).toBe("number");
        });
    });

    describe("Project Context (Persistent)", () => {
        it("should add project context", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            await expect(
                chromaManager.addContext(
                    "ctx-1",
                    "Project context content",
                    "preference",
                    { tags: ["important"] }
                )
            ).resolves.not.toThrow();
        });

        it("should query context by type", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            const queryEmbedding = Array(1536).fill(0);
            const result = await chromaManager.queryContext(queryEmbedding, "preference");

            expect(result).toHaveProperty("ids");
        });

        it("should get context by case ID", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            const result = await chromaManager.getContextByCase("case-123");

            expect(Array.isArray(result)).toBe(true);
        });

        it("should delete context", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            await expect(chromaManager.deleteContext("ctx-1")).resolves.not.toThrow();
        });
    });

    describe("Statistics", () => {
        it("should get evidence statistics", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            const stats = await chromaManager.getEvidenceStats();

            expect(stats).toHaveProperty("total_chunks");
            expect(stats).toHaveProperty("by_case");
            expect(stats).toHaveProperty("by_platform");
        });
    });

    describe("Health Check", () => {
        it("should return true when healthy", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            const isHealthy = await chromaManager.healthCheck();

            expect(isHealthy).toBe(true);
        });
    });

    describe("Collection Reset", () => {
        it("should reset evidence collection", async () => {
            const { chromaManager } = await import("../../mcp/storage/chroma-client");

            await chromaManager.initialize();

            await expect(chromaManager.resetEvidenceCollection()).resolves.not.toThrow();
        });
    });
});
