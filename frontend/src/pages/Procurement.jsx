// src/pages/Procurement.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Package, Plus, X, Loader, Search, ShoppingCart } from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';

function AddVendorModal({ open, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();
  const mutation = useMutation({
    mutationFn: d => api.post('/vendors', d),
    onSuccess: () => { toast.success('Vendor added!'); qc.invalidateQueries(['vendors']); reset(); onClose(); },
    onError: err => toast.error(err.response?.data?.error || 'Failed'),
  });
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Add Vendor</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Vendor Name *</label>
              <input {...register('name', { required: true })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Contact Person</label>
              <input {...register('contact_name')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Phone</label>
              <input {...register('phone')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category</label>
              <select {...register('category')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
                <option>Construction Materials</option><option>Electrical</option><option>Plumbing</option>
                <option>Furniture</option><option>IT Equipment</option><option>Services</option><option>Other</option>
              </select></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
              <input {...register('email')} type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {mutation.isPending && <Loader size={16} className="animate-spin" />} Add Vendor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewPOModal({ open, onClose }) {
  const qc = useQueryClient();
  const [items, setItems] = useState([{ item_name: '', description: '', quantity: 1, unit: 'pcs', unit_price: 0 }]);
  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { vendor_id: '', order_date: new Date().toISOString().slice(0, 10), delivery_date: '', notes: '' },
  });

  const { data: vendorData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors?limit=100').then(r => r.data),
    enabled: open,
  });
  const vendors = vendorData?.data || [];

  const mutation = useMutation({
    mutationFn: d => api.post('/procurement/orders', d),
    onSuccess: () => { toast.success('Purchase order created!'); qc.invalidateQueries(['purchase-orders']); reset(); setItems([{ item_name: '', description: '', quantity: 1, unit: 'pcs', unit_price: 0 }]); onClose(); },
    onError: err => toast.error(err.response?.data?.error || 'Failed to create PO'),
  });

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };
  const addItem = () => setItems(prev => [...prev, { item_name: '', description: '', quantity: 1, unit: 'pcs', unit_price: 0 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const tax = subtotal * 0.17;
  const total = subtotal + tax;

  const onSubmit = (formData) => {
    if (!formData.vendor_id) return toast.error('Please select a vendor');
    if (items.some(it => !it.item_name)) return toast.error('All items must have a name');
    mutation.mutate({ ...formData, items });
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">New Purchase Order</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Vendor *</label>
                <select {...register('vendor_id', { required: true })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
                  <option value="">Select vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Order Date</label>
                <input {...register('order_date')} type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Expected Delivery</label>
                <input {...register('delivery_date')} type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Notes</label>
                <textarea {...register('notes')} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none" />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Items *</label>
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-orange-500 font-medium hover:underline"><Plus size={12} /> Add Item</button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b border-gray-200">
                    {['Item Name', 'Qty', 'Unit', 'Unit Price (PKR)', ''].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500 font-semibold">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1.5"><input value={it.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)} placeholder="Item name" className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-orange-400" /></td>
                        <td className="px-2 py-1.5 w-16"><input type="number" min="1" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-orange-400" /></td>
                        <td className="px-2 py-1.5 w-20"><select value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-orange-400">
                          {['pcs', 'kg', 'ton', 'ltr', 'bag', 'set', 'mtr', 'sqft'].map(u => <option key={u}>{u}</option>)}
                        </select></td>
                        <td className="px-2 py-1.5 w-32"><input type="number" min="0" step="0.01" value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-orange-400" /></td>
                        <td className="px-2 py-1.5 w-8">
                          {items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>PKR {subtotal.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-gray-600"><span>GST (17%)</span><span>PKR {tax.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1.5"><span>Total</span><span>PKR {total.toLocaleString('en-PK', { maximumFractionDigits: 2 })}</span></div>
            </div>
          </div>

          <div className="flex gap-3 p-6 border-t border-gray-100 flex-shrink-0">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {mutation.isPending && <Loader size={16} className="animate-spin" />} Create PO
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Procurement() {
  const [tab, setTab] = useState('vendors');
  const [showAdd, setShowAdd] = useState(false);
  const [showNewPO, setShowNewPO] = useState(false);

  const { data: vendorData, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors?limit=50').then(r => r.data),
    enabled: tab === 'vendors',
  });

  const { data: poData } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: () => api.get('/procurement/orders?limit=50').then(r => r.data),
    enabled: tab === 'orders',
  });

  const vendors = vendorData?.data || [];
  const orders = poData?.data || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Procurement</h1><p className="text-sm text-gray-500 mt-0.5">Vendor management and purchase orders</p></div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> Add Vendor
        </button>
      </div>

      <div className="flex gap-2">
        {['vendors', 'orders'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${tab === t ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t === 'vendors' ? '👥 Vendors' : '📋 Purchase Orders'}
          </button>
        ))}
      </div>

      {tab === 'vendors' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Vendors ({vendors.length})</h2>
          </div>
          {isLoading ? <div className="p-6"><div className="h-40 bg-gray-100 rounded animate-pulse" /></div>
          : vendors.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Package size={40} className="mx-auto mb-3 text-gray-200" /><p>No vendors yet</p>
              <button onClick={() => setShowAdd(true)} className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">Add First Vendor</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">{['Vendor', 'Category', 'Phone', 'Email', 'Rating', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {vendors.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{v.name}</div><div className="text-xs text-gray-400">{v.contact_name}</div></td>
                    <td className="px-4 py-3 text-gray-600">{v.category}</td>
                    <td className="px-4 py-3 text-gray-600">{v.phone}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{v.email}</td>
                    <td className="px-4 py-3">{'★'.repeat(v.rating || 3)}{'☆'.repeat(5 - (v.rating || 3))}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{v.is_active ? 'Active' : 'Inactive'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Purchase Orders</h2>
            <button onClick={() => setShowNewPO(true)} className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium"><Plus size={14} /> New PO</button>
          </div>
          {orders.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <ShoppingCart size={40} className="mx-auto mb-3 text-gray-200" /><p>No purchase orders</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">{['PO #', 'Vendor', 'Date', 'Total', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr></thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-orange-500">{o.po_number}</td>
                    <td className="px-4 py-3 font-medium">{o.vendor_name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(o.order_date)}</td>
                    <td className="px-4 py-3 font-semibold">{fmtPKR(o.total_amount)}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <AddVendorModal open={showAdd} onClose={() => setShowAdd(false)} />
      <NewPOModal open={showNewPO} onClose={() => setShowNewPO(false)} />
    </div>
  );
}
