// src/pages/feasibility/FeasibilityBuilder.jsx — AI Feasibility Input + Live Preview
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Save, Zap, Plus, Trash2, Loader2, ChevronRight,
  Building2, DollarSign, BarChart3, Landmark, Users,
  ShieldAlert, Sparkles, ArrowRight, RefreshCw,
} from 'lucide-react';
import { feasibilityApi, fmtPKRm, RISK_LABEL } from '../../utils/feasibilityApi';

const UNIT_TYPES = ['Studio', '1BR', '2BR', '3BR', 'Penthouse', 'Shop', 'Office'];

const DEFAULT_INPUTS = {
  land_cost: 50000000, land_area_sqft: 10000, location_tier: 'B',
  total_floors: 20, basement_levels: 1, floor_plate_sqft: 8000, construction_type: 'RCC Frame',
  construction_cost_sqft: 1200, finishing_cost_sqft: 350, mep_cost_sqft: 220,
  contingency_pct: 10, consultant_fee_pct: 3, marketing_cost_pct: 2,
  avg_price_sqft: 4500, booking_pct: 20, sales_velocity_units: 5, construction_months: 36,
  equity_pct: 40, loan_pct: 60, interest_rate_annual: 12, loan_term_months: 48,
  investor_share_pct: 30,
};

const DEFAULT_UNITS = [
  { unit_type: '1BR', count: 40, avg_size_sqft: 650,  price_per_sqft: 5000 },
  { unit_type: '2BR', count: 60, avg_size_sqft: 950,  price_per_sqft: 4800 },
  { unit_type: '3BR', count: 20, avg_size_sqft: 1400, price_per_sqft: 5200 },
  { unit_type: 'Shop', count: 10, avg_size_sqft: 400, price_per_sqft: 8000 },
];

// ── Field components ──

function InputField({ label, name, value, onChange, type = 'number', suffix, prefix: pfx, step = '1', min = '0' }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      <div className="relative">
        {pfx && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
            {pfx}
          </span>
        )}
        <input
          type={type} name={name} value={value} step={step} min={min}
          onChange={e => onChange(name, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
          className={`w-full border border-gray-200 rounded-xl py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30 focus:border-[#0098B4]
                      ${pfx ? 'pl-8' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={e => onChange(name, e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30 focus:border-[#0098B4]"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Section({ title, icon: Icon, children, id }) {
  return (
    <div id={id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
        <Icon size={15} className="text-[#0098B4]" />
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
      </div>
      <div className="p-5 grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

// ── Live Preview Panel ──

function LivePreview({ results, aiData, loading }) {
  const risk = RISK_LABEL(results?.riskScore ?? 50);
  const r = results;

  return (
    <div className="space-y-4">

      {/* AI Summary */}
      {aiData && (
        <div className="bg-gradient-to-br from-[#0d1117] to-[#161b22] rounded-2xl p-5
                        border border-[#21262d]">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-[#0098B4]" />
            <span className="text-xs font-bold text-[#0098B4] uppercase tracking-wider">AI Analysis</span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-white">
                  {aiData.estimated_roi?.toFixed(1)}%
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">Est. ROI</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold" style={{ color: risk.color }}>
                  {aiData.risk_score}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">{risk.label}</p>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-1">Suggested Price/sqft</p>
              <p className="text-base font-extrabold text-[#26b8d6]">
                PKR {aiData.suggested_price_sqft?.toLocaleString()}
              </p>
            </div>

            {aiData.warnings?.map((w, i) => (
              <div key={i} className="flex gap-2 bg-red-900/20 border border-red-800/30 rounded-xl p-3">
                <ShieldAlert size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-300 leading-relaxed">{w}</p>
              </div>
            ))}

            {aiData.suggestions?.map((s, i) => (
              <div key={i} className="flex gap-2 bg-[#0098B4]/10 border border-[#0098B4]/20 rounded-xl p-3">
                <Sparkles size={12} className="text-[#0098B4] flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-300 leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calculated results */}
      {r && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Calculated Results</h4>

          {[
            { label: 'Total Cost',     value: fmtPKRm(r.costs?.totalCost),      color: '#ef4444' },
            { label: 'Total Revenue',  value: fmtPKRm(r.revenue?.totalRevenue), color: '#0098B4' },
            { label: 'Gross Profit',   value: fmtPKRm(r.grossProfit),           color: '#10b981' },
            { label: 'Net Profit',     value: fmtPKRm(r.netProfit),             color: '#10b981' },
            { label: 'ROI',            value: `${r.roi_pct?.toFixed(2)}%`,      color: '#8b5cf6' },
            { label: 'IRR (annual)',   value: r.irr_pct ? `${r.irr_pct?.toFixed(2)}%` : '—', color: '#f59e0b' },
            { label: 'Break-even',     value: r.breakeven_month ? `Month ${r.breakeven_month}` : '—', color: '#3b82f6' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-1.5
                                             border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-500 font-medium">{item.label}</span>
              <span className="text-sm font-extrabold" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}

          {/* Cost breakdown mini */}
          {r.costs && (
            <div className="pt-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Cost Breakdown</p>
              {[
                ['Land',         r.costs.landCost],
                ['Construction', r.costs.constructionCost],
                ['Finishing',    r.costs.finishingCost],
                ['MEP',          r.costs.mepCost],
                ['Contingency',  r.costs.contingency],
                ['Financing',    r.costs.financingCost],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px] py-0.5">
                  <span className="text-gray-400">{k}</span>
                  <span className="font-semibold text-gray-600">{fmtPKRm(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={22} className="animate-spin text-[#0098B4]" />
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

export default function FeasibilityBuilder() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [inputs, setInputs]     = useState(DEFAULT_INPUTS);
  const [units,  setUnits]      = useState(DEFAULT_UNITS);
  const [results, setResults]   = useState(null);
  const [aiData,  setAiData]    = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Load existing project
  const { data: projectData } = useQuery({
    queryKey: ['feas-project', id],
    queryFn:  () => feasibilityApi.getProject(id).then(r => r.data),
    enabled:  !!id,
  });

  useEffect(() => {
    if (projectData?.inputs) {
      setInputs({ ...DEFAULT_INPUTS, ...projectData.inputs });
    }
    if (projectData?.units?.length) {
      setUnits(projectData.units);
    }
    if (projectData?.results) {
      setResults(projectData.results);
    }
  }, [projectData]);

  const handleInput = (name, value) => setInputs(p => ({ ...p, [name]: value }));

  // AI suggest on key input changes
  const runAiSuggest = async () => {
    setAiLoading(true);
    try {
      const r = await feasibilityApi.aiSuggest({ ...inputs, units });
      setAiData(r.data);
    } catch { /* silent */ }
    setAiLoading(false);
  };

  // Save inputs mutation
  const saveMutation = useMutation({
    mutationFn: () => feasibilityApi.saveInputs(id, { ...inputs, units }),
    onSuccess:  () => toast.success('Inputs saved'),
    onError:    () => toast.error('Save failed'),
  });

  // Calculate mutation
  const calcMutation = useMutation({
    mutationFn: () => feasibilityApi.calculate(id),
    onSuccess: (r) => {
      setResults(r.data.result);
      qc.invalidateQueries(['feas-project', id]);
      toast.success('Feasibility calculated!');
    },
    onError: () => toast.error('Calculation failed'),
  });

  const handleSaveAndCalc = async () => {
    await saveMutation.mutateAsync();
    await calcMutation.mutateAsync();
    await runAiSuggest();
  };

  const addUnit = () => setUnits(p => [...p, { unit_type: '1BR', count: 10, avg_size_sqft: 800, price_per_sqft: 5000 }]);
  const removeUnit = (i) => setUnits(p => p.filter((_, idx) => idx !== i));
  const updateUnit = (i, k, v) => setUnits(p => p.map((u, idx) => idx === i ? { ...u, [k]: v } : u));

  const totalRevenue = units.reduce((s, u) => s + u.count * u.avg_size_sqft * u.price_per_sqft, 0);
  const totalUnits   = units.reduce((s, u) => s + u.count, 0);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
          <button onClick={() => navigate('/feasibility')} className="hover:text-[#0098B4] transition">
            Feasibility
          </button>
          <ChevronRight size={14} />
          <span className="text-gray-800">{projectData?.project?.name || 'Builder'}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runAiSuggest}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#0098B4]/30
                       bg-[#0098B4]/5 text-[#0098B4] text-xs font-bold hover:bg-[#0098B4]/10 transition"
          >
            {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            AI Suggest
          </button>
          <button
            onClick={handleSaveAndCalc}
            disabled={saveMutation.isPending || calcMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0098B4] hover:bg-[#007a91]
                       text-white text-xs font-bold transition disabled:opacity-50"
          >
            {(saveMutation.isPending || calcMutation.isPending)
              ? <Loader2 size={13} className="animate-spin" />
              : <Zap size={13} />}
            Save & Calculate
          </button>
          <button
            onClick={() => navigate(`/feasibility/report/${id}`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white
                       text-gray-600 text-xs font-bold hover:bg-gray-50 transition"
          >
            <BarChart3 size={13} /> Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── Left: Input Sections ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Land */}
          <Section title="Land Data" icon={Landmark} id="land">
            <InputField label="Land Cost (PKR)" name="land_cost" value={inputs.land_cost} onChange={handleInput} pfx="₨" />
            <InputField label="Land Area (sqft)" name="land_area_sqft" value={inputs.land_area_sqft} onChange={handleInput} />
            <SelectField label="Location Tier" name="location_tier" value={inputs.location_tier} onChange={handleInput}
              options={[{ value: 'A', label: 'Tier A (Prime)' }, { value: 'B', label: 'Tier B (Mid)' }, { value: 'C', label: 'Tier C (Peripheral)' }]} />
            <InputField label="Total Floors" name="total_floors" value={inputs.total_floors} onChange={handleInput} step="1" />
          </Section>

          {/* Building */}
          <Section title="Building Structure" icon={Building2} id="building">
            <InputField label="Floor Plate (sqft)" name="floor_plate_sqft" value={inputs.floor_plate_sqft} onChange={handleInput} />
            <InputField label="Basement Levels"     name="basement_levels"  value={inputs.basement_levels} onChange={handleInput} step="1" />
            <SelectField label="Construction Type" name="construction_type" value={inputs.construction_type} onChange={handleInput}
              options={[
                { value: 'RCC Frame',  label: 'RCC Frame Structure' },
                { value: 'Steel Frame', label: 'Steel Frame' },
                { value: 'Composite',  label: 'Composite' },
              ]} />
            <InputField label="Construction Duration (months)" name="construction_months" value={inputs.construction_months} onChange={handleInput} step="1" />
          </Section>

          {/* Costs */}
          <Section title="Cost Data" icon={DollarSign} id="costs">
            <InputField label="Construction Cost/sqft (PKR)" name="construction_cost_sqft" value={inputs.construction_cost_sqft} onChange={handleInput} />
            <InputField label="Finishing Cost/sqft (PKR)"    name="finishing_cost_sqft"    value={inputs.finishing_cost_sqft}    onChange={handleInput} />
            <InputField label="MEP Cost/sqft (PKR)"          name="mep_cost_sqft"          value={inputs.mep_cost_sqft}          onChange={handleInput} />
            <InputField label="Contingency %"                name="contingency_pct"        value={inputs.contingency_pct}        onChange={handleInput} suffix="%" step="0.5" />
            <InputField label="Consultant Fee %"             name="consultant_fee_pct"     value={inputs.consultant_fee_pct}     onChange={handleInput} suffix="%" step="0.5" />
            <InputField label="Marketing Cost %"             name="marketing_cost_pct"     value={inputs.marketing_cost_pct}     onChange={handleInput} suffix="%" step="0.5" />
          </Section>

          {/* Sales */}
          <Section title="Sales Parameters" icon={BarChart3} id="sales">
            <InputField label="Avg. Price/sqft (PKR)" name="avg_price_sqft"         value={inputs.avg_price_sqft}         onChange={handleInput} />
            <InputField label="Booking %"              name="booking_pct"            value={inputs.booking_pct}            onChange={handleInput} suffix="%" step="1" />
            <InputField label="Sales Velocity (units/month)" name="sales_velocity_units" value={inputs.sales_velocity_units} onChange={handleInput} step="1" />
          </Section>

          {/* Financing */}
          <Section title="Financing Structure" icon={Landmark} id="finance">
            <InputField label="Equity %"           name="equity_pct"           value={inputs.equity_pct}           onChange={handleInput} suffix="%" step="1" />
            <InputField label="Loan %"             name="loan_pct"             value={inputs.loan_pct}             onChange={handleInput} suffix="%" step="1" />
            <InputField label="Annual Interest %"  name="interest_rate_annual" value={inputs.interest_rate_annual} onChange={handleInput} suffix="%" step="0.5" />
            <InputField label="Loan Term (months)" name="loan_term_months"     value={inputs.loan_term_months}     onChange={handleInput} step="1" />
            <InputField label="Investor Share %"   name="investor_share_pct"   value={inputs.investor_share_pct}   onChange={handleInput} suffix="%" step="1" />
          </Section>

          {/* Unit Mix */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <Users size={15} className="text-[#0098B4]" />
                <h3 className="font-bold text-gray-800 text-sm">Unit Mix</h3>
                <span className="text-xs text-gray-400">
                  {totalUnits} units · {fmtPKRm(totalRevenue)} total revenue
                </span>
              </div>
              <button onClick={addUnit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0098B4]/10 text-[#0098B4]
                           text-xs font-bold hover:bg-[#0098B4]/20 transition">
                <Plus size={12} /> Add Type
              </button>
            </div>
            <div className="p-4 space-y-2">
              {units.map((u, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-center">
                  <select
                    value={u.unit_type}
                    onChange={e => updateUnit(i, 'unit_type', e.target.value)}
                    className="border border-gray-200 rounded-xl px-2 py-2 text-xs bg-white
                               focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30"
                  >
                    {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {[
                    { key: 'count',          placeholder: 'Units',      type: 'number' },
                    { key: 'avg_size_sqft',  placeholder: 'Size sqft',  type: 'number' },
                    { key: 'price_per_sqft', placeholder: 'PKR/sqft',   type: 'number' },
                  ].map(f => (
                    <input key={f.key} type={f.type} value={u[f.key]} placeholder={f.placeholder}
                      onChange={e => updateUnit(i, f.key, parseFloat(e.target.value) || 0)}
                      className="border border-gray-200 rounded-xl px-2 py-2 text-xs
                                 focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30"
                    />
                  ))}
                  <button onClick={() => removeUnit(i)}
                    className="p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-500 transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {units.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No unit types — system will use aggregate avg price/sqft
                </p>
              )}
            </div>
          </div>

        </div>

        {/* ── Right: Live Preview ── */}
        <div className="space-y-4">
          <div className="sticky top-4">
            <LivePreview results={results} aiData={aiData} loading={aiLoading || calcMutation.isPending} />

            {results && (
              <button
                onClick={() => navigate(`/feasibility/cashflow/${id}`)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl
                           bg-gradient-to-r from-[#0098B4] to-[#26b8d6] text-white font-bold text-sm
                           hover:shadow-lg transition"
              >
                View Cashflow Analysis <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
