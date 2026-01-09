/**
 * Auth Proxy Worker - API Authentication & Authorization Gateway
 * 
 * Features:
 * - JWT validation
 * - API key authentication
 * - Request forwarding to backend services
 * - Role-based access control
 * - Request/response logging
 * 
 * Environment Variables:
 * - JWT_SECRET: Secret for JWT validation
 * - API_KEYS: JSON object of valid API keys and their permissions
 * - BACKEND_URL: URL of backend service to proxy to
 * - KV_NAMESPACE: KV binding for session/token storage
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Request-ID',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check (no auth required)
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'healthy', service: 'auth-proxy' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Token validation endpoint
    if (path === '/auth/validate' && request.method === 'POST') {
      return await handleValidate(request, env, corsHeaders);
    }

    // Token refresh endpoint
    if (path === '/auth/refresh' && request.method === 'POST') {
      return await handleRefresh(request, env, corsHeaders);
    }

    // API key info endpoint
    if (path === '/auth/key-info' && request.method === 'GET') {
      return await handleKeyInfo(request, env, corsHeaders);
    }

    // Proxy all other requests with authentication
    return await handleProxy(request, env, corsHeaders);
  },
};

// Base64URL decode
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// Verify JWT token
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Decode payload
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token expired' };
    }

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureData = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);

    const valid = await crypto.subtle.verify('HMAC', key, signatureData, dataToVerify);

    if (!valid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Verify API key
function verifyAPIKey(apiKey, apiKeysJson) {
  try {
    const apiKeys = JSON.parse(apiKeysJson || '{}');
    
    if (apiKeys[apiKey]) {
      return {
        valid: true,
        permissions: apiKeys[apiKey].permissions || ['read'],
        name: apiKeys[apiKey].name || 'unknown',
        rateLimit: apiKeys[apiKey].rateLimit || 1000,
      };
    }
    
    return { valid: false, error: 'Invalid API key' };
  } catch {
    return { valid: false, error: 'API key validation error' };
  }
}

async function handleValidate(request, env, corsHeaders) {
  const json = await request.json();
  const { token, type } = json;

  if (!token) {
    return new Response(JSON.stringify({ valid: false, error: 'Missing token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let result;
  if (type === 'api_key') {
    result = verifyAPIKey(token, env.API_KEYS);
  } else {
    result = await verifyJWT(token, env.JWT_SECRET);
  }

  return new Response(JSON.stringify(result), {
    status: result.valid ? 200 : 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRefresh(request, env, corsHeaders) {
  const json = await request.json();
  const { refreshToken } = json;

  if (!refreshToken) {
    return new Response(JSON.stringify({ error: 'Missing refresh token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify refresh token
  const result = await verifyJWT(refreshToken, env.JWT_SECRET);
  if (!result.valid) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check if refresh token is in blacklist
  const blacklisted = await env.KV_NAMESPACE?.get(`blacklist:${refreshToken}`);
  if (blacklisted) {
    return new Response(JSON.stringify({ error: 'Token has been revoked' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate new tokens (simplified - in production, sign properly)
  const now = Math.floor(Date.now() / 1000);
  const newPayload = {
    ...result.payload,
    iat: now,
    exp: now + 3600, // 1 hour
  };

  return new Response(JSON.stringify({
    message: 'Token refresh should be handled by main auth service',
    payload: newPayload,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleKeyInfo(request, env, corsHeaders) {
  const apiKey = request.headers.get('X-API-Key');
  
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing API key' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const result = verifyAPIKey(apiKey, env.API_KEYS);
  
  if (!result.valid) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    name: result.name,
    permissions: result.permissions,
    rateLimit: result.rateLimit,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleProxy(request, env, corsHeaders) {
  // Extract auth credentials
  const authHeader = request.headers.get('Authorization');
  const apiKey = request.headers.get('X-API-Key');

  let authResult = { valid: false, error: 'No authentication provided' };
  let authType = 'none';

  // Try JWT first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    authResult = await verifyJWT(token, env.JWT_SECRET);
    authType = 'jwt';
  }
  // Then try API key
  else if (apiKey) {
    authResult = verifyAPIKey(apiKey, env.API_KEYS);
    authType = 'api_key';
  }

  if (!authResult.valid) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      detail: authResult.error,
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check permissions for the requested path
  const url = new URL(request.url);
  const requiredPermission = getRequiredPermission(url.pathname, request.method);
  
  if (authType === 'api_key' && !authResult.permissions.includes(requiredPermission) && !authResult.permissions.includes('admin')) {
    return new Response(JSON.stringify({
      error: 'Forbidden',
      detail: `Missing required permission: ${requiredPermission}`,
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Forward request to backend
  if (!env.BACKEND_URL) {
    return new Response(JSON.stringify({ error: 'Backend URL not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const backendUrl = new URL(url.pathname + url.search, env.BACKEND_URL);
  
  // Create new headers, forwarding auth info
  const headers = new Headers(request.headers);
  headers.set('X-Auth-Type', authType);
  headers.set('X-Auth-Valid', 'true');
  
  if (authType === 'jwt' && authResult.payload) {
    headers.set('X-User-ID', authResult.payload.sub || '');
    headers.set('X-User-Role', authResult.payload.role || 'user');
  }
  
  if (authType === 'api_key') {
    headers.set('X-API-Key-Name', authResult.name);
    headers.set('X-API-Key-Permissions', authResult.permissions.join(','));
  }

  // Forward request
  const backendRequest = new Request(backendUrl, {
    method: request.method,
    headers,
    body: request.body,
  });

  try {
    const response = await fetch(backendRequest);
    
    // Add CORS headers to response
    const responseHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      responseHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Backend unavailable', detail: error.message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

function getRequiredPermission(path, method) {
  // Map paths to required permissions
  const writeOps = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/api/evidence')) return writeOps.includes(method) ? 'evidence:write' : 'evidence:read';
  if (path.startsWith('/api/documents')) return writeOps.includes(method) ? 'documents:write' : 'documents:read';
  if (path.startsWith('/api/analysis')) return 'analysis';
  
  return writeOps.includes(method) ? 'write' : 'read';
}
