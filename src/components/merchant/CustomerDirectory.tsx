import React, { useState } from 'react';
import {
  Search,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  Award,
} from 'lucide-react';
import { Business, LoyaltyCustomer, User } from '../../types';
import { dbService } from '../../services/db';
import { exportToCsv } from '../../services/export';
import { formatKolkataDate } from '../../config/ybgp';

interface CustomerDirectoryProps {
  business: Business;
  currentUser: User;
  onSelectCustomerCard?: (token: string) => void;
}

export const CustomerDirectory: React.FC<CustomerDirectoryProps> = ({
  business,
  currentUser,
  onSelectCustomerCard,
}) => {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>(() =>
    dbService.getCustomersByBusiness(business.id)
  );

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phoneNormalized.includes(query) ||
      c.phoneMasked.includes(query)
  );

  const handleExportCsv = () => {
    const rows = customers.map((c) => {
      const card = dbService.getCustomerCard(c.id);
      return {
        'Customer ID': c.id,
        Name: c.name,
        'Phone (Masked)': c.phoneMasked,
        'Current Stamps': card?.currentStamps || 0,
        'Total Lifetime Stamps': card?.totalLifetimeStamps || 0,
        'Total Redemptions': c.totalRewardsRedeemed,
        'Last Visit': c.lastVisitAt ? formatKolkataDate(c.lastVisitAt) : '',
        'Joined At': formatKolkataDate(c.createdAt),
      };
    });
    exportToCsv(`${business.slug}-customers`, rows);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Registered Patrons & Loyalty Members
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {customers.length} total registered customers for {business.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white w-52"
            />
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Mobile</th>
                <th className="py-3 px-4 font-semibold">Active Stamps</th>
                <th className="py-3 px-4 font-semibold">Rewards Claimed</th>
                <th className="py-3 px-4 font-semibold">Last Visit</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No customers match your search query.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const card = dbService.getCustomerCard(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-[11px]">
                            {c.name.charAt(0)}
                          </div>
                          <span>{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {c.phoneMasked}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 font-mono text-sm">
                          {card?.currentStamps || 0}
                        </span>
                        <span className="text-slate-400 text-[11px] ml-1">
                          ({card?.totalLifetimeStamps || 0} lifetime)
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-medium font-mono">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          {c.totalRewardsRedeemed}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {c.lastVisitAt ? formatKolkataDate(c.lastVisitAt) : 'Never'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {card && onSelectCustomerCard && (
                          <button
                            type="button"
                            onClick={() => onSelectCustomerCard(card.qrTokenRaw)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Inspect Pass
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
