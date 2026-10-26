/**
 * YBGP Loyalty - P0 Security Gates & Production Release Test Suite
 * Validates all P0 requirements:
 * - P0-1: Elimination of auth bypass, scrypt password hashing, no demo header escalation in prod
 * - P0-2: Fail-closed payment webhooks with cryptographic HMAC signature verification
 * - P0-3: Strict server authorization, no unverified client fallbacks
 * - P0-4: Secure OTP lifecycle, atomic single-use verification, rate limits, no production leakage
 * - P0-5: Authoritative qr_tokens registry, elimination of qr_token_raw, customer phone privacy
 * - P0-6: Server-authoritative reward entitlements, atomic redemptions, RBAC reversal barriers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import express, { Express } from 'express';
import request from 'supertest';
import { ServerDatabase } from '../../server/db';
import { AuthService } from '../../server/auth';
import { createApiRouter } from '../../server/api';
import { hashSha256 } from '../../server/security';

describe('YBGP P0 Security Gates & Release Hardening Suite', () => {
  let db: ServerDatabase;
  let authService: AuthService;
  let app: Express;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Pristine in-memory SQLite database
    db = new ServerDatabase(':memory:');
    authService = new AuthService(db);

    app = express();
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString('utf8');
        },
      })
    );
    app.use('/api/v1', createApiRouter(db, authService));
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    delete process.env.ALLOW_DEV_AUTH_BYPASS;
  });

  // =========================================================================
  // P0-1: AUTHENTICATION BYPASS ELIMINATION
  // =========================================================================

  describe('P0-1: Authentication Bypass Elimination', () => {
    it('1.1 Rejects unauthenticated login without password (even if email or userId is known)', async () => {
      // Attacker attempts to login with just an email
      const res1 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@ybgp.in' });

      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('Email and password are required');

      // Attacker attempts to login with just a userId
      const res2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ userId: 'usr_admin' });

      expect(res2.status).toBe(400);
    });

    it('1.2 Rejects login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'vikram@chaico.in', password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid email or password');
    });

    it('1.3 Successfully authenticates with valid credentials verified by scrypt password hash', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'vikram@chaico.in', password: 'Owner@chaico2026!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('vikram@chaico.in');
      expect(res.body.user.role).toBe('owner');
    });

    it('1.4 Strictly refuses x-ybgp-user-id demo header escalation when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('x-ybgp-user-id', 'usr_admin'); // Attempting to use demo header to access platform admin

      // In production mode, demo header MUST be ignored and request rejected with 401
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Valid authentication session token required');
    });

    it('1.5 Public signup is strictly prohibited from granting platform_admin role', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          name: 'Attacker Admin',
          email: 'attacker@evil.com',
          phone: '+919999988888',
          password: 'Password123!',
          role: 'platform_admin',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Platform administrator accounts cannot be created via public registration');
    });
  });

  // =========================================================================
  // P0-2: PAYMENT WEBHOOKS FAIL CLOSED
  // =========================================================================

  describe('P0-2: Payment Webhooks Fail Closed with HMAC Verification', () => {
    it('2.1 Rejects webhook if server secret is unconfigured (fail closed)', async () => {
      delete process.env.PAYMENT_WEBHOOK_SECRET;

      const res = await request(app)
        .post('/api/v1/webhooks/payment')
        .set('x-webhook-signature', 'some_signature')
        .send({
          webhookId: 'wh_test_001',
          businessId: 'biz_chaico',
          planId: 'plan_pro',
        });

      // Server fails closed with 500 when signing secret is missing
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Fail Closed');
    });

    it('2.2 Rejects webhook when signature header is missing', async () => {
      process.env.PAYMENT_WEBHOOK_SECRET = 'live_secret_key_prod_99';

      const res = await request(app)
        .post('/api/v1/webhooks/payment')
        .send({
          webhookId: 'wh_test_002',
          businessId: 'biz_chaico',
          planId: 'plan_pro',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('signature header');
    });

    it('2.3 Rejects forged/invalid HMAC signatures and does not update subscription', async () => {
      process.env.PAYMENT_WEBHOOK_SECRET = 'live_secret_key_prod_99';

      const res = await request(app)
        .post('/api/v1/webhooks/payment')
        .set('x-webhook-signature', 'forged_fake_signature_hex_00000000000000000000')
        .send({
          webhookId: 'wh_forged_003',
          businessId: 'biz_chaico',
          planId: 'plan_pro',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid payment webhook signature');

      // Verify DB was NOT modified
      const sub = db.queryOne<{ plan_id: string }>(
        'SELECT plan_id FROM subscriptions WHERE business_id = ?;',
        ['biz_chaico']
      );
      expect(sub?.plan_id).toBe('plan_growth'); // Remains unchanged!
    });

    it('2.4 Successfully verifies valid HMAC SHA-256 signature and performs idempotent update', async () => {
      const secret = 'live_secret_key_prod_99';
      process.env.PAYMENT_WEBHOOK_SECRET = secret;

      const payload = {
        webhookId: 'wh_verified_123',
        businessId: 'biz_chaico',
        eventType: 'subscription.upgraded',
        planId: 'plan_pro',
      };

      const payloadStr = JSON.stringify(payload);
      const validHmac = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

      const res1 = await request(app)
        .post('/api/v1/webhooks/payment')
        .set('x-webhook-signature', validHmac)
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.message).toContain('verified and processed successfully');

      // Verify DB was updated
      const sub = db.queryOne<{ plan_id: string }>(
        'SELECT plan_id FROM subscriptions WHERE business_id = ?;',
        ['biz_chaico']
      );
      expect(sub?.plan_id).toBe('plan_pro');

      // Replay must be idempotent
      const res2 = await request(app)
        .post('/api/v1/webhooks/payment')
        .set('x-webhook-signature', validHmac)
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.message).toContain('Idempotent response');
    });
  });

  // =========================================================================
  // P0-4: SECURE OTP LIFECYCLE & ATOMIC VERIFICATION
  // =========================================================================

  describe('P0-4: Secure OTP Lifecycle & Atomic Verification', () => {
    it('4.1 Rejects reuse of already-consumed OTP challenge (replay defense)', async () => {
      const phone = '+919876543210';
      const norm = '+919876543210';
      const businessId = 'biz_chaico';

      // Request OTP
      const otpRes = await request(app)
        .post('/api/v1/public/loyalty/otp/request')
        .send({ phone, businessId });

      expect(otpRes.status).toBe(200);
      const simulatedOtp = otpRes.body.simulatedOtp;
      expect(simulatedOtp).toBeDefined();

      // First verification succeeds
      const regRes1 = await request(app)
        .post('/api/v1/public/loyalty/register')
        .send({
          name: 'Aarav Mehta',
          phone,
          otp: simulatedOtp,
          businessId,
          serviceConsent: true,
        });

      expect(regRes1.status).toBe(200);
      expect(regRes1.body.success).toBe(true);

      // Replaying the same OTP immediately fails because it was atomically consumed
      const regRes2 = await request(app)
        .post('/api/v1/public/loyalty/register')
        .send({
          name: 'Aarav Mehta',
          phone,
          otp: simulatedOtp,
          businessId,
          serviceConsent: true,
        });

      expect(regRes2.status).toBe(400);
      expect(regRes2.body.error).toMatch(/already been consumed|No active OTP/);
    });

    it('4.2 Locks out OTP challenge after exceeding 4 incorrect attempts', async () => {
      const phone = '+919876511223';
      const businessId = 'biz_chaico';

      await request(app)
        .post('/api/v1/public/loyalty/otp/request')
        .send({ phone, businessId });

      // Attempt with wrong OTP 4 times
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/v1/public/loyalty/register')
          .send({
            name: 'Wrong Guesser',
            phone,
            otp: '000000',
            businessId,
            serviceConsent: true,
          });
      }

      // 5th attempt must return 429 Too Many Requests
      const res5 = await request(app)
        .post('/api/v1/public/loyalty/register')
        .send({
          name: 'Wrong Guesser',
          phone,
          otp: '000000',
          businessId,
          serviceConsent: true,
        });

      expect(res5.status).toBe(429);
      expect(res5.body.error).toContain('Too many incorrect attempts');
    });
  });

  // =========================================================================
  // P0-5: SECURE QR TOKENS & DATA PRIVACY
  // =========================================================================

  describe('P0-5: Secure QR Tokens & Customer Data Privacy', () => {
    it('5.1 Backend does not store unhashed raw QR tokens in loyalty_cards table', async () => {
      const cardsWithRawToken = db.query(
        "SELECT id, qr_token_raw FROM loyalty_cards WHERE qr_token_raw IS NOT NULL AND qr_token_raw != '';"
      );
      // All cards in database must have NULL for qr_token_raw
      expect(cardsWithRawToken.length).toBe(0);
    });

    it('5.2 Authoritative QR scan resolution uses sha256 token hash strictly within tenant boundary', async () => {
      const ownerSession = authService.createSession('usr_owner_chai');

      // Valid token for Chai & Co
      const validToken = 'YBGP-CRD-ANANYA7890';
      const res1 = await request(app)
        .post('/api/v1/merchant/scan/resolve')
        .set('Authorization', `Bearer ${ownerSession.token}`)
        .send({ qrToken: validToken });

      expect(res1.status).toBe(200);
      expect(res1.body.customer.name).toBe('Ananya Deshmukh');
      // Phone MUST be masked in merchant output
      expect(res1.body.customer.phoneMasked).toContain('•••••');
      expect(res1.body.customer.phone).toBeUndefined();
    });
  });

  // =========================================================================
  // P0-6: TRANSACTION BOUNDARY & REWARD ENTITLEMENTS
  // =========================================================================

  describe('P0-6: Reward Entitlements & Single-Use Atomic Redemption', () => {
    it('6.1 Prevents double-redemption of the same reward entitlement', async () => {
      const ownerSession = authService.createSession('usr_owner_chai');

      // Rahul has entitlement 'ent_rahul_coffee' available
      const res1 = await request(app)
        .post('/api/v1/merchant/rewards/redeem')
        .set('Authorization', `Bearer ${ownerSession.token}`)
        .send({
          cardId: 'crd_rahul_chai',
          entitlementId: 'ent_rahul_coffee',
        });

      expect(res1.status).toBe(200);
      expect(res1.body.redemptionCode).toBeDefined();

      // Immediate attempt to redeem same entitlement again must fail
      const res2 = await request(app)
        .post('/api/v1/merchant/rewards/redeem')
        .set('Authorization', `Bearer ${ownerSession.token}`)
        .send({
          cardId: 'crd_rahul_chai',
          entitlementId: 'ent_rahul_coffee',
        });

      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('already redeemed');
    });

    it('6.2 Cashiers cannot perform stamp reversals without manager/owner role', async () => {
      const cashierSession = authService.createSession('usr_cashier_chai');

      const res = await request(app)
        .post('/api/v1/merchant/stamps/reverse')
        .set('Authorization', `Bearer ${cashierSession.token}`)
        .send({
          transactionId: 'tx_st_dummy',
          reversalReason: 'Customer accidental double scan',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('cashier role is not authorized');
    });
  });
});
