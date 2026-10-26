import React, { useState } from 'react';
import { X, Trophy, CheckCircle2, AlertCircle, RotateCw, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Business, LoyaltyCard, Reward, User } from '../../types';
import { dbService } from '../../services/db';

interface RewardRedemptionModalProps {
  business: Business;
  card: LoyaltyCard;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (code: string) => void;
}

export const RewardRedemptionModal: React.FC<RewardRedemptionModalProps> = ({
  business,
  card,
  currentUser,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedRewardId, setSelectedRewardId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rewards = dbService.getRewardsByBusiness(business.id);
  const customer = dbService.getCustomerById(card.customerId);

  if (!isOpen || !customer) return null;

  const handleRedeem = () => {
    if (!selectedRewardId) {
      setError('Please select a reward to redeem.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const locations = dbService.getLocationsByBusiness(business.id);
      const locId = locations[0]?.id || 'loc_main';

      const res = dbService.redeemReward({
        businessId: business.id,
        cardId: card.id,
        rewardId: selectedRewardId,
        staffUser: currentUser,
        locationId: locId,
      });

      if (res.success) {
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.5 },
        });
        onSuccess(res.redemption.redemptionCode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redemption failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 bg-emerald-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/30 text-amber-300 rounded-xl">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">Redeem Reward</h2>
              <p className="text-xs text-emerald-200">
                Patron: {customer.name} · Current Stamps: {card.currentStamps}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-emerald-800 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Eligible Reward
            </label>
            <div className="space-y-2">
              {rewards.map((r) => {
                const canAfford = card.currentStamps >= r.stampCost;
                return (
                  <label
                    key={r.id}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      selectedRewardId === r.id
                        ? 'border-emerald-600 bg-emerald-50/50'
                        : canAfford
                        ? 'border-slate-200 hover:border-slate-300 bg-white'
                        : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reward"
                      disabled={!canAfford}
                      value={r.id}
                      checked={selectedRewardId === r.id}
                      onChange={() => setSelectedRewardId(r.id)}
                      className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{r.title}</span>
                        <span className="text-xs font-bold text-amber-700 font-mono">
                          {r.stampCost} Stamps
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {r.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={loading || !selectedRewardId}
              onClick={handleRedeem}
              className="w-full py-3.5 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Processing Atomic Redemption...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  <span>Confirm & Complete Redemption</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
