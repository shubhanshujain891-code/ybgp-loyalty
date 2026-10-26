/**
 * YBGP Loyalty - Server Security Utilities
 * Cryptographic hashing, token generation, URL sanitization, and fraud prevention
 */

import crypto from 'node:crypto';

/**
 * SHA-256 Hash with optional salt
 */
export function hashSha256(data: string, salt: string = ''): string {
  return crypto.createHash('sha256').update(data + salt).digest('hex');
}

/**
 * Generate high-entropy opaque tokens (for customer QR passes, sessions)
 */
export function generateRandomToken(bytes: number = 24): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate customer loyalty QR bearer token with prefix
 */
/**
 * Generate customer loyalty QR bearer token with 128-bit cryptographic entropy (16 random bytes)
 */
export function generateQrToken(): string {
  const randomHex = crypto.randomBytes(16).toString('hex').toUpperCase();
  return `YBGP-CRD-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}-${randomHex.slice(8, 12)}-${randomHex.slice(12, 16)}`;
}

/**
 * Generate unique entity ID
 */
export function generateId(prefix: string): string {
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}_${random}`;
}

/**
 * Normalize Indian phone numbers to +91XXXXXXXXXX format
 */
export function normalizeIndianPhone(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  return input.startsWith('+') ? input : `+91${digits.slice(-10)}`;
}

/**
 * Strictly validate Indian mobile number format (+91 followed by 10 digits starting with 6-9)
 */
export function isValidIndianPhone(input: string): boolean {
  if (!input) return false;
  const norm = normalizeIndianPhone(input);
  return /^\+91[6-9]\d{9}$/.test(norm);
}

/**
 * Mask phone number for privacy (+91 ••••• ••123)
 */
export function maskPhone(phone: string): string {
  const norm = normalizeIndianPhone(phone);
  if (norm.length >= 13) {
    const last3 = norm.slice(-3);
    return `+91 ••••• ••${last3}`;
  }
  return phone;
}

/**
 * Enforce enterprise password complexity:
 * Minimum 12 characters, with uppercase, lowercase, digit, and symbol.
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one numeric digit (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character/symbol.' };
  }
  return { valid: true };
}

/**
 * URL Sanitizer - Protects against XSS, javascript: pseudoprotocol, data URIs, arbitrary code
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // Explicitly reject dangerous schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.includes('<script') ||
    lower.includes('</script>')
  ) {
    throw new Error('Unsafe URL scheme detected. Only http, https, tel, and whatsapp URLs are permitted.');
  }

  // Allow standard safe protocols
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('tel:') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('wa.me/')
  ) {
    return trimmed;
  }

  // Prepend https:// if protocol-less web URL
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
}

/**
 * Generate cryptographically secure random salt
 */
export function generateSalt(bytes: number = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash password using scrypt (memory-hard, computationally expensive, resistant to GPU brute-force)
 */
export function hashPassword(password: string, salt: string): string {
  if (!password || !salt) {
    throw new Error('Password and salt are required for hashing.');
  }
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * Verify password with constant-time equality check
 */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  try {
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const computedBuf = Buffer.from(computedHash, 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    if (computedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(computedBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeMatch(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generic webhook signature verification (HMAC SHA-256)
 * Fails closed if signature is missing or secret is not provided.
 */
export function verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
    const expectedSignature = hmac.digest('hex');

    // Handle possible 'sha256=' or 'v1=' prefix in signatureHeader
    const cleanHeader = signatureHeader.replace(/^sha256=|^v1=/, '').trim();
    return timingSafeMatch(cleanHeader, expectedSignature);
  } catch {
    return false;
  }
}

/**
 * Razorpay specific webhook signature verification:
 * Computes HMAC SHA-256 over raw request body using razorpay webhook secret.
 */
export function verifyRazorpayWebhook(rawBody: string | Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
    const expected = hmac.digest('hex');
    return timingSafeMatch(signature.trim(), expected);
  } catch {
    return false;
  }
}

/**
 * Stripe specific webhook signature verification:
 * Validates 'stripe-signature' header in 't={timestamp},v1={signature}' format
 * Computes HMAC SHA-256 over `${timestamp}.${rawBody}`
 * Enforces timestamp freshness tolerance (default: 300 seconds)
 */
export function verifyStripeWebhook(
  rawBody: string | Buffer,
  sigHeader: string | undefined,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  if (!sigHeader || !secret) return false;
  try {
    const parts = sigHeader.split(',').reduce<Record<string, string>>((acc, item) => {
      const [k, v] = item.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});

    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    // Check timestamp tolerance
    const tsNumber = parseInt(timestamp, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (isNaN(tsNumber) || Math.abs(nowSec - tsNumber) > toleranceSeconds) {
      return false; // Timestamp outside acceptable tolerance window
    }

    const payload = `${timestamp}.${typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expected = hmac.digest('hex');

    return timingSafeMatch(signature, expected);
  } catch {
    return false;
  }
}

/**
 * Generate cryptographically random 6-digit OTP code
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}
