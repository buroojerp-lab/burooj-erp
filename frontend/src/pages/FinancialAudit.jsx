// src/pages/FinancialAudit.jsx — Burooj ERP Financial Auto Audit System
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import {
  ShieldCheck, TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  Download, RefreshCw, Calendar, BarChart3, Percent, Activity,
  FileText, CheckCircle, XCircle, Info, Clock, ArrowUpRight,
  ArrowDownRight, Building2, Users, CreditCard, Loader2,
  ChevronRight, Bell, BellOff,
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR } from '../utils/format';
import { pdfUrl } from '../utils/pdfUrl';
import toast from 'react-hot-toast';

// ── Constants ──────────────────────────────────────────────

const PIE_COLORS = [
  '#C9A84C','#1a1a2e','#10B981','#EF4444','#3B82F6',
  '#8B5CF6','#F59E0B','#06B6D4','#EC4899','#14B8A6',
];

const TABS = [
  { key: 'monthly',    label: 'Monthly',       icon: Calendar },
  { key: 'semi_annual', label: 'Semi-Annual',   icon: BarChart3 },
  { key: 'annual',     label: 'Annual',         icon: Activity },
];

const TYPE_META = {
  monthly:    { color: 'blue',   bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700' },
  semi_annual:{ color: 'purple', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' },
  annual:     { color: 'amber',  bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700' },
};

const SEVERITY_META = {
  critical: { icon: XCircle,    cls: 'bg-red-50 border-red-200 text-red-700',       dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700' },
  warning:  { icon: AlertTriangle, cls: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  info:     { icon: Info,        cls: 'bg-blue-50 border-blue-200 text-blue-700',     dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700' },
};

// ── Helpers ────────────────────────────────────────────────

const pct = n => `${parseFloat(n || 0).toFixed(1)}%`;
const num = n => parseFloat(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const sign = n => parseFloat(n) >= 0 ? '+' : '';

function GrowthBadge({ value }) {
  const v = parseFloat(value || 0);
  const pos = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${pos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {pos ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {sign(v)}{v.toFixed(1)}%
    </span>
  );
}

// ── KPI Card ────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color = 'blue', growth, loading }) {
  const colorMap = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    amber:  'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    gray:   'bg-gray-50 text-gray-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}><Icon size={15} /></div>
      </div>
      {loading
        ? <div className="h-7 w-32 bg-gray-100 rounded animate-pulse" />
        : <div className="text-xl font-bold text-gray-900 leading-tight">{value}</div>
      }
      <div className="flex items-center gap-2">
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
        {growth !== undefined && <GrowthBadge value={growth} />}
      </div>
    </div>
  );
}

// ── Alert Item ──────────────────────────────────────────────

function AlertItem({ alert, onRead }) {
  const m = SEVERITY_META[alert.severity] || SEVERITY_META.info;
  const Icon = m.icon;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${m.cls} ${alert.is_read ? 'opacity-60' : ''}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold">{alert.title}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${m.badge}`}>
            {alert.severity.toUpperCase()}
          </span>
          {!alert.is_read && <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />}
        </div>
        <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{alert.message}</p>
        <span className="text-[10px] opacity-50 mt-1 block">
          {new Date(alert.created_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
        </span>
      </div>
      {!alert.is_read && (
        <button onClick={() => onRead(alert.id)} className="shrink-0 text-gray-400 hover:text-gray-600 p-1 rounded">
          <CheckCircle size={14} />
        </button>
      )}
    </div>
  );
}

// ── Report Row ──────────────────────────────────────────────

function ReportRow({ report, onDelete }) {
  const m    = TYPE_META[report.type];
  const profit = parseFloat(report.net_profit);
  const onPDF  = () => window.open(pdfUrl(`/audit/reports/${report.id}/pdf`), '_blank');
  const onCSV  = () => window.open(pdfUrl(`/audit/reports/${report.id}/csv`), '_blank');

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
      <td className="py-3 px-4">
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${m.badge}`}>
          {report.type.replace('_', ' ').toUpperCase()}
        </span>
      </td>
      <td className="py-3 px-4 font-medium text-gray-800 text-sm">{report.period_label}</td>
      <td className="py-3 px-4 text-sm text-green-700 font-semibold">{fmtPKR(report.total_income)}</td>
      <td className="py-3 px-4 text-sm text-red-600">{fmtPKR(report.total_expenses)}</td>
      <td className={`py-3 px-4 text-sm font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
        {fmtPKR(profit)}
      </td>
      <td className="py-3 px-4 text-sm"><GrowthBadge value={report.growth_rate} /></td>
      <td className="py-3 px-4 text-sm text-gray-500">{pct(report.roi)} ROI</td>
      <td className="py-3 px-4">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${report.trigger_type === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
          {report.trigger_type}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-400">
        {new Date(report.generated_at).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' })}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <button onClick={onPDF}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors font-medium">
            <Download size={11} /> PDF
          </button>
          <button onClick={onCSV}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition-colors font-medium">
            <Download size={11} /> XLS
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function FinancialAudit() {
  const [activeTab,     setActiveTab]     = useState('monthly');
  const [generating,    setGenerating]    = useState(null);   // which type is generating
  const [showAlerts,    setShowAlerts]    = useState(true);
  const qc = useQueryClient();

  // ── Queries ──
  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['audit-dashboard'],
    queryFn:  () => api.get('/audit/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['audit-reports', activeTab],
    queryFn:  () => api.get(`/audit/reports?type=${activeTab}&limit=15`).then(r => r.data),
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['audit-alerts'],
    queryFn:  () => api.get('/audit/alerts?unread_only=false&limit=30').then(r => r.data),
    refetchInterval: 30000,
  });

  // ── Mutations ──
  const generateMutation = useMutation({
    mutationFn: (type) => api.post('/audit/generate', { type }),
    onSuccess: (_, type) => {
      toast.success(`${type.replace('_',' ')} audit generated!`);
      qc.invalidateQueries(['audit-dashboard']);
      qc.invalidateQueries(['audit-reports', type]);
      qc.invalidateQueries(['audit-alerts']);
      setGenerating(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || 'Audit generation failed');
      setGenerating(null);
    },
  });

  const readAlertMutation = useMutation({
    mutationFn: (id) => api.patch(`/audit/alerts/${id}/read`),
    onSuccess:  () => qc.invalidateQueries(['audit-alerts']),
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.patch('/audit/alerts/read-all'),
    onSuccess:  () => { qc.invalidateQueries(['audit-alerts']); toast.success('All alerts marked as read'); },
  });

  const handleGenerate = (type) => {
    setGenerating(type);
    generateMutation.mutate(type);
  };

  // ── Derived data ──
  const latest = {
    monthly:    dash?.latestMonthly,
    semi_annual: dash?.latestSemiAnnual,
    annual:     dash?.latestAnnual,
  };

  const currentLatest = latest[activeTab];
  const reports       = reportsData?.data || [];
  const alerts        = alertsData?.data  || [];
  const unreadCount   = alerts.filter(a => !a.is_read).length;

  // Build trend chart from latest report's report_data
  const reportData   = currentLatest?.report_data || {};
  const trendData    = reportData.monthlyTrend    || [];
  const expBreak     = reportData.expenseBreakdown || {};
  const pieData      = Object.entries(expBreak).map(([name, value]) => ({
    name: name.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: parseFloat(value),
  })).filter(d => d.value > 0).slice(0, 8);

  const topProjects  = reportData.topProjects      || [];
  const topAgents    = reportData.agentPerformance || [];

  // ── Summary stats for tab switcher ──
  const tabStats = {
    monthly:    latest.monthly    ? { profit: latest.monthly.net_profit,    growth: latest.monthly.growth_rate }    : null,
    semi_annual: latest.semi_annual ? { profit: latest.semi_annual.net_profit, growth: latest.semi_annual.growth_rate } : null,
    annual:     latest.annual     ? { profit: latest.annual.net_profit,     growth: latest.annual.growth_rate }     : null,
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-sm">
            <ShieldCheck size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Auto Audit</h1>
            <p className="text-sm text-gray-500 mt-0.5">Automated financial audits with smart alerts & PDF reports</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Alert Bell */}
          <button
            onClick={() => setShowAlerts(v => !v)}
            className="relative p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
            {unreadCount > 0
              ? <Bell size={16} className="text-amber-500" />
              : <BellOff size={16} className="text-gray-400" />
            }
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Generate buttons */}
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => handleGenerate(t.key)}
              disabled={!!generating}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-all
                ${activeTab === t.key
                  ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}>
              {generating === t.key
                ? <Loader2 size={12} className="animate-spin" />
                : <RefreshCw size={12} />
              }
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {TABS.map(t => {
          const m    = TYPE_META[t.key];
          const stat = tabStats[t.key];
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
                ${active
                  ? `${m.bg} ${m.border} shadow-sm`
                  : 'bg-white border-gray-100 hover:bg-gray-50'
                }`}>
              <div className={`p-1.5 rounded-lg ${active ? 'bg-white shadow-sm' : 'bg-gray-50'}`}>
                <Icon size={16} className={active ? m.text : 'text-gray-400'} />
              </div>
              <div className="text-left">
                <div className={`text-sm font-semibold ${active ? m.text : 'text-gray-600'}`}>{t.label}</div>
                {stat
                  ? <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <span className={parseFloat(stat.profit) >= 0 ? 'text-green-600' : 'text-red-500'}>
                        {fmtPKR(stat.profit)}
                      </span>
                      <GrowthBadge value={stat.growth} />
                    </div>
                  : <div className="text-xs text-gray-300 mt-0.5">No data</div>
                }
              </div>
            </button>
          );
        })}

        {/* Total reports badge */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-100 bg-white ml-auto">
          <FileText size={16} className="text-gray-400" />
          <div>
            <div className="text-sm font-semibold text-gray-700">{dash?.totalReports || 0} Reports</div>
            <div className="text-xs text-gray-400">All time</div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards — current tab's latest ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Total Income"
          value={fmtPKR(currentLatest?.total_income || 0)}
          sub={currentLatest?.period_label}
          icon={TrendingUp}
          color="green"
          growth={currentLatest?.growth_rate !== undefined ? parseFloat(currentLatest.growth_rate) : undefined}
          loading={dashLoading} />
        <KpiCard
          label="Total Expenses"
          value={fmtPKR(currentLatest?.total_expenses || 0)}
          sub="Operating costs"
          icon={TrendingDown}
          color="red"
          loading={dashLoading} />
        <KpiCard
          label="Net Profit"
          value={fmtPKR(currentLatest?.net_profit || 0)}
          sub={`Margin: ${pct(currentLatest?.profit_margin)}`}
          icon={DollarSign}
          color={parseFloat(currentLatest?.net_profit || 0) >= 0 ? 'green' : 'red'}
          loading={dashLoading} />
        <KpiCard
          label="Growth Rate"
          value={`${sign(currentLatest?.growth_rate)}${pct(currentLatest?.growth_rate)}`}
          sub="vs previous period"
          icon={Activity}
          color="blue"
          loading={dashLoading} />
        <KpiCard
          label="ROI"
          value={pct(currentLatest?.roi)}
          sub="Return on investment"
          icon={Percent}
          color="purple"
          loading={dashLoading} />
        <KpiCard
          label="Collection Rate"
          value={pct(currentLatest?.collection_rate)}
          sub={`${fmtPKR(currentLatest?.total_outstanding || 0)} outstanding`}
          icon={CreditCard}
          color="amber"
          loading={dashLoading} />
      </div>

      {/* ── Sales & Collection Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'New Bookings',   value: num(currentLatest?.total_bookings),  icon: FileText,   color:'blue'   },
          { label:'Units Sold',     value: num(currentLatest?.total_units_sold), icon: Building2,  color:'purple' },
          { label:'Avg Deal Size',  value: fmtPKR(currentLatest?.avg_deal_size || 0), icon: DollarSign, color:'green'  },
          { label:'Collections',    value: fmtPKR(currentLatest?.total_collections || 0), icon: CreditCard, color:'amber'  },
        ].map(k => (
          <KpiCard key={k.label} {...k} loading={dashLoading} />
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Income vs Expenses Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Revenue & Expense Trend</h3>
            {currentLatest && (
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                {currentLatest.period_label}
              </span>
            )}
          </div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => [fmtPKR(v)]} />
                <Legend />
                <Area dataKey="income"  fill="url(#incomeGrad)"  stroke="#10B981" strokeWidth={2} name="Income"   dot={false} />
                <Area dataKey="expense" fill="url(#expenseGrad)" stroke="#EF4444" strokeWidth={2} name="Expenses" dot={false} />
                <Area dataKey="profit"  fill="url(#profitGrad)"  stroke="#C9A84C" strokeWidth={2} name="Profit"   dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-gray-300 gap-2">
              <BarChart3 size={40} />
              <p className="text-sm">Generate an audit to see trend data</p>
            </div>
          )}
        </div>

        {/* Expense Breakdown Pie */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Expense Breakdown</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => [fmtPKR(v)]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-600 truncate max-w-[100px]">{d.name}</span>
                    </div>
                    <span className="font-medium text-gray-800">{fmtPKR(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-gray-300 gap-2">
              <Percent size={36} />
              <p className="text-xs text-center">No expense data for this period</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Performance Row ── */}
      {(topProjects.length > 0 || topAgents.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Top Projects */}
          {topProjects.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Building2 size={15} className="text-amber-500" /> Top Projects
              </h3>
              <div className="space-y-2">
                {topProjects.map((p, i) => {
                  const max = parseFloat(topProjects[0]?.revenue || 1);
                  const pct  = Math.round((parseFloat(p.revenue) / max) * 100);
                  return (
                    <div key={p.project}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{i+1}. {p.project}</span>
                        <span className="text-gray-500">{p.bookings} bookings · {fmtPKR(p.revenue)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Agents */}
          {topAgents.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Users size={15} className="text-blue-500" /> Agent Performance
              </h3>
              <div className="space-y-2">
                {topAgents.map((a, i) => {
                  const max = parseFloat(topAgents[0]?.sales_value || 1);
                  const pct  = Math.round((parseFloat(a.sales_value) / max) * 100);
                  return (
                    <div key={a.agent_name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{i+1}. {a.agent_name}</span>
                        <span className="text-gray-500">{a.deals} deals · {fmtPKR(a.sales_value)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Alerts Panel ── */}
      {showAlerts && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              Smart Financial Alerts
              {unreadCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => readAllMutation.mutate()}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <CheckCircle size={12} /> Mark all read
              </button>
            )}
          </div>

          {alertsLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-300 flex flex-col items-center gap-2">
              <CheckCircle size={36} className="text-green-200" />
              <p className="text-sm text-gray-400">No alerts — financials look healthy!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {alerts.map(a => (
                <AlertItem key={a.id} alert={a} onRead={id => readAlertMutation.mutate(id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Audit Reports Table ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-50">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileText size={15} className="text-gray-500" />
            {TABS.find(t => t.key === activeTab)?.label} Audit History
          </h3>
          <span className="text-xs text-gray-400">{reports.length} reports</span>
        </div>

        {reportsLoading ? (
          <div className="p-6 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-gray-400">
            <ShieldCheck size={40} className="text-gray-200" />
            <p className="text-sm">No {activeTab.replace('_',' ')} reports yet.</p>
            <button
              onClick={() => handleGenerate(activeTab)}
              disabled={!!generating}
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">
              {generating === activeTab
                ? <Loader2 size={14} className="animate-spin" />
                : <RefreshCw size={14} />
              }
              Generate First {TABS.find(t => t.key === activeTab)?.label} Audit
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Type','Period','Income','Expenses','Net Profit','Growth','ROI','Source','Generated','Export'].map(h => (
                    <th key={h} className="py-2.5 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map(r => <ReportRow key={r.id} report={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Cron Schedule Info ── */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-amber-400" />
          <h3 className="font-semibold text-sm">Automated Audit Schedule</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label:'Monthly Audit',    time:'1st of every month · 5:00 AM',  color:'text-blue-300',  type:'monthly'    },
            { label:'Semi-Annual Audit',time:'1st Jan & 1st July · 4:00 AM',  color:'text-purple-300',type:'semi_annual' },
            { label:'Annual Audit',     time:'1st January every year · 3:00 AM', color:'text-amber-300', type:'annual'  },
          ].map(s => (
            <div key={s.type} className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                s.type === 'monthly' ? 'bg-blue-400' : s.type === 'semi_annual' ? 'bg-purple-400' : 'bg-amber-400'
              }`} />
              <div>
                <div className={`text-xs font-semibold ${s.color}`}>{s.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.time}</div>
                <div className="text-[10px] text-gray-500 mt-1">Auto-saves PDF + alerts admins</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
