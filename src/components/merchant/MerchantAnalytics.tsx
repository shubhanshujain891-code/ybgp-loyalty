import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  Users,
  QrCode,
  Download,
  Undo2,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { Business, StampTransaction, User } from '../../types';
import { dbService } from '../../services/db';
import { exportToCsv } from '../../services/export';
import { formatKolkataDate } from '../../config/ybgp';
import { StampReversalModal } from './StampReversalModal';

interface MerchantAnalyticsProps {
  business: Business;
  currentUser: User;
}

export const MerchantAnalytics: React.FC<MerchantAnalyticsProps> = ({
  business,
  currentUser,
}) => {
  const [transactions, setTransactions] = useState<StampTransaction[]>(() =>
    dbService.getStampTransactions(business.id)
  );
  const [reversingTx, setReversingTx] = useState<StampTransaction | null>(null);

  const customers = dbService.getCustomersByBusiness(business.id);
  const redemptions = dbService.getRedemptions(business.id);
  const links = dbService.getAllLinksByBusiness(business.id);

  const totalStampsAwarded = transactions
    .filter((t) => t.type === 'award')
    .reduce((sum, t) => sum + t.stampsAwarded, 0);

  const totalLinkClicks = links.reduce((sum, l) => sum + (l.clickCount || 0), 0);

  const handleExportTransactions = () => {
    const rows = transactions.map((t) => ({
      'Transaction ID': t.id,
      Type: t.type,
      Customer: t.customerName,
      'Stamps Count': t.stampsAwarded,
      'Staff Member': t.staffName,
      Location: t.locationName,
      Reason: t.reversalReason || t.note || '',
      Date: formatKolkataDate(t.createdAt),
    }));
    exportToCsv(`${business.slug}-stamp-ledger`, rows);
  };

  const handleReversalSuccess = () => {
    setReversingTx(null);
    setTransactions(dbService.getStampTransactions(business.id));
  };

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Total Patrons
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {customers.length}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">
            100% Verified mobile numbers
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Stamps Awarded
            </span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 font-mono">
            {totalStampsAwarded}
          </p>
          <span className="text-[10px] text-slate-500">
            Across {transactions.length} transactions
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Rewards Redeemed
            </span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-700 font-mono">
            {redemptions.length}
          </p>
          <span className="text-[10px] text-slate-500">
            Repeat patron incentive
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Link & QR Visits
            </span>
            <QrCode className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {totalLinkClicks}
          </p>
          <span className="text-[10px] text-blue-600 font-medium">
            Google Reviews & WhatsApp leads
          </span>
        </div>
      </div>

      {/* Stamp Transactions Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Append-Only Stamp Ledger & Audit History
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Every stamp award and reversal is immutably logged with staff accountability.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportTransactions}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Ledger CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Tx ID</th>
                <th className="py-2.5 px-3 font-semibold">Customer</th>
                <th className="py-2.5 px-3 font-semibold">Staff Member</th>
                <th className="py-2.5 px-3 font-semibold">Stamps</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Time (IST)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                    No stamp transactions recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                      {tx.id.slice(0, 10)}...
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {tx.customerName}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {tx.staffName}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-bold font-mono ${
                          tx.stampsAwarded > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {tx.stampsAwarded > 0 ? `+${tx.stampsAwarded}` : tx.stampsAwarded}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider ${
                          tx.type === 'award' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {formatKolkataDate(tx.createdAt)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {tx.type === 'award' && currentUser.role !== 'cashier' && (
                        <button
                          type="button"
                          onClick={() => setReversingTx(tx)}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                          title="Reverse this transaction with reason"
                        >
                          <Undo2 className="w-3 h-3" />
                          <span>Reverse</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reversal Modal */}
      {reversingTx && (
        <StampReversalModal
          business={business}
          transaction={reversingTx}
          currentUser={currentUser}
          isOpen={!!reversingTx}
          onClose={() => setReversingTx(null)}
          onSuccess={handleReversalSuccess}
        />
      )}
    </div>
  );
};
