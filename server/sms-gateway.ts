/**
 * YBGP Loyalty - Enterprise Server SMS Gateway Adapter
 * Supports Fast2SMS, MSG91, Twilio, Generic HTTP Webhooks, and Development Simulation.
 * Enforces production fail-closed semantics when external gateways are not configured.
 */

import { isValidIndianPhone, normalizeIndianPhone } from './security';

export interface SendSmsOptions {
  phone: string;
  otpCode: string;
  businessName: string;
  purpose?: string;
}

export interface SendSmsResult {
  success: boolean;
  provider: 'fast2sms' | 'msg91' | 'twilio' | 'generic_http' | 'simulated';
  message: string;
  simulatedOtp?: string; // Strictly omitted in production mode!
}

export class SmsGatewayService {
  /**
   * Determine active SMS provider based on environment variables
   */
  public getActiveProvider(): 'fast2sms' | 'msg91' | 'twilio' | 'generic_http' | 'simulated' | 'unconfigured' {
    if (process.env.FAST2SMS_API_KEY || (process.env.SMS_PROVIDER === 'fast2sms' && process.env.SMS_API_KEY)) {
      return 'fast2sms';
    }
    if (process.env.MSG91_AUTH_KEY || (process.env.SMS_PROVIDER === 'msg91' && process.env.SMS_API_KEY)) {
      return 'msg91';
    }
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      return 'twilio';
    }
    if (process.env.SMS_GATEWAY_URL) {
      return 'generic_http';
    }
    if (process.env.NODE_ENV !== 'production' && process.env.SMS_PROVIDER_MODE !== 'strict_production') {
      return 'simulated';
    }
    return 'unconfigured';
  }

  /**
   * Send OTP SMS to customer mobile number.
   * Fails closed in production if no provider is configured.
   */
  public async sendOtp(options: SendSmsOptions): Promise<SendSmsResult> {
    const { phone, otpCode, businessName } = options;

    if (!isValidIndianPhone(phone)) {
      throw new Error('Invalid Indian mobile number. Format must be 10 digits starting with 6-9 (+91).');
    }

    const norm = normalizeIndianPhone(phone);
    const provider = this.getActiveProvider();
    const isProduction = process.env.NODE_ENV === 'production';

    if (provider === 'unconfigured') {
      if (isProduction) {
        throw new Error('Production SMS service is not configured. Configured SMS provider credentials are required in production.');
      }
      throw new Error('SMS service is unconfigured on server.');
    }

    if (provider === 'fast2sms') {
      const apiKey = process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY;
      const rawDigits = norm.slice(3); // 10-digit number
      try {
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: apiKey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variables_values: otpCode,
            route: 'otp',
            numbers: rawDigits,
          }),
        });

        if (!response.ok) {
          throw new Error(`Fast2SMS delivery returned HTTP ${response.status}`);
        }

        return {
          success: true,
          provider: 'fast2sms',
          message: 'OTP delivered via Fast2SMS gateway.',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Fast2SMS error';
        throw new Error(`SMS delivery failed via Fast2SMS: ${msg}`);
      }
    }

    if (provider === 'msg91') {
      const authKey = process.env.MSG91_AUTH_KEY || process.env.SMS_API_KEY;
      const templateId = process.env.MSG91_TEMPLATE_ID || 'ybgp_otp_template';
      const rawDigits = norm.replace(/\D/g, ''); // 91XXXXXXXXXX
      try {
        const response = await fetch(`https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${rawDigits}&authkey=${authKey}&otp=${otpCode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`MSG91 returned HTTP ${response.status}`);
        }

        return {
          success: true,
          provider: 'msg91',
          message: 'OTP delivered via MSG91 gateway.',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'MSG91 error';
        throw new Error(`SMS delivery failed via MSG91: ${msg}`);
      }
    }

    if (provider === 'twilio') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID!;
      const authToken = process.env.TWILIO_AUTH_TOKEN!;
      const fromNumber = process.env.TWILIO_FROM || '+15005550006';
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      try {
        const params = new URLSearchParams();
        params.append('To', norm);
        params.append('From', fromNumber);
        params.append('Body', `Your ${businessName} loyalty verification code is ${otpCode}. Valid for 5 minutes.`);

        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        if (!response.ok) {
          throw new Error(`Twilio returned HTTP ${response.status}`);
        }

        return {
          success: true,
          provider: 'twilio',
          message: 'OTP delivered via Twilio gateway.',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Twilio error';
        throw new Error(`SMS delivery failed via Twilio: ${msg}`);
      }
    }

    if (provider === 'generic_http') {
      const gatewayUrl = process.env.SMS_GATEWAY_URL!;
      const bearerToken = process.env.SMS_GATEWAY_BEARER_TOKEN;
      try {
        const response = await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          },
          body: JSON.stringify({
            phone: norm,
            otp: otpCode,
            businessName,
            timestamp: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error(`Custom SMS gateway returned HTTP ${response.status}`);
        }

        return {
          success: true,
          provider: 'generic_http',
          message: 'OTP delivered via custom HTTP SMS gateway.',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'HTTP gateway error';
        throw new Error(`SMS delivery failed via custom HTTP gateway: ${msg}`);
      }
    }

    // Development / Automated Test Simulator
    // Security Gate: In production, simulated mode is strictly unreachable due to previous checks.
    return {
      success: true,
      provider: 'simulated',
      message: 'OTP simulated for development / test environment.',
      simulatedOtp: isProduction ? undefined : otpCode,
    };
  }
}

export const smsGateway = new SmsGatewayService();
