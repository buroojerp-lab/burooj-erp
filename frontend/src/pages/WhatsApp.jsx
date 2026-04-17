// src/pages/WhatsApp.jsx
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  MessageCircle, Send, CheckCircle, XCircle, Clock,
  Users, RefreshCw, Filter, Loader, Phone
} from 'lucide-react';
import api from '../utils/api';
import { fmtDateTime } from '../utils/format';

const STATUS_ICONS = {
  sent:    { icon: CheckCircle, color: 'text-green-500' },
  failed:  { icon: XCircle,     color: 'text-red-500' },
  pending: { icon: Clock,       color: 'text-yellow-500' },
};

// ── Send Manual WhatsApp ──
function SendMessageForm() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const sendMutation = useMutation({
    mutationFn: (data) => api.post('/whatsapp/send', data),
    onSuccess: () => { toast.success('Message sent!'); reset(); },
    onError: (err) => toast.error(err.response?.data?.error || 'Send failed'),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Send size={18} className="text-green-600" /> Send Manual Message
      </h2>
      <form onSubmit={handleSubmit(d => sendMutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Phone Number *
            </label>
            <input
              {...register('phone', { required: true })}
              placeholder="03XXXXXXXXX"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Customer Name
            </label>
            <input
              {...register('customer_name')}
              placeholder="Optional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
            Message *
          </label>
          <textarea
            {...register('message', { required: true })}
            rows={4}
            placeholder="Type your message..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400 resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={sendMutation.isPending}
          className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition"
        >
          {sendMutation.isPending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
          Send Message
        </button>
      </form>
    </div>
  );
}

// ── Bulk Reminders ──
function BulkReminderCard() {
  const triggerMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/trigger-reminders'),
    onSuccess: (res) => toast.success(`Reminders sent! Check: ${res.data.message}`),
    onError: () => toast.error('Failed to trigger reminders'),
  });

  return (
    <div className="bg-gradient-to-br from-green-50 to-green-100/50 border border-green-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-green-800 flex items-center gap-2 mb-1">
            <RefreshCw size={16} /> Automated Reminders
          </h3>
          <p className="text-sm text-green-700 mb-3">
            Trigger the daily reminder cycle manually. System auto-runs at 9 AM daily.
          </p>
          <div className="space-y-1 text-xs text-green-600">
            <div>📅 5 days before: Friendly reminder</div>
            <div>⏰ Due today: Payment due notice</div>
            <div>⚠️ 3 days overdue: Late payment warning</div>
            <div>🚨 30+ days overdue: Cancellation warning</div>
          </div>
        </div>
      </div>
      <button
        onClick={() => triggerMutation.mutate()}
        disabled={triggerMutation.isPending}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
      >
        {triggerMutation.isPending ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        {triggerMutation.isPending ? 'Sending...' : 'Run Reminders Now'}
      </button>
    </div>
  );
}

// ── Main WhatsApp Page ──
export default function WhatsApp() {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['wa-logs', { statusFilter, typeFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: 25 });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter)   params.set('type', typeFilter);
      return (await api.get(`/whatsapp/logs?${params}`)).data;
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ['wa-stats'],
    queryFn: () => api.get('/whatsapp/stats').then(r => r.data),
  });

  const stats = statsData || {};
  const logs = data?.data || [];
  const pg = data?.pagination || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle size={24} className="text-green-600" />
            WhatsApp Center
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage automated and manual WhatsApp messages</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sent',  value: stats.total || 0,   color: 'blue' },
          { label: 'Delivered',   value: stats.sent || 0,    color: 'green' },
          { label: 'Failed',      value: stats.failed || 0,  color: 'red' },
          { label: 'This Month',  value: stats.month || 0,   color: 'orange' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="space-y-5">
          <BulkReminderCard />
          <SendMessageForm />
        </div>

        {/* Right: Logs */}
        <div className="lg:col-span-2">
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-400">
              <option value="">All Status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-green-400">
              <option value="">All Types</option>
              <option value="reminder">Reminder</option>
              <option value="confirmation">Confirmation</option>
              <option value="cancellation">Cancellation</option>
              <option value="booking">Booking</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Message Log</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Status', 'Phone', 'Type', 'Message Preview', 'Sent At'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading ? (
                    Array(8).fill(0).map((_, i) => (
                      <tr key={i}>{Array(5).fill(0).map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}</tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <MessageCircle size={40} className="text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400">No messages yet</p>
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => {
                      const si = STATUS_ICONS[log.status] || STATUS_ICONS.pending;
                      return (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <si.icon size={16} className={si.color} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-gray-700">
                              <Phone size={13} className="text-gray-400" />
                              {log.to_phone}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              {log.template_type || 'manual'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={log.message}>
                            {log.message?.substring(0, 60)}...
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {fmtDateTime(log.sent_at || log.created_at)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {pg.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {(pg.page - 1) * pg.limit + 1}–{Math.min(pg.page * pg.limit, pg.total)} of {pg.total}
                </p>
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
      </div>
    </div>
  );
}
