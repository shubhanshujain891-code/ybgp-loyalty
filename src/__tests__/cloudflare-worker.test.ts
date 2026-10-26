/**
 * YBGP Loyalty - Cloudflare Worker & D1 Edge Runtime Test Suite
 * Tests serverless edge execution, D1 SQL bindings, session management,
 * security headers, and webhook verification at the edge.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import worker, { Env, D1Database } from '../../worker/index';
import { ServerDatabase } from '../../server/db';
import { generateSalt, hashPassword } from '../../server/security';

/**
 * In-memory D1 Adapter backed by SQLite DatabaseSync for edge testing
 */
function createMockD1Database(nodeDb: ServerDatabase): D1Database {
  return {
    prepare(query: string) {
      let boundParams: any[] = [];
      return {
        bind(...values: any[]) {
          boundParams = values;
          return this;
        },
        async first<T = any>() {
          const row = nodeDb.queryOne(query, boundParams);
          return (row as T) || null;
        },
        async all<T = any>() {
          const rows = nodeDb.query(query, boundParams);
          return { results: rows as T[], success: true };
        },
        async run() {
          const res = nodeDb.execute(query, boundParams);
          return { success: true, meta: { changes: Number(res.changes) } };
        },
      };
    },
    async batch(statements: any[]) {
      return Promise.all(statements.map((s) => s.run()));
    },
    async exec(query: string) {
      return nodeDb.execute(query);
    },
  };
}

describe('Cloudflare Worker & D1 Edge API Parity Suite', () => {
  let nodeDb: ServerDatabase;
  let mockD1: D1Database;
  let testEnv: Env;
  const dummyCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  };

  beforeEach(() => {
    nodeDb = new ServerDatabase(':memory:');
    mockD1 = createMockD1Database(nodeDb);

    testEnv = {
      DB: mockD1,
      ENVIRONMENT: 'production',
      YBGP_DOMAIN: 'https://ybgp.in',
      PAYMENT_WEBHOOK_SECRET: 'edge_test_secret_123',
      RAZORPAY_WEBHOOK_SECRET: 'edge_test_secret_123',
      BOOTSTRAP_ADMIN_SECRET: 'EdgeBootstrapSecret2026!',
    };
  });

  it('1. Returns 200 and healthy D1 status on /health endpoint', async () => {
    const req = new Request('https://ybgp.in/health');
    const res = await worker.fetch(req, testEnv, dummyCtx);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.platform).toContain('Cloudflare');
    expect(data.database).toBe('healthy');
  });

  it('2. Emits security headers and CORS on OPTIONS preflight', async () => {
    const req = new Request('https://ybgp.in/api/v1/auth/login', { method: 'OPTIONS' });
    const res = await worker.fetch(req, testEnv, dummyCtx);

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('3. Edge Admin Bootstrap: enforces enterprise password complexity', async () => {
    const req = new Request('https://ybgp.in/api/v1/auth/bootstrap-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bootstrapSecret: 'EdgeBootstrapSecret2026!',
        name: 'Edge Admin',
        email: 'edgeadmin@ybgp.in',
        password: 'weak',
      }),
    });

    const res = await worker.fetch(req, testEnv, dummyCtx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Password complexity');
  });

  it('4. Edge Login: rejects missing credentials and invalid passwords', async () => {
    const req1 = new Request('https://ybgp.in/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vikram@chaico.in' }), // Missing password
    });
    const res1 = await worker.fetch(req1, testEnv, dummyCtx);
    expect(res1.status).toBe(400);

    const req2 = new Request('https://ybgp.in/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vikram@chaico.in', password: 'WrongPassword!' }),
    });
    const res2 = await worker.fetch(req2, testEnv, dummyCtx);
    expect(res2.status).toBe(401);
  });

  it('5. Edge Public Business: serves tenant data and links without leaking secrets', async () => {
    const req = new Request('https://ybgp.in/api/v1/public/business/chai-co');
    const res = await worker.fetch(req, testEnv, dummyCtx);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.business.name).toContain('Chai & Co');
    expect(data.links.length).toBeGreaterThan(0);
    expect(data.business.password_hash).toBeUndefined();
  });

  it('6. Edge OTP Request: fails closed with 503 when running in production without SMS gateway', async () => {
    // testEnv has ENVIRONMENT='production' and no SMS credentials
    const req = new Request('https://ybgp.in/api/v1/public/loyalty/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+919876543210',
        businessId: 'biz_chaico',
      }),
    });

    const res = await worker.fetch(req, testEnv, dummyCtx);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain('SMS service is temporarily unconfigured');
  });

  it('7. Edge Webhook: verifies Razorpay raw HMAC signature and upgrades plan', async () => {
    const payload = JSON.stringify({
      event: 'payment.captured',
      id: 'rzp_edge_tx_001',
      payload: {
        payment: {
          entity: {
            id: 'pay_edge_111',
            notes: {
              businessId: 'biz_chaico',
              planId: 'plan_pro',
            },
          },
        },
      },
    });

    const signature = crypto.createHmac('sha256', 'edge_test_secret_123').update(payload).digest('hex');

    const req = new Request('https://ybgp.in/api/v1/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature,
      },
      body: payload,
    });

    const res = await worker.fetch(req, testEnv, dummyCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify database was updated by the worker
    const sub = nodeDb.queryOne<{ plan_id: string }>('SELECT plan_id FROM subscriptions WHERE business_id = ?;', ['biz_chaico']);
    expect(sub?.plan_id).toBe('plan_pro');
  });
});
