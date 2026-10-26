import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

interface QrCodeViewerProps {
  value: string;
  size?: number;
  label?: string;
  subLabel?: string;
  allowDownload?: boolean;
  downloadFileName?: string;
  className?: string;
}

export const QrCodeViewer: React.FC<QrCodeViewerProps> = ({
  value,
  size = 200,
  label,
  subLabel,
  allowDownload = false,
  downloadFileName = 'ybgp-qr-code',
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size * 2, // High resolution
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [value, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${downloadFileName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="QR Code"
            style={{ width: size, height: size }}
            className="rounded-lg object-contain block"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center bg-slate-50 text-xs text-slate-400 rounded-lg animate-pulse"
          >
            Generating QR...
          </div>
        )}
      </div>

      {label && <p className="mt-2 text-xs font-semibold text-slate-800">{label}</p>}
      {subLabel && <p className="text-[11px] text-slate-500 font-mono mt-0.5">{subLabel}</p>}

      {allowDownload && dataUrl && (
        <button
          type="button"
          onClick={handleDownload}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download High-Res PNG</span>
        </button>
      )}
    </div>
  );
};
