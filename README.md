# YBGP Loyalty — Production Multi-Tenant Digital Stamp & Business Hub SaaS

**Brand**: YBGP — Your Business Growth Partner  
**Website**: [https://ybgp.in](https://ybgp.in)  
**Product**: YBGP Loyalty — Digital Stamp Cards, Business Links Hub & Customer Engagement SaaS  
**Target Market**: Indian local businesses (Retailers, Cafés, Salons, Bakeries, Restaurants, Sweet Shops, Gyms) using **₹ INR**, **+91** Indian mobile numbers, and **Asia/Kolkata** (IST) timezone.

---

## 1. Production Architecture Overview

The system is architected as a secure, high-performance modular monolith with strict tenant isolation, server-enforced role-based access control (RBAC), and ACID-compliant transaction ledgers.

```
+--------------------------------------------------------------------------------+
|                                 CLIENT TIER                                     |
|  - Customer Public Hub (/b/:slug): Bio Links, Google Reviews, Phone, WhatsApp  |
|  - Digital Stamp Card Pass (/card/:token): Animated stamp grid, scannable QR   |
|  - Merchant Dashboard: Mobile-first HTML5 camera scanner, ledger, standee      |
|  - YBGP Super Admin: Multi-tenant oversight, MRR metrics, audit trails         |
+--------------------------------------------------------------------------------+
                                       |
                          HTTPS REST API (/api/v1/*)
                                       v
+--------------------------------------------------------------------------------+
|                                BACKEND TIER                                    |
|  - Express / Cloudflare Workers: Typed route controllers & input validation    |
|  - Security & Auth: Session tokens, SHA-256 QR token hashing, URL sanitizer    |
|  - Concurrency & Fraud Guards: Stable idempotency ledger, velocity checks      |
|  - OTP Challenge Engine: Rate limiting, SHA-256 hashed challenges, DPDP logs   |
+--------------------------------------------------------------------------------+
                                       |
                          ACID SQL Transactions
                                       v
+--------------------------------------------------------------------------------+
|                               DATABASE TIER                                    |
|  - Node 22 node:sqlite (Container / Cloud Run) & Cloudflare D1 (Serverless)   |
|  - Migrations: 0001_initial_schema.sql & 0002_production_hardening.sql        |
|  - Tables: users, businesses, locations, links, programs, cards, ledger, ...    |
+--------------------------------------------------------------------------------+
```

---

## 2. Multi-Tenant Database Schema & Migrations

The database schema is defined in versioned, ordered SQL migrations:
1. `src/migrations/0001_initial_schema.sql`: Core relational tables (`users`, `businesses`, `business_locations`, `business_memberships`, `business_links`, `loyalty_programs`, `loyalty_customers`, `loyalty_cards`, `stamp_transactions`, `rewards`, `reward_redemptions`, `subscriptions`, `audit_logs`).
2. `src/migrations/0002_production_hardening.sql`: Production security tables (`sessions`, `customer_sessions`, `qr_tokens`, `reward_entitlements`, `idempotency_keys`, `otp_challenges`, `payment_webhooks`, `customer_consents`).

### Key Schema Highlights
- **Hashed QR Token Registry (`qr_tokens`)**: Stores SHA-256 hashes of QR tokens rather than reusable bearer tokens to prevent token enumeration.
- **Reward Entitlements (`reward_entitlements`)**: Distinguishes earned reward entitlements from catalog definitions, ensuring each unlocked reward is redeemed atomically once.
- **Idempotency Ledger (`idempotency_keys`)**: Records idempotency keys and exact responses so repeated cashier taps return consistent responses without duplicate stamp awards.
- **Compensating Ledger (`stamp_transactions`)**: Append-only transaction records; reversals are stored as negative compensating transactions with mandatory audit reasons.

---

## 3. Security & Compliance (DPDP Act, 2023)

- **Customer Privacy**: Phone numbers are masked in all staff-facing views (`+91 ••••• ••123`). Raw QR tokens are never returned in public or staff customer list responses.
- **Hashed OTPs**: OTP codes are salted and hashed with SHA-256; plaintext codes are never stored in the database.
- **Fail-Closed in Production**: In production mode (`NODE_ENV=production`), simulated OTPs are disabled; real SMS delivery is required.
- **URL Sanitization**: Public bio links reject `javascript:`, `data:`, control characters, and arbitrary executable code to prevent stored XSS attacks.
- **Server-Side Authorization**: Roles (`owner`, `manager`, `cashier`, `platform_admin`) are verified on the server via cryptographic session tokens. Cashiers cannot reverse transactions, modify business settings, or alter billing.

---

## 4. Local Development & Setup

### Prerequisites
- Node.js $\ge 22.0.0$ (utilizes native `node:sqlite`)
- npm or bun

### Commands
```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite (28 passing tests)
npm test

# 3. Type check & lint
npm run lint

# 4. Build for production
npm run build

# 5. Start full-stack development server (Express + Vite on Port 3000)
npm run dev
```

---

## 5. Cloudflare Workers & D1 Deployment

To deploy to Cloudflare Workers with D1:
```bash
# 1. Create D1 database
npx wrangler d1 create ybgp-loyalty-production

# 2. Apply migrations to D1
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote

# 3. Deploy worker
npx wrangler deploy
```

---

## 6. Automated Test Suite (28 Tests Passing)

Run `npm test` to execute:
- **`src/__tests__/production-hardening.test.ts` (12 Tests)**:
  - Cross-tenant isolation verification.
  - Cashier privilege restrictions.
  - Revoked/invalid QR token rejection.
  - Customer list privacy (no raw QR tokens).
  - Production OTP bypass prevention.
  - Stable idempotency key duplicate prevention.
  - Atomic double-redemption prevention.
  - Reversal audit logging and cashier blocks.
  - Suspended business restrictions.
  - URL sanitization against XSS.
  - Public endpoint data leak prevention.
  - Payment webhook replay prevention.
- **`src/__tests__/loyalty.test.ts` (16 Tests)**:
  - Phone normalization to `+91XXXXXXXXXX`.
  - Customer DPDP consent registration.
  - Milestone reward unlocks.
  - Transaction ledger consistency.

---

## 7. Production Release Checklist

- [x] Server-authoritative Express API mounted at `/api/v1/*`.
- [x] Port 3000 configured with Vite dev middleware in development and static bundle in production.
- [x] Zero plaintext OTP storage; rate-limited SMS challenges with attempt caps.
- [x] Stable idempotency keys sent on scan awards to prevent double awards on retries.
- [x] Multi-tenant boundary checks on every merchant request.
- [x] Reversals require authorized role and minimum 5-character reason.
- [x] All 28 automated integration tests passing.
- [x] TypeScript compilation (`tsc --noEmit`) passing with 0 errors.
- [x] Production build (`vite build`) passing.
