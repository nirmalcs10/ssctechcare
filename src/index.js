// Cloudflare Worker Entry Point for SSC TechCare
import { ensureD1Schema } from './db/d1.js';
import { handleApiRequest, json, err } from './api/routes.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Standard CORS and Security headers helper
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Master-Token'
    };

    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };

    // Handle CORS preflight OPTIONS requests
    if (request.method.toUpperCase() === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders, ...securityHeaders } });
    }

    // 1. Intercept all /api/* requests
    if (url.pathname.startsWith('/api/')) {
      if (!env.DB) {
        return json(
          {
            error: "Cloudflare D1 binding 'DB' is missing. Please add the D1 database binding named 'DB' in Cloudflare Settings ➔ Bindings."
          },
          500,
          { ...corsHeaders, ...securityHeaders }
        );
      }

      try {
        // Auto-seed schema on first request if empty
        await ensureD1Schema(env.DB);

        // Execute API route
        const response = await handleApiRequest(request, env);

        // Append CORS & security headers to response
        const newHeaders = new Headers(response.headers);
        Object.entries({ ...corsHeaders, ...securityHeaders }).forEach(([k, v]) => newHeaders.set(k, v));

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } catch (apiErr) {
        console.error('API Handler Error:', apiErr);
        return json({ error: apiErr.message || 'Internal Server Error' }, 500, { ...corsHeaders, ...securityHeaders });
      }
    }

    // 2. Fall back to static assets for frontend (React Single Page App)
    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      const assetHeaders = new Headers(assetRes.headers);
      Object.entries(securityHeaders).forEach(([k, v]) => assetHeaders.set(k, v));
      return new Response(assetRes.body, {
        status: assetRes.status,
        statusText: assetRes.statusText,
        headers: assetHeaders
      });
    }

    return new Response('SSC TechCare Worker Active', { status: 200, headers: securityHeaders });
  }
};
