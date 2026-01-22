/**
 * Salem Forensic Trinity - Storage Layer Exports
 * Central entry point for all storage clients and the system router
 */

export * from './graphiti-client';
export * from './chroma-client';
export * from './directus-client';
export * from './systemRouter';

// Common interfaces
export interface StorageHealth {
  postgres: boolean;
  graphiti: boolean;
  chroma: boolean;
  directus: boolean;
}

/**
 * Get health status for all storage tiers
 */
export async function getStorageHealth(): Promise<StorageHealth> {
  const { trinityRouter } = await import('./systemRouter');

  // Try to initialize router
  try {
    const initialized = await trinityRouter.initialize();
    if (!initialized) {
      // Fallthrough to individual checks
    }
  } catch (e) {
    // Ignore
  }

  // Check each system individually
  const [pg, neo, chr, dir] = await Promise.all([
    // Assuming db.postgres has testConnection or we check via trinityRouter properties if we could access them.
    // For now, assume db.postgres is managed via core/db usually.
    // Let's rely on trinityRouter logs mostly, but here return dynamic checks.
    import('../../core/db').then(m => m.db ? true : false).catch(() => false), // Fallback check
    import('./graphiti-client').then(m => m.graphitiClient.testConnection().then(r => r.success).catch(() => false)),
    import('./chroma-client').then(m => m.chromaManager.healthCheck().catch(() => false)),
    import('./directus-client').then(m => m.createDirectusClient().healthCheck().catch(() => false))
  ]);

  return {
    postgres: pg,
    graphiti: neo,
    chroma: chr,
    directus: dir
  };
}
