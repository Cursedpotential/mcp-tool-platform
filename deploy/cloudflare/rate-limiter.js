import { Router } from 'itty-router';

const router = Router();

const FREE_TIER_LIMIT = 100;
const PRO_TIER_LIMIT = 1000;
const WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour

const getRateLimit = (tier) => {
  switch (tier) {
    case 'pro':
      return PRO_TIER_LIMIT;
    case 'free':
    default:
      return FREE_TIER_LIMIT;
  }
};

const getTierFromApiKey = (apiKey) => {
  // In a real application, you'd validate the API key against a database
  // and retrieve the associated tier. For this example, we'll use a simple check.
  if (apiKey && apiKey.startsWith('pro_')) {
    return 'pro';
  }
  return 'free';
};

const getCorsHeaders = (request) => {
  const origin = request.headers.get('Origin');
  if (origin) {
    // You might want to restrict this to specific origins in production
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400',
    };
  }
  return {};
};

const handleOptions = (request) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
};

router.options('*', handleOptions);

router.get('/health', () => {
  return new Response('OK', { status: 200 });
});

router.post('/check', async (request, env) => {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) {
    return new Response('Unauthorized: X-API-Key header missing', { status: 401, headers: getCorsHeaders(request) });
  }

  const tier = getTierFromApiKey(apiKey);
  const limit = getRateLimit(tier);
  const now = Date.now();
  const windowStart = now - WINDOW_DURATION_MS;

  const key = `rate_limit:${apiKey}`;
  let records = await env.KV_NAMESPACE.get(key, { type: 'json' });

  if (!records) {
    records = [];
  }

  // Filter out requests outside the current window
  records = records.filter(timestamp => timestamp > windowStart);

  const remaining = limit - records.length;
  const resetTime = windowStart + WINDOW_DURATION_MS; // When the current window ends

  const headers = {
    ...getCorsHeaders(request),
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': Math.max(0, remaining - 1).toString(), // Subtract 1 for the current request
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(), // Unix timestamp in seconds
  };

  if (remaining <= 0) {
    return new Response('Too Many Requests', { status: 429, headers });
  }

  records.push(now);
  // Store the updated records, setting an expiration for the KV entry
  // The expiration should be slightly longer than the window duration
  await env.KV_NAMESPACE.put(key, JSON.stringify(records), { expirationTtl: Math.ceil(WINDOW_DURATION_MS / 1000) + 60 });

  return new Response('OK', { status: 200, headers });
});

router.get('/status/:id', async (request, env) => {
  const apiKey = request.params.id; // Using :id as the API key for status lookup
  if (!apiKey) {
    return new Response('Bad Request: API Key missing in path', { status: 400, headers: getCorsHeaders(request) });
  }

  const tier = getTierFromApiKey(apiKey);
  const limit = getRateLimit(tier);
  const now = Date.now();
  const windowStart = now - WINDOW_DURATION_MS;

  const key = `rate_limit:${apiKey}`;
  let records = await env.KV_NAMESPACE.get(key, { type: 'json' });

  if (!records) {
    records = [];
  }

  records = records.filter(timestamp => timestamp > windowStart);

  const remaining = limit - records.length;
  const resetTime = windowStart + WINDOW_DURATION_MS;

  const headers = {
    ...getCorsHeaders(request),
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
  };

  return new Response(JSON.stringify({
    limit,
    remaining,
    reset: Math.ceil(resetTime / 1000),
    tier,
  }), {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
});

router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  },
};