export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Basic API health check
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Serve static assets from client/dist (SPA fallback handled by Cloudflare)
    return env.ASSETS.fetch(request);
  }
};
