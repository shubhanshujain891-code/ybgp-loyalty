import React, { useState } from 'react';
import {
  Camera,
  Users,
  Award,
  Link as LinkIcon,
  QrCode,
  TrendingUp,
  Settings,
  CreditCard,
  Plus,
  ExternalLink,
  Printer,
  ChevronRight,
  ShieldCheck,
  Building2,
  Gift,
} from 'lucide-react';
import { Business, LoyaltyCard, User } from '../../types';
import { dbService } from '../../services/db';
import { ScannerModal } from './ScannerModal';
import { CustomerDirectory } from './CustomerDirectory';
import { ProgramBuilder } from './ProgramBuilder';
import { LinksManager } from './LinksManager';
import { QrStandeeGenerator } from './QrStandeeGenerator';
import { MerchantAnalytics } from './MerchantAnalytics';
import { TeamAndLocations } from './TeamAndLocations';
import { SubscriptionBilling } from './SubscriptionBilling';
import { RewardRedemptionModal } from './RewardRedemptionModal';
import { formatKolkataDate } from '../../config/ybgp';

interface MerchantDashboardProps {
  business: Business;
  currentUser: User;
  onBusinessUpdated: (b: Business) => void;
  onPreviewPublicPage: () => void;
}

export type MerchantTab =
  | 'overview'
  | 'scan'
  | 'customers'
  | 'program'
  | 'links'
  | 'standee'
  | 'analytics'
  | 'team'
  | 'billing';

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({
  business,
  currentUser,
  onBusinessUpdated,
  onPreviewPublicPage,
}) => {
  const [activeTab, setActiveTab] = useState<MerchantTab>('overview');
  const [showScanner, setShowScanner] = useState(false);
  const [redeemCard, setRedeemCard] = useState<LoyaltyCard | null>(null);
  const [redeemEntitlementId, setRedeemEntitlementId] = useState<string | undefined>(undefined);
  const [redemptionSuccessCode, setRedemptionSuccessCode] = useState<string | null>(null);

  const program = dbService.getActiveProgramByBusiness(business.id);
  const customers = dbService.getCustomersByBusiness(business.id);
  const transactions = dbService.getStampTransactions(business.id);
  const redemptions = dbService.getRedemptions(business.id);

  const todayTransactions = transactions.filter((t) => {
    const today = new Date().toISOString().slice(0, 10);
    return t.createdAt.startsWith(today);
  });

  return (
    <div className="space-y-6">
      {/* Top Merchant Hero Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900 text-white rounded-3xl shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              Merchant Operations
            </span>
            <span className="text-xs text-slate-400">· {business.category.toUpperCase()}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>{business.name}</span>
          </h1>

          <p className="text-xs text-slate-300 mt-1">
            Logged in as <strong className="text-amber-300">{currentUser.name}</strong> ({currentUser.role})
            · Public URL: <code className="text-slate-400">/b/{business.slug}</code>
          </p>
        </div>

        {/* Primary Action Button: SCAN CUSTOMER QR (Section 6) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="py-3.5 px-6 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Camera className="w-5 h-5 text-slate-950" />
            <span>Scan Customer QR</span>
          </button>

          <button
            type="button"
            onClick={onPreviewPublicPage}
            className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-2xl flex items-center gap-2 cursor-pointer border border-slate-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-slate-300" />
            <span className="hidden sm:inline">View Public Shop</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'customers', label: `Patrons (${customers.length})`, icon: Users },
          { id: 'program', label: 'Loyalty Program', icon: Award },
          { id: 'links', label: 'Business Links & Reviews', icon: LinkIcon },
          { id: 'standee', label: 'Counter Standee', icon: QrCode },
          { id: 'analytics', label: 'Ledger & Audit', icon: TrendingUp },
          { id: 'team', label: 'Team & Outlets', icon: Building2 },
          { id: 'billing', label: 'Subscription', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as MerchantTab)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Today&apos;s Scans
              </span>
              <p className="text-3xl font-black text-slate-900 font-mono">
                {todayTransactions.length}
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {todayTransactions.reduce((acc, t) => acc + t.stampsAwarded, 0)} stamps awarded today
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Active Patrons
              </span>
              <p className="text-3xl font-black text-slate-900 font-mono">
                {customers.length}
              </p>
              <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
                Registered via OTP verification
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Rewards Claimed
              </span>
              <p className="text-3xl font-black text-emerald-700 font-mono">
                {redemptions.length}
              </p>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Single-use atomic redemptions
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Active Program
              </span>
              <p className="text-sm font-bold text-slate-900 line-clamp-1 mt-1">
                {program?.name || 'Standard Rewards'}
              </p>
              <span className="text-[11px] text-amber-600 font-semibold mt-1 block">
                {program?.stampTarget || 8} stamps target
              </span>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setShowScanner(true)}
              className="p-5 bg-amber-50/70 border border-amber-200/80 rounded-2xl hover:bg-amber-100/70 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <Camera className="w-6 h-6 text-amber-700" />
                <span className="text-[10px] font-bold uppercase text-amber-800">
                  Daily Flow
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Scan Patron QR Pass
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Point camera at customer&apos;s phone to award stamps or redeem unlocked rewards.
              </p>
            </div>

            <div
              onClick={() => setActiveTab('standee')}
              className="p-5 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <Printer className="w-6 h-6 text-slate-700" />
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  Counter Sign
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Print Counter Standee
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Download high-resolution QR poster with YBGP brand and table tent format.
              </p>
            </div>

            <div
              onClick={() => setActiveTab('links')}
              className="p-5 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <LinkIcon className="w-6 h-6 text-slate-700" />
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  Link Hub
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Google Reviews & Links
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Update verified review destination, WhatsApp template, and custom bio links.
              </p>
            </div>
          </div>

          {/* Recent Ledger Activity */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Stamp Awards
                </h3>
                <p className="text-xs text-slate-500">
                  Last transactions processed at your counters
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 cursor-pointer"
              >
                View Full Ledger →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      {tx.customerName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatKolkataDate(tx.createdAt)} · By {tx.staffName}
                    </span>
                  </div>
                  <span
                    className={`font-bold font-mono text-sm ${
                      tx.stampsAwarded > 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {tx.stampsAwarded > 0 ? `+${tx.stampsAwarded}` : tx.stampsAwarded}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CUSTOMERS */}
      {activeTab === 'customers' && (
        <CustomerDirectory
          business={business}
          currentUser={currentUser}
          onSelectCustomerCard={() => setShowScanner(true)}
        />
      )}

      {/* TAB CONTENT: PROGRAM BUILDER */}
      {activeTab === 'program' && (
        <ProgramBuilder
          business={business}
          program={program}
          onProgramUpdated={() => {
            // Updated
          }}
        />
      )}

      {/* TAB CONTENT: LINKS & PROFILE */}
      {activeTab === 'links' && (
        <LinksManager
          business={business}
          onBusinessUpdated={onBusinessUpdated}
        />
      )}

      {/* TAB CONTENT: STANDEE & QR */}
      {activeTab === 'standee' && (
        <QrStandeeGenerator
          business={business}
          program={program}
          onPreviewPublicPage={onPreviewPublicPage}
        />
      )}

      {/* TAB CONTENT: ANALYTICS & LEDGER */}
      {activeTab === 'analytics' && (
        <MerchantAnalytics
          business={business}
          currentUser={currentUser}
        />
      )}

      {/* TAB CONTENT: TEAM & OUTLETS */}
      {activeTab === 'team' && (
        <TeamAndLocations
          business={business}
          currentUser={currentUser}
        />
      )}

      {/* TAB CONTENT: SUBSCRIPTION & BILLING */}
      {activeTab === 'billing' && (
        <SubscriptionBilling
          business={business}
        />
      )}

      {/* MODAL: QR CAMERA SCANNER */}
      {showScanner && (
        <ScannerModal
          business={business}
          currentUser={currentUser}
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onRewardRedeemRequested={(card, entId) => {
            setRedeemCard(card);
            setRedeemEntitlementId(entId);
          }}
        />
      )}

      {/* MODAL: REWARD REDEMPTION */}
      {redeemCard && (
        <RewardRedemptionModal
          business={business}
          card={redeemCard}
          currentUser={currentUser}
          entitlementId={redeemEntitlementId}
          isOpen={!!redeemCard}
          onClose={() => {
            setRedeemCard(null);
            setRedeemEntitlementId(undefined);
          }}
          onSuccess={(code) => {
            setRedeemCard(null);
            setRedeemEntitlementId(undefined);
            setRedemptionSuccessCode(code);
          }}
        />
      )}

      {/* SUCCESS MODAL FOR REDEMPTION */}
      {redemptionSuccessCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="p-6 bg-white rounded-3xl max-w-sm w-full text-center space-y-3 shadow-2xl">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Gift className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Reward Redeemed Successfully!
            </h3>
            <p className="text-xs text-slate-600">
              Redemption verification code:
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-lg font-black text-slate-900">
              {redemptionSuccessCode}
            </div>
            <p className="text-[11px] text-slate-400">
              Stamps have been deducted and customer card has cycled to active.
            </p>
            <button
              type="button"
              onClick={() => setRedemptionSuccessCode(null)}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
