// src/pages/Properties.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Building2, Plus, Search, Filter, Grid, List,
  Home, Store, Layers, X, Loader, CheckCircle,
  AlertCircle, Clock, Wrench, Eye, Pencil,
  Merge, RotateCcw, DollarSign, Trash2, Settings
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR } from '../utils/format';

const STATUS_CONFIG = {
  available:   { label: 'Available',   color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  reserved:    { label: 'Reserved',    color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  sold:        { label: 'Sold',        color: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
  maintenance: { label: 'Maintenance', color: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400' },
  merged:      { label: 'Merged',      color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
};

const TYPE_ICONS = {
  apartment:  Home,
  shop:       Store,
  office:     Building2,
  penthouse:  Layers,
  commercial: Store,
};

const UNIT_TYPE_LABELS = {
  apartment:  'Apartment',
  shop:       'Shop',
  office:     'Office',
  penthouse:  'Penthouse',
  commercial: 'Commercial',
};

const formatFloorLabel = (floorNo) => {
  const n = parseInt(floorNo);
  if (n === -1) return 'Lower Ground';
  if (n === 0)  return 'Ground Floor';
  return `Floor ${n}`;
};

// ── Add Unit Modal ──
function AddUnitModal({ open, onClose, towers, floors }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { unit_type: 'apartment', status: 'available', bedrooms: 1, bathrooms: 1 }
  });

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/property/units', data),
    onSuccess: () => {
      toast.success('Unit added!');
      qc.invalidateQueries(['units']);
      reset();
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const selectedTower = watch('tower_id');
  const selectedType  = watch('unit_type');
  const isCommercial  = ['shop', 'office', 'commercial'].includes(selectedType);
  const filteredFloors = floors?.filter(f => f.tower_id === selectedTower) || [];

  const VIRTUAL_FLOORS = [
    { virtual: true, floor_no: -1, label: 'Lower Ground' },
    { virtual: true, floor_no:  0, label: 'Ground Floor'  },
  ];
  const displayFloors = [
    ...VIRTUAL_FLOORS.filter(vf => !filteredFloors.some(f => parseInt(f.floor_no) === vf.floor_no)),
    ...filteredFloors.slice().sort((a, b) => parseInt(a.floor_no) - parseInt(b.floor_no)),
  ];

  const onSubmit = async (data) => {
    // Normalize commercial units: no bedrooms/bathrooms
    const isComm = ['shop', 'office', 'commercial'].includes(data.unit_type);
    data.bedrooms  = isComm ? 0 : (parseInt(data.bedrooms)  || 0);
    data.bathrooms = isComm ? 0 : (parseInt(data.bathrooms) || 1);

    let { floor_id } = data;
    if (!floor_id) { toast.error('Please select a floor'); return; }

    if (typeof floor_id === 'string' && floor_id.startsWith('__vf_')) {
      const floor_no = parseInt(floor_id.replace(/__vf_|__/g, ''));
      try {
        const res = await api.post('/property/floors', { tower_id: data.tower_id, floor_no, name: null });
        floor_id = res.data.floor.id;
        qc.invalidateQueries(['floors']);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to create floor');
        return;
      }
    }
    addMutation.mutate({ ...data, floor_id });
  };

  if (!open) return null;

  const size = parseFloat(watch('size_sqft') || 0);
  const rate = parseFloat(watch('price_per_sqft') || 0);
  const total = size * rate;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Add New Unit</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Unit Number */}
            <div>
              <label className="label-sm">Unit Number *</label>
              <input {...register('unit_number', { required: true })}
                placeholder="e.g. A-101" className="input-field" />
            </div>

            {/* Unit Type */}
            <div>
              <label className="label-sm">Unit Type *</label>
              <select {...register('unit_type')} className="input-field">
                <optgroup label="Residential">
                  <option value="apartment">Apartment</option>
                  <option value="penthouse">Penthouse</option>
                </optgroup>
                <optgroup label="Commercial">
                  <option value="shop">Shop</option>
                  <option value="office">Office</option>
                  <option value="commercial">Commercial</option>
                </optgroup>
              </select>
            </div>

            {/* Tower */}
            <div>
              <label className="label-sm">Tower *</label>
              <select {...register('tower_id', { required: true })} className="input-field">
                <option value="">Select Tower</option>
                {towers?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Floor */}
            <div>
              <label className="label-sm">Floor *</label>
              <select {...register('floor_id', { required: true })} className="input-field">
                <option value="">Select Floor</option>
                {displayFloors.map(f =>
                  f.virtual
                    ? <option key={`vf_${f.floor_no}`} value={`__vf_${f.floor_no}__`}>{f.label}</option>
                    : <option key={f.id} value={f.id}>{formatFloorLabel(f.floor_no)}</option>
                )}
              </select>
            </div>

            {/* Size */}
            <div>
              <label className="label-sm">Size (sqft) *</label>
              <input {...register('size_sqft', { required: true, min: 1 })}
                type="number" placeholder="850" className="input-field" />
            </div>

            {/* Price per sqft */}
            <div>
              <label className="label-sm">Price per sqft (PKR) *</label>
              <input {...register('price_per_sqft', { required: true, min: 1 })}
                type="number" placeholder="12000" className="input-field" />
            </div>

            {/* Bedrooms — hidden for commercial types */}
            {!isCommercial && (
              <div>
                <label className="label-sm">Bedrooms</label>
                <select {...register('bedrooms')} className="input-field">
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n === 0 ? 'Studio' : n}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Bathrooms — hidden for commercial types */}
            {!isCommercial && (
              <div>
                <label className="label-sm">Bathrooms</label>
                <select {...register('bathrooms')} className="input-field">
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="label-sm">Status</label>
              <select {...register('status')} className="input-field">
                <option value="available">Available</option>
                <option value="maintenance">Under Maintenance</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="label-sm">Description</label>
              <input {...register('description')} placeholder="Optional notes..." className="input-field" />
            </div>
          </div>

          {/* Price Preview */}
          {total > 0 && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-between">
              <div className="text-sm text-orange-700">
                <span className="font-medium">{size} sqft</span> × <span className="font-medium">{fmtPKR(rate)}/sqft</span>
              </div>
              <div className="text-lg font-bold text-orange-600">
                Total: {fmtPKR(total)}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={addMutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
              {addMutation.isPending ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
              Add Unit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Unit Modal ──
function EditUnitModal({ unit, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch } = useForm({ defaultValues: {
    unit_number: unit.unit_number, unit_type: unit.unit_type,
    size_sqft: unit.size_sqft, price_per_sqft: unit.price_per_sqft,
    bedrooms: unit.bedrooms, bathrooms: unit.bathrooms,
    status: unit.status, description: unit.description,
  }});

  const editMutation = useMutation({
    mutationFn: (d) => api.put(`/property/units/${unit.id}`, d),
    onSuccess: () => { toast.success('Unit updated!'); qc.invalidateQueries(['units']); onClose(); },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const editType         = watch('unit_type');
  const isEditCommercial = ['shop', 'office', 'commercial'].includes(editType);
  const size = parseFloat(watch('size_sqft') || 0);
  const rate = parseFloat(watch('price_per_sqft') || 0);
  const total = size * rate;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Edit Unit — {unit.unit_number}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => editMutation.mutate(d))} className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-sm">Unit Number *</label>
              <input {...register('unit_number', { required: true })} className="input-field" />
            </div>
            <div>
              <label className="label-sm">Unit Type</label>
              <select {...register('unit_type')} className="input-field">
                <optgroup label="Residential">
                  <option value="apartment">Apartment</option>
                  <option value="penthouse">Penthouse</option>
                </optgroup>
                <optgroup label="Commercial">
                  <option value="shop">Shop</option>
                  <option value="office">Office</option>
                  <option value="commercial">Commercial</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="label-sm">Size (sqft)</label>
              <input {...register('size_sqft')} type="number" className="input-field" />
            </div>
            <div>
              <label className="label-sm">Price per sqft (PKR)</label>
              <input {...register('price_per_sqft')} type="number" className="input-field" />
            </div>
            {!isEditCommercial && (
              <div>
                <label className="label-sm">Bedrooms</label>
                <select {...register('bedrooms')} className="input-field">
                  {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n === 0 ? 'Studio' : n}</option>)}
                </select>
              </div>
            )}
            {!isEditCommercial && (
              <div>
                <label className="label-sm">Bathrooms</label>
                <select {...register('bathrooms')} className="input-field">
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label-sm">Status</label>
              <select {...register('status')} className="input-field">
                <option value="available">Available</option>
                <option value="reserved">Reserved</option>
                <option value="maintenance">Under Maintenance</option>
              </select>
            </div>
            <div>
              <label className="label-sm">Description</label>
              <input {...register('description')} className="input-field" />
            </div>
          </div>
          {total > 0 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl flex justify-between text-sm">
              <span className="text-orange-700">{size} sqft × {fmtPKR(rate)}/sqft</span>
              <span className="font-bold text-orange-600">{fmtPKR(total)}</span>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" disabled={editMutation.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
              {editMutation.isPending && <Loader size={16} className="animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Unit Card (Grid View) ──
function UnitCard({ unit, onEdit, onRefund }) {
  const TypeIcon = TYPE_ICONS[unit.unit_type] || Building2;
  const statusCfg = STATUS_CONFIG[unit.status] || STATUS_CONFIG.available;

  return (
    <Link to={`/properties/units/${unit.id}`}
      className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden group">
      {/* Color bar */}
      <div className={`h-1.5 ${unit.status === 'available' ? 'bg-green-500' : unit.status === 'sold' ? 'bg-red-500' : unit.status === 'reserved' ? 'bg-yellow-500' : 'bg-gray-300'}`} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
              <TypeIcon size={18} className="text-orange-500" />
            </div>
            <div>
              <div className="font-bold text-gray-900">{unit.unit_number}</div>
              <div className="text-xs text-gray-400">{UNIT_TYPE_LABELS[unit.unit_type] || unit.unit_type}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={(e) => { e.preventDefault(); onEdit(unit); }}
              className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-300 hover:text-orange-500 transition" title="Edit">
              <Pencil size={13} />
            </button>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Tower</span>
            <span className="font-medium text-gray-800">{unit.tower_name}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Floor</span>
            <span className="font-medium text-gray-800">{formatFloorLabel(unit.floor_no)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Size</span>
            <span className="font-medium text-gray-800">{unit.size_sqft} sqft</span>
          </div>
          {unit.bedrooms > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Bedrooms</span>
              <span className="font-medium text-gray-800">{unit.bedrooms} Bed · {unit.bathrooms} Bath</span>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-400">Total Price</div>
          <div className="text-base font-bold text-gray-900">{fmtPKR(unit.total_price)}</div>
          <div className="text-xs text-gray-400">PKR {parseInt(unit.price_per_sqft).toLocaleString('en-PK')}/sqft</div>
        </div>

        {unit.status === 'sold' && unit.customer_name && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-400">Owner</div>
            <div className="text-sm font-medium text-gray-700 truncate">{unit.customer_name}</div>
            {unit.booking_id && (
              <button onClick={(e) => { e.preventDefault(); onRefund(unit); }}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition">
                <RotateCcw size={11} /> Process Refund
              </button>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Merge Units Modal ──
function MergeUnitsModal({ onClose, availableUnits }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();

  const mergeMutation = useMutation({
    mutationFn: (d) => api.post('/property/units/merge', d),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Units merged!');
      qc.invalidateQueries(['units']);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Merge failed'),
  });

  const unitA = watch('unit_a_id');
  const unitB = watch('unit_b_id');
  const uA = availableUnits.find(u => u.id === unitA);
  const uB = availableUnits.find(u => u.id === unitB);
  const combinedSize = (parseFloat(uA?.size_sqft || 0) + parseFloat(uB?.size_sqft || 0)).toFixed(0);
  const combinedPrice = uA && uB
    ? ((parseFloat(uA.total_price || 0) + parseFloat(uB.total_price || 0)))
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Merge size={16} className="text-purple-600" />
            </div>
            <h2 className="font-bold text-gray-900 text-lg">Merge Two Units</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => mergeMutation.mutate(d))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Unit A *</label>
              <select {...register('unit_a_id', { required: true })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
                <option value="">Select unit</option>
                {availableUnits.map(u => (
                  <option key={u.id} value={u.id} disabled={u.id === unitB}>{u.unit_number} — {u.tower_name} · {formatFloorLabel(u.floor_no)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Unit B *</label>
              <select {...register('unit_b_id', { required: true })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400">
                <option value="">Select unit</option>
                {availableUnits.map(u => (
                  <option key={u.id} value={u.id} disabled={u.id === unitA}>{u.unit_number} — {u.tower_name} · {formatFloorLabel(u.floor_no)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">New Merged Unit Number *</label>
            <input {...register('new_unit_number', { required: true })} placeholder="e.g. A-101M" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
          </div>

          {uA && uB && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
              <div className="text-xs font-semibold text-purple-700 uppercase mb-2">Merged Unit Preview</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded-lg p-2.5">
                  <div className="text-gray-400 text-xs">Combined Size</div>
                  <div className="font-bold text-gray-900">{combinedSize} sqft</div>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <div className="text-gray-400 text-xs">Combined Value</div>
                  <div className="font-bold text-gray-900">{fmtPKR(combinedPrice)}</div>
                </div>
              </div>
              <p className="text-xs text-purple-600">Original units ({uA.unit_number} & {uB.unit_number}) will be marked as "Merged".</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={mergeMutation.isPending}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
              {mergeMutation.isPending ? <Loader size={16} className="animate-spin" /> : <Merge size={15} />}
              Merge Units
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Refund Modal ──
function RefundModal({ unit, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch } = useForm({ defaultValues: { reason: '' } });

  const refundMutation = useMutation({
    mutationFn: (d) => api.post(`/bookings/${unit.booking_id}/refund`, d),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Refund processed!');
      qc.invalidateQueries(['units']);
      qc.invalidateQueries(['bookings']);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Refund failed'),
  });

  const refundAmt = watch('refund_amount');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <RotateCcw size={16} className="text-red-600" />
            </div>
            <h2 className="font-bold text-gray-900 text-lg">Process Refund</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-400">Unit</span><span className="font-semibold">{unit.unit_number}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Tower</span><span className="font-medium">{unit.tower_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Customer</span><span className="font-medium">{unit.customer_name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Booking</span><span className="font-mono text-xs text-blue-600">{unit.booking_no}</span></div>
          </div>

          <form onSubmit={handleSubmit(d => refundMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Refund Amount (PKR) *</label>
              <input {...register('refund_amount', { required: true, min: 1 })} type="number" placeholder="Enter refund amount"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reason</label>
              <textarea {...register('reason')} rows={3} placeholder="Reason for refund (optional)..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none" />
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
              <strong>Warning:</strong> This will cancel booking <span className="font-mono">{unit.booking_no}</span>, mark the unit as available, and cancel all pending installments.
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={refundMutation.isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {refundMutation.isPending ? <Loader size={16} className="animate-spin" /> : <RotateCcw size={15} />}
                Process Refund
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Tower Management Modal ──
function TowerManagementModal({ onClose }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('towers');
  const [floorTowerId, setFloorTowerId] = useState('');
  const [floorType, setFloorType] = useState('');
  const [customFloor, setCustomFloor] = useState('');

  const { data: towersData, isLoading } = useQuery({
    queryKey: ['towers'],
    queryFn: () => api.get('/property/towers').then(r => r.data),
  });

  const { data: floorsData } = useQuery({
    queryKey: ['floors'],
    queryFn: () => api.get('/property/floors').then(r => r.data),
  });

  const deleteTowerMutation = useMutation({
    mutationFn: (id) => api.delete(`/property/towers/${id}`),
    onSuccess: () => { toast.success('Tower deleted!'); qc.invalidateQueries(['towers']); qc.invalidateQueries(['units']); },
    onError: (err) => toast.error(err.response?.data?.error || 'Cannot delete tower'),
  });

  const addFloorMutation = useMutation({
    mutationFn: (d) => api.post('/property/floors', d),
    onSuccess: () => {
      toast.success('Floor added!');
      qc.invalidateQueries(['floors']);
      qc.invalidateQueries(['towers']);
      setFloorType('');
      setCustomFloor('');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add floor'),
  });

  const towers = towersData?.data || [];
  const floors = floorsData?.data || [];

  const FLOOR_PRESETS = [
    { label: 'Lower Ground (LG)',  value: '-1' },
    { label: 'Ground Floor (GF)',  value: '0'  },
    { label: 'Floor 1',            value: '1'  },
    { label: 'Floor 2',            value: '2'  },
    { label: 'Floor 3',            value: '3'  },
    { label: 'Floor 4',            value: '4'  },
    { label: 'Floor 5',            value: '5'  },
    { label: 'Floor 6',            value: '6'  },
    { label: 'Floor 7',            value: '7'  },
    { label: 'Floor 8',            value: '8'  },
    { label: 'Floor 9',            value: '9'  },
    { label: 'Floor 10',           value: '10' },
    { label: 'Custom...',          value: '__custom__' },
  ];

  const handleAddFloor = () => {
    if (!floorTowerId) return toast.error('Select a tower first');
    const fn = floorType === '__custom__' ? parseInt(customFloor) : parseInt(floorType);
    if (isNaN(fn)) return toast.error('Enter a valid floor number');
    const existingForTower = floors.filter(f => f.tower_id === floorTowerId);
    if (existingForTower.some(f => parseInt(f.floor_no) === fn)) return toast.error('This floor already exists for the selected tower');
    addFloorMutation.mutate({ tower_id: floorTowerId, floor_no: fn, name: null });
  };

  const towerFloors = (towerId) => floors.filter(f => f.tower_id === towerId)
    .sort((a, b) => parseInt(b.floor_no) - parseInt(a.floor_no));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-gray-500" />
            <h2 className="font-bold text-gray-900 text-lg">Manage Towers & Floors</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[['towers', 'Towers'], ['floors', 'Add Floor']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-5 py-3 text-sm font-medium transition border-b-2 ${activeTab === key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'towers' && (
            <div className="space-y-3">
              {isLoading ? (
                <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
              ) : towers.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">No towers found</div>
              ) : towers.map(tower => (
                <div key={tower.id} className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-semibold text-gray-800">{tower.name}</p>
                      <p className="text-xs text-gray-400">Code: {tower.code}</p>
                    </div>
                    <button
                      onClick={() => { if (window.confirm(`Delete "${tower.name}"?`)) deleteTowerMutation.mutate(tower.id); }}
                      disabled={deleteTowerMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition disabled:opacity-50">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                  {towerFloors(tower.id).length > 0 && (
                    <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                      {towerFloors(tower.id).map(f => (
                        <span key={f.id} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600 font-medium">
                          {formatFloorLabel(f.floor_no)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-400 pt-1">A tower can only be deleted if it has no units.</p>
            </div>
          )}

          {activeTab === 'floors' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Add a new floor to an existing tower. Lower Ground and Ground Floor are supported.</p>

              <div>
                <label className="label-sm">Tower *</label>
                <select value={floorTowerId} onChange={e => setFloorTowerId(e.target.value)} className="input-field">
                  <option value="">Select Tower</option>
                  {towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label className="label-sm">Floor *</label>
                <select value={floorType} onChange={e => { setFloorType(e.target.value); setCustomFloor(''); }} className="input-field">
                  <option value="">Select Floor</option>
                  {FLOOR_PRESETS.map(fp => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
                </select>
              </div>

              {floorType === '__custom__' && (
                <div>
                  <label className="label-sm">Custom Floor Number</label>
                  <input type="number" value={customFloor} onChange={e => setCustomFloor(e.target.value)}
                    placeholder="e.g. 11" className="input-field" />
                  <p className="text-xs text-gray-400 mt-1">Use negative numbers for below-ground floors (e.g. -2 = Basement 2)</p>
                </div>
              )}

              {floorTowerId && floorType && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
                  Adding <strong>{floorType === '__custom__' ? `Floor ${customFloor}` : FLOOR_PRESETS.find(f => f.value === floorType)?.label}</strong> to <strong>{towers.find(t => t.id === floorTowerId)?.name}</strong>
                </div>
              )}

              <button onClick={handleAddFloor} disabled={addFloorMutation.isPending || !floorTowerId || !floorType}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition">
                {addFloorMutation.isPending ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
                Add Floor
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Floor Grid View — color-coded inventory map ──
function FloorGridView({ units }) {
  // Group by tower then floor (descending = top floor first)
  const grouped = {};
  units.forEach(unit => {
    const tower = unit.tower_name || 'Unknown Tower';
    if (!grouped[tower]) grouped[tower] = {};
    const floor = unit.floor_no != null ? unit.floor_no : '?';
    if (!grouped[tower][floor]) grouped[tower][floor] = [];
    grouped[tower][floor].push(unit);
  });

  const statusCell = (status) => {
    if (status === 'available')   return 'bg-green-500  hover:bg-green-600  text-white';
    if (status === 'reserved')    return 'bg-yellow-400 hover:bg-yellow-500 text-white';
    if (status === 'sold')        return 'bg-red-500    hover:bg-red-600    text-white';
    if (status === 'maintenance') return 'bg-gray-400   hover:bg-gray-500   text-white';
    return                               'bg-purple-400  hover:bg-purple-500  text-white';
  };

  const summary = units.reduce((acc, u) => {
    acc[u.status] = (acc[u.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-6 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Legend:</span>
        {[
          { label: 'Available',    bg: 'bg-green-500',  count: summary.available   || 0 },
          { label: 'Reserved',     bg: 'bg-yellow-400', count: summary.reserved    || 0 },
          { label: 'Sold/Booked',  bg: 'bg-red-500',    count: summary.sold        || 0 },
          { label: 'Maintenance',  bg: 'bg-gray-400',   count: summary.maintenance || 0 },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded ${item.bg} shadow-sm`} />
            <span className="text-xs text-gray-600 font-medium">{item.label}</span>
            <span className="text-xs font-bold text-gray-800 bg-gray-100 px-1.5 rounded-full">{item.count}</span>
          </div>
        ))}
        <span className="ml-auto text-xs text-gray-400">Hover unit for details · Click to open</span>
      </div>

      {/* Towers */}
      {Object.entries(grouped).map(([towerName, floorMap]) => {
        const sortedFloors = Object.entries(floorMap).sort(
          ([a], [b]) => parseInt(b) - parseInt(a)   // descending: top floors first, LG last
        );
        return (
          <div key={towerName} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Tower header */}
            <div className="bg-gray-900 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-orange-400" />
                <span className="font-bold text-white text-sm">{towerName}</span>
              </div>
              <span className="text-xs text-gray-400">{sortedFloors.length} floors</span>
            </div>

            {/* Floor rows */}
            <div className="divide-y divide-gray-100">
              {sortedFloors.map(([floorNo, floorUnits]) => {
                const sorted = [...floorUnits].sort((a, b) =>
                  a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true })
                );
                return (
                  <div key={floorNo} className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                    {/* Floor label */}
                    <div className="w-32 flex-shrink-0 pt-0.5">
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
                        {formatFloorLabel(floorNo)}
                      </span>
                    </div>

                    {/* Unit cells */}
                    <div className="flex flex-wrap gap-1.5">
                      {sorted.map(unit => (
                        <Link
                          key={unit.id}
                          to={`/properties/units/${unit.id}`}
                          title={
                            `Unit: ${unit.unit_number}\n` +
                            `Type: ${unit.unit_type}\n` +
                            `Status: ${unit.status}\n` +
                            (unit.customer_name ? `Owner: ${unit.customer_name}\n` : '') +
                            `Price: PKR ${parseInt(unit.total_price || 0).toLocaleString('en-PK')}\n` +
                            `Size: ${unit.size_sqft} sqft`
                          }
                          className={`
                            ${statusCell(unit.status)}
                            text-xs font-bold px-2.5 py-1.5 rounded-lg
                            cursor-pointer transition-all shadow-sm
                            min-w-[52px] text-center
                            ring-0 hover:ring-2 hover:ring-white hover:ring-offset-1
                          `}
                        >
                          {unit.unit_number}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {units.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <Building2 size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No units to display in floor grid</p>
        </div>
      )}
    </div>
  );
}

// ── Main Properties Page ──
export default function Properties() {
  const [showAdd, setShowAdd] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [showMerge, setShowMerge] = useState(false);
  const [refundUnit, setRefundUnit] = useState(null);
  const [showTowerMgmt, setShowTowerMgmt] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [towerFilter, setTowerFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: towersData } = useQuery({
    queryKey: ['towers'],
    queryFn: () => api.get('/property/towers').then(r => r.data),
  });

  const { data: floorsData } = useQuery({
    queryKey: ['floors'],
    queryFn: () => api.get('/property/floors').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['units', { statusFilter, typeFilter, towerFilter, page, viewMode }],
    queryFn: () => api.get('/property/units', {
      params: {
        status: statusFilter || undefined,
        unit_type: typeFilter || undefined,
        tower_id: towerFilter || undefined,
        page: viewMode === 'floor' ? 1 : page,
        limit: viewMode === 'floor' ? 500 : 24,
      }
    }).then(r => r.data),
  });

  const units = data?.data || [];
  const pg = data?.pagination || {};
  const towers = towersData?.data || [];
  const floors = floorsData?.data || [];

  // Stats
  const statusCounts = units.reduce((acc, u) => {
    acc[u.status] = (acc[u.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = search
    ? units.filter(u => u.unit_number.toLowerCase().includes(search.toLowerCase()) || u.customer_name?.toLowerCase().includes(search.toLowerCase()))
    : units;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all units across towers</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowTowerMgmt(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 rounded-lg text-sm font-medium transition">
            <Settings size={16} /> Towers
          </button>
          <button onClick={() => setShowMerge(true)}
            className="flex items-center gap-2 px-4 py-2 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-medium transition">
            <Merge size={16} /> Merge Units
          </button>
          <Link to="/bookings/new"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <CheckCircle size={16} /> New Booking
          </Link>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition">
            <Plus size={16} /> Add Unit
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
            className={`
              text-left p-4 rounded-xl border-2 transition-all shadow-sm
              ${statusFilter === status ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-white hover:border-gray-200'}
            `}
          >
            <div className="flex items-center justify-between mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{statusCounts[status] || 0}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-52">
          <Search size={15} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search unit..." className="text-sm border-none outline-none" />
          {search && <button onClick={() => setSearch('')}><X size={14} className="text-gray-400" /></button>}
        </div>

        {/* Tower filter */}
        <select value={towerFilter} onChange={e => { setTowerFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-400">
          <option value="">All Towers</option>
          {towers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {/* Type filter */}
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-400">
          <option value="">All Types</option>
          <optgroup label="Residential">
            <option value="apartment">Apartments</option>
            <option value="penthouse">Penthouses</option>
          </optgroup>
          <optgroup label="Commercial">
            <option value="shop">Shops</option>
            <option value="office">Offices</option>
            <option value="commercial">Commercial</option>
          </optgroup>
        </select>

        {/* View mode */}
        <div className="ml-auto flex border border-gray-200 rounded-lg overflow-hidden bg-white">
          <button onClick={() => setViewMode('grid')} title="Card Grid"
            className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Grid size={16} />
          </button>
          <button onClick={() => setViewMode('list')} title="List View"
            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            <List size={16} />
          </button>
          <button onClick={() => setViewMode('floor')} title="Floor Grid (Inventory Map)"
            className={`px-3 py-2 text-xs font-bold ${viewMode === 'floor' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Layers size={16} />
          </button>
        </div>
      </div>

      {/* Units Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(12).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-52 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <Building2 size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="font-medium text-gray-500">No units found</h3>
          <p className="text-sm text-gray-400 mt-1">Try adjusting filters or add a new unit</p>
          <button onClick={() => setShowAdd(true)}
            className="mt-4 px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
            + Add First Unit
          </button>
        </div>
      ) : viewMode === 'floor' ? (
        <FloorGridView units={filtered} />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map(unit => <UnitCard key={unit.id} unit={unit} onEdit={setEditUnit} onRefund={setRefundUnit} />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Unit', 'Tower', 'Floor', 'Type', 'Size', 'Price/sqft', 'Total Price', 'Status', 'Owner', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(unit => {
                const sc = STATUS_CONFIG[unit.status] || STATUS_CONFIG.available;
                const TI = TYPE_ICONS[unit.unit_type] || Building2;
                return (
                  <tr key={unit.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TI size={16} className="text-orange-500" />
                        <span className="font-medium text-gray-900">{unit.unit_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{unit.tower_name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatFloorLabel(unit.floor_no)}</td>
                    <td className="px-4 py-3 text-gray-600">{UNIT_TYPE_LABELS[unit.unit_type] || unit.unit_type}</td>
                    <td className="px-4 py-3 text-gray-600">{unit.size_sqft} sqft</td>
                    <td className="px-4 py-3 text-gray-600">{fmtPKR(unit.price_per_sqft)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fmtPKR(unit.total_price)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-24 truncate">{unit.customer_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditUnit(unit)}
                          className="p-1.5 rounded-lg hover:bg-orange-100 text-gray-400 hover:text-orange-500 transition" title="Edit">
                          <Pencil size={15} />
                        </button>
                        {unit.status === 'sold' && unit.booking_id && (
                          <button onClick={() => setRefundUnit(unit)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition" title="Process Refund">
                            <RotateCcw size={15} />
                          </button>
                        )}
                        <Link to={`/properties/units/${unit.id}`}
                          className="p-1.5 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition inline-block" title="View">
                          <Eye size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pg.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{pg.total} total units</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
            <span className="px-4 py-2 text-sm text-gray-600">Page {page} / {pg.pages}</span>
            <button onClick={() => setPage(p => Math.min(pg.pages, p + 1))} disabled={page === pg.pages}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      <AddUnitModal open={showAdd} onClose={() => setShowAdd(false)} towers={towers} floors={floors} />
      {editUnit && <EditUnitModal unit={editUnit} onClose={() => setEditUnit(null)} />}
      {showMerge && <MergeUnitsModal onClose={() => setShowMerge(false)} availableUnits={units.filter(u => u.status === 'available')} />}
      {refundUnit && <RefundModal unit={refundUnit} onClose={() => setRefundUnit(null)} />}
      {showTowerMgmt && <TowerManagementModal onClose={() => setShowTowerMgmt(false)} />}
    </div>
  );
}
