import React, { useState } from 'react';
import {
  Smartphone,
  Store,
  Shield,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Business, User, UserRole } from '../../types';
import { dbService } from '../../services/db';
import { BrandLogo } from '../common/BrandLogo';

export type ActiveExperience = 'customer' | 'merchant' | 'admin';

interface TopNavBarProps {
  experience: ActiveExperience;
  onExperienceChange: (exp: ActiveExperience) => void;
  currentBusiness: Business;
  onBusinessChange: (business: Business) => void;
  currentUser: User;
  onUserChange: (user: User) => void;
  onTriggerScenario?: (scenarioKey: string) => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  experience,
  onExperienceChange,
  currentBusiness,
  onBusinessChange,
  currentUser,
  onUserChange,
  onTriggerScenario,
}) => {
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const businesses = dbService.getBusinesses();
  const allUsers = dbService.getUsers();

  const handleReset = () => {
    if (confirm('Reset YBGP database back to initial seed data?')) {
      dbService.resetToSeed();
      window.location.reload();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Brand Mark */}
          <div className="flex items-center gap-3 shrink-0">
            <BrandLogo size="md" showTagline />
          </div>

          {/* Experience Switcher Tabs (Customer | Merchant | Super Admin) */}
          <div className="hidden md:flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => onExperienceChange('customer')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
                experience === 'customer'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-600" />
              <span>Customer Shop Page</span>
            </button>

            <button
              type="button"
              onClick={() => onExperienceChange('merchant')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
                experience === 'merchant'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-slate-900" />
              <span>Merchant Portal</span>
            </button>

            <button
              type="button"
              onClick={() => onExperienceChange('admin')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all ${
                experience === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>YBGP Admin</span>
            </button>
          </div>

          {/* Tenant & Role Selectors */}
          <div className="flex items-center gap-2">
            {/* Business Tenant Dropdown */}
            {experience !== 'admin' && (
              <div className="relative">
                <select
                  value={currentBusiness.id}
                  onChange={(e) => {
                    const selected = businesses.find((b) => b.id === e.target.value);
                    if (selected) onBusinessChange(selected);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 hover:bg-slate-100 cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* User Role Selector */}
            {experience === 'merchant' && (
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const u = allUsers.find((usr) => usr.id === e.target.value);
                  if (u) onUserChange(u);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                {allUsers
                  .filter((u) => u.businessId === currentBusiness.id || u.role === 'platform_admin')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
              </select>
            )}

            {/* Quick Definition of Done Scenario Guide */}
            {onTriggerScenario && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowScenarioMenu(!showScenarioMenu)}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Scenario Guide</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showScenarioMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 text-xs space-y-1 z-50 animate-in fade-in zoom-in-95">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-2 py-1">
                      Test Definition of Done Scenarios
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        onTriggerScenario('scenario_a');
                        setShowScenarioMenu(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      <strong className="block text-slate-900">Scenario A: Shop Onboarding</strong>
                      <span className="text-[11px] text-slate-500">Configure profile, links, Google review destination</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTriggerScenario('scenario_b');
                        setShowScenarioMenu(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      <strong className="block text-slate-900">Scenario B: Customer Registration</strong>
                      <span className="text-[11px] text-slate-500">Register patron with DPDP consent & SMS OTP</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTriggerScenario('scenario_c');
                        setShowScenarioMenu(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      <strong className="block text-slate-900">Scenario C: Award Stamp Workflow</strong>
                      <span className="text-[11px] text-slate-500">Scan customer QR pass & award stamp with idempotency</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTriggerScenario('scenario_d');
                        setShowScenarioMenu(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      <strong className="block text-slate-900">Scenario D: Reward Redemption</strong>
                      <span className="text-[11px] text-slate-500">Redeem completed reward pass atomically</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTriggerScenario('scenario_e');
                        setShowScenarioMenu(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      <strong className="block text-slate-900">Scenario E: Tenant Isolation</strong>
                      <span className="text-[11px] text-slate-500">Verify tenant isolation & cashier permissions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onTriggerScenario('scenario_f');
                        setShowScenarioMenu(false);
                      }}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      <strong className="block text-slate-900">Scenario F: YBGP Super Admin</strong>
                      <span className="text-[11px] text-slate-500">Oversight, MRR in INR, tenant suspension & audit</span>
                    </button>

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="w-full text-left p-2 text-slate-600 hover:bg-red-50 hover:text-red-700 rounded-xl cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset Seed Data</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reset Seed Button */}
            <button
              type="button"
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer"
              title="Reset Database to Seed State"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile View Switcher */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={() => onExperienceChange('customer')}
            className={`font-semibold ${experience === 'customer' ? 'text-amber-600 font-bold' : 'text-slate-500'}`}
          >
            Customer Page
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => onExperienceChange('merchant')}
            className={`font-semibold ${experience === 'merchant' ? 'text-slate-900 font-bold' : 'text-slate-500'}`}
          >
            Merchant Portal
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => onExperienceChange('admin')}
            className={`font-semibold ${experience === 'admin' ? 'text-indigo-600 font-bold' : 'text-slate-500'}`}
          >
            Super Admin
          </button>
        </div>
      </div>
    </header>
  );
};
