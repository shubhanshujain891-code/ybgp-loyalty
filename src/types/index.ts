/**
 * YBGP Loyalty - TypeScript Data Model & System Types
 * Multi-Tenant Digital Stamp Cards, Business QR Hub & SaaS Management
 */

export type UserRole = 'platform_admin' | 'owner' | 'manager' | 'cashier';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  businessId?: string;
  createdAt: string;
}

export type BusinessStatus = 'active' | 'trial' | 'suspended';
export type BusinessCategory = 'cafe' | 'salon' | 'bakery' | 'restaurant' | 'sweet_shop' | 'gym' | 'retail' | 'services';

export interface Business {
  id: string;
  slug: string;
  name: string;
  legalName: string;
  tagline: string;
  category: BusinessCategory;
  logoUrl?: string;
  coverUrl?: string;
  brandColor: string; // Hex color for loyalty card & link buttons
  status: BusinessStatus;
  planId: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  whatsapp: string;
  googleReviewsUrl: string;
  instagramHandle?: string;
  websiteUrl?: string;
  openingHours: string;
  announcement?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessLocation {
  id: string;
  businessId: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface BusinessMembership {
  id: string;
  businessId: string;
  userId: string;
  role: 'owner' | 'manager' | 'cashier';
  locationId?: string;
  status: 'active' | 'invited' | 'revoked';
  createdAt: string;
}

export type LinkType = 'google_review' | 'whatsapp' | 'menu' | 'instagram' | 'map' | 'phone' | 'custom' | 'website';

export interface BusinessLink {
  id: string;
  businessId: string;
  title: string;
  subtitle?: string;
  url: string;
  type: LinkType;
  iconName: string;
  sortOrder: number;
  isEnabled: boolean;
  clickCount: number;
  createdAt: string;
}

export interface LoyaltyProgram {
  id: string;
  businessId: string;
  name: string;
  description: string;
  stampTarget: number; // e.g. 6, 8, 10
  rewardTitle: string; // e.g. "Free Artisanal Coffee & Croissant"
  rewardDescription: string;
  minSpendInPaise: number; // e.g. 15000 = ₹150
  maxStampsPerDay: number;
  stampExpiryDays: number;
  termsAndConditions: string;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyCustomer {
  id: string;
  businessId: string;
  customerToken: string; // Opaque high-entropy customer identifier
  name: string;
  phoneNormalized: string; // +91XXXXXXXXXX
  phoneMasked: string; // +91 ••••• ••123
  status: 'active' | 'blocked';
  totalStampsAwarded: number;
  totalRewardsRedeemed: number;
  consentGivenAt: string;
  createdAt: string;
  lastVisitAt: string;
}

export interface LoyaltyCard {
  id: string;
  customerId: string;
  businessId: string;
  programId: string;
  currentStamps: number; // 0 to stampTarget
  totalLifetimeStamps: number;
  cardStatus: 'active' | 'completed' | 'expired';
  qrTokenHash: string; // Hash of QR token for lookup/verification
  qrTokenRaw: string; // Opaque unique token scanned by merchant
  lastStampedAt?: string;
  createdAt: string;
}

export type StampTransactionType = 'award' | 'reversal' | 'bonus';

export interface StampTransaction {
  id: string;
  businessId: string;
  cardId: string;
  customerId: string;
  customerName: string;
  locationId: string;
  locationName: string;
  staffUserId: string;
  staffName: string;
  stampsAwarded: number; // Positive for award, negative for reversal
  type: StampTransactionType;
  idempotencyKey?: string;
  reversalReason?: string;
  note?: string;
  createdAt: string;
}

export interface Reward {
  id: string;
  businessId: string;
  programId: string;
  title: string;
  description: string;
  stampCost: number;
  terms: string;
  isActive: boolean;
  createdAt: string;
}

export interface RewardRedemption {
  id: string;
  businessId: string;
  customerId: string;
  customerName: string;
  cardId: string;
  rewardId: string;
  rewardTitle: string;
  locationId: string;
  locationName: string;
  staffUserId: string;
  staffName: string;
  status: 'redeemed' | 'cancelled';
  redemptionCode: string; // e.g. YBGP-RWD-7382
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'starter' | 'growth' | 'pro';
  priceMonthlyInPaise: number;
  priceYearlyInPaise: number;
  maxLocations: number;
  maxStaffSeats: number;
  maxActivePrograms: number;
  maxMonthlyStamps: number;
  hasCustomBranding: boolean;
  hasAdvancedAnalytics: boolean;
  hasCampaigns: boolean;
  features: string[];
}

export interface Subscription {
  id: string;
  businessId: string;
  planId: string;
  status: 'active' | 'trial' | 'past_due' | 'cancelled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  businessId?: string;
  userId: string;
  userName: string;
  actorType: 'merchant' | 'admin' | 'customer' | 'system';
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface OtpVerification {
  id: string;
  phoneNormalized: string;
  businessId: string;
  otpCode: string;
  purpose: 'loyalty_registration' | 'card_access';
  expiresAt: string;
  attempts: number;
  verifiedAt?: string;
  createdAt: string;
}

export interface PlatformSettings {
  brandName: string;
  tagline: string;
  domain: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  defaultTimezone: string;
  smsProviderMode: 'simulated' | 'gateway';
  dpdpConsentText: string;
  termsUrl: string;
  privacyUrl: string;
  maintenanceMode: boolean;
}
