/**
 * R2 Storage Worker - File operations for Cloudflare R2
 * 
 * Endpoints:
 * - POST /upload - Upload file to R2
 * - GET /download/:key - Download file from R2
 * - GET /list - List files in bucket
 * - DELETE /delete/:key - Delete file from R2
 * - GET /presign/:key - Generate presigned URL
 * 
 * Environment Variables (set in wrangler.toml):
 * - R2_BUCKET: R2 bucket binding
 * - API_KEY: Authentication key
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    };

    // Handle CORS preflight
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
      // Route requests
      if (path === '/upload' && request.method === 'POST') {
        return await handleUpload(request, env, corsHeaders);
      }
      
      if (path.startsWith('/download/') && request.method === 'GET') {
        const key = decodeURIComponent(path.replace('/download/', ''));
        return await handleDownload(key, env, corsHeaders);
      }
      
      if (path === '/list' && request.method === 'GET') {
        const prefix = url.searchParams.get('prefix') || '';
        const limit = parseInt(url.searchParams.get('limit') || '100');
        return await handleList(prefix, limit, env, corsHeaders);
      }
      
      if (path.startsWith('/delete/') && request.method === 'DELETE') {
        const key = decodeURIComponent(path.replace('/delete/', ''));
        return await handleDelete(key, env, corsHeaders);
      }
      
      if (path.startsWith('/presign/') && request.method === 'GET') {
        const key = decodeURIComponent(path.replace('/presign/', ''));
        const expiresIn = parseInt(url.searchParams.get('expires') || '3600');
        return await handlePresign(key, expiresIn, env, corsHeaders);
      }
      
      if (path === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({ status: 'healthy', service: 'r2-storage' }), {
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

async function handleUpload(request, env, corsHeaders) {
  const contentType = request.headers.get('Content-Type') || '';
  
  let key, body, metadata = {};
  
  if (contentType.includes('multipart/form-data')) {
    // Handle multipart form upload
    const formData = await request.formData();
    const file = formData.get('file');
    key = formData.get('key') || file.name;
    body = file;
    
    // Extract metadata from form
    for (const [k, v] of formData.entries()) {
      if (k !== 'file' && k !== 'key') {
        metadata[k] = v;
      }
    }
  } else {
    // Handle raw body upload
    const url = new URL(request.url);
    key = url.searchParams.get('key');
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing key parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    body = request.body;
    metadata = JSON.parse(url.searchParams.get('metadata') || '{}');
  }

  // Add timestamp to metadata
  metadata.uploadedAt = new Date().toISOString();
  metadata.contentType = contentType;

  // Upload to R2
  await env.R2_BUCKET.put(key, body, {
    customMetadata: metadata,
    httpMetadata: {
      contentType: contentType.split(';')[0] || 'application/octet-stream',
    },
  });

  return new Response(JSON.stringify({
    success: true,
    key,
    url: `https://${env.R2_PUBLIC_URL || 'r2.mitechconsult.com'}/${key}`,
    metadata,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDownload(key, env, corsHeaders) {
  const object = await env.R2_BUCKET.get(key);
  
  if (!object) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Length', object.size);
  headers.set('ETag', object.etag);
  
  if (object.customMetadata) {
    headers.set('X-Custom-Metadata', JSON.stringify(object.customMetadata));
  }

  return new Response(object.body, { headers });
}

async function handleList(prefix, limit, env, corsHeaders) {
  const listed = await env.R2_BUCKET.list({
    prefix,
    limit,
  });

  const files = listed.objects.map(obj => ({
    key: obj.key,
    size: obj.size,
    etag: obj.etag,
    uploaded: obj.uploaded,
    metadata: obj.customMetadata,
  }));

  return new Response(JSON.stringify({
    files,
    truncated: listed.truncated,
    cursor: listed.cursor,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDelete(key, env, corsHeaders) {
  await env.R2_BUCKET.delete(key);
  
  return new Response(JSON.stringify({
    success: true,
    deleted: key,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handlePresign(key, expiresIn, env, corsHeaders) {
  // R2 doesn't support presigned URLs directly from Workers
  // Return a signed URL using the public bucket URL
  const url = `https://${env.R2_PUBLIC_URL || 'r2.mitechconsult.com'}/${key}`;
  
  return new Response(JSON.stringify({
    url,
    key,
    expiresIn,
    note: 'R2 public bucket URL - configure bucket for public access or use signed URLs via S3 API',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
