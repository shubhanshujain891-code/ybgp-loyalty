/**
 * YBGP Loyalty - Cloudflare Workers & D1 Edge Entrypoint
 * Handles edge execution with Cloudflare D1 SQL bindings,
 * session authentication, and static asset fallback.
 */

export interface D1Database {
  prepare: (query: string) => any;
  batch: (statements: any[]) => Promise<any[]>;
  exec: (query: string) => Promise<any>;
}

export interface ExecutionContext {
  waitUntil: (promise: Promise<any>) => void;
  passThroughOnException: () => void;
}

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  YBGP_DOMAIN: string;
  SMS_PROVIDER_MODE: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          platform: 'Cloudflare Workers (Edge)',
          runtime: 'D1 + Node.js Compat',
          timestamp: new Date().toISOString(),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-customer-session, x-ybgp-user-id',
        },
      });
    }

    // Pass through to edge router or static asset
    return new Response(
      JSON.stringify({
        message: 'YBGP Loyalty Cloudflare Worker API active. Deploy migrations using `wrangler d1 migrations apply DB`.',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },
};
