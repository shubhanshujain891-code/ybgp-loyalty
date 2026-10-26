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
export function generateQrToken(): string {
  const randomHex = crypto.randomBytes(12).toString('hex').toUpperCase();
  return `YBGP-CRD-${randomHex.slice(0, 4)}-${randomHex.slice(4, 8)}-${randomHex.slice(8, 12)}`;
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
