export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS Preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // API Key Authentication
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Health Check
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    // Cache API Endpoints
    if (url.pathname.startsWith('/cache')) {
      switch (request.method) {
        case 'POST':
          if (url.pathname === '/cache/set') {
            return handleSet(request, env);
          } else if (url.pathname === '/cache/llm') {
            return handleLlmCache(request, env);
          }
          break;
        case 'GET':
          if (url.pathname.startsWith('/cache/get/')) {
            const key = url.pathname.substring('/cache/get/'.length);
            return handleGet(request, env, key);
          }
          break;
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function handleOptions(request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };
  return new Response(null, { headers });
}

function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  return response;
}

async function handleSet(request, env) {
  try {
    const { key, value, expirationTtl } = await request.json();
    if (!key || value === undefined) {
      return addCorsHeaders(new Response('Missing key or value', { status: 400 }));
    }

    const options = {};
    if (expirationTtl) {
      options.expirationTtl = expirationTtl;
    }

    await env.KV_NAMESPACE.put(key, JSON.stringify(value), options);
    return addCorsHeaders(new Response('OK', { status: 200 }));
  } catch (error) {
    return addCorsHeaders(new Response(`Error setting cache: ${error.message}`, { status: 500 }));
  }
}

async function handleGet(request, env, key) {
  try {
    const value = await env.KV_NAMESPACE.get(key);
    if (value === null) {
      await incrementMetric(env, 'cache_misses');
      return addCorsHeaders(new Response('Not Found', { status: 404 }));
    }
    await incrementMetric(env, 'cache_hits');
    return addCorsHeaders(new Response(value, { status: 200, headers: { 'Content-Type': 'application/json' } }));
  } catch (error) {
    return addCorsHeaders(new Response(`Error getting cache: ${error.message}`, { status: 500 }));
  }
}

async function handleLlmCache(request, env) {
  try {
    const { prompt, model, response, expirationTtl } = await request.json();
    if (!prompt || !model || response === undefined) {
      return addCorsHeaders(new Response('Missing prompt, model, or response', { status: 400 }));
    }

    const cacheKey = await generateLlmCacheKey(prompt, model);

    const existingResponse = await env.KV_NAMESPACE.get(cacheKey);
    if (existingResponse !== null) {
      await incrementMetric(env, 'llm_cache_hits');
      return addCorsHeaders(new Response(existingResponse, { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }

    const options = {};
    if (expirationTtl) {
      options.expirationTtl = expirationTtl;
    }

    await env.KV_NAMESPACE.put(cacheKey, JSON.stringify(response), options);
    await incrementMetric(env, 'llm_cache_misses');
    return addCorsHeaders(new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  } catch (error) {
    return addCorsHeaders(new Response(`Error handling LLM cache: ${error.message}`, { status: 500 }));
  }
}

async function generateLlmCacheKey(prompt, model) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${prompt}-${model}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hexHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `llm:${hexHash}`;
}

async function incrementMetric(env, metricName) {
  // In a real-world scenario, you'd use a more robust metrics solution
  // like Cloudflare Analytics Engine or another external service.
  // For this example, we'll just log it or you could store a simple counter in KV.
  // For simplicity, we'll just log here.
  console.log(`Metric: ${metricName} incremented.`);

  // Example of storing a simple counter in KV (less efficient for high volume)
  // let count = await env.KV_NAMESPACE.get(metricName);
  // count = count ? parseInt(count) + 1 : 1;
  // await env.KV_NAMESPACE.put(metricName, count.toString());
}