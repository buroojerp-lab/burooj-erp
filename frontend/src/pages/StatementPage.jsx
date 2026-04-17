// src/pages/StatementPage.jsx — Premium Dubai Real Estate Statement
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Printer, Download,
  Building2, User, Calendar, Hash,
  CheckCircle2, Clock, AlertCircle, Pencil,
} from 'lucide-react';
import api from '../utils/api';
import { pdfUrl } from '../utils/pdfUrl';
import EditScheduleModal from '../components/EditScheduleModal';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtFloor = (n) => {
  const fn = parseInt(n);
  return fn === -1 ? 'Lower Ground' : fn === 0 ? 'Ground' : `${fn}`;
};
const fmt = (n) =>
  (parseFloat(n) || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return d; }
};
const unitTypeLabel = (t) =>
  (t || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const today = new Date().toLocaleDateString('en-GB', {
  day: '2-digit', month: 'long', year: 'numeric',
});

// ─── Status badge ────────────────────────────────────────────────────────────
const STATUS_MAP = {
  opening: { label: 'B/F',     cls: 'bg-blue-100   text-blue-700',   dot: 'bg-blue-500'   },
  paid:    { label: 'PAID',    cls: 'bg-green-100  text-green-700',  dot: 'bg-green-500'  },
  overdue: { label: 'OVERDUE', cls: 'bg-red-100    text-red-700',    dot: 'bg-red-500'    },
  partial: { label: 'PARTIAL', cls: 'bg-amber-100  text-amber-700',  dot: 'bg-amber-500'  },
  pending: { label: 'PENDING', cls: 'bg-gray-100   text-gray-500',   dot: 'bg-gray-400'   },
};
const Badge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

// ─── InfoRow ─────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
    <span className="text-[11px] text-gray-400 font-medium w-36 shrink-0 pt-px">{label}</span>
    <span className="text-[11px] font-semibold text-gray-800 leading-snug">{value || '—'}</span>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StatementPage() {
  const { id } = useParams();
  const [editSched, setEditSched] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['statement-data', id],
    queryFn: () => api.get(`/bookings/${id}/statement-data`).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading statement…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-sm">
        Failed to load statement.
      </div>
    );
  }

  const { booking: b, rows, summary: s } = data;

  // ── Calculated totals ──
  const periodRows     = rows.filter((r) => r.status !== 'opening');
  const totalAmt       = periodRows.reduce((acc, r) => acc + r.amount, 0);
  const totalSurcharge = periodRows.reduce((acc, r) => acc + r.surcharge, 0);
  const paidCount      = periodRows.filter((r) => r.status === 'paid').length;
  const overdueCount   = periodRows.filter((r) => r.status === 'overdue').length;
  const partialCount   = periodRows.filter((r) => r.status === 'partial').length;
  const pendingCount   = periodRows.filter((r) => r.status === 'pending').length;
  const progressPct    = periodRows.length > 0 ? (paidCount / periodRows.length) * 100 : 0;

  return (
    <>
      {/* ── Print styles ─────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact; }
          .print-page { box-shadow: none !important; margin: 0 !important;
            border-radius: 0 !important; max-width: 100% !important; }
          @page { margin: 8mm; size: A4 portrait; }
        }
      `}</style>

      {/* ── Top action bar (no-print) ─────────────────────── */}
      <div className="no-print sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link
            to={`/bookings/${id}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
          >
            <ArrowLeft size={14} /> Back to Booking
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditSched(true)}
              className="flex items-center gap-2 bg-orange-50 hover:bg-orange-100 border border-orange-200
                         text-orange-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              <Pencil size={13} /> Edit Schedule
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700
                         px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              <Printer size={14} /> Print
            </button>
            <a
              href={pdfUrl(`/bookings/${id}/statement`)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-white px-4 py-2 rounded-lg
                         text-sm font-semibold shadow transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #0a1628)' }}
            >
              <Download size={14} /> Download PDF
            </a>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
           STATEMENT DOCUMENT
      ══════════════════════════════════════════════════════ */}
      <div className="print-page max-w-5xl mx-auto my-6 bg-white shadow-2xl rounded-2xl
                      overflow-hidden border border-gray-100">

        {/* ═══════════════ HEADER ═══════════════════════════ */}
        <div
          className="relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #050e1d 0%, #0a1e3d 50%, #0f2a4d 100%)' }}
        >
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),' +
                'linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          />

          <div className="relative px-8 pt-7 pb-5">
            <div className="flex items-start justify-between gap-6">
              {/* Company identity */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <img
                    src="/logo.png"
                    alt="Burooj"
                    className="h-10 w-auto object-contain"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                </div>
                <div>
                  <div className="text-white font-black text-xl tracking-[0.15em] uppercase">
                    Burooj Heights
                  </div>
                  <div className="text-blue-300 text-[11px] mt-0.5 tracking-wide">
                    Dream Housing, Raiwind Road, Lahore
                  </div>
                  <div className="text-blue-400 text-[10px] mt-0.5">
                    UAN: 0322-1786111 &nbsp;·&nbsp; www.buroojmarketing.com
                  </div>
                </div>
              </div>

              {/* Statement title */}
              <div className="text-right">
                <div
                  className="text-[10px] font-bold tracking-[0.3em] uppercase mb-1"
                  style={{ color: '#c9a84c' }}
                >
                  Official Document
                </div>
                <div className="text-white font-black text-3xl tracking-widest uppercase">
                  Account Statement
                </div>
                <div className="text-blue-300 text-[11px] mt-1.5 tracking-wide">
                  Statement Period: 01 Jan 2024 – Present
                </div>
                <div className="flex items-center justify-end gap-3 mt-2 text-[11px] text-blue-200">
                  <span>Date: {today}</span>
                  <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.2)' }} />
                  <span>Ref: <strong className="text-white">{b.booking_no || '—'}</strong></span>
                </div>
              </div>
            </div>

            {/* Gold accent line */}
            <div
              className="mt-6 h-px rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, #c9a84c 20%, #f0d080 50%, #c9a84c 80%, transparent 100%)',
              }}
            />
          </div>
        </div>

        {/* ═══════════════ BODY ═════════════════════════════ */}
        <div className="p-7 space-y-6">

          {/* ── 3-Metric summary strip ────────────────────── */}
          <div className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            {[
              {
                label: 'Total Sale Price',
                value: fmt(s.total_receivable),
                icon: <Building2 size={18} />,
                grad: 'linear-gradient(135deg, #1a3a6b, #0f2a4d)',
                sub: 'PKR',
              },
              {
                label: 'Total Received',
                value: fmt(s.total_received),
                icon: <CheckCircle2 size={18} />,
                grad: 'linear-gradient(135deg, #166534, #14532d)',
                sub: 'PKR',
              },
              {
                label: 'Outstanding Balance',
                value: fmt(s.total_outstanding),
                icon: s.total_outstanding > 0
                  ? <AlertCircle size={18} />
                  : <CheckCircle2 size={18} />,
                grad: s.total_outstanding > 0
                  ? 'linear-gradient(135deg, #991b1b, #7f1d1d)'
                  : 'linear-gradient(135deg, #166534, #14532d)',
                sub: 'PKR',
              },
            ].map(({ label, value, icon, grad, sub }, i) => (
              <div
                key={label}
                className="text-white px-6 py-5 flex items-center justify-between"
                style={{
                  background: grad,
                  borderRight: i < 2 ? '1px solid rgba(255,255,255,0.08)' : undefined,
                }}
              >
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">
                    {label}
                  </div>
                  <div className="text-2xl font-black mt-1 tracking-tight">
                    {value}
                  </div>
                  <div className="text-[10px] opacity-50 mt-0.5">{sub}</div>
                </div>
                <div className="opacity-30">{icon}</div>
              </div>
            ))}
          </div>

          {/* ── Client + Property cards ───────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Client card */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div
                className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100"
                style={{ background: 'linear-gradient(90deg, #f0f7ff 0%, #f8fbff 100%)' }}
              >
                <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
                  <User size={12} className="text-white" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-blue-800">
                  Client Information
                </span>
              </div>
              <div className="px-4 py-1">
                <InfoRow label="Customer Name" value={b.customer_name} />
                <InfoRow label="CNIC / NTN"    value={b.cnic} />
                <InfoRow label="Phone"         value={b.customer_phone} />
                <InfoRow label="Address"       value={b.address} />
              </div>
            </div>

            {/* Property card */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div
                className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100"
                style={{ background: 'linear-gradient(90deg, #f0f7ff 0%, #f8fbff 100%)' }}
              >
                <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
                  <Building2 size={12} className="text-white" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-blue-800">
                  Property & Booking
                </span>
              </div>
              <div className="px-4 py-1">
                <InfoRow
                  label="Project / Unit"
                  value={`${b.tower_name || 'Burooj Heights'} — Unit ${b.unit_number || '—'}`}
                />
                <InfoRow
                  label="Floor / Type"
                  value={`Floor ${fmtFloor(b.floor_no)} · ${unitTypeLabel(b.unit_type)} · ${b.size_sqft || '—'} sqft`}
                />
                <InfoRow label="Booking No"    value={b.booking_no} />
                <InfoRow
                  label="Payment Plan"
                  value={`${b.plan_name || '—'} — ${b.installment_months || 18} Months`}
                />
              </div>
            </div>
          </div>

          {/* ── Financial breakdown cards ─────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Down Payment',
                value: fmt(s.down_payment),
                sub: s.down_payment > 0
                  ? `${((s.down_payment / s.total_receivable) * 100).toFixed(0)}% of total`
                  : 'PKR',
                accent: '#2563eb',
                lightBg: '#eff6ff',
                textCls: 'text-blue-700',
              },
              ...(s.confirmation_amount > 0 ? [{
                label: 'Confirmation Payment',
                value: fmt(s.confirmation_amount),
                sub: `${((s.confirmation_amount / s.total_receivable) * 100).toFixed(0)}% of total`,
                accent: '#7c3aed',
                lightBg: '#f5f3ff',
                textCls: 'text-violet-700',
              }] : []),
              {
                label: 'Monthly Installment',
                value: fmt(s.monthly_installment),
                sub: `× ${b.installment_months || 18} months`,
                accent: '#0891b2',
                lightBg: '#ecfeff',
                textCls: 'text-cyan-700',
              },
              ...(s.balloon_payment_amount > 0 ? [{
                label: 'Balloon Payment',
                value: fmt(s.balloon_payment_amount),
                sub: `${((s.balloon_payment_amount / s.total_receivable) * 100).toFixed(0)}% of total`,
                accent: '#d97706',
                lightBg: '#fffbeb',
                textCls: 'text-amber-700',
              }] : []),
              ...(s.possession_amount > 0 ? [{
                label: 'On Possession',
                value: fmt(s.possession_amount),
                sub: `${((s.possession_amount / s.total_receivable) * 100).toFixed(0)}% of total`,
                accent: '#dc2626',
                lightBg: '#fef2f2',
                textCls: 'text-red-700',
              }] : []),
              {
                label: 'Plan Duration',
                value: `${b.installment_months || 18}`,
                sub: 'Months',
                accent: '#ea580c',
                lightBg: '#fff7ed',
                textCls: 'text-orange-700',
              },
              {
                label: 'Total Surcharge',
                value: fmt(s.total_surcharge || totalSurcharge),
                sub: 'PKR',
                accent: '#e11d48',
                lightBg: '#fff1f2',
                textCls: 'text-rose-700',
              },
            ].map(({ label, value, sub, accent, lightBg, textCls }) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 overflow-hidden shadow-sm"
              >
                <div className="h-1" style={{ background: accent }} />
                <div className="px-4 py-3 text-center" style={{ background: lightBg }}>
                  <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                    {label}
                  </div>
                  <div className={`text-lg font-black mt-1 ${textCls}`}>{value}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Progress bar ─────────────────────────────── */}
          <div
            className="rounded-xl border border-gray-200 p-4 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-600">
                Installment Progress
              </span>
              <span className="text-[11px] font-semibold text-gray-500">
                {paidCount} of {periodRows.length} installments paid
                &nbsp;·&nbsp;
                <span className="text-blue-600 font-bold">{Math.round(progressPct)}%</span>
              </span>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, #2563eb, #059669)',
                }}
              />
            </div>
            <div className="flex items-center gap-5 mt-3 flex-wrap">
              {[
                { icon: <CheckCircle2 size={11} className="text-green-500" />, label: `${paidCount} Paid`,    cls: 'text-green-700' },
                { icon: <Clock        size={11} className="text-amber-500" />, label: `${partialCount} Partial`,  cls: 'text-amber-700' },
                { icon: <AlertCircle  size={11} className="text-red-500"   />, label: `${overdueCount} Overdue`,  cls: 'text-red-700'   },
                { icon: <Clock        size={11} className="text-gray-400"  />, label: `${pendingCount} Pending`,  cls: 'text-gray-500'  },
              ].map(({ icon, label, cls }) => (
                <div key={label} className={`flex items-center gap-1.5 text-[11px] font-semibold ${cls}`}>
                  {icon} {label}
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════ PAYMENT SCHEDULE TABLE ════════ */}
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Table header bar */}
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ background: 'linear-gradient(135deg, #050e1d, #0f2a4d)' }}
            >
              <div className="flex items-center gap-2.5">
                <Calendar size={14} className="text-blue-300" />
                <span className="text-[11px] font-black text-white uppercase tracking-[0.25em]">
                  Payment Schedule
                </span>
              </div>
              <span className="text-[10px] text-blue-300 font-medium">
                Period: 01 January 2024 onwards
              </span>
            </div>

            {/* Column headers */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    {[
                      { h: '#',             cls: 'text-center w-10' },
                      { h: 'Payment Head',  cls: '' },
                      { h: 'Due Date',      cls: 'w-24' },
                      { h: 'Amount (PKR)',  cls: 'text-right w-28' },
                      { h: 'Payment Date',  cls: 'w-24' },
                      { h: 'Mode',          cls: 'w-20' },
                      { h: 'Receipt #',     cls: 'w-24' },
                      { h: 'Received (PKR)',cls: 'text-right w-28' },
                      { h: 'Outstanding',   cls: 'text-right w-28' },
                      { h: 'Status',        cls: 'text-center w-20' },
                    ].map(({ h, cls }) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 font-bold text-gray-400 text-[10px] uppercase
                                    tracking-wider whitespace-nowrap ${cls}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, idx) => {
                    const isOpening      = row.status       === 'opening';
                    const isConfirmation = row.payment_type === 'confirmation';
                    const isBalloon      = row.payment_type === 'balloon';
                    const isPossession   = row.payment_type === 'possession';
                    const isDownPayment  = row.payment_type === 'down_payment';

                    const rowCls = isOpening
                      ? 'bg-blue-50    border-l-4 border-l-blue-400'
                      : isConfirmation
                        ? 'bg-violet-50  border-l-4 border-l-violet-400'
                        : isBalloon
                          ? 'bg-amber-50   border-l-4 border-l-amber-400'
                          : isPossession
                            ? 'bg-red-50     border-l-4 border-l-red-400'
                            : isDownPayment
                              ? 'bg-emerald-50 border-l-4 border-l-emerald-400'
                              : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';

                    const headCls = isOpening
                      ? { main: 'font-black text-blue-700',    sub: 'text-blue-400'    }
                      : isConfirmation
                        ? { main: 'font-black text-violet-700',  sub: 'text-violet-400'  }
                        : isBalloon
                          ? { main: 'font-black text-amber-700',   sub: 'text-amber-400'   }
                          : isPossession
                            ? { main: 'font-black text-red-700',     sub: 'text-red-400'     }
                            : isDownPayment
                              ? { main: 'font-black text-emerald-700', sub: 'text-emerald-400' }
                              : { main: 'font-semibold text-gray-800', sub: 'text-gray-400'    };

                    return (
                      <tr
                        key={idx}
                        className={`group transition-colors ${rowCls} hover:bg-blue-50/40`}
                      >
                        {/* # */}
                        <td className="px-3 py-3 text-center">
                          {isOpening
                            ? <span className="text-[10px] text-blue-400 font-bold">B/F</span>
                            : isConfirmation
                              ? <span className="text-[10px] text-violet-500 font-bold">CNF</span>
                              : isBalloon
                                ? <span className="text-[10px] text-amber-500 font-bold">BAL</span>
                                : isPossession
                                  ? <span className="text-[10px] text-red-500 font-bold">POS</span>
                                  : isDownPayment
                                    ? <span className="text-[10px] text-emerald-600 font-bold">DP</span>
                                  : <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500
                                                     font-bold text-[10px] inline-flex items-center justify-center">
                                      {row.sr}
                                    </span>
                          }
                        </td>

                        {/* Payment Head */}
                        <td className="px-3 py-3">
                          {isOpening
                            ? <div>
                                <div className={`text-[11px] ${headCls.main}`}>Balance Brought Forward</div>
                                <div className={`text-[10px] ${headCls.sub}`}>Pre-period payments summary</div>
                              </div>
                            : <div>
                                <div className={`text-[11px] ${headCls.main}`}>{row.pay_head}</div>
                                {row.installment_no > 0 && row.payment_type === 'monthly' &&
                                  <div className={`text-[10px] ${headCls.sub}`}>Inst. #{row.installment_no}</div>}
                                {isPossession &&
                                  <div className={`text-[10px] ${headCls.sub}`}>Possession Payment</div>}
                              </div>
                          }
                        </td>

                        {/* Due Date */}
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                          {isOpening
                            ? <span className="font-bold text-blue-600">01 Jan 2024</span>
                            : fmtDate(row.due_date)
                          }
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-3 text-right font-bold text-gray-800">
                          {isOpening ? fmt(row.amount) : fmt(row.amount)}
                        </td>

                        {/* Payment Date */}
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                          {fmtDate(row.payment_date)}
                        </td>

                        {/* Mode */}
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                          {row.payment_mode
                            ? <span className="capitalize">{row.payment_mode}</span>
                            : '—'}
                        </td>

                        {/* Receipt */}
                        <td className="px-3 py-3 text-gray-400 font-mono text-[10px]">
                          {row.receipt_no || '—'}
                        </td>

                        {/* Received */}
                        <td className="px-3 py-3 text-right">
                          {row.received_amount > 0
                            ? <span className="font-bold text-emerald-600">
                                {fmt(row.received_amount)}
                              </span>
                            : <span className="text-gray-300 text-xs">—</span>
                          }
                        </td>

                        {/* Outstanding */}
                        <td className="px-3 py-3 text-right">
                          {row.outstanding > 0
                            ? <span className="font-bold text-red-500">
                                {fmt(row.outstanding)}
                              </span>
                            : <span className="text-emerald-500 font-bold text-sm">✓</span>
                          }
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3 text-center">
                          <Badge status={row.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals footer */}
                <tfoot>
                  <tr
                    className="text-white text-[11px] font-bold border-t-2 border-gray-600"
                    style={{ background: 'linear-gradient(135deg, #050e1d, #0f2a4d)' }}
                  >
                    <td />
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Hash size={10} className="opacity-60" />
                        <span className="uppercase tracking-widest text-[10px]">Grand Totals</span>
                      </div>
                    </td>
                    <td />
                    <td className="px-3 py-3.5 text-right tabular-nums">
                      {fmt(totalAmt)}
                    </td>
                    <td colSpan={3} />
                    <td className="px-3 py-3.5 text-right tabular-nums text-emerald-300">
                      {fmt(s.total_received)}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-yellow-300 text-sm font-black">
                      {fmt(s.total_outstanding)}
                    </td>
                    <td className="px-3 py-3.5 text-center text-blue-300 text-[10px]">
                      {periodRows.length} rows
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── Note box ─────────────────────────────────── */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <AlertCircle size={14} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              All outstanding amounts are payable on or before the due date.
              Late payments may incur a surcharge as per the booking agreement.
              For payment arrangements, contact Burooj Heights Accounts Department.
            </p>
          </div>

          {/* ═══════════════ SIGNATURE SECTION ═════════════ */}
          <div className="grid grid-cols-3 gap-10 pt-6 mt-4 border-t-2 border-dashed border-gray-200">
            {[
              { title: 'Client Signature',      name: b.customer_name },
              { title: 'Accounts Officer',       name: '' },
              { title: 'Authorized Signatory',   name: 'Burooj Heights' },
            ].map(({ title, name }) => (
              <div key={title} className="text-center">
                <div className="h-16 mb-3 relative">
                  <div className="absolute bottom-0 left-4 right-4 border-b-2 border-gray-800" />
                </div>
                <div className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-700">
                  {title}
                </div>
                {name && (
                  <div className="text-[10px] text-gray-400 mt-0.5 italic">{name}</div>
                )}
              </div>
            ))}
          </div>

          {/* ═══════════════ FOOTER ════════════════════════ */}
          <div
            className="rounded-xl text-center py-4 px-6 mt-2"
            style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-[0.25em] mb-1"
              style={{ color: '#c9a84c' }}
            >
              Burooj Heights — Official Statement
            </div>
            <div className="text-[11px] text-gray-500">
              This is a system-generated statement and does not require a physical signature.
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              5-6 Commercial, Main Boulevard Dream Housing, Raiwind Road, Lahore, Pakistan
              &nbsp;·&nbsp; UAN: 0322-1786111 &nbsp;·&nbsp; www.buroojmarketing.com
            </div>
          </div>

        </div>
      </div>

      <EditScheduleModal
        bookingId={id}
        bookingNo={b?.booking_no}
        open={editSched}
        onClose={() => setEditSched(false)}
      />
    </>
  );
}
