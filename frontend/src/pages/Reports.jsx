// src/pages/Reports.jsx
import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useReactToPrint } from 'react-to-print';
import {
  BarChart3, Download, Printer, TrendingUp, DollarSign,
  CreditCard, Users, Building2, FileText
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e', '#0ea5e9'];

const REPORT_TYPES = [
  { id: 'sales',        label: 'Sales Report',           icon: TrendingUp },
  { id: 'installments', label: 'Installment Report',     icon: CreditCard },
  { id: 'financial',    label: 'Financial Report',       icon: DollarSign },
  { id: 'units',        label: 'Unit Availability',      icon: Building2 },
  { id: 'agents',       label: 'Agent Performance',      icon: Users },
  { id: 'expenses',     label: 'Expense Report',         icon: FileText },
];

export default function Reports() {
  const [activeReport, setActiveReport] = useState('sales');
  const [period, setPeriod] = useState('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Burooj-${activeReport}-report-${new Date().toISOString().split('T')[0]}`,
  });

  // ── Sales Report ──
  const { data: salesData } = useQuery({
    queryKey: ['report-sales', period, year],
    queryFn: () => api.get(`/reports/sales?period=${period}&year=${year}`).then(r => r.data),
    enabled: activeReport === 'sales',
  });

  // ── Installments Report ──
  const { data: instData } = useQuery({
    queryKey: ['report-installments', period, year],
    queryFn: () => api.get(`/reports/installments?period=${period}&year=${year}`).then(r => r.data),
    enabled: activeReport === 'installments',
  });

  // ── Financial Report ──
  const { data: finData } = useQuery({
    queryKey: ['report-financial', year],
    queryFn: () => api.get(`/reports/financial?year=${year}`).then(r => r.data),
    enabled: activeReport === 'financial',
  });

  // ── Unit Report ──
  const { data: unitData } = useQuery({
    queryKey: ['report-units'],
    queryFn: () => api.get('/reports/units').then(r => r.data),
    enabled: activeReport === 'units',
  });

  // ── Agent Performance ──
  const { data: agentData } = useQuery({
    queryKey: ['report-agents', year],
    queryFn: () => api.get(`/reports/agents?year=${year}`).then(r => r.data),
    enabled: activeReport === 'agents',
  });

  // ── Expense Report ──
  const { data: expData } = useQuery({
    queryKey: ['report-expenses', period, year],
    queryFn: () => api.get(`/expenses/report?period=${period}&year=${year}`).then(r => r.data),
    enabled: activeReport === 'expenses',
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={24} className="text-orange-500" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Comprehensive business reports</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Printer size={16} /> Print
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar: Report Types */}
        <div className="w-52 flex-shrink-0 space-y-1">
          {REPORT_TYPES.map(r => (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                ${activeReport === r.id
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              <r.icon size={16} />
              {r.label}
            </button>
          ))}

          {/* Period Selector */}
          <div className="pt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Period</p>
            {['monthly', 'quarterly', 'yearly'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium capitalize transition ${period === p ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {p}
              </button>
            ))}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">Year</p>
              <select value={year} onChange={e => setYear(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
                {[2022, 2023, 2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Main Report Content */}
        <div ref={printRef} className="flex-1 space-y-6">

          {/* ── Sales Report ── */}
          {activeReport === 'sales' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Revenue', value: fmtPKR(salesData?.totalRevenue || 0), color: 'green' },
                  { label: 'Total Bookings', value: salesData?.totalBookings || 0, color: 'blue' },
                  { label: 'Avg Deal Size', value: fmtPKR(salesData?.avgDeal || 0), color: 'orange' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Revenue by Period</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={salesData?.byPeriod || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `${(v/1000000).toFixed(0)}M`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={v => [fmtPKR(v), 'Revenue']} />
                    <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* ── Installment Report ── */}
          {activeReport === 'installments' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Collected', value: fmtPKR(instData?.collected || 0) },
                  { label: 'Total Pending', value: fmtPKR(instData?.pending || 0) },
                  { label: 'Overdue Amount', value: fmtPKR(instData?.overdue || 0) },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-sm text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Collection vs Overdue</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={instData?.byMonth || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={v => [fmtPKR(v)]} />
                    <Legend />
                    <Line type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} name="Collected" />
                    <Line type="monotone" dataKey="overdue" stroke="#f43f5e" strokeWidth={2} name="Overdue" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* ── Financial Report ── */}
          {activeReport === 'financial' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Income', value: fmtPKR(finData?.income || 0), color: 'text-green-700' },
                  { label: 'Total Expenses', value: fmtPKR(finData?.expenses || 0), color: 'text-red-700' },
                  { label: 'Net Profit', value: fmtPKR(finData?.profit || 0), color: parseFloat(finData?.profit || 0) >= 0 ? 'text-blue-700' : 'text-red-700' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Income vs Expenses — {year}</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={finData?.monthly || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [fmtPKR(v)]} />
                    <Legend />
                    <Bar dataKey="income" fill="#10b981" name="Income" radius={[3,3,0,0]} />
                    <Bar dataKey="expense" fill="#f43f5e" name="Expenses" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* ── Unit Availability ── */}
          {activeReport === 'units' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Unit Status Distribution</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={unitData?.statusBreakdown || []}
                      dataKey="count"
                      nameKey="status"
                      cx="50%" cy="50%"
                      outerRadius={90}
                    >
                      {(unitData?.statusBreakdown || []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">By Type</h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={unitData?.typeBreakdown || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="available" fill="#10b981" name="Available" />
                    <Bar dataKey="sold" fill="#f97316" name="Sold" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Agent Performance ── */}
          {activeReport === 'agents' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Agent Performance — {year}</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Agent', 'Bookings', 'Revenue', 'Commission', 'Avg Deal', 'Performance'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(agentData?.agents || []).map((a, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                            {i + 1}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{a.name}</div>
                            <div className="text-xs text-gray-400">{a.agent_code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{a.bookings_count}</td>
                      <td className="px-4 py-3 font-semibold text-green-700">{fmtPKR(a.total_sales)}</td>
                      <td className="px-4 py-3 font-semibold text-blue-700">{fmtPKR(a.total_commission)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtPKR(a.avg_deal)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-orange-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, (a.bookings_count / 10) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!agentData?.agents?.length && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No agent data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Expense Report ── */}
          {activeReport === 'expenses' && (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Expenses by Category</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={expData?.report || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => [fmtPKR(v)]} />
                    <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} name="Total Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
