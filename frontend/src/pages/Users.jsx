// src/pages/Users.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Users as UsersIcon, Plus, X, Loader, Shield, Eye, EyeOff, Trash2 } from 'lucide-react';
import api from '../utils/api';
import { fmtDate } from '../utils/format';

const ROLES = [
  { value: 'admin',        label: 'Administrator', color: 'bg-red-100    text-red-700'    },
  { value: 'manager',      label: 'Manager',       color: 'bg-purple-100 text-purple-700' },
  { value: 'sales_agent',  label: 'Sales Agent',   color: 'bg-blue-100   text-blue-700'   },
  { value: 'accountant',   label: 'Accountant',    color: 'bg-green-100  text-green-700'  },
  { value: 'investor',     label: 'Investor',      color: 'bg-orange-100 text-orange-700' },
];

function AddUserModal({ open, onClose }) {
  const qc = useQueryClient();
  const [showPwd, setShowPwd] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: { role: 'sales_agent' } });

  const createMutation = useMutation({
    mutationFn: d => api.post('/auth/register', d),
    onSuccess: () => { toast.success('User created!'); qc.invalidateQueries(['users']); reset(); onClose(); },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create user'),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Add New User</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Full Name *</label>
              <input {...register('name', { required: true })} placeholder="Full name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email *</label>
              <input {...register('email', { required: true })} type="email" placeholder="email@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phone</label>
              <input {...register('phone')} type="tel" placeholder="03XXXXXXXXX"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Role *</label>
              <select {...register('role', { required: true })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password *</label>
              <div className="relative">
                <input {...register('password', { required: true, minLength: 8 })}
                  type={showPwd ? 'text' : 'password'} placeholder="Min 8 characters"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-orange-400" />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">Min 8 characters required</p>}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={createMutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {createMutation.isPending && <Loader size={16} className="animate-spin" />} Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const [showAdd, setShowAdd] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', roleFilter],
    queryFn: () => api.get(`/users?role=${roleFilter}&limit=50`).then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => api.put(`/users/${id}/toggle`, { is_active }),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('User status updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('User deleted'); setConfirmDelete(null); },
    onError: err => { toast.error(err.response?.data?.error || 'Failed to delete user'); setConfirmDelete(null); },
  });

  const users = data?.data || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Shield size={22} className="text-orange-500" /> User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage system users and access roles</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-5 gap-3">
        {ROLES.map(r => {
          const count = users.filter(u => u.role === r.value).length;
          return (
            <button key={r.value} onClick={() => setRoleFilter(roleFilter === r.value ? '' : r.value)}
              className={`bg-white rounded-xl p-3 border text-center transition-all ${roleFilter === r.value ? 'border-orange-400 shadow-md' : 'border-gray-100 shadow-sm hover:shadow-md'}`}>
              <div className="text-xl font-bold text-gray-900">{count}</div>
              <div className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${r.color}`}>{r.label}</div>
            </button>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">All Users ({users.length})</h2>
          {roleFilter && (
            <button onClick={() => setRoleFilter('')} className="text-xs text-orange-500 hover:underline">
              Clear filter ✕
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['User', 'Email', 'Phone', 'Role', 'Last Login', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? Array(6).fill(0).map((_, i) => (
                <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
              )) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center">
                  <UsersIcon size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">No users found</p>
                </td></tr>
              ) : users.map(user => {
                const roleCfg = ROLES.find(r => r.value === user.role) || ROLES[0];
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {user.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-400">{fmtDate(user.created_at)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{user.email}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{user.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${roleCfg.color}`}>
                        {roleCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{user.last_login ? fmtDate(user.last_login) : 'Never'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleMutation.mutate({ id: user.id, is_active: !user.is_active })}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${user.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setConfirmDelete(user.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-gray-300 hover:text-red-500 transition">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AddUserModal open={showAdd} onClose={() => setShowAdd(false)} />

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Delete User</h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone. The user will lose all access immediately.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate(confirmDelete)} disabled={deleteMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {deleteMutation.isPending && <Loader size={16} className="animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
