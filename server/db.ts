/**
 * YBGP Loyalty - Server Relational Database Service
 * Uses Node 22 built-in node:sqlite with ACID transactions, foreign keys,
 * versioned SQL migrations, and strict tenant isolation.
 * Cloudflare D1 SQL compatible.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateId, generateQrToken, hashSha256 } from './security';
import { YBGP_CONFIG } from '../src/config/ybgp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ServerDatabase {
  public db: DatabaseSync;

  constructor(dbPath: string = 'database.sqlite') {
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.runMigrations();
    this.seedInitialData();
  }

  private runMigrations(): void {
    const migrationsDir = path.resolve(__dirname, '../src/migrations');
    const migrationFiles = ['0001_initial_schema.sql', '0002_production_hardening.sql'];

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        this.db.exec(sql);
      }
    }
  }

  public query<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  public execute(sql: string, params: (string | number | null)[] = []): { changes: number | bigint } {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  public transaction<T>(callback: () => T): T {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = callback();
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  private seedInitialData(): void {
    const existing = this.queryOne<{ count: number }>('SELECT count(*) as count FROM businesses;');
    if (existing && existing.count > 0) {
      return; // Already initialized
    }

    this.transaction(() => {
      // 1. Users
      const users = [
        {
          id: 'usr_admin',
          name: 'Aditya Sharma',
          email: 'admin@ybgp.in',
          phone: '+919876500001',
          role: 'platform_admin',
          business_id: null,
        },
        {
          id: 'usr_owner_chai',
          name: 'Vikram Sengupta',
          email: 'vikram@chaico.in',
          phone: '+919820011223',
          role: 'owner',
          business_id: 'biz_chaico',
        },
        {
          id: 'usr_mgr_chai',
          name: 'Priya Iyer',
          email: 'priya@chaico.in',
          phone: '+919820022334',
          role: 'manager',
          business_id: 'biz_chaico',
        },
        {
          id: 'usr_cashier_chai',
          name: 'Rohit Verma',
          email: 'rohit@chaico.in',
          phone: '+919820033445',
          role: 'cashier',
          business_id: 'biz_chaico',
        },
        {
          id: 'usr_owner_salon',
          name: 'Sameer Khan',
          email: 'sameer@royalshave.in',
          phone: '+919811122334',
          role: 'owner',
          business_id: 'biz_royalshave',
        },
      ];

      for (const u of users) {
        this.execute(
          'INSERT INTO users (id, name, email, phone, role, business_id) VALUES (?, ?, ?, ?, ?, ?);',
          [u.id, u.name, u.email, u.phone, u.role, u.business_id]
        );
      }

      // 2. Businesses
      const businesses = [
        {
          id: 'biz_chaico',
          slug: 'chai-co',
          name: 'Chai & Co. Artisanal Bakery',
          legal_name: 'Chai & Co Hospitality LLP',
          tagline: 'Artisanal Teas, Pour-Over Coffees & Fresh Sourdough Bakes',
          category: 'cafe',
          brand_color: '#B45309',
          status: 'active',
          plan_id: 'plan_growth',
          address: '742, 12th Main Road, Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560038',
          phone: '+919820011223',
          whatsapp: '919820011223',
          google_reviews_url: 'https://maps.google.com/?q=Chai+and+Co+Indiranagar+Bengaluru',
          instagram_handle: 'chaicobengaluru',
          website_url: 'https://chaico.in',
          opening_hours: 'Mon - Sun: 7:30 AM – 10:30 PM',
          announcement: '☕ Fresh cinnamon buns and iced cardamom brews restocked daily by 8 AM!',
        },
        {
          id: 'biz_royalshave',
          slug: 'royal-shave',
          name: 'Royal Shave Luxury Salon',
          legal_name: 'Royal Shave Grooming Pvt Ltd',
          tagline: 'Traditional Hot Towel Shaves, Hair Styling & Organic Spas',
          category: 'salon',
          brand_color: '#1E3A8A',
          status: 'active',
          plan_id: 'plan_starter',
          address: 'Shop 14, 5th Block, Koramangala',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560095',
          phone: '+919811122334',
          whatsapp: '919811122334',
          google_reviews_url: 'https://maps.google.com/?q=Royal+Shave+Koramangala+Bengaluru',
          instagram_handle: 'royalshavegrooming',
          website_url: 'https://royalshave.in',
          opening_hours: 'Tue - Sun: 9:00 AM – 9:00 PM (Monday Closed)',
          announcement: '✂️ Complimentary scalp massage with all beard grooming sessions this weekend.',
        },
        {
          id: 'biz_mithai',
          slug: 'mithai-mahal',
          name: 'Mithai Mahal Heritage Sweets',
          legal_name: 'Mithai Mahal Confectionery LLP',
          tagline: 'Pure Desi Ghee Sweets & Traditional Savories Since 1978',
          category: 'sweet_shop',
          brand_color: '#991B1B',
          status: 'active',
          plan_id: 'plan_pro',
          address: 'Block E, Inner Circle, Connaught Place',
          city: 'New Delhi',
          state: 'Delhi',
          pincode: '110001',
          phone: '+919810099887',
          whatsapp: '919810099887',
          google_reviews_url: 'https://maps.google.com/?q=Mithai+Mahal+Connaught+Place+Delhi',
          instagram_handle: 'mithaimahaldelhi',
          website_url: 'https://mithaimahal.in',
          opening_hours: 'Mon - Sun: 9:00 AM – 11:00 PM',
          announcement: '🪔 Festive Kaju Katli and Motichoor Ladoo gift hampers ready for corporate booking!',
        },
      ];

      for (const b of businesses) {
        this.execute(
          `INSERT INTO businesses (
            id, slug, name, legal_name, tagline, category, brand_color, status,
            plan_id, address, city, state, pincode, phone, whatsapp, google_reviews_url,
            instagram_handle, website_url, opening_hours, announcement
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            b.id, b.slug, b.name, b.legal_name, b.tagline, b.category, b.brand_color, b.status,
            b.plan_id, b.address, b.city, b.state, b.pincode, b.phone, b.whatsapp, b.google_reviews_url,
            b.instagram_handle, b.website_url, b.opening_hours, b.announcement
          ]
        );
      }

      // 3. Locations
      const locations = [
        {
          id: 'loc_chai_indiranagar',
          business_id: 'biz_chaico',
          name: 'Indiranagar Flagship',
          code: 'IND-01',
          address: '742, 12th Main Road, Indiranagar, Bengaluru',
          phone: '+919820011223',
          is_primary: 1,
        },
        {
          id: 'loc_chai_koramangala',
          business_id: 'biz_chaico',
          name: 'Koramangala Roastery',
          code: 'KOR-02',
          address: '80 Feet Road, 4th Block, Koramangala, Bengaluru',
          phone: '+919820011224',
          is_primary: 0,
        },
        {
          id: 'loc_salon_kora',
          business_id: 'biz_royalshave',
          name: 'Koramangala Main Studio',
          code: 'RS-KOR',
          address: 'Shop 14, 5th Block, Koramangala, Bengaluru',
          phone: '+919811122334',
          is_primary: 1,
        },
      ];

      for (const l of locations) {
        this.execute(
          'INSERT INTO business_locations (id, business_id, name, code, address, phone, is_primary) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [l.id, l.business_id, l.name, l.code, l.address, l.phone, l.is_primary]
        );
      }

      // 4. Memberships
      const memberships = [
        { id: 'mem_1', business_id: 'biz_chaico', user_id: 'usr_owner_chai', role: 'owner' },
        { id: 'mem_2', business_id: 'biz_chaico', user_id: 'usr_mgr_chai', role: 'manager', location_id: 'loc_chai_indiranagar' },
        { id: 'mem_3', business_id: 'biz_chaico', user_id: 'usr_cashier_chai', role: 'cashier', location_id: 'loc_chai_indiranagar' },
        { id: 'mem_4', business_id: 'biz_royalshave', user_id: 'usr_owner_salon', role: 'owner' },
      ];

      for (const m of memberships) {
        this.execute(
          'INSERT INTO business_memberships (id, business_id, user_id, role, location_id, status) VALUES (?, ?, ?, ?, ?, ?);',
          [m.id, m.business_id, m.user_id, m.role, m.location_id || null, 'active']
        );
      }

      // 5. Loyalty Programs & Rewards
      const programChai = {
        id: 'prg_chaico_coffee',
        business_id: 'biz_chaico',
        name: 'Chai & Co. Coffee Club',
        description: 'Earn 1 stamp for every visit (min ₹150 spend). Collect 8 stamps to unlock your reward!',
        stamp_target: 8,
        reward_title: 'Free Artisanal Coffee & Warm Butter Croissant',
        reward_description: 'Enjoy any signature pour-over or handcrafted espresso with our warm croissant.',
        min_spend: 15000,
      };

      this.execute(
        `INSERT INTO loyalty_programs (
          id, business_id, name, description, stamp_target, reward_title, reward_description, min_spend_in_paise, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active');`,
        [
          programChai.id, programChai.business_id, programChai.name, programChai.description,
          programChai.stamp_target, programChai.reward_title, programChai.reward_description, programChai.min_spend
        ]
      );

      this.execute(
        `INSERT INTO rewards (id, business_id, program_id, title, description, stamp_cost, terms, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1);`,
        [
          'rwd_chaico_1', 'biz_chaico', 'prg_chaico_coffee',
          'Free Artisanal Coffee & Warm Butter Croissant',
          'Any signature pour-over brew with freshly baked croissant.',
          8, 'Valid at Indiranagar & Koramangala branches.'
        ]
      );

      // 6. Links
      const links = [
        {
          id: 'lnk_c1',
          business_id: 'biz_chaico',
          title: 'Rate Us on Google Reviews',
          subtitle: 'Verified 4.9 ★ Rating · Indiranagar',
          url: 'https://maps.google.com/?q=Chai+and+Co+Indiranagar+Bengaluru',
          type: 'google_review',
          icon_name: 'star',
          sort_order: 1,
        },
        {
          id: 'lnk_c2',
          business_id: 'biz_chaico',
          title: 'WhatsApp Pre-Order & Seat Booking',
          subtitle: 'Chat directly with our barista team',
          url: 'https://wa.me/919820011223?text=Hi%20Chai%20%26%20Co%2C%20I%20would%20like%20to%20place%20an%20order',
          type: 'whatsapp',
          icon_name: 'message-circle',
          sort_order: 2,
        },
        {
          id: 'lnk_c3',
          business_id: 'biz_chaico',
          title: 'View Artisanal Bakery & Breakfast Menu',
          subtitle: 'Fresh bakes, sourdough toasts, single-origin brews',
          url: 'https://chaico.in/menu',
          type: 'menu',
          icon_name: 'coffee',
          sort_order: 3,
        },
      ];

      for (const l of links) {
        this.execute(
          'INSERT INTO business_links (id, business_id, title, subtitle, url, type, icon_name, sort_order, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1);',
          [l.id, l.business_id, l.title, l.subtitle, l.url, l.type, l.icon_name, l.sort_order]
        );
      }

      // 7. Sample Registered Patrons with Hashed QR Tokens
      const rawTokenAnanya = 'YBGP-CRD-ANANYA7890';
      const hashAnanya = hashSha256(rawTokenAnanya);

      this.execute(
        `INSERT INTO loyalty_customers (
          id, business_id, customer_token, name, phone_normalized, phone_masked, status, total_stamps_awarded, total_rewards_redeemed
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', 7, 0);`,
        ['cust_ananya', 'biz_chaico', 'CUST-TOKEN-ANANYA-7890', 'Ananya Deshmukh', '+919845012345', '+91 ••••• ••345']
      );

      this.execute(
        `INSERT INTO loyalty_cards (
          id, customer_id, business_id, program_id, current_stamps, total_lifetime_stamps, card_status, qr_token_hash, qr_token_raw
        ) VALUES (?, ?, ?, ?, 7, 7, 'active', ?, ?);`,
        ['crd_ananya_chai', 'cust_ananya', 'biz_chaico', 'prg_chaico_coffee', hashAnanya, rawTokenAnanya]
      );

      this.execute(
        'INSERT INTO qr_tokens (token_hash, card_id, customer_id, business_id) VALUES (?, ?, ?, ?);',
        [hashAnanya, 'crd_ananya_chai', 'cust_ananya', 'biz_chaico']
      );

      // Customer Rahul with 8/8 completed card and active Entitlement ready for redemption
      const rawTokenRahul = 'YBGP-CRD-RAHUL4321';
      const hashRahul = hashSha256(rawTokenRahul);

      this.execute(
        `INSERT INTO loyalty_customers (
          id, business_id, customer_token, name, phone_normalized, phone_masked, status, total_stamps_awarded, total_rewards_redeemed
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', 8, 0);`,
        ['cust_rahul', 'biz_chaico', 'CUST-TOKEN-RAHUL-4321', 'Rahul Kulkarni', '+919876543210', '+91 ••••• ••210']
      );

      this.execute(
        `INSERT INTO loyalty_cards (
          id, customer_id, business_id, program_id, current_stamps, total_lifetime_stamps, card_status, qr_token_hash, qr_token_raw
        ) VALUES (?, ?, ?, ?, 8, 8, 'completed', ?, ?);`,
        ['crd_rahul_chai', 'cust_rahul', 'biz_chaico', 'prg_chaico_coffee', hashRahul, rawTokenRahul]
      );

      this.execute(
        'INSERT INTO qr_tokens (token_hash, card_id, customer_id, business_id) VALUES (?, ?, ?, ?);',
        [hashRahul, 'crd_rahul_chai', 'cust_rahul', 'biz_chaico']
      );

      // Create pre-existing earned entitlement for Rahul
      this.execute(
        `INSERT INTO reward_entitlements (
          id, business_id, customer_id, card_id, reward_id, reward_title, stamp_cost, status, earned_at_stamps
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', 8);`,
        ['ent_rahul_coffee', 'biz_chaico', 'cust_rahul', 'crd_rahul_chai', 'rwd_chaico_1', 'Free Artisanal Coffee & Warm Butter Croissant', 8]
      );

      // 8. Initial Subscriptions
      this.execute(
        `INSERT INTO subscriptions (id, business_id, plan_id, status, current_period_start, current_period_end)
         VALUES ('sub_chai', 'biz_chaico', 'plan_growth', 'active', CURRENT_TIMESTAMP, datetime('now', '+1 year'));`
      );
      this.execute(
        `INSERT INTO subscriptions (id, business_id, plan_id, status, current_period_start, current_period_end)
         VALUES ('sub_royal', 'biz_royalshave', 'plan_starter', 'active', CURRENT_TIMESTAMP, datetime('now', '+1 year'));`
      );
      this.execute(
        `INSERT INTO subscriptions (id, business_id, plan_id, status, current_period_start, current_period_end)
         VALUES ('sub_mithai', 'biz_mithai', 'plan_pro', 'active', CURRENT_TIMESTAMP, datetime('now', '+1 year'));`
      );

      // 9. Initial Audit Log
      this.execute(
        `INSERT INTO audit_logs (id, business_id, user_id, user_name, actor_type, action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        ['log_init', 'biz_chaico', 'usr_admin', 'Aditya Sharma (Platform Admin)', 'admin', 'SYSTEM_INITIALIZED', 'database', 'system', 'YBGP production database schema and initial tenants initialized.']
      );
    });
  }
}

// Global server database instance
export const serverDb = new ServerDatabase(
  process.env.NODE_ENV === 'test' ? ':memory:' : 'database.sqlite'
);
