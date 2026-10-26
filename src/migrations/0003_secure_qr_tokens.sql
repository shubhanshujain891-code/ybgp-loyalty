-- ====================================================================
-- YBGP Loyalty - Multi-Tenant Relational Database Schema
-- Migration: 0003_secure_qr_tokens.sql
-- Purpose: Password authentication credentials, elimination of raw QR tokens,
--          enhanced indexes for atomic OTP verification and webhook security.
-- Target: Cloudflare D1 (SQLite) / Node SQLite Compatible
-- ====================================================================

-- 1. Add password hashing credentials and account status to users table
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;
ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active';

-- 2. Ensure indices for authoritative secure QR token lookups
CREATE INDEX IF NOT EXISTS idx_qr_tokens_hash_biz ON qr_tokens(token_hash, business_id);

-- 3. Additional index for atomic single-use OTP verification
CREATE INDEX IF NOT EXISTS idx_otp_verify_atomic ON otp_challenges(phone_normalized, business_id, verified_at, expires_at);

-- 4. Additional index for payment webhook idempotency
CREATE INDEX IF NOT EXISTS idx_webhooks_id ON payment_webhooks(webhook_id, status);
