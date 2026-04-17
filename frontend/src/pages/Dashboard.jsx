// src/pages/Dashboard.jsx — Multi-Techno Style Dashboard
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Wallet,
  AlertTriangle, Bell, RefreshCw, Users, Building2, CheckCircle,
  ArrowUpRight, ArrowDownRight, MessageCircle, Home, UserCheck, Star,
  Bot, Sparkles
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtNum } from '../utils/format';

// ── Financial KPI Card (Multi-Techno style) ──
function FinKPICard({ title, value, prevValue, gradient, icon: Icon }) {
  const gradients = {
    pink:   'from-pink-500 to-rose-400',
    orange: 'from-orange-500 to-red-400',
    green:  'from-green-500 to-emerald-400',
    salmon: 'from-orange-300 to-amber-200',
  };
  const g = gradients[gradient] || gradients.pink;
  const isNeg = parseFloat(value) < 0;

  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${g} p-5 text-white shadow-md`}>
      <div className="absolute right-3 top-3 opacity-20">
        <Icon size={48} />
      </div>
      <div className="relative">
        <p className="text-sm font-semibold text-white/90 mb-1">{title}</p>
        <p className={`text-2xl font-extrabold tracking-tight ${isNeg ? 'text-red-100' : 'text-white'}`}>
          {fmtPKR(Math.abs(value))}
          {isNeg && <span className="text-sm ml-1">(Loss)</span>}
        </p>
        <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
          <p className="text-xs text-white/70">
            Previous Month: <span className="font-semibold text-white/90">{fmtPKR(prevValue)}</span>
          </p>
          {prevValue !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
              parseFloat(value) >= parseFloat(prevValue) ? 'bg-white/20' : 'bg-black/20'
            }`}>
              {parseFloat(value) >= parseFloat(prevValue)
                ? <ArrowUpRight size={11} />
                : <ArrowDownRight size={11} />}
              {prevValue > 0 ? Math.abs(((value - prevValue) / prevValue) * 100).toFixed(0) : 0}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Amount Value Box (Payables/Receivables) ──
function AmountBox({ label, value, color }) {
  const colors = {
    red:    'bg-red-500',
    yellow: 'bg-yellow-400',
    purple: 'bg-purple-500',
    green:  'bg-emerald-400',
  };
  return (
    <div className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 shadow-sm p-3">
      <div className={`w-10 h-10 rounded-lg ${colors[color] || colors.red} flex items-center justify-center flex-shrink-0`}>
        <DollarSign size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-bold text-gray-900 truncate">{fmtPKR(value)}</p>
      </div>
    </div>
  );
}

// ── Section Header (Payables / Receivables) ──
function SectionHeader({ title, icon }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">{title}</h2>
    </div>
  );
}

// ── Dark Tooltip ──
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-xl shadow-xl text-xs">
      {label && <p className="font-semibold mb-1 text-gray-300">{label}</p>}
      {payload.map((p, i) => (
        <p key={i}>{p.name}: <span className="font-bold">{typeof p.value === 'number' && Math.abs(p.value) > 1000 ? fmtPKR(p.value) : p.value}</span></p>
      ))}
    </div>
  );
};

// ── Pie Custom Label ──
const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#84cc16','#6366f1'];
const AGING_COLOR = '#3b82f6';

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: kpis, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-financial-kpis'],
    queryFn: () => api.get('/dashboard/financial-kpis').then(r => r.data),
  });
  const { data: overdueData } = useQuery({
    queryKey: ['dashboard-overdue'],
    queryFn: () => api.get('/dashboard/overdue-alerts').then(r => r.data),
  });
  const { data: topCustomersData } = useQuery({
    queryKey: ['dashboard-top-customers'],
    queryFn: () => api.get('/dashboard/top-customers').then(r => r.data),
  });
  const { data: payablesData } = useQuery({
    queryKey: ['dashboard-payables'],
    queryFn: () => api.get('/dashboard/payables').then(r => r.data),
  });
  const { data: receivablesData } = useQuery({
    queryKey: ['dashboard-receivables'],
    queryFn: () => api.get('/dashboard/receivables').then(r => r.data),
  });
  const { data: cashBankData } = useQuery({
    queryKey: ['dashboard-cash-bank'],
    queryFn: () => api.get('/dashboard/cash-bank').then(r => r.data),
  });
  const { data: topItemsData } = useQuery({
    queryKey: ['dashboard-top-items'],
    queryFn: () => api.get('/dashboard/top-items').then(r => r.data),
  });
  const { data: activities } = useQuery({
    queryKey: ['dashboard-activities'],
    queryFn: () => api.get('/dashboard/recent-activities').then(r => r.data),
  });
  const { data: topAgentsData } = useQuery({
    queryKey: ['dashboard-top-agents'],
    queryFn: () => api.get('/dashboard/top-agents').then(r => r.data),
  });
  const { data: aiInsightData, isLoading: aiLoading } = useQuery({
    queryKey: ['dashboard-ai-insight'],
    queryFn: () => api.get('/chat/insight').then(r => r.data),
    staleTime: 10 * 60 * 1000, // refresh every 10 min
    retry: false,
  });

  const k = kpis || {};
  const topCustomers = topCustomersData?.data || [];
  const payables = payablesData || { due_amount: 0, forecast_amount: 0, aging: [] };
  const receivables = receivablesData || { due_amount: 0, forecast_amount: 0, aging: [] };
  const cashBank = cashBankData?.data || [];
  const topItems  = (topItemsData?.data || []).map(d => ({ ...d, value: parseInt(d.value) }));
  const topAgents = (topAgentsData?.agents || []).map(a => ({
    name:            a.name?.split(' ')[0] || a.agent_code,
    total_sales:     parseFloat(a.total_sales || 0),
    bookings_count:  parseInt(a.bookings_count || 0),
    total_commission: parseFloat(a.total_commission || 0),
  }));
  const overdue = overdueData?.overdue || [];

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <div key={i} className="h-64 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0 bg-gray-50 min-h-full">

      {/* ═══════════ LEFT PANEL ═══════════ */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-y-auto">

        {/* Reminders List */}
        <div className="px-4 pt-4 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={15} className="text-gray-500" />
            <h2 className="font-bold text-gray-800 text-sm">Reminders List</h2>
          </div>
          <input
            type="text"
            placeholder="Search reminders..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400"
          />
        </div>

        {/* Overdue reminders list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {overdue.length === 0 ? (
            <div className="p-4 text-center">
              <CheckCircle size={24} className="text-emerald-300 mx-auto mb-1" />
              <p className="text-xs text-gray-400">No pending reminders</p>
            </div>
          ) : overdue.slice(0, 10).map(item => (
            <div key={item.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{item.customer_name}</p>
                  <p className="text-xs text-gray-400">Unit {item.unit_number}</p>
                  <p className="text-xs font-bold text-orange-500 mt-0.5">{fmtPKR(item.balance)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">{item.days_overdue}d</span>
                  <button
                    onClick={() => window.open(`https://wa.me/${item.phone?.replace(/[^0-9]/g,'')}`, '_blank')}
                    className="p-1 rounded hover:bg-green-100 text-gray-300 hover:text-green-600 transition">
                    <MessageCircle size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Top Customers Pie */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-orange-500" />
            <h2 className="font-bold text-gray-800 text-sm">Top Customers</h2>
          </div>
          {topCustomers.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-300 text-xs">No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={topCustomers}
                    dataKey="total_value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={70}
                    labelLine={false}
                    label={PieLabel}
                  >
                    {topCustomers.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmtPKR(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1 max-h-28 overflow-y-auto">
                {topCustomers.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-gray-600 truncate flex-1">{c.name}</span>
                    <span className="font-semibold text-gray-700 flex-shrink-0">{fmtPKR(c.total_value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="flex-1 p-5 overflow-y-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-gray-900">Dashboard</h1>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-50 shadow-sm transition-all">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* ── AI Insight Banner ── */}
        {(aiLoading || aiInsightData?.insight) && (
          <div className="flex items-start gap-3 bg-gradient-to-r from-[#0098B4]/10 to-teal-50 border border-[#0098B4]/20 rounded-xl px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-[#0098B4] flex items-center justify-center flex-shrink-0 mt-0.5">
              {aiLoading ? <RefreshCw size={14} className="text-white animate-spin" /> : <Sparkles size={14} className="text-white" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#0098B4] uppercase tracking-wide mb-0.5 flex items-center gap-1.5">
                <Bot size={11} /> AI Business Insight
              </p>
              {aiLoading ? (
                <div className="h-4 w-72 bg-[#0098B4]/10 rounded animate-pulse" />
              ) : (
                <p className="text-sm text-gray-700 leading-snug">{aiInsightData.insight}</p>
              )}
            </div>
          </div>
        )}

        {/* ── 4 Financial KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FinKPICard
            title="This Month Revenue"
            value={k.this_month_revenue || 0}
            prevValue={k.prev_month_revenue || 0}
            gradient="pink"
            icon={TrendingUp}
          />
          <FinKPICard
            title="This Month Expense"
            value={k.this_month_expense || 0}
            prevValue={k.prev_month_expense || 0}
            gradient="orange"
            icon={TrendingDown}
          />
          <FinKPICard
            title="This Month Profit"
            value={k.this_month_profit || 0}
            prevValue={k.prev_month_profit || 0}
            gradient="green"
            icon={DollarSign}
          />
          <FinKPICard
            title="Capital"
            value={k.capital || 0}
            prevValue={k.prev_capital || 0}
            gradient="salmon"
            icon={Wallet}
          />
        </div>

        {/* ── Payables + Receivables ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Payables */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <SectionHeader title="Payables" icon="🚩" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <AmountBox label="Due Amount"      value={payables.due_amount}      color="red" />
              <AmountBox label="Forecast Amount" value={payables.forecast_amount} color="yellow" />
            </div>
            {payables.aging?.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={payables.aging} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="amount" name="Amount" fill={AGING_COLOR} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-300 text-xs">No payables data</div>
            )}
          </div>

          {/* Receivables */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <SectionHeader title="Receivables" icon="📉" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <AmountBox label="Due Amount"      value={receivables.due_amount}      color="purple" />
              <AmountBox label="Forecast Amount" value={receivables.forecast_amount} color="green" />
            </div>
            {receivables.aging?.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={receivables.aging} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="amount" name="Amount" fill="#f97316" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-300 text-xs">No receivables data</div>
            )}
          </div>
        </div>

        {/* ── Cash & Bank ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader title="Cash & Bank" icon="🏦" />
          {cashBank.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-300 text-xs">
              No journal entries yet — add journal entries in Finance module to see balances
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashBank} margin={{ top: 5, right: 20, bottom: 30, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-20} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="balance" name="Balance" radius={[4,4,0,0]}>
                  {cashBank.map((entry, i) => (
                    <Cell key={i} fill={parseFloat(entry.balance) >= 0 ? '#3b82f6' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Top 10 Items + Recent Bookings ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Top 10 Items Pie */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={14} className="text-orange-500" />
              <h2 className="font-bold text-gray-800 text-sm">Top 10 Items</h2>
            </div>
            {topItems.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-gray-300 text-xs">No data yet</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={topItems} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={75} labelLine={false} label={PieLabel}>
                      {topItems.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {topItems.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-600 capitalize flex-1">{d.name}</span>
                      <span className="font-bold text-gray-700">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Recent Bookings */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-sm">Recent Bookings</h2>
              <button onClick={() => navigate('/bookings')} className="text-xs text-orange-500 hover:text-orange-600 font-bold">View All →</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['Customer', 'Unit', 'Balance', 'Overdue', ''].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {overdue.slice(0, 6).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-gray-900 text-sm">{item.customer_name}</div>
                      <div className="text-xs text-gray-400">{item.phone}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Home size={11} className="text-gray-300" />{item.unit_number}</span>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-bold text-gray-900">{fmtPKR(item.balance)}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        {item.days_overdue}d
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => window.open(`https://wa.me/${item.phone?.replace(/[^0-9]/g,'')}`, '_blank')}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-green-100 text-gray-400 hover:text-green-600 transition-all">
                        <MessageCircle size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {overdue.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center">
                    <CheckCircle size={28} className="text-emerald-300 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No overdue installments!</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Agent Performance ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Agent bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck size={14} className="text-orange-500" />
              <h2 className="font-bold text-gray-800 text-sm">Agent Sales Performance (This Month)</h2>
            </div>
            {topAgents.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-300 text-xs">No agent bookings this month</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topAgents} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                         tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="total_sales" name="Total Sales (PKR)" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="bookings_count" name="Bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Agent leaderboard table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
              <Star size={14} className="text-orange-500" />
              <h2 className="font-bold text-gray-800 text-sm">Agent Leaderboard</h2>
            </div>
            {topAgents.length === 0 ? (
              <div className="p-8 text-center text-gray-300 text-xs">No agents with bookings this month</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['#', 'Agent', 'Bookings', 'Sales', 'Commission'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topAgents.map((agent, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white
                          ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-200 !text-gray-600'}`}>
                          {i + 1}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">{agent.name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{agent.bookings_count}</td>
                      <td className="px-4 py-2.5 font-bold text-gray-900 text-xs">{fmtPKR(agent.total_sales)}</td>
                      <td className="px-4 py-2.5 text-emerald-600 font-medium text-xs">{fmtPKR(agent.total_commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
