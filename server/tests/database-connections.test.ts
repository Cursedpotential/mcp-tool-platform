/**
 * Database Connection Tests
 * Validates Neo4j Aura and Supabase credentials
 */

import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Database Connections', () => {
  it('should connect to Supabase with valid credentials', async () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    
    expect(supabaseUrl).toBeDefined();
    expect(supabaseKey).toBeDefined();
    
    const supabase = createClient(supabaseUrl!, supabaseKey!);
    
    // Test connection with a simple query
    const { data, error } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1);
    
    // We expect either data or a "relation does not exist" error (which means connection works)
    if (error) {
      // Connection successful but table doesn't exist - that's fine
      expect(error.code).toMatch(/42P01|PGRST/); // Postgres "relation does not exist" or PostgREST error
    } else {
      // Connection successful and table exists
      expect(data).toBeDefined();
    }
  }, 10000);

  it('should connect to Neo4j Aura with valid credentials', async () => {
    const neo4jUrl = process.env.NEO4J_URL;
    const neo4jUser = process.env.NEO4J_USERNAME;
    const neo4jPassword = process.env.NEO4J_PASSWORD;
    
    expect(neo4jUrl).toBeDefined();
    expect(neo4jUser).toBeDefined();
    expect(neo4jPassword).toBeDefined();
    
    // Test via Python bridge (Graphiti runner)
    const { spawn } = await import('child_process');
    const { join } = await import('path');
    
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const testScript = join(process.cwd(), 'server', 'python-tools', 'test_neo4j_connection.py');
    
    // Create a simple test script
    const fs = await import('fs/promises');
    await fs.writeFile(testScript, `
import sys
import os

try:
    from neo4j import GraphDatabase
    
    uri = os.getenv('NEO4J_URL')
    user = os.getenv('NEO4J_USERNAME')
    password = os.getenv('NEO4J_PASSWORD')
    
    driver = GraphDatabase.driver(uri, auth=(user, password))
    
    # Test connection
    with driver.session() as session:
        result = session.run("RETURN 1 as test")
        record = result.single()
        assert record["test"] == 1
    
    driver.close()
    print("SUCCESS")
    sys.exit(0)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
`, 'utf-8');
    
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn(pythonCmd, [testScript], {
        env: process.env,
        timeout: 10000,
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Neo4j connection failed (code ${code}):\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
        }
      });
      
      proc.on('error', (err) => {
        reject(err);
      });
    });
    
    expect(result).toContain('SUCCESS');
    
    // Cleanup
    await fs.unlink(testScript);
  }, 15000);
});
