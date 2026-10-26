import React, { useState, useEffect } from 'react';
import {
  Star,
  MapPin,
  Phone,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Trophy,
  Clock,
  Instagram,
  Coffee,
  Globe,
  Share2,
  Check,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { Business, BusinessLink, LoyaltyCard, LoyaltyCustomer, LoyaltyProgram, StampTransaction } from '../../types';
import { dbService } from '../../services/db';
import { CustomerRegistrationModal } from './CustomerRegistrationModal';
import { DigitalStampCard } from './DigitalStampCard';
import { BrandLogo } from '../common/BrandLogo';

interface PublicShopViewProps {
  businessSlug: string;
  onNavigateToMerchant?: () => void;
}

export const PublicShopView: React.FC<PublicShopViewProps> = ({
  businessSlug,
}) => {
  const [business, setBusiness] = useState<Business | undefined>(() =>
    dbService.getBusinessBySlug(businessSlug)
  );
  const [links, setLinks] = useState<BusinessLink[]>([]);
  const [program, setProgram] = useState<LoyaltyProgram | undefined>();
  const [customer, setCustomer] = useState<LoyaltyCustomer | null>(null);
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [transactions, setTransactions] = useState<StampTransaction[]>([]);
  const [showRegModal, setShowRegModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const reloadData = React.useCallback(() => {
    const biz = dbService.getBusinessBySlug(businessSlug);
    setBusiness(biz);
    if (biz) {
      setLinks(dbService.getLinksByBusiness(biz.id));
      const activeProg = dbService.getActiveProgramByBusiness(biz.id);
      setProgram(activeProg);

      // Check if user has an active card in localStorage session
      const savedToken = localStorage.getItem(`ybgp_cust_token_${biz.id}`);
      if (savedToken) {
        const resolved = dbService.getCardByQrToken(savedToken);
        if (resolved) {
          setCustomer(resolved.customer);
          setCard(resolved.card);
          const allTx = dbService.getStampTransactions(biz.id);
          setTransactions(allTx.filter((t) => t.cardId === resolved.card.id));
        }
      }
    }
  }, [businessSlug]);

  useEffect(() => {
    reloadData();
    return dbService.subscribe(reloadData);
  }, [reloadData]);

  if (!business) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <BrandLogo size="lg" showTagline />
        <div className="mt-8 max-w-sm bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-800">Shop Page Not Found</h2>
          <p className="text-xs text-slate-500 mt-2">
            The business page <code>/b/{businessSlug}</code> is not registered on YBGP Loyalty.
          </p>
        </div>
      </div>
    );
  }

  const handleShareShop = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: business.name, text: business.tagline, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleLinkClick = (link: BusinessLink) => {
    dbService.recordLinkClick(link.id);
  };

  const getLinkIcon = (iconName: string, type: string) => {
    switch (type) {
      case 'google_review':
        return <Star className="w-5 h-5 text-amber-500 fill-amber-400" />;
      case 'whatsapp':
        return <MessageCircle className="w-5 h-5 text-emerald-600" />;
      case 'instagram':
        return <Instagram className="w-5 h-5 text-pink-600" />;
      case 'map':
        return <MapPin className="w-5 h-5 text-blue-600" />;
      case 'phone':
        return <Phone className="w-5 h-5 text-slate-700" />;
      case 'menu':
        return <Coffee className="w-5 h-5 text-amber-700" />;
      default:
        return <Globe className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-6 px-4 font-sans text-slate-900">
      {/* Mobile-Friendly Container */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden pb-8">
        {/* Cover / Header Banner */}
        <div
          className="relative h-36 w-full flex items-end p-4 transition-colors"
          style={{
            background: `linear-gradient(180deg, ${business.brandColor} 0%, #0F172A 100%)`,
          }}
        >
          {/* Share Button on Top Right */}
          <button
            type="button"
            onClick={handleShareShop}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/30 backdrop-blur-xs text-white hover:bg-black/50 transition-colors cursor-pointer"
            title="Share Page"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Profile Card Info */}
        <div className="relative px-6 pt-0 pb-4 text-center -mt-12">
          {/* Logo Mark */}
          <div
            className="w-20 h-20 rounded-2xl mx-auto bg-white p-1 shadow-md border-2 border-white flex items-center justify-center font-bold text-2xl text-white"
            style={{ backgroundColor: business.brandColor || '#0F172A' }}
          >
            {business.name.slice(0, 2).toUpperCase()}
          </div>

          <h1 className="text-xl font-bold text-slate-900 mt-3 tracking-tight">
            {business.name}
          </h1>

          <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
            {business.tagline}
          </p>

          {/* Location & Opening Hours */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {business.city}, {business.state}
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {business.openingHours}
            </span>
          </div>

          {/* Announcement Banner */}
          {business.announcement && (
            <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-left text-xs text-amber-900">
              {business.announcement}
            </div>
          )}
        </div>

        {/* Quick Contact Bar */}
        <div className="px-6 py-2 grid grid-cols-3 gap-2">
          <a
            href={`tel:${business.phone}`}
            className="py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
          >
            <Phone className="w-4 h-4 text-slate-700 mb-1" />
            <span className="text-[11px] font-semibold text-slate-700">Call Shop</span>
          </a>

          <a
            href={`https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
              `Hi ${business.name}, I am messaging from your YBGP page.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 mb-1" />
            <span className="text-[11px] font-semibold text-emerald-800">WhatsApp</span>
          </a>

          <a
            href={business.googleReviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-400 mb-1" />
            <span className="text-[11px] font-semibold text-amber-900">Review Us</span>
          </a>
        </div>

        {/* Digital Loyalty Card Callout / Active Card */}
        {program && (
          <div className="px-6 my-4">
            {customer && card ? (
              // Customer already registered -> show card teaser with direct open button
              <div
                onClick={() => setShowCardModal(true)}
                className="p-4 rounded-2xl border text-left cursor-pointer transition-all hover:shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${business.brandColor}15 0%, #FFFFFF 100%)`,
                  borderColor: `${business.brandColor}40`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    <span>Your Digital Stamp Card</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {card.currentStamps} / {program.stampTarget} Stamps
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-1 font-medium">
                  {card.currentStamps >= program.stampTarget ? (
                    <span className="text-emerald-700 font-bold">Reward Ready! Click to show cashier</span>
                  ) : (
                    `Collect ${program.stampTarget - card.currentStamps} more to unlock: ${program.rewardTitle}`
                  )}
                </p>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-slate-500">Tap to open your merchant QR pass</span>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              </div>
            ) : (
              // New customer registration CTA
              <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block mb-0.5">
                      Customer Loyalty Rewards
                    </span>
                    <h3 className="text-sm font-bold leading-tight">
                      Earn {program.rewardTitle}
                    </h3>
                  </div>
                  <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                </div>

                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {program.description}
                </p>

                <button
                  type="button"
                  onClick={() => setShowRegModal(true)}
                  className="mt-3 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Get My Digital Stamp Card (Free)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Business Links List */}
        <div className="px-6 space-y-2.5 mt-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Featured Links & Services
          </span>

          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLinkClick(link)}
              className="p-3.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-2xl flex items-center justify-between transition-all hover:translate-y-[-1px] cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-2xs border border-slate-100">
                  {getLinkIcon(link.iconName, link.type)}
                </div>
                <div className="text-left">
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                    {link.title}
                  </h4>
                  {link.subtitle && (
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      {link.subtitle}
                    </p>
                  )}
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
            </a>
          ))}
        </div>

        {/* Google Reviews Direct CTA */}
        <div className="px-6 mt-4">
          <a
            href={business.googleReviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-2xl flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-2xs">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Love your visit to {business.name}?
                </span>
                <span className="text-[11px] text-amber-900 font-medium">
                  Leave a verified review on Google Maps
                </span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-amber-700" />
          </a>
        </div>

        {/* DPDP Compliance & YBGP Platform Footer */}
        <div className="px-6 mt-8 pt-4 border-t border-slate-100 text-center text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Digital Personal Data Protection (DPDP) Act Compliant</span>
          </div>
          <div className="pt-2 flex items-center justify-center">
            <BrandLogo size="sm" showTagline />
          </div>
        </div>
      </div>

      {/* Customer Registration Modal */}
      {showRegModal && (
        <CustomerRegistrationModal
          business={business}
          isOpen={showRegModal}
          onClose={() => setShowRegModal(false)}
          onSuccess={(regCustomer, regCard) => {
            setCustomer(regCustomer);
            setCard(regCard);
            setShowRegModal(false);
            setShowCardModal(true);
          }}
        />
      )}

      {/* Digital Stamp Card Full Modal */}
      {showCardModal && customer && card && program && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md my-8 animate-in fade-in zoom-in-95 duration-200">
            <DigitalStampCard
              business={business}
              customer={customer}
              card={card}
              program={program}
              transactions={transactions}
              onClose={() => setShowCardModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
