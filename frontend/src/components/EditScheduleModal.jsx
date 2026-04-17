// components/EditScheduleModal.jsx — Customize per-booking installment schedule
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  X, Plus, Trash2, Loader, Save,
  AlertTriangle, Lock, Pencil,
} from 'lucide-react';
import api from '../utils/api';

const TYPES = [
  { value: 'monthly',      label: 'Monthly Installment' },
  { value: 'down_payment', label: 'Down Payment'        },
  { value: 'confirmation', label: 'Confirmation'        },
  { value: 'balloon',      label: 'Balloon Payment'     },
  { value: 'possession',   label: 'On Possession'       },
  { value: 'custom',       label: 'Custom Payment'      },
];

const TYPE_COLORS = {
  down_payment: 'text-emerald-700 bg-emerald-50',
  confirmation: 'text-violet-700 bg-violet-50',
  balloon:      'text-amber-700  bg-amber-50',
  possession:   'text-red-700    bg-red-50',
  monthly:      'text-blue-700   bg-blue-50',
  custom:       'text-gray-700   bg-gray-100',
};

const STATUS_CLS = {
  pending: 'bg-gray-100  text-gray-600',
  paid:    'bg-green-100 text-green-700',
  partial: 'bg-blue-100  text-blue-700',
  overdue: 'bg-red-100   text-red-700',
};

const fmtPKR = (n) =>
  (parseFloat(n) || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });

const nextMonth = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
};

export default function EditScheduleModal({ bookingId, bookingNo, open, onClose }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['installments-edit', bookingId],
    queryFn: () =>
      api.get(`/installments?booking_id=${bookingId}&limit=200`).then((r) => r.data),
    enabled: open && !!bookingId,
  });

  useEffect(() => {
    if (data?.data) {
      setRows(
        data.data.map((i) => ({
          id:             i.id,
          installment_no: i.installment_no,
          payment_type:   i.payment_type || 'monthly',
          due_date:       (i.due_date || '').split('T')[0],
          amount:         String(Math.round(parseFloat(i.amount || 0))),
          status:         i.status,
          paid_amount:    parseFloat(i.paid_amount || 0),
          _delete:        false,
        }))
      );
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/bookings/${bookingId}/reschedule`, { rows }),
    onSuccess: () => {
      toast.success('Payment schedule updated!');
      qc.invalidateQueries(['installments', { booking_id: bookingId }]);
      qc.invalidateQueries(['statement-data', bookingId]);
      qc.invalidateQueries(['booking', bookingId]);
      setDirty(false);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Save failed'),
  });

  const update = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  const markDelete = (idx) => {
    const row = rows[idx];
    if (row.id) {
      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, _delete: true } : r)));
    } else {
      setRows((prev) => prev.filter((_, i) => i !== idx));
    }
    setDirty(true);
  };

  const addRow = () => {
    const lastVisible = rows.filter((r) => !r._delete).slice(-1)[0];
    setRows((prev) => [
      ...prev,
      {
        id:             null,
        installment_no: null,
        payment_type:   'monthly',
        due_date:       nextMonth(lastVisible?.due_date),
        amount:         '',
        status:         'pending',
        paid_amount:    0,
        _delete:        false,
      },
    ]);
    setDirty(true);
  };

  const visible = rows.filter((r) => !r._delete);
  const totalAmt = visible.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <Pencil size={16} className="text-orange-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Customize Payment Schedule</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {bookingNo} — edit unpaid installments, adjust amounts & dates, add custom entries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Warning ── */}
        <div className="mx-6 mt-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex-shrink-0">
          <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Paid installments are locked</strong> — only pending / overdue entries can be edited or deleted.
            Changes reflect immediately in the statement and reminders.
          </p>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader size={28} className="animate-spin text-orange-400" />
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="border-b-2 border-gray-200">
                  {['#', 'Payment Type', 'Due Date', 'Amount (PKR)', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-left
                        ${h === 'Amount (PKR)' ? 'text-right' : ''}
                        ${h === '' ? 'w-10' : ''}
                        ${h === '#' ? 'w-10' : ''}
                        ${h === 'Status' ? 'text-center w-24' : ''}
                      `}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visible.map((row, idx) => {
                  const isPaid     = row.status === 'paid';
                  const isPartial  = row.status === 'partial';
                  const canEdit    = !isPaid;
                  const canDelete  = row.status === 'pending' && row.paid_amount === 0;
                  const typeMeta   = TYPE_COLORS[row.payment_type] || TYPE_COLORS.custom;

                  return (
                    <tr
                      key={row.id || `new-${idx}`}
                      className={`transition-colors ${
                        isPaid
                          ? 'bg-gray-50/60 opacity-60'
                          : 'hover:bg-orange-50/20'
                      }`}
                    >
                      {/* # */}
                      <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">
                        {row.installment_no != null
                          ? <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold text-[10px] inline-flex items-center justify-center">{row.installment_no}</span>
                          : <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">NEW</span>
                        }
                      </td>

                      {/* Type */}
                      <td className="px-3 py-2.5">
                        {canEdit ? (
                          <select
                            value={row.payment_type}
                            onChange={(e) => update(idx, 'payment_type', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400 bg-white"
                          >
                            {TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeMeta}`}>
                            {TYPES.find((t) => t.value === row.payment_type)?.label || row.payment_type}
                          </span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="px-3 py-2.5">
                        {canEdit ? (
                          <input
                            type="date"
                            value={row.due_date}
                            onChange={(e) => update(idx, 'due_date', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400 w-36"
                          />
                        ) : (
                          <span className="text-xs text-gray-600">{row.due_date}</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-3 py-2.5 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            value={row.amount}
                            min={0}
                            onChange={(e) => update(idx, 'amount', e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:border-orange-400 w-32"
                          />
                        ) : (
                          <span className="text-xs font-bold text-gray-800">{fmtPKR(row.amount)}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLS[row.status] || STATUS_CLS.pending}`}>
                          {isPaid && <Lock size={8} />}
                          {row.status}
                        </span>
                      </td>

                      {/* Delete */}
                      <td className="px-3 py-2.5 text-center">
                        {canDelete ? (
                          <button
                            onClick={() => markDelete(idx)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition"
                            title="Remove installment"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <span className="w-6 h-6 inline-block" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals row */}
              <tfoot>
                <tr className="bg-gray-800 text-white text-xs font-bold">
                  <td colSpan={3} className="px-3 py-3 text-right uppercase tracking-wider text-gray-400 text-[10px]">
                    Schedule Total
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-orange-300 text-sm">
                    {fmtPKR(totalAmt)}
                  </td>
                  <td colSpan={2} className="px-3 py-3 text-center text-gray-500 text-[10px]">
                    {visible.length} installments
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* ── Add Row ── */}
        <div className="px-6 py-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-orange-300 text-orange-600 rounded-xl text-sm hover:bg-orange-50 transition font-medium"
          >
            <Plus size={14} /> Add Custom Installment
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <div className="text-xs text-gray-500">
            {visible.length} active installments · Total: <strong className="text-gray-800">PKR {fmtPKR(totalAmt)}</strong>
            {dirty && (
              <span className="ml-3 text-orange-600 font-semibold animate-pulse">● Unsaved changes</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-orange-500 hover:bg-orange-600
                         text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition shadow-sm"
            >
              {saveMutation.isPending
                ? <Loader size={14} className="animate-spin" />
                : <Save size={14} />
              }
              Save Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
