// src/pages/PaymentPlanCalculator.jsx — Real Estate Payment Plan Calculator
import React, { useState, useMemo } from 'react';
import { Calculator, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) =>
  (parseFloat(n) || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });

const parsePKR = (s) => parseFloat((s || '').toString().replace(/,/g, '')) || 0;

const pct = (part, total) =>
  total > 0 ? ((part / total) * 100).toFixed(2) : '0.00';

// ─── Config ──────────────────────────────────────────────────────────────────
const DEFAULT_TOTAL = 5555000;

const DEFAULTS = {
  down:        1675000,
  confirmation:  559000,
  monthlyAmt:     84500,
  months:            18,
  balloon:        600000,
  possession:    1200000,
};

const TYPES = [
  {
    key: 'down',
    label: 'Down Payment',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#16a34a',
    textCls: 'text-green-700',
    badgeCls: 'bg-green-100 text-green-700',
  },
  {
    key: 'confirmation',
    label: 'Confirmation Payment',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#7c3aed',
    textCls: 'text-violet-700',
    badgeCls: 'bg-violet-100 text-violet-700',
  },
  {
    key: 'monthly',
    label: 'Monthly Installments',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#2563eb',
    textCls: 'text-blue-700',
    badgeCls: 'bg-blue-100 text-blue-700',
    hasMonths: true,
  },
  {
    key: 'balloon',
    label: 'Balloon Payment',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#d97706',
    textCls: 'text-amber-700',
    badgeCls: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'possession',
    label: 'On Possession',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#dc2626',
    textCls: 'text-red-700',
    badgeCls: 'bg-red-100 text-red-700',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PaymentPlanCalculator() {
  const [totalInput, setTotalInput] = useState(fmt(DEFAULT_TOTAL));
  const [amounts, setAmounts] = useState({
    down:         DEFAULTS.down,
    confirmation: DEFAULTS.confirmation,
    monthlyAmt:   DEFAULTS.monthlyAmt,
    months:       DEFAULTS.months,
    balloon:      DEFAULTS.balloon,
    possession:   DEFAULTS.possession,
  });

  // Derived
  const total     = parsePKR(totalInput);
  const monthly   = amounts.monthlyAmt * amounts.months;
  const sumParts  = amounts.down + amounts.confirmation + monthly + amounts.balloon + amounts.possession;
  const diff      = total - sumParts;
  const isBalanced = Math.abs(diff) < 1;
  const totalPct   = total > 0 ? ((sumParts / total) * 100).toFixed(2) : '0.00';

  // Bar widths (% of total each occupies)
  const barData = useMemo(() => [
    { key: 'down',         amount: amounts.down,         color: '#16a34a', label: 'Down'         },
    { key: 'confirmation', amount: amounts.confirmation, color: '#7c3aed', label: 'Confirmation' },
    { key: 'monthly',      amount: monthly,              color: '#2563eb', label: 'Monthly'      },
    { key: 'balloon',      amount: amounts.balloon,      color: '#d97706', label: 'Balloon'      },
    { key: 'possession',   amount: amounts.possession,   color: '#dc2626', label: 'Possession'   },
  ].filter(b => b.amount > 0), [amounts, monthly]);

  const handleAmountChange = (key, raw) => {
    const val = parsePKR(raw);
    setAmounts(prev => ({ ...prev, [key]: val }));
  };

  const handleMonthsChange = (val) => {
    const m = Math.max(1, parseInt(val) || 1);
    setAmounts(prev => ({ ...prev, months: m }));
  };

  const reset = () => {
    setTotalInput(fmt(DEFAULT_TOTAL));
    setAmounts({
      down:         DEFAULTS.down,
      confirmation: DEFAULTS.confirmation,
      monthlyAmt:   DEFAULTS.monthlyAmt,
      months:       DEFAULTS.months,
      balloon:      DEFAULTS.balloon,
      possession:   DEFAULTS.possession,
    });
  };

  // Auto-balance: adjust down payment to make total = 100%
  const autoBalance = () => {
    if (total <= 0) return;
    const otherSum = amounts.confirmation + monthly + amounts.balloon + amounts.possession;
    const newDown  = Math.max(0, total - otherSum);
    setAmounts(prev => ({ ...prev, down: newDown }));
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #0a1628)' }}
          >
            <Calculator size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900">Payment Plan Calculator</h1>
            <p className="text-xs text-gray-400">
              Real estate installment breakdown with auto percentage calculation
            </p>
          </div>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200
                     hover:border-gray-300 px-3 py-1.5 rounded-lg transition"
        >
          <RotateCcw size={12} /> Reset to Sample
        </button>
      </div>

      {/* ── Total Property Cost ── */}
      <div
        className="rounded-2xl border-2 p-5 shadow-sm"
        style={{ borderColor: '#1e3a5f', background: 'linear-gradient(135deg, #f0f7ff, #e8f0fb)' }}
      >
        <label className="block text-[11px] font-black uppercase tracking-[0.2em] text-blue-900 mb-2">
          Total Property Cost (PKR)
        </label>
        <input
          type="text"
          value={totalInput}
          onChange={e => setTotalInput(e.target.value)}
          onBlur={e => setTotalInput(fmt(parsePKR(e.target.value)))}
          className="w-full text-3xl font-black text-blue-900 bg-transparent border-0 outline-none
                     placeholder-blue-300 tracking-tight"
          placeholder="0"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <div className="text-[11px] text-blue-500 mt-1">
          PKR {fmt(total)} &nbsp;·&nbsp; Enter the total sale price of the property
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Input Panel ── */}
        <div className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">
            Payment Breakdown
          </div>

          {TYPES.map(({ key, label, bg, border, textCls, badgeCls, hasMonths }) => {
            const rawAmt = key === 'monthly' ? amounts.monthlyAmt : amounts[key];
            const totalAmt = key === 'monthly' ? monthly : amounts[key];
            const pcVal = pct(totalAmt, total);

            return (
              <div
                key={key}
                className="rounded-xl border-l-4 overflow-hidden shadow-sm"
                style={{ borderLeftColor: border, background: bg }}
              >
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-black uppercase tracking-wide ${textCls}`}>
                      {label}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
                      {pcVal}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Amount input */}
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-400 block mb-0.5">
                        {hasMonths ? 'Per Month (PKR)' : 'Amount (PKR)'}
                      </label>
                      <input
                        type="text"
                        value={fmt(rawAmt)}
                        onChange={e => handleAmountChange(
                          key === 'monthly' ? 'monthlyAmt' : key,
                          e.target.value
                        )}
                        onBlur={e => handleAmountChange(
                          key === 'monthly' ? 'monthlyAmt' : key,
                          e.target.value
                        )}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold
                                   text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                      />
                    </div>

                    {/* Months input (only for monthly) */}
                    {hasMonths && (
                      <div className="w-20">
                        <label className="text-[10px] text-gray-400 block mb-0.5">Months</label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={amounts.months}
                          onChange={e => handleMonthsChange(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold
                                     text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-center"
                        />
                      </div>
                    )}

                    {/* Total for the row */}
                    <div className="w-28 text-right">
                      <div className="text-[10px] text-gray-400 mb-0.5">
                        {hasMonths ? `Total (×${amounts.months})` : 'Total'}
                      </div>
                      <div className={`text-sm font-black ${textCls}`}>
                        {fmt(totalAmt)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* ── Total row ── */}
          <div
            className={`rounded-xl border-2 px-4 py-3 flex items-center justify-between shadow-sm ${
              isBalanced
                ? 'border-green-400 bg-green-50'
                : 'border-red-400 bg-red-50'
            }`}
          >
            <div className="flex items-center gap-2">
              {isBalanced
                ? <CheckCircle2 size={16} className="text-green-600" />
                : <AlertCircle  size={16} className="text-red-500"   />}
              <span className={`text-[11px] font-black uppercase tracking-wide ${
                isBalanced ? 'text-green-700' : 'text-red-600'
              }`}>
                {isBalanced ? 'Balanced — 100%' : `Total: ${totalPct}% (${diff > 0 ? '+' : ''}${fmt(diff)} PKR)`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-base font-black ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>
                PKR {fmt(sumParts)}
              </span>
              {!isBalanced && (
                <button
                  onClick={autoBalance}
                  className="text-[10px] bg-blue-600 text-white px-2.5 py-1 rounded-lg font-bold hover:bg-blue-700 transition"
                >
                  Auto-Fix DP
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Summary Panel ── */}
        <div className="space-y-4">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">
            Visual Breakdown
          </div>

          {/* Stacked Bar */}
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
            <div className="px-4 pt-4 pb-2">
              <div className="h-8 rounded-lg overflow-hidden flex">
                {barData.map(b => (
                  <div
                    key={b.key}
                    title={`${b.label}: PKR ${fmt(b.amount)} (${pct(b.amount, total)}%)`}
                    style={{
                      width: `${Math.max(0, (b.amount / Math.max(total, sumParts)) * 100)}%`,
                      background: b.color,
                      transition: 'width 0.3s ease',
                    }}
                  />
                ))}
                {/* Remaining gap if total > sumParts */}
                {diff > 0 && (
                  <div
                    style={{
                      width: `${(diff / total) * 100}%`,
                      background: '#e5e7eb',
                    }}
                  />
                )}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {barData.map(b => (
                  <div key={b.key} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: b.color }} />
                    <span className="text-[10px] text-gray-500">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="mt-3 border-t border-gray-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left font-bold text-gray-400 text-[10px] uppercase tracking-wider">
                      Payment Type
                    </th>
                    <th className="px-4 py-2 text-right font-bold text-gray-400 text-[10px] uppercase tracking-wider">
                      Amount (PKR)
                    </th>
                    <th className="px-4 py-2 text-right font-bold text-gray-400 text-[10px] uppercase tracking-wider w-16">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { label: 'Down Payment',          amt: amounts.down,         color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Confirmation Payment',   amt: amounts.confirmation, color: '#7c3aed', bg: '#f5f3ff' },
                    {
                      label: `Monthly ×${amounts.months} (${fmt(amounts.monthlyAmt)}/mo)`,
                      amt: monthly,
                      color: '#2563eb',
                      bg: '#eff6ff',
                    },
                    { label: 'Balloon Payment',        amt: amounts.balloon,      color: '#d97706', bg: '#fffbeb' },
                    { label: 'On Possession',          amt: amounts.possession,   color: '#dc2626', bg: '#fef2f2' },
                  ].filter(r => r.amt > 0).map((row) => (
                    <tr key={row.label} style={{ background: row.bg }}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: row.color }}
                          />
                          <span className="font-semibold text-gray-700 text-[11px]">{row.label}</span>
                        </div>
                      </td>
                      <td
                        className="px-4 py-2.5 text-right font-black text-[12px] tabular-nums"
                        style={{ color: row.color }}
                      >
                        {fmt(row.amt)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 font-semibold text-[11px] tabular-nums">
                        {pct(row.amt, total)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr
                    className="text-white text-[11px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #050e1d, #0f2a4d)' }}
                  >
                    <td className="px-4 py-3 font-black uppercase tracking-wider text-[10px]">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-black tabular-nums text-[12px]">
                      {fmt(sumParts)}
                    </td>
                    <td className={`px-4 py-3 text-right font-black text-[11px] ${
                      isBalanced ? 'text-green-300' : 'text-red-300'
                    }`}>
                      {totalPct}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Total Property Cost',
                value: `PKR ${fmt(total)}`,
                sub: 'Base price',
                accent: '#1e3a5f',
                bg: '#f0f7ff',
                textCls: 'text-blue-900',
              },
              {
                label: 'Monthly Payment',
                value: `PKR ${fmt(amounts.monthlyAmt)}`,
                sub: `× ${amounts.months} months`,
                accent: '#2563eb',
                bg: '#eff6ff',
                textCls: 'text-blue-700',
              },
              {
                label: 'Upfront (DP + CNF)',
                value: `PKR ${fmt(amounts.down + amounts.confirmation)}`,
                sub: `${pct(amounts.down + amounts.confirmation, total)}% of total`,
                accent: '#16a34a',
                bg: '#f0fdf4',
                textCls: 'text-green-700',
              },
              {
                label: 'Deferred (Balloon + POS)',
                value: `PKR ${fmt(amounts.balloon + amounts.possession)}`,
                sub: `${pct(amounts.balloon + amounts.possession, total)}% of total`,
                accent: '#d97706',
                bg: '#fffbeb',
                textCls: 'text-amber-700',
              },
            ].map(({ label, value, sub, accent, bg, textCls }) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 overflow-hidden shadow-sm"
              >
                <div className="h-1" style={{ background: accent }} />
                <div className="px-3 py-3 text-center" style={{ background: bg }}>
                  <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</div>
                  <div className={`text-sm font-black mt-1 ${textCls}`}>{value}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Disclaimer ── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <AlertCircle size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-blue-700 leading-relaxed">
          This calculator is for planning purposes only.
          Final payment plan terms are subject to official booking agreement.
          Contact Burooj Heights Accounts Department for confirmation.
        </p>
      </div>
    </div>
  );
}
