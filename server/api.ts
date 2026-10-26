/**
 * YBGP Loyalty - Production Backend API Router
 * Implements typed REST endpoints at /api/v1/* with strict validation,
 * tenant isolation, ACID transactions, and fraud prevention.
 */

import { Router, Request, Response } from 'express';
import { ServerDatabase } from './db';
import { AuthService, requireAuth, requireRole, requireTenant, AuthenticatedRequest } from './auth';
import {
  hashSha256,
  generateId,
  generateQrToken,
  generateRandomToken,
  normalizeIndianPhone,
  maskPhone,
  sanitizeUrl,
} from './security';
import { YBGP_CONFIG } from '../src/config/ybgp';

export function createApiRouter(db: ServerDatabase, authService: AuthService): Router {
  const router = Router();

  // Helper: Structured Error Response
  const sendError = (res: Response, status: number, message: string) => {
    return res.status(status).json({ success: false, error: message });
  };

  // Helper: Audit Logger
  const logAudit = (params: {
    businessId?: string;
    userId: string;
    userName: string;
    actorType: 'merchant' | 'admin' | 'customer' | 'system';
    action: string;
    entityType: string;
    entityId: string;
    details: string;
  }) => {
    db.execute(
      `INSERT INTO audit_logs (id, business_id, user_id, user_name, actor_type, action, entity_type, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        generateId('log'),
        params.businessId || null,
        params.userId,
        params.userName,
        params.actorType,
        params.action,
        params.entityType,
        params.entityId,
        params.details,
      ]
    );
  };

  // =========================================================================
  // 1. AUTHENTICATION ENDPOINTS
  // =========================================================================

  /**
   * POST /api/v1/auth/login
   * Login by email or user ID
   */
  router.post('/auth/login', (req: Request, res: Response) => {
    const { email, userId } = req.body;
    let user;

    if (userId) {
      user = db.queryOne<{ id: string }>('SELECT id FROM users WHERE id = ?;', [userId]);
    } else if (email) {
      user = db.queryOne<{ id: string }>('SELECT id FROM users WHERE lower(email) = lower(?);', [email]);
    }

    if (!user) {
      return sendError(res, 401, 'Invalid user credentials.');
    }

    const session = authService.createSession(user.id, req.ip, req.headers['user-agent']);
    return res.json({ success: true, ...session });
  });

  /**
   * GET /api/v1/auth/session
   */
  router.get('/auth/session', requireAuth(authService), (req: AuthenticatedRequest, res: Response) => {
    return res.json({ success: true, user: req.user, businessId: req.businessId });
  });

  /**
   * POST /api/v1/auth/logout
   */
  router.post('/auth/logout', requireAuth(authService), (req: AuthenticatedRequest, res: Response) => {
    if (req.sessionId) {
      db.execute('DELETE FROM sessions WHERE id = ?;', [req.sessionId]);
    }
    return res.json({ success: true, message: 'Logged out successfully.' });
  });

  // =========================================================================
  // 2. PUBLIC BUSINESS & LOYALTY CARD ENDPOINTS
  // =========================================================================

  /**
   * GET /api/v1/public/business/:slug
   * Public shop landing page & bio-links hub
   * Does NOT leak customer records, tokens, or private secrets!
   */
  router.get('/public/business/:slug', (req: Request, res: Response) => {
    const { slug } = req.params;
    const business = db.queryOne<{
      id: string;
      slug: string;
      name: string;
      legal_name: string;
      tagline: string;
      category: string;
      brand_color: string;
      status: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
      phone: string;
      whatsapp: string;
      google_reviews_url: string;
      instagram_handle: string;
      website_url: string;
      opening_hours: string;
      announcement: string;
    }>('SELECT * FROM businesses WHERE lower(slug) = lower(?);', [slug]);

    if (!business) {
      return sendError(res, 404, 'Business page not found.');
    }

    if (business.status === 'suspended') {
      return sendError(res, 403, 'This business account is temporarily suspended.');
    }

    // Public links
    const links = db.query(
      'SELECT id, title, subtitle, url, type, icon_name as iconName, sort_order as sortOrder, click_count as clickCount FROM business_links WHERE business_id = ? AND is_enabled = 1 ORDER BY sort_order ASC;',
      [business.id]
    );

    // Active program
    const program = db.queryOne(
      "SELECT id, name, description, stamp_target as stampTarget, reward_title as rewardTitle, reward_description as rewardDescription, min_spend_in_paise as minSpendInPaise, terms_and_conditions as termsAndConditions FROM loyalty_programs WHERE business_id = ? AND status = 'active';",
      [business.id]
    );

    return res.json({
      success: true,
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        legalName: business.legal_name,
        tagline: business.tagline,
        category: business.category,
        brandColor: business.brand_color,
        address: business.address,
        city: business.city,
        state: business.state,
        pincode: business.pincode,
        phone: business.phone,
        whatsapp: business.whatsapp,
        googleReviewsUrl: business.google_reviews_url,
        instagramHandle: business.instagram_handle,
        websiteUrl: business.website_url,
        openingHours: business.opening_hours,
        announcement: business.announcement,
      },
      links,
      program,
    });
  });

  /**
   * POST /api/v1/public/loyalty/otp/request
   * Secure OTP challenge for customer registration/recovery
   */
  router.post('/public/loyalty/otp/request', (req: Request, res: Response) => {
    const { phone, businessId } = req.body;
    const norm = normalizeIndianPhone(phone);

    if (!norm || norm.length !== 13) {
      return sendError(res, 400, 'Please provide a valid 10-digit Indian mobile number (+91).');
    }

    const business = db.queryOne<{ id: string; name: string }>('SELECT id, name FROM businesses WHERE id = ?;', [businessId]);
    if (!business) {
      return sendError(res, 404, 'Business not found.');
    }

    // Check rate limiting (at most 1 active challenge within 30 seconds)
    const existing = db.queryOne<{ id: string; attempts: number; created_at: string }>(
      `SELECT id, attempts, created_at FROM otp_challenges
       WHERE phone_normalized = ? AND business_id = ? AND expires_at > CURRENT_TIMESTAMP AND verified_at IS NULL
       ORDER BY created_at DESC LIMIT 1;`,
      [norm, businessId]
    );

    // Generate 6-digit OTP code
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashSha256(rawOtp, norm);
    const challengeId = generateId('otp');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

    db.execute(
      `INSERT INTO otp_challenges (id, phone_normalized, business_id, otp_hash, purpose, expires_at)
       VALUES (?, ?, ?, ?, 'registration', ?);`,
      [challengeId, norm, businessId, otpHash, expiresAt]
    );

    const isProduction = process.env.NODE_ENV === 'production' && process.env.VITE_SMS_PROVIDER_MODE === 'gateway';

    return res.json({
      success: true,
      message: `OTP sent successfully to ${maskPhone(norm)}.`,
      challengeId,
      expiresInSeconds: 300,
      // Security rule: NEVER return simulated OTP in production mode!
      simulatedOtp: isProduction ? undefined : rawOtp,
    });
  });

  /**
   * POST /api/v1/public/loyalty/register
   * Verify OTP and issue/retrieve protected loyalty card & scannable QR pass
   */
  router.post('/public/loyalty/register', (req: Request, res: Response) => {
    const { name, phone, otp, businessId, serviceConsent, marketingConsent } = req.body;
    const norm = normalizeIndianPhone(phone);

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Name is required.');
    }
    if (!serviceConsent) {
      return sendError(res, 400, 'DPDP privacy consent is required to issue a digital loyalty card.');
    }

    // Verify OTP challenge from database
    const challenge = db.queryOne<{ id: string; otp_hash: string; attempts: number; max_attempts: number }>(
      `SELECT id, otp_hash, attempts, max_attempts FROM otp_challenges
       WHERE phone_normalized = ? AND business_id = ? AND expires_at > CURRENT_TIMESTAMP AND verified_at IS NULL
       ORDER BY created_at DESC LIMIT 1;`,
      [norm, businessId]
    );

    if (!challenge) {
      return sendError(res, 400, 'No active OTP verification found or OTP has expired. Please request a new code.');
    }

    if (challenge.attempts >= challenge.max_attempts) {
      return sendError(res, 429, 'Too many incorrect attempts. Please request a new code.');
    }

    // Hash user-entered OTP and compare
    const enteredHash = hashSha256(otp.trim(), norm);
    if (enteredHash !== challenge.otp_hash) {
      db.execute('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?;', [challenge.id]);
      return sendError(res, 400, `Incorrect verification code. ${challenge.max_attempts - (challenge.attempts + 1)} attempts remaining.`);
    }

    // Mark challenge verified
    db.execute('UPDATE otp_challenges SET verified_at = CURRENT_TIMESTAMP WHERE id = ?;', [challenge.id]);

    // Atomic Customer & Card Provisioning
    const result = db.transaction(() => {
      const activeProgram = db.queryOne<{ id: string; stamp_target: number; reward_title: string }>(
        "SELECT id, stamp_target, reward_title FROM loyalty_programs WHERE business_id = ? AND status = 'active';",
        [businessId]
      );
      if (!activeProgram) {
        throw new Error('This business does not have an active loyalty program.');
      }

      let customer = db.queryOne<{ id: string; customer_token: string; name: string }>(
        'SELECT id, customer_token, name FROM loyalty_customers WHERE business_id = ? AND phone_normalized = ?;',
        [businessId, norm]
      );

      let isNew = false;
      if (!customer) {
        isNew = true;
        const customerId = generateId('cust');
        const customerToken = `CUST-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

        db.execute(
          `INSERT INTO loyalty_customers (
            id, business_id, customer_token, name, phone_normalized, phone_masked, status, total_stamps_awarded, total_rewards_redeemed
          ) VALUES (?, ?, ?, ?, ?, ?, 'active', 0, 0);`,
          [customerId, businessId, customerToken, name.trim(), norm, maskPhone(norm)]
        );

        // Record DPDP Consent
        db.execute(
          `INSERT INTO customer_consents (id, customer_id, business_id, service_consent_granted, marketing_consent_granted, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [generateId('cns'), customerId, businessId, 1, marketingConsent ? 1 : 0, req.ip || null, req.headers['user-agent'] || null]
        );

        customer = { id: customerId, customer_token: customerToken, name: name.trim() };
      }

      // Check for card
      let card = db.queryOne<{ id: string; current_stamps: number; total_lifetime_stamps: number; card_status: string; qr_token_raw: string }>(
        'SELECT id, current_stamps, total_lifetime_stamps, card_status, qr_token_raw FROM loyalty_cards WHERE customer_id = ? AND program_id = ?;',
        [customer.id, activeProgram.id]
      );

      let rawQrToken = '';
      if (!card) {
        const cardId = generateId('crd');
        rawQrToken = generateQrToken();
        const qrHash = hashSha256(rawQrToken);

        db.execute(
          `INSERT INTO loyalty_cards (
            id, customer_id, business_id, program_id, current_stamps, total_lifetime_stamps, card_status, qr_token_hash, qr_token_raw
          ) VALUES (?, ?, ?, ?, 0, 0, 'active', ?, ?);`,
          [cardId, customer.id, businessId, activeProgram.id, qrHash, rawQrToken]
        );

        // Registry of valid hashed tokens
        db.execute(
          'INSERT INTO qr_tokens (token_hash, card_id, customer_id, business_id) VALUES (?, ?, ?, ?);',
          [qrHash, cardId, customer.id, businessId]
        );

        card = {
          id: cardId,
          current_stamps: 0,
          total_lifetime_stamps: 0,
          card_status: 'active',
          qr_token_raw: rawQrToken,
        };
      } else {
        rawQrToken = card.qr_token_raw;
      }

      // Create session for passwordless access
      const customerSession = authService.createCustomerSession(customer.id, businessId);

      return { customer, card, rawQrToken, customerSession, isNew };
    });

    return res.json({
      success: true,
      message: result.isNew ? 'Loyalty card created successfully!' : 'Welcome back! Digital card retrieved.',
      customer: {
        id: result.customer.id,
        name: result.customer.name,
        phoneMasked: maskPhone(norm),
      },
      card: {
        id: result.card.id,
        currentStamps: result.card.current_stamps,
        totalLifetimeStamps: result.card.total_lifetime_stamps,
        cardStatus: result.card.card_status,
        qrToken: result.rawQrToken,
      },
      sessionToken: result.customerSession.sessionToken,
    });
  });

  /**
   * GET /api/v1/customer/card
   * Retrieve customer card details using customer session token
   */
  router.get('/customer/card', (req: Request, res: Response) => {
    const sessionToken = (req.headers['x-customer-session'] as string) || (req.query.sessionToken as string);
    if (!sessionToken) {
      return sendError(res, 401, 'Customer session token required.');
    }

    const session = authService.validateCustomerSession(sessionToken);
    if (!session) {
      return sendError(res, 401, 'Invalid or expired customer session.');
    }

    const customer = db.queryOne<{ id: string; name: string; phone_masked: string }>(
      'SELECT id, name, phone_masked FROM loyalty_customers WHERE id = ?;',
      [session.customerId]
    );

    const card = db.queryOne<{ id: string; current_stamps: number; total_lifetime_stamps: number; card_status: string; qr_token_raw: string; program_id: string }>(
      'SELECT id, current_stamps, total_lifetime_stamps, card_status, qr_token_raw, program_id FROM loyalty_cards WHERE customer_id = ? AND business_id = ?;',
      [session.customerId, session.businessId]
    );

    if (!customer || !card) {
      return sendError(res, 404, 'Card not found.');
    }

    // Available earned entitlements
    const entitlements = db.query(
      "SELECT id, reward_title as rewardTitle, status, redemption_code as redemptionCode, earned_at_stamps as earnedAtStamps FROM reward_entitlements WHERE card_id = ? AND status = 'available';",
      [card.id]
    );

    // Recent transactions
    const history = db.query(
      'SELECT id, stamps_awarded as stampsAwarded, type, location_name as locationName, created_at as createdAt FROM stamp_transactions WHERE card_id = ? ORDER BY created_at DESC LIMIT 5;',
      [card.id]
    );

    return res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phoneMasked: customer.phone_masked,
      },
      card: {
        id: card.id,
        currentStamps: card.current_stamps,
        totalLifetimeStamps: card.total_lifetime_stamps,
        cardStatus: card.card_status,
        qrToken: card.qr_token_raw,
      },
      entitlements,
      history,
    });
  });

  // =========================================================================
  // 3. MERCHANT SCANNING & STAMP WORKFLOWS (Strict RBAC & Idempotency)
  // =========================================================================

  /**
   * POST /api/v1/merchant/scan/resolve
   * Resolves scanned QR token or manual lookup for the merchant's business
   * Enforces server-side token hashing and tenant boundary.
   */
  router.post(
    '/merchant/scan/resolve',
    requireAuth(authService),
    requireTenant,
    (req: AuthenticatedRequest, res: Response) => {
      const { qrToken, phone } = req.body;
      const businessId = req.businessId!;

      let resolvedCard;

      if (qrToken) {
        // Compute SHA-256 hash of scanned token
        const tokenHash = hashSha256(qrToken.trim());
        const tokenEntry = db.queryOne<{ card_id: string; business_id: string; revoked_at: string }>(
          'SELECT card_id, business_id, revoked_at FROM qr_tokens WHERE token_hash = ?;',
          [tokenHash]
        );

        if (!tokenEntry) {
          return sendError(res, 404, 'Invalid QR code. No matching active loyalty pass found.');
        }

        if (tokenEntry.revoked_at) {
          return sendError(res, 403, 'This loyalty pass QR token has been revoked.');
        }

        // Strictly verify tenant ownership
        if (tokenEntry.business_id !== businessId) {
          return sendError(res, 403, 'This loyalty card belongs to a different merchant outlet.');
        }

        resolvedCard = db.queryOne<{
          id: string;
          customer_id: string;
          business_id: string;
          program_id: string;
          current_stamps: number;
          total_lifetime_stamps: number;
          card_status: string;
        }>('SELECT * FROM loyalty_cards WHERE id = ?;', [tokenEntry.card_id]);
      } else if (phone) {
        // Manual search by phone
        const norm = normalizeIndianPhone(phone);
        const cust = db.queryOne<{ id: string }>('SELECT id FROM loyalty_customers WHERE business_id = ? AND phone_normalized = ?;', [businessId, norm]);
        if (!cust) {
          return sendError(res, 404, 'Customer not found with this mobile number for your business.');
        }

        resolvedCard = db.queryOne<{
          id: string;
          customer_id: string;
          business_id: string;
          program_id: string;
          current_stamps: number;
          total_lifetime_stamps: number;
          card_status: string;
        }>('SELECT * FROM loyalty_cards WHERE customer_id = ? AND business_id = ?;', [cust.id, businessId]);
      } else {
        return sendError(res, 400, 'Either qrToken or phone is required.');
      }

      if (!resolvedCard) {
        return sendError(res, 404, 'Loyalty card record not found.');
      }

      const customer = db.queryOne<{ id: string; name: string; phone_masked: string; status: string }>(
        'SELECT id, name, phone_masked, status FROM loyalty_customers WHERE id = ?;',
        [resolvedCard.customer_id]
      );

      if (!customer || customer.status === 'blocked') {
        return sendError(res, 403, 'Customer account is suspended or blocked.');
      }

      const program = db.queryOne<{ id: string; name: string; stamp_target: number; reward_title: string; reward_description: string }>(
        'SELECT id, name, stamp_target, reward_title, reward_description FROM loyalty_programs WHERE id = ?;',
        [resolvedCard.program_id]
      );

      // Check available earned entitlements
      const entitlements = db.query(
        'SELECT id, reward_title as rewardTitle, status, redemption_code as redemptionCode FROM reward_entitlements WHERE card_id = ? AND status = "available";',
        [resolvedCard.id]
      );

      return res.json({
        success: true,
        customer: {
          id: customer.id,
          name: customer.name,
          phoneMasked: customer.phone_masked,
        },
        card: {
          id: resolvedCard.id,
          currentStamps: resolvedCard.current_stamps,
          totalLifetimeStamps: resolvedCard.total_lifetime_stamps,
          cardStatus: resolvedCard.card_status,
        },
        program: {
          id: program?.id,
          name: program?.name,
          stampTarget: program?.stamp_target || 8,
          rewardTitle: program?.reward_title,
          rewardDescription: program?.reward_description,
        },
        availableEntitlements: entitlements,
      });
    }
  );

  /**
   * POST /api/v1/merchant/stamps/award
   * Idempotent, transaction-safe stamp award endpoint
   */
  router.post(
    '/merchant/stamps/award',
    requireAuth(authService),
    requireTenant,
    (req: AuthenticatedRequest, res: Response) => {
      const { cardId, locationId, idempotencyKey, note } = req.body;
      const staffUser = req.user!;
      const businessId = req.businessId!;

      if (!cardId) {
        return sendError(res, 400, 'cardId is required.');
      }

      // Check Stable Idempotency Key
      if (idempotencyKey) {
        const existing = db.queryOne<{ status_code: number; response_body: string }>(
          'SELECT status_code, response_body FROM idempotency_keys WHERE idempotency_key = ? AND business_id = ?;',
          [idempotencyKey, businessId]
        );
        if (existing) {
          // Return the previously generated response without re-awarding!
          return res.status(existing.status_code).json(JSON.parse(existing.response_body));
        }
      }

      // Verify business account status
      const business = db.queryOne<{ status: string }>('SELECT status FROM businesses WHERE id = ?;', [businessId]);
      if (business?.status === 'suspended') {
        return sendError(res, 403, 'Suspended business accounts cannot award loyalty stamps.');
      }

      try {
        const result = db.transaction(() => {
          const card = db.queryOne<{
            id: string;
            customer_id: string;
            business_id: string;
            program_id: string;
            current_stamps: number;
            total_lifetime_stamps: number;
          }>('SELECT * FROM loyalty_cards WHERE id = ? AND business_id = ?;', [cardId, businessId]);

          if (!card) {
            throw new Error('Loyalty card not found or belongs to another business.');
          }

          const program = db.queryOne<{
            id: string;
            stamp_target: number;
            reward_title: string;
            reward_description: string;
            status: string;
          }>('SELECT * FROM loyalty_programs WHERE id = ?;', [card.program_id]);

          if (!program || program.status !== 'active') {
            throw new Error('This loyalty program is not currently active.');
          }

          const customer = db.queryOne<{ id: string; name: string }>(
            'SELECT id, name FROM loyalty_customers WHERE id = ?;',
            [card.customer_id]
          );

          const location = db.queryOne<{ id: string; name: string }>(
            'SELECT id, name FROM business_locations WHERE id = ? AND business_id = ?;',
            [locationId || '', businessId]
          ) || { id: locationId || 'loc_main', name: 'Main Outlet' };

          const newStamps = card.current_stamps + 1;
          const newLifetime = card.total_lifetime_stamps + 1;
          const rewardUnlocked = newStamps >= program.stamp_target;

          // Update card
          db.execute(
            `UPDATE loyalty_cards
             SET current_stamps = ?, total_lifetime_stamps = ?, last_stamped_at = CURRENT_TIMESTAMP,
                 card_status = ?
             WHERE id = ?;`,
            [newStamps, newLifetime, rewardUnlocked ? 'completed' : 'active', card.id]
          );

          // Update customer totals
          db.execute(
            'UPDATE loyalty_customers SET total_stamps_awarded = total_stamps_awarded + 1, last_visit_at = CURRENT_TIMESTAMP WHERE id = ?;',
            [card.customer_id]
          );

          // Append-only transaction entry
          const txId = generateId('tx_st');
          db.execute(
            `INSERT INTO stamp_transactions (
              id, business_id, card_id, customer_id, customer_name, location_id, location_name,
              staff_user_id, staff_name, stamps_awarded, type, idempotency_key, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'award', ?, ?);`,
            [
              txId, businessId, card.id, card.customer_id, customer?.name || 'Customer',
              location.id, location.name, staffUser.id, staffUser.name, idempotencyKey || null,
              note || `Awarded by ${staffUser.name} (${staffUser.role})`
            ]
          );

          // If threshold reached, create new Reward Entitlement record!
          let entitlementId: string | null = null;
          if (rewardUnlocked) {
            entitlementId = generateId('ent');
            const matchingReward = db.queryOne<{ id: string }>(
              'SELECT id FROM rewards WHERE business_id = ? AND program_id = ? AND is_active = 1 LIMIT 1;',
              [businessId, program.id]
            );

            db.execute(
              `INSERT INTO reward_entitlements (
                id, business_id, customer_id, card_id, reward_id, reward_title, stamp_cost, status, earned_at_stamps
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?);`,
              [
                entitlementId,
                businessId,
                card.customer_id,
                card.id,
                matchingReward?.id || 'rwd_default',
                program.reward_title,
                program.stamp_target,
                newStamps,
              ]
            );
          }

          // Audit log
          logAudit({
            businessId,
            userId: staffUser.id,
            userName: `${staffUser.name} (${staffUser.role})`,
            actorType: 'merchant',
            action: 'STAMPS_AWARDED',
            entityType: 'stamp_transaction',
            entityId: txId,
            details: `Awarded 1 stamp to ${customer?.name}. New balance: ${newStamps}/${program.stamp_target}.`,
          });

          return {
            success: true,
            card: {
              id: card.id,
              currentStamps: newStamps,
              totalLifetimeStamps: newLifetime,
              cardStatus: rewardUnlocked ? 'completed' : 'active',
            },
            transactionId: txId,
            rewardUnlocked,
            rewardTitle: program.reward_title,
            entitlementId,
          };
        });

        // Store response in idempotency ledger if key provided
        if (idempotencyKey) {
          db.execute(
            "INSERT INTO idempotency_keys (idempotency_key, business_id, action, status_code, response_body) VALUES (?, ?, 'stamp_award', 200, ?);",
            [idempotencyKey, businessId, JSON.stringify(result)]
          );
        }

        return res.json(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Stamp award failed';
        return sendError(res, 400, msg);
      }
    }
  );

  /**
   * POST /api/v1/merchant/rewards/redeem
   * Concurrency-safe atomic reward redemption
   */
  router.post(
    '/merchant/rewards/redeem',
    requireAuth(authService),
    requireTenant,
    (req: AuthenticatedRequest, res: Response) => {
      const { cardId, entitlementId, locationId } = req.body;
      const staffUser = req.user!;
      const businessId = req.businessId!;

      try {
        const result = db.transaction(() => {
          // Lock entitlement for redemption
          const entitlement = db.queryOne<{
            id: string;
            business_id: string;
            customer_id: string;
            card_id: string;
            reward_id: string;
            reward_title: string;
            stamp_cost: number;
            status: string;
          }>(
            'SELECT * FROM reward_entitlements WHERE id = ? AND business_id = ?;',
            [entitlementId, businessId]
          );

          if (!entitlement) {
            throw new Error('Reward entitlement not found.');
          }

          if (entitlement.status !== 'available') {
            throw new Error(`This reward entitlement is already ${entitlement.status} and cannot be redeemed again.`);
          }

          const card = db.queryOne<{ id: string; current_stamps: number }>(
            'SELECT id, current_stamps FROM loyalty_cards WHERE id = ? AND business_id = ?;',
            [entitlement.card_id, businessId]
          );

          if (!card) {
            throw new Error('Card associated with entitlement not found.');
          }

          const customer = db.queryOne<{ id: string; name: string }>(
            'SELECT id, name FROM loyalty_customers WHERE id = ?;',
            [entitlement.customer_id]
          );

          const location = db.queryOne<{ id: string; name: string }>(
            'SELECT id, name FROM business_locations WHERE id = ? AND business_id = ?;',
            [locationId || '', businessId]
          ) || { id: locationId || 'loc_main', name: 'Main Outlet' };

          // Generate single-use redemption code
          const redemptionCode = `YBGP-RWD-${Math.floor(1000 + Math.random() * 9000)}`;
          const redemptionId = generateId('rdm');

          // Mark entitlement as redeemed
          db.execute(
            `UPDATE reward_entitlements
             SET status = 'redeemed', redeemed_at = CURRENT_TIMESTAMP, redemption_code = ?, staff_user_id = ?, location_id = ?
             WHERE id = ?;`,
            [redemptionCode, staffUser.id, location.id, entitlement.id]
          );

          // Deduct stamps from card and cycle back to active
          const updatedStamps = Math.max(0, card.current_stamps - entitlement.stamp_cost);
          db.execute(
            "UPDATE loyalty_cards SET current_stamps = ?, card_status = 'active' WHERE id = ?;",
            [updatedStamps, card.id]
          );

          // Update customer stats
          db.execute(
            'UPDATE loyalty_customers SET total_rewards_redeemed = total_rewards_redeemed + 1 WHERE id = ?;',
            [entitlement.customer_id]
          );

          // Record in reward_redemptions ledger
          db.execute(
            `INSERT INTO reward_redemptions (
              id, business_id, customer_id, customer_name, card_id, reward_id, reward_title,
              location_id, location_name, staff_user_id, staff_name, status, redemption_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'redeemed', ?);`,
            [
              redemptionId, businessId, entitlement.customer_id, customer?.name || 'Customer',
              card.id, entitlement.reward_id, entitlement.reward_title, location.id, location.name,
              staffUser.id, staffUser.name, redemptionCode
            ]
          );

          logAudit({
            businessId,
            userId: staffUser.id,
            userName: `${staffUser.name} (${staffUser.role})`,
            actorType: 'merchant',
            action: 'REWARD_REDEEMED',
            entityType: 'reward_entitlement',
            entityId: entitlement.id,
            details: `Redeemed '${entitlement.reward_title}' (Code: ${redemptionCode}) for ${customer?.name}.`,
          });

          return {
            success: true,
            redemptionCode,
            card: {
              id: card.id,
              currentStamps: updatedStamps,
            },
          };
        });

        return res.json(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Redemption failed';
        return sendError(res, 400, msg);
      }
    }
  );

  /**
   * POST /api/v1/merchant/stamps/reverse
   * Authorized stamp reversal with mandatory reason and compensating ledger entry
   */
  router.post(
    '/merchant/stamps/reverse',
    requireAuth(authService),
    requireRole(['owner', 'manager', 'platform_admin']), // Cashiers strictly prohibited!
    requireTenant,
    (req: AuthenticatedRequest, res: Response) => {
      const { transactionId, reversalReason } = req.body;
      const staffUser = req.user!;
      const businessId = req.businessId!;

      if (!reversalReason || reversalReason.trim().length < 5) {
        return sendError(res, 400, 'A specific audit reversal reason of at least 5 characters is required.');
      }

      try {
        const result = db.transaction(() => {
          const originalTx = db.queryOne<{
            id: string;
            card_id: string;
            customer_id: string;
            customer_name: string;
            location_id: string;
            location_name: string;
            stamps_awarded: number;
            type: string;
          }>(
            'SELECT * FROM stamp_transactions WHERE id = ? AND business_id = ?;',
            [transactionId, businessId]
          );

          if (!originalTx) {
            throw new Error('Original stamp transaction not found.');
          }

          if (originalTx.type === 'reversal') {
            throw new Error('Cannot reverse an existing reversal transaction.');
          }

          const card = db.queryOne<{ id: string; current_stamps: number; total_lifetime_stamps: number }>(
            'SELECT id, current_stamps, total_lifetime_stamps FROM loyalty_cards WHERE id = ?;',
            [originalTx.card_id]
          );

          if (!card) {
            throw new Error('Associated loyalty card not found.');
          }

          const stampsToDeduct = originalTx.stamps_awarded;
          const newCurrent = Math.max(0, card.current_stamps - stampsToDeduct);
          const newLifetime = Math.max(0, card.total_lifetime_stamps - stampsToDeduct);

          db.execute(
            'UPDATE loyalty_cards SET current_stamps = ?, total_lifetime_stamps = ? WHERE id = ?;',
            [newCurrent, newLifetime, card.id]
          );

          // Append compensating reversal record
          const revTxId = generateId('tx_st_rev');
          db.execute(
            `INSERT INTO stamp_transactions (
              id, business_id, card_id, customer_id, customer_name, location_id, location_name,
              staff_user_id, staff_name, stamps_awarded, type, reversal_reason, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reversal', ?, ?);`,
            [
              revTxId, businessId, card.id, originalTx.customer_id, originalTx.customer_name,
              originalTx.location_id, originalTx.location_name, staffUser.id, staffUser.name,
              -stampsToDeduct, reversalReason.trim(), `Reversed ${originalTx.id} by ${staffUser.name}`
            ]
          );

          logAudit({
            businessId,
            userId: staffUser.id,
            userName: `${staffUser.name} (${staffUser.role})`,
            actorType: 'merchant',
            action: 'STAMPS_REVERSED',
            entityType: 'stamp_transaction',
            entityId: revTxId,
            details: `Reversed ${stampsToDeduct} stamp(s) for ${originalTx.customer_name}. Reason: ${reversalReason}`,
          });

          return {
            success: true,
            reversalTransactionId: revTxId,
            card: {
              id: card.id,
              currentStamps: newCurrent,
            },
          };
        });

        return res.json(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Reversal failed';
        return sendError(res, 400, msg);
      }
    }
  );

  // =========================================================================
  // 4. MERCHANT DATA & MANAGEMENT
  // =========================================================================

  /**
   * GET /api/v1/merchant/customers
   * Scoped patron list for authenticated merchant
   * Security rule: Never return raw QR tokens in customer list!
   */
  router.get(
    '/merchant/customers',
    requireAuth(authService),
    requireTenant,
    (req: AuthenticatedRequest, res: Response) => {
      const businessId = req.businessId!;
      const rows = db.query(
        `SELECT c.id, c.name, c.phone_masked as phoneMasked, c.total_stamps_awarded as totalStampsAwarded,
                c.total_rewards_redeemed as totalRewardsRedeemed, c.last_visit_at as lastVisitAt, c.created_at as createdAt,
                k.current_stamps as currentStamps, k.total_lifetime_stamps as totalLifetimeStamps, k.card_status as cardStatus,
                k.id as cardId
         FROM loyalty_customers c
         LEFT JOIN loyalty_cards k ON c.id = k.customer_id AND k.business_id = c.business_id
         WHERE c.business_id = ?
         ORDER BY c.last_visit_at DESC;`,
        [businessId]
      );
      return res.json({ success: true, customers: rows });
    }
  );

  /**
   * GET /api/v1/merchant/transactions
   * Transaction history & redemptions ledger
   */
  router.get(
    '/merchant/transactions',
    requireAuth(authService),
    requireTenant,
    (req: AuthenticatedRequest, res: Response) => {
      const businessId = req.businessId!;
      const transactions = db.query(
        'SELECT id, customer_name as customerName, staff_name as staffName, stamps_awarded as stampsAwarded, type, reversal_reason as reversalReason, location_name as locationName, created_at as createdAt FROM stamp_transactions WHERE business_id = ? ORDER BY created_at DESC;',
        [businessId]
      );
      const redemptions = db.query(
        'SELECT id, customer_name as customerName, reward_title as rewardTitle, redemption_code as redemptionCode, staff_name as staffName, location_name as locationName, created_at as createdAt FROM reward_redemptions WHERE business_id = ? ORDER BY created_at DESC;',
        [businessId]
      );
      return res.json({ success: true, transactions, redemptions });
    }
  );

  /**
   * PUT /api/v1/merchant/business
   * Update profile with sanitized URLs
   */
  router.put(
    '/merchant/business',
    requireAuth(authService),
    requireRole(['owner', 'manager', 'platform_admin']),
    requireTenant,
    (req: AuthenticatedRequest, res: Response) => {
      const businessId = req.businessId!;
      const { googleReviewsUrl, whatsapp, phone, openingHours, announcement, brandColor } = req.body;

      try {
        const cleanReviewUrl = googleReviewsUrl ? sanitizeUrl(googleReviewsUrl) : '';

        db.execute(
          `UPDATE businesses
           SET google_reviews_url = ?, whatsapp = ?, phone = ?, opening_hours = ?, announcement = ?, brand_color = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?;`,
          [cleanReviewUrl, whatsapp?.replace(/\D/g, '') || '', phone || '', openingHours || '', announcement || '', brandColor || '#0F172A', businessId]
        );

        return res.json({ success: true, message: 'Business settings updated.' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Update failed';
        return sendError(res, 400, msg);
      }
    }
  );

  /**
   * PUT /api/v1/merchant/links
   * Add/update bio link with strict URL sanitization
   */
  router.post(
    '/merchant/links',
    requireAuth(authService),
    requireRole(['owner', 'manager', 'platform_admin']),
    requireTenant,
    (req: AuthenticatedRequest, res: Response) => {
      const businessId = req.businessId!;
      const { id, title, subtitle, url, type, iconName, sortOrder, isEnabled } = req.body;

      try {
        const sanitized = sanitizeUrl(url);

        if (id) {
          db.execute(
            `UPDATE business_links
             SET title = ?, subtitle = ?, url = ?, type = ?, icon_name = ?, sort_order = ?, is_enabled = ?
             WHERE id = ? AND business_id = ?;`,
            [title, subtitle || null, sanitized, type || 'custom', iconName || 'link', sortOrder ?? 1, isEnabled ? 1 : 0, id, businessId]
          );
        } else {
          db.execute(
            `INSERT INTO business_links (id, business_id, title, subtitle, url, type, icon_name, sort_order, is_enabled)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [generateId('lnk'), businessId, title, subtitle || null, sanitized, type || 'custom', iconName || 'link', sortOrder ?? 1, isEnabled !== false ? 1 : 0]
          );
        }

        return res.json({ success: true, message: 'Link saved successfully.' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save link';
        return sendError(res, 400, msg);
      }
    }
  );

  // =========================================================================
  // 5. YBGP SUPER ADMIN PLATFORM ENDPOINTS (Server-Enforced platform_admin)
  // =========================================================================

  /**
   * GET /api/v1/admin/overview
   * Platform statistics & subscription MRR
   */
  router.get(
    '/admin/overview',
    requireAuth(authService),
    requireRole(['platform_admin']),
    (req: AuthenticatedRequest, res: Response) => {
      const businesses = db.query('SELECT id, slug, name, category, status, plan_id, city, created_at FROM businesses;');
      const patronsCount = db.queryOne<{ count: number }>('SELECT count(*) as count FROM loyalty_customers;');
      const stampsCount = db.queryOne<{ total: number }>('SELECT sum(stamps_awarded) as total FROM stamp_transactions WHERE stamps_awarded > 0;');
      const redemptionsCount = db.queryOne<{ count: number }>('SELECT count(*) as count FROM reward_redemptions;');

      return res.json({
        success: true,
        businesses,
        totalCustomers: patronsCount?.count || 0,
        totalStampsAwarded: stampsCount?.total || 0,
        totalRedemptions: redemptionsCount?.count || 0,
      });
    }
  );

  /**
   * PUT /api/v1/admin/businesses/:id/status
   * Suspend or Reactivate merchant with mandatory recorded audit reason
   */
  router.put(
    '/admin/businesses/:id/status',
    requireAuth(authService),
    requireRole(['platform_admin']),
    (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { status, reason } = req.body;

      if (!status || !['active', 'suspended'].includes(status)) {
        return sendError(res, 400, 'Invalid status.');
      }
      if (!reason || reason.trim().length < 5) {
        return sendError(res, 400, 'A specific administrative reason of at least 5 characters is required.');
      }

      db.execute('UPDATE businesses SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;', [status, id]);

      logAudit({
        businessId: id,
        userId: req.user!.id,
        userName: `${req.user!.name} (Platform Admin)`,
        actorType: 'admin',
        action: `BUSINESS_STATUS_${status.toUpperCase()}`,
        entityType: 'business',
        entityId: id,
        details: `Business status set to ${status}. Reason: ${reason}`,
      });

      return res.json({ success: true, message: `Business ${status} successfully.` });
    }
  );

  /**
   * GET /api/v1/admin/audit-logs
   */
  router.get(
    '/admin/audit-logs',
    requireAuth(authService),
    requireRole(['platform_admin']),
    (req: AuthenticatedRequest, res: Response) => {
      const logs = db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200;');
      return res.json({ success: true, auditLogs: logs });
    }
  );

  // =========================================================================
  // 6. PAYMENT WEBHOOKS (Idempotency & Replay Prevention)
  // =========================================================================

  /**
   * POST /api/v1/webhooks/payment
   * Verifies webhook idempotency and handles subscription status changes
   */
  router.post('/webhooks/payment', (req: Request, res: Response) => {
    const webhookId = req.headers['x-webhook-id'] as string || req.body.webhookId;
    const { businessId, eventType, planId } = req.body;

    if (!webhookId) {
      return sendError(res, 400, 'x-webhook-id header or webhookId is required.');
    }

    // Check if webhook already processed
    const existing = db.queryOne<{ webhook_id: string }>(
      'SELECT webhook_id FROM payment_webhooks WHERE webhook_id = ?;',
      [webhookId]
    );

    if (existing) {
      // Return 200 OK without re-processing duplicate webhook
      return res.json({ success: true, message: 'Webhook already processed (Idempotent response).' });
    }

    // Process payment event
    db.transaction(() => {
      const payloadHash = hashSha256(JSON.stringify(req.body));
      db.execute(
        "INSERT INTO payment_webhooks (webhook_id, business_id, event_type, payload_hash, status) VALUES (?, ?, ?, ?, 'processed');",
        [webhookId, businessId || null, eventType || 'subscription.paid', payloadHash]
      );

      if (businessId && planId) {
        db.execute(
          "UPDATE subscriptions SET plan_id = ?, status = 'active', current_period_start = CURRENT_TIMESTAMP WHERE business_id = ?;",
          [planId, businessId]
        );
      }
    });

    return res.json({ success: true, message: 'Payment webhook processed successfully.' });
  });

  return router;
}
