// src/pages/Investors.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Building, TrendingUp, DollarSign, Calendar, Percent, Plus, X, Loader, Pencil } from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';

const INVESTOR_FIELDS = [
  { name: 'name',               label: 'Full Name *',          type: 'text',   req: true,  col: 2 },
  { name: 'email',              label: 'Email *',              type: 'email',  req: true,  col: 1 },
  { name: 'phone',              label: 'Phone *',              type: 'tel',    req: true,  col: 1 },
  { name: 'cnic',               label: 'CNIC',                 type: 'text',   req: false, col: 1 },
  { name: 'investment_amount',  label: 'Investment (PKR) *',   type: 'number', req: true,  col: 1 },
  { name: 'rental_return_pct',  label: 'Return Rate (%)',      type: 'number', req: false, col: 1 },
  { name: 'investment_date',    label: 'Investment Date',      type: 'date',   req: false, col: 1 },
];

function InvestorForm({ defaultValues, onSubmit, isPending, onClose, submitLabel }) {
  const { register, handleSubmit } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {INVESTOR_FIELDS.map(f => (
          <div key={f.name} className={f.col === 2 ? 'col-span-2' : ''}>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{f.label}</label>
            <input {...register(f.name, { required: f.req })} type={f.type} step={f.type === 'number' ? '0.01' : undefined}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
        <button type="submit" disabled={isPending}
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          {isPending && <Loader size={16} className="animate-spin" />} {submitLabel}
        </button>
      </div>
    </form>
  );
}

function AddInvestorModal({ onClose }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (d) => api.post('/investors', d),
    onSuccess: () => { toast.success('Investor added!'); qc.invalidateQueries(['investors']); onClose(); },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Add New Investor</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <InvestorForm defaultValues={{ rental_return_pct: 12 }} onSubmit={mutation.mutate} isPending={mutation.isPending} onClose={onClose} submitLabel="Add Investor" />
      </div>
    </div>
  );
}

function EditInvestorModal({ investor, onClose }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (d) => api.put(`/investors/${investor.id}`, d),
    onSuccess: () => { toast.success('Investor updated!'); qc.invalidateQueries(['investors']); onClose(); },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Edit Investor — {investor.name}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <InvestorForm
          defaultValues={{ name: investor.name, email: investor.email, phone: investor.phone, cnic: investor.cnic, investment_amount: investor.investment_amount, rental_return_pct: investor.rental_return_pct, investment_date: investor.investment_date?.slice(0, 10) }}
          onSubmit={mutation.mutate} isPending={mutation.isPending} onClose={onClose} submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}

export default function Investors() {
  const [showAdd, setShowAdd] = useState(false);
  const [editInvestor, setEditInvestor] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['investors'],
    queryFn: () => api.get('/investors?limit=50').then(r => r.data),
  });

  const investors = data?.data || [];
  const totalInvestment = investors.reduce((s, i) => s + parseFloat(i.investment_amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investor Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Investment portfolio and returns</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> Add Investor
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { l: 'Total Investors', v: investors.length, icon: Building, cls: 'bg-blue-50 text-blue-500' },
          { l: 'Total Investment', v: fmtPKR(totalInvestment), icon: TrendingUp, cls: 'bg-green-50 text-green-500' },
          { l: 'Avg Return Rate', v: `${investors.length ? (investors.reduce((s,i) => s + parseFloat(i.rental_return_pct||0), 0) / investors.length).toFixed(1) : 0}%`, icon: Percent, cls: 'bg-orange-50 text-orange-500' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-lg ${s.cls}`}><s.icon size={20} /></div>
            <div><p className="text-xl font-bold text-gray-900">{s.v}</p><p className="text-xs text-gray-400">{s.l}</p></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-800">Investor Portfolios</h2></div>
        {isLoading ? (
          <div className="p-6 space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>
        ) : investors.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Building size={40} className="mx-auto mb-3 text-gray-200" />
            <p>No investors registered yet</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">Add First Investor</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Investor', 'Code', 'Investment', 'Return Rate', 'Monthly Return', 'Since', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {investors.map(inv => {
                const monthly = (parseFloat(inv.investment_amount) * parseFloat(inv.rental_return_pct) / 100) / 12;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">{inv.name?.[0]}</div>
                        <div><div className="font-medium text-gray-900">{inv.name}</div><div className="text-xs text-gray-400">{inv.phone}</div></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-500">{inv.investor_code}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{fmtPKR(inv.investment_amount)}</td>
                    <td className="px-4 py-3 text-green-600 font-semibold">{inv.rental_return_pct}%</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">{fmtPKR(monthly)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(inv.investment_date)}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{inv.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEditInvestor(inv)} className="p-1.5 rounded-lg hover:bg-orange-100 text-gray-400 hover:text-orange-500 transition">
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AddInvestorModal onClose={() => setShowAdd(false)} />}
      {editInvestor && <EditInvestorModal investor={editInvestor} onClose={() => setEditInvestor(null)} />}
    </div>
  );
}
