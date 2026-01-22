/**
 * Test file to verify database clients can be imported and instantiated
 */

import { 
  getDatabaseClient, 
  DATABASE_ROLES, 
  initAllDatabases,
  getDatabaseForOperation
} from './db';

async function testDatabaseImports() {
  console.log('🧪 Testing database client imports...');
  
  try {
    // Test the router logic
    console.log('\n📊 Testing database routing...');
    
    const operations = [
      { type: 'embeddings' as const, retention: 'permanent' as const },
      { type: 'entities' as const, retention: 'permanent' as const },
      { type: 'context' as const, retention: 'short_term' as const },
      { type: 'files' as const, retention: 'permanent' as const },
      { type: 'scratch' as const, retention: 'temporary' as const },
      { type: 'messages' as const, retention: 'permanent' as const }
    ];
    
    for (const op of operations) {
      const role = getDatabaseForOperation(op);
      console.log(`  ${op.type} → ${role}`);
    }
    
    // Test client instantiation (will show stub warnings, which is expected)
    console.log('\n🔌 Testing client instantiation...');
    
    const clients = [
      DATABASE_ROLES.PRIMARY,
      DATABASE_ROLES.TEMPORAL_GRAPH,
      DATABASE_ROLES.WORKING_MEMORY,
      DATABASE_ROLES.FILE_VAULT,
      DATABASE_ROLES.SCRATCH
    ];
    
    for (const role of clients) {
      try {
        console.log(`  Testing ${role}...`);
        const client = await getDatabaseClient(role);
        console.log(`    ✓ Client created: ${typeof client}`);
      } catch (error) {
        console.log(`    ✗ Failed: ${(error as Error).message}`);
      }
    }
    
    console.log('\n✨ Database import test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDatabaseImports().catch(console.error);