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
  const initialized = await trinityRouter.initialize();
  
  if (!initialized) {
    return {
      postgres: false,
      graphiti: false,
      chroma: false,
      directus: false
    };
  }

  // Check each system
  const [pg, neo, chr, dir] = await Promise.all([
    import('../../core/db.postgres').then(m => m.testConnection().then(r => r.success)),
    import('./graphiti-client').then(m => {
      const c = m.createGraphitiClient();
      return c.connect().then(() => true).catch(() => false);
    }),
    import('./chroma-client').then(m => {
      const { chromaEvidenceClient } = m;
      return chromaEvidenceClient.healthCheck();
    }),
    import('./directus-client').then(m => {
      const c = m.createDirectusClient();
      return c.healthCheck();
    })
  ]);

  return {
    postgres: pg,
    graphiti: neo,
    chroma: chr,
    directus: dir
  };
}
