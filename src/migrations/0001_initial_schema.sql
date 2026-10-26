-- ====================================================================
-- YBGP Loyalty - Multi-Tenant Relational Database Schema
-- Migration: 0001_initial_schema.sql
-- Target: Cloudflare D1 (SQLite) / PostgreSQL Compatible
-- ====================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    role TEXT CHECK(role IN ('platform_admin', 'owner', 'manager', 'cashier')) NOT NULL,
    business_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Businesses Table
CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    tagline TEXT,
    category TEXT NOT NULL,
    logo_url TEXT,
    cover_url TEXT,
    brand_color TEXT DEFAULT '#0F172A',
    status TEXT CHECK(status IN ('active', 'trial', 'suspended')) DEFAULT 'active',
    plan_id TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    google_reviews_url TEXT NOT NULL,
    instagram_handle TEXT,
    website_url TEXT,
    opening_hours TEXT NOT NULL,
    announcement TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);

-- 3. Business Locations
CREATE TABLE IF NOT EXISTS business_locations (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locations_business ON business_locations(business_id);

-- 4. Business Memberships (Staff RBAC)
CREATE TABLE IF NOT EXISTS business_memberships (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT CHECK(role IN ('owner', 'manager', 'cashier')) NOT NULL,
    location_id TEXT REFERENCES business_locations(id),
    status TEXT CHECK(status IN ('active', 'invited', 'revoked')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON business_memberships(business_id, user_id);

-- 5. Business Links (Public Link-in-Bio Hub)
CREATE TABLE IF NOT EXISTS business_links (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT,
    url TEXT NOT NULL,
    type TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_enabled INTEGER DEFAULT 1,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_links_business ON business_links(business_id, sort_order);

-- 6. Loyalty Programs
CREATE TABLE IF NOT EXISTS loyalty_programs (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    stamp_target INTEGER NOT NULL DEFAULT 8,
    reward_title TEXT NOT NULL,
    reward_description TEXT,
    min_spend_in_paise INTEGER DEFAULT 0,
    max_stamps_per_day INTEGER DEFAULT 2,
    stamp_expiry_days INTEGER DEFAULT 180,
    terms_and_conditions TEXT,
    status TEXT CHECK(status IN ('active', 'draft', 'archived')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_programs_business ON loyalty_programs(business_id, status);

-- 7. Loyalty Customers (Scoped by Business Tenant)
CREATE TABLE IF NOT EXISTS loyalty_customers (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_token TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone_normalized TEXT NOT NULL,
    phone_masked TEXT NOT NULL,
    status TEXT CHECK(status IN ('active', 'blocked')) DEFAULT 'active',
    total_stamps_awarded INTEGER DEFAULT 0,
    total_rewards_redeemed INTEGER DEFAULT 0,
    consent_given_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_visit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, phone_normalized)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON loyalty_customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_token ON loyalty_customers(customer_token);

-- 8. Loyalty Cards
CREATE TABLE IF NOT EXISTS loyalty_cards (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES loyalty_customers(id) ON DELETE CASCADE,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    program_id TEXT NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    current_stamps INTEGER DEFAULT 0,
    total_lifetime_stamps INTEGER DEFAULT 0,
    card_status TEXT CHECK(card_status IN ('active', 'completed', 'expired')) DEFAULT 'active',
    qr_token_hash TEXT UNIQUE NOT NULL,
    qr_token_raw TEXT,
    last_stamped_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cards_customer ON loyalty_cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_cards_qr ON loyalty_cards(qr_token_hash);

-- 9. Append-Only Stamp Transactions Ledger
CREATE TABLE IF NOT EXISTS stamp_transactions (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES loyalty_cards(id),
    customer_id TEXT NOT NULL REFERENCES loyalty_customers(id),
    customer_name TEXT NOT NULL,
    location_id TEXT NOT NULL REFERENCES business_locations(id),
    location_name TEXT NOT NULL,
    staff_user_id TEXT NOT NULL REFERENCES users(id),
    staff_name TEXT NOT NULL,
    stamps_awarded INTEGER NOT NULL,
    type TEXT CHECK(type IN ('award', 'reversal', 'bonus')) NOT NULL,
    idempotency_key TEXT UNIQUE,
    reversal_reason TEXT,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON stamp_transactions(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_card ON stamp_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON stamp_transactions(idempotency_key);

-- 10. Rewards Catalog
CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    program_id TEXT NOT NULL REFERENCES loyalty_programs(id),
    title TEXT NOT NULL,
    description TEXT,
    stamp_cost INTEGER NOT NULL,
    terms TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rewards_tenant ON rewards(business_id, is_active);

-- 11. Reward Redemptions Ledger
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES loyalty_customers(id),
    customer_name TEXT NOT NULL,
    card_id TEXT NOT NULL REFERENCES loyalty_cards(id),
    reward_id TEXT NOT NULL REFERENCES rewards(id),
    reward_title TEXT NOT NULL,
    location_id TEXT NOT NULL,
    location_name TEXT NOT NULL,
    staff_user_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    status TEXT CHECK(status IN ('redeemed', 'cancelled')) DEFAULT 'redeemed',
    redemption_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_redemptions_tenant ON reward_redemptions(business_id, created_at);

-- 12. Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    business_id TEXT UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT CHECK(status IN ('active', 'trial', 'past_due', 'cancelled')) DEFAULT 'trial',
    current_period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP,
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Audit Logs (Platform & Tenant Security)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    business_id TEXT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    actor_type TEXT CHECK(actor_type IN ('merchant', 'admin', 'customer', 'system')) NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(business_id, created_at);

-- 14. OTP Verifications
CREATE TABLE IF NOT EXISTS otp_verifications (
    id TEXT PRIMARY KEY,
    phone_normalized TEXT NOT NULL,
    business_id TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    purpose TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER DEFAULT 0,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_lookup ON otp_verifications(phone_normalized, otp_code);
