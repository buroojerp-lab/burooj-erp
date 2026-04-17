// src/pages/feasibility/ScenarioSimulator.jsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { Sliders, Zap, ChevronRight, TrendingUp, DollarSign, Calendar, Loader2 } from 'lucide-react';
import { feasibilityApi, fmtPKRm } from '../../utils/feasibilityApi';

const SCENARIO_COLORS = { base: '#0098B4', best: '#10b981', worst: '#ef4444' };

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0d1117] border border-[#21262d] text-white px-3 py-2.5 rounded-xl shadow-xl text-xs">
      <p className="font-bold text-gray-300 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-bold">{typeof p.value === 'number' && Math.abs(p.value) > 100 ? fmtPKRm(p.value) : `${p.value}%`}</span>
        </p>
      ))}
    </div>
  );
};

function ScenarioCard({ sc, color }) {
  const isWorst = sc.scenario_type === 'worst';
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden"
         style={{ borderColor: `${color}33` }}>
      <div className="h-1" style={{ background: color }} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
               style={{ background: `${color}15` }}>
            <TrendingUp size={14} style={{ color }} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm capitalize">{sc.scenario_type} Case</h3>
            <p className="text-[10px] text-gray-400">
              Cost {sc.cost_adjustment_pct > 0 ? '+' : ''}{sc.cost_adjustment_pct}% ·
              Revenue {sc.revenue_adjustment_pct > 0 ? '+' : ''}{sc.revenue_adjustment_pct}%
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          {[
            { label: 'Total Cost',    value: fmtPKRm(sc.total_cost),    color: '#ef4444' },
            { label: 'Revenue',       value: fmtPKRm(sc.total_revenue), color: '#0098B4' },
            { label: 'Net Profit',    value: fmtPKRm(sc.net_profit),    color: '#10b981' },
            { label: 'ROI',           value: `${parseFloat(sc.roi_pct || 0).toFixed(2)}%`, color },
            { label: 'IRR',           value: sc.irr_pct ? `${parseFloat(sc.irr_pct).toFixed(2)}%` : '—', color },
            { label: 'Break-even',    value: sc.breakeven_month ? `Month ${sc.breakeven_month}` : '—', color: '#f59e0b' },
          ].map(item => (
            <div key={item.label} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0">
              <span className="text-xs text-gray-500">{item.label}</span>
              <span className="text-xs font-bold" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ScenarioSimulator() {
  const { id }   = useParams();
  const navigate = useNavigate();

  // Slider state for custom scenario
  const [costAdj,     setCostAdj]     = useState(0);
  const [revenueAdj,  setRevenueAdj]  = useState(0);
  const [velocityMult, setVelocityMult] = useState(1.0);
  const [customResult, setCustomResult] = useState(null);

  const { data: scenarios } = useQuery({
    queryKey: ['feas-scenarios', id],
    queryFn:  () => feasibilityApi.getScenarios(id).then(r => r.data.data),
  });

  const { data: projData } = useQuery({
    queryKey: ['feas-project', id],
    queryFn:  () => feasibilityApi.getProject(id).then(r => r.data),
  });

  const customMutation = useMutation({
    mutationFn: () => feasibilityApi.runScenario(id, {
      cost_adj: costAdj, revenue_adj: revenueAdj, velocity_mult: velocityMult,
    }),
    onSuccess: (r) => setCustomResult(r.data),
  });

  const scs = scenarios || [];
  const base  = scs.find(s => s.scenario_type === 'base');
  const best  = scs.find(s => s.scenario_type === 'best');
  const worst = scs.find(s => s.scenario_type === 'worst');

  // Comparison chart data
  const barData = scs.length ? [
    { metric: 'Net Profit',  ...Object.fromEntries(scs.map(s => [s.scenario_type, parseFloat(s.net_profit)])) },
    { metric: 'ROI %',       ...Object.fromEntries(scs.map(s => [s.scenario_type, parseFloat(s.roi_pct)])) },
    { metric: 'Break-even',  ...Object.fromEntries(scs.map(s => [s.scenario_type, s.breakeven_month || 0])) },
  ] : [];

  // Radar chart
  const radarData = base ? [
    { subject: 'ROI',       base: base.roi_pct, best: best?.roi_pct, worst: worst?.roi_pct },
    { subject: 'Revenue',   base: parseFloat(base.total_revenue)/1e6, best: parseFloat(best?.total_revenue)/1e6, worst: parseFloat(worst?.total_revenue)/1e6 },
    { subject: 'Profit',    base: parseFloat(base.net_profit)/1e6,    best: parseFloat(best?.net_profit)/1e6,    worst: parseFloat(worst?.net_profit)/1e6 },
    { subject: 'Speed',     base: 5, best: 7, worst: 3 },
    { subject: 'Safety',    base: 6, best: 8, worst: 3 },
  ] : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 font-medium mb-5">
        <button onClick={() => navigate('/feasibility')} className="hover:text-[#0098B4] transition">Feasibility</button>
        <ChevronRight size={14} />
        <button onClick={() => navigate(`/feasibility/builder/${id}`)} className="hover:text-[#0098B4] transition">
          {projData?.project?.name || 'Project'}
        </button>
        <ChevronRight size={14} />
        <span className="text-gray-800">Scenario Simulator</span>
      </div>

      {scs.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-gray-300 gap-3 bg-white rounded-2xl border border-gray-100">
          <Sliders size={28} />
          <p className="text-sm text-gray-400">Run the calculator first to generate scenarios</p>
        </div>
      ) : (
        <>
          {/* Three scenario cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {[base, best, worst].filter(Boolean).map(sc => (
              <ScenarioCard key={sc.scenario_type} sc={sc}
                color={SCENARIO_COLORS[sc.scenario_type]} />
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">

            {/* Comparison bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-800 text-sm mb-4">Scenario Comparison</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={[
                  { metric: 'Net Profit (M)', base: parseFloat(base?.net_profit)/1e6, best: parseFloat(best?.net_profit)/1e6, worst: parseFloat(worst?.net_profit)/1e6 },
                  { metric: 'ROI (%)',         base: parseFloat(base?.roi_pct),         best: parseFloat(best?.roi_pct),         worst: parseFloat(worst?.roi_pct) },
                  { metric: 'Break-even Mo',  base: base?.breakeven_month || 0,        best: best?.breakeven_month || 0,        worst: worst?.breakeven_month || 0 },
                ]} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="metric" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="base"  name="Base"  fill={SCENARIO_COLORS.base}  radius={[3,3,0,0]} />
                  <Bar dataKey="best"  name="Best"  fill={SCENARIO_COLORS.best}  radius={[3,3,0,0]} />
                  <Bar dataKey="worst" name="Worst" fill={SCENARIO_COLORS.worst} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Radar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-800 text-sm mb-4">Performance Radar</h3>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#f1f5f9" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Radar name="Base"  dataKey="base"  stroke={SCENARIO_COLORS.base}  fill={SCENARIO_COLORS.base}  fillOpacity={0.2} />
                  <Radar name="Best"  dataKey="best"  stroke={SCENARIO_COLORS.best}  fill={SCENARIO_COLORS.best}  fillOpacity={0.15} />
                  <Radar name="Worst" dataKey="worst" stroke={SCENARIO_COLORS.worst} fill={SCENARIO_COLORS.worst} fillOpacity={0.1} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Custom Scenario Slider */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Sliders size={15} className="text-[#0098B4]" />
                <h3 className="font-bold text-gray-800 text-sm">Custom Scenario Simulator</h3>
              </div>
              <button
                onClick={() => customMutation.mutate()}
                disabled={customMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0098B4] hover:bg-[#007a91]
                           text-white text-xs font-bold transition disabled:opacity-50"
              >
                {customMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                Run Simulation
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
              {[
                { label: `Cost Adjustment: ${costAdj > 0 ? '+' : ''}${costAdj}%`, value: costAdj, set: setCostAdj, min: -30, max: 50, step: 1 },
                { label: `Revenue Adjustment: ${revenueAdj > 0 ? '+' : ''}${revenueAdj}%`, value: revenueAdj, set: setRevenueAdj, min: -40, max: 40, step: 1 },
                { label: `Sales Velocity: ${velocityMult.toFixed(1)}×`, value: velocityMult, set: setVelocityMult, min: 0.3, max: 3.0, step: 0.1 },
              ].map(s => (
                <div key={s.label}>
                  <label className="text-xs font-semibold text-gray-600 mb-2 block">{s.label}</label>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                    onChange={e => s.set(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer
                               [&::-webkit-slider-thumb]:appearance-none
                               [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                               [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#0098B4]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>{s.min}</span><span>{s.max}</span>
                  </div>
                </div>
              ))}
            </div>

            {customResult && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-[#0d1117] rounded-xl p-4">
                {[
                  { label: 'Total Cost',   value: fmtPKRm(customResult.total_cost),    color: '#ef4444' },
                  { label: 'Revenue',      value: fmtPKRm(customResult.total_revenue),  color: '#0098B4' },
                  { label: 'Net Profit',   value: fmtPKRm(customResult.net_profit),     color: '#10b981' },
                  { label: 'ROI',          value: `${customResult.roi_pct?.toFixed(2)}%`, color: '#8b5cf6' },
                  { label: 'IRR',          value: customResult.irr_pct ? `${customResult.irr_pct?.toFixed(2)}%` : '—', color: '#f59e0b' },
                  { label: 'Break-even',   value: customResult.breakeven_month ? `M${customResult.breakeven_month}` : '—', color: '#3b82f6' },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <p className="text-base font-extrabold" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
