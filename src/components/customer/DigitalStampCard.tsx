import React, { useState } from 'react';
import {
  Sparkles,
  Trophy,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Share2,
  BookmarkPlus,
  HelpCircle,
  X,
} from 'lucide-react';
import { Business, LoyaltyCard, LoyaltyCustomer, LoyaltyProgram, StampTransaction } from '../../types';
import { QrCodeViewer } from '../common/QrCodeViewer';
import { formatKolkataDate } from '../../config/ybgp';

interface DigitalStampCardProps {
  business: Business;
  customer: LoyaltyCustomer;
  card: LoyaltyCard;
  program: LoyaltyProgram;
  transactions?: StampTransaction[];
  onClose?: () => void;
}

export const DigitalStampCard: React.FC<DigitalStampCardProps> = ({
  business,
  customer,
  card,
  program,
  transactions = [],
  onClose,
}) => {
  const [showPwaGuide, setShowPwaGuide] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const target = program.stampTarget || 8;
  const current = card.currentStamps;
  const isRewardUnlocked = current >= target;
  const stampsNeeded = Math.max(0, target - current);

  const handleShare = () => {
    const text = `Join me at ${business.name}! Earn rewards and digital stamps at ${window.location.origin}/b/${business.slug}`;
    if (navigator.share) {
      navigator.share({ title: business.name, text, url: `${window.location.origin}/b/${business.slug}` }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/b/${business.slug}`);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Top action bar when viewed as modal or standalone */}
      {onClose && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Pass ID:</span>
            <span className="font-mono text-slate-700">{customer.customerToken.slice(0, 16)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Luxury Digital Stamp Pass Container */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200/80 bg-white">
        {/* Pass Header Banner */}
        <div
          className="p-6 text-white relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${business.brandColor || '#0F172A'} 0%, #0F172A 100%)`,
          }}
        >
          {/* Subtle decorative circles */}
          <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute right-12 -bottom-10 w-28 h-28 rounded-full bg-amber-400/10 pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-amber-300 block mb-1">
                Official Digital Loyalty Pass
              </span>
              <h1 className="text-xl font-bold tracking-tight leading-tight">
                {business.name}
              </h1>
              <p className="text-xs text-slate-200 mt-0.5 line-clamp-1">
                {program.name}
              </p>
            </div>

            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center font-bold text-amber-300 text-sm shrink-0">
              {business.name.slice(0, 2).toUpperCase()}
            </div>
          </div>

          {/* Member Name and Tier bar */}
          <div className="mt-5 pt-3.5 border-t border-white/15 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-300 block">
                Patron Member
              </span>
              <span className="font-semibold text-white tracking-wide">
                {customer.name}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-300 block">
                Mobile
              </span>
              <span className="font-mono text-slate-200 text-[11px]">
                {customer.phoneMasked}
              </span>
            </div>
          </div>
        </div>

        {/* Reward Progress Status */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">
              Stamp Progress
            </span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {current} / {target} Stamps
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(100, (current / target) * 100)}%`,
                backgroundColor: isRewardUnlocked ? '#10B981' : (business.brandColor || '#D97706'),
              }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-600">
            {isRewardUnlocked ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                Reward Unlocked! Show your QR code to the cashier to claim.
              </span>
            ) : (
              <span>
                Collect <strong className="text-slate-900">{stampsNeeded} more stamp{stampsNeeded > 1 ? 's' : ''}</strong> to unlock your reward!
              </span>
            )}
          </p>
        </div>

        {/* Animated Digital Stamp Grid */}
        <div className="p-6 bg-white">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: target }).map((_, index) => {
              const isStamped = index < current;
              const isNext = index === current;
              const isLastRewardSlot = index === target - 1;

              return (
                <div
                  key={index}
                  className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center p-2 border transition-all ${
                    isStamped
                      ? 'bg-amber-50/80 border-amber-300 text-amber-900 shadow-xs'
                      : isNext
                      ? 'bg-slate-50 border-dashed border-2 border-slate-400 text-slate-400 animate-pulse'
                      : 'bg-slate-50/50 border-slate-200 text-slate-300'
                  }`}
                >
                  {isStamped ? (
                    <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-300">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xs"
                        style={{ backgroundColor: business.brandColor || '#B45309' }}
                      >
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-[10px] font-bold text-amber-950 mt-1 font-mono">
                        #{index + 1}
                      </span>
                    </div>
                  ) : isLastRewardSlot ? (
                    <div className="flex flex-col items-center justify-center">
                      <Trophy className="w-6 h-6 text-amber-500/70" />
                      <span className="text-[9px] font-bold text-amber-700 mt-1 uppercase tracking-tight">
                        Reward
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400 font-mono">
                      {index + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reward Info Callout */}
          <div className="mt-5 p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                Target Reward
              </span>
              <p className="text-xs font-semibold text-slate-900 leading-snug">
                {program.rewardTitle}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                {program.rewardDescription}
              </p>
            </div>
          </div>
        </div>

        {/* Notch / Ticket Divider */}
        <div className="relative flex items-center justify-between py-1 bg-white">
          <div className="w-5 h-8 bg-slate-100 rounded-r-full -ml-1 border-r border-t border-b border-slate-200" />
          <div className="flex-1 border-t-2 border-dashed border-slate-200 mx-3" />
          <div className="w-5 h-8 bg-slate-100 rounded-l-full -mr-1 border-l border-t border-b border-slate-200" />
        </div>

        {/* Customer Merchant-Scan QR Section */}
        <div className="p-6 bg-slate-50 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
            Merchant Scan Token
          </span>
          <p className="text-xs text-slate-700 mb-3">
            Present this QR code to the cashier at checkout to collect your stamp or redeem rewards.
          </p>

          <QrCodeViewer
            value={card.qrTokenRaw}
            size={180}
            subLabel={card.qrTokenRaw}
          />

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>High-entropy dynamic token · Prevents fraud</span>
          </div>
        </div>

        {/* Footer info & expiry */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Last visit: {card.lastStampedAt ? formatKolkataDate(card.lastStampedAt) : 'Today'}</span>
          </div>
          <span>Valid 180 Days</span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3 px-1">
        <button
          type="button"
          onClick={() => setShowPwaGuide(true)}
          className="py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <BookmarkPlus className="w-4 h-4 text-amber-600" />
          <span>Save to Phone</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <Share2 className="w-4 h-4 text-slate-600" />
          <span>{copiedShare ? 'Link Copied!' : 'Share Shop'}</span>
        </button>
      </div>

      {/* PWA / Save to Home Screen Modal Guide */}
      {showPwaGuide && (
        <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              <BookmarkPlus className="w-4 h-4 text-amber-400" />
              Add Pass to Your Phone Screen
            </span>
            <button
              type="button"
              onClick={() => setShowPwaGuide(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            No App Store download required! To open your loyalty pass in 1 tap anytime:
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-slate-200 text-[11px]">
            <li>Tap the browser menu (<strong>⋮</strong> on Android or <strong>Share</strong> on iPhone).</li>
            <li>Select <strong>&quot;Add to Home Screen&quot;</strong>.</li>
            <li>Your {business.name} loyalty pass icon will now stay on your phone home screen!</li>
          </ol>
        </div>
      )}

      {/* Recent Stamp History Ledger */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-800">
            Recent Stamp History
          </h3>
          <div className="space-y-2">
            {transactions.slice(0, 3).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0"
              >
                <div>
                  <p className="font-medium text-slate-800">
                    {tx.type === 'award' ? `+${tx.stampsAwarded} Stamp Awarded` : `${tx.stampsAwarded} Stamp Reversed`}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatKolkataDate(tx.createdAt)} · {tx.locationName}
                  </p>
                </div>
                <span
                  className={`font-semibold font-mono ${
                    tx.stampsAwarded > 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {tx.stampsAwarded > 0 ? `+${tx.stampsAwarded}` : tx.stampsAwarded}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms and DPDP Privacy Footnote */}
      <div className="text-center text-[11px] text-slate-400 py-2">
        <p>Protected by YBGP Loyalty · Indian DPDP Act, 2023 Compliant</p>
      </div>
    </div>
  );
};
