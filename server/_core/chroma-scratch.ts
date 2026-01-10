/**
 * Chroma Scratch Space - In-Memory Vector Store on Manus Platform
 * 
 * This is the ephemeral "scratch space" tier of the three-tier memory architecture:
 * 1. Persistent Context: Graphiti + Neo4j (Cloud Run) - Long-term knowledge graph
 * 2. Working Memory: Chroma on salem-forge (72hr TTL) - Active processing
 * 3. Scratch Space: Chroma on Manus (THIS FILE) - Agent coordination, workflow state
 * 
 * Purpose:
 * - Agent coordination state (active workflows, task assignments)
 * - Current processing context (conversation turns, active analysis)
 * - Temporary embeddings (session-specific, not worth persisting)
 * - Survives Manus platform restarts (unlike pure in-memory)
 * 
 * TTL: 1 hour (configurable)
 * Storage: Local disk persistence (./data/chroma-scratch/)
 */

import { ChromaClient, Collection } from 'chromadb';

// Singleton Chroma client
let chromaClient: ChromaClient | null = null;

/**
 * Initialize Chroma client (in-process, local storage)
 */
export function getChromaClient(): ChromaClient {
  if (!chromaClient) {
    chromaClient = new ChromaClient({
      path: process.env.CHROMA_SCRATCH_PATH || './data/chroma-scratch',
    });
  }
  return chromaClient;
}

/**
 * Get or create a collection
 */
export async function getCollection(name: string): Promise<Collection> {
  const client = getChromaClient();
  
  try {
    return await client.getOrCreateCollection({
      name,
      metadata: {
        'hnsw:space': 'cosine',
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`Failed to get/create collection ${name}:`, error);
    throw error;
  }
}

/**
 * Store agent coordination state
 */
export async function storeAgentState(
  agentId: string,
  state: Record<string, any>,
  embedding?: number[]
) {
  const collection = await getCollection('agent_coordination');
  
  await collection.add({
    ids: [agentId],
    documents: [JSON.stringify(state)],
    metadatas: [{
      agent_id: agentId,
      timestamp: Date.now(),
      ttl: Date.now() + 3600000, // 1 hour
    }],
    embeddings: embedding ? [embedding] : undefined,
  });
}

/**
 * Get agent coordination state
 */
export async function getAgentState(agentId: string): Promise<Record<string, any> | null> {
  const collection = await getCollection('agent_coordination');
  
  try {
    const result = await collection.get({
      ids: [agentId],
    });
    
    if (result.documents.length === 0) return null;
    
    return JSON.parse(result.documents[0] as string);
  } catch (error) {
    console.error(`Failed to get agent state for ${agentId}:`, error);
    return null;
  }
}

/**
 * Store workflow state
 */
export async function storeWorkflowState(
  workflowId: string,
  state: Record<string, any>
) {
  const collection = await getCollection('workflow_state');
  
  await collection.add({
    ids: [workflowId],
    documents: [JSON.stringify(state)],
    metadatas: [{
      workflow_id: workflowId,
      timestamp: Date.now(),
      ttl: Date.now() + 3600000, // 1 hour
    }],
  });
}

/**
 * Get workflow state
 */
export async function getWorkflowState(workflowId: string): Promise<Record<string, any> | null> {
  const collection = await getCollection('workflow_state');
  
  try {
    const result = await collection.get({
      ids: [workflowId],
    });
    
    if (result.documents.length === 0) return null;
    
    return JSON.parse(result.documents[0] as string);
  } catch (error) {
    console.error(`Failed to get workflow state for ${workflowId}:`, error);
    return null;
  }
}

/**
 * Store temporary embeddings (session-specific)
 */
export async function storeTempEmbedding(
  id: string,
  text: string,
  embedding: number[],
  metadata: Record<string, any> = {}
) {
  const collection = await getCollection('temp_embeddings');
  
  await collection.add({
    ids: [id],
    documents: [text],
    embeddings: [embedding],
    metadatas: [{
      ...metadata,
      timestamp: Date.now(),
      ttl: Date.now() + 3600000, // 1 hour
    }],
  });
}

/**
 * Search temporary embeddings
 */
export async function searchTempEmbeddings(
  queryEmbedding: number[],
  limit: number = 10
) {
  const collection = await getCollection('temp_embeddings');
  
  return await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit,
  });
}

/**
 * Cleanup expired items (TTL enforcement)
 * Should be called periodically (e.g., every 5 minutes)
 */
export async function cleanupExpired() {
  const collections = ['agent_coordination', 'workflow_state', 'temp_embeddings'];
  const now = Date.now();
  
  for (const collectionName of collections) {
    try {
      const collection = await getCollection(collectionName);
      
      // Get all items
      const result = await collection.get();
      
      // Find expired items
      const expiredIds: string[] = [];
      result.metadatas?.forEach((metadata, index) => {
        if (metadata && typeof metadata === 'object' && 'ttl' in metadata) {
          const ttl = metadata.ttl as number;
          if (ttl < now) {
            expiredIds.push(result.ids[index]);
          }
        }
      });
      
      // Delete expired items
      if (expiredIds.length > 0) {
        await collection.delete({
          ids: expiredIds,
        });
        console.log(`Cleaned up ${expiredIds.length} expired items from ${collectionName}`);
      }
    } catch (error) {
      console.error(`Failed to cleanup ${collectionName}:`, error);
    }
  }
}

/**
 * Clear all scratch space (use with caution)
 */
export async function clearAll() {
  const collections = ['agent_coordination', 'workflow_state', 'temp_embeddings'];
  
  for (const collectionName of collections) {
    try {
      const client = getChromaClient();
      await client.deleteCollection({ name: collectionName });
      console.log(`Cleared collection: ${collectionName}`);
    } catch (error) {
      console.error(`Failed to clear ${collectionName}:`, error);
    }
  }
}

// Start cleanup interval (every 5 minutes)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    cleanupExpired().catch(console.error);
  }, 5 * 60 * 1000);
}
