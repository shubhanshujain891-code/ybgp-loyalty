import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Search,
  CheckCircle2,
  Trophy,
  AlertCircle,
  RotateCw,
  PlusCircle,
  Gift,
  ShieldCheck,
  Undo2,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';
import { Business, LoyaltyCard, LoyaltyCustomer, LoyaltyProgram, User } from '../../types';
import { dbService, normalizeIndianPhone } from '../../services/db';

interface ScannerModalProps {
  business: Business;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onRewardRedeemRequested?: (card: LoyaltyCard) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  business,
  currentUser,
  isOpen,
  onClose,
  onRewardRedeemRequested,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [manualQuery, setManualQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  // Resolved Customer State
  const [resolvedData, setResolvedData] = useState<{
    card: LoyaltyCard;
    customer: LoyaltyCustomer;
    program: LoyaltyProgram;
  } | null>(null);

  const [awardSuccess, setAwardSuccess] = useState<string | null>(null);
  const [isAwarding, setIsAwarding] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'html5-qr-scanner-region';

  // Quick lookup helper
  const handleResolveToken = (token: string) => {
    setSearchError(null);
    setAwardSuccess(null);

    const clean = token.trim();
    if (!clean) return;

    // 1. Try QR Token lookup
    const qrMatch = dbService.getCardByQrToken(clean);
    if (qrMatch) {
      if (qrMatch.business.id !== business.id) {
        setSearchError('This loyalty card belongs to another business.');
        return;
      }
      setResolvedData({
        card: qrMatch.card,
        customer: qrMatch.customer,
        program: qrMatch.program,
      });
      return;
    }

    // 2. Try Phone Number lookup
    const norm = normalizeIndianPhone(clean);
    const customer = dbService.getCustomerByPhone(business.id, norm);
    if (customer) {
      const program = dbService.getActiveProgramByBusiness(business.id);
      if (program) {
        const card = dbService.getCustomerCard(customer.id, program.id);
        if (card) {
          setResolvedData({ card, customer, program });
          return;
        }
      }
    }

    setSearchError('No active loyalty pass found for this QR token or mobile number.');
  };

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraStarting(true);
    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        (decodedText) => {
          // Successfully scanned!
          html5QrCode.pause(true);
          handleResolveToken(decodedText);
        },
        () => {
          // Frame error (normal during scanning)
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access denied or unavailable.';
      setCameraError(msg);
      setActiveTab('manual');
    } finally {
      setIsCameraStarting(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !resolvedData) {
      // Delay camera mount to allow DOM element to render
      const timer = setTimeout(() => {
        startCamera();
      }, 200);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, resolvedData]);

  // Award Stamp Action
  const handleAwardStamp = () => {
    if (!resolvedData) return;
    setIsAwarding(true);
    setSearchError(null);

    try {
      const locations = dbService.getLocationsByBusiness(business.id);
      const locId = locations[0]?.id || 'loc_main';
      const idemKey = `idem_award_${resolvedData.card.id}_${Date.now()}`;

      const res = dbService.awardStamps({
        businessId: business.id,
        cardId: resolvedData.card.id,
        staffUser: currentUser,
        locationId: locId,
        stampsToAward: 1,
        idempotencyKey: idemKey,
      });

      if (res.success) {
        // Confetti celebration
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });

        setAwardSuccess(
          res.rewardUnlocked
            ? `🎉 Stamp awarded! Reward unlocked: ${res.rewardTitle}`
            : `Stamp awarded successfully! New balance: ${res.card.currentStamps}/${resolvedData.program.stampTarget}`
        );

        // Update local resolved state with fresh data
        setResolvedData((prev) =>
          prev
            ? {
                ...prev,
                card: res.card,
              }
            : null
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to award stamp';
      setSearchError(msg);
    } finally {
      setIsAwarding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-400 text-slate-900 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                Scan Customer QR Pass
              </h2>
              <p className="text-xs text-slate-300">
                {business.name} · Staff: {currentUser.name} ({currentUser.role})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle Tabs (when not resolved) */}
        {!resolvedData && (
          <div className="flex border-b border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                activeTab === 'camera'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Camera Scanner</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                activeTab === 'manual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Manual Phone / Token Lookup</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6">
          {searchError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{searchError}</span>
            </div>
          )}

          {awardSuccess && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div className="font-semibold">{awardSuccess}</div>
            </div>
          )}

          {/* RESOLVED CUSTOMER CARD VIEW */}
          {resolvedData ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Verified Customer Pass
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">
                      {resolvedData.customer.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {resolvedData.customer.phoneMasked}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-black text-amber-600 font-mono">
                      {resolvedData.card.currentStamps} / {resolvedData.program.stampTarget}
                    </span>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">
                      Stamps Collected
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (resolvedData.card.currentStamps / resolvedData.program.stampTarget) * 100
                      )}%`,
                      backgroundColor:
                        resolvedData.card.currentStamps >= resolvedData.program.stampTarget
                          ? '#10B981'
                          : '#D97706',
                    }}
                  />
                </div>

                {/* Reward eligibility alert */}
                {resolvedData.card.currentStamps >= resolvedData.program.stampTarget ? (
                  <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-950">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold block">Reward Available!</span>
                        <span className="text-[11px] text-emerald-800">
                          {resolvedData.program.rewardTitle}
                        </span>
                      </div>
                    </div>
                    {onRewardRedeemRequested && (
                      <button
                        type="button"
                        onClick={() => {
                          onRewardRedeemRequested(resolvedData.card);
                          onClose();
                        }}
                        className="py-1.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                      >
                        Redeem Now
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Needs{' '}
                      <strong>
                        {resolvedData.program.stampTarget - resolvedData.card.currentStamps} more
                      </strong>{' '}
                      to unlock {resolvedData.program.rewardTitle}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isAwarding}
                  onClick={handleAwardStamp}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors disabled:opacity-50"
                >
                  {isAwarding ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Awarding Stamp & Verifying...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-5 h-5 text-amber-400" />
                      <span>Confirm & Award 1 Stamp</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResolvedData(null);
                      setAwardSuccess(null);
                      setSearchError(null);
                      setActiveTab('camera');
                    }}
                    className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Scan Next Customer
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'camera' ? (
            /* CAMERA SCANNER VIEW */
            <div className="space-y-4">
              <div className="relative aspect-square max-w-[280px] mx-auto rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-inner flex flex-col items-center justify-center">
                {/* HTML5 QR Code Mount Element */}
                <div id={scannerContainerId} className="w-full h-full" />

                {isCameraStarting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-4 text-center">
                    <RotateCw className="w-6 h-6 animate-spin text-amber-400 mb-2" />
                    <p className="text-xs font-medium">Starting secure camera...</p>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-white p-4 text-center space-y-2">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                    <p className="text-xs text-red-200">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('manual')}
                      className="mt-2 px-3 py-1.5 bg-amber-400 text-slate-900 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Use Manual Search
                    </button>
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-slate-500">
                <p>Point phone camera at customer&apos;s digital loyalty QR pass.</p>
                <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Authenticated merchant channel · Idempotent ledger</span>
                </div>
              </div>
            </div>
          ) : (
            /* MANUAL LOOKUP VIEW */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Enter Mobile Number (+91) or QR Card Token
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 9845012345 or YBGP-CRD-..."
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleResolveToken(manualQuery);
                      }
                    }}
                    className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleResolveToken(manualQuery)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Lookup
                  </button>
                </div>
              </div>

              {/* Quick sample customers for instant testing convenience */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">
                  Quick Select Patrons (For Testing)
                </span>
                <div className="space-y-1.5">
                  {dbService
                    .getCustomersByBusiness(business.id)
                    .slice(0, 3)
                    .map((c) => {
                      const card = dbService.getCustomerCard(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            if (card) handleResolveToken(card.qrTokenRaw);
                          }}
                          className="w-full p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between text-left text-xs cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {c.phoneMasked}
                            </span>
                          </div>
                          <span className="font-bold text-amber-700 font-mono">
                            {card?.currentStamps || 0} stamps
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
