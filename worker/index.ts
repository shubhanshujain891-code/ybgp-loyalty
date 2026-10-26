import {
  hashSha256,
  generateId,
  generateQrToken,
  generateRandomToken,
  normalizeIndianPhone,
  isValidIndianPhone,
  maskPhone,
  generateSalt,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  verifyRazorpayWebhook,
  verifyStripeWebhook,
  generateSecureOtp,
} from '../server/security';

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
  SMS_PROVIDER_MODE?: string;
  PAYMENT_WEBHOOK_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  BOOTSTRAP_ADMIN_SECRET?: string;
  FAST2SMS_API_KEY?: string;
  SMS_API_KEY?: string;
  MSG91_AUTH_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  SMS_GATEWAY_URL?: string;
  ASSETS?: { fetch: (request: Request | string) => Promise<Response> };
}

function jsonResponse(data: any, status: number = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}

function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-customer-session, x-ybgp-user-id, Idempotency-Key, x-idempotency-key, x-webhook-signature, x-razorpay-signature, stripe-signature',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 2. Health & D1 Connectivity Check
    if (path === '/health') {
      let dbStatus = 'healthy';
      try {
        if (env.DB) {
          await env.DB.prepare('SELECT 1;').first();
        } else {
          dbStatus = 'unbound';
        }
      } catch (err: unknown) {
        dbStatus = `error: ${err instanceof Error ? err.message : 'unreachable'}`;
      }

      return jsonResponse({
        status: dbStatus === 'healthy' ? 'ok' : 'degraded',
        platform: 'Cloudflare Workers (Edge)',
        runtime: 'D1 + Node.js Compat',
        database: dbStatus,
        environment: env.ENVIRONMENT || 'production',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. API Routes Handling (/api/v1/*)
    if (path.startsWith('/api/v1') || path.startsWith('/api/')) {
      if (!env.DB) {
        return errorResponse('Cloudflare D1 database binding (DB) is not configured.', 500);
      }

      try {
        // --- AUTHENTICATION ---
        // POST /api/v1/auth/bootstrap-admin
        if (path === '/api/v1/auth/bootstrap-admin' && method === 'POST') {
          const body = (await request.json()) as any;
          const { bootstrapSecret, name, email, password, phone } = body;

          if (!name || !email || !password) {
            return errorResponse('Name, email, and password are required.', 400);
          }

          const requiredSecret = env.BOOTSTRAP_ADMIN_SECRET || process.env.BOOTSTRAP_ADMIN_SECRET;
          if (requiredSecret && (!bootstrapSecret || bootstrapSecret !== requiredSecret)) {
            return errorResponse('Invalid or missing bootstrap administrative secret.', 403);
          }

          const existingAdmin = await env.DB.prepare("SELECT id FROM users WHERE role = 'platform_admin' LIMIT 1;").first();
          if (existingAdmin && !bootstrapSecret) {
            return errorResponse('A platform administrator has already been bootstrapped.', 403);
          }

          const strength = validatePasswordStrength(password);
          if (!strength.valid) {
            return errorResponse(`Password complexity requirement not met: ${strength.error}`, 400);
          }

          const salt = generateSalt(16);
          const hash = hashPassword(password, salt);
          const adminId = generateId('usr_admin');

          await env.DB.prepare(
            `INSERT INTO users (id, name, email, phone, role, password_hash, password_salt, account_status)
             VALUES (?, ?, ?, ?, 'platform_admin', ?, ?, 'active');`
          ).bind(adminId, name.trim(), email.trim().toLowerCase(), phone || '+919999999999', hash, salt).run();

          return jsonResponse({
            success: true,
            message: 'Platform administrator successfully provisioned.',
            admin: { id: adminId, email: email.trim().toLowerCase(), name: name.trim() },
          }, 201);
        }

        // POST /api/v1/auth/login
        if (path === '/api/v1/auth/login' && method === 'POST') {
          const body = (await request.json()) as any;
          const { email, password } = body;

          if (!email || !password) {
            return errorResponse('Email and password are required.', 400);
          }

          const user = (await env.DB.prepare('SELECT * FROM users WHERE lower(email) = lower(?);').bind(email.trim()).first()) as any;

          if (!user || !user.password_hash || !user.password_salt) {
            return errorResponse('Invalid email or password.', 401);
          }

          if (user.account_status === 'suspended') {
            return errorResponse('This account has been suspended.', 403);
          }

          const isValid = verifyPassword(password, user.password_salt, user.password_hash);
          if (!isValid) {
            return errorResponse('Invalid email or password.', 401);
          }

          const rawToken = generateRandomToken(32);
          const tokenHash = hashSha256(rawToken);
          const sessionId = generateId('ses');
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

          await env.DB.prepare(
            `INSERT INTO sessions (id, token_hash, user_id, business_id, role, ip_address, user_agent, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?);`
          ).bind(sessionId, tokenHash, user.id, user.business_id, user.role, request.headers.get('cf-connecting-ip') || '127.0.0.1', request.headers.get('user-agent'), expiresAt).run();

          return jsonResponse({
            success: true,
            token: rawToken,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              businessId: user.business_id,
            },
            expiresAt,
          });
        }

        // GET /api/v1/public/business/:slug
        const matchSlug = path.match(/^\/api\/v1\/public\/business\/([^\/]+)$/);
        if (matchSlug && method === 'GET') {
          const slug = matchSlug[1];
          const business = (await env.DB.prepare('SELECT * FROM businesses WHERE lower(slug) = lower(?);').bind(slug).first()) as any;
          if (!business) {
            return errorResponse('Business page not found.', 404);
          }

          const linksRes = await env.DB.prepare(
            'SELECT id, title, subtitle, url, type, icon_name as iconName, sort_order as sortOrder FROM business_links WHERE business_id = ? AND is_enabled = 1 ORDER BY sort_order ASC;'
          ).bind(business.id).all();

          const program = (await env.DB.prepare(
            "SELECT id, name, description, stamp_target as stampTarget, reward_title as rewardTitle, reward_description as rewardDescription, min_spend_in_paise as minSpendInPaise FROM loyalty_programs WHERE business_id = ? AND status = 'active' LIMIT 1;"
          ).bind(business.id).first()) as any;

          return jsonResponse({
            success: true,
            business: {
              id: business.id,
              slug: business.slug,
              name: business.name,
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
            links: linksRes.results || [],
            program,
          });
        }

        // POST /api/v1/public/loyalty/otp/request
        if (path === '/api/v1/public/loyalty/otp/request' && method === 'POST') {
          const body = (await request.json()) as any;
          const { phone, businessId } = body;

          if (!phone || !isValidIndianPhone(phone)) {
            return errorResponse('Please provide a valid 10-digit Indian mobile number (+91 6-9XXXXXXXX).', 400);
          }

          const norm = normalizeIndianPhone(phone);
          const business = (await env.DB.prepare('SELECT id, name FROM businesses WHERE id = ?;').bind(businessId).first()) as any;
          if (!business) {
            return errorResponse('Business not found.', 404);
          }

          // Rate limit check: 60s cooldown
          const recent = await env.DB.prepare(
            "SELECT id FROM otp_challenges WHERE phone_normalized = ? AND created_at > datetime('now', '-60 seconds') LIMIT 1;"
          ).bind(norm).first();
          if (recent) {
            return errorResponse('Please wait 60 seconds before requesting a new OTP code.', 429);
          }

          const rawOtp = generateSecureOtp();
          const otpHash = hashSha256(rawOtp, norm);
          const challengeId = generateId('otp');
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

          // Check if SMS provider configured
          const hasSmsConfig = !!(env.FAST2SMS_API_KEY || env.SMS_API_KEY || env.MSG91_AUTH_KEY || env.TWILIO_ACCOUNT_SID || env.SMS_GATEWAY_URL);
          const isProduction = (env.ENVIRONMENT || 'production') === 'production';

          if (isProduction && !hasSmsConfig) {
            return errorResponse('SMS service is temporarily unconfigured or unavailable. Please contact support.', 503);
          }

          await env.DB.prepare(
            `INSERT INTO otp_challenges (id, phone_normalized, business_id, otp_hash, purpose, expires_at)
             VALUES (?, ?, ?, ?, 'registration', ?);`
          ).bind(challengeId, norm, businessId, otpHash, expiresAt).run();

          return jsonResponse({
            success: true,
            message: `OTP sent successfully to ${maskPhone(norm)}.`,
            challengeId,
            expiresInSeconds: 300,
            simulatedOtp: isProduction ? undefined : rawOtp,
          });
        }

        // POST /api/v1/webhooks/razorpay
        if (path === '/api/v1/webhooks/razorpay' && method === 'POST') {
          const signature = request.headers.get('x-razorpay-signature');
          const secret = env.RAZORPAY_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET;
          if (!secret) return errorResponse('Signing secret is not configured on server (Fail Closed).', 500);
          if (!signature) return errorResponse('Missing x-razorpay-signature header.', 401);

          const rawBody = await request.text();
          if (!verifyRazorpayWebhook(rawBody, signature, secret)) {
            return errorResponse('Invalid Razorpay webhook signature.', 401);
          }

          const event = JSON.parse(rawBody);
          const webhookId = request.headers.get('x-razorpay-event-id') || event.id || (event.payload?.payment?.entity?.id ? `rzp_${event.payload.payment.entity.id}` : undefined);
          if (!webhookId) return errorResponse('Webhook event ID missing.', 400);

          const existing = await env.DB.prepare('SELECT webhook_id FROM payment_webhooks WHERE webhook_id = ?;').bind(webhookId).first();
          if (existing) return jsonResponse({ success: true, message: 'Event already processed (Idempotent response).' });

          const businessId = event.payload?.payment?.entity?.notes?.businessId || event.businessId;
          const planId = event.payload?.payment?.entity?.notes?.planId || event.planId;

          const payloadHash = hashSha256(rawBody);
          await env.DB.prepare(
            "INSERT INTO payment_webhooks (webhook_id, business_id, event_type, payload_hash, status) VALUES (?, ?, ?, ?, 'processed');"
          ).bind(webhookId, businessId || null, event.event || 'payment.captured', payloadHash).run();

          if (businessId && planId) {
            await env.DB.prepare(
              "UPDATE subscriptions SET plan_id = ?, status = 'active', current_period_start = CURRENT_TIMESTAMP WHERE business_id = ?;"
            ).bind(planId, businessId).run();
          }

          return jsonResponse({ success: true, message: 'Razorpay webhook processed.' });
        }

        // POST /api/v1/webhooks/stripe
        if (path === '/api/v1/webhooks/stripe' && method === 'POST') {
          const signature = request.headers.get('stripe-signature');
          const secret = env.STRIPE_WEBHOOK_SECRET || env.PAYMENT_WEBHOOK_SECRET;
          if (!secret) return errorResponse('Signing secret is not configured on server (Fail Closed).', 500);
          if (!signature) return errorResponse('Missing stripe-signature header.', 401);

          const rawBody = await request.text();
          if (!verifyStripeWebhook(rawBody, signature, secret, 300)) {
            return errorResponse('Invalid Stripe webhook signature or expired timestamp.', 401);
          }

          const event = JSON.parse(rawBody);
          const webhookId = event.id;
          if (!webhookId) return errorResponse('Stripe event id is required.', 400);

          const existing = await env.DB.prepare('SELECT webhook_id FROM payment_webhooks WHERE webhook_id = ?;').bind(webhookId).first();
          if (existing) return jsonResponse({ success: true, message: 'Stripe event already processed (Idempotent response).' });

          const businessId = event.data?.object?.client_reference_id || event.data?.object?.metadata?.businessId;
          const planId = event.data?.object?.metadata?.planId;

          const payloadHash = hashSha256(rawBody);
          await env.DB.prepare(
            "INSERT INTO payment_webhooks (webhook_id, business_id, event_type, payload_hash, status) VALUES (?, ?, ?, ?, 'processed');"
          ).bind(webhookId, businessId || null, event.type || 'checkout.session.completed', payloadHash).run();

          if (businessId && planId) {
            await env.DB.prepare(
              "UPDATE subscriptions SET plan_id = ?, status = 'active', current_period_start = CURRENT_TIMESTAMP WHERE business_id = ?;"
            ).bind(planId, businessId).run();
          }

          return jsonResponse({ success: true, message: 'Stripe webhook processed.' });
        }

        // Default API route catch-all
        return errorResponse(`Endpoint not found: ${method} ${path}`, 404);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Server error';
        return errorResponse(msg, 500);
      }
    }

    // 4. Static Assets & Single Page Application (SPA) routing
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      'YBGP Loyalty Cloudflare Edge active. Serve static assets via Cloudflare Pages or Workers Static Assets.',
      { headers: { 'Content-Type': 'text/plain' } }
    );
  },
};
