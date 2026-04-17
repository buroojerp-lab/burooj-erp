// src/pages/Customers.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, X, Loader, Phone, Mail,
  MapPin, CreditCard, Eye, MessageCircle, Download,
  TrendingUp, Building2, Clock, Pencil, Home, Store,
  Layers, CheckCircle, Filter, Grid, ArrowRight, ArrowLeft,
  Tag, ChevronRight, Trash2
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';

// ── Add Customer Modal (2-step wizard) ──
function AddCustomerModal({ open, onClose }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [custData, setCustData] = useState(null);
  const [saving, setSaving] = useState(false);

  // Step 2 booking state
  const [towerId,  setTowerId]  = useState('');
  const [floorId,  setFloorId]  = useState('');
  const [unitId,   setUnitId]   = useState('');
  const [planId,   setPlanId]   = useState('');
  const [bookDate, setBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  // Fetch data for step 2 (only when step===2)
  const { data: towersData } = useQuery({
    queryKey: ['towers'],
    queryFn: () => api.get('/property/towers').then(r => r.data),
    enabled: step === 2,
  });
  const { data: floorsData } = useQuery({
    queryKey: ['floors', towerId],
    queryFn: () => api.get(`/property/floors?tower_id=${towerId}`).then(r => r.data),
    enabled: step === 2 && !!towerId,
  });
  const { data: unitsData } = useQuery({
    queryKey: ['units-avail', towerId, floorId],
    queryFn: () => api.get('/property/units', { params: { tower_id: towerId, floor_id: floorId || undefined, status: 'available', limit: 100 } }).then(r => r.data),
    enabled: step === 2 && !!towerId,
  });
  const { data: plansData } = useQuery({
    queryKey: ['payment-plans'],
    queryFn: () => api.get('/bookings/payment-plans').then(r => r.data),
    enabled: step === 2,
  });

  const towers = towersData?.data || [];
  const floors = floorsData?.data || [];
  const units  = unitsData?.data || [];
  const plans  = plansData?.data || [];

  const selectedUnit = units.find(u => u.id === unitId);

  const handleClose = () => {
    reset(); setStep(1); setCustData(null);
    setTowerId(''); setFloorId(''); setUnitId(''); setPlanId('');
    setDiscount(''); setBookDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  // Step 1 → Step 2
  const onStep1Submit = (data) => {
    setCustData(data);
    setStep(2);
  };

  // Save customer only (skip booking)
  const saveCustomerOnly = async () => {
    setSaving(true);
    try {
      await api.post('/customers', custData);
      toast.success('Customer added!');
      qc.invalidateQueries(['customers']);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save customer');
    } finally { setSaving(false); }
  };

  // Save customer + create booking
  const saveWithBooking = async () => {
    if (!unitId || !planId) {
      toast.error('Please select a unit and payment plan');
      return;
    }
    setSaving(true);
    try {
      const custRes = await api.post('/customers', custData);
      const customer_id = custRes.data.customer?.id || custRes.data.id;
      await api.post('/bookings', {
        customer_id,
        unit_id: unitId,
        payment_plan_id: planId,
        booking_date: bookDate,
        discount_amount: parseFloat(discount) || 0,
      });
      toast.success('Customer & booking created!');
      qc.invalidateQueries(['customers']);
      qc.invalidateQueries(['bookings']);
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">
              {step === 1 ? 'Add New Customer' : 'Unit & Project Details'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-6 h-1.5 rounded-full ${step >= 1 ? 'bg-orange-500' : 'bg-gray-200'}`} />
              <div className={`w-6 h-1.5 rounded-full ${step >= 2 ? 'bg-orange-500' : 'bg-gray-200'}`} />
              <span className="text-xs text-gray-400 ml-1">Step {step} of 2</span>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {/* ── STEP 1: Personal Info ── */}
        {step === 1 && (
          <form onSubmit={handleSubmit(onStep1Submit)} className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
            <div className="col-span-2">
              <label className="label-sm">Full Name *</label>
              <input {...register('name', { required: true })} placeholder="Muhammad Ali" className="input-field" />
            </div>
            <div>
              <label className="label-sm">CNIC *</label>
              <input {...register('cnic', { required: true })} placeholder="35201-XXXXXXX-X" className="input-field" />
            </div>
            <div>
              <label className="label-sm">Phone *</label>
              <input {...register('phone', { required: true })} type="tel" placeholder="0300-XXXXXXX" className="input-field" />
            </div>
            <div>
              <label className="label-sm">Email</label>
              <input {...register('email')} type="email" placeholder="email@example.com" className="input-field" />
            </div>
            <div>
              <label className="label-sm">City</label>
              <input {...register('city')} placeholder="Lahore" className="input-field" />
            </div>
            <div>
              <label className="label-sm">Occupation</label>
              <input {...register('occupation')} placeholder="Business" className="input-field" />
            </div>
            <div>
              <label className="label-sm">Nationality</label>
              <input {...register('nationality')} placeholder="Pakistani" className="input-field" />
            </div>
            <div>
              <label className="label-sm">NTN</label>
              <input {...register('ntn')} placeholder="National Tax Number" className="input-field" />
            </div>
            <div>
              <label className="label-sm">Lead Source</label>
              <select {...register('lead_source')} className="input-field">
                <option value="">Select...</option>
                <option>Referral</option><option>Social Media</option>
                <option>Walk-in</option><option>Online Ad</option>
                <option>Agent</option><option>Exhibition</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-sm">Address</label>
              <textarea {...register('address')} rows={2} placeholder="Full address..." className="input-field resize-none" />
            </div>
            <div className="col-span-2">
              <label className="label-sm">Notes</label>
              <textarea {...register('notes')} rows={2} placeholder="Any additional notes..." className="input-field resize-none" />
            </div>
            <div className="col-span-2 flex gap-3 pt-2">
              <button type="button" onClick={handleClose}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">
                Cancel
              </button>
              <button type="submit"
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                Next: Unit Details <ArrowRight size={15} />
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 2: Unit & Project Details ── */}
        {step === 2 && (
          <div className="p-6 space-y-4 overflow-y-auto">

            {/* Customer summary pill */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {custData?.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{custData?.name}</p>
                <p className="text-xs text-gray-500">{custData?.cnic} · {custData?.phone}</p>
              </div>
              <span className="ml-auto text-xs text-orange-500 font-medium">Step 2</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Tower / Project */}
              <div className="col-span-2">
                <label className="label-sm">Project / Tower *</label>
                <select value={towerId} onChange={e => { setTowerId(e.target.value); setFloorId(''); setUnitId(''); }}
                  className="input-field">
                  <option value="">— Select Project —</option>
                  {towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Floor */}
              <div>
                <label className="label-sm">Floor</label>
                <select value={floorId} onChange={e => { setFloorId(e.target.value); setUnitId(''); }}
                  disabled={!towerId} className="input-field disabled:opacity-50">
                  <option value="">— All Floors —</option>
                  {floors.map(f => <option key={f.id} value={f.id}>Floor {f.floor_no}{f.name ? ` – ${f.name}` : ''}</option>)}
                </select>
              </div>

              {/* Unit */}
              <div>
                <label className="label-sm">Available Unit *</label>
                <select value={unitId} onChange={e => setUnitId(e.target.value)}
                  disabled={!towerId} className="input-field disabled:opacity-50">
                  <option value="">— Select Unit —</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.unit_number} · {u.unit_type} · {fmtPKR(u.total_price)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected unit info card */}
            {selectedUnit && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-xs">
                <div><p className="text-gray-400">Type</p><p className="font-bold text-gray-800 capitalize">{selectedUnit.unit_type}</p></div>
                <div><p className="text-gray-400">Floor</p><p className="font-bold text-gray-800">Floor {selectedUnit.floor_no}</p></div>
                <div><p className="text-gray-400">Size</p><p className="font-bold text-gray-800">{selectedUnit.size_sqft} sqft</p></div>
                <div className="col-span-3 pt-2 border-t border-gray-200">
                  <p className="text-gray-400">Total Price</p>
                  <p className="font-extrabold text-orange-600 text-base">{fmtPKR(selectedUnit.total_price)}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Payment Plan */}
              <div className="col-span-2">
                <label className="label-sm">Payment Plan *</label>
                <select value={planId} onChange={e => setPlanId(e.target.value)} className="input-field">
                  <option value="">— Select Plan —</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.down_payment_pct}% down · {p.installment_months > 0 ? `${p.installment_months} months` : 'Full payment'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Booking Date */}
              <div>
                <label className="label-sm">Booking Date</label>
                <input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} className="input-field" />
              </div>

              {/* Discount */}
              <div>
                <label className="label-sm">Discount (PKR)</label>
                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
                  placeholder="0" className="input-field" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
                <ArrowLeft size={14} /> Back
              </button>
              <button type="button" onClick={saveCustomerOnly} disabled={saving}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
                {saving && <Loader size={14} className="animate-spin" />}
                Save Without Booking
              </button>
              <button type="button" onClick={saveWithBooking} disabled={saving || !unitId || !planId}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                {saving && <Loader size={14} className="animate-spin" />}
                <CheckCircle size={15} /> Save & Book Unit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit Customer Modal ──
function EditCustomerModal({ customer, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm({ defaultValues: {
    name: customer.name, cnic: customer.cnic, phone: customer.phone,
    email: customer.email, city: customer.city, occupation: customer.occupation,
    lead_source: customer.lead_source, address: customer.address,
    nationality: customer.nationality, ntn: customer.ntn, notes: customer.notes,
  }});

  const editMutation = useMutation({
    mutationFn: (d) => api.put(`/customers/${customer.id}`, d),
    onSuccess: () => { toast.success('Customer updated!'); qc.invalidateQueries(['customers']); onClose(); },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">Edit Customer — {customer.name}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => editMutation.mutate(d))} className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
          <div className="col-span-2">
            <label className="label-sm">Full Name *</label>
            <input {...register('name', { required: true })} className="input-field" />
          </div>
          <div>
            <label className="label-sm">CNIC *</label>
            <input {...register('cnic', { required: true })} className="input-field" />
          </div>
          <div>
            <label className="label-sm">Phone *</label>
            <input {...register('phone', { required: true })} type="tel" className="input-field" />
          </div>
          <div>
            <label className="label-sm">Email</label>
            <input {...register('email')} type="email" className="input-field" />
          </div>
          <div>
            <label className="label-sm">City</label>
            <input {...register('city')} className="input-field" />
          </div>
          <div>
            <label className="label-sm">Occupation</label>
            <input {...register('occupation')} className="input-field" />
          </div>
          <div>
            <label className="label-sm">Nationality</label>
            <input {...register('nationality')} placeholder="Pakistani" className="input-field" />
          </div>
          <div>
            <label className="label-sm">NTN</label>
            <input {...register('ntn')} placeholder="National Tax Number" className="input-field" />
          </div>
          <div>
            <label className="label-sm">Lead Source</label>
            <select {...register('lead_source')} className="input-field">
              <option value="">Select...</option>
              <option>Referral</option><option>Social Media</option>
              <option>Walk-in</option><option>Online Ad</option>
              <option>Agent</option><option>Exhibition</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label-sm">Address</label>
            <textarea {...register('address')} rows={2} className="input-field resize-none" />
          </div>
          <div className="col-span-2">
            <label className="label-sm">Notes</label>
            <textarea {...register('notes')} rows={2} className="input-field resize-none" />
          </div>
          <div className="col-span-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" disabled={editMutation.isPending} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
              {editMutation.isPending && <Loader size={15} className="animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Customer Row ──
function CustomerRow({ customer, onEdit, onDelete }) {
  const sendWA = () => {
    const phone = customer.phone?.replace(/[^0-9]/g, '').replace(/^0/, '92');
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {customer.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-gray-900">{customer.name}</div>
            <div className="text-xs text-gray-400 font-mono">{customer.cnic}</div>
            {customer.nationality && <div className="text-xs text-gray-400">{customer.nationality}</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-gray-700 text-sm">
          <Phone size={13} className="text-gray-400" />{customer.phone}
        </div>
        {customer.email && (
          <div className="flex items-center gap-1.5 text-gray-400 text-xs mt-0.5">
            <Mail size={11} />{customer.email}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {customer.city || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {customer.lead_source || '—'}
      </td>
      {/* Project column */}
      <td className="px-4 py-3">
        {customer.tower_name ? (
          <div>
            <div className="font-medium text-gray-800 text-sm">{customer.tower_name}</div>
            <div className="text-xs text-gray-400">Floor {customer.floor_no}</div>
          </div>
        ) : (
          <span className="text-gray-300 text-sm">—</span>
        )}
      </td>
      {/* Unit Details column */}
      <td className="px-4 py-3">
        {customer.unit_number ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-900 text-sm">{customer.unit_number}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                customer.booking_status === 'active'    ? 'bg-green-100 text-green-700' :
                customer.booking_status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                customer.booking_status === 'completed' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-500'
              }`}>{customer.booking_status}</span>
            </div>
            <div className="text-xs text-gray-400 capitalize">{customer.unit_type}{customer.size_sqft ? ` · ${customer.size_sqft} sqft` : ''}</div>
            <div className="text-xs text-gray-500">Total: <span className="font-semibold text-gray-700">{fmtPKR(customer.final_price)}</span></div>
            <div className="text-xs text-emerald-600 font-medium">Paid: {fmtPKR(customer.total_paid)}</div>
            <div className="text-xs text-orange-600 font-medium">Balance: {fmtPKR(Math.max(0, parseFloat(customer.final_price||0) - parseFloat(customer.total_paid||0)))}</div>
          </div>
        ) : (
          <Link to="/bookings/new" className="text-xs text-orange-500 hover:underline font-medium">+ Add Booking</Link>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {fmtDate(customer.created_at)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Link to={`/customers/${customer.id}`}
            className="p-1.5 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition">
            <Eye size={15} />
          </Link>
          <button onClick={() => onEdit(customer)}
            className="p-1.5 rounded-lg hover:bg-orange-100 text-gray-400 hover:text-orange-500 transition">
            <Pencil size={15} />
          </button>
          <button onClick={sendWA}
            className="p-1.5 rounded-lg hover:bg-green-100 text-gray-400 hover:text-green-600 transition">
            <MessageCircle size={15} />
          </button>
          <button onClick={() => onDelete(customer)}
            className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition">
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Unit Inventory (embedded in Customers) ──
const STATUS_CONFIG = {
  available:   { label: 'Available',   color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  reserved:    { label: 'Reserved',    color: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-500' },
  sold:        { label: 'Sold',        color: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
  maintenance: { label: 'Maintenance', color: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400' },
};
const TYPE_ICONS = { apartment: Home, shop: Store, office: Building2, penthouse: Layers };

function UnitInventory() {
  const [unitSearch, setUnitSearch] = useState('');
  const [towerFilter, setTowerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('available');
  const navigate = typeof window !== 'undefined' ? null : null;

  const { data: towersData } = useQuery({ queryKey: ['towers'], queryFn: () => api.get('/property/towers').then(r => r.data) });
  const { data: unitsData, isLoading } = useQuery({
    queryKey: ['units-inventory', towerFilter, statusFilter],
    queryFn: () => api.get('/property/units', { params: { tower_id: towerFilter || undefined, status: statusFilter || undefined, limit: 100 } }).then(r => r.data),
  });

  const towers = towersData?.data || [];
  const allUnits = unitsData?.data || [];
  const units = unitSearch ? allUnits.filter(u => u.unit_number?.toLowerCase().includes(unitSearch.toLowerCase())) : allUnits;

  const counts = allUnits.reduce((a, u) => { a[u.status] = (a[u.status]||0)+1; return a; }, {});

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).map(([s, cfg]) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter===s?'':s)}
            className={`p-4 rounded-xl border-2 text-left transition-all shadow-sm ${statusFilter===s?'border-orange-500 bg-orange-50':'border-gray-100 bg-white hover:border-gray-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{counts[s]||0}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-52">
          <Search size={15} className="text-gray-400" />
          <input value={unitSearch} onChange={e=>setUnitSearch(e.target.value)} placeholder="Search unit number..." className="text-sm border-none outline-none flex-1" />
          {unitSearch && <button onClick={()=>setUnitSearch('')}><X size={14} className="text-gray-400" /></button>}
        </div>
        <select value={towerFilter} onChange={e=>setTowerFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="">All Towers</option>
          {towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <Link to="/bookings/new" className="ml-auto flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
          <Plus size={16} /> New Booking
        </Link>
      </div>

      {/* Units Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array(8).fill(0).map((_,i)=><div key={i} className="h-44 bg-gray-100 rounded-xl animate-pulse"/>)}</div>
      ) : units.length === 0 ? (
        <div className="py-20 text-center text-gray-400"><Building2 size={48} className="mx-auto mb-3 text-gray-200"/><p>No units found</p></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {units.map(unit => {
            const TypeIcon = TYPE_ICONS[unit.unit_type] || Building2;
            const sc = STATUS_CONFIG[unit.status] || STATUS_CONFIG.available;
            return (
              <Link key={unit.id} to={`/properties/units/${unit.id}`}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden group">
                <div className={`h-1.5 ${unit.status==='available'?'bg-emerald-500':unit.status==='sold'?'bg-red-500':unit.status==='reserved'?'bg-yellow-500':'bg-gray-300'}`}/>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center"><TypeIcon size={18} className="text-orange-500"/></div>
                      <div>
                        <div className="font-bold text-gray-900">{unit.unit_number}</div>
                        <div className="text-xs text-gray-400 capitalize">{unit.unit_type}</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{sc.label}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex justify-between"><span>Tower</span><span className="font-medium text-gray-700">{unit.tower_name}</span></div>
                    <div className="flex justify-between"><span>Floor</span><span className="font-medium text-gray-700">Floor {unit.floor_no}</span></div>
                    <div className="flex justify-between"><span>Size</span><span className="font-medium text-gray-700">{unit.size_sqft} sqft</span></div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-base font-bold text-gray-900">{fmtPKR(unit.total_price)}</div>
                    <div className="text-xs text-gray-400">PKR {parseInt(unit.price_per_sqft||0).toLocaleString('en-PK')}/sqft</div>
                    {unit.status==='sold' && unit.customer_name && <div className="text-xs text-gray-400 mt-1 truncate">Owner: {unit.customer_name}</div>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Customers() {
  const [tab, setTab] = useState('customers');
  const [showAdd, setShowAdd] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success('Customer deleted');
      qc.invalidateQueries(['customers']);
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Delete failed'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, source, page }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      if (source) params.set('lead_source', source);
      return (await api.get(`/customers?${params}`)).data;
    },
  });

  const customers = data?.data || [];
  const pg = data?.pagination || {};
  const stats = data?.stats || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {tab === 'customers' ? 'Customers' : 'Unit Inventory'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tab === 'customers' ? 'Customer relationship management' : 'Browse available units across all towers'}
          </p>
        </div>
        <div className="flex gap-3">
          {tab === 'customers' && <>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Download size={16} /> Export
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
              <Plus size={16} /> Add Customer
            </button>
          </>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ key: 'customers', label: 'Customers', icon: Users }, { key: 'units', label: 'Unit Inventory', icon: Building2 }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab===t.key?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'units' && <UnitInventory />}

      {tab === 'customers' && <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: pg.total || 0, icon: Users, color: 'blue' },
          { label: 'With Bookings',   value: stats.with_bookings || 0, icon: Building2, color: 'green' },
          { label: 'This Month',      value: stats.this_month || 0, icon: Clock, color: 'orange' },
          { label: 'Conversion Rate', value: `${stats.conversion_rate || 0}%`, icon: TrendingUp, color: 'purple' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-lg bg-${s.color}-50`}>
              <s.icon size={20} className={`text-${s.color}-500`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-60">
          <Search size={15} className="text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name, CNIC or phone..." className="text-sm border-none outline-none flex-1" />
          {search && <button onClick={() => setSearch('')}><X size={14} className="text-gray-400" /></button>}
        </div>
        <select value={source} onChange={e => setSource(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="">All Sources</option>
          <option>Referral</option><option>Social Media</option>
          <option>Walk-in</option><option>Online Ad</option><option>Agent</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Customer List</h2>
          <span className="text-xs text-gray-400">{pg.total || 0} customers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Customer', 'Contact', 'City', 'Source', 'Project', 'Unit Details', 'Joined', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? Array(8).fill(0).map((_, i) => (
                <tr key={i}>{Array(8).fill(0).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              )) : customers.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center">
                  <Users size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">No customers found</p>
                </td></tr>
              ) : customers.map(c => <CustomerRow key={c.id} customer={c} onEdit={setEditCustomer} onDelete={setDeleteTarget} />)}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pg.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              {(pg.page - 1) * pg.limit + 1}–{Math.min(pg.page * pg.limit, pg.total)} of {pg.total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p => Math.min(pg.pages, p + 1))} disabled={page === pg.pages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      </>}

      <AddCustomerModal open={showAdd} onClose={() => setShowAdd(false)} />
      {editCustomer && <EditCustomerModal customer={editCustomer} onClose={() => setEditCustomer(null)} />}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Customer</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-1">
              Are you sure you want to delete <span className="font-semibold">{deleteTarget.name}</span>?
            </p>
            {deleteTarget.booking_id && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">
                ⚠ This customer has an active booking. Cancel the booking first before deleting.
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                {deleteMutation.isPending ? <Loader size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
