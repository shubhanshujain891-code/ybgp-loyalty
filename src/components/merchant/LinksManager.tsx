import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  MoveUp,
  MoveDown,
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  Star,
  MessageCircle,
  Phone,
  MapPin,
  Coffee,
  Globe,
  Instagram,
  Save,
  AlertCircle,
} from 'lucide-react';
import { Business, BusinessLink } from '../../types';
import { dbService } from '../../services/db';

interface LinksManagerProps {
  business: Business;
  onBusinessUpdated: (updated: Business) => void;
}

export const LinksManager: React.FC<LinksManagerProps> = ({
  business,
  onBusinessUpdated,
}) => {
  const [links, setLinks] = useState<BusinessLink[]>(() =>
    dbService.getAllLinksByBusiness(business.id)
  );
  const [profileForm, setProfileForm] = useState({
    googleReviewsUrl: business.googleReviewsUrl,
    whatsapp: business.whatsapp,
    phone: business.phone,
    openingHours: business.openingHours,
    announcement: business.announcement || '',
    brandColor: business.brandColor,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingLink, setEditingLink] = useState<Partial<BusinessLink> | null>(null);

  const reloadLinks = () => {
    setLinks(dbService.getAllLinksByBusiness(business.id));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = dbService.updateBusinessProfile(business.id, {
        googleReviewsUrl: profileForm.googleReviewsUrl,
        whatsapp: profileForm.whatsapp.replace(/\D/g, ''),
        phone: profileForm.phone,
        openingHours: profileForm.openingHours,
        announcement: profileForm.announcement,
        brandColor: profileForm.brandColor,
      });
      onBusinessUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleLink = (link: BusinessLink) => {
    dbService.saveBusinessLink(business.id, {
      ...link,
      isEnabled: !link.isEnabled,
    });
    reloadLinks();
  };

  const handleDeleteLink = (linkId: string) => {
    dbService.deleteBusinessLink(business.id, linkId);
    reloadLinks();
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newLinks = [...links];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newLinks.length) return;

    const temp = newLinks[index];
    newLinks[index] = newLinks[targetIdx];
    newLinks[targetIdx] = temp;

    newLinks.forEach((l, i) => {
      dbService.saveBusinessLink(business.id, { ...l, sortOrder: i + 1 });
    });
    reloadLinks();
  };

  const handleSaveCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !editingLink.title || !editingLink.url) return;

    dbService.saveBusinessLink(business.id, {
      ...editingLink,
      isEnabled: editingLink.isEnabled ?? true,
    });
    setEditingLink(null);
    reloadLinks();
  };

  return (
    <div className="space-y-6">
      {/* Google Reviews & Direct Contact Settings */}
      <form onSubmit={handleSaveProfile} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Core Business Profiles & Google Reviews
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified review links and WhatsApp click-to-chat displayed on your customer page.
            </p>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saveSuccess ? 'Changes Saved!' : 'Save Business Info'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Verified Google Reviews Destination URL
            </label>
            <input
              type="url"
              required
              value={profileForm.googleReviewsUrl}
              onChange={(e) => setProfileForm({ ...profileForm, googleReviewsUrl: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
              placeholder="https://maps.google.com/?q=..."
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Must direct to your legitimate Google Maps listing.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              WhatsApp Pre-Order & Chat Number
            </label>
            <input
              type="text"
              required
              value={profileForm.whatsapp}
              onChange={(e) => setProfileForm({ ...profileForm, whatsapp: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono"
              placeholder="919820011223"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operating Hours
            </label>
            <input
              type="text"
              required
              value={profileForm.openingHours}
              onChange={(e) => setProfileForm({ ...profileForm, openingHours: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              placeholder="Mon - Sun: 8:00 AM – 10:00 PM"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Brand Accent Color (Hex)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={profileForm.brandColor}
                onChange={(e) => setProfileForm({ ...profileForm, brandColor: e.target.value })}
                className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={profileForm.brandColor}
                onChange={(e) => setProfileForm({ ...profileForm, brandColor: e.target.value })}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-mono uppercase"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Live Announcement or Festival Banner
            </label>
            <input
              type="text"
              value={profileForm.announcement}
              onChange={(e) => setProfileForm({ ...profileForm, announcement: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
              placeholder="e.g. ☕ Fresh batch of sourdough rolls available daily from 8 AM!"
            />
          </div>
        </div>
      </form>

      {/* Custom Links List & Editor */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Custom Business Links (Link-in-Bio)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add menus, booking portals, social media profiles, and promotions.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditingLink({
                title: '',
                subtitle: '',
                url: 'https://',
                type: 'custom',
                iconName: 'globe',
                isEnabled: true,
              })
            }
            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Link</span>
          </button>
        </div>

        {/* Editing Link Modal/Form */}
        {editingLink && (
          <form
            onSubmit={handleSaveCustomLink}
            className="p-4 bg-slate-50 rounded-2xl border border-slate-300 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                {editingLink.id ? 'Edit Link' : 'Add New Link'}
              </span>
              <button
                type="button"
                onClick={() => setEditingLink(null)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. View Bakery Menu"
                  value={editingLink.title || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Subtitle (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Single-origin coffees & toasts"
                  value={editingLink.subtitle || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, subtitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Target Destination URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://chaico.in/menu"
                  value={editingLink.url || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Category / Icon Type
                </label>
                <select
                  value={editingLink.type || 'custom'}
                  onChange={(e) =>
                    setEditingLink({
                      ...editingLink,
                      type: e.target.value as BusinessLink['type'],
                      iconName: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl cursor-pointer"
                >
                  <option value="menu">Menu / Food & Drink</option>
                  <option value="instagram">Instagram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="map">Google Maps Location</option>
                  <option value="website">Official Website</option>
                  <option value="custom">General Link</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLink(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg cursor-pointer"
              >
                Save Link
              </button>
            </div>
          </form>
        )}

        {/* Existing Links List */}
        <div className="space-y-2">
          {links.map((link, idx) => (
            <div
              key={link.id}
              className={`p-3 bg-slate-50 border rounded-xl flex items-center justify-between gap-3 ${
                link.isEnabled ? 'border-slate-200' : 'border-slate-200/50 opacity-60 bg-slate-100/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, 'up')}
                    className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === links.length - 1}
                    onClick={() => handleMove(idx, 'down')}
                    className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900">{link.title}</h4>
                  <p className="text-[11px] text-slate-500 font-mono truncate max-w-xs">
                    {link.url}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  {link.clickCount || 0} clicks
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleLink(link)}
                  className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    link.isEnabled
                      ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      : 'bg-slate-200 text-slate-500 border-slate-300'
                  }`}
                  title={link.isEnabled ? 'Hide link from public page' : 'Show link'}
                >
                  {link.isEnabled ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setEditingLink(link)}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteLink(link.id)}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-red-500 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
