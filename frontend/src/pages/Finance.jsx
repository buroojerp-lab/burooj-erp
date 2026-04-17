// src/pages/Finance.jsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, DollarSign, BookOpen, BarChart3 } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { fmtPKR } from '../utils/format';

export default function Finance() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['financial-report', year],
    queryFn: () => api.get(`/reports/financial?year=${year}`).then(r => r.data),
  });

  const d = data || {};
  const profit = parseFloat(d.income || 0) - parseFloat(d.expenses || 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Accounting & Finance</h1><p className="text-sm text-gray-500 mt-0.5">Financial overview and ledger</p></div>
        <select value={year} onChange={e => setYear(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
          {[2022,2023,2024,2025].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { l: 'Total Income', v: fmtPKR(d.income || 0), icon: TrendingUp, cls: 'bg-green-50 text-green-500', valCls: 'text-green-700' },
          { l: 'Total Expenses', v: fmtPKR(d.expenses || 0), icon: TrendingDown, cls: 'bg-red-50 text-red-500', valCls: 'text-red-700' },
          { l: 'Net Profit', v: fmtPKR(profit), icon: DollarSign, cls: profit >= 0 ? 'bg-blue-50 text-blue-500' : 'bg-red-50 text-red-500', valCls: profit >= 0 ? 'text-blue-700' : 'text-red-700' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.cls}`}><s.icon size={22} /></div>
            <div>
              <p className="text-xs text-gray-400">{s.l}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.valCls}`}>{s.v}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Income vs Expenses Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Income vs Expenses — {year}</h2>
        {isLoading ? <div className="h-64 bg-gray-50 rounded-lg animate-pulse" /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d.monthly || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [fmtPKR(v)]} />
              <Legend />
              <Bar dataKey="income" fill="#10b981" name="Income" radius={[3,3,0,0]} />
              <Bar dataKey="expense" fill="#f43f5e" name="Expenses" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* COA summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><BookOpen size={16} className="text-orange-500" /> Chart of Accounts Summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Assets',      color: 'bg-blue-50   text-blue-700',   desc: 'Cash, property & receivables' },
            { label: 'Liabilities', color: 'bg-red-50    text-red-700',    desc: 'Loans & payables' },
            { label: 'Equity',      color: 'bg-purple-50 text-purple-700', desc: 'Owner\'s equity' },
            { label: 'Income',      color: 'bg-green-50  text-green-700',  desc: 'Revenue & collections' },
            { label: 'Expenses',    color: 'bg-orange-50 text-orange-700', desc: 'Costs & overheads' },
          ].map(t => (
            <div key={t.label} className={`rounded-lg p-3 text-center ${t.color}`}>
              <div className="font-bold text-sm">{t.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
