/**
 * Evidence Hasher Worker - Chain of Custody Cryptographic Integrity
 * 
 * Endpoints:
 * - POST /hash - Hash content (text or file)
 * - POST /verify - Verify hash matches content
 * - POST /chain/create - Create new chain of custody
 * - POST /chain/append - Add processing stage to chain
 * - POST /chain/verify - Verify entire chain integrity
 * - GET /chain/:id - Get chain of custody record
 * 
 * Environment Variables:
 * - KV_NAMESPACE: KV binding for chain storage
 * - API_KEY: Authentication key
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Authenticate
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    if (apiKey !== env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Hash content
      if (path === '/hash' && request.method === 'POST') {
        return await handleHash(request, corsHeaders);
      }

      // Verify hash
      if (path === '/verify' && request.method === 'POST') {
        return await handleVerify(request, corsHeaders);
      }

      // Create chain of custody
      if (path === '/chain/create' && request.method === 'POST') {
        return await handleChainCreate(request, env, corsHeaders);
      }

      // Append to chain
      if (path === '/chain/append' && request.method === 'POST') {
        return await handleChainAppend(request, env, corsHeaders);
      }

      // Verify chain
      if (path === '/chain/verify' && request.method === 'POST') {
        return await handleChainVerify(request, env, corsHeaders);
      }

      // Get chain
      if (path.startsWith('/chain/') && request.method === 'GET') {
        const id = path.replace('/chain/', '');
        return await handleChainGet(id, env, corsHeaders);
      }

      // Health check
      if (path === '/health') {
        return new Response(JSON.stringify({ status: 'healthy', service: 'evidence-hasher' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// Compute SHA-256 hash
async function computeHash(data) {
  const encoder = new TextEncoder();
  const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate evidence ID
function generateEvidenceId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `EVD-${timestamp}-${random}`.toUpperCase();
}

async function handleHash(request, corsHeaders) {
  const contentType = request.headers.get('Content-Type') || '';
  let data;

  if (contentType.includes('application/json')) {
    const json = await request.json();
    data = json.content || JSON.stringify(json);
  } else if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    data = await file.arrayBuffer();
  } else {
    data = await request.text();
  }

  const hash = await computeHash(data);
  const timestamp = new Date().toISOString();

  return new Response(JSON.stringify({
    hash,
    algorithm: 'SHA-256',
    timestamp,
    size: typeof data === 'string' ? data.length : data.byteLength,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleVerify(request, corsHeaders) {
  const json = await request.json();
  const { content, expectedHash } = json;

  if (!content || !expectedHash) {
    return new Response(JSON.stringify({ error: 'Missing content or expectedHash' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const actualHash = await computeHash(content);
  const valid = actualHash.toLowerCase() === expectedHash.toLowerCase();

  return new Response(JSON.stringify({
    valid,
    expectedHash,
    actualHash,
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleChainCreate(request, env, corsHeaders) {
  const json = await request.json();
  const { filename, content, mimeType, operator, notes } = json;

  if (!filename || !content) {
    return new Response(JSON.stringify({ error: 'Missing filename or content' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const evidenceId = generateEvidenceId();
  const originalHash = await computeHash(content);
  const timestamp = new Date().toISOString();

  const chain = {
    evidenceId,
    originalFilename: filename,
    originalHash,
    mimeType: mimeType || 'application/octet-stream',
    fileSize: typeof content === 'string' ? content.length : content.byteLength,
    createdAt: timestamp,
    chain: [{
      stage: 'original',
      hash: originalHash,
      timestamp,
      operator: operator || 'system',
      tool: 'evidence-hasher-worker',
      toolVersion: '1.0.0',
      notes: notes || 'Initial evidence acquisition',
    }],
    metadata: {},
    verified: true,
    verificationErrors: [],
  };

  // Store in KV
  await env.KV_NAMESPACE.put(`chain:${evidenceId}`, JSON.stringify(chain), {
    expirationTtl: 60 * 60 * 24 * 365 * 7, // 7 years retention
  });

  return new Response(JSON.stringify({
    success: true,
    evidenceId,
    originalHash,
    chain,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleChainAppend(request, env, corsHeaders) {
  const json = await request.json();
  const { evidenceId, stage, content, operator, tool, toolVersion, notes } = json;

  if (!evidenceId || !stage || !content) {
    return new Response(JSON.stringify({ error: 'Missing evidenceId, stage, or content' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get existing chain
  const chainData = await env.KV_NAMESPACE.get(`chain:${evidenceId}`);
  if (!chainData) {
    return new Response(JSON.stringify({ error: 'Chain not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const chain = JSON.parse(chainData);
  const previousRecord = chain.chain[chain.chain.length - 1];
  const newHash = await computeHash(content);
  const timestamp = new Date().toISOString();

  // Add new record
  const newRecord = {
    stage,
    hash: newHash,
    timestamp,
    operator: operator || 'system',
    tool: tool || 'evidence-hasher-worker',
    toolVersion: toolVersion || '1.0.0',
    inputHash: previousRecord.hash,
    notes,
  };

  chain.chain.push(newRecord);

  // Update in KV
  await env.KV_NAMESPACE.put(`chain:${evidenceId}`, JSON.stringify(chain), {
    expirationTtl: 60 * 60 * 24 * 365 * 7,
  });

  return new Response(JSON.stringify({
    success: true,
    evidenceId,
    stage,
    hash: newHash,
    chainLength: chain.chain.length,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleChainVerify(request, env, corsHeaders) {
  const json = await request.json();
  const { evidenceId, contents } = json;

  if (!evidenceId) {
    return new Response(JSON.stringify({ error: 'Missing evidenceId' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const chainData = await env.KV_NAMESPACE.get(`chain:${evidenceId}`);
  if (!chainData) {
    return new Response(JSON.stringify({ error: 'Chain not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const chain = JSON.parse(chainData);
  const errors = [];
  const warnings = [];

  // Verify chain linkage
  for (let i = 1; i < chain.chain.length; i++) {
    const current = chain.chain[i];
    const previous = chain.chain[i - 1];
    
    if (current.inputHash !== previous.hash) {
      errors.push(`Chain break at stage ${i}: inputHash doesn't match previous hash`);
    }
  }

  // Verify content hashes if provided
  if (contents && Array.isArray(contents)) {
    for (let i = 0; i < Math.min(contents.length, chain.chain.length); i++) {
      const expectedHash = chain.chain[i].hash;
      const actualHash = await computeHash(contents[i]);
      
      if (actualHash !== expectedHash) {
        errors.push(`Content mismatch at stage ${i}: expected ${expectedHash}, got ${actualHash}`);
      }
    }
  }

  const valid = errors.length === 0;

  return new Response(JSON.stringify({
    valid,
    evidenceId,
    chainLength: chain.chain.length,
    errors,
    warnings,
    verifiedAt: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleChainGet(id, env, corsHeaders) {
  const chainData = await env.KV_NAMESPACE.get(`chain:${id}`);
  
  if (!chainData) {
    return new Response(JSON.stringify({ error: 'Chain not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(chainData, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
