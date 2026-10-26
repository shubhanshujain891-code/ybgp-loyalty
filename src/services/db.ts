/**
 * YBGP Loyalty - Multi-Tenant Relational Database Service
 * Implements strict tenant isolation, transactional ledgers, idempotency,
 * and persistent storage with realistic Indian business seed data.
 */

import {
  User,
  Business,
  BusinessLocation,
  BusinessMembership,
  BusinessLink,
  LoyaltyProgram,
  LoyaltyCustomer,
  LoyaltyCard,
  StampTransaction,
  Reward,
  RewardRedemption,
  SubscriptionPlan,
  Subscription,
  AuditLog,
  OtpVerification,
  PlatformSettings,
} from '../types';
import { YBGP_CONFIG } from '../config/ybgp';

const DB_STORAGE_KEY = 'ybgp_loyalty_database_v1';

export interface DatabaseState {
  users: User[];
  businesses: Business[];
  locations: BusinessLocation[];
  memberships: BusinessMembership[];
  links: BusinessLink[];
  programs: LoyaltyProgram[];
  customers: LoyaltyCustomer[];
  cards: LoyaltyCard[];
  stampTransactions: StampTransaction[];
  rewards: Reward[];
  redemptions: RewardRedemption[];
  plans: SubscriptionPlan[];
  subscriptions: Subscription[];
  auditLogs: AuditLog[];
  otpVerifications: OtpVerification[];
  platformSettings: PlatformSettings;
}

// Generate secure random opaque identifiers
export function generateId(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${result}`;
}

export function generateQrToken(): string {
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase() + 
                     Math.random().toString(36).substring(2, 10).toUpperCase();
  return `YBGP-CRD-${randomPart}`;
}

// Simple deterministic hash for QR token verification
export function hashToken(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(16);
}

// Normalize phone to +91XXXXXXXXXX
export function normalizeIndianPhone(input: string): string {
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

export function maskPhone(phone: string): string {
  const norm = normalizeIndianPhone(phone);
  if (norm.length >= 13) {
    // +919876543210 -> +91 ••••• ••210
    const last3 = norm.slice(-3);
    return `+91 ••••• ••${last3}`;
  }
  return phone;
}

// Initial Seed Data representing Indian Local Businesses
const INITIAL_SEED: DatabaseState = {
  users: [
    {
      id: 'usr_admin',
      name: 'Aditya Sharma',
      email: 'admin@ybgp.in',
      phone: '+919876500001',
      role: 'platform_admin',
      createdAt: '2026-01-10T10:00:00Z',
    },
    {
      id: 'usr_owner_chai',
      name: 'Vikram Sengupta',
      email: 'vikram@chaico.in',
      phone: '+919820011223',
      role: 'owner',
      businessId: 'biz_chaico',
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'usr_mgr_chai',
      name: 'Priya Iyer',
      email: 'priya@chaico.in',
      phone: '+919820022334',
      role: 'manager',
      businessId: 'biz_chaico',
      createdAt: '2026-02-05T12:00:00Z',
    },
    {
      id: 'usr_cashier_chai',
      name: 'Rohit Verma',
      email: 'rohit@chaico.in',
      phone: '+919820033445',
      role: 'cashier',
      businessId: 'biz_chaico',
      createdAt: '2026-02-10T09:00:00Z',
    },
    {
      id: 'usr_owner_salon',
      name: 'Sameer Khan',
      email: 'sameer@royalshave.in',
      phone: '+919811122334',
      role: 'owner',
      businessId: 'biz_royalshave',
      createdAt: '2026-02-15T14:00:00Z',
    },
  ],
  businesses: [
    {
      id: 'biz_chaico',
      slug: 'chai-co',
      name: 'Chai & Co. Artisanal Bakery',
      legalName: 'Chai & Co Hospitality LLP',
      tagline: 'Artisanal Teas, Pour-Over Coffees & Fresh Sourdough Bakes',
      category: 'cafe',
      brandColor: '#B45309', // Warm artisan amber
      status: 'active',
      planId: 'plan_growth',
      address: '742, 12th Main Road, Indiranagar',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      phone: '+919820011223',
      whatsapp: '919820011223',
      googleReviewsUrl: 'https://maps.google.com/?q=Chai+and+Co+Indiranagar+Bengaluru',
      instagramHandle: 'chaicobengaluru',
      websiteUrl: 'https://chaico.in',
      openingHours: 'Mon - Sun: 7:30 AM – 10:30 PM',
      announcement: '☕ Fresh cinnamon buns and iced cardamom brews restocked daily by 8 AM!',
      createdAt: '2026-02-01T11:30:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
    },
    {
      id: 'biz_royalshave',
      slug: 'royal-shave',
      name: 'Royal Shave Luxury Salon',
      legalName: 'Royal Shave Grooming Pvt Ltd',
      tagline: 'Traditional Hot Towel Shaves, Hair Styling & Organic Spas',
      category: 'salon',
      brandColor: '#1E3A8A', // Classic royal navy
      status: 'active',
      planId: 'plan_starter',
      address: 'Shop 14, 5th Block, Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560095',
      phone: '+919811122334',
      whatsapp: '919811122334',
      googleReviewsUrl: 'https://maps.google.com/?q=Royal+Shave+Koramangala+Bengaluru',
      instagramHandle: 'royalshavegrooming',
      websiteUrl: 'https://royalshave.in',
      openingHours: 'Tue - Sun: 9:00 AM – 9:00 PM (Monday Closed)',
      announcement: '✂️ Complimentary scalp massage with all beard grooming sessions this weekend.',
      createdAt: '2026-02-15T14:00:00Z',
      updatedAt: '2026-03-02T11:00:00Z',
    },
    {
      id: 'biz_mithai',
      slug: 'mithai-mahal',
      name: 'Mithai Mahal Heritage Sweets',
      legalName: 'Mithai Mahal Confectionery LLP',
      tagline: 'Pure Desi Ghee Sweets & Traditional Savories Since 1978',
      category: 'sweet_shop',
      brandColor: '#991B1B', // Rich heritage maroon
      status: 'active',
      planId: 'plan_pro',
      address: 'Block E, Inner Circle, Connaught Place',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
      phone: '+919810099887',
      whatsapp: '919810099887',
      googleReviewsUrl: 'https://maps.google.com/?q=Mithai+Mahal+Connaught+Place+Delhi',
      instagramHandle: 'mithaimahaldelhi',
      websiteUrl: 'https://mithaimahal.in',
      openingHours: 'Mon - Sun: 9:00 AM – 11:00 PM',
      announcement: '🪔 Festive Kaju Katli and Motichoor Ladoo gift hampers ready for corporate booking!',
      createdAt: '2026-01-20T10:00:00Z',
      updatedAt: '2026-03-05T09:30:00Z',
    },
  ],
  locations: [
    {
      id: 'loc_chai_indiranagar',
      businessId: 'biz_chaico',
      name: 'Indiranagar Flagship',
      code: 'IND-01',
      address: '742, 12th Main Road, Indiranagar, Bengaluru',
      phone: '+919820011223',
      isPrimary: true,
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'loc_chai_koramangala',
      businessId: 'biz_chaico',
      name: 'Koramangala Roastery',
      code: 'KOR-02',
      address: '80 Feet Road, 4th Block, Koramangala, Bengaluru',
      phone: '+919820011224',
      isPrimary: false,
      createdAt: '2026-02-20T10:00:00Z',
    },
    {
      id: 'loc_salon_kora',
      businessId: 'biz_royalshave',
      name: 'Koramangala Main Studio',
      code: 'RS-KOR',
      address: 'Shop 14, 5th Block, Koramangala, Bengaluru',
      phone: '+919811122334',
      isPrimary: true,
      createdAt: '2026-02-15T14:00:00Z',
    },
    {
      id: 'loc_mithai_cp',
      businessId: 'biz_mithai',
      name: 'Connaught Place Heritage Store',
      code: 'MM-CP',
      address: 'Block E, Inner Circle, Connaught Place, New Delhi',
      phone: '+919810099887',
      isPrimary: true,
      createdAt: '2026-01-20T10:00:00Z',
    },
  ],
  memberships: [
    {
      id: 'mem_1',
      businessId: 'biz_chaico',
      userId: 'usr_owner_chai',
      role: 'owner',
      status: 'active',
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'mem_2',
      businessId: 'biz_chaico',
      userId: 'usr_mgr_chai',
      role: 'manager',
      locationId: 'loc_chai_indiranagar',
      status: 'active',
      createdAt: '2026-02-05T12:00:00Z',
    },
    {
      id: 'mem_3',
      businessId: 'biz_chaico',
      userId: 'usr_cashier_chai',
      role: 'cashier',
      locationId: 'loc_chai_indiranagar',
      status: 'active',
      createdAt: '2026-02-10T09:00:00Z',
    },
    {
      id: 'mem_4',
      businessId: 'biz_royalshave',
      userId: 'usr_owner_salon',
      role: 'owner',
      status: 'active',
      createdAt: '2026-02-15T14:00:00Z',
    },
  ],
  links: [
    {
      id: 'lnk_c1',
      businessId: 'biz_chaico',
      title: 'Rate Us on Google Reviews',
      subtitle: 'Verified 4.9 ★ Rating · Indiranagar',
      url: 'https://maps.google.com/?q=Chai+and+Co+Indiranagar+Bengaluru',
      type: 'google_review',
      iconName: 'star',
      sortOrder: 1,
      isEnabled: true,
      clickCount: 420,
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'lnk_c2',
      businessId: 'biz_chaico',
      title: 'WhatsApp Pre-Order & Seat Booking',
      subtitle: 'Chat directly with our barista team',
      url: 'https://wa.me/919820011223?text=Hi%20Chai%20%26%20Co%2C%20I%20would%20like%20to%20place%20an%20order',
      type: 'whatsapp',
      iconName: 'message-circle',
      sortOrder: 2,
      isEnabled: true,
      clickCount: 680,
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'lnk_c3',
      businessId: 'biz_chaico',
      title: 'View Artisanal Bakery & Breakfast Menu',
      subtitle: 'Fresh bakes, sourdough toasts, single-origin brews',
      url: 'https://chaico.in/menu',
      type: 'menu',
      iconName: 'coffee',
      sortOrder: 3,
      isEnabled: true,
      clickCount: 890,
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'lnk_c4',
      businessId: 'biz_chaico',
      title: 'Follow @chaicobengaluru on Instagram',
      subtitle: 'Daily morning bake stories & brewing workshops',
      url: 'https://instagram.com/chaicobengaluru',
      type: 'instagram',
      iconName: 'instagram',
      sortOrder: 4,
      isEnabled: true,
      clickCount: 310,
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'lnk_c5',
      businessId: 'biz_chaico',
      title: 'Get Directions on Google Maps',
      subtitle: 'Near 12th Main BDA Complex, Indiranagar',
      url: 'https://maps.google.com/?q=Indiranagar+Bengaluru',
      type: 'map',
      iconName: 'map-pin',
      sortOrder: 5,
      isEnabled: true,
      clickCount: 520,
      createdAt: '2026-02-01T11:30:00Z',
    },
    // Royal Shave links
    {
      id: 'lnk_r1',
      businessId: 'biz_royalshave',
      title: 'Review Us on Google',
      subtitle: 'Help neighbors find quality grooming',
      url: 'https://maps.google.com/?q=Royal+Shave+Koramangala+Bengaluru',
      type: 'google_review',
      iconName: 'star',
      sortOrder: 1,
      isEnabled: true,
      clickCount: 230,
      createdAt: '2026-02-15T14:00:00Z',
    },
    {
      id: 'lnk_r2',
      businessId: 'biz_royalshave',
      title: 'Book Grooming Appointment on WhatsApp',
      subtitle: 'Instant slot confirmation',
      url: 'https://wa.me/919811122334?text=Hi%20Royal%20Shave%2C%20I%20want%20to%20book%20a%20slot',
      type: 'whatsapp',
      iconName: 'message-circle',
      sortOrder: 2,
      isEnabled: true,
      clickCount: 390,
      createdAt: '2026-02-15T14:00:00Z',
    },
  ],
  programs: [
    {
      id: 'prg_chaico_coffee',
      businessId: 'biz_chaico',
      name: 'Chai & Co. Coffee Club',
      description: 'Earn 1 stamp for every beverage or breakfast visit (min ₹150 spend). Collect 8 stamps to unlock your reward!',
      stampTarget: 8,
      rewardTitle: 'Free Artisanal Coffee & Warm Butter Croissant',
      rewardDescription: 'Enjoy any signature pour-over or handcrafted espresso with our freshly baked butter croissant on the house.',
      minSpendInPaise: 15000,
      maxStampsPerDay: 2,
      stampExpiryDays: 180,
      termsAndConditions: 'Stamps awarded on bills above ₹150. Valid at Indiranagar & Koramangala branches. Reward redeemable within 30 days of unlocking.',
      status: 'active',
      createdAt: '2026-02-01T11:30:00Z',
      updatedAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'prg_royal_shave',
      businessId: 'biz_royalshave',
      name: 'Gentlemen’s Grooming Circle',
      description: 'Collect 6 stamps on any haircut or grooming service to unlock a luxury beard styling & hair spa session.',
      stampTarget: 6,
      rewardTitle: 'Free Organic Hair Spa & Hot Towel Beard Grooming',
      rewardDescription: 'Complete 45-minute revitalizing hair spa treatment with essential oils and hot towel finish.',
      minSpendInPaise: 35000,
      maxStampsPerDay: 1,
      stampExpiryDays: 365,
      termsAndConditions: 'Valid on services above ₹350. One stamp per appointment.',
      status: 'active',
      createdAt: '2026-02-15T14:00:00Z',
      updatedAt: '2026-02-15T14:00:00Z',
    },
    {
      id: 'prg_mithai_sweet',
      businessId: 'biz_mithai',
      name: 'Mithai Mahal Sweet Rewards',
      description: 'Earn stamps on festival and daily sweet purchases. 10 stamps unlocks a signature 500g Kaju Katli gift box.',
      stampTarget: 10,
      rewardTitle: 'Free 500g Premium Silver Leaf Kaju Katli Box',
      rewardDescription: 'Handcrafted with Goan cashews and pure Desi Ghee.',
      minSpendInPaise: 25000,
      maxStampsPerDay: 3,
      stampExpiryDays: 120,
      termsAndConditions: 'Minimum purchase of ₹250. Valid at Connaught Place heritage outlet.',
      status: 'active',
      createdAt: '2026-01-20T10:00:00Z',
      updatedAt: '2026-01-20T10:00:00Z',
    },
  ],
  customers: [
    {
      id: 'cust_ananya',
      businessId: 'biz_chaico',
      customerToken: 'CUST-TOKEN-ANANYA-7890',
      name: 'Ananya Deshmukh',
      phoneNormalized: '+919845012345',
      phoneMasked: '+91 ••••• ••345',
      status: 'active',
      totalStampsAwarded: 7,
      totalRewardsRedeemed: 0,
      consentGivenAt: '2026-02-12T14:20:00Z',
      lastVisitAt: '2026-03-08T09:15:00Z',
      createdAt: '2026-02-12T14:20:00Z',
    },
    {
      id: 'cust_rahul',
      businessId: 'biz_chaico',
      customerToken: 'CUST-TOKEN-RAHUL-4321',
      name: 'Rahul Kulkarni',
      phoneNormalized: '+919876543210',
      phoneMasked: '+91 ••••• ••210',
      status: 'active',
      totalStampsAwarded: 8,
      totalRewardsRedeemed: 1,
      consentGivenAt: '2026-02-08T16:00:00Z',
      lastVisitAt: '2026-03-09T18:30:00Z',
      createdAt: '2026-02-08T16:00:00Z',
    },
    {
      id: 'cust_tanvi',
      businessId: 'biz_chaico',
      customerToken: 'CUST-TOKEN-TANVI-9911',
      name: 'Tanvi Nair',
      phoneNormalized: '+919819988776',
      phoneMasked: '+91 ••••• ••776',
      status: 'active',
      totalStampsAwarded: 3,
      totalRewardsRedeemed: 0,
      consentGivenAt: '2026-02-25T11:00:00Z',
      lastVisitAt: '2026-03-04T12:00:00Z',
      createdAt: '2026-02-25T11:00:00Z',
    },
  ],
  cards: [
    {
      id: 'crd_ananya_chai',
      customerId: 'cust_ananya',
      businessId: 'biz_chaico',
      programId: 'prg_chaico_coffee',
      currentStamps: 7, // 1 stamp away from reward!
      totalLifetimeStamps: 7,
      cardStatus: 'active',
      qrTokenHash: hashToken('YBGP-CRD-ANANYA7890'),
      qrTokenRaw: 'YBGP-CRD-ANANYA7890',
      lastStampedAt: '2026-03-08T09:15:00Z',
      createdAt: '2026-02-12T14:20:00Z',
    },
    {
      id: 'crd_rahul_chai',
      customerId: 'cust_rahul',
      businessId: 'biz_chaico',
      programId: 'prg_chaico_coffee',
      currentStamps: 8, // Fully ready for reward redemption!
      totalLifetimeStamps: 8,
      cardStatus: 'completed',
      qrTokenHash: hashToken('YBGP-CRD-RAHUL4321'),
      qrTokenRaw: 'YBGP-CRD-RAHUL4321',
      lastStampedAt: '2026-03-09T18:30:00Z',
      createdAt: '2026-02-08T16:00:00Z',
    },
    {
      id: 'crd_tanvi_chai',
      customerId: 'cust_tanvi',
      businessId: 'biz_chaico',
      programId: 'prg_chaico_coffee',
      currentStamps: 3,
      totalLifetimeStamps: 3,
      cardStatus: 'active',
      qrTokenHash: hashToken('YBGP-CRD-TANVI9911'),
      qrTokenRaw: 'YBGP-CRD-TANVI9911',
      lastStampedAt: '2026-03-04T12:00:00Z',
      createdAt: '2026-02-25T11:00:00Z',
    },
  ],
  stampTransactions: [
    {
      id: 'tx_st_1',
      businessId: 'biz_chaico',
      cardId: 'crd_ananya_chai',
      customerId: 'cust_ananya',
      customerName: 'Ananya Deshmukh',
      locationId: 'loc_chai_indiranagar',
      locationName: 'Indiranagar Flagship',
      staffUserId: 'usr_cashier_chai',
      staffName: 'Rohit Verma',
      stampsAwarded: 1,
      type: 'award',
      idempotencyKey: 'idem_init_1',
      note: 'Morning filter coffee & pain au chocolat',
      createdAt: '2026-03-08T09:15:00Z',
    },
    {
      id: 'tx_st_2',
      businessId: 'biz_chaico',
      cardId: 'crd_rahul_chai',
      customerId: 'cust_rahul',
      customerName: 'Rahul Kulkarni',
      locationId: 'loc_chai_indiranagar',
      locationName: 'Indiranagar Flagship',
      staffUserId: 'usr_cashier_chai',
      staffName: 'Rohit Verma',
      stampsAwarded: 1,
      type: 'award',
      idempotencyKey: 'idem_init_2',
      note: 'Pour-over Chemex & sourdough toast',
      createdAt: '2026-03-09T18:30:00Z',
    },
  ],
  rewards: [
    {
      id: 'rwd_chaico_1',
      businessId: 'biz_chaico',
      programId: 'prg_chaico_coffee',
      title: 'Free Artisanal Coffee & Warm Butter Croissant',
      description: 'Any signature specialty latte, flat white, or pour-over brew with a fresh warm butter croissant.',
      stampCost: 8,
      terms: 'Valid for dine-in or takeaway at Chai & Co. Indiranagar & Koramangala branches.',
      isActive: true,
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'rwd_royal_1',
      businessId: 'biz_royalshave',
      programId: 'prg_royal_shave',
      title: 'Free Organic Hair Spa & Hot Towel Beard Grooming',
      description: 'Full 45-minute luxury hair & beard revitalizing treatment.',
      stampCost: 6,
      terms: 'Appointment required via WhatsApp.',
      isActive: true,
      createdAt: '2026-02-15T14:00:00Z',
    },
  ],
  redemptions: [
    {
      id: 'rdm_sample_1',
      businessId: 'biz_chaico',
      customerId: 'cust_rahul',
      customerName: 'Rahul Kulkarni',
      cardId: 'crd_rahul_chai',
      rewardId: 'rwd_chaico_1',
      rewardTitle: 'Free Artisanal Coffee & Warm Butter Croissant',
      locationId: 'loc_chai_indiranagar',
      locationName: 'Indiranagar Flagship',
      staffUserId: 'usr_cashier_chai',
      staffName: 'Rohit Verma',
      status: 'redeemed',
      redemptionCode: 'YBGP-RWD-8492',
      createdAt: '2026-02-28T17:40:00Z',
    },
  ],
  plans: YBGP_CONFIG.plans,
  subscriptions: [
    {
      id: 'sub_chai',
      businessId: 'biz_chaico',
      planId: 'plan_growth',
      status: 'active',
      currentPeriodStart: '2026-02-01T00:00:00Z',
      currentPeriodEnd: '2027-02-01T00:00:00Z',
      trialEndsAt: '2026-02-15T00:00:00Z',
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'sub_royal',
      businessId: 'biz_royalshave',
      planId: 'plan_starter',
      status: 'active',
      currentPeriodStart: '2026-02-15T00:00:00Z',
      currentPeriodEnd: '2027-02-15T00:00:00Z',
      trialEndsAt: '2026-03-01T00:00:00Z',
      createdAt: '2026-02-15T14:00:00Z',
    },
    {
      id: 'sub_mithai',
      businessId: 'biz_mithai',
      planId: 'plan_pro',
      status: 'active',
      currentPeriodStart: '2026-01-20T00:00:00Z',
      currentPeriodEnd: '2027-01-20T00:00:00Z',
      trialEndsAt: '2026-02-04T00:00:00Z',
      createdAt: '2026-01-20T10:00:00Z',
    },
  ],
  auditLogs: [
    {
      id: 'log_1',
      businessId: 'biz_chaico',
      userId: 'usr_admin',
      userName: 'Aditya Sharma (Platform Admin)',
      actorType: 'admin',
      action: 'BUSINESS_PROVISIONED',
      entityType: 'business',
      entityId: 'biz_chaico',
      details: 'Provisioned Chai & Co with Growth Plan trial',
      createdAt: '2026-02-01T11:30:00Z',
    },
    {
      id: 'log_2',
      businessId: 'biz_chaico',
      userId: 'usr_owner_chai',
      userName: 'Vikram Sengupta (Owner)',
      actorType: 'merchant',
      action: 'LOYALTY_PROGRAM_LAUNCHED',
      entityType: 'loyalty_program',
      entityId: 'prg_chaico_coffee',
      details: 'Created Chai & Co. Coffee Club with target 8 stamps',
      createdAt: '2026-02-01T11:35:00Z',
    },
  ],
  otpVerifications: [],
  platformSettings: YBGP_CONFIG.defaultSettings,
};

class DatabaseService {
  private state: DatabaseState;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): DatabaseState {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(DB_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            ...INITIAL_SEED,
            ...parsed,
            plans: YBGP_CONFIG.plans,
            platformSettings: { ...YBGP_CONFIG.defaultSettings, ...(parsed.platformSettings || {}) },
          };
        }
      }
    } catch (e) {
      console.warn('Failed to load database from localStorage, initializing with seed data', e);
    }
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }

  private saveState(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(this.state));
      }
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Listener callback error', err);
      }
    });
  }

  public resetToSeed(): void {
    this.state = JSON.parse(JSON.stringify(INITIAL_SEED));
    this.saveState();
  }

  // --- QUERY & GETTERS ---
  public getState(): DatabaseState {
    return this.state;
  }

  public getUsers(): User[] {
    return this.state.users;
  }

  public getUserById(id: string): User | undefined {
    return this.state.users.find((u) => u.id === id);
  }

  public getBusinesses(): Business[] {
    return this.state.businesses;
  }

  public getBusinessById(id: string): Business | undefined {
    return this.state.businesses.find((b) => b.id === id);
  }

  public getBusinessBySlug(slug: string): Business | undefined {
    return this.state.businesses.find((b) => b.slug.toLowerCase() === slug.toLowerCase());
  }

  public getLocationsByBusiness(businessId: string): BusinessLocation[] {
    return this.state.locations.filter((l) => l.businessId === businessId);
  }

  public getMembershipsByBusiness(businessId: string): BusinessMembership[] {
    return this.state.memberships.filter((m) => m.businessId === businessId);
  }

  public getLinksByBusiness(businessId: string): BusinessLink[] {
    return this.state.links
      .filter((l) => l.businessId === businessId && l.isEnabled)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getAllLinksByBusiness(businessId: string): BusinessLink[] {
    return this.state.links
      .filter((l) => l.businessId === businessId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getActiveProgramByBusiness(businessId: string): LoyaltyProgram | undefined {
    return this.state.programs.find((p) => p.businessId === businessId && p.status === 'active');
  }

  public getAllProgramsByBusiness(businessId: string): LoyaltyProgram[] {
    return this.state.programs.filter((p) => p.businessId === businessId);
  }

  public getRewardsByBusiness(businessId: string): Reward[] {
    return this.state.rewards.filter((r) => r.businessId === businessId && r.isActive);
  }

  public getCustomersByBusiness(businessId: string): LoyaltyCustomer[] {
    return this.state.customers.filter((c) => c.businessId === businessId);
  }

  public getCustomerById(customerId: string): LoyaltyCustomer | undefined {
    return this.state.customers.find((c) => c.id === customerId);
  }

  public getCustomerByPhone(businessId: string, phone: string): LoyaltyCustomer | undefined {
    const norm = normalizeIndianPhone(phone);
    return this.state.customers.find((c) => c.businessId === businessId && c.phoneNormalized === norm);
  }

  public getCustomerCard(customerId: string, programId?: string): LoyaltyCard | undefined {
    return this.state.cards.find(
      (c) => c.customerId === customerId && (programId ? c.programId === programId : true)
    );
  }

  public getCardByQrToken(qrToken: string): { card: LoyaltyCard; customer: LoyaltyCustomer; business: Business; program: LoyaltyProgram } | null {
    const cleanToken = qrToken.trim();
    const card = this.state.cards.find((c) => c.qrTokenRaw === cleanToken);
    if (!card) return null;

    const customer = this.state.customers.find((c) => c.id === card.customerId);
    const business = this.state.businesses.find((b) => b.id === card.businessId);
    const program = this.state.programs.find((p) => p.id === card.programId);

    if (!customer || !business || !program) return null;

    return { card, customer, business, program };
  }

  public getStampTransactions(businessId: string): StampTransaction[] {
    return this.state.stampTransactions
      .filter((t) => t.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getRedemptions(businessId: string): RewardRedemption[] {
    return this.state.redemptions
      .filter((r) => r.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAuditLogs(businessId?: string): AuditLog[] {
    if (businessId) {
      return this.state.auditLogs
        .filter((l) => l.businessId === businessId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return [...this.state.auditLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getSubscriptionByBusiness(businessId: string): { subscription?: Subscription; plan?: SubscriptionPlan } {
    const sub = this.state.subscriptions.find((s) => s.businessId === businessId);
    const plan = this.state.plans.find((p) => p.id === sub?.planId) || this.state.plans[1];
    return { subscription: sub, plan };
  }

  // --- MUTATIONS WITH TENANT ISOLATION & AUDIT ---

  // 1. Customer Registration & Card Issuance (Public / Tenant Scoped)
  public registerCustomer(params: {
    businessId: string;
    name: string;
    phone: string;
    consentGiven: boolean;
  }): { customer: LoyaltyCustomer; card: LoyaltyCard; isNew: boolean } {
    const { businessId, name, phone, consentGiven } = params;
    if (!consentGiven) {
      throw new Error('DPDP consent is required to issue a digital loyalty card.');
    }

    const normPhone = normalizeIndianPhone(phone);
    const business = this.getBusinessById(businessId);
    if (!business) {
      throw new Error('Business not found or inactive.');
    }

    const program = this.getActiveProgramByBusiness(businessId);
    if (!program) {
      throw new Error('No active loyalty program found for this business.');
    }

    // Check if customer already exists for this business
    let customer = this.getCustomerByPhone(businessId, normPhone);
    let isNew = false;

    if (!customer) {
      isNew = true;
      const customerToken = `CUST-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;
      customer = {
        id: generateId('cust'),
        businessId,
        customerToken,
        name: name.trim(),
        phoneNormalized: normPhone,
        phoneMasked: maskPhone(normPhone),
        status: 'active',
        totalStampsAwarded: 0,
        totalRewardsRedeemed: 0,
        consentGivenAt: new Date().toISOString(),
        lastVisitAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      this.state.customers.push(customer);
    } else {
      // Update name if changed
      if (name.trim() && customer.name !== name.trim()) {
        customer.name = name.trim();
      }
      customer.lastVisitAt = new Date().toISOString();
    }

    // Find or create card
    let card = this.state.cards.find((c) => c.customerId === customer!.id && c.programId === program.id);
    if (!card) {
      const rawToken = generateQrToken();
      card = {
        id: generateId('crd'),
        customerId: customer.id,
        businessId,
        programId: program.id,
        currentStamps: 0,
        totalLifetimeStamps: 0,
        cardStatus: 'active',
        qrTokenRaw: rawToken,
        qrTokenHash: hashToken(rawToken),
        createdAt: new Date().toISOString(),
      };
      this.state.cards.push(card);
    }

    this.addAuditLog({
      businessId,
      userId: customer.id,
      userName: customer.name,
      actorType: 'customer',
      action: isNew ? 'CUSTOMER_REGISTERED' : 'CUSTOMER_CARD_ACCESSED',
      entityType: 'loyalty_card',
      entityId: card.id,
      details: `Customer registered/accessed digital stamp card for ${business.name}`,
    });

    this.saveState();
    return { customer, card, isNew };
  }

  // 2. Award Stamps (Merchant Scan Workflow with Idempotency & Tenant Enforcement)
  public awardStamps(params: {
    businessId: string;
    cardId: string;
    staffUser: User;
    locationId: string;
    stampsToAward?: number;
    idempotencyKey?: string;
    note?: string;
  }): {
    success: boolean;
    card: LoyaltyCard;
    transaction: StampTransaction;
    rewardUnlocked: boolean;
    rewardTitle?: string;
  } {
    const { businessId, cardId, staffUser, locationId, stampsToAward = 1, idempotencyKey, note } = params;

    // Validate staff tenant membership
    if (staffUser.role !== 'platform_admin' && staffUser.businessId !== businessId) {
      throw new Error('Unauthorized: Staff member does not belong to this business.');
    }

    const card = this.state.cards.find((c) => c.id === cardId && c.businessId === businessId);
    if (!card) {
      throw new Error('Loyalty card not found or belongs to another business.');
    }

    const program = this.state.programs.find((p) => p.id === card.programId);
    if (!program || program.status !== 'active') {
      throw new Error('This loyalty program is no longer active.');
    }

    const customer = this.state.customers.find((c) => c.id === card.customerId);
    if (!customer || customer.status === 'blocked') {
      throw new Error('Customer is suspended or inactive.');
    }

    // Check idempotency key to prevent accidental duplicate clicks
    if (idempotencyKey) {
      const existingTx = this.state.stampTransactions.find(
        (t) => t.idempotencyKey === idempotencyKey && t.businessId === businessId
      );
      if (existingTx) {
        return {
          success: true,
          card,
          transaction: existingTx,
          rewardUnlocked: card.currentStamps >= program.stampTarget,
          rewardTitle: program.rewardTitle,
        };
      }
    }

    const location = this.state.locations.find((l) => l.id === locationId) || {
      id: locationId,
      name: 'Main Outlet',
    };

    // Calculate new stamp count
    const previousStamps = card.currentStamps;
    const newStamps = previousStamps + stampsToAward;

    card.currentStamps = newStamps;
    card.totalLifetimeStamps += stampsToAward;
    card.lastStampedAt = new Date().toISOString();

    const rewardUnlocked = card.currentStamps >= program.stampTarget;
    if (rewardUnlocked) {
      card.cardStatus = 'completed';
    }

    customer.totalStampsAwarded += stampsToAward;
    customer.lastVisitAt = new Date().toISOString();

    // Create append-only transaction record
    const transaction: StampTransaction = {
      id: generateId('tx_st'),
      businessId,
      cardId: card.id,
      customerId: customer.id,
      customerName: customer.name,
      locationId: location.id,
      locationName: location.name,
      staffUserId: staffUser.id,
      staffName: staffUser.name,
      stampsAwarded: stampsToAward,
      type: 'award',
      idempotencyKey,
      note: note || `Awarded by ${staffUser.name} (${staffUser.role})`,
      createdAt: new Date().toISOString(),
    };

    this.state.stampTransactions.push(transaction);

    this.addAuditLog({
      businessId,
      userId: staffUser.id,
      userName: `${staffUser.name} (${staffUser.role})`,
      actorType: 'merchant',
      action: 'STAMPS_AWARDED',
      entityType: 'stamp_transaction',
      entityId: transaction.id,
      details: `Awarded ${stampsToAward} stamp(s) to ${customer.name}. New count: ${newStamps}/${program.stampTarget}.`,
    });

    this.saveState();

    return {
      success: true,
      card,
      transaction,
      rewardUnlocked,
      rewardTitle: program.rewardTitle,
    };
  }

  // 3. Redeem Reward (Atomic Transaction)
  public redeemReward(params: {
    businessId: string;
    cardId: string;
    rewardId: string;
    staffUser: User;
    locationId: string;
  }): { success: boolean; redemption: RewardRedemption; card: LoyaltyCard } {
    const { businessId, cardId, rewardId, staffUser, locationId } = params;

    if (staffUser.role !== 'platform_admin' && staffUser.businessId !== businessId) {
      throw new Error('Unauthorized: Staff member does not belong to this business.');
    }

    const card = this.state.cards.find((c) => c.id === cardId && c.businessId === businessId);
    if (!card) {
      throw new Error('Loyalty card not found.');
    }

    const program = this.state.programs.find((p) => p.id === card.programId);
    if (!program) {
      throw new Error('Program not found.');
    }

    const reward = this.state.rewards.find((r) => r.id === rewardId && r.businessId === businessId);
    if (!reward || !reward.isActive) {
      throw new Error('Reward not found or is currently inactive.');
    }

    if (card.currentStamps < reward.stampCost) {
      throw new Error(
        `Insufficient stamps. Requires ${reward.stampCost} stamps, customer has ${card.currentStamps}.`
      );
    }

    const customer = this.state.customers.find((c) => c.id === card.customerId);
    if (!customer) {
      throw new Error('Customer not found.');
    }

    const location = this.state.locations.find((l) => l.id === locationId) || {
      id: locationId,
      name: 'Main Outlet',
    };

    // Deduct stamps for reward and cycle card
    card.currentStamps = Math.max(0, card.currentStamps - reward.stampCost);
    card.cardStatus = 'active'; // Reset back to active for next cycle!

    customer.totalRewardsRedeemed += 1;

    const redemptionCode = `YBGP-RWD-${Math.floor(1000 + Math.random() * 9000)}`;

    const redemption: RewardRedemption = {
      id: generateId('rdm'),
      businessId,
      customerId: customer.id,
      customerName: customer.name,
      cardId: card.id,
      rewardId: reward.id,
      rewardTitle: reward.title,
      locationId: location.id,
      locationName: location.name,
      staffUserId: staffUser.id,
      staffName: staffUser.name,
      status: 'redeemed',
      redemptionCode,
      createdAt: new Date().toISOString(),
    };

    this.state.redemptions.push(redemption);

    this.addAuditLog({
      businessId,
      userId: staffUser.id,
      userName: `${staffUser.name} (${staffUser.role})`,
      actorType: 'merchant',
      action: 'REWARD_REDEEMED',
      entityType: 'reward_redemption',
      entityId: redemption.id,
      details: `Redeemed '${reward.title}' (Code: ${redemptionCode}) for ${customer.name}. Remaining stamps: ${card.currentStamps}.`,
    });

    this.saveState();
    return { success: true, redemption, card };
  }

  // 4. Reverse Stamp Transaction (Compensating Ledger Record with Mandatory Reason)
  public reverseStampTransaction(params: {
    businessId: string;
    transactionId: string;
    reversalReason: string;
    staffUser: User;
  }): { success: boolean; compensatingTransaction: StampTransaction; card: LoyaltyCard } {
    const { businessId, transactionId, reversalReason, staffUser } = params;

    if (!reversalReason || reversalReason.trim().length < 5) {
      throw new Error('A detailed reversal reason (at least 5 characters) is required for audit compliance.');
    }

    if (staffUser.role !== 'platform_admin' && staffUser.businessId !== businessId) {
      throw new Error('Unauthorized.');
    }

    // Cashiers cannot reverse without manager approval
    if (staffUser.role === 'cashier') {
      throw new Error('Permission denied: Cashiers cannot reverse transactions. Manager or Owner authorization required.');
    }

    const originalTx = this.state.stampTransactions.find(
      (t) => t.id === transactionId && t.businessId === businessId
    );
    if (!originalTx) {
      throw new Error('Original stamp transaction not found.');
    }

    if (originalTx.type === 'reversal') {
      throw new Error('Cannot reverse an existing reversal transaction.');
    }

    const card = this.state.cards.find((c) => c.id === originalTx.cardId);
    if (!card) {
      throw new Error('Associated loyalty card not found.');
    }

    const customer = this.state.customers.find((c) => c.id === originalTx.customerId);

    // Apply compensating deduction
    const stampsToDeduct = originalTx.stampsAwarded;
    card.currentStamps = Math.max(0, card.currentStamps - stampsToDeduct);
    card.totalLifetimeStamps = Math.max(0, card.totalLifetimeStamps - stampsToDeduct);
    if (customer) {
      customer.totalStampsAwarded = Math.max(0, customer.totalStampsAwarded - stampsToDeduct);
    }

    const compensatingTransaction: StampTransaction = {
      id: generateId('tx_st_rev'),
      businessId,
      cardId: card.id,
      customerId: originalTx.customerId,
      customerName: originalTx.customerName,
      locationId: originalTx.locationId,
      locationName: originalTx.locationName,
      staffUserId: staffUser.id,
      staffName: staffUser.name,
      stampsAwarded: -stampsToDeduct,
      type: 'reversal',
      reversalReason: reversalReason.trim(),
      note: `Reversal of ${originalTx.id} by ${staffUser.name}: ${reversalReason}`,
      createdAt: new Date().toISOString(),
    };

    this.state.stampTransactions.push(compensatingTransaction);

    this.addAuditLog({
      businessId,
      userId: staffUser.id,
      userName: staffUser.name,
      actorType: 'merchant',
      action: 'STAMPS_REVERSED',
      entityType: 'stamp_transaction',
      entityId: compensatingTransaction.id,
      details: `Reversed ${stampsToDeduct} stamp(s) for ${originalTx.customerName}. Reason: ${reversalReason}`,
    });

    this.saveState();
    return { success: true, compensatingTransaction, card };
  }

  // 5. Link Hub Management
  public saveBusinessLink(businessId: string, link: Partial<BusinessLink>): BusinessLink {
    if (link.id) {
      const idx = this.state.links.findIndex((l) => l.id === link.id && l.businessId === businessId);
      if (idx !== -1) {
        this.state.links[idx] = { ...this.state.links[idx], ...link };
        this.saveState();
        return this.state.links[idx];
      }
    }

    const newLink: BusinessLink = {
      id: generateId('lnk'),
      businessId,
      title: link.title || 'New Link',
      subtitle: link.subtitle,
      url: link.url || 'https://ybgp.in',
      type: link.type || 'custom',
      iconName: link.iconName || 'link',
      sortOrder: link.sortOrder ?? this.state.links.filter((l) => l.businessId === businessId).length + 1,
      isEnabled: link.isEnabled ?? true,
      clickCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.state.links.push(newLink);
    this.saveState();
    return newLink;
  }

  public deleteBusinessLink(businessId: string, linkId: string): void {
    this.state.links = this.state.links.filter((l) => !(l.id === linkId && l.businessId === businessId));
    this.saveState();
  }

  public recordLinkClick(linkId: string): void {
    const link = this.state.links.find((l) => l.id === linkId);
    if (link) {
      link.clickCount = (link.clickCount || 0) + 1;
      this.saveState();
    }
  }

  // 6. Update Business Profile
  public updateBusinessProfile(businessId: string, updates: Partial<Business>): Business {
    const idx = this.state.businesses.findIndex((b) => b.id === businessId);
    if (idx === -1) {
      throw new Error('Business not found.');
    }

    // Slug uniqueness check if updating slug
    if (updates.slug && updates.slug !== this.state.businesses[idx].slug) {
      const slugExists = this.state.businesses.some(
        (b) => b.id !== businessId && b.slug.toLowerCase() === updates.slug!.toLowerCase()
      );
      if (slugExists) {
        throw new Error('This business URL slug is already taken. Please choose another.');
      }
    }

    this.state.businesses[idx] = {
      ...this.state.businesses[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveState();
    return this.state.businesses[idx];
  }

  // 7. Update Loyalty Program
  public updateLoyaltyProgram(businessId: string, updates: Partial<LoyaltyProgram>): LoyaltyProgram {
    const program = this.getActiveProgramByBusiness(businessId);
    if (!program) {
      throw new Error('No active loyalty program found.');
    }

    Object.assign(program, updates, { updatedAt: new Date().toISOString() });
    this.saveState();
    return program;
  }

  // 8. Super Admin Operations
  public setBusinessStatus(businessId: string, status: 'active' | 'trial' | 'suspended', reason: string, adminUser: User): void {
    const business = this.getBusinessById(businessId);
    if (!business) throw new Error('Business not found.');

    business.status = status;
    business.updatedAt = new Date().toISOString();

    this.addAuditLog({
      businessId,
      userId: adminUser.id,
      userName: adminUser.name,
      actorType: 'admin',
      action: `BUSINESS_STATUS_${status.toUpperCase()}`,
      entityType: 'business',
      entityId: businessId,
      details: `Status set to ${status}. Reason: ${reason}`,
    });

    this.saveState();
  }

  public provisionNewBusiness(params: {
    name: string;
    slug: string;
    category: Business['category'];
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    city: string;
    planId: string;
    adminUser: User;
  }): Business {
    const { name, slug, category, ownerName, ownerEmail, ownerPhone, city, planId, adminUser } = params;

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (this.state.businesses.some((b) => b.slug === cleanSlug)) {
      throw new Error('Slug is already in use by another business.');
    }

    const businessId = generateId('biz');
    const newBiz: Business = {
      id: businessId,
      slug: cleanSlug,
      name,
      legalName: `${name} Private Limited`,
      tagline: `Best ${category} in ${city}`,
      category,
      brandColor: '#0F172A',
      status: 'active',
      planId,
      address: `Main Market Road, ${city}`,
      city,
      state: 'Karnataka',
      pincode: '560001',
      phone: ownerPhone,
      whatsapp: ownerPhone.replace(/\D/g, ''),
      googleReviewsUrl: `https://maps.google.com/?q=${encodeURIComponent(name + ' ' + city)}`,
      openingHours: 'Mon - Sun: 9:00 AM – 9:00 PM',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const locationId = generateId('loc');
    const location: BusinessLocation = {
      id: locationId,
      businessId,
      name: `${city} Flagship Outlet`,
      code: 'OUTLET-01',
      address: `Main Market Road, ${city}`,
      phone: ownerPhone,
      isPrimary: true,
      createdAt: new Date().toISOString(),
    };

    const ownerUser: User = {
      id: generateId('usr'),
      name: ownerName,
      email: ownerEmail,
      phone: normalizeIndianPhone(ownerPhone),
      role: 'owner',
      businessId,
      createdAt: new Date().toISOString(),
    };

    const membership: BusinessMembership = {
      id: generateId('mem'),
      businessId,
      userId: ownerUser.id,
      role: 'owner',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const program: LoyaltyProgram = {
      id: generateId('prg'),
      businessId,
      name: `${name} Loyalty Rewards`,
      description: 'Earn 1 stamp with every visit. Complete 8 stamps to unlock your special reward!',
      stampTarget: 8,
      rewardTitle: 'Special Complimentary Treat',
      rewardDescription: 'Enjoy a special complimentary treat from our menu on completing 8 stamps.',
      minSpendInPaise: 10000,
      maxStampsPerDay: 2,
      stampExpiryDays: 180,
      termsAndConditions: 'Stamps must be scanned at checkout.',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const reward: Reward = {
      id: generateId('rwd'),
      businessId,
      programId: program.id,
      title: 'Special Complimentary Treat',
      description: 'Handcrafted signature item for our loyal patron.',
      stampCost: 8,
      terms: 'Valid at our store.',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    const defaultLink: BusinessLink = {
      id: generateId('lnk'),
      businessId,
      title: 'Rate Us on Google Reviews',
      subtitle: 'Help neighbors find quality service',
      url: newBiz.googleReviewsUrl,
      type: 'google_review',
      iconName: 'star',
      sortOrder: 1,
      isEnabled: true,
      clickCount: 0,
      createdAt: new Date().toISOString(),
    };

    const sub: Subscription = {
      id: generateId('sub'),
      businessId,
      planId,
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 365 * 86400000).toISOString(),
      trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.state.businesses.push(newBiz);
    this.state.locations.push(location);
    this.state.users.push(ownerUser);
    this.state.memberships.push(membership);
    this.state.programs.push(program);
    this.state.rewards.push(reward);
    this.state.links.push(defaultLink);
    this.state.subscriptions.push(sub);

    this.addAuditLog({
      businessId,
      userId: adminUser.id,
      userName: adminUser.name,
      actorType: 'admin',
      action: 'BUSINESS_PROVISIONED',
      entityType: 'business',
      entityId: businessId,
      details: `Provisioned business ${name} (${cleanSlug}) with plan ${planId}`,
    });

    this.saveState();
    return newBiz;
  }

  public updatePlatformSettings(settings: Partial<PlatformSettings>): PlatformSettings {
    this.state.platformSettings = {
      ...this.state.platformSettings,
      ...settings,
    };
    this.saveState();
    return this.state.platformSettings;
  }

  private addAuditLog(entry: Omit<AuditLog, 'id' | 'createdAt'>): void {
    const log: AuditLog = {
      ...entry,
      id: generateId('log'),
      createdAt: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(log);
    // Keep max 500 logs to avoid localStorage bloating
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
  }
}

export const dbService = new DatabaseService();
