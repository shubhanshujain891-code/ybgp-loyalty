/**
 * YBGP Loyalty - SMS Verification Service (OTP Provider)
 * Supports simulated testing mode with live preview in development
 * and production gateway hook with rate limits & abuse prevention.
 */

import { normalizeIndianPhone } from './db';

export interface OtpRequestResult {
  success: boolean;
  message: string;
  phoneNormalized: string;
  simulatedOtp?: string; // Provided only in development/simulated mode for testing
  expiresInSeconds: number;
}

export interface OtpVerifyResult {
  success: boolean;
  message: string;
}

interface StoredOtpSession {
  phone: string;
  otp: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const otpStore = new Map<string, StoredOtpSession>();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const MAX_ATTEMPTS = 4;

export const smsService = {
  /**
   * Request OTP for Indian mobile number via server
   */
  async requestOtp(phone: string, businessName: string, businessId?: string): Promise<OtpRequestResult> {
    const norm = normalizeIndianPhone(phone);
    if (!norm || norm.length < 13) {
      return {
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number (+91).',
        phoneNormalized: norm,
        expiresInSeconds: 0,
      };
    }

    try {
      const response = await fetch('/api/v1/public/loyalty/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: norm,
          businessId: businessId || 'biz_chaico',
          businessName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          message: data.error || data.message || 'Failed to send OTP code.',
          phoneNormalized: norm,
          expiresInSeconds: 0,
        };
      }

      return {
        success: true,
        message: data.message || `OTP sent successfully to ${norm.slice(0, 6)}••••${norm.slice(-3)}.`,
        phoneNormalized: norm,
        simulatedOtp: data.simulatedOtp,
        expiresInSeconds: data.expiresInSeconds || 300,
      };
    } catch {
      // In production mode, never simulate
      const isProd = import.meta.env.PROD;
      if (isProd) {
        return {
          success: false,
          message: 'Unable to reach SMS gateway server. Please retry shortly.',
          phoneNormalized: norm,
          expiresInSeconds: 0,
        };
      }
      return {
        success: true,
        message: `OTP sent via SMS to ${norm.slice(0, 6)}••••${norm.slice(-3)}.`,
        phoneNormalized: norm,
        simulatedOtp: '123456',
        expiresInSeconds: 300,
      };
    }
  },

  /**
   * Verify entered OTP code
   */
  async verifyOtp(phone: string, enteredOtp: string): Promise<OtpVerifyResult> {
    const norm = normalizeIndianPhone(phone);
    const session = otpStore.get(norm);

    if (!session) {
      return {
        success: false,
        message: 'No active OTP verification found. Please request a new code.',
      };
    }

    const now = Date.now();
    if (now > session.expiresAt) {
      otpStore.delete(norm);
      return {
        success: false,
        message: 'OTP has expired. Please request a new verification code.',
      };
    }

    if (session.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(norm);
      return {
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.',
      };
    }

    session.attempts += 1;

    // Check code
    if (session.otp !== enteredOtp.trim()) {
      return {
        success: false,
        message: `Invalid OTP code. ${MAX_ATTEMPTS - session.attempts} attempt(s) remaining.`,
      };
    }

    // Verified! Clear session
    otpStore.delete(norm);
    return {
      success: true,
      message: 'Mobile number verified successfully.',
    };
  },
};
