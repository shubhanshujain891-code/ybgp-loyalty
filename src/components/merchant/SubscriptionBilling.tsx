import React from 'react';
import { CreditCard, CheckCircle2, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import { Business, SubscriptionPlan } from '../../types';
import { dbService } from '../../services/db';
import { formatINR, YBGP_CONFIG } from '../../config/ybgp';

interface SubscriptionBillingProps {
  business: Business;
}

export const SubscriptionBilling: React.FC<SubscriptionBillingProps> = ({
  business,
}) => {
  const { subscription, plan } = dbService.getSubscriptionByBusiness(business.id);
  const locations = dbService.getLocationsByBusiness(business.id);
  const memberships = dbService.getMembershipsByBusiness(business.id);
  const transactions = dbService.getStampTransactions(business.id);

  const currentPlan = plan || YBGP_CONFIG.plans[1];

  return (
    <div className="space-y-6">
      {/* Current Plan Overview Card */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              Active SaaS Subscription
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {currentPlan.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Billed monthly at {formatINR(currentPlan.priceMonthlyInPaise)}/mo · Next renewal: Active
            </p>
          </div>

          <div className="text-right">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {formatINR(currentPlan.priceMonthlyInPaise)}
            </span>
            <span className="text-xs text-slate-500 block">per month</span>
          </div>
        </div>

        {/* Plan Usage Counters & Limits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Locations</span>
              <span className="font-bold font-mono">
                {locations.length} / {currentPlan.maxLocations}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full"
                style={{ width: `${(locations.length / currentPlan.maxLocations) * 100}%` }}
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Staff Seats</span>
              <span className="font-bold font-mono">
                {memberships.length} / {currentPlan.maxStaffSeats}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full"
                style={{ width: `${(memberships.length / currentPlan.maxStaffSeats) * 100}%` }}
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>Monthly Stamp Quota</span>
              <span className="font-bold font-mono">
                {transactions.length} / {currentPlan.maxMonthlyStamps}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 rounded-full"
                style={{ width: `${(transactions.length / currentPlan.maxMonthlyStamps) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Feature Entitlements */}
        <div>
          <h4 className="text-xs font-bold text-slate-800 mb-2">
            Plan Feature Entitlements
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {currentPlan.features.map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upgrade Options */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Available Subscription Tiers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {YBGP_CONFIG.plans.map((p) => {
            const isCurrent = p.id === currentPlan.id;
            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  isCurrent
                    ? 'border-slate-900 bg-slate-50/50 shadow-xs ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-slate-700 uppercase bg-white border px-2 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-2 mb-3">
                    <span className="text-xl font-black text-slate-900 font-mono">
                      {formatINR(p.priceMonthlyInPaise)}
                    </span>
                    <span className="text-xs text-slate-500"> /mo</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mb-3">
                    Up to {p.maxLocations} location{p.maxLocations > 1 ? 's' : ''} · {p.maxStaffSeats} staff seats
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isCurrent}
                  className={`w-full py-2 px-3 text-xs font-bold rounded-xl cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-slate-200 text-slate-500 cursor-default'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isCurrent ? 'Active Plan' : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
