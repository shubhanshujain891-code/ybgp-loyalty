import React, { useRef } from 'react';
import { Printer, Copy, Check, ExternalLink, Sparkles, Smartphone, Award } from 'lucide-react';
import { Business, LoyaltyProgram } from '../../types';
import { QrCodeViewer } from '../common/QrCodeViewer';
import { BrandLogo } from '../common/BrandLogo';

interface QrStandeeGeneratorProps {
  business: Business;
  program?: LoyaltyProgram;
  onPreviewPublicPage?: () => void;
}

export const QrStandeeGenerator: React.FC<QrStandeeGeneratorProps> = ({
  business,
  program,
  onPreviewPublicPage,
}) => {
  const [copied, setCopied] = React.useState(false);
  const standeeRef = useRef<HTMLDivElement>(null);

  const publicUrl = `${window.location.origin}/b/${business.slug}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Counter Standee & QR Poster
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Print this official table tent or counter poster for your shop checkout counter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyUrl}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied URL!' : 'Copy Shop Link'}</span>
          </button>

          {onPreviewPublicPage && (
            <button
              type="button"
              onClick={onPreviewPublicPage}
              className="px-3.5 py-2 text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Preview Page</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Counter Standee</span>
          </button>
        </div>
      </div>

      {/* PRINT-READY STANDEE PREVIEW (A5 / Counter Tent Standard) */}
      <div className="flex justify-center p-4 bg-slate-100/70 rounded-3xl border border-slate-200">
        <div
          ref={standeeRef}
          className="print-standee w-full max-w-sm bg-white rounded-3xl shadow-xl border-4 border-slate-900 overflow-hidden text-center p-8 space-y-6"
        >
          {/* Header with YBGP Brand & Business Name */}
          <div className="space-y-3">
            <div className="flex justify-center">
              <BrandLogo size="md" showTagline />
            </div>

            <div
              className="py-2 px-4 rounded-xl text-white inline-block max-w-full font-bold text-sm tracking-tight"
              style={{ backgroundColor: business.brandColor || '#0F172A' }}
            >
              {business.name}
            </div>

            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Scan For Free Rewards & Links
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Collect stamps on every visit · No app download needed!
            </p>
          </div>

          {/* High-Resolution QR Code */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300">
            <QrCodeViewer
              value={publicUrl}
              size={220}
              allowDownload
              downloadFileName={`${business.slug}-counter-qr`}
            />
            <span className="text-[11px] font-mono text-slate-500 mt-2">
              {publicUrl}
            </span>
          </div>

          {/* Highlighted Program Reward */}
          {program && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-left">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Loyalty Perk:</span>
              </div>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {program.rewardTitle}
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Collect {program.stampTarget} stamps to redeem on your next visit.
              </p>
            </div>
          )}

          {/* 3 Step Instruction Guide for Patrons */}
          <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100 text-[11px]">
            <div className="p-2 bg-slate-50 rounded-xl">
              <Smartphone className="w-4 h-4 text-slate-700 mx-auto mb-1" />
              <span className="font-bold block text-slate-800">1. Scan</span>
              <span className="text-slate-500 text-[10px]">Open camera</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <Sparkles className="w-4 h-4 text-amber-600 mx-auto mb-1" />
              <span className="font-bold block text-slate-800">2. Save Pass</span>
              <span className="text-slate-500 text-[10px]">Get stamps</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <Award className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <span className="font-bold block text-slate-800">3. Reward</span>
              <span className="text-slate-500 text-[10px]">Enjoy perks</span>
            </div>
          </div>

          {/* Footer badge */}
          <div className="pt-2 text-[10px] text-slate-400 font-mono tracking-wider">
            Powered by YBGP · https://ybgp.in
          </div>
        </div>
      </div>
    </div>
  );
};
