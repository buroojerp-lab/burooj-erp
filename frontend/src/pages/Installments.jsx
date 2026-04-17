// src/pages/Installments.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  CreditCard, Search, AlertTriangle, CheckCircle, Clock,
  X, Loader, MessageCircle, Download, Filter, DollarSign
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';

const STATUS_COLORS = {
  pending:  'bg-yellow-100 text-yellow-700',
  paid:     'bg-green-100 text-green-700',
  partial:  'bg-blue-100 text-blue-700',
  overdue:  'bg-red-100 text-red-700',
  waived:   'bg-gray-100 text-gray-600',
};

// ── Pay Modal ──
function PayModal({ installment, open, onClose }) {
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
      qc.invalidateQueries(['installments']);
      qc.invalidateQueries(['dashboard-stats']);
      reset();
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Payment failed'),
  });

  if (!open || !installment) return null;

  const balance = parseFloat(installment.amount) + parseFloat(installment.late_fee || 0) - parseFloat(installment.paid_amount || 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Record Payment</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {/* Installment Details */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Customer</p>
              <p className="font-semibold text-gray-800">{installment.customer_name}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Unit</p>
              <p className="font-semibold text-gray-800">{installment.unit_number}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Installment #</p>
              <p className="font-semibold text-gray-800">#{installment.installment_no}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Due Date</p>
              <p className="font-semibold text-gray-800">{fmtDate(installment.due_date)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Principal</p>
              <p className="font-semibold text-gray-800">{fmtPKR(installment.amount)}</p>
            </div>
            {installment.late_fee > 0 && (
              <div>
                <p className="text-gray-400 text-xs">Late Fee</p>
                <p className="font-semibold text-red-600">{fmtPKR(installment.late_fee)}</p>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Balance Due</span>
              <span className="text-lg font-bold text-gray-900">{fmtPKR(balance)}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit((d) => payMutation.mutate(d))} className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Payment Amount *
            </label>
            <input
              {...register('amount', { required: true, min: 1 })}
              type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Date</label>
              <input
                {...register('payment_date')}
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Method</label>
              <select
                {...register('payment_method')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
              >
                <option value="bank">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Reference No.
            </label>
            <input
              {...register('reference_no')}
              placeholder="Transaction / Reference number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Bank Name</label>
            <input
              {...register('bank_name')}
              placeholder="e.g. Meezan Bank"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
            <input
              {...register('notes')}
              placeholder="Optional notes..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={payMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {payMutation.isPending ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Installments Page ──
export default function Installments() {
  const [payTarget, setPayTarget] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['installments', { status, search, page }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: 25 });
      if (status) params.set('status', status);
      return (await api.get(`/installments?${params}`)).data;
    },
  });

  const sendWhatsApp = (inst) => {
    const phone = inst.customer_phone?.replace(/[^0-9]/g, '');
    if (!phone) { toast.error('No phone number'); return; }
    window.open(`https://wa.me/92${phone.replace(/^0/, '')}`, '_blank');
  };

  const allRows = data?.data || [];
  const rows = search
    ? allRows.filter(r =>
        r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.unit_number?.toLowerCase().includes(search.toLowerCase()) ||
        r.booking_no?.toLowerCase().includes(search.toLowerCase()))
    : allRows;
  const pg = data?.pagination || {};

  // Stats
  const stats = {
    total: pg.total || 0,
    overdue: rows.filter(r => r.status === 'overdue').length,
    pending: rows.filter(r => r.status === 'pending').length,
    paid: rows.filter(r => r.status === 'paid').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Installments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and collect installment payments</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <Download size={16} /> Export
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: pg.total, icon: CreditCard, color: 'blue' },
          { label: 'Overdue', value: rows.filter(r => r.status === 'overdue').length, icon: AlertTriangle, color: 'red' },
          { label: 'Pending', value: rows.filter(r => r.status === 'pending').length, icon: Clock, color: 'yellow' },
          { label: 'Paid', value: rows.filter(r => r.status === 'paid').length, icon: CheckCircle, color: 'green' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-lg bg-${s.color}-50`}>
              <s.icon size={20} className={`text-${s.color}-500`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value || 0}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-48">
          <Search size={15} className="text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customer..."
            className="text-sm border-none outline-none"
          />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white">
          {['', 'pending', 'overdue', 'partial', 'paid'].map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-4 py-2 text-sm font-medium transition ${status === s ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Customer', 'Unit', 'Booking', 'Inst #', 'Due Date', 'Amount', 'Late Fee', 'Paid', 'Balance', 'Status', 'Days OD', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(12).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center">
                    <CreditCard size={40} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400">No installments found</p>
                  </td>
                </tr>
              ) : (
                rows.map((inst) => {
                  const balance = parseFloat(inst.amount) + parseFloat(inst.late_fee || 0) - parseFloat(inst.paid_amount || 0);
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{inst.customer_name}</div>
                        <div className="text-xs text-gray-400">{inst.customer_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{inst.unit_number}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{inst.booking_no}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">#{inst.installment_no}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(inst.due_date)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{fmtPKR(inst.amount)}</td>
                      <td className="px-4 py-3 text-red-600 whitespace-nowrap">
                        {inst.late_fee > 0 ? fmtPKR(inst.late_fee) : '—'}
                      </td>
                      <td className="px-4 py-3 text-green-600 whitespace-nowrap">
                        {inst.paid_amount > 0 ? fmtPKR(inst.paid_amount) : '—'}
                      </td>
                      <td className="px-4 py-3 font-bold whitespace-nowrap" style={{ color: balance > 0 ? '#dc2626' : '#059669' }}>
                        {fmtPKR(balance)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inst.status] || ''}`}>
                          {inst.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {parseInt(inst.days_overdue) > 0
                          ? <span className="text-red-500 font-medium">{inst.days_overdue}d</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {inst.status !== 'paid' && (
                            <button
                              onClick={() => setPayTarget(inst)}
                              className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition text-xs font-medium px-2"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => sendWhatsApp(inst)}
                            className="p-1.5 rounded-lg hover:bg-green-100 text-gray-400 hover:text-green-600 transition"
                            title="Send WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pg.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {(pg.page - 1) * pg.limit + 1}–{Math.min(pg.page * pg.limit, pg.total)} of {pg.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(pg.pages, p + 1))}
                disabled={page === pg.pages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pay Modal */}
      <PayModal
        installment={payTarget}
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
      />
    </div>
  );
}
