import React, { useState, useEffect } from 'react';
import { dbService } from './services/db';
import { Business, User } from './types';
import { TopNavBar, ActiveExperience } from './components/navigation/TopNavBar';
import { PublicShopView } from './components/customer/PublicShopView';
import { MerchantDashboard } from './components/merchant/MerchantDashboard';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { CheckCircle2, Info, X } from 'lucide-react';

export default function App() {
  const [experience, setExperience] = useState<ActiveExperience>('merchant');
  const [businesses, setBusinesses] = useState<Business[]>(() => dbService.getBusinesses());
  const [currentBusiness, setCurrentBusiness] = useState<Business>(
    () => dbService.getBusinesses()[0]
  );
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const owner = dbService.getUsers().find((u) => u.businessId === dbService.getBusinesses()[0]?.id);
    return owner || dbService.getUsers()[1];
  });
  const [scenarioBanner, setScenarioBanner] = useState<{ title: string; desc: string } | null>(null);

  // Sync state on db changes
  useEffect(() => {
    const unsubscribe = dbService.subscribe(() => {
      const allBiz = dbService.getBusinesses();
      setBusinesses(allBiz);
      const updatedCurr = allBiz.find((b) => b.id === currentBusiness.id);
      if (updatedCurr) {
        setCurrentBusiness(updatedCurr);
      }
    });
    return unsubscribe;
  }, [currentBusiness.id]);

  // Handle Scenario Quick Shortcuts
  const handleTriggerScenario = (scenarioKey: string) => {
    switch (scenarioKey) {
      case 'scenario_a':
        setExperience('merchant');
        setScenarioBanner({
          title: 'Scenario A: Shop Onboarding & Bio Links Hub',
          desc: 'Configure business details, Google Reviews destination URL, and custom links in "Business Links & Reviews". Then preview the live customer page.',
        });
        break;
      case 'scenario_b':
        setExperience('customer');
        setScenarioBanner({
          title: 'Scenario B: Customer Registration & Mobile Verification',
          desc: 'Click "Get My Digital Stamp Card", enter a mobile number with DPDP consent, and complete the instant verification to receive a luxury digital stamp pass.',
        });
        break;
      case 'scenario_c':
        setExperience('merchant');
        setScenarioBanner({
          title: 'Scenario C: Cashier Scans Customer QR Pass & Awards Stamp',
          desc: 'Click the prominent "Scan Customer QR" button. Use camera scanner or manual lookup (e.g. choose Ananya or enter phone) and confirm the stamp award with idempotency.',
        });
        break;
      case 'scenario_d':
        setExperience('merchant');
        setScenarioBanner({
          title: 'Scenario D: Stamp Threshold & Reward Redemption',
          desc: 'Scan Rahul Kulkarni (who has 8/8 stamps completed). Click "Redeem Now" to process the atomic single-use redemption and see the code generated.',
        });
        break;
      case 'scenario_e':
        setExperience('merchant');
        setScenarioBanner({
          title: 'Scenario E: Tenant Isolation & Cashier Role Guards',
          desc: 'Change active user to Cashier (Rohit) in top bar, then check Ledger: cashiers are blocked from reversing stamps without manager authorization.',
        });
        break;
      case 'scenario_f':
        setExperience('admin');
        const adminUser = dbService.getUsers().find((u) => u.role === 'platform_admin');
        if (adminUser) setCurrentUser(adminUser);
        setScenarioBanner({
          title: 'Scenario F: YBGP Super Admin Oversight & MRR in INR',
          desc: 'Inspect multi-tenant businesses, MRR revenue metrics, commercial subscription tiers, immutable audit ledger, or provision a new local business.',
        });
        break;
      default:
        break;
    }
  };

  const handleSwitchToTenant = (business: Business) => {
    setCurrentBusiness(business);
    const owner = dbService.getUsers().find((u) => u.businessId === business.id) || dbService.getUsers()[0];
    setCurrentUser(owner);
    setExperience('merchant');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-amber-200">
      {/* Top Universal App Navigation Bar */}
      <TopNavBar
        experience={experience}
        onExperienceChange={(exp) => {
          setExperience(exp);
          if (exp === 'admin') {
            const admin = dbService.getUsers().find((u) => u.role === 'platform_admin');
            if (admin) setCurrentUser(admin);
          } else if (currentUser.role === 'platform_admin') {
            const owner = dbService.getUsers().find((u) => u.businessId === currentBusiness.id);
            if (owner) setCurrentUser(owner);
          }
        }}
        currentBusiness={currentBusiness}
        onBusinessChange={(b) => {
          setCurrentBusiness(b);
          const owner = dbService.getUsers().find((u) => u.businessId === b.id);
          if (owner) setCurrentUser(owner);
        }}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
        onTriggerScenario={handleTriggerScenario}
      />

      {/* Scenario Explanatory Banner */}
      {scenarioBanner && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-slate-950" />
              <span>
                <strong>{scenarioBanner.title}:</strong> {scenarioBanner.desc}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setScenarioBanner(null)}
              className="p-1 hover:bg-amber-600 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Experience Body */}
      <main className="flex-1 pb-16">
        {experience === 'customer' ? (
          /* EXPERIENCE 1: PUBLIC CUSTOMER EXPERIENCE (/b/:slug) */
          <PublicShopView
            businessSlug={currentBusiness.slug}
            onNavigateToMerchant={() => setExperience('merchant')}
          />
        ) : experience === 'merchant' ? (
          /* EXPERIENCE 2: SHOPKEEPER DASHBOARD & QR SCANNER */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <MerchantDashboard
              business={currentBusiness}
              currentUser={currentUser}
              onBusinessUpdated={setCurrentBusiness}
              onPreviewPublicPage={() => setExperience('customer')}
            />
          </div>
        ) : (
          /* EXPERIENCE 3: YBGP SUPER ADMIN DASHBOARD */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <SuperAdminDashboard
              currentUser={currentUser}
              onSwitchToBusinessTenant={handleSwitchToTenant}
            />
          </div>
        )}
      </main>

      {/* Bottom Legal & Platform Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © 2026 YBGP Loyalty — Your Business Growth Partner. All rights reserved.
          </span>
          <div className="flex items-center gap-3">
            <a href="https://ybgp.in/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              DPDP Privacy Notice
            </a>
            <span aria-hidden="true">·</span>
            <a href="https://ybgp.in/terms" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              Merchant Terms
            </a>
            <span aria-hidden="true">·</span>
            <span>Asia/Kolkata (IST)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
