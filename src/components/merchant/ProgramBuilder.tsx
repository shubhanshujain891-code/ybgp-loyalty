import React, { useState } from 'react';
import {
  Award,
  Save,
  Check,
  AlertCircle,
  Sparkles,
  Trophy,
  Info,
} from 'lucide-react';
import { Business, LoyaltyProgram } from '../../types';
import { dbService } from '../../services/db';

interface ProgramBuilderProps {
  business: Business;
  program?: LoyaltyProgram;
  onProgramUpdated: (updated: LoyaltyProgram) => void;
}

export const ProgramBuilder: React.FC<ProgramBuilderProps> = ({
  business,
  program,
  onProgramUpdated,
}) => {
  const [form, setForm] = useState({
    name: program?.name || `${business.name} Rewards`,
    description: program?.description || 'Earn stamps on every visit to unlock your perk.',
    stampTarget: program?.stampTarget || 8,
    rewardTitle: program?.rewardTitle || 'Complimentary Specialty Treat',
    rewardDescription: program?.rewardDescription || 'Enjoy a free handcrafted item on completing your card.',
    minSpendInRupees: program ? Math.floor(program.minSpendInPaise / 100) : 150,
    maxStampsPerDay: program?.maxStampsPerDay || 2,
    stampExpiryDays: program?.stampExpiryDays || 180,
    termsAndConditions: program?.termsAndConditions || 'Stamps awarded on bills above minimum spend.',
    status: program?.status || 'active',
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.stampTarget < 3 || form.stampTarget > 20) {
      setError('Stamp target must be between 3 and 20 stamps.');
      return;
    }

    try {
      const updated = dbService.updateLoyaltyProgram(business.id, {
        name: form.name,
        description: form.description,
        stampTarget: Number(form.stampTarget),
        rewardTitle: form.rewardTitle,
        rewardDescription: form.rewardDescription,
        minSpendInPaise: Number(form.minSpendInRupees) * 100,
        maxStampsPerDay: Number(form.maxStampsPerDay),
        stampExpiryDays: Number(form.stampExpiryDays),
        termsAndConditions: form.termsAndConditions,
        status: form.status as LoyaltyProgram['status'],
      });

      onProgramUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update program';
      setError(msg);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Configuration Form */}
      <div className="lg:col-span-2">
        <form
          onSubmit={handleSubmit}
          className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Loyalty Program & Reward Rules
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure your digital stamp card rules, stamp targets, and reward incentives.
              </p>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              {saved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saved ? 'Rules Saved!' : 'Save Program Rules'}</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Program Name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                placeholder="e.g. Chai & Co. Coffee Club"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stamp Target (Per Reward)
              </label>
              <select
                value={form.stampTarget}
                onChange={(e) => setForm({ ...form, stampTarget: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white cursor-pointer font-bold"
              >
                <option value={4}>4 Stamps (Quick Gratification)</option>
                <option value={6}>6 Stamps (Popular for Salons/Gyms)</option>
                <option value={8}>8 Stamps (Recommended for Cafés/Bakeries)</option>
                <option value={10}>10 Stamps (Great for Retail/Sweets)</option>
                <option value={12}>12 Stamps (High-frequency visits)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Min Spend Required (₹ INR)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={form.minSpendInRupees}
                  onChange={(e) => setForm({ ...form, minSpendInRupees: Number(e.target.value) })}
                  className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono font-semibold"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reward Title (Unlocked at {form.stampTarget} Stamps)
              </label>
              <input
                type="text"
                required
                value={form.rewardTitle}
                onChange={(e) => setForm({ ...form, rewardTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-semibold"
                placeholder="e.g. Free Specialty Latte & Fresh Croissant"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reward Description
              </label>
              <textarea
                rows={2}
                value={form.rewardDescription}
                onChange={(e) => setForm({ ...form, rewardDescription: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                placeholder="Provide details on what the customer receives when redeeming this reward..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Stamps Per Customer Per Day
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.maxStampsPerDay}
                onChange={(e) => setForm({ ...form, maxStampsPerDay: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stamp Expiry (Days)
              </label>
              <input
                type="number"
                min={30}
                max={365}
                value={form.stampExpiryDays}
                onChange={(e) => setForm({ ...form, stampExpiryDays: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Terms & Conditions
              </label>
              <textarea
                rows={2}
                value={form.termsAndConditions}
                onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                placeholder="Disclose branch validity, redemption limits, or blackout dates..."
              />
            </div>
          </div>
        </form>
      </div>

      {/* Live Digital Card Preview */}
      <div>
        <div className="sticky top-6 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Live Patron Pass Preview
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              Customer View
            </span>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-md space-y-4">
            <div
              className="p-4 rounded-xl text-white relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${business.brandColor || '#0F172A'} 0%, #0F172A 100%)`,
              }}
            >
              <span className="text-[9px] font-bold tracking-widest uppercase text-amber-300 block mb-0.5">
                Digital Pass
              </span>
              <h3 className="text-base font-bold leading-tight">{business.name}</h3>
              <p className="text-[11px] text-slate-200 mt-0.5 line-clamp-1">{form.name}</p>

              <div className="mt-3 pt-2 border-t border-white/20 flex items-center justify-between text-[11px]">
                <span className="text-slate-300">Target:</span>
                <span className="font-bold text-amber-300 font-mono">
                  {form.stampTarget} Stamps = 1 Reward
                </span>
              </div>
            </div>

            {/* Stamp Grid Mockup */}
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: form.stampTarget }).map((_, idx) => (
                <div
                  key={idx}
                  className={`aspect-square rounded-xl border flex items-center justify-center text-xs font-mono ${
                    idx < 2
                      ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                      : idx === form.stampTarget - 1
                      ? 'bg-amber-50 border-amber-200 text-amber-600'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  {idx < 2 ? '✓' : idx === form.stampTarget - 1 ? <Trophy className="w-4 h-4 text-amber-500" /> : idx + 1}
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs">
              <span className="text-[10px] font-bold text-amber-800 uppercase block">Reward</span>
              <span className="font-bold text-slate-900 block mt-0.5">{form.rewardTitle}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
