// src/pages/Expenses.jsx
import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Plus, Upload, Search, Filter, Download, Eye, Trash2,
  FileText, Image, CheckCircle, Loader, X, Camera,
  DollarSign, TrendingDown, BarChart3, AlertCircle, Pencil
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';

const CATEGORIES = [
  { value: 'office_rent',     label: 'Office Rent' },
  { value: 'electricity',     label: 'Electricity Bills' },
  { value: 'internet',        label: 'Internet Bills' },
  { value: 'marketing',       label: 'Marketing' },
  { value: 'salaries',        label: 'Salaries' },
  { value: 'office_supplies', label: 'Office Supplies' },
  { value: 'fuel_transport',  label: 'Fuel / Transport' },
  { value: 'maintenance',     label: 'Maintenance' },
  { value: 'miscellaneous',   label: 'Miscellaneous' },
];

const METHODS = [
  { value: 'cash',   label: 'Cash' },
  { value: 'bank',   label: 'Bank Transfer' },
  { value: 'online', label: 'Online' },
  { value: 'cheque', label: 'Cheque' },
];

// ── Bill Upload Zone ──
function BillUploadZone({ expenseId, onUploaded }) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    setUploading(true);
    for (const file of acceptedFiles) {
      try {
        const formData = new FormData();
        formData.append('bill', file);
        await api.post(`/expenses/${expenseId}/bills`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success(`${file.name} uploaded! OCR processing...`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    onUploaded?.();
  }, [expenseId, onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
        ${isDragActive ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'}
      `}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader size={24} className="text-orange-500 animate-spin" />
          <p className="text-sm text-gray-600">Uploading & running OCR...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload size={24} className="text-gray-400" />
          <p className="text-sm text-gray-600 font-medium">
            {isDragActive ? 'Drop files here...' : 'Drag & drop bills here'}
          </p>
          <p className="text-xs text-gray-400">JPG, PNG, PDF — max 10MB</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-3 py-1.5 bg-orange-500 text-white text-xs rounded-lg font-medium">
              Browse Files
            </span>
            <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg font-medium flex items-center gap-1">
              <Camera size={12} /> Camera (Mobile)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Expense Modal ──
function AddExpenseModal({ open, onClose }) {
  const qc = useQueryClient();
  const [createdId, setCreatedId] = useState(null);
  const [step, setStep] = useState(1); // 1=form, 2=upload

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/expenses', data),
    onSuccess: (res) => {
      setCreatedId(res.data.expense.id);
      setStep(2);
      qc.invalidateQueries(['expenses']);
      toast.success('Expense recorded!');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const handleClose = () => {
    reset();
    setCreatedId(null);
    setStep(1);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">
              {step === 1 ? 'Add Expense' : 'Upload Bills (Optional)'}
            </h2>
            <div className="flex gap-2 mt-1">
              {[1, 2].map(s => (
                <div key={s} className={`h-1 rounded-full w-12 ${s <= step ? 'bg-orange-500' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Step 1: Form */}
        {step === 1 && (
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Expense Title *
                </label>
                <input
                  {...register('title', { required: 'Required' })}
                  placeholder="e.g. Monthly Office Rent"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100"
                />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Category *
                </label>
                <select
                  {...register('category', { required: 'Required' })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                >
                  <option value="">Select...</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Amount (PKR) *
                </label>
                <input
                  {...register('amount', { required: 'Required', min: 1 })}
                  type="number"
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                />
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Date *
                </label>
                <input
                  {...register('date', { required: 'Required' })}
                  type="date"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Payment Method
                </label>
                <select
                  {...register('payment_method')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                >
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Notes
                </label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={handleClose}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {createMutation.isPending ? <Loader size={16} className="animate-spin" /> : null}
                Save & Upload Bills
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Upload */}
        {step === 2 && createdId && (
          <div className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Expense saved!</p>
                <p className="text-xs text-green-600">Now upload the bill/invoice (optional)</p>
              </div>
            </div>

            <BillUploadZone expenseId={createdId} onUploaded={() => {}} />

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <strong>OCR Smart Read:</strong> Uploaded bills are automatically scanned to extract amount, date and vendor name.
              </p>
            </div>

            <button
              onClick={handleClose}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-lg text-sm font-medium"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit Expense Modal ──
function EditExpenseModal({ expense, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm({ defaultValues: {
    title: expense.title, category: expense.category,
    amount: expense.amount, date: expense.date?.slice(0, 10),
    payment_method: expense.payment_method, notes: expense.notes,
  }});

  const editMutation = useMutation({
    mutationFn: (d) => api.put(`/expenses/${expense.id}`, d),
    onSuccess: () => { toast.success('Expense updated!'); qc.invalidateQueries(['expenses']); onClose(); },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Edit Expense</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => editMutation.mutate(d))} className="p-6 space-y-4">
          <div>
            <label className="label-sm">Title *</label>
            <input {...register('title', { required: true })} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-sm">Category</label>
              <select {...register('category')} className="input-field">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-sm">Amount (PKR) *</label>
              <input {...register('amount', { required: true })} type="number" className="input-field" />
            </div>
            <div>
              <label className="label-sm">Date</label>
              <input {...register('date')} type="date" className="input-field" />
            </div>
            <div>
              <label className="label-sm">Payment Method</label>
              <select {...register('payment_method')} className="input-field">
                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-sm">Notes</label>
            <textarea {...register('notes')} rows={2} className="input-field resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" disabled={editMutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {editMutation.isPending && <Loader size={15} className="animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Expense Row ──
function ExpenseRow({ expense, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const catLabel = CATEGORIES.find(c => c.value === expense.category)?.label || expense.category;

  const catColors = {
    office_rent: 'bg-blue-100 text-blue-700',
    electricity: 'bg-yellow-100 text-yellow-700',
    internet: 'bg-cyan-100 text-cyan-700',
    marketing: 'bg-pink-100 text-pink-700',
    salaries: 'bg-purple-100 text-purple-700',
    office_supplies: 'bg-green-100 text-green-700',
    fuel_transport: 'bg-orange-100 text-orange-700',
    maintenance: 'bg-red-100 text-red-700',
    miscellaneous: 'bg-gray-100 text-gray-600',
  };

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900 text-sm">{expense.title}</div>
          <div className="text-xs text-gray-400">{expense.expense_no}</div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${catColors[expense.category] || 'bg-gray-100 text-gray-600'}`}>
            {catLabel}
          </span>
        </td>
        <td className="px-4 py-3 font-semibold text-gray-900 text-sm">
          {fmtPKR(expense.amount)}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(expense.date)}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
            ${expense.payment_method === 'cash' ? 'bg-green-100 text-green-700' :
              expense.payment_method === 'bank' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            {expense.payment_method}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{expense.paid_by_name || '—'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {expense.bills?.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                {expense.bills.length} bill{expense.bills.length > 1 ? 's' : ''}
              </span>
            )}
            {expense.ocr_vendor_name && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">OCR ✓</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onEdit(expense); }}
              className="p-1.5 rounded-lg hover:bg-orange-100 text-gray-400 hover:text-orange-500 transition">
              <Pencil size={15} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(expense.id); }}
              className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition">
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded OCR data */}
      {expanded && (
        <tr className="bg-orange-50/50">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {expense.notes && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-0.5">Notes</p>
                  <p className="text-gray-700">{expense.notes}</p>
                </div>
              )}
              {expense.ocr_vendor_name && (
                <div>
                  <p className="text-xs text-blue-400 font-medium mb-0.5">🤖 OCR Vendor</p>
                  <p className="text-gray-700">{expense.ocr_vendor_name}</p>
                </div>
              )}
              {expense.ocr_amount && (
                <div>
                  <p className="text-xs text-blue-400 font-medium mb-0.5">🤖 OCR Amount</p>
                  <p className="text-gray-700">{fmtPKR(expense.ocr_amount)}</p>
                </div>
              )}
              {expense.bills?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-medium mb-1">Bills</p>
                  <div className="flex gap-2 flex-wrap">
                    {expense.bills.map((bill) => (
                      <a
                        key={bill.id}
                        href={bill.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50"
                      >
                        {bill.file_type?.startsWith('image') ? <Image size={12} /> : <FileText size={12} />}
                        {bill.file_name?.substring(0, 20) || 'View Bill'}
                        {bill.ocr_done && <span className="text-blue-500">✓</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Expenses Page ──
export default function Expenses() {
  const [showAdd, setShowAdd] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportPeriod, setReportPeriod] = useState('monthly');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', { search, category, fromDate, toDate }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search)   params.set('search', search);
      if (category) params.set('category', category);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate)   params.set('to_date', toDate);
      return (await api.get(`/expenses?${params}`)).data;
    },
  });

  const { data: reportData } = useQuery({
    queryKey: ['expense-report', reportPeriod],
    queryFn: () => api.get(`/expenses/report?period=${reportPeriod}`).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/expenses/${id}`),
    onSuccess: () => { qc.invalidateQueries(['expenses']); toast.success('Deleted'); },
    onError: () => toast.error('Delete failed'),
  });

  const summary = data?.summary || {};
  const expenses = data?.data || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Office Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all office and operational expenses</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Total This Month</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{fmtPKR(summary.total_amount || 0)}</p>
            </div>
            <div className="bg-red-50 p-2.5 rounded-lg"><TrendingDown size={20} className="text-red-500" /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Transactions</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{data?.pagination?.total || 0}</p>
            </div>
            <div className="bg-blue-50 p-2.5 rounded-lg"><BarChart3 size={20} className="text-blue-500" /></div>
          </div>
        </div>
        {CATEGORIES.slice(0, 2).map(cat => {
          const breakdown = summary.category_breakdown || {};
          return (
            <div key={cat.value} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div>
                <p className="text-xs text-gray-500 font-medium">{cat.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{fmtPKR(breakdown[cat.value] || 0)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search expenses..."
              className="flex-1 text-sm border-none outline-none"
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Expense Records</h2>
          <span className="text-xs text-gray-400">{expenses.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Title', 'Category', 'Amount', 'Date', 'Method', 'Paid By', 'Bills / OCR', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(8).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <DollarSign size={40} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No expenses found</p>
                    <p className="text-gray-300 text-sm mt-1">Click "Add Expense" to record one</p>
                  </td>
                </tr>
              ) : (
                expenses.map(exp => (
                  <ExpenseRow
                    key={exp.id}
                    expense={exp}
                    onEdit={setEditExpense}
                    onDelete={(id) => {
                      if (window.confirm('Delete this expense?')) deleteMutation.mutate(id);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <AddExpenseModal open={showAdd} onClose={() => setShowAdd(false)} />
      {editExpense && <EditExpenseModal expense={editExpense} onClose={() => setEditExpense(null)} />}
    </div>
  );
}
