// src/pages/BookingDetail.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Download, FileText, CreditCard, User,
  Building2, CheckCircle, Clock, AlertTriangle,
  MessageCircle, Printer, Edit2, MapPin, Calendar, BarChart2,
  X, Loader, DollarSign, Pencil
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';
import { pdfUrl } from '../utils/pdfUrl';
import EditScheduleModal from '../components/EditScheduleModal';

const STATUS_CLS = {
  pending:  'bg-yellow-100 text-yellow-700',
  paid:     'bg-green-100  text-green-700',
  partial:  'bg-blue-100   text-blue-700',
  overdue:  'bg-red-100    text-red-700',
  waived:   'bg-gray-100   text-gray-600',
};

// ── Inline Pay Modal ──
function PayModal({ installment, bookingId, open, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank',
      amount: installment?.amount,
    },
  });

  const payMutation = useMutation({
    mutationFn: (data) => api.post(`/installments/${installment.id}/pay`, data),
    onSuccess: (res) => {
      toast.success(`Payment recorded! Status: ${res.data.status}`);
      qc.invalidateQueries(['booking', bookingId]);
      qc.invalidateQueries(['installments', { booking_id: bookingId }]);
      reset();
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Payment failed'),
  });

  if (!open || !installment) return null;

  const balance = parseFloat(installment.amount) + parseFloat(installment.late_fee || 0) - parseFloat(installment.paid_amount || 0);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">

        {/* Header — fixed */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Record Payment</h2>
            <p className="text-xs text-gray-400 mt-0.5">Installment #{installment.installment_no}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition">
            <X size={18} />
          </button>
        </div>

        {/* Summary strip — fixed */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-100 flex-shrink-0">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-gray-400 font-medium">Due Date</p>
              <p className="font-bold text-gray-800 mt-0.5">{fmtDate(installment.due_date)}</p>
            </div>
            <div>
              <p className="text-gray-400 font-medium">Installment</p>
              <p className="font-bold text-gray-800 mt-0.5">{fmtPKR(installment.amount)}</p>
            </div>
            {installment.late_fee > 0 && (
              <div>
                <p className="text-gray-400 font-medium">Late Fee</p>
                <p className="font-bold text-red-600 mt-0.5">{fmtPKR(installment.late_fee)}</p>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
            <span className="text-sm text-gray-600 font-medium">Balance Due</span>
            <span className="text-xl font-black text-gray-900">{fmtPKR(balance)}</span>
          </div>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto">
          <form
            id="pay-form"
            onSubmit={handleSubmit(d => payMutation.mutate(d))}
            className="px-5 py-4 space-y-4"
          >
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Payment Amount <span className="text-red-400">*</span>
              </label>
              <input
                {...register('amount', { required: true, min: 1 })}
                type="number"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 font-semibold"
              />
              {errors.amount && <p className="text-red-500 text-xs mt-1">Amount required</p>}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Payment Method <span className="text-red-400">*</span>
              </label>
              <select
                {...register('payment_method', { required: true })}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 bg-white"
              >
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="online">Online / JazzCash / EasyPaisa</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Reference No.
                </label>
                <input
                  {...register('reference_no')}
                  placeholder="Optional"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Payment Date
                </label>
                <input
                  {...register('payment_date')}
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Action buttons — fixed at bottom */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pay-form"
            disabled={payMutation.isPending}
            className="flex-2 flex-grow bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition shadow-sm"
          >
            {payMutation.isPending
              ? <Loader size={16} className="animate-spin" />
              : <DollarSign size={16} />
            }
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BookingDetail() {
  const { id } = useParams();
  const [payTarget, setPayTarget] = useState(null);
  const [editSched, setEditSched] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
  });

  const { data: instData } = useQuery({
    queryKey: ['installments', { booking_id: id }],
    queryFn: () => api.get(`/installments?booking_id=${id}&limit=100`).then(r => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: (status) => api.put(`/bookings/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries(['booking', id]); toast.success('Status updated!'); },
  });

  if (isLoading) return (
    <div className="p-6 space-y-4">
      {Array(4).fill(0).map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  const { booking: b, installmentSummary: sm } = data || {};
  if (!b) return <div className="p-6 text-gray-400">Booking not found</div>;

  const installments = instData?.data || [];
  const paidPct = sm?.total > 0 ? Math.round((parseInt(sm?.paid_count || 0) / parseInt(sm?.total || 1)) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/bookings" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{b.booking_no}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                b.status === 'active' ? 'bg-green-100 text-green-700' :
                b.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>{b.status}</span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">Booked on {fmtDate(b.booking_date)}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <a href={pdfUrl(`/bookings/${id}/agreement`)} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download size={16} /> Agreement
          </a>
          <a href={pdfUrl(`/bookings/${id}/allotment`)} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 rounded-lg text-sm text-blue-600 hover:bg-blue-100">
            <FileText size={16} /> Allotment Letter
          </a>
          <a href={pdfUrl(`/bookings/${id}/booking-form`)} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-purple-200 bg-purple-50 rounded-lg text-sm text-purple-600 hover:bg-purple-100">
            <Printer size={16} /> Booking Form
          </a>
          <Link to={`/bookings/${id}/statement-view`}
            className="flex items-center gap-2 px-4 py-2 border border-teal-200 bg-teal-50 rounded-lg text-sm text-teal-600 hover:bg-teal-100">
            <BarChart2 size={16} /> View Statement
          </Link>
          <a href={pdfUrl(`/bookings/${id}/statement`)} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-green-200 bg-green-50 rounded-lg text-sm text-green-600 hover:bg-green-100">
            <BarChart2 size={16} /> Statement PDF
          </a>
          {b.status === 'pending' && (
            <button onClick={() => statusMutation.mutate('active')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
              <CheckCircle size={16} /> Confirm Booking
            </button>
          )}
          {b.status === 'active' && (
            <button onClick={() => { if (window.confirm('Cancel this booking?')) statusMutation.mutate('cancelled'); }}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-medium">
              Cancel Booking
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <User size={16} className="text-orange-500" /> Customer
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg">
              {b.customer_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <Link to={`/customers/${b.customer_id}`} className="font-bold text-gray-900 hover:text-orange-500">
                {b.customer_name}
              </Link>
              <div className="text-xs text-gray-400">CNIC: {b.cnic}</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-gray-400">📞</span> {b.customer_phone}
            </div>
            {b.address && (
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" /> {b.address}
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400">Agent</div>
            <div className="font-medium text-gray-700 mt-0.5">{b.agent_name || 'Direct Sale'}</div>
          </div>
        </div>

        {/* Unit Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Building2 size={16} className="text-orange-500" /> Unit Details
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Unit Number', value: b.unit_number },
              { label: 'Tower',       value: b.tower_name },
              { label: 'Floor',       value: `Floor ${b.floor_no}` },
              { label: 'Type',        value: b.unit_type },
              { label: 'Size',        value: `${parseFloat(b.size_sqft).toLocaleString()} sqft` },
              { label: 'Plan',        value: b.plan_name },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{r.label}</span>
                <span className="font-medium text-gray-800">{r.value || '—'}</span>
              </div>
            ))}
          </div>
          <Link to={`/properties/units/${b.unit_id}`}
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
            View Unit Details
          </Link>
        </div>

        {/* Payment Summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-orange-500" /> Payment Summary
          </h2>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Total Price',     value: fmtPKR(b.total_price),             cls: '' },
              { label: 'Discount',        value: `- ${fmtPKR(b.discount_amount)}`,  cls: 'text-red-600', hide: !b.discount_amount },
              { label: 'Final Price',     value: fmtPKR(b.final_price),             cls: 'font-bold' },
              { label: 'Down Payment',    value: fmtPKR(b.down_payment_amount),    cls: 'text-green-700'  },
              { label: 'Confirmation',    value: fmtPKR(b.confirmation_amount),    cls: 'text-violet-700', hide: !b.confirmation_amount },
              { label: 'Monthly Inst.',   value: b.monthly_installment > 0 ? fmtPKR(b.monthly_installment) : 'N/A', cls: 'text-blue-700' },
              { label: 'Balloon Payment', value: fmtPKR(b.balloon_payment_amount), cls: 'text-amber-700',  hide: !b.balloon_payment_amount },
              { label: 'On Possession',   value: fmtPKR(b.possession_amount),      cls: 'text-red-700',    hide: !b.possession_amount },
            ].filter(r => !r.hide).map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-gray-400">{r.label}</span>
                <span className={`font-medium ${r.cls}`}>{r.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Collected</span>
              <span className="font-bold text-green-700">{fmtPKR(sm?.total_paid || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Remaining</span>
              <span className="font-bold text-red-600">{fmtPKR(sm?.total_remaining || 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Late Fees</span>
              <span className="font-medium text-orange-600">{fmtPKR(sm?.total_late_fees || 0)}</span>
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Payment Progress</span>
              <span>{sm?.paid_count || 0} / {sm?.total || 0} installments</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all"
                style={{ width: `${paidPct}%` }} />
            </div>
            <div className="text-right text-xs text-orange-500 font-semibold mt-1">{paidPct}%</div>
          </div>
        </div>
      </div>

      {/* Installment Schedule */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Calendar size={16} className="text-orange-500" />
            Installment Schedule
          </h2>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{sm?.paid_count || 0} Paid</span>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">{parseInt(sm?.total || 0) - parseInt(sm?.paid_count || 0)} Remaining</span>
            <button
              onClick={() => setEditSched(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 rounded-lg text-xs font-semibold transition"
            >
              <Pencil size={12} /> Customize
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['#', 'Due Date', 'Amount', 'Late Fee', 'Paid', 'Balance', 'Status', 'Paid On', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {installments.map(inst => {
                const balance = parseFloat(inst.amount) + parseFloat(inst.late_fee || 0) - parseFloat(inst.paid_amount || 0);
                const isOverdue = inst.status === 'overdue' || (inst.status !== 'paid' && new Date(inst.due_date) < new Date());
                return (
                  <tr key={inst.id} className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-gray-500 text-xs">#{inst.installment_no}</td>
                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{fmtDate(inst.due_date)}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{fmtPKR(inst.amount)}</td>
                    <td className="px-4 py-2.5 text-red-600 whitespace-nowrap">{inst.late_fee > 0 ? fmtPKR(inst.late_fee) : '—'}</td>
                    <td className="px-4 py-2.5 text-green-600 whitespace-nowrap">{inst.paid_amount > 0 ? fmtPKR(inst.paid_amount) : '—'}</td>
                    <td className="px-4 py-2.5 font-bold whitespace-nowrap" style={{ color: balance > 0 ? '#dc2626' : '#059669' }}>
                      {fmtPKR(balance)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[inst.status] || ''}`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{inst.paid_date ? fmtDate(inst.paid_date) : '—'}</td>
                    <td className="px-4 py-2.5">
                      {inst.status !== 'paid' && (
                        <button
                          onClick={() => setPayTarget(inst)}
                          className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-medium transition">
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Original Physical Booking Form */}
      {b.booking_form_url && (() => {
        const assetBase = window.location.port === '3000'
          ? window.location.origin.replace(':3000', ':5001')
          : window.location.origin;
        const src = `${assetBase}${b.booking_form_url}`;
        return (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <FileText size={16} className="text-orange-500" />
              <h2 className="font-semibold text-gray-800">Original Booking Form</h2>
              <span className="ml-auto text-xs text-gray-400">Scanned physical copy</span>
            </div>
            <div className="p-5 flex items-start gap-5">
              <img
                src={src}
                alt="Original booking form"
                className="w-40 h-56 object-cover rounded-xl border border-gray-200 shadow cursor-pointer hover:opacity-90 transition"
                onClick={() => window.open(src, '_blank')}
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div>
                <p className="text-sm font-medium text-gray-800 mb-1">Physical form on file</p>
                <p className="text-sm text-gray-500 mb-3">The original signed booking form submitted by the customer.</p>
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition"
                >
                  <Download size={14} /> View Full Form
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      <PayModal
        installment={payTarget}
        bookingId={id}
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
      />

      <EditScheduleModal
        bookingId={id}
        bookingNo={b?.booking_no}
        open={editSched}
        onClose={() => setEditSched(false)}
      />
    </div>
  );
}
