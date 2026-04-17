// src/pages/Facility.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Wrench, Plus, X, Loader, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import api from '../utils/api';
import { fmtDate } from '../utils/format';

function AddTicketModal({ open, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();
  const mutation = useMutation({
    mutationFn: d => api.post('/facility/tickets', d),
    onSuccess: () => { toast.success('Ticket created!'); qc.invalidateQueries(['tickets']); reset(); onClose(); },
    onError: err => toast.error(err.response?.data?.error || 'Failed'),
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">New Maintenance Ticket</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Title *</label>
            <input {...register('title', { required: true })} placeholder="e.g. AC not working in A-101"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category</label>
              <select {...register('category')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
                <option>Electrical</option><option>Plumbing</option><option>AC / HVAC</option>
                <option>Civil</option><option>Lift</option><option>Security</option><option>Cleaning</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Priority</label>
              <select {...register('priority')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
                <option value="low">Low</option><option value="medium">Medium</option>
                <option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
            <textarea {...register('description')} rows={3} placeholder="Describe the issue..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {mutation.isPending && <Loader size={16} className="animate-spin" />} Create Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Facility() {
  const [showAdd, setShowAdd] = useState(false);
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', status],
    queryFn: () => api.get(`/facility/tickets?status=${status}&limit=50`).then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => api.put(`/facility/tickets/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries(['tickets']); toast.success('Ticket updated'); },
  });

  const tickets = data?.data || [];
  const PRIORITY_CLS = { urgent: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-gray-100 text-gray-600' };
  const STATUS_CLS = { open: 'bg-blue-100 text-blue-700', in_progress: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700', closed: 'bg-gray-100 text-gray-600' };

  const counts = { open: tickets.filter(t => t.status === 'open').length, in_progress: tickets.filter(t => t.status === 'in_progress').length, resolved: tickets.filter(t => t.status === 'resolved').length };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Facility Management</h1><p className="text-sm text-gray-500 mt-0.5">Maintenance tickets and service requests</p></div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> New Ticket
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { l: 'Open', v: counts.open, icon: AlertTriangle, cls: 'bg-blue-50 text-blue-500' },
          { l: 'In Progress', v: counts.in_progress, icon: Clock, cls: 'bg-yellow-50 text-yellow-500' },
          { l: 'Resolved', v: counts.resolved, icon: CheckCircle, cls: 'bg-green-50 text-green-500' },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-lg ${s.cls}`}><s.icon size={20} /></div>
            <div><p className="text-2xl font-bold text-gray-900">{s.v}</p><p className="text-xs text-gray-400">{s.l}</p></div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {['', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${status === s ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s.replace('_', ' ') || 'All'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading ? Array(5).fill(0).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />) :
        tickets.length === 0 ? (
          <div className="py-20 text-center">
            <Wrench size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No tickets found</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">Create First Ticket</button>
          </div>
        ) : tickets.map(t => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-orange-500">{t.ticket_no}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_CLS[t.priority] || 'bg-gray-100 text-gray-600'}`}>{t.priority}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[t.status] || 'bg-gray-100 text-gray-600'}`}>{t.status?.replace('_',' ')}</span>
              </div>
              <div className="font-medium text-gray-900">{t.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t.category} · {fmtDate(t.created_at)}</div>
            </div>
            <div className="flex gap-2">
              {t.status === 'open' && (
                <button onClick={() => updateMutation.mutate({ id: t.id, status: 'in_progress' })}
                  className="px-3 py-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-xs font-medium hover:bg-yellow-100">
                  Start Work
                </button>
              )}
              {t.status === 'in_progress' && (
                <button onClick={() => updateMutation.mutate({ id: t.id, status: 'resolved' })}
                  className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100">
                  Mark Resolved
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <AddTicketModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
