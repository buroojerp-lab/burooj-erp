// src/pages/Agents.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { UserCheck, Plus, Search, TrendingUp, DollarSign, Star, X, Loader, Pencil } from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';

function AddAgentModal({ open, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm({ defaultValues: { commission_rate: 2.5 } });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/agents', d),
    onSuccess: () => { toast.success('Agent added!'); qc.invalidateQueries(['agents']); reset(); onClose(); },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Add New Agent</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'name',            label: 'Full Name *',          type: 'text',   req: true,  col: 2 },
              { name: 'email',           label: 'Email *',              type: 'email',  req: true,  col: 1 },
              { name: 'phone',           label: 'Phone *',              type: 'tel',    req: true,  col: 1 },
              { name: 'cnic',            label: 'CNIC',                 type: 'text',   req: false, col: 1 },
              { name: 'commission_rate', label: 'Commission Rate (%)',   type: 'number', req: false, col: 1 },
            ].map(f => (
              <div key={f.name} className={f.col === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{f.label}</label>
                <input {...register(f.name, { required: f.req })} type={f.type} step={f.name === 'commission_rate' ? '0.5' : undefined}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={createMutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {createMutation.isPending && <Loader size={16} className="animate-spin" />} Add Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditAgentModal({ agent, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm({ defaultValues: {
    name: agent.name, email: agent.email, phone: agent.phone,
    cnic: agent.cnic, commission_rate: agent.commission_rate,
  }});

  const editMutation = useMutation({
    mutationFn: (d) => api.put(`/agents/${agent.id}`, d),
    onSuccess: () => { toast.success('Agent updated!'); qc.invalidateQueries(['agents']); onClose(); },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Edit Agent — {agent.name}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => editMutation.mutate(d))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'name',            label: 'Full Name *',          type: 'text',   req: true,  col: 2 },
              { name: 'email',           label: 'Email *',              type: 'email',  req: true,  col: 1 },
              { name: 'phone',           label: 'Phone *',              type: 'tel',    req: true,  col: 1 },
              { name: 'cnic',            label: 'CNIC',                 type: 'text',   req: false, col: 1 },
              { name: 'commission_rate', label: 'Commission Rate (%)',   type: 'number', req: false, col: 1 },
            ].map(f => (
              <div key={f.name} className={f.col === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{f.label}</label>
                <input {...register(f.name, { required: f.req })} type={f.type} step={f.name === 'commission_rate' ? '0.5' : undefined}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={editMutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {editMutation.isPending && <Loader size={16} className="animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Agents() {
  const [showAdd, setShowAdd] = useState(false);
  const [editAgent, setEditAgent] = useState(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['agents', search],
    queryFn: () => api.get(`/agents?search=${search}&limit=50`).then(r => r.data),
  });

  const agents = (data?.data || []).filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCommission = agents.reduce((s, a) => s + parseFloat(a.total_commission || 0), 0);
  const totalSales = agents.reduce((s, a) => s + parseFloat(a.total_sales || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales agents and commission management</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> Add Agent
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { l: 'Total Agents', v: agents.length, icon: UserCheck, cls: 'bg-blue-50 text-blue-500' },
          { l: 'Total Sales', v: fmtPKR(totalSales), icon: TrendingUp, cls: 'bg-green-50 text-green-500' },
          { l: 'Total Commission', v: fmtPKR(totalCommission), icon: DollarSign, cls: 'bg-orange-50 text-orange-500' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-lg ${s.cls}`}><s.icon size={20} /></div>
            <div><p className="text-xl font-bold text-gray-900">{s.v}</p><p className="text-xs text-gray-400">{s.l}</p></div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white max-w-sm">
        <Search size={15} className="text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents..."
          className="text-sm border-none outline-none flex-1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? Array(6).fill(0).map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />) :
        agents.length === 0 ? (
          <div className="col-span-3 py-20 text-center">
            <UserCheck size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No agents found</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">Add First Agent</button>
          </div>
        ) : agents.map((a, i) => (
          <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg">
                {a.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-gray-900">{a.name}</div>
                <div className="text-xs text-orange-500 font-mono">{a.agent_code}</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setEditAgent(a)} className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-300 hover:text-orange-500 transition" title="Edit">
                  <Pencil size={14} />
                </button>
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star size={14} fill="currentColor" />
                  <span className="text-xs font-semibold text-gray-600">{i + 1}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Commission Rate</span>
                <span className="font-semibold text-orange-600">{a.commission_rate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Bookings</span>
                <span className="font-semibold">{a.bookings_count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Sales</span>
                <span className="font-semibold text-green-700">{fmtPKR(a.total_sales || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Earned Commission</span>
                <span className="font-semibold text-blue-700">{fmtPKR(a.total_commission || 0)}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-2">
              <span>📞 {a.phone}</span>
            </div>
          </div>
        ))}
      </div>

      <AddAgentModal open={showAdd} onClose={() => setShowAdd(false)} />
      {editAgent && <EditAgentModal agent={editAgent} onClose={() => setEditAgent(null)} />}
    </div>
  );
}
