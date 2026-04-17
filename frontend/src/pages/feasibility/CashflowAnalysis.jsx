// src/pages/feasibility/CashflowAnalysis.jsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { ChevronRight, TrendingUp, TrendingDown, DollarSign, Calendar, CheckCircle } from 'lucide-react';
import { feasibilityApi, fmtPKRm } from '../../utils/feasibilityApi';

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1117] border border-[#21262d] text-white px-3 py-2.5 rounded-xl shadow-xl text-xs">
      <p className="font-bold text-gray-300 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-bold">{fmtPKRm(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

function MetricCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: `${color}18` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-base font-extrabold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function CashflowAnalysis() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [view,   setView] = useState('monthly'); // monthly | cumulative

  const { data: cfData, isLoading } = useQuery({
    queryKey: ['feas-cashflow', id],
    queryFn:  () => feasibilityApi.getCashflow(id).then(r => r.data.data),
  });

  const { data: projData } = useQuery({
    queryKey: ['feas-project', id],
    queryFn:  () => feasibilityApi.getProject(id).then(r => r.data),
  });

  const cashflow = cfData || [];
  const results  = projData?.results;

  // Downsample long cashflows for chart readability
  const sample = cashflow.length > 60
    ? cashflow.filter((_, i) => i % 3 === 0)
    : cashflow;

  const maxInflow   = Math.max(...cashflow.map(c => c.income), 0);
  const totalInflow = cashflow.reduce((s, c) => s + parseFloat(c.income), 0);
  const totalExpend = cashflow.reduce((s, c) => s + parseFloat(c.construction_expense) + parseFloat(c.financing_expense), 0);
  const breakeven   = cashflow.find(c => parseFloat(c.cumulative_cf) >= 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 font-medium mb-5">
        <button onClick={() => navigate('/feasibility')} className="hover:text-[#0098B4] transition">
          Feasibility
        </button>
        <ChevronRight size={14} />
        <button onClick={() => navigate(`/feasibility/builder/${id}`)} className="hover:text-[#0098B4] transition">
          {projData?.project?.name || 'Project'}
        </button>
        <ChevronRight size={14} />
        <span className="text-gray-800">Cashflow Analysis</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <MetricCard label="Total Inflow"    value={fmtPKRm(totalInflow)} icon={TrendingUp}   color="#10b981" />
        <MetricCard label="Total Outflow"   value={fmtPKRm(totalExpend)} icon={TrendingDown}  color="#ef4444" />
        <MetricCard label="Net Cashflow"    value={fmtPKRm(totalInflow - totalExpend)} icon={DollarSign} color="#0098B4" />
        <MetricCard label="Break-even Month"
          value={breakeven ? `Month ${breakeven.month_no}` : 'Not reached'}
          icon={Calendar} color="#f59e0b" />
      </div>

      {/* Toggle */}
      <div className="flex gap-2 mb-5">
        {[['monthly', 'Monthly View'], ['cumulative', 'Cumulative View']].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition
              ${view === k
                ? 'bg-[#0098B4] text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-gray-300 text-sm">Loading cashflow…</div>
      ) : cashflow.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-gray-300 gap-3">
          <Calendar size={32} className="text-gray-200" />
          <p className="text-sm text-gray-400">Run the calculator first to generate cashflow</p>
        </div>
      ) : view === 'monthly' ? (
        <div className="space-y-5">

          {/* Income vs Expense */}
          <ChartCard title="Monthly Income vs. Construction Spend">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={sample} margin={{ top: 5, right: 15, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month_label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                       interval={Math.floor(sample.length / 8)} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                       tickFormatter={v => fmtPKRm(v)} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income"               name="Income"              fill="#10b981" radius={[3,3,0,0]} opacity={0.9} />
                <Bar dataKey="construction_expense" name="Construction Spend" fill="#ef4444" radius={[3,3,0,0]} opacity={0.9} />
                <Bar dataKey="financing_expense"    name="Financing Cost"     fill="#f59e0b" radius={[3,3,0,0]} opacity={0.9} />
                <Line dataKey="net_cashflow" name="Net CF" stroke="#0098B4" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Net cashflow bars */}
          <ChartCard title="Net Monthly Cashflow">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sample} margin={{ top: 5, right: 15, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month_label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                       interval={Math.floor(sample.length / 8)} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                       tickFormatter={v => fmtPKRm(v)} />
                <Tooltip content={<DarkTooltip />} />
                <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1.5} />
                <Bar dataKey="net_cashflow" name="Net CF" radius={[3,3,0,0]}>
                  {sample.map((c, i) => (
                    <rect key={i} fill={parseFloat(c.net_cashflow) >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>
      ) : (
        <ChartCard title="Cumulative Cashflow — Break-even Curve">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={sample} margin={{ top: 10, right: 15, bottom: 5, left: 10 }}>
              <defs>
                <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0098B4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0098B4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cfNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month_label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                     interval={Math.floor(sample.length / 8)} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                     tickFormatter={v => fmtPKRm(v)} />
              <Tooltip content={<DarkTooltip />} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="6 3"
                label={{ value: 'Break-even', position: 'right', fontSize: 10, fill: '#94a3b8' }} />
              <Area dataKey="cumulative_cf" name="Cumulative CF" stroke="#0098B4" strokeWidth={2.5}
                    fill="url(#cfGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>

          {breakeven && (
            <div className="mt-4 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700 font-semibold">
                Break-even reached at <strong>Month {breakeven.month_no}</strong> with cumulative CF of{' '}
                <strong>{fmtPKRm(breakeven.cumulative_cf)}</strong>
              </p>
            </div>
          )}
        </ChartCard>
      )}

      {/* Data table (paginated) */}
      {cashflow.length > 0 && (
        <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-sm">Monthly Detail Table</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-teal-600 text-white">
                <tr>
                  {['Month', 'Income', 'Construction', 'Financing', 'Net CF', 'Cumulative'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cashflow.slice(0, 60).map(row => (
                  <tr key={row.month_no} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-700">{row.month_label}</td>
                    <td className="px-4 py-2 text-emerald-600 font-semibold">{fmtPKRm(row.income)}</td>
                    <td className="px-4 py-2 text-red-500">{fmtPKRm(row.construction_expense)}</td>
                    <td className="px-4 py-2 text-amber-600">{fmtPKRm(row.financing_expense)}</td>
                    <td className={`px-4 py-2 font-bold ${parseFloat(row.net_cashflow) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmtPKRm(row.net_cashflow)}
                    </td>
                    <td className={`px-4 py-2 font-bold ${parseFloat(row.cumulative_cf) >= 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                      {fmtPKRm(row.cumulative_cf)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
