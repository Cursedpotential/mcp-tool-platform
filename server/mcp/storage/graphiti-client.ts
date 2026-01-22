// File: server/mcp/storage/graphiti-client.ts | Date: 2026-01-11 | Agent: Claude Code | Model: Opus 4.1
/**
 * Graphiti Client for Neo4j Entity Storage
 *
 * Stores entities and relationships extracted from messages.
 */

import neo4j, { Driver, Session } from "neo4j-driver";

export interface Entity {
  id: string;
  type: string; // 'person', 'place', 'event', 'medical_term', etc.
  name: string;
  properties: Record<string, any>;
  sourceMessageId?: string;
  sourceDocumentId?: string;
}

export interface Relationship {
  id: string;
  type: string; // 'MENTIONED', 'OCCURRED_AT', 'RELATED_TO', etc.
  fromEntityId: string;
  toEntityId: string;
  properties: Record<string, any>;
  timestamp?: Date;
}

export class GraphitiClient {
  private neo4jUrl: string;
  private neo4jUsername: string;
  private neo4jPassword: string;
  private neo4jDatabase: string;
  private driver: Driver | null = null;

  constructor() {
    this.neo4jUrl = process.env.NEO4J_URL || process.env.NEO4J_AURA_URL || "";
    this.neo4jUsername = process.env.NEO4J_USERNAME || "neo4j";
    this.neo4jPassword = process.env.NEO4J_PASSWORD || "";
    this.neo4jDatabase = process.env.NEO4J_DATABASE || "neo4j";

    if (this.neo4jUrl) {
      this.driver = neo4j.driver(
        this.neo4jUrl,
        neo4j.auth.basic(this.neo4jUsername, this.neo4jPassword)
      );
    }
  }

  private getSession(): Session {
    if (!this.driver) {
      throw new Error("Neo4j driver not initialized");
    }
    return this.driver.session({ database: this.neo4jDatabase });
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      const session = this.getSession();
      await session.run("RETURN 1");
      await session.close();
      return { success: true, message: `Connected to ${this.neo4jUrl}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown Neo4j error",
      };
    }
  }

  async runQuery<T = any>(
    query: string,
    params: Record<string, any> = {}
  ): Promise<T[]> {
    const session = this.getSession();
    try {
      const result = await session.run(query, params);
      return result.records.map(record => record.toObject() as T);
    } finally {
      await session.close();
    }
  }

  /**
   * Store entities in Neo4j
   */
  async storeEntities(entities: Entity[]): Promise<void> {
    if (!entities.length) return;
    const session = this.getSession();
    try {
      await session.run(
        `UNWIND $entities AS e
         MERGE (n:Entity {id: e.id})
         SET n.type = e.type, n.name = e.name, n += e.properties,
             n.sourceMessageId = e.sourceMessageId,
             n.sourceDocumentId = e.sourceDocumentId`,
        { entities }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Store relationships in Neo4j
   */
  async storeRelationships(relationships: Relationship[]): Promise<void> {
    if (!relationships.length) return;
    const session = this.getSession();
    try {
      await session.run(
        `UNWIND $rels AS r
         MATCH (from:Entity {id: r.fromEntityId})
         MATCH (to:Entity {id: r.toEntityId})
         MERGE (from)-[rel:RELATIONSHIP {id: r.id}]->(to)
         SET rel.type = r.type, rel += r.properties, rel.timestamp = r.timestamp`,
        {
          rels: relationships.map(r => ({
            ...r,
            timestamp: r.timestamp
              ? (r.timestamp.toISOString?.() ?? r.timestamp)
              : null,
          })),
        }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Query entities by type
   */
  async queryEntitiesByType(type: string): Promise<Entity[]> {
    const rows = await this.runQuery<{ e: any }>(
      `MATCH (e:Entity {type: $type}) RETURN e`,
      { type }
    );
    return rows.map(row => {
      const node: any = (row as any).e;
      return {
        id: node.properties.id,
        type: node.properties.type,
        name: node.properties.name,
        properties: node.properties,
        sourceMessageId: node.properties.sourceMessageId,
        sourceDocumentId: node.properties.sourceDocumentId,
      } as Entity;
    });
  }

  /**
   * Query relationships for an entity
   */
  async queryRelationships(entityId: string): Promise<Relationship[]> {
    const rows = await this.runQuery<{ rel: any; to: any }>(
      `MATCH (:Entity {id: $id})-[rel]->(to) RETURN rel, to`,
      { id: entityId }
    );
    return rows.map((row: any) => {
      const rel = row.rel.properties;
      return {
        id: rel.id,
        type: rel.type,
        fromEntityId: entityId,
        toEntityId: row.to.properties.id,
        properties: rel,
        timestamp: rel.timestamp ? new Date(rel.timestamp) : undefined,
      } as Relationship;
    });
  }

  async close() {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }
}

export const graphitiClient = new GraphitiClient();
