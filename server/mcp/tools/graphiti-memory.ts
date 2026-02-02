/**
 * Graphiti Memory MCP Tools
 *
 * Exposes Graphiti temporal knowledge graph as MCP tools for AI chatbots.
 * Implements Gap 1.2 from GAP_ANALYSIS_PRIORITIES.md
 *
 * PURPOSE:
 * - Dual purpose: (1) AI chatbot context memory, (2) Forensic evidence temporal awareness
 * - Mimics Zep AI platform architecture (conversation memory + temporal facts)
 *
 * TOOLS:
 * - graphiti.add_memory - Store entities and facts
 * - graphiti.search_memory - Semantic + temporal search
 * - graphiti.get_timeline - Entity timeline with temporal facts
 * - graphiti.detect_contradictions - Find conflicting claims
 * - graphiti.share_context - Get conversation context
 */

import { graphitiClient } from '../storage/graphiti-client';
import type { Entity } from '../storage/graphiti-client';

// ============================================================================
// MCP TOOL DEFINITIONS
// ============================================================================

export const GRAPHITI_TOOLS = [
  {
    name: 'graphiti.add_memory',
    description:
      'Store a memory (entities, facts, relationships) in the temporal knowledge graph. ' +
      'Use this to remember information from conversations or evidence analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'Case ID to associate this memory with'
        },
        entities: {
          type: 'array',
          description: 'List of entities (people, places, organizations) to store',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Entity name' },
              type: {
                type: 'string',
                description: 'Entity type (person, place, organization, event, etc.)'
              },
              properties: {
                type: 'object',
                description: 'Additional properties (metadata, attributes)'
              }
            },
            required: ['name', 'type']
          }
        },
        facts: {
          type: 'array',
          description: 'Facts or claims to store with temporal awareness',
          items: {
            type: 'object',
            properties: {
              claim: { type: 'string', description: 'The factual claim or statement' },
              subject_entity: { type: 'string', description: 'Entity this fact is about' },
              valid_from: {
                type: 'string',
                description: 'ISO timestamp when this fact became true'
              },
              valid_to: {
                type: 'string',
                description: 'Optional: ISO timestamp when this fact stopped being true'
              },
              confidence: {
                type: 'number',
                description: 'Confidence level 0.0-1.0 (default: 1.0)'
              }
            },
            required: ['claim', 'subject_entity']
          }
        },
        relationships: {
          type: 'array',
          description: 'Relationships between entities',
          items: {
            type: 'object',
            properties: {
              from_entity: { type: 'string', description: 'Source entity name' },
              to_entity: { type: 'string', description: 'Target entity name' },
              type: {
                type: 'string',
                description: 'Relationship type (knows, works_with, located_at, etc.)'
              },
              properties: { type: 'object', description: 'Additional relationship data' }
            },
            required: ['from_entity', 'to_entity', 'type']
          }
        },
        source: {
          type: 'string',
          description: 'Source of this memory (message_id, document_id, etc.)'
        }
      },
      required: ['case_id', 'entities']
    }
  },
  {
    name: 'graphiti.search_memory',
    description:
      'Search the temporal knowledge graph for relevant memories, entities, or facts. ' +
      'Returns context-aware results based on semantic similarity and temporal validity.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'Case ID to search within'
        },
        query: {
          type: 'string',
          description: 'Natural language search query'
        },
        entity_types: {
          type: 'array',
          description: 'Optional: Filter by entity types (person, place, etc.)',
          items: { type: 'string' }
        },
        as_of_date: {
          type: 'string',
          description: 'Optional: ISO timestamp - return facts valid at this time'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)'
        }
      },
      required: ['case_id', 'query']
    }
  },
  {
    name: 'graphiti.get_timeline',
    description:
      'Get a temporal timeline of facts and events for a specific entity. ' +
      'Shows how information about this entity evolved over time.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'Case ID'
        },
        entity_name: {
          type: 'string',
          description: 'Name of the entity to get timeline for'
        },
        start_date: {
          type: 'string',
          description: 'Optional: ISO timestamp for timeline start'
        },
        end_date: {
          type: 'string',
          description: 'Optional: ISO timestamp for timeline end'
        }
      },
      required: ['case_id', 'entity_name']
    }
  },
  {
    name: 'graphiti.detect_contradictions',
    description:
      'Detect contradictory claims or facts in the knowledge graph. ' +
      'Finds statements that conflict with each other about the same entity.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'Case ID to analyze'
        },
        entity_name: {
          type: 'string',
          description: 'Optional: Focus on contradictions about this entity'
        },
        threshold: {
          type: 'number',
          description: 'Confidence threshold for contradiction detection (0.0-1.0, default: 0.7)'
        }
      },
      required: ['case_id']
    }
  },
  {
    name: 'graphiti.share_context',
    description:
      'Share conversation context with other AI agents. Returns relevant entities, ' +
      'facts, and relationships for a given conversation or case.',
    inputSchema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'Case ID to get context for'
        },
        focus_entities: {
          type: 'array',
          description: 'Optional: Entity names to focus context around',
          items: { type: 'string' }
        },
        depth: {
          type: 'number',
          description: 'Relationship depth to traverse (default: 2)'
        }
      },
      required: ['case_id']
    }
  }
];

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * Add memory to Graphiti (entities, facts, relationships)
 */
export async function addMemory(params: {
  case_id: string;
  entities: Array<{ name: string; type: string; properties?: Record<string, any> }>;
  facts?: Array<{
    claim: string;
    subject_entity: string;
    valid_from?: string;
    valid_to?: string;
    confidence?: number;
  }>;
  relationships?: Array<{
    from_entity: string;
    to_entity: string;
    type: string;
    properties?: Record<string, any>;
  }>;
  source?: string;
}): Promise<{ success: boolean; stored: { entities: number; facts: number; relationships: number } }> {
  try {
    const timestamp = new Date().toISOString();
    const stored = { entities: 0, facts: 0, relationships: 0 };

    // Store entities
    const entityMap = new Map<string, string>(); // name -> id
    const entitiesToStore: Entity[] = params.entities.map(e => {
      const id = `${params.case_id}:${e.type}:${e.name.toLowerCase().replace(/\s+/g, '_')}`;
      entityMap.set(e.name, id);
      return {
        id,
        type: e.type,
        name: e.name,
        properties: {
          case_id: params.case_id,
          created_at: timestamp,
          source: params.source,
          ...e.properties
        }
      };
    });

    await graphitiClient.storeEntities(entitiesToStore);
    stored.entities = entitiesToStore.length;

    // Store facts as entity properties with temporal validity
    if (params.facts && params.facts.length > 0) {
      const session = (graphitiClient as any).getSession();
      try {
        for (const fact of params.facts) {
          const entityId = entityMap.get(fact.subject_entity);
          if (!entityId) continue;

          await session.run(
            `
            MATCH (e:Entity {id: $entityId})
            CREATE (f:Fact {
              id: $factId,
              claim: $claim,
              valid_from: $validFrom,
              valid_to: $validTo,
              confidence: $confidence,
              case_id: $caseId,
              source: $source,
              created_at: $timestamp
            })
            CREATE (e)-[:HAS_FACT]->(f)
            `,
            {
              entityId,
              factId: `${params.case_id}:fact:${Date.now()}:${Math.random().toString(36).slice(2)}`,
              claim: fact.claim,
              validFrom: fact.valid_from || timestamp,
              validTo: fact.valid_to || null,
              confidence: fact.confidence || 1.0,
              caseId: params.case_id,
              source: params.source,
              timestamp
            }
          );
          stored.facts++;
        }
      } finally {
        await session.close();
      }
    }

    // Store relationships
    if (params.relationships && params.relationships.length > 0) {
      const relationshipsToStore = params.relationships
        .map(r => {
          const fromId = entityMap.get(r.from_entity);
          const toId = entityMap.get(r.to_entity);
          if (!fromId || !toId) return null;

          return {
            id: `${fromId}:${r.type}:${toId}`,
            type: r.type,
            fromEntityId: fromId,
            toEntityId: toId,
            properties: {
              case_id: params.case_id,
              created_at: timestamp,
              source: params.source,
              ...r.properties
            },
            timestamp: new Date()
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (relationshipsToStore.length > 0) {
        await graphitiClient.storeRelationships(relationshipsToStore);
        stored.relationships = relationshipsToStore.length;
      }
    }

    return { success: true, stored };
  } catch (error) {
    console.error('[Graphiti MCP] addMemory failed:', error);
    throw error;
  }
}

/**
 * Search memory with temporal awareness
 */
export async function searchMemory(params: {
  case_id: string;
  query: string;
  entity_types?: string[];
  as_of_date?: string;
  limit?: number;
}): Promise<{
  entities: Array<{ name: string; type: string; relevance: number; properties: any }>;
  facts: Array<{ claim: string; entity: string; valid_from: string; valid_to?: string }>;
}> {
  try {
    const limit = params.limit || 10;
    const asOfDate = params.as_of_date || new Date().toISOString();

    // Build query with optional entity type filter
    const typeFilter = params.entity_types?.length
      ? `AND e.type IN [${params.entity_types.map(t => `'${t}'`).join(',')}]`
      : '';

    // Search entities
    const entities = await graphitiClient.runQuery<{
      e: any;
      score: number;
    }>(
      `
      MATCH (e:Entity)
      WHERE e.case_id = $caseId ${typeFilter}
      AND (e.name CONTAINS $query OR any(prop IN keys(e) WHERE toString(e[prop]) CONTAINS $query))
      RETURN e, 1.0 as score
      LIMIT $limit
      `,
      { caseId: params.case_id, query: params.query, limit }
    );

    // Get facts for matched entities
    const entityIds = entities.map(r => (r as any).e.properties.id);
    const facts =
      entityIds.length > 0
        ? await graphitiClient.runQuery<{ f: any; e: any }>(
            `
        MATCH (e:Entity)-[:HAS_FACT]->(f:Fact)
        WHERE e.id IN $entityIds
        AND f.valid_from <= $asOfDate
        AND (f.valid_to IS NULL OR f.valid_to >= $asOfDate)
        RETURN f, e
        LIMIT $limit
        `,
            { entityIds, asOfDate, limit }
          )
        : [];

    return {
      entities: entities.map(r => {
        const node = (r as any).e.properties;
        return {
          name: node.name,
          type: node.type,
          relevance: (r as any).score,
          properties: node
        };
      }),
      facts: facts.map(r => {
        const fact = (r as any).f.properties;
        const entity = (r as any).e.properties;
        return {
          claim: fact.claim,
          entity: entity.name,
          valid_from: fact.valid_from,
          valid_to: fact.valid_to
        };
      })
    };
  } catch (error) {
    console.error('[Graphiti MCP] searchMemory failed:', error);
    throw error;
  }
}

/**
 * Get temporal timeline for an entity
 */
export async function getTimeline(params: {
  case_id: string;
  entity_name: string;
  start_date?: string;
  end_date?: string;
}): Promise<{
  entity: { name: string; type: string };
  timeline: Array<{
    timestamp: string;
    event_type: string;
    description: string;
    source?: string;
  }>;
}> {
  try {
    const startDate = params.start_date || '1970-01-01T00:00:00.000Z';
    const endDate = params.end_date || new Date().toISOString();

    // Find entity
    const entities = await graphitiClient.runQuery<{ e: any }>(
      `
      MATCH (e:Entity)
      WHERE e.case_id = $caseId AND e.name = $entityName
      RETURN e
      LIMIT 1
      `,
      { caseId: params.case_id, entityName: params.entity_name }
    );

    if (entities.length === 0) {
      throw new Error(`Entity '${params.entity_name}' not found in case ${params.case_id}`);
    }

    const entity = entities[0].e.properties;

    // Get timeline of facts
    const timeline = await graphitiClient.runQuery<{ f: any }>(
      `
      MATCH (e:Entity {id: $entityId})-[:HAS_FACT]->(f:Fact)
      WHERE f.valid_from >= $startDate AND f.valid_from <= $endDate
      RETURN f
      ORDER BY f.valid_from ASC
      `,
      { entityId: entity.id, startDate, endDate }
    );

    return {
      entity: {
        name: entity.name,
        type: entity.type
      },
      timeline: timeline.map(r => {
        const fact = r.f.properties;
        return {
          timestamp: fact.valid_from,
          event_type: 'fact',
          description: fact.claim,
          source: fact.source
        };
      })
    };
  } catch (error) {
    console.error('[Graphiti MCP] getTimeline failed:', error);
    throw error;
  }
}

/**
 * Detect contradictions in temporal facts
 * Implements Gap 1.3 from GAP_ANALYSIS_PRIORITIES.md
 *
 * STRATEGY:
 * 1. Find entities with multiple facts
 * 2. Compare overlapping temporal facts (same valid_from range)
 * 3. Score contradictions based on semantic opposition
 * 4. Report high-confidence contradictions
 */
export async function detectContradictions(params: {
  case_id: string;
  entity_name?: string;
  threshold?: number;
}): Promise<{
  contradictions: Array<{
    entity: string;
    fact1: { claim: string; timestamp: string; confidence: number };
    fact2: { claim: string; timestamp: string; confidence: number };
    confidence: number;
    reason: string;
  }>;
}> {
  try {
    const threshold = params.threshold || 0.7;
    const contradictions: Array<{
      entity: string;
      fact1: { claim: string; timestamp: string; confidence: number };
      fact2: { claim: string; timestamp: string; confidence: number };
      confidence: number;
      reason: string;
    }> = [];

    // Build query with optional entity filter
    let entityFilter = `e.case_id = $caseId`;
    if (params.entity_name) {
      entityFilter += ` AND e.name = $entityName`;
    }

    // Find entities with multiple facts that overlap temporally
    const overlappingFacts = await graphitiClient.runQuery<{
      e: any;
      f1: any;
      f2: any;
    }>(
      `
      MATCH (e:Entity)-[:HAS_FACT]->(f1:Fact)
      MATCH (e)-[:HAS_FACT]->(f2:Fact)
      WHERE ${entityFilter}
      AND f1.id < f2.id
      AND f1.valid_from <= coalesce(f2.valid_to, datetime())
      AND coalesce(f1.valid_to, datetime()) >= f2.valid_from
      RETURN e, f1, f2
      LIMIT 100
      `,
      {
        caseId: params.case_id,
        entityName: params.entity_name
      }
    );

    // Analyze each pair for contradictions
    for (const result of overlappingFacts) {
      const entity = result.e.properties;
      const fact1 = result.f1.properties;
      const fact2 = result.f2.properties;

      // Simple heuristic-based contradiction detection
      const contradictionScore = detectSemanticContradiction(
        fact1.claim,
        fact2.claim,
        fact1.confidence || 1.0,
        fact2.confidence || 1.0
      );

      if (contradictionScore.score >= threshold) {
        contradictions.push({
          entity: entity.name,
          fact1: {
            claim: fact1.claim,
            timestamp: fact1.valid_from,
            confidence: fact1.confidence || 1.0
          },
          fact2: {
            claim: fact2.claim,
            timestamp: fact2.valid_from,
            confidence: fact2.confidence || 1.0
          },
          confidence: contradictionScore.score,
          reason: contradictionScore.reason
        });
      }
    }

    return { contradictions };
  } catch (error) {
    console.error('[Graphiti MCP] detectContradictions failed:', error);
    throw error;
  }
}

/**
 * Heuristic-based semantic contradiction detection
 *
 * SIMPLE RULES (can be enhanced with LLM later):
 * 1. Negation patterns (was/wasn't, did/didn't, is/isn't)
 * 2. Conflicting values for same property
 * 3. Mutually exclusive states
 *
 * Returns score 0.0-1.0 and reason
 */
function detectSemanticContradiction(
  claim1: string,
  claim2: string,
  confidence1: number,
  confidence2: number
): { score: number; reason: string } {
  const c1 = claim1.toLowerCase();
  const c2 = claim2.toLowerCase();

  // Rule 1: Direct negation patterns
  const negationPairs = [
    ['was', "wasn't"],
    ['did', "didn't"],
    ['is', "isn't"],
    ['has', "hasn't"],
    ['will', "won't"],
    ['can', "can't"],
    ['true', 'false'],
    ['yes', 'no'],
    ['alive', 'dead'],
    ['present', 'absent'],
    ['guilty', 'innocent']
  ];

  for (const [positive, negative] of negationPairs) {
    if (
      (c1.includes(positive) && c2.includes(negative)) ||
      (c1.includes(negative) && c2.includes(positive))
    ) {
      // Check if they're about the same subject
      const words1 = new Set(c1.split(/\s+/));
      const words2 = new Set(c2.split(/\s+/));
      const commonWords = Array.from(words1).filter(w => words2.has(w)).length;

      if (commonWords >= 2) {
        return {
          score: Math.min(confidence1, confidence2) * 0.95,
          reason: `Direct negation pattern: "${positive}" vs "${negative}"`
        };
      }
    }
  }

  // Rule 2: Conflicting numbers/dates/values
  const numbers1 = c1.match(/\d+/g) || [];
  const numbers2 = c2.match(/\d+/g) || [];

  if (numbers1.length > 0 && numbers2.length > 0) {
    const words1 = new Set(c1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(c2.split(/\s+/).filter(w => w.length > 3));
    const commonWords = Array.from(words1).filter(w => words2.has(w) && !/^\d+$/.test(w)).length;

    if (commonWords >= 2 && numbers1[0] !== numbers2[0]) {
      return {
        score: Math.min(confidence1, confidence2) * 0.85,
        reason: `Conflicting values: "${numbers1[0]}" vs "${numbers2[0]}" in similar claims`
      };
    }
  }

  // Rule 3: Mutually exclusive states
  const exclusivePairs = [
    ['married', 'single'],
    ['employed', 'unemployed'],
    ['guilty', 'innocent'],
    ['alive', 'deceased'],
    ['present', 'absent'],
    ['active', 'inactive'],
    ['open', 'closed'],
    ['confirmed', 'denied']
  ];

  for (const [state1, state2] of exclusivePairs) {
    if ((c1.includes(state1) && c2.includes(state2)) || (c1.includes(state2) && c2.includes(state1))) {
      const words1 = new Set(c1.split(/\s+/));
      const words2 = new Set(c2.split(/\s+/));
      const commonWords = Array.from(words1).filter(w => words2.has(w)).length;

      if (commonWords >= 2) {
        return {
          score: Math.min(confidence1, confidence2) * 0.9,
          reason: `Mutually exclusive states: "${state1}" vs "${state2}"`
        };
      }
    }
  }

  // No contradiction detected
  return { score: 0, reason: 'No contradiction pattern found' };
}

/**
 * Share context for cross-agent coordination
 */
export async function shareContext(params: {
  case_id: string;
  focus_entities?: string[];
  depth?: number;
}): Promise<{
  entities: Array<{ name: string; type: string; properties: any }>;
  relationships: Array<{ from: string; to: string; type: string }>;
  facts: Array<{ entity: string; claim: string; timestamp: string }>;
}> {
  try {
    const depth = params.depth || 2;

    // Get focused entities or all entities
    let entityQuery = `MATCH (e:Entity) WHERE e.case_id = $caseId`;
    if (params.focus_entities && params.focus_entities.length > 0) {
      entityQuery += ` AND e.name IN $focusEntities`;
    }
    entityQuery += ` RETURN e LIMIT 50`;

    const entities = await graphitiClient.runQuery<{ e: any }>(entityQuery, {
      caseId: params.case_id,
      focusEntities: params.focus_entities || []
    });

    // Get relationships within depth
    const entityIds = entities.map(r => r.e.properties.id);
    const relationships =
      entityIds.length > 0
        ? await graphitiClient.runQuery<{ r: any; from: any; to: any }>(
            `
        MATCH (from:Entity)-[r:RELATIONSHIP]->(to:Entity)
        WHERE from.id IN $entityIds
        RETURN r, from, to
        LIMIT 100
        `,
            { entityIds }
          )
        : [];

    // Get facts
    const facts =
      entityIds.length > 0
        ? await graphitiClient.runQuery<{ f: any; e: any }>(
            `
        MATCH (e:Entity)-[:HAS_FACT]->(f:Fact)
        WHERE e.id IN $entityIds
        RETURN f, e
        ORDER BY f.valid_from DESC
        LIMIT 50
        `,
            { entityIds }
          )
        : [];

    return {
      entities: entities.map(r => ({
        name: r.e.properties.name,
        type: r.e.properties.type,
        properties: r.e.properties
      })),
      relationships: relationships.map(r => ({
        from: r.from.properties.name,
        to: r.to.properties.name,
        type: r.r.properties.type
      })),
      facts: facts.map(r => ({
        entity: r.e.properties.name,
        claim: r.f.properties.claim,
        timestamp: r.f.properties.valid_from
      }))
    };
  } catch (error) {
    console.error('[Graphiti MCP] shareContext failed:', error);
    throw error;
  }
}

// ============================================================================
// MCP TOOL EXECUTOR
// ============================================================================

export async function executeGraphitiTool(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'graphiti.add_memory':
      return await addMemory(args);

    case 'graphiti.search_memory':
      return await searchMemory(args);

    case 'graphiti.get_timeline':
      return await getTimeline(args);

    case 'graphiti.detect_contradictions':
      return await detectContradictions(args);

    case 'graphiti.share_context':
      return await shareContext(args);

    default:
      throw new Error(`Unknown Graphiti tool: ${toolName}`);
  }
}
