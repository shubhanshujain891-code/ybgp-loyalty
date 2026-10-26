import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showTagline = false,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const textSizes = {
    sm: 'text-sm font-semibold tracking-tight',
    md: 'text-base font-bold tracking-tight',
    lg: 'text-xl font-bold tracking-tight',
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* High-end YBGP Logo Mark */}
      <div
        className={`${iconSizes[size]} bg-slate-900 text-amber-400 font-black rounded-lg flex items-center justify-center shadow-xs border border-slate-800 shrink-0 select-none`}
      >
        <span className="tracking-tighter">YB</span>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`text-slate-900 dark:text-white ${textSizes[size]}`}>
            YBGP
          </span>
          <span className={`text-amber-600 font-semibold ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>
            Loyalty
          </span>
        </div>
        {showTagline && (
          <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase mt-0.5">
            Your Business Growth Partner
          </span>
        )}
      </div>
    </div>
  );
};
