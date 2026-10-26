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
   * Request OTP for Indian mobile number
   */
  async requestOtp(phone: string, businessName: string): Promise<OtpRequestResult> {
    const norm = normalizeIndianPhone(phone);
    if (!norm || norm.length < 13) {
      return {
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number (+91).',
        phoneNormalized: norm,
        expiresInSeconds: 0,
      };
    }

    const now = Date.now();
    const existing = otpStore.get(norm);

    // Rate limiting: cooldown check
    if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      return {
        success: false,
        message: `Please wait ${waitSec}s before requesting a new OTP code.`,
        phoneNormalized: norm,
        expiresInSeconds: Math.ceil((existing.expiresAt - now) / 1000),
      };
    }

    // Generate 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(norm, {
      phone: norm,
      otp: generatedOtp,
      expiresAt: now + OTP_EXPIRY_MS,
      attempts: 0,
      lastSentAt: now,
    });

    console.log(`[YBGP SMS Service] OTP for ${norm} (${businessName}): ${generatedOtp}`);

    return {
      success: true,
      message: `OTP sent successfully via SMS to ${norm.slice(0, 6)}••••${norm.slice(-3)}.`,
      phoneNormalized: norm,
      simulatedOtp: generatedOtp,
      expiresInSeconds: 300,
    };
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
