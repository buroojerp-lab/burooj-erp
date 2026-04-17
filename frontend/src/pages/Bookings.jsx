// src/pages/Bookings.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Search, Download, Eye, CheckCircle,
  Clock, XCircle, AlertTriangle, MoreVertical, TrendingUp
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   cls: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-100   text-blue-700'   },
  active:    { label: 'Active',    cls: 'bg-green-100  text-green-700'  },
  completed: { label: 'Completed', cls: 'bg-gray-100   text-gray-600'   },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100    text-red-700'    },
};

export default function Bookings() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', { status, search, page }],
    queryFn: async () => {
      const p = new URLSearchParams({ page, limit: 20 });
      if (status) p.set('status', status);
      return (await api.get(`/bookings?${p}`)).data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => api.put(`/bookings/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries(['bookings']); toast.success('Status updated'); },
  });

  const allBookings = data?.data || [];
  const bookings = search
    ? allBookings.filter(b =>
        b.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        b.booking_no?.toLowerCase().includes(search.toLowerCase()) ||
        b.unit_number?.toLowerCase().includes(search.toLowerCase()) ||
        b.cnic?.toLowerCase().includes(search.toLowerCase()))
    : allBookings;
  const pg = data?.pagination || {};

  const stats = [
    { label: 'Total',     value: pg.total || 0,                                               icon: FileText,     cls: 'bg-blue-50   text-blue-500'   },
    { label: 'Active',    value: bookings.filter(b => b.status === 'active').length,           icon: CheckCircle,  cls: 'bg-green-50  text-green-500'  },
    { label: 'Pending',   value: bookings.filter(b => b.status === 'pending').length,          icon: Clock,        cls: 'bg-yellow-50 text-yellow-500' },
    { label: 'Cancelled', value: bookings.filter(b => b.status === 'cancelled').length,        icon: XCircle,      cls: 'bg-red-50    text-red-500'    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500 mt-0.5">All property bookings and agreements</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download size={16} /> Export
          </button>
          <Link to="/bookings/new"
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
            <Plus size={16} /> New Booking
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-lg ${s.cls}`}><s.icon size={20} /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 min-w-52">
          <Search size={15} className="text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search booking no or customer..."
            className="text-sm border-none outline-none flex-1" />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white">
          {['', 'pending', 'confirmed', 'active', 'completed', 'cancelled'].map(s => (
            <button key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-2 text-xs font-semibold capitalize transition ${status === s ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
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
                {['Booking No', 'Customer', 'Unit', 'Floor / Tower', 'Total Price', 'Down Payment', 'Monthly', 'Date', 'Progress', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>{Array(11).fill(0).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              )) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center">
                    <FileText size={48} className="text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-400 font-medium">No bookings found</p>
                    <Link to="/bookings/new"
                      className="mt-3 inline-block px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">
                      Create First Booking
                    </Link>
                  </td>
                </tr>
              ) : bookings.map(b => {
                const paidPct = b.total_count > 0 ? Math.round((b.paid_count / b.total_count) * 100) : 0;
                const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/bookings/${b.id}`} className="font-bold text-orange-500 hover:text-orange-600 font-mono text-xs">
                        {b.booking_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">{b.customer_name}</div>
                      <div className="text-xs text-gray-400">{b.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{b.unit_number}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{b.tower_name} · Floor {b.floor_no}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{fmtPKR(b.final_price)}</td>
                    <td className="px-4 py-3 text-green-700 font-medium whitespace-nowrap">{fmtPKR(b.down_payment_amount)}</td>
                    <td className="px-4 py-3 text-blue-700 whitespace-nowrap">
                      {b.monthly_installment > 0 ? fmtPKR(b.monthly_installment) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(b.booking_date)}</td>
                    <td className="px-4 py-3 min-w-24">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${paidPct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{b.paid_count}/{b.total_count}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link to={`/bookings/${b.id}`}
                          className="p-1.5 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition">
                          <Eye size={14} />
                        </Link>
                        <a href={`/api/v1/bookings/${b.id}/agreement`} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-orange-100 text-gray-400 hover:text-orange-600 transition"
                          title="Download Agreement">
                          <Download size={14} />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pg.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">{pg.total} bookings</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <button onClick={() => setPage(p => Math.min(pg.pages, p + 1))} disabled={page === pg.pages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
