import React, { useState } from 'react';
import {
  Shield,
  Building2,
  Users,
  Award,
  CreditCard,
  Settings,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  Lock,
  Power,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { Business, SubscriptionPlan, User } from '../../types';
import { dbService } from '../../services/db';
import { formatINR, YBGP_CONFIG, formatKolkataDate } from '../../config/ybgp';
import { BrandLogo } from '../common/BrandLogo';

interface SuperAdminDashboardProps {
  currentUser: User;
  onSwitchToBusinessTenant: (business: Business) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  currentUser,
  onSwitchToBusinessTenant,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'businesses' | 'plans' | 'settings' | 'audit'>('overview');
  const [businesses, setBusinesses] = useState<Business[]>(() => dbService.getBusinesses());
  const [businessSearch, setBusinessSearch] = useState('');
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Business Status Modal state
  const [statusModalBiz, setStatusModalBiz] = useState<Business | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [newStatus, setNewStatus] = useState<'active' | 'suspended'>('suspended');

  // Provision Form state
  const [provisionForm, setProvisionForm] = useState({
    name: '',
    slug: '',
    category: 'cafe' as Business['category'],
    city: 'Bengaluru',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    planId: 'plan_growth',
  });

  const reloadData = () => {
    setBusinesses([...dbService.getBusinesses()]);
  };

  const allCustomers = businesses.flatMap((b) => dbService.getCustomersByBusiness(b.id));
  const allTransactions = businesses.flatMap((b) => dbService.getStampTransactions(b.id));
  const allRedemptions = businesses.flatMap((b) => dbService.getRedemptions(b.id));
  const allAuditLogs = dbService.getAuditLogs();
  const settings = dbService.getState().platformSettings;

  // Calculate monthly recurring revenue (MRR) from active business subscriptions
  const totalMrrInPaise = businesses.reduce((acc, b) => {
    if (b.status !== 'suspended') {
      const plan = YBGP_CONFIG.plans.find((p) => p.id === b.planId) || YBGP_CONFIG.plans[0];
      return acc + plan.priceMonthlyInPaise;
    }
    return acc;
  }, 0);

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalBiz || !statusReason.trim()) return;

    dbService.setBusinessStatus(statusModalBiz.id, newStatus, statusReason.trim(), currentUser);
    setStatusModalBiz(null);
    setStatusReason('');
    reloadData();
    setActionSuccess(`Business status updated to ${newStatus}.`);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleProvisionBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = dbService.provisionNewBusiness({
        name: provisionForm.name,
        slug: provisionForm.slug,
        category: provisionForm.category,
        ownerName: provisionForm.ownerName,
        ownerEmail: provisionForm.ownerEmail,
        ownerPhone: provisionForm.ownerPhone,
        city: provisionForm.city,
        planId: provisionForm.planId,
        adminUser: currentUser,
      });

      setShowProvisionModal(false);
      setProvisionForm({
        name: '',
        slug: '',
        category: 'cafe',
        city: 'Bengaluru',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        planId: 'plan_growth',
      });
      reloadData();
      setActionSuccess(`Business "${created.name}" successfully provisioned!`);
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Provisioning failed');
    }
  };

  const filteredBusinesses = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(businessSearch.toLowerCase()) ||
      b.slug.toLowerCase().includes(businessSearch.toLowerCase()) ||
      b.city.toLowerCase().includes(businessSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Super Admin Top Header */}
      <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
              YBGP Platform Control Center
            </span>
            <span className="text-xs text-slate-400">· Super Administrator</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>SaaS Administration & Multi-Tenant Management</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Logged in as <strong className="text-amber-300">{currentUser.name}</strong> ({currentUser.email})
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowProvisionModal(true)}
          className="py-3 px-5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Provision New Business</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Platform Overview', icon: TrendingUp },
          { id: 'businesses', label: `Businesses (${businesses.length})`, icon: Building2 },
          { id: 'plans', label: 'Subscription Plans', icon: CreditCard },
          { id: 'settings', label: 'Platform Settings', icon: Settings },
          { id: 'audit', label: `Audit Ledger (${allAuditLogs.length})`, icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
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

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Total Businesses
              </span>
              <p className="text-3xl font-black text-slate-900 font-mono">
                {businesses.length}
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">
                {businesses.filter((b) => b.status === 'active').length} Active ·{' '}
                {businesses.filter((b) => b.status === 'suspended').length} Suspended
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Registered Patrons
              </span>
              <p className="text-3xl font-black text-slate-900 font-mono">
                {allCustomers.length}
              </p>
              <span className="text-[11px] text-slate-500">
                Verified Indian mobile passes
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Stamps Awarded
              </span>
              <p className="text-3xl font-black text-amber-600 font-mono">
                {allTransactions.reduce((acc, t) => acc + (t.stampsAwarded > 0 ? t.stampsAwarded : 0), 0)}
              </p>
              <span className="text-[11px] text-slate-500">
                Across all merchant outlets
              </span>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Monthly SaaS MRR
              </span>
              <p className="text-3xl font-black text-slate-900 font-mono">
                {formatINR(totalMrrInPaise)}
              </p>
              <span className="text-[11px] text-blue-600 font-medium">
                Active subscription base
              </span>
            </div>
          </div>

          {/* Quick Business Overview Table */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Provisioned Businesses & Tenant Health
                </h3>
                <p className="text-xs text-slate-500">
                  Click &apos;Assist Merchant&apos; to view or manage that business tenant.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {businesses.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{b.name}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          b.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      /{b.slug} · {b.city} · Plan: {b.planId.replace('plan_', '').toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSwitchToBusinessTenant(b)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs cursor-pointer flex items-center gap-1"
                    >
                      <span>Assist Merchant</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BUSINESSES */}
      {activeTab === 'businesses' && (
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Multi-Tenant Business Directory
              </h3>
              <p className="text-xs text-slate-500">
                Manage accounts, suspend/reactivate with recorded audit reasons, inspect plans.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search businesses..."
                value={businessSearch}
                onChange={(e) => setBusinessSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Business</th>
                  <th className="py-2.5 px-3 font-semibold">Category</th>
                  <th className="py-2.5 px-3 font-semibold">City</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Plan</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBusinesses.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{b.name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">/b/{b.slug}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 uppercase text-[11px]">
                      {b.category}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{b.city}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          b.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {b.planId.replace('plan_', '').toUpperCase()}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setStatusModalBiz(b);
                          setNewStatus(b.status === 'active' ? 'suspended' : 'active');
                        }}
                        className="px-2 py-1 border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        {b.status === 'active' ? 'Suspend' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSwitchToBusinessTenant(b)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                      >
                        Assist
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PLANS & BILLING */}
      {activeTab === 'plans' && (
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              SaaS Subscription Tiers & Pricing
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard commercial plans configured for the Indian market in INR (₹).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {YBGP_CONFIG.plans.map((p) => (
              <div key={p.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-900">{p.name}</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white border px-2 py-0.5 rounded">
                    {p.tier}
                  </span>
                </div>

                <div>
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {formatINR(p.priceMonthlyInPaise)}
                  </span>
                  <span className="text-xs text-slate-500"> / month</span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200">
                  <div className="flex justify-between">
                    <span>Locations Limit:</span>
                    <span className="font-bold text-slate-800">{p.maxLocations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Staff Seats:</span>
                    <span className="font-bold text-slate-800">{p.maxStaffSeats}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monthly Stamps:</span>
                    <span className="font-bold text-slate-800">{p.maxMonthlyStamps}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Features Included
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-600">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PLATFORM SETTINGS */}
      {activeTab === 'settings' && (
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              Platform Branding & DPDP Privacy Configuration
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Global defaults and Indian compliance parameters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block">Brand Name</span>
              <span className="text-slate-900 font-semibold">{settings.brandName}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block">Domain</span>
              <span className="text-slate-900 font-mono">{settings.domain}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block">Support Contact</span>
              <span className="text-slate-900">{settings.supportEmail} · {settings.supportPhone}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block">SMS Mode</span>
              <span className="text-emerald-700 font-bold uppercase">{settings.smsProviderMode} (Test Simulation Ready)</span>
            </div>
            <div className="md:col-span-2 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-700 block">Indian DPDP Notice Disclosure</span>
              <p className="text-slate-600 leading-relaxed text-[11px]">{settings.dpdpConsentText}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              Immutable Platform Security Audit Trail
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Append-only audit ledger of all tenant provisions, status changes, and administrative actions.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Time (IST)</th>
                  <th className="py-2.5 px-3 font-semibold">Actor</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                  <th className="py-2.5 px-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                      {formatKolkataDate(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                      {log.userName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PROVISION NEW BUSINESS MODAL */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">
              Provision New Merchant Business
            </h3>
            <form onSubmit={handleProvisionBusiness} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bombay Sweet House"
                  value={provisionForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
                    setProvisionForm({ ...provisionForm, name, slug });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">URL Slug (/b/slug)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. bombay-sweets"
                  value={provisionForm.slug}
                  onChange={(e) => setProvisionForm({ ...provisionForm, slug: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={provisionForm.category}
                    onChange={(e) => setProvisionForm({ ...provisionForm, category: e.target.value as Business['category'] })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="cafe">Café & Coffee</option>
                    <option value="salon">Salon & Spa</option>
                    <option value="bakery">Bakery</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="sweet_shop">Sweet Shop</option>
                    <option value="gym">Gym / Fitness</option>
                    <option value="retail">Retail / Store</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    placeholder="Bengaluru"
                    value={provisionForm.city}
                    onChange={(e) => setProvisionForm({ ...provisionForm, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Owner Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Owner Full Name"
                    value={provisionForm.ownerName}
                    onChange={(e) => setProvisionForm({ ...provisionForm, ownerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Owner Phone (+91)</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={provisionForm.ownerPhone}
                    onChange={(e) => setProvisionForm({ ...provisionForm, ownerPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Owner Email</label>
                <input
                  type="email"
                  required
                  placeholder="owner@domain.com"
                  value={provisionForm.ownerEmail}
                  onChange={(e) => setProvisionForm({ ...provisionForm, ownerEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">SaaS Plan</label>
                <select
                  value={provisionForm.planId}
                  onChange={(e) => setProvisionForm({ ...provisionForm, planId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
                >
                  <option value="plan_starter">Starter Plan (₹799/mo)</option>
                  <option value="plan_growth">Growth Plan (₹1,499/mo)</option>
                  <option value="plan_pro">Multi-Outlet Pro (₹2,999/mo)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold"
                >
                  Provision & Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUSPEND / REACTIVATE STATUS MODAL */}
      {statusModalBiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-900">
              {newStatus === 'suspended' ? 'Suspend Business Account' : 'Reactivate Business Account'}
            </h3>
            <p className="text-xs text-slate-500">
              Business: <strong>{statusModalBiz.name}</strong>
            </p>

            <form onSubmit={handleUpdateStatus} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Subscription payment overdue / Requested reactivation"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalBiz(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl font-bold text-white ${
                    newStatus === 'suspended' ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  Confirm {newStatus === 'suspended' ? 'Suspension' : 'Reactivation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
