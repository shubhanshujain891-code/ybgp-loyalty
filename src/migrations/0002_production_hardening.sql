-- ====================================================================
-- YBGP Loyalty - Multi-Tenant Relational Database Schema
-- Migration: 0002_production_hardening.sql
-- Purpose: Production Security, Hashed Tokens, Sessions, Entitlements,
--          Idempotency Ledger, and Concurrency Protections.
-- Target: Cloudflare D1 (SQLite) / Node SQLite Compatible
-- ====================================================================

-- 1. Server-Authoritative Sessions (Merchant & Admin)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 2. Customer Sessions (Passwordless Secure Card Access)
CREATE TABLE IF NOT EXISTS customer_sessions (
    id TEXT PRIMARY KEY,
    session_token_hash TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL REFERENCES loyalty_customers(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cust_sessions_token ON customer_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_cust_sessions_customer ON customer_sessions(customer_id);

-- 3. Hashed QR Token Registry (Prevents storing reusable bearer tokens)
CREATE TABLE IF NOT EXISTS qr_tokens (
    token_hash TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES loyalty_customers(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_card ON qr_tokens(card_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_business ON qr_tokens(business_id);

-- 4. Reward Entitlements (Distinguishes earned entitlements from catalog definitions)
CREATE TABLE IF NOT EXISTS reward_entitlements (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES loyalty_customers(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
    reward_id TEXT NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
    reward_title TEXT NOT NULL,
    stamp_cost INTEGER NOT NULL,
    status TEXT CHECK(status IN ('available', 'redeemed', 'expired', 'cancelled')) DEFAULT 'available',
    earned_at_stamps INTEGER NOT NULL,
    redeemed_at TIMESTAMP,
    redemption_code TEXT UNIQUE,
    staff_user_id TEXT REFERENCES users(id),
    location_id TEXT REFERENCES business_locations(id),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entitlements_customer ON reward_entitlements(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_entitlements_business ON reward_entitlements(business_id, status);
CREATE INDEX IF NOT EXISTS idx_entitlements_code ON reward_entitlements(redemption_code);

-- 5. Strict Idempotency Ledger (Prevents duplicate stamp awards or redemptions on retry)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_idempotency_business ON idempotency_keys(business_id, created_at);

-- 6. Hashed OTP Challenges (Secure Rate Limiting, No Plaintext OTP Storage)
CREATE TABLE IF NOT EXISTS otp_challenges (
    id TEXT PRIMARY KEY,
    phone_normalized TEXT NOT NULL,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    otp_hash TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK(purpose IN ('registration', 'card_recovery')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 4,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_lookup_secure ON otp_challenges(phone_normalized, business_id);

-- 7. Payment Webhook Ledger (Prevents duplicate processing and replay attacks)
CREATE TABLE IF NOT EXISTS payment_webhooks (
    webhook_id TEXT PRIMARY KEY,
    business_id TEXT REFERENCES businesses(id),
    event_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT CHECK(status IN ('processed', 'ignored', 'failed')) DEFAULT 'processed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Customer Preferences & Consent Logs (DPDP Act Compliance)
CREATE TABLE IF NOT EXISTS customer_consents (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES loyalty_customers(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_consent_granted INTEGER DEFAULT 1,
    marketing_consent_granted INTEGER DEFAULT 0,
    consent_version TEXT NOT NULL DEFAULT '2026_DPDP_V1',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consents_customer ON customer_consents(customer_id);
