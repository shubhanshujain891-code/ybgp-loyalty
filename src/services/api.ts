/**
 * YBGP Loyalty - Frontend Typed API Client
 * Connects frontend components to the production backend at /api/v1/*
 */

import { Business, LoyaltyCard, LoyaltyCustomer, User } from '../types';

const API_BASE = '/api/v1';

// Active auth bearer token stored in memory/sessionStorage
let currentSessionToken: string | null = sessionStorage.getItem('ybgp_merchant_token');
let currentDemoUserId: string | null = localStorage.getItem('ybgp_demo_user_id') || 'usr_owner_chai';

export function setSessionToken(token: string | null) {
  currentSessionToken = token;
  if (token) {
    sessionStorage.setItem('ybgp_merchant_token', token);
  } else {
    sessionStorage.removeItem('ybgp_merchant_token');
  }
}

export function setDemoUserId(userId: string) {
  currentDemoUserId = userId;
  localStorage.setItem('ybgp_demo_user_id', userId);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (currentSessionToken) {
    headers.set('Authorization', `Bearer ${currentSessionToken}`);
  }
  if (currentDemoUserId) {
    headers.set('x-ybgp-user-id', currentDemoUserId);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `HTTP ${response.status}: Request failed`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  auth: {
    async login(params: { email: string; password: string }): Promise<{ token: string; user: User }> {
      const res = await request<{ success: boolean; token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      setSessionToken(res.token);
      return res;
    },
    async signup(params: { name: string; email: string; phone: string; password: string }): Promise<{ token: string; user: User }> {
      const res = await request<{ success: boolean; token: string; user: User }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      setSessionToken(res.token);
      return res;
    },
    async getSession(): Promise<{ user: User }> {
      return request<{ user: User }>('/auth/session');
    },
    async logout(): Promise<void> {
      await request('/auth/logout', { method: 'POST' }).catch(() => {});
      setSessionToken(null);
    },
  },

  public: {
    async getBusiness(slug: string): Promise<{
      business: Business;
      links: any[];
      program: any;
    }> {
      return request<{
        business: Business;
        links: any[];
        program: any;
      }>(`/public/business/${encodeURIComponent(slug)}`);
    },

    async requestOtp(phone: string, businessId: string): Promise<{
      success: boolean;
      message: string;
      challengeId: string;
      simulatedOtp?: string;
    }> {
      return request('/public/loyalty/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone, businessId }),
      });
    },

    async registerCustomer(params: {
      name: string;
      phone: string;
      otp: string;
      businessId: string;
      serviceConsent: boolean;
      marketingConsent?: boolean;
    }): Promise<{
      success: boolean;
      customer: LoyaltyCustomer;
      card: LoyaltyCard;
      sessionToken: string;
    }> {
      return request('/public/loyalty/register', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },

    async getCustomerCard(sessionToken: string): Promise<{
      customer: LoyaltyCustomer;
      card: LoyaltyCard;
      entitlements: any[];
      history: any[];
    }> {
      return request('/customer/card', {
        headers: { 'x-customer-session': sessionToken },
      });
    },
  },

  merchant: {
    async resolveScan(params: { qrToken?: string; phone?: string; businessId: string }): Promise<{
      customer: LoyaltyCustomer;
      card: LoyaltyCard;
      program: any;
      availableEntitlements: any[];
    }> {
      return request('/merchant/scan/resolve', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },

    async awardStamps(params: {
      cardId: string;
      locationId?: string;
      idempotencyKey?: string;
      businessId: string;
      note?: string;
    }): Promise<{
      success: boolean;
      card: LoyaltyCard;
      transactionId: string;
      rewardUnlocked: boolean;
      rewardTitle?: string;
      entitlementId?: string;
    }> {
      return request('/merchant/stamps/award', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },

    async redeemReward(params: {
      cardId: string;
      entitlementId: string;
      locationId?: string;
      businessId: string;
    }): Promise<{
      success: boolean;
      redemptionCode: string;
      card: LoyaltyCard;
    }> {
      return request('/merchant/rewards/redeem', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },

    async reverseTransaction(params: {
      transactionId: string;
      reversalReason: string;
      businessId: string;
    }): Promise<{
      success: boolean;
      reversalTransactionId: string;
      card: LoyaltyCard;
    }> {
      return request('/merchant/stamps/reverse', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },

    async getCustomers(businessId: string): Promise<any[]> {
      const res = await request<{ customers: any[] }>(`/merchant/customers?businessId=${encodeURIComponent(businessId)}`);
      return res.customers;
    },

    async getTransactions(businessId: string): Promise<{ transactions: any[]; redemptions: any[] }> {
      return request(`/merchant/transactions?businessId=${encodeURIComponent(businessId)}`);
    },

    async updateBusiness(data: any): Promise<void> {
      await request('/merchant/business', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    async saveLink(link: any): Promise<void> {
      await request('/merchant/links', {
        method: 'POST',
        body: JSON.stringify(link),
      });
    },
  },

  admin: {
    async getOverview(): Promise<any> {
      return request('/admin/overview');
    },

    async updateBusinessStatus(id: string, status: string, reason: string): Promise<void> {
      await request(`/admin/businesses/${encodeURIComponent(id)}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, reason }),
      });
    },

    async getAuditLogs(): Promise<any[]> {
      const res = await request<{ auditLogs: any[] }>('/admin/audit-logs');
      return res.auditLogs;
    },
  },
};
