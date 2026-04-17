// src/components/Button.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:   'bg-[#0098B4] hover:bg-[#007a91] text-white shadow-sm',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm',
  ghost:     'bg-transparent hover:bg-gray-100 text-gray-600',
  danger:    'bg-red-500 hover:bg-red-600 text-white shadow-sm',
  success:   'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm',
  outline:   'bg-transparent hover:bg-[#0098B4]/10 text-[#0098B4] border border-[#0098B4]/40',
};

const SIZES = {
  xs: 'px-2.5 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant] || VARIANTS.primary}
        ${SIZES[size] || SIZES.md}
        ${className}
      `}
      {...props}
    >
      {loading
        ? <Loader2 size={size === 'xs' ? 11 : size === 'sm' ? 12 : 14} className="animate-spin flex-shrink-0" />
        : Icon && <Icon size={size === 'xs' ? 11 : size === 'sm' ? 12 : 14} className="flex-shrink-0" />
      }
      {children}
      {!loading && IconRight && (
        <IconRight size={size === 'xs' ? 11 : size === 'sm' ? 12 : 14} className="flex-shrink-0" />
      )}
    </button>
  );
}
