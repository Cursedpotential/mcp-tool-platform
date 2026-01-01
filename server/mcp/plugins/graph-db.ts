/**
 * Graph Database Plugin (Graphiti + Neo4j)
 * 
 * Provides knowledge graph capabilities:
 * - Entity storage and retrieval
 * - Relationship management
 * - Temporal relationship tracking
 * - Graph traversal and queries
 * - Contradiction detection across time
 */

// ============================================================================
// Configuration
// ============================================================================

interface GraphDBConfig {
  enabled: boolean;
  neo4j: {
    url: string;
    username: string;
    password: string;
    database: string;
  };
  graphiti?: {
    url: string;
    apiKey?: string;
  };
}

const defaultConfig: GraphDBConfig = {
  enabled: false,
  neo4j: {
    url: process.env.NEO4J_URL || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },
};

let config: GraphDBConfig = { ...defaultConfig };

/**
 * Configure the graph database
 */
export function configureGraphDB(newConfig: Partial<GraphDBConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Check if graph DB is enabled
 */
export function isGraphDBEnabled(): boolean {
  return config.enabled;
}

// ============================================================================
// Types
// ============================================================================

interface Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  sourceRef?: string;
}

interface Relationship {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties: Record<string, unknown>;
  timestamp?: string;
  confidence?: number;
  sourceRef?: string;
}

interface GraphPath {
  nodes: Entity[];
  relationships: Relationship[];
  length: number;
}

// ============================================================================
// Entity Operations
// ============================================================================

/**
 * Add an entity to the knowledge graph
 */
export async function addEntity(args: {
  type: string;
  name: string;
  properties?: Record<string, unknown>;
  sourceRef?: string;
}): Promise<{ entity: Entity; created: boolean }> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const entity: Entity = {
    id: `entity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: args.type,
    name: args.name,
    properties: args.properties || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceRef: args.sourceRef,
  };
  
  // Execute Cypher query
  const cypher = `
    MERGE (e:${args.type} {name: $name})
    ON CREATE SET e.id = $id, e.createdAt = $createdAt, e.properties = $properties, e.sourceRef = $sourceRef
    ON MATCH SET e.updatedAt = $updatedAt, e.properties = e.properties + $properties
    RETURN e, e.createdAt = $createdAt as created
  `;
  
  const result = await executeCypher(cypher, {
    id: entity.id,
    name: entity.name,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    properties: JSON.stringify(entity.properties),
    sourceRef: entity.sourceRef,
  });
  
  return {
    entity,
    created: (result.created as boolean) ?? true,
  };
}

/**
 * Get an entity by ID or name
 */
export async function getEntity(args: {
  id?: string;
  type?: string;
  name?: string;
}): Promise<{ entity: Entity | null }> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  let cypher: string;
  let params: Record<string, unknown>;
  
  if (args.id) {
    cypher = `MATCH (e {id: $id}) RETURN e`;
    params = { id: args.id };
  } else if (args.type && args.name) {
    cypher = `MATCH (e:${args.type} {name: $name}) RETURN e`;
    params = { name: args.name };
  } else {
    throw new Error('Must provide id or (type and name)');
  }
  
  const result = await executeCypher(cypher, params);
  
  return { entity: (result.entity as Entity) || null };
}

/**
 * Search entities by type or properties
 */
export async function searchEntities(args: {
  type?: string;
  query?: string;
  properties?: Record<string, unknown>;
  limit?: number;
}): Promise<{ entities: Entity[]; total: number }> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const limit = args.limit ?? 50;
  let cypher: string;
  const params: Record<string, unknown> = { limit };
  
  if (args.type && args.query) {
    cypher = `
      MATCH (e:${args.type})
      WHERE e.name CONTAINS $query OR any(key IN keys(e.properties) WHERE e.properties[key] CONTAINS $query)
      RETURN e
      LIMIT $limit
    `;
    params.query = args.query;
  } else if (args.type) {
    cypher = `MATCH (e:${args.type}) RETURN e LIMIT $limit`;
  } else if (args.query) {
    cypher = `
      MATCH (e)
      WHERE e.name CONTAINS $query
      RETURN e
      LIMIT $limit
    `;
    params.query = args.query;
  } else {
    cypher = `MATCH (e) RETURN e LIMIT $limit`;
  }
  
  const result = await executeCypher(cypher, params);
  
  const entities = (result.entities as Entity[]) || [];
  return {
    entities,
    total: entities.length,
  };
}

/**
 * Delete an entity
 */
export async function deleteEntity(args: {
  id: string;
  deleteRelationships?: boolean;
}): Promise<{ deleted: boolean }> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const cypher = args.deleteRelationships
    ? `MATCH (e {id: $id}) DETACH DELETE e RETURN count(e) as deleted`
    : `MATCH (e {id: $id}) DELETE e RETURN count(e) as deleted`;
  
  const result = await executeCypher(cypher, { id: args.id });
  
  return { deleted: ((result.deleted as number) ?? 0) > 0 };
}

// ============================================================================
// Relationship Operations
// ============================================================================

/**
 * Add a relationship between entities
 */
export async function addRelationship(args: {
  type: string;
  sourceId: string;
  targetId: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
  confidence?: number;
  sourceRef?: string;
}): Promise<{ relationship: Relationship; created: boolean }> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const relationship: Relationship = {
    id: `rel-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: args.type,
    sourceId: args.sourceId,
    targetId: args.targetId,
    properties: args.properties || {},
    timestamp: args.timestamp || new Date().toISOString(),
    confidence: args.confidence ?? 1.0,
    sourceRef: args.sourceRef,
  };
  
  const cypher = `
    MATCH (source {id: $sourceId}), (target {id: $targetId})
    MERGE (source)-[r:${args.type}]->(target)
    ON CREATE SET r.id = $id, r.timestamp = $timestamp, r.confidence = $confidence, r.properties = $properties, r.sourceRef = $sourceRef
    ON MATCH SET r.properties = r.properties + $properties
    RETURN r, r.id = $id as created
  `;
  
  const result = await executeCypher(cypher, {
    sourceId: args.sourceId,
    targetId: args.targetId,
    id: relationship.id,
    timestamp: relationship.timestamp,
    confidence: relationship.confidence,
    properties: JSON.stringify(relationship.properties),
    sourceRef: relationship.sourceRef,
  });
  
  return {
    relationship,
    created: (result.created as boolean) ?? true,
  };
}

/**
 * Get relationships for an entity
 */
export async function getRelationships(args: {
  entityId: string;
  direction?: 'incoming' | 'outgoing' | 'both';
  type?: string;
  limit?: number;
}): Promise<{ relationships: Relationship[] }> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const direction = args.direction ?? 'both';
  const limit = args.limit ?? 100;
  let cypher: string;
  
  const typeFilter = args.type ? `:${args.type}` : '';
  
  switch (direction) {
    case 'outgoing':
      cypher = `MATCH (e {id: $entityId})-[r${typeFilter}]->(target) RETURN r, target LIMIT $limit`;
      break;
    case 'incoming':
      cypher = `MATCH (source)-[r${typeFilter}]->(e {id: $entityId}) RETURN r, source LIMIT $limit`;
      break;
    default:
      cypher = `MATCH (e {id: $entityId})-[r${typeFilter}]-(other) RETURN r, other LIMIT $limit`;
  }
  
  const result = await executeCypher(cypher, { entityId: args.entityId, limit });
  
  return { relationships: (result.relationships as Relationship[]) || [] };
}

/**
 * Delete a relationship
 */
export async function deleteRelationship(args: {
  id: string;
}): Promise<{ deleted: boolean }> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const cypher = `MATCH ()-[r {id: $id}]->() DELETE r RETURN count(r) as deleted`;
  const result = await executeCypher(cypher, { id: args.id });
  
  return { deleted: ((result.deleted as number) ?? 0) > 0 };
}

// ============================================================================
// Graph Traversal
// ============================================================================

/**
 * Find paths between two entities
 */
export async function findPaths(args: {
  sourceId: string;
  targetId: string;
  maxDepth?: number;
  relationshipTypes?: string[];
}): Promise<{ paths: GraphPath[] }> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const maxDepth = args.maxDepth ?? 5;
  const typeFilter = args.relationshipTypes?.length
    ? `:${args.relationshipTypes.join('|')}`
    : '';
  
  const cypher = `
    MATCH path = shortestPath((source {id: $sourceId})-[${typeFilter}*1..${maxDepth}]-(target {id: $targetId}))
    RETURN path
    LIMIT 10
  `;
  
  const result = await executeCypher(cypher, {
    sourceId: args.sourceId,
    targetId: args.targetId,
  });
  
  return { paths: (result.paths as GraphPath[]) || [] };
}

/**
 * Get entity neighborhood (connected entities within N hops)
 */
export async function getNeighborhood(args: {
  entityId: string;
  depth?: number;
  limit?: number;
}): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const depth = args.depth ?? 2;
  const limit = args.limit ?? 100;
  
  const cypher = `
    MATCH (center {id: $entityId})-[r*1..${depth}]-(connected)
    WITH DISTINCT connected, r
    RETURN connected, r
    LIMIT $limit
  `;
  
  const result = await executeCypher(cypher, { entityId: args.entityId, limit });
  
  return {
    entities: (result.entities as Entity[]) || [],
    relationships: (result.relationships as Relationship[]) || [],
  };
}

// ============================================================================
// Temporal Analysis
// ============================================================================

/**
 * Get timeline of relationships for an entity
 */
export async function getTimeline(args: {
  entityId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<{
  events: Array<{
    timestamp: string;
    relationship: Relationship;
    otherEntity: Entity;
  }>;
}> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const limit = args.limit ?? 100;
  let dateFilter = '';
  const params: Record<string, unknown> = { entityId: args.entityId, limit };
  
  if (args.startDate && args.endDate) {
    dateFilter = 'AND r.timestamp >= $startDate AND r.timestamp <= $endDate';
    params.startDate = args.startDate;
    params.endDate = args.endDate;
  }
  
  const cypher = `
    MATCH (e {id: $entityId})-[r]-(other)
    WHERE r.timestamp IS NOT NULL ${dateFilter}
    RETURN r, other
    ORDER BY r.timestamp DESC
    LIMIT $limit
  `;
  
  const result = await executeCypher(cypher, params);
  
  return { events: (result.events as Array<{ timestamp: string; relationship: Relationship; otherEntity: Entity }>) || [] };
}

/**
 * Detect contradictions in statements over time
 */
export async function detectContradictions(args: {
  entityId: string;
  statementType?: string;
}): Promise<{
  contradictions: Array<{
    statement1: { content: string; timestamp: string; sourceRef?: string };
    statement2: { content: string; timestamp: string; sourceRef?: string };
    similarity: number;
    contradiction: string;
  }>;
}> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  // This would use embeddings to find semantically similar but contradictory statements
  // For now, return placeholder
  const cypher = `
    MATCH (e {id: $entityId})-[r:STATED]->(s:Statement)
    RETURN s
    ORDER BY r.timestamp
  `;
  
  const result = await executeCypher(cypher, { entityId: args.entityId });
  
  // In production, compare statements using embeddings and LLM
  return { contradictions: (result.contradictions as Array<{ statement1: { content: string; timestamp: string; sourceRef?: string }; statement2: { content: string; timestamp: string; sourceRef?: string }; similarity: number; contradiction: string }>) || [] };
}

// ============================================================================
// Graph Export
// ============================================================================

/**
 * Export subgraph for visualization
 */
export async function exportSubgraph(args: {
  entityIds?: string[];
  centerEntityId?: string;
  depth?: number;
  format?: 'json' | 'cytoscape' | 'graphml';
}): Promise<{
  nodes: Array<{ id: string; label: string; type: string; properties: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string; type: string; properties: Record<string, unknown> }>;
  format: string;
}> {
  if (!config.enabled) {
    throw new Error('Graph DB is not enabled');
  }
  
  const format = args.format ?? 'json';
  let cypher: string;
  const params: Record<string, unknown> = {};
  
  if (args.entityIds?.length) {
    cypher = `
      MATCH (n)
      WHERE n.id IN $entityIds
      OPTIONAL MATCH (n)-[r]-(m)
      WHERE m.id IN $entityIds
      RETURN n, r, m
    `;
    params.entityIds = args.entityIds;
  } else if (args.centerEntityId) {
    const depth = args.depth ?? 2;
    cypher = `
      MATCH (center {id: $centerId})-[r*0..${depth}]-(n)
      RETURN DISTINCT n, r
    `;
    params.centerId = args.centerEntityId;
  } else {
    throw new Error('Must provide entityIds or centerEntityId');
  }
  
  const result = await executeCypher(cypher, params);
  
  return {
    nodes: (result.nodes as Array<{ id: string; label: string; type: string; properties: Record<string, unknown> }>) || [],
    edges: (result.edges as Array<{ id: string; source: string; target: string; type: string; properties: Record<string, unknown> }>) || [],
    format,
  };
}

// ============================================================================
// Cypher Execution
// ============================================================================

async function executeCypher(
  query: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // In production, use neo4j-driver
  // For now, make HTTP request to Neo4j HTTP API
  
  const { url, username, password, database } = config.neo4j;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
  try {
    const response = await fetch(`${url.replace('bolt://', 'http://').replace(':7687', ':7474')}/db/${database}/tx/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        statements: [{
          statement: query,
          parameters: params,
        }],
      }),
    });
    
    if (!response.ok) {
      console.warn(`Neo4j query failed: ${response.status}`);
      return {};
    }
    
    const data = await response.json() as { results: Array<{ data: unknown[] }> };
    return data.results?.[0]?.data?.[0] as Record<string, unknown> || {};
  } catch (error) {
    console.warn('Neo4j query error:', error);
    return {};
  }
}
