// src/components/common/LoadingScreen.jsx
import React from 'react';
import { Building2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-[9999]">
      {/* Logo */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-orange-500 flex items-center justify-center shadow-2xl shadow-orange-500/40 animate-pulse">
          <Building2 size={40} className="text-white" />
        </div>
        {/* Spinner ring */}
        <div className="absolute -inset-2 rounded-[22px] border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
      </div>

      {/* Brand */}
      <h1 className="text-white text-2xl font-bold tracking-tight mb-1">Burooj Heights</h1>
      <p className="text-gray-400 text-sm">Loading ERP System...</p>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mt-8">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-orange-500"
            style={{
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
