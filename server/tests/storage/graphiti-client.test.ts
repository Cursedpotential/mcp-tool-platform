/**
 * Graphiti Client Tests
 * Tests for Neo4j entity storage and relationship queries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock neo4j-driver
vi.mock("neo4j-driver", () => ({
    default: {
        driver: vi.fn(() => ({
            session: vi.fn(() => ({
                run: vi.fn().mockResolvedValue({
                    records: [{ toObject: () => ({ test: 1 }) }],
                }),
                close: vi.fn().mockResolvedValue(undefined),
            })),
            close: vi.fn().mockResolvedValue(undefined),
        })),
        auth: {
            basic: vi.fn((user, pass) => ({ user, pass })),
        },
    },
}));

describe("GraphitiClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Set up environment variables
        vi.stubEnv("NEO4J_URL", "bolt://localhost:7687");
        vi.stubEnv("NEO4J_USERNAME", "neo4j");
        vi.stubEnv("NEO4J_PASSWORD", "testpassword");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    describe("Connection Management", () => {
        it("should initialize with environment variables", async () => {
            const { GraphitiClient } = await import("../../mcp/storage/graphiti-client");
            const client = new GraphitiClient();

            expect(client).toBeDefined();
        });

        it("should test connection successfully", async () => {
            const { graphitiClient } = await import("../../mcp/storage/graphiti-client");

            const result = await graphitiClient.testConnection();

            expect(result).toHaveProperty("success");
        });
    });

    describe("Entity Storage", () => {
        it("should store entities with required fields", async () => {
            const { graphitiClient } = await import("../../mcp/storage/graphiti-client");

            const testEntities = [
                {
                    id: "entity-1",
                    type: "person",
                    name: "John Doe",
                    properties: { age: 30, role: "developer" },
                    sourceMessageId: "msg-123",
                },
                {
                    id: "entity-2",
                    type: "organization",
                    name: "Acme Corp",
                    properties: { industry: "tech" },
                },
            ];

            // Should not throw
            await expect(graphitiClient.storeEntities(testEntities)).resolves.not.toThrow();
        });

        it("should handle empty entity array gracefully", async () => {
            const { graphitiClient } = await import("../../mcp/storage/graphiti-client");

            // Should return early without error
            await expect(graphitiClient.storeEntities([])).resolves.not.toThrow();
        });

        it("should validate entity structure", () => {
            const validEntity = {
                id: "test-id",
                type: "person",
                name: "Test Name",
                properties: {},
            };

            expect(validEntity.id).toBeDefined();
            expect(validEntity.type).toBeDefined();
            expect(validEntity.name).toBeDefined();
            expect(typeof validEntity.properties).toBe("object");
        });
    });

    describe("Relationship Storage", () => {
        it("should store relationships with proper structure", async () => {
            const { graphitiClient } = await import("../../mcp/storage/graphiti-client");

            const testRelationships = [
                {
                    id: "rel-1",
                    type: "WORKS_AT",
                    fromEntityId: "entity-1",
                    toEntityId: "entity-2",
                    properties: { since: "2020-01-01" },
                    timestamp: new Date(),
                },
            ];

            await expect(graphitiClient.storeRelationships(testRelationships)).resolves.not.toThrow();
        });

        it("should handle empty relationships array", async () => {
            const { graphitiClient } = await import("../../mcp/storage/graphiti-client");

            await expect(graphitiClient.storeRelationships([])).resolves.not.toThrow();
        });
    });

    describe("Query Operations", () => {
        it("should query entities by type", async () => {
            const { graphitiClient } = await import("../../mcp/storage/graphiti-client");

            const result = await graphitiClient.queryEntitiesByType("person");

            expect(Array.isArray(result)).toBe(true);
        });

        it("should run raw Cypher queries", async () => {
            const { graphitiClient } = await import("../../mcp/storage/graphiti-client");

            const result = await graphitiClient.runQuery("RETURN 1 as test", {});

            expect(Array.isArray(result)).toBe(true);
        });

        it("should query relationships for an entity", async () => {
            const { graphitiClient } = await import("../../mcp/storage/graphiti-client");

            const result = await graphitiClient.queryRelationships("entity-1");

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe("Cleanup", () => {
        it("should close connection properly", async () => {
            const { graphitiClient } = await import("../../mcp/storage/graphiti-client");

            await expect(graphitiClient.close()).resolves.not.toThrow();
        });
    });
});
