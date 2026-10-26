/**
 * YBGP Loyalty - Centralized Configuration & Constants
 * Brand: YBGP — Your Business Growth Partner
 * Domain: https://ybgp.in
 */

import { SubscriptionPlan, PlatformSettings } from '../types';

export const YBGP_CONFIG = {
  brand: {
    name: 'YBGP Loyalty',
    parentBrand: 'YBGP — Your Business Growth Partner',
    tagline: 'Digital Stamp Cards & Business Links for Local Merchants',
    domain: 'https://ybgp.in',
    supportEmail: 'support@ybgp.in',
    supportPhone: '+91 98765 43210',
    primaryColor: '#0F172A', // Slate 900
    accentColor: '#4F46E5', // Indigo 600
    goldColor: '#D97706', // Amber 600
  },
  market: {
    currencyCode: 'INR',
    currencySymbol: '₹',
    countryCode: '+91',
    timezone: 'Asia/Kolkata',
  },
  plans: [
    {
      id: 'plan_starter',
      name: 'Starter Plan',
      tier: 'starter',
      priceMonthlyInPaise: 79900, // ₹799/month
      priceYearlyInPaise: 799000, // ₹7,990/year (2 months free)
      maxLocations: 1,
      maxStaffSeats: 2,
      maxActivePrograms: 1,
      maxMonthlyStamps: 300,
      hasCustomBranding: false,
      hasAdvancedAnalytics: false,
      hasCampaigns: false,
      features: [
        '1 Business Location',
        '2 Staff / Cashier Logins',
        '1 Active Digital Stamp Card Program',
        'Up to 300 Monthly Stamp Awards',
        'Business Links Hub & Google Review QR',
        'Print-Ready Counter Standee Poster',
        'Standard Email & WhatsApp Support',
      ],
    },
    {
      id: 'plan_growth',
      name: 'Growth Plan',
      tier: 'growth',
      priceMonthlyInPaise: 149900, // ₹1,499/month
      priceYearlyInPaise: 1499000, // ₹14,990/year
      maxLocations: 2,
      maxStaffSeats: 5,
      maxActivePrograms: 3,
      maxMonthlyStamps: 1500,
      hasCustomBranding: true,
      hasAdvancedAnalytics: true,
      hasCampaigns: true,
      features: [
        'Up to 2 Business Locations',
        '5 Staff / Cashier Logins',
        '3 Active Loyalty Programs',
        'Up to 1,500 Monthly Stamp Awards',
        'Custom Brand Colors & Logo',
        'Google Reviews Integration & Analytics',
        'Export Customer & Transaction CSV',
        'High-Resolution QR Poster Generator',
        'Priority Support via WhatsApp',
      ],
    },
    {
      id: 'plan_pro',
      name: 'Multi-Outlet Pro',
      tier: 'pro',
      priceMonthlyInPaise: 299900, // ₹2,999/month
      priceYearlyInPaise: 2999000, // ₹29,990/year
      maxLocations: 5,
      maxStaffSeats: 15,
      maxActivePrograms: 10,
      maxMonthlyStamps: 10000,
      hasCustomBranding: true,
      hasAdvancedAnalytics: true,
      hasCampaigns: true,
      features: [
        'Up to 5 Business Locations',
        '15 Staff / Cashier Logins',
        'Unlimited Loyalty Programs',
        'Up to 10,000 Monthly Stamps',
        'Multi-Outlet Reporting & Staff Leaderboard',
        'Full Audit Ledger & Fraud Velocity Guards',
        'Custom Domain Support (slug.ybgp.in)',
        'Dedicated YBGP Account Manager',
      ],
    },
  ] as SubscriptionPlan[],
  defaultSettings: {
    brandName: 'YBGP Loyalty',
    tagline: 'Your Business Growth Partner',
    domain: 'https://ybgp.in',
    supportEmail: 'support@ybgp.in',
    supportPhone: '+91 98765 43210',
    currency: '₹',
    defaultTimezone: 'Asia/Kolkata',
    smsProviderMode: 'simulated',
    dpdpConsentText:
      'We collect your mobile number solely to maintain your digital stamp pass and issue rewards for this merchant. We never sell your personal information or spam you. Compliant with Digital Personal Data Protection Act, 2023.',
    termsUrl: 'https://ybgp.in/terms',
    privacyUrl: 'https://ybgp.in/privacy',
    maintenanceMode: false,
  } as PlatformSettings,
};

// Format paise to INR string e.g. 149900 -> ₹1,499
export function formatINR(paise: number): string {
  const rupees = Math.floor(paise / 100);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

// Format Date in Asia/Kolkata timezone
export function formatKolkataDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return dateString;
  }
}
