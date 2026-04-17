// src/pages/feasibility/ReportGenerator.jsx — Investor PDF & Excel Report
import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Download, Printer, FileText, ChevronRight, Building2,
  DollarSign, TrendingUp, ShieldAlert, BarChart3, Calendar,
} from 'lucide-react';
import { feasibilityApi, fmtPKRm, RISK_LABEL } from '../../utils/feasibilityApi';
import jsPDF from 'jspdf';

const PIE_COLORS = ['#0098B4','#10b981','#f59e0b','#ef4444','#8b5cf6','#3b82f6'];
const SCENARIO_COLORS = { base: '#0098B4', best: '#10b981', worst: '#ef4444' };

// ── Report sections ──────────────────────────────────────────────────────────

function ReportHeader({ project }) {
  return (
    <div className="bg-gradient-to-r from-[#0d1117] to-[#161b22] text-white rounded-2xl p-8 mb-6
                    border border-[#21262d] print:rounded-none">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#0098B4]/20 border border-[#0098B4]/30
                            flex items-center justify-center">
              <Building2 size={22} className="text-[#0098B4]" />
            </div>
            <div>
              <p className="text-xs text-[#0098B4] font-bold uppercase tracking-widest">
                AI Feasibility Report
              </p>
              <h1 className="text-2xl font-extrabold text-white">{project?.name}</h1>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            {project?.location || 'Location not specified'} ·{' '}
            <span className="capitalize">{project?.project_type}</span> ·{' '}
            Generated {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Burooj Marketing ERP</p>
          <p className="text-xs text-gray-600 mt-1">Confidential — Investor Copy</p>
        </div>
      </div>
    </div>
  );
}

function KPIGrid({ results }) {
  const risk = RISK_LABEL(results?.risk_score ?? 50);
  const kpis = [
    { label: 'Total Investment',  value: fmtPKRm(results?.total_project_cost), color: '#0098B4', icon: DollarSign },
    { label: 'Total Revenue',     value: fmtPKRm(results?.total_revenue),      color: '#10b981', icon: TrendingUp },
    { label: 'Net Profit',        value: fmtPKRm(results?.net_profit),         color: '#10b981', icon: TrendingUp },
    { label: 'ROI',               value: `${parseFloat(results?.roi_pct || 0).toFixed(2)}%`,      color: '#8b5cf6', icon: BarChart3 },
    { label: 'IRR (annual)',       value: results?.irr_pct ? `${parseFloat(results.irr_pct).toFixed(2)}%` : '—', color: '#f59e0b', icon: TrendingUp },
    { label: 'Break-even Month',  value: results?.breakeven_month ? `Month ${results.breakeven_month}` : '—', color: '#3b82f6', icon: Calendar },
    { label: 'Gross Margin',      value: `${parseFloat(results?.gross_margin_pct || 0).toFixed(1)}%`, color: '#0098B4', icon: BarChart3 },
    { label: 'Risk Score',        value: `${results?.risk_score ?? '—'}/100`,  color: risk.color, icon: ShieldAlert },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {kpis.map(k => (
        <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <k.icon size={13} style={{ color: k.color }} />
            <p className="text-xs text-gray-400 font-medium">{k.label}</p>
          </div>
          <p className="text-lg font-extrabold" style={{ color: k.color }}>{k.value}</p>
        </div>
      ))}
    </div>
  );
}

function CostPieSection({ costs }) {
  if (!costs) return null;
  const data = [
    { name: 'Land',         value: Math.round(costs.landCost) },
    { name: 'Construction', value: Math.round(costs.constructionCost) },
    { name: 'Finishing',    value: Math.round(costs.finishingCost) },
    { name: 'MEP',          value: Math.round(costs.mepCost) },
    { name: 'Contingency',  value: Math.round(costs.contingency) },
    { name: 'Financing',    value: Math.round(costs.financingCost) },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
        <DollarSign size={14} className="text-[#0098B4]" /> Cost Breakdown
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <ResponsiveContainer width={200} height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={80} labelLine={false}>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={v => fmtPKRm(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2 w-full">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-xs text-gray-600 flex-1">{d.name}</span>
              <span className="text-xs font-bold text-gray-800">{fmtPKRm(d.value)}</span>
              <span className="text-[10px] text-gray-400 w-10 text-right">
                {((d.value / data.reduce((s, x) => s + x.value, 0)) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CashflowSection({ cashflow }) {
  const sample = cashflow.length > 40 ? cashflow.filter((_, i) => i % 2 === 0) : cashflow;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
        <TrendingUp size={14} className="text-[#0098B4]" /> Cashflow Projection
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={sample} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0098B4" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0098B4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month_label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                 interval={Math.floor(sample.length / 6)} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                 tickFormatter={v => fmtPKRm(v)} />
          <Tooltip formatter={v => fmtPKRm(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Area dataKey="income" name="Income" stroke="#10b981" fill="none" strokeWidth={2} dot={false} />
          <Area dataKey="cumulative_cf" name="Cumulative CF" stroke="#0098B4" fill="url(#rGrad)" strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ScenarioSection({ scenarios }) {
  const scs = scenarios || [];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
        <BarChart3 size={14} className="text-[#0098B4]" /> Scenario Comparison
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={[
          { name: 'Net Profit (M)',    ...Object.fromEntries(scs.map(s => [s.scenario_type, parseFloat(s.net_profit)/1e6])) },
          { name: 'ROI (%)',           ...Object.fromEntries(scs.map(s => [s.scenario_type, parseFloat(s.roi_pct)])) },
          { name: 'Break-even (mo.)', ...Object.fromEntries(scs.map(s => [s.scenario_type, s.breakeven_month || 0])) },
        ]} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {scs.map(s => (
            <Bar key={s.scenario_type} dataKey={s.scenario_type}
                 name={s.scenario_type.charAt(0).toUpperCase() + s.scenario_type.slice(1) + ' Case'}
                 fill={SCENARIO_COLORS[s.scenario_type]} radius={[3,3,0,0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function UnitMixSection({ units }) {
  if (!units?.length) return null;
  const total = units.reduce((s, u) => s + parseInt(u.count), 0);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
        <Building2 size={14} className="text-[#0098B4]" /> Unit Mix
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-teal-600 text-white">
            <tr>
              {['Type', 'Units', 'Avg Size', 'Price/sqft', 'Revenue'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {units.map((u, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="px-4 py-2.5 font-semibold text-gray-800">{u.unit_type}</td>
                <td className="px-4 py-2.5 text-gray-600">{u.count}</td>
                <td className="px-4 py-2.5 text-gray-600">{Number(u.avg_size_sqft).toLocaleString()} sqft</td>
                <td className="px-4 py-2.5 text-gray-600">PKR {Number(u.price_per_sqft).toLocaleString()}</td>
                <td className="px-4 py-2.5 font-bold text-[#0098B4]">
                  {fmtPKRm(u.count * u.avg_size_sqft * u.price_per_sqft)}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold">
              <td className="px-4 py-2.5 text-gray-800">Total</td>
              <td className="px-4 py-2.5 text-gray-800">{total}</td>
              <td colSpan={2} />
              <td className="px-4 py-2.5 text-[#0098B4]">
                {fmtPKRm(units.reduce((s, u) => s + u.count * u.avg_size_sqft * u.price_per_sqft, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskSection({ results }) {
  if (!results) return null;
  const risk = RISK_LABEL(results.risk_score ?? 50);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
        <ShieldAlert size={14} className="text-[#0098B4]" /> Risk Assessment
      </h3>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center"
             style={{ background: `${risk.color}15`, border: `2px solid ${risk.color}33` }}>
          <span className="text-2xl font-extrabold" style={{ color: risk.color }}>
            {results.risk_score}
          </span>
          <span className="text-[9px] text-gray-400">/ 100</span>
        </div>
        <div>
          <p className="font-bold text-lg" style={{ color: risk.color }}>{risk.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {results.ai_summary}
          </p>
        </div>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
             style={{ width: `${results.risk_score}%`, background: `linear-gradient(90deg, #10b981, ${risk.color})` }} />
      </div>
    </div>
  );
}

// ── Main Component ──

export default function ReportGenerator() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const printRef = useRef();
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['feas-report', id],
    queryFn:  () => feasibilityApi.getReportData(id).then(r => r.data),
  });

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Feasibility-Report-${data?.project?.name || id}`,
  });

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const r   = data?.results;
      const p   = data?.project;

      // Cover page
      doc.setFillColor(13, 17, 23);
      doc.rect(0, 0, 210, 297, 'F');

      doc.setTextColor(0, 152, 180);
      doc.setFontSize(10);
      doc.text('AI FINANCIAL FEASIBILITY REPORT', 20, 40);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text(p?.name || 'Feasibility Report', 20, 60, { maxWidth: 170 });

      doc.setFontSize(11);
      doc.setTextColor(148, 163, 184);
      doc.text(p?.location || '', 20, 75);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 83);

      // KPI summary page
      doc.addPage();
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, 'F');

      doc.setTextColor(13, 17, 23);
      doc.setFontSize(16);
      doc.text('Executive Summary', 20, 25);

      const kpis = [
        ['Total Investment', fmtPKRm(r?.total_project_cost)],
        ['Total Revenue',    fmtPKRm(r?.total_revenue)],
        ['Net Profit',       fmtPKRm(r?.net_profit)],
        ['ROI',              `${parseFloat(r?.roi_pct || 0).toFixed(2)}%`],
        ['IRR (annual)',     r?.irr_pct ? `${parseFloat(r.irr_pct).toFixed(2)}%` : '—'],
        ['Break-even',       r?.breakeven_month ? `Month ${r.breakeven_month}` : '—'],
        ['Gross Margin',     `${parseFloat(r?.gross_margin_pct || 0).toFixed(1)}%`],
        ['Risk Score',       `${r?.risk_score ?? '—'}/100`],
      ];

      let y = 40;
      kpis.forEach(([label, value]) => {
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(label, 20, y);
        doc.setTextColor(0, 152, 180);
        doc.setFontSize(12);
        doc.text(value, 120, y);
        y += 12;
      });

      if (r?.ai_summary) {
        y += 5;
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text('AI Summary:', 20, y);
        y += 8;
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(r.ai_summary, 170);
        doc.text(lines, 20, y);
      }

      doc.save(`feasibility-report-${p?.name || id}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
    }
    setPdfLoading(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading report data…</div>;
  }

  if (!data?.results) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <FileText size={36} className="text-gray-200" />
        <p className="text-gray-500 text-sm">No results found — run the calculator first</p>
        <button onClick={() => navigate(`/feasibility/builder/${id}`)}
          className="px-4 py-2 rounded-xl bg-[#0098B4] text-white text-xs font-bold hover:bg-[#007a91]">
          Go to Builder
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Breadcrumb + Actions */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
          <button onClick={() => navigate('/feasibility')} className="hover:text-[#0098B4] transition">
            Feasibility
          </button>
          <ChevronRight size={14} />
          <span className="text-gray-800">Report</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePDF} disabled={pdfLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0098B4] hover:bg-[#007a91]
                       text-white text-xs font-bold transition disabled:opacity-50">
            <Download size={13} />
            {pdfLoading ? 'Generating…' : 'Download PDF'}
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white
                       text-gray-600 text-xs font-bold hover:bg-gray-50 transition">
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* Printable report */}
      <div ref={printRef} className="space-y-5 print:p-0">
        <ReportHeader  project={data.project} />
        <KPIGrid       results={data.results} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CostPieSection   costs={data.costs} />
          <UnitMixSection   units={data.units} />
        </div>
        <CashflowSection  cashflow={data.cashflow} />
        <ScenarioSection  scenarios={data.scenarios} />
        <RiskSection      results={data.results} />
      </div>
    </div>
  );
}
