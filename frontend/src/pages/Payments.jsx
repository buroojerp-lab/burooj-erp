// src/pages/Payments.jsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Search, Download, TrendingUp, Calendar, FileText } from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';
import { pdfUrl } from '../utils/pdfUrl';

export default function Payments() {
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', { search, method, page }],
    queryFn: async () => {
      const p = new URLSearchParams({ page, limit: 25 });
      if (method) p.set('payment_method', method);
      return (await api.get(`/payments?${p}`)).data;
    },
  });

  const allPayments = data?.data || [];
  const payments = search
    ? allPayments.filter(p =>
        p.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.booking_no?.toLowerCase().includes(search.toLowerCase()) ||
        p.unit_number?.toLowerCase().includes(search.toLowerCase()) ||
        p.reference_no?.toLowerCase().includes(search.toLowerCase()))
    : allPayments;
  const pg = data?.pagination || {};
  const totalAmt = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">All received payments record</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <Download size={16} /> Export
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { l: 'Total Payments', v: pg.total || 0, icon: DollarSign, cls: 'bg-blue-50 text-blue-500' },
          { l: 'Total Amount', v: fmtPKR(totalAmt), icon: TrendingUp, cls: 'bg-green-50 text-green-500' },
          { l: 'This Month', v: payments.filter(p => new Date(p.payment_date) >= new Date(new Date().setDate(1))).length, icon: Calendar, cls: 'bg-orange-50 text-orange-500' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-lg ${s.cls}`}><s.icon size={20} /></div>
            <div><p className="text-xl font-bold text-gray-900">{s.v}</p><p className="text-xs text-gray-400">{s.l}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <Search size={15} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="text-sm border-none outline-none flex-1" />
        </div>
        <select value={method} onChange={e => setMethod(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-400">
          <option value="">All Methods</option>
          <option value="bank">Bank Transfer</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
          <option value="cheque">Cheque</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Customer', 'Unit', 'Booking No', 'Amount', 'Method', 'Reference', 'Bank', 'Date', 'Recorded By', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>{Array(9).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
              )) : payments.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-16 text-center">
                  <DollarSign size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">No payments recorded yet</p>
                </td></tr>
              ) : payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.customer_name}</td>
                  <td className="px-4 py-3 text-gray-700">{p.unit_number}</td>
                  <td className="px-4 py-3 font-mono text-xs text-orange-500">{p.booking_no}</td>
                  <td className="px-4 py-3 font-bold text-green-700 whitespace-nowrap">{fmtPKR(p.amount)}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">{p.payment_method}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.reference_no || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.bank_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.recorded_by || '—'}</td>
                  <td className="px-4 py-3">
                    <a href={pdfUrl(`/payments/${p.id}/receipt`)} target="_blank" rel="noreferrer"
                      title="Download Receipt"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 text-xs font-medium transition">
                      <FileText size={12} /> Receipt
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pg.pages > 1 && (
          <div className="flex justify-between items-center px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">{pg.total} payments</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p => Math.min(pg.pages,p+1))} disabled={page===pg.pages} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
