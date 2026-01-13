export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS Preflight
    if (method === 'OPTIONS') {
      return handleOptions(request);
    }

    // API Key Authentication
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders() });
    }

    // Health Check
    if (path === '/health') {
      return new Response('OK', { status: 200, headers: corsHeaders() });
    }

    // POST /webhook/:source - Receive and store webhook
    if (method === 'POST' && path.startsWith('/webhook/')) {
      const source = path.split('/')[2];
      if (!source) {
        return new Response('Missing source in path', { status: 400, headers: corsHeaders() });
      }

      try {
        const webhookData = await request.json();
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        const webhookRecord = {
          id,
          source,
          timestamp,
          data: webhookData,
          status: 'received', // 'received', 'processing', 'sent', 'failed'
          retries: 0,
          lastAttempt: null,
          backendResponse: null,
        };

        await env.KV_NAMESPACE.put(`webhook:${id}`, JSON.stringify(webhookRecord));

        // Asynchronously forward to backend (fire and forget for initial receipt)
        // In a real-world scenario, you might use a queue service or Durable Objects
        // to ensure delivery and handle retries more robustly.
        // For this example, we'll just log and update status later.
        env.KV_NAMESPACE.put(`webhook:${id}`, JSON.stringify({ ...webhookRecord, status: 'processing' }))
          .then(() => forwardWebhookToBackend(webhookRecord, env))
          .catch(error => console.error(`Error forwarding webhook ${id}:`, error));


        return new Response(JSON.stringify({ id, message: 'Webhook received and queued' }), {
          status: 202,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(`Invalid JSON or internal error: ${error.message}`, { status: 400, headers: corsHeaders() });
      }
    }

    // GET /webhooks - List all webhooks (for debugging/admin)
    if (method === 'GET' && path === '/webhooks') {
      const { keys } = await env.KV_NAMESPACE.list({ prefix: 'webhook:' });
      const webhooks = await Promise.all(keys.map(async (key) => {
        const value = await env.KV_NAMESPACE.get(key.name);
        return value ? JSON.parse(value) : null;
      }));
      return new Response(JSON.stringify(webhooks.filter(Boolean)), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // POST /webhook/:id/retry - Manually retry a webhook
    if (method === 'POST' && path.match(/^\/webhook\/[^/]+\/retry$/)) {
      const id = path.split('/')[2];
      if (!id) {
        return new Response('Missing webhook ID', { status: 400, headers: corsHeaders() });
      }

      const webhookRecordStr = await env.KV_NAMESPACE.get(`webhook:${id}`);
      if (!webhookRecordStr) {
        return new Response('Webhook not found', { status: 404, headers: corsHeaders() });
      }

      let webhookRecord = JSON.parse(webhookRecordStr);
      webhookRecord.status = 'retrying';
      webhookRecord.retries = (webhookRecord.retries || 0) + 1;
      webhookRecord.lastAttempt = new Date().toISOString();

      await env.KV_NAMESPACE.put(`webhook:${id}`, JSON.stringify(webhookRecord));

      // Attempt to forward again
      env.KV_NAMESPACE.put(`webhook:${id}`, JSON.stringify({ ...webhookRecord, status: 'processing' }))
        .then(() => forwardWebhookToBackend(webhookRecord, env))
        .catch(error => console.error(`Error retrying webhook ${id}:`, error));

      return new Response(JSON.stringify({ id, message: 'Webhook retry initiated' }), {
        status: 202,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // Not Found
    return new Response('Not Found', { status: 404, headers: corsHeaders() });
  },
};

const corsHeaders = (origin = '*') => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Max-Age': '86400',
});

function handleOptions(request) {
  const headers = request.headers;
  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null &&
    headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS preflight request.
    return new Response(null, {
      headers: corsHeaders(headers.get('Origin')),
    });
  } else {
    // Handle standard OPTIONS request.
    return new Response(null, {
      headers: {
        Allow: 'GET, HEAD, POST, OPTIONS',
      },
    });
  }
}

async function forwardWebhookToBackend(webhookRecord, env) {
  try {
    // Replace with your actual backend endpoint
    const backendUrl = env.BACKEND_WEBHOOK_URL;
    if (!backendUrl) {
      console.error('BACKEND_WEBHOOK_URL is not defined in environment variables.');
      await updateWebhookStatus(webhookRecord.id, 'failed', 'Backend URL not configured', env);
      return;
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any necessary backend authentication headers here
        // 'Authorization': `Bearer ${env.BACKEND_API_TOKEN}`,
        'X-Webhook-Source': webhookRecord.source,
        'X-Webhook-ID': webhookRecord.id,
      },
      body: JSON.stringify(webhookRecord.data),
    });

    const backendResponseText = await response.text();
    const backendResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: backendResponseText,
    };

    if (response.ok) {
      await updateWebhookStatus(webhookRecord.id, 'sent', backendResponse, env);
    } else {
      await updateWebhookStatus(webhookRecord.id, 'failed', backendResponse, env);
      console.error(`Failed to forward webhook ${webhookRecord.id} to backend: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error forwarding webhook ${webhookRecord.id}:`, error);
    await updateWebhookStatus(webhookRecord.id, 'failed', { error: error.message }, env);
  }
}

async function updateWebhookStatus(id, status, backendResponse, env) {
  const webhookRecordStr = await env.KV_NAMESPACE.get(`webhook:${id}`);
  if (webhookRecordStr) {
    let webhookRecord = JSON.parse(webhookRecordStr);
    webhookRecord.status = status;
    webhookRecord.lastAttempt = new Date().toISOString();
    webhookRecord.backendResponse = backendResponse;
    await env.KV_NAMESPACE.put(`webhook:${id}`, JSON.stringify(webhookRecord));
  }
}