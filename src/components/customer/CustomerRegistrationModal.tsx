import React, { useState } from 'react';
import { X, ShieldCheck, ArrowRight, CheckCircle2, RotateCw, AlertCircle } from 'lucide-react';
import { Business, LoyaltyCard, LoyaltyCustomer } from '../../types';
import { dbService, normalizeIndianPhone } from '../../services/db';
import { smsService } from '../../services/sms';

interface CustomerRegistrationModalProps {
  business: Business;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: LoyaltyCustomer, card: LoyaltyCard) => void;
}

export const CustomerRegistrationModal: React.FC<CustomerRegistrationModalProps> = ({
  business,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(true);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const norm = normalizeIndianPhone(phone);
    if (!name.trim()) {
      setErrorMessage('Please enter your name.');
      return;
    }
    if (norm.replace(/\D/g, '').length !== 12) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!consent) {
      setErrorMessage('Please agree to the privacy notice to issue your loyalty pass.');
      return;
    }

    setLoading(true);
    try {
      const result = await smsService.requestOtp(norm, business.name);
      if (result.success) {
        setSimulatedCode(result.simulatedOtp || null);
        setStep('otp');
        setResendCooldown(30);
        // Start cooldown countdown
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setErrorMessage(result.message);
      }
    } catch {
      setErrorMessage('Failed to send verification SMS. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (enteredOtp.length < 6) {
      setErrorMessage('Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      const verifyRes = await smsService.verifyOtp(phone, enteredOtp);
      if (!verifyRes.success) {
        setErrorMessage(verifyRes.message);
        setLoading(false);
        return;
      }

      // Registration & Card Creation
      const { customer, card } = dbService.registerCustomer({
        businessId: business.id,
        name: name.trim(),
        phone,
        consentGiven: consent,
      });

      // Save customer token in session for instant recognition
      localStorage.setItem(`ybgp_cust_token_${business.id}`, card.qrTokenRaw);

      onSuccess(customer, card);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div
          className="p-5 text-white flex items-start justify-between"
          style={{ backgroundColor: business.brandColor || '#0F172A' }}
        >
          <div>
            <span className="text-[11px] font-medium tracking-wide uppercase opacity-80 block mb-0.5">
              Digital Loyalty Pass
            </span>
            <h2 className="text-lg font-bold leading-tight">
              Join {business.name} Rewards
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/90 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {step === 'details' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number (+91)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-semibold text-slate-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-12 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors font-mono"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  No password required. We verify via a quick SMS code.
                </p>
              </div>

              {/* DPDP Consent Section */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed select-none">
                    I agree to receive stamp updates and rewards on my mobile number. We never share or sell personal data (DPDP Act, 2023 compliant).
                  </span>
                </label>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Privacy-first · High-entropy opaque QR pass</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Sending SMS Code...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center">
                <p className="text-xs text-slate-600">
                  Enter the 6-digit code sent to{' '}
                  <span className="font-semibold text-slate-900 font-mono">
                    +91 {phone}
                  </span>
                </p>

                {simulatedCode && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                      <CheckCircle2 className="w-4 h-4 text-amber-600" />
                      <span>Development SMS Simulation</span>
                    </div>
                    <p className="text-xs text-amber-900 mt-1">
                      Your test OTP code is:{' '}
                      <button
                        type="button"
                        onClick={() => setEnteredOtp(simulatedCode)}
                        className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-100 cursor-pointer text-amber-950"
                      >
                        {simulatedCode} (Click to Fill)
                      </button>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                  Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="••••••"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.5em] text-xl font-bold py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
                >
                  Change phone number
                </button>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleSendOtp}
                  className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer disabled:opacity-40"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || enteredOtp.length < 6}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Activating Loyalty Pass...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Activate Digital Stamp Card</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
