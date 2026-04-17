// src/pages/HR.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, X, Loader, UserCheck, UserX,
  Calendar, Clock, ChevronRight, Download, Eye,
  Briefcase, Phone, Mail, BadgeCheck, AlertCircle
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';

const TABS = [
  { id: 'employees',   label: 'Employees',   icon: Users },
  { id: 'attendance',  label: 'Attendance',  icon: Clock },
  { id: 'leave',       label: 'Leave',       icon: Calendar },
  { id: 'departments', label: 'Departments', icon: Briefcase },
];

const DEPT_OPTIONS = ['Construction', 'Finance', 'Admin', 'Sales', 'HR', 'IT', 'Security', 'Maintenance'];

// ── Add Employee Modal ──
function AddEmployeeModal({ open, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { contract_type: 'Permanent', attendance_status: 'present' }
  });

  const mutation = useMutation({
    mutationFn: (d) => api.post('/hr/employees', d),
    onSuccess: () => {
      toast.success('Employee added!');
      qc.invalidateQueries(['employees']);
      reset(); onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const basic = parseFloat(watch('basic_salary') || 0);
  const hra = Math.round(basic * 0.4);
  const medical = 2000;
  const gross = basic + hra + medical;
  const pf = Math.round(basic * 0.0833);
  const net = gross - pf;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Add New Employee</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-sm">Full Name *</label>
              <input {...register('name', { required: true })} placeholder="Full name" className="input-field" /></div>
            <div><label className="label-sm">Employee ID *</label>
              <input {...register('emp_code', { required: true })} placeholder="EMP-001" className="input-field" /></div>
            <div><label className="label-sm">CNIC</label>
              <input {...register('cnic')} placeholder="35201-XXXXXXX-X" className="input-field" /></div>
            <div><label className="label-sm">Phone</label>
              <input {...register('phone')} type="tel" placeholder="0300-XXXXXXX" className="input-field" /></div>
            <div><label className="label-sm">Email</label>
              <input {...register('email')} type="email" placeholder="email@example.com" className="input-field" /></div>
            <div><label className="label-sm">Department *</label>
              <select {...register('department_name', { required: true })} className="input-field">
                <option value="">Select...</option>
                {DEPT_OPTIONS.map(d => <option key={d}>{d}</option>)}
              </select></div>
            <div><label className="label-sm">Designation *</label>
              <input {...register('designation', { required: true })} placeholder="Site Engineer" className="input-field" /></div>
            <div><label className="label-sm">Joining Date</label>
              <input {...register('joining_date')} type="date" className="input-field" /></div>
            <div><label className="label-sm">Basic Salary (PKR) *</label>
              <input {...register('basic_salary', { required: true, min: 1 })} type="number" placeholder="50000" className="input-field" /></div>
            <div><label className="label-sm">Contract Type</label>
              <select {...register('contract_type')} className="input-field">
                <option>Permanent</option><option>Contractual</option>
                <option>Part Time</option><option>Daily Wages</option>
              </select></div>
            <div><label className="label-sm">Bank Name</label>
              <input {...register('bank_name')} placeholder="Meezan Bank" className="input-field" /></div>
            <div><label className="label-sm">Bank Account</label>
              <input {...register('bank_account')} placeholder="Account number" className="input-field" /></div>
          </div>

          {/* Salary Preview */}
          {basic > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl grid grid-cols-4 gap-3 text-center">
              {[
                { label: 'Gross', value: fmtPKR(gross), color: 'text-blue-700' },
                { label: 'HRA (40%)', value: fmtPKR(hra), color: 'text-gray-700' },
                { label: 'PF (8.33%)', value: `-${fmtPKR(pf)}`, color: 'text-red-600' },
                { label: 'Net Pay', value: fmtPKR(net), color: 'text-green-700 font-bold' },
              ].map(s => (
                <div key={s.label}>
                  <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 mt-5">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
              {mutation.isPending && <Loader size={15} className="animate-spin" />}
              Add Employee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Mark Attendance Modal ──
function AttendanceModal({ open, onClose, employees }) {
  const qc = useQueryClient();
  const [records, setRecords] = useState({});

  const markAllMutation = useMutation({
    mutationFn: (data) => api.post('/hr/attendance/bulk', data),
    onSuccess: () => {
      toast.success('Attendance marked!');
      qc.invalidateQueries(['employees']);
      onClose();
    },
    onError: () => toast.error('Failed to mark attendance'),
  });

  const today = new Date().toISOString().split('T')[0];

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Mark Attendance</h2>
            <p className="text-sm text-gray-400">Today: {fmtDate(today)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {/* Quick Mark All */}
        <div className="px-6 py-3 border-b border-gray-100 flex gap-3 flex-shrink-0">
          {['present', 'absent', 'leave'].map(s => (
            <button key={s} onClick={() => {
              const all = {};
              employees.forEach(e => { all[e.id] = s; });
              setRecords(all);
            }} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition border ${
              s === 'present' ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' :
              s === 'absent' ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' :
              'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            }`}>
              Mark All {s}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {employees.map(emp => (
            <div key={emp.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
                  {emp.name?.[0]}
                </div>
                <div>
                  <div className="font-medium text-gray-900 text-sm">{emp.name}</div>
                  <div className="text-xs text-gray-400">{emp.designation} · {emp.department_name}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { s: 'present', icon: '✓', cls: 'bg-green-100 text-green-700 border-green-200' },
                  { s: 'absent',  icon: '✗', cls: 'bg-red-100 text-red-700 border-red-200' },
                  { s: 'leave',   icon: '○', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                ].map(({ s, icon, cls }) => (
                  <button key={s} onClick={() => setRecords(r => ({ ...r, [emp.id]: s }))}
                    className={`w-8 h-8 rounded-lg border text-sm font-bold transition ${
                      records[emp.id] === s ? cls : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}>{icon}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Cancel</button>
          <button
            onClick={() => markAllMutation.mutate({ date: today, records })}
            disabled={markAllMutation.isPending || Object.keys(records).length === 0}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {markAllMutation.isPending && <Loader size={15} className="animate-spin" />}
            Save Attendance ({Object.keys(records).length})
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Leave Request Modal ──
function NewLeaveModal({ open, onClose, employees }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { leave_type: 'casual', from_date: '', to_date: '', reason: '' }
  });

  const mutation = useMutation({
    mutationFn: d => api.post('/hr/leave', d),
    onSuccess: () => { toast.success('Leave request submitted!'); qc.invalidateQueries(['leave-requests']); reset(); onClose(); },
    onError: err => toast.error(err.response?.data?.error || 'Failed to submit'),
  });

  const from = watch('from_date');
  const to = watch('to_date');
  const days = from && to ? Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000) + 1) : 0;

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">New Leave Request</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate({ ...d, days }))} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Employee *</label>
            <select {...register('employee_id', { required: true })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
              <option value="">Select employee...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Leave Type</label>
            <select {...register('leave_type')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
              {['casual', 'annual', 'medical', 'emergency', 'unpaid'].map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">From Date *</label>
              <input {...register('from_date', { required: true })} type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">To Date *</label>
              <input {...register('to_date', { required: true })} type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
            </div>
          </div>
          {days > 0 && <p className="text-xs text-orange-600 font-medium">{days} day{days !== 1 ? 's' : ''} of leave</p>}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Reason</label>
            <textarea {...register('reason')} rows={2} placeholder="Reason for leave..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {mutation.isPending && <Loader size={16} className="animate-spin" />} Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HR() {
  const [activeTab, setActiveTab] = useState('employees');
  const [showAdd, setShowAdd] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [viewEmp, setViewEmp] = useState(null);
  const [showAtt, setShowAtt] = useState(false);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const qc = useQueryClient();

  const { data: empData, isLoading } = useQuery({
    queryKey: ['employees', { search, deptFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (deptFilter) params.set('department', deptFilter);
      return (await api.get(`/hr/employees?${params}`)).data;
    },
  });

  const { data: leaveData } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => api.get('/hr/leave').then(r => r.data),
    enabled: activeTab === 'leave',
  });

  const { data: attData } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => api.get('/hr/attendance/today').then(r => r.data),
    enabled: activeTab === 'attendance',
  });

  const approveLeaveMutation = useMutation({
    mutationFn: ({ id, action }) => api.put(`/hr/leave/${id}/${action}`),
    onSuccess: () => { toast.success('Updated!'); qc.invalidateQueries(['leave-requests']); },
  });

  const employees = empData?.data || [];
  const pg = empData?.pagination || {};

  const stats = {
    total: pg.total || 0,
    present: employees.filter(e => e.attendance_status === 'present').length,
    absent: employees.filter(e => e.attendance_status === 'absent').length,
    leave: employees.filter(e => e.attendance_status === 'leave').length,
    payroll: employees.reduce((s, e) => s + (parseFloat(e.gross_salary) || 0), 0),
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Employees, attendance and leave management</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'attendance' && (
            <button onClick={() => setShowAtt(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
              <Clock size={16} /> Mark Attendance
            </button>
          )}
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
            <Plus size={16} /> Add Employee
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Staff',    value: stats.total,              color: 'blue' },
          { label: 'Present Today',  value: stats.present,            color: 'green' },
          { label: 'Absent Today',   value: stats.absent,             color: 'red' },
          { label: 'On Leave',       value: stats.leave,              color: 'yellow' },
          { label: 'Monthly Payroll',value: fmtPKR(stats.payroll),    color: 'purple' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <tab.icon size={16} />{tab.label}
          </button>
        ))}
      </div>

      {/* ── Employees Tab ── */}
      {activeTab === 'employees' && (
        <>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-60">
              <Search size={15} className="text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search employees..." className="text-sm border-none outline-none" />
            </div>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
              <option value="">All Departments</option>
              {DEPT_OPTIONS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Employee', 'Department', 'Designation', 'Phone', 'Joined', 'Basic Salary', 'Gross Salary', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? Array(6).fill(0).map((_, i) => (
                  <tr key={i}>{Array(9).fill(0).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}</tr>
                )) : employees.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-16 text-center">
                    <Users size={40} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400">No employees found. Add your first employee.</p>
                  </td></tr>
                ) : employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{emp.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{emp.emp_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.department_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.designation}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(emp.joining_date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{fmtPKR(emp.basic_salary)}</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{fmtPKR(emp.gross_salary || emp.basic_salary)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.attendance_status === 'present' ? 'bg-green-100 text-green-700' :
                        emp.attendance_status === 'absent' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {emp.attendance_status || 'not marked'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewEmp(emp)} className="p-1.5 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition">
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Leave Tab ── */}
      {activeTab === 'leave' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Leave Requests</h2>
            <button onClick={() => setShowLeave(true)} className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium">
              <Plus size={14} /> New Request
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Employee', 'Leave Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaveData?.data?.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-400">No leave requests</td></tr>
              ) : leaveData?.data?.map(lv => (
                <tr key={lv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{lv.employee_name}</td>
                  <td className="px-4 py-3 text-gray-600">{lv.leave_type}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(lv.from_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(lv.to_date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{lv.days}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-32 truncate">{lv.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      lv.status === 'approved' ? 'bg-green-100 text-green-700' :
                      lv.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{lv.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {lv.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button onClick={() => approveLeaveMutation.mutate({ id: lv.id, action: 'approve' })}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200">✓ Approve</button>
                        <button onClick={() => approveLeaveMutation.mutate({ id: lv.id, action: 'reject' })}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200">✗ Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Attendance Tab ── */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Today's Attendance — {fmtDate(new Date())}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Employee', 'Department', 'Check In', 'Check Out', 'Hours', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!attData?.data?.length ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center">
                  <Clock size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 mb-3">No attendance marked yet today</p>
                  <button onClick={() => setShowAtt(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">
                    Mark Attendance Now
                  </button>
                </td></tr>
              ) : attData.data.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.employee_name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.department_name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.check_in || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.check_out || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{a.hours || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      a.status === 'present' ? 'bg-green-100 text-green-700' :
                      a.status === 'absent' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Departments Tab ── */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {DEPT_OPTIONS.map(dept => {
            const deptEmps = employees.filter(e => e.department_name === dept);
            return (
              <div key={dept} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-gray-900">{dept}</div>
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-sm">
                    {deptEmps.length}
                  </div>
                </div>
                <div className="text-xs text-gray-400 mb-3">{deptEmps.length} employees</div>
                <div className="space-y-1.5">
                  {deptEmps.slice(0, 3).map(e => (
                    <div key={e.id} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-5 h-5 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {e.name?.[0]}
                      </div>
                      <span className="truncate">{e.name}</span>
                    </div>
                  ))}
                  {deptEmps.length > 3 && <div className="text-xs text-gray-400">+{deptEmps.length - 3} more</div>}
                  {deptEmps.length === 0 && <div className="text-xs text-gray-300 italic">No employees assigned</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddEmployeeModal open={showAdd} onClose={() => setShowAdd(false)} />
      <AttendanceModal open={showAtt} onClose={() => setShowAtt(false)} employees={employees} />
      <NewLeaveModal open={showLeave} onClose={() => setShowLeave(false)} employees={employees} />

      {viewEmp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">Employee Profile</h2>
              <button onClick={() => setViewEmp(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-bold">{viewEmp.name?.[0]}</div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{viewEmp.name}</div>
                  <div className="text-sm text-gray-500">{viewEmp.designation} · {viewEmp.department_name}</div>
                  <div className="text-xs text-orange-500 font-medium mt-0.5">{viewEmp.emp_code}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Phone', viewEmp.phone || '—'],
                  ['Email', viewEmp.email || '—'],
                  ['CNIC', viewEmp.cnic || '—'],
                  ['Contract', viewEmp.contract_type || '—'],
                  ['Joining Date', viewEmp.joining_date ? fmtDate(viewEmp.joining_date) : '—'],
                  ['Basic Salary', fmtPKR(viewEmp.basic_salary || 0)],
                  ['Gross Salary', fmtPKR(viewEmp.gross_salary || viewEmp.basic_salary || 0)],
                  ['Bank', viewEmp.bank_name ? `${viewEmp.bank_name} — ${viewEmp.bank_account || ''}` : '—'],
                ].map(([l, v]) => (
                  <div key={l} className="bg-gray-50 rounded-lg p-2.5">
                    <div className="text-xs text-gray-400">{l}</div>
                    <div className="font-medium text-gray-800 text-xs mt-0.5 truncate">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
