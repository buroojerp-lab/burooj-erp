// src/pages/Settings.jsx
import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, User, Lock, Bell, Globe, Shield, Loader, Save, Database, Download, Trash2, RefreshCw, CheckCircle, MapPin } from 'lucide-react';
import api from '../utils/api';
import ProjectMap from '../components/common/ProjectMap';

const TABS = [
  { id: 'profile',       label: 'Profile',        icon: User },
  { id: 'password',      label: 'Password',        icon: Lock },
  { id: 'notifications', label: 'Notifications',   icon: Bell },
  { id: 'system',        label: 'System',          icon: Globe },
  { id: 'location',      label: 'Location',        icon: MapPin },
  { id: 'backup',        label: 'Backup',          icon: Database, adminOnly: true },
];

export default function Settings() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('profile');

  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErr } } = useForm();

  const pwdMutation = useMutation({
    mutationFn: d => api.post('/auth/change-password', d),
    onSuccess: () => { toast.success('Password changed!'); resetPwd(); },
    onError: err => toast.error(err.response?.data?.error || 'Failed'),
  });

  const qc = useQueryClient();

  // ── Backup tab state ──
  const { data: backupData, refetch: refetchBackups } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get('/backup').then(r => r.data),
    enabled: tab === 'backup',
  });
  const createBackupMutation = useMutation({
    mutationFn: () => api.post('/backup'),
    onSuccess: (res) => {
      toast.success(`Backup created: ${res.data.filename}`);
      refetchBackups();
    },
    onError: err => toast.error(err.response?.data?.error || 'Backup failed'),
  });
  const deleteBackupMutation = useMutation({
    mutationFn: (filename) => api.delete(`/backup/${filename}`),
    onSuccess: () => { toast.success('Backup deleted'); refetchBackups(); },
    onError: err => toast.error(err.response?.data?.error || 'Delete failed'),
  });

  const visibleTabs = TABS.filter(t => !t.adminOnly || user?.role === 'admin' || user?.role === 'manager');
  const backups = backupData?.backups || [];

  const fmtBytes = (kb) => kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  const fmtDt = (dt) => new Date(dt).toLocaleString('en-PK');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><SettingsIcon size={24} className="text-orange-500" /> Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and system preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-44 flex-shrink-0 space-y-1">
          {visibleTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left ${tab === t.id ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <t.icon size={16} />{t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4">
          {/* Profile */}
          {tab === 'profile' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
              <h2 className="font-semibold text-gray-800">Profile Information</h2>
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-bold">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{user?.name}</div>
                  <div className="text-sm text-gray-400">{user?.email}</div>
                  <div className="inline-flex mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold capitalize">{user?.role?.replace('_', ' ')}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[['Full Name', user?.name], ['Email', user?.email], ['Phone', user?.phone || 'Not set'], ['Role', user?.role]].map(([l, v]) => (
                  <div key={l} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 font-medium">{l}</div>
                    <div className="text-sm font-semibold text-gray-800 mt-0.5 capitalize">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Password */}
          {tab === 'password' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-800 mb-5">Change Password</h2>
              <form onSubmit={handlePwd(d => pwdMutation.mutate(d))} className="space-y-4 max-w-sm">
                {[
                  { name: 'currentPassword', label: 'Current Password' },
                  { name: 'newPassword', label: 'New Password', minLen: 8 },
                  { name: 'confirmPassword', label: 'Confirm New Password' },
                ].map(f => (
                  <div key={f.name}>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{f.label}</label>
                    <input {...regPwd(f.name, { required: true, minLength: f.minLen })} type="password"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                ))}
                <button type="submit" disabled={pwdMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                  {pwdMutation.isPending ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                  Update Password
                </button>
              </form>
            </div>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-semibold text-gray-800">Notification Preferences</h2>
              {[
                ['WhatsApp Reminders', 'Send automatic WhatsApp installment reminders', true],
                ['Overdue Alerts', 'Alert when installments are overdue', true],
                ['New Booking Alert', 'Notify when a new booking is created', true],
                ['Weekly Report', 'Receive weekly financial summary', true],
                ['System Alerts', 'Important system notifications', false],
              ].map(([title, desc, on]) => (
                <div key={title} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                  </div>
                  <div className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${on ? 'bg-orange-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* System */}
          {tab === 'system' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
              <h2 className="font-semibold text-gray-800">System Information</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['System', 'Burooj Heights ERP'],
                  ['Version', 'v2.0.0'],
                  ['Database', 'PostgreSQL 16'],
                  ['Backend', 'Node.js 20 + Express'],
                  ['Frontend', 'React 18 + Tailwind CSS'],
                  ['Auth', 'JWT + Role Based Access'],
                  ['WhatsApp', 'Meta Cloud API'],
                  ['Notifications', 'Firebase'],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between border-b border-gray-50 pb-2">
                    <span className="text-gray-400">{l}</span>
                    <span className="font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-semibold text-green-800">All systems operational</span>
                </div>
                <p className="text-xs text-green-600 mt-1">Database connected · API running · Cron jobs active</p>
              </div>
            </div>
          )}
          {/* ── Location Tab ── */}
          {tab === 'location' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <MapPin size={16} className="text-orange-500" /> Project Location
                </h2>
                <p className="text-sm text-gray-400 mb-4">Burooj Heights — Main Boulevard Dream Housing, Raiwind Road, Lahore</p>
                <ProjectMap />
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm">Location Details</h3>
                {[
                  ['Project Name', 'Burooj Heights'],
                  ['Address', 'Main Boulevard Dream Housing, Raiwind Road, Lahore'],
                  ['City', 'Lahore, Pakistan'],
                  ['Coordinates', '31.3984° N, 74.1387° E'],
                  ['Nearest Landmark', 'Dream Housing Society Main Gate'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b border-gray-50 pb-2.5 last:border-0">
                    <span className="text-sm text-gray-400">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Backup Tab ── */}
          {tab === 'backup' && (
            <div className="space-y-4">
              {/* Create backup */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                  <Database size={16} className="text-orange-500" /> Database Backup
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Create a full backup of all ERP data. Backups are automatically created daily (2 AM) and weekly (Sunday 3 AM).
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => createBackupMutation.mutate()}
                    disabled={createBackupMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition disabled:opacity-60">
                    {createBackupMutation.isPending
                      ? <><Loader size={15} className="animate-spin" /> Creating...</>
                      : <><Download size={15} /> Create Backup Now</>}
                  </button>
                  <button onClick={() => refetchBackups()}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                    <RefreshCw size={14} /> Refresh
                  </button>
                </div>
              </div>

              {/* Backup list */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm">Backup Files ({backups.length})</h3>
                  {backupData?.backup_dir && (
                    <span className="text-xs text-gray-400 font-mono truncate max-w-72">{backupData.backup_dir}</span>
                  )}
                </div>

                {backups.length === 0 ? (
                  <div className="p-12 text-center">
                    <Database size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No backups yet. Create your first backup above.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Filename', 'Type', 'Size', 'Created At', ''].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {backups.map(bk => {
                        const type = bk.filename.includes('_daily') ? 'Daily'
                                   : bk.filename.includes('_weekly') ? 'Weekly'
                                   : 'Manual';
                        const typeColor = type === 'Weekly' ? 'bg-blue-100 text-blue-700'
                                        : type === 'Daily'  ? 'bg-green-100 text-green-700'
                                        : 'bg-orange-100 text-orange-700';
                        return (
                          <tr key={bk.filename} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-64 truncate">{bk.filename}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColor}`}>{type}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{fmtBytes(bk.size_kb)}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{fmtDt(bk.created_at)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete backup "${bk.filename}"?`)) {
                                    deleteBackupMutation.mutate(bk.filename);
                                  }
                                }}
                                disabled={deleteBackupMutation.isPending}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-xs transition disabled:opacity-50">
                                <Trash2 size={12} /> Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Backup info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
                <p><strong>Automatic Schedule:</strong> Daily at 2:00 AM · Weekly every Sunday at 3:00 AM (PKT)</p>
                <p><strong>Retention:</strong> Last 7 daily backups and last 4 weekly backups are kept automatically</p>
                <p><strong>Format:</strong> Compressed JSON (.json.gz) — contains all tables including all transactions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
