// src/components/StatCard.jsx
import React from 'react';

export default function StatCard({ title, value, sub, color = '#0F766E', icon: Icon, loading = false }) {
  return (
    <div
      className="bg-white p-5 rounded-2xl shadow-md border-l-4"
      style={{ borderColor: color }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm text-gray-500 font-medium mb-1 truncate">{title}</h4>
          {loading ? (
            <div className="h-7 w-28 bg-gray-100 rounded animate-pulse" />
          ) : (
            <h2 className="text-2xl font-bold text-gray-900 truncate">{value}</h2>
          )}
          {sub && !loading && (
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          )}
        </div>
        {Icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3"
            style={{ background: `${color}18` }}
          >
            <Icon size={18} style={{ color }} />
          </div>
        )}
      </div>
    </div>
  );
}
