// src/pages/NewBooking.jsx
import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Building2, User, CreditCard, ChevronRight,
  CheckCircle, Loader, Search, ArrowLeft,
  Upload, ScanLine, X, FileImage
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtPKRFull } from '../utils/format';

const STEPS = [
  { id: 1, label: 'Select Unit',    icon: Building2 },
  { id: 2, label: 'Customer Info',  icon: User },
  { id: 3, label: 'Payment Plan',   icon: CreditCard },
  { id: 4, label: 'Confirm',        icon: CheckCircle },
];

// ── Step 1: Unit Selection ──
function UnitStep({ onSelect, selected }) {
  const [search, setSearch] = useState('');
  const [unitType, setUnitType] = useState('');
  const [tower, setTower] = useState('');

  const { data: towersData } = useQuery({
    queryKey: ['towers'],
    queryFn: () => api.get('/property/towers').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['available-units', { unitType, tower }],
    queryFn: () => api.get('/property/units', {
      params: { status: 'available', unit_type: unitType || undefined, tower_id: tower || undefined, limit: 100 }
    }).then(r => r.data),
  });

  const units = data?.data || [];
  const filtered = units.filter(u =>
    !search || u.unit_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white col-span-3 lg:col-span-1">
          <Search size={15} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search unit..." className="text-sm border-none outline-none flex-1" />
        </div>
        <select value={tower} onChange={e => setTower(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white">
          <option value="">All Towers</option>
          {towersData?.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={unitType} onChange={e => setUnitType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white">
          <option value="">All Types</option>
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

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {filtered.map(unit => (
            <button
              key={unit.id}
              onClick={() => onSelect(unit)}
              className={`
                text-left p-4 rounded-xl border-2 transition-all
                ${selected?.id === unit.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30 bg-white'
                }
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-900">{unit.unit_number}</span>
                {selected?.id === unit.id && <CheckCircle size={16} className="text-orange-500" />}
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <div>{unit.tower_name} · {unit.floor_no == -1 ? 'Lower Ground' : unit.floor_no == 0 ? 'Ground Floor' : `Floor ${unit.floor_no}`}</div>
                <div>{unit.size_sqft} sqft · {unit.unit_type?.replace(/_/g, ' ')}</div>
                <div className="font-semibold text-gray-800 mt-1">{fmtPKR(unit.total_price)}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 py-12 text-center text-gray-400">
              <Building2 size={40} className="mx-auto mb-3 text-gray-200" />
              No available units found
            </div>
          )}
        </div>
      )}

      {!selected && !isLoading && filtered.length > 0 && (
        <p className="text-center text-sm text-gray-400 mt-2">
          ↑ Click on a unit above to select it and continue
        </p>
      )}

      {selected && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-300 rounded-xl px-4 py-3 mt-2">
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-orange-500" />
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                Unit {selected.unit_number} selected
              </p>
              <p className="text-xs text-gray-500">
                {selected.tower_name} · {selected.floor_no == -1 ? 'Lower Ground' : selected.floor_no == 0 ? 'Ground Floor' : `Floor ${selected.floor_no}`} · {selected.size_sqft} sqft · {fmtPKR(selected.total_price)}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-gray-400 hover:text-red-500 underline"
          >
            Change
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 2: Customer ──
function CustomerStep({ onSelect, selected, onFormUrl, formUrl }) {
  const [search, setSearch]       = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [scanning, setScanning]   = useState(false);
  const [scanError, setScanError] = useState('');
  const [preview, setPreview]     = useState(formUrl || '');
  const fileInputRef = useRef(null);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm();

  const { data } = useQuery({
    queryKey: ['customers-search', search],
    queryFn: () => api.get('/customers', { params: { search, limit: 20 } }).then(r => r.data),
    enabled: search.length > 1,
  });

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/customers', d),
    onSuccess: (res) => { onSelect(res.data.customer); setCreateNew(false); toast.success('Customer created!'); },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const handleScan = async (file) => {
    if (!file) return;
    setScanning(true);
    setScanError('');

    // Show local preview immediately
    setPreview(URL.createObjectURL(file));

    const fd = new FormData();
    fd.append('form', file);

    try {
      const res = await api.post('/scan/booking-form', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { fileUrl, extracted, error: scanErr } = res.data;
      onFormUrl(fileUrl);
      setPreview(fileUrl);

      // Auto-fill fields from extracted data
      const c = extracted?.customer || {};
      if (c.name)        setValue('name',    c.name);
      if (c.cnic)        setValue('cnic',    c.cnic);
      if (c.phone)       setValue('phone',   c.phone);
      if (c.email)       setValue('email',   c.email);
      if (c.address)     setValue('address', c.address);

      if (scanErr) setScanError(scanErr);
      else toast.success('Form scanned — details auto-filled!');

      setCreateNew(true);
    } catch (err) {
      setScanError(err.response?.data?.error || 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const customers = data?.data || [];

  return (
    <div className="space-y-4">
      {/* Scan Form Banner */}
      <div className="border-2 border-dashed border-orange-200 rounded-xl bg-orange-50/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <ScanLine size={20} className="text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Scan Physical Booking Form</p>
              <p className="text-xs text-gray-500">Upload a photo of the form — AI will auto-fill customer details</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-60"
          >
            {scanning ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
            {scanning ? 'Scanning...' : 'Upload Form'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleScan(e.target.files[0])}
          />
        </div>

        {/* Scanned image preview */}
        {preview && !scanning && (
          <div className="mt-3 flex items-start gap-3">
            <div className="relative">
              <img
                src={preview.startsWith('/uploads') ? `${window.location.origin.replace(':3000', ':5001')}${preview}` : preview}
                alt="Scanned form"
                className="w-24 h-32 object-cover rounded-lg border border-orange-200 shadow-sm"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <button
                type="button"
                onClick={() => { setPreview(''); onFormUrl(''); }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                <CheckCircle size={12} /> Form uploaded & scanned
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Customer fields below have been auto-filled. Review and confirm before saving.
              </p>
            </div>
          </div>
        )}

        {scanError && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            ⚠️ {scanError}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
          <Search size={15} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, CNIC or phone..."
            className="text-sm border-none outline-none flex-1" />
        </div>
        <button onClick={() => setCreateNew(!createNew)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition">
          + New Customer
        </button>
      </div>

      {/* Create New Form */}
      {createNew && (
        <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-4">New Customer</h3>
          <form onSubmit={handleSubmit(d => createMutation.mutate(d))}>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'name',    label: 'Full Name *',   type: 'text' },
                { name: 'cnic',    label: 'CNIC *',        type: 'text', placeholder: '35201-XXXXXXX-X' },
                { name: 'phone',   label: 'Phone *',       type: 'tel' },
                { name: 'email',   label: 'Email',         type: 'email' },
                { name: 'address', label: 'Address',       type: 'text', span: 2 },
              ].map(f => (
                <div key={f.name} className={f.span === 2 ? 'col-span-2' : ''}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{f.label}</label>
                  <input
                    {...register(f.name, { required: f.label.includes('*') })}
                    type={f.type}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 bg-white"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setCreateNew(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm">Cancel</button>
              <button type="submit" disabled={createMutation.isPending}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                {createMutation.isPending && <Loader size={14} className="animate-spin" />}
                Create & Select
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Results */}
      {search.length > 1 && (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {customers.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className={`
                w-full text-left p-4 rounded-xl border-2 transition-all
                ${selected?.id === c.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300 bg-white'}
              `}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{c.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{c.cnic} · {c.phone}</div>
                </div>
                {selected?.id === c.id && <CheckCircle size={18} className="text-orange-500" />}
              </div>
            </button>
          ))}
          {customers.length === 0 && search.length > 1 && (
            <p className="text-center text-gray-400 py-6">No customers found. Create a new one.</p>
          )}
        </div>
      )}

      {/* Selected Customer */}
      {selected && !createNew && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600" />
          <div>
            <p className="font-semibold text-green-800">{selected.name}</p>
            <p className="text-sm text-green-600">{selected.cnic} · {selected.phone}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Payment Plan ──
function PlanStep({ onSelect, selected, unit }) {
  const { data } = useQuery({
    queryKey: ['payment-plans'],
    queryFn: () => api.get('/bookings/payment-plans').then(r => r.data),
  });

  const plans = data?.data || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {plans.map(plan => {
        const unitPrice       = parseFloat(unit?.total_price || 0);
        const downPay         = Math.round(unitPrice * plan.down_payment_pct             / 100);
        const confirmationAmt = Math.round(unitPrice * (plan.confirmation_pct  || 0)    / 100);
        const balloonAmt      = Math.round(unitPrice * (plan.balloon_pct       || 0)    / 100);
        const possessionAmt   = Math.round(unitPrice * (plan.possession_pct    || 0)    / 100);
        const monthly         = plan.installment_months > 0
          ? Math.round((unitPrice - downPay - confirmationAmt - balloonAmt - possessionAmt) / plan.installment_months)
          : 0;

        const tiles = [
          { label: 'Down Payment',    pct: plan.down_payment_pct,  val: downPay,         cls: 'border-green-200  bg-green-50',  pctCls: 'text-green-700',  amtCls: 'text-green-600',  show: true },
          { label: 'Confirmation',    pct: plan.confirmation_pct,  val: confirmationAmt,  cls: 'border-violet-200 bg-violet-50', pctCls: 'text-violet-700', amtCls: 'text-violet-600', show: (plan.confirmation_pct || 0) > 0 },
          { label: `Monthly ×${plan.installment_months}`, pct: null, val: monthly,        cls: 'border-blue-200   bg-blue-50',   pctCls: 'text-blue-700',   amtCls: 'text-blue-600',   sub: `${plan.installment_months} months`, show: plan.installment_months > 0 },
          { label: 'Balloon Payment', pct: plan.balloon_pct,       val: balloonAmt,       cls: 'border-amber-200  bg-amber-50',  pctCls: 'text-amber-700',  amtCls: 'text-amber-600',  show: (plan.balloon_pct    || 0) > 0 },
          { label: 'On Possession',   pct: plan.possession_pct,    val: possessionAmt,    cls: 'border-red-200    bg-red-50',    pctCls: 'text-red-700',    amtCls: 'text-red-600',    show: (plan.possession_pct || 0) > 0 },
        ].filter(t => t.show);

        return (
          <button
            key={plan.id}
            onClick={() => onSelect(plan)}
            className={`
              text-left p-5 rounded-xl border-2 transition-all
              ${selected?.id === plan.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300 bg-white'}
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900">{plan.name}</h3>
              {selected?.id === plan.id && <CheckCircle size={18} className="text-orange-500" />}
            </div>
            <p className="text-xs text-gray-400 mb-3">{plan.description}</p>
            <div className={`grid gap-2 text-sm ${tiles.length > 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {tiles.map(({ label, pct, val, cls, pctCls, amtCls, sub }) => (
                <div key={label} className={`rounded-lg border p-2.5 ${cls}`}>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                  {pct != null && <p className={`font-bold text-sm mt-0.5 ${pctCls}`}>{pct}%</p>}
                  <p className={`text-xs font-semibold mt-0.5 ${amtCls}`}>{fmtPKR(val)}</p>
                  {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Step 4: Confirm ──
function ConfirmStep({ unit, customer, plan, discount, onDiscountChange, applicationNo, onApplicationNoChange, formUrl }) {
  const unitPrice       = parseFloat(unit?.total_price || 0);
  const disc            = parseFloat(discount || 0);
  const final           = unitPrice - disc;
  const downPay         = Math.round(final * (plan?.down_payment_pct || 20) / 100);
  const confirmationAmt = Math.round(final * (plan?.confirmation_pct || 0)  / 100);
  const balloonAmt      = Math.round(final * (plan?.balloon_pct      || 0)  / 100);
  const possessionAmt   = Math.round(final * (plan?.possession_pct   || 0)  / 100);
  const monthly         = plan?.installment_months > 0
    ? Math.round((final - downPay - confirmationAmt - balloonAmt - possessionAmt) / plan.installment_months)
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div><span className="text-gray-500">Customer</span><p className="font-semibold text-gray-900 mt-0.5">{customer?.name}</p></div>
          <div><span className="text-gray-500">CNIC</span><p className="font-semibold text-gray-900 mt-0.5">{customer?.cnic}</p></div>
          <div><span className="text-gray-500">Unit</span><p className="font-semibold text-gray-900 mt-0.5">{unit?.unit_number} · {unit?.tower_name}</p></div>
          <div><span className="text-gray-500">Type</span><p className="font-semibold text-gray-900 mt-0.5">{unit?.unit_type?.replace(/_/g, ' ')} · {unit?.size_sqft} sqft</p></div>
          <div><span className="text-gray-500">Payment Plan</span><p className="font-semibold text-gray-900 mt-0.5">{plan?.name}</p></div>
          <div><span className="text-gray-500">Floor</span><p className="font-semibold text-gray-900 mt-0.5">{unit?.floor_no == -1 ? 'Lower Ground' : unit?.floor_no == 0 ? 'Ground Floor' : `Floor ${unit?.floor_no}`}</p></div>
        </div>
      </div>

      {/* Pricing */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-800 text-white px-5 py-3">
          <h3 className="font-semibold">Payment Summary</h3>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Unit Price</span>
            <span className="font-medium">{fmtPKRFull(unitPrice)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Discount</span>
            <input
              type="number"
              value={discount}
              onChange={e => onDiscountChange(e.target.value)}
              className="w-36 border border-gray-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:border-orange-400"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between border-t pt-3">
            <span className="font-semibold text-gray-800">Final Price</span>
            <span className="font-bold text-gray-900 text-base">{fmtPKRFull(final)}</span>
          </div>
          <div className="flex justify-between text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <span>Down Payment ({plan?.down_payment_pct}%)</span>
            <span className="font-semibold">{fmtPKRFull(downPay)}</span>
          </div>
          {confirmationAmt > 0 && (
            <div className="flex justify-between text-violet-700 bg-violet-50 rounded-lg px-3 py-2">
              <span>Confirmation Payment ({plan?.confirmation_pct}%)</span>
              <span className="font-semibold">{fmtPKRFull(confirmationAmt)}</span>
            </div>
          )}
          {monthly > 0 && (
            <div className="flex justify-between text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
              <span>Monthly Installment × {plan?.installment_months}</span>
              <span className="font-semibold">{fmtPKRFull(monthly)}</span>
            </div>
          )}
          {balloonAmt > 0 && (
            <div className="flex justify-between text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <span>Balloon Payment ({plan?.balloon_pct}%)</span>
              <span className="font-semibold">{fmtPKRFull(balloonAmt)}</span>
            </div>
          )}
          {possessionAmt > 0 && (
            <div className="flex justify-between text-red-700 bg-red-50 rounded-lg px-3 py-2">
              <span>On Possession ({plan?.possession_pct}%)</span>
              <span className="font-semibold">{fmtPKRFull(possessionAmt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Application Form # */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-800 text-white px-5 py-3">
          <h3 className="font-semibold">Application Details</h3>
        </div>
        <div className="p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Application Form # <span className="text-gray-400 font-normal normal-case">(optional — printed on allotment letter)</span>
          </label>
          <input
            type="text"
            value={applicationNo}
            onChange={e => onApplicationNoChange(e.target.value)}
            placeholder="e.g. APP-2025-001"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
          />
        </div>
      </div>

      {/* Uploaded Booking Form */}
      {formUrl && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-800 text-white px-5 py-3 flex items-center gap-2">
            <FileImage size={14} />
            <h3 className="font-semibold text-sm">Original Booking Form</h3>
          </div>
          <div className="p-4 flex gap-4 items-start">
            <img
              src={`${window.location.origin.replace(':3000', ':5001')}${formUrl}`}
              alt="Original booking form"
              className="w-32 h-44 object-cover rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition"
              onClick={() => window.open(`${window.location.origin.replace(':3000', ':5001')}${formUrl}`, '_blank')}
              onError={e => { e.target.parentElement.innerHTML = '<p class="text-xs text-gray-400 py-4">Preview not available</p>'; }}
            />
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-800 mb-1">Physical form attached</p>
              <p className="text-xs text-gray-500">This form will be saved with the booking record for reference.</p>
              <a
                href={`${window.location.origin.replace(':3000', ':5001')}${formUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-orange-600 hover:underline"
              >
                View full size ↗
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
        ✉️ A booking confirmation WhatsApp will be sent to <strong>{customer?.phone}</strong>
      </div>
    </div>
  );
}

// ── Main New Booking ──
export default function NewBooking() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [unit, setUnit] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [plan, setPlan] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [applicationNo, setApplicationNo] = useState('');
  const [formUrl, setFormUrl] = useState('');

  const bookingMutation = useMutation({
    mutationFn: (data) => api.post('/bookings', data),
    onSuccess: (res) => {
      toast.success(`Booking ${res.data.bookingNo} created!`);
      navigate(`/bookings/${res.data.booking.id}`);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Booking failed'),
  });

  const canProceed = () => {
    if (step === 1) return !!unit;
    if (step === 2) return !!customer;
    if (step === 3) return !!plan;
    return true;
  };

  const handleBook = () => {
    bookingMutation.mutate({
      customer_id: customer.id,
      unit_id: unit.id,
      payment_plan_id: plan.id,
      discount_amount: discount || 0,
      application_no: applicationNo || null,
      booking_form_url: formUrl || null,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/bookings')}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Booking</h1>
          <p className="text-sm text-gray-500">Create a new property booking</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`flex items-center gap-2 ${step >= s.id ? 'text-orange-500' : 'text-gray-300'}`}>
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                ${step > s.id ? 'bg-orange-500 text-white' :
                  step === s.id ? 'bg-orange-500 text-white ring-4 ring-orange-100' :
                  'bg-gray-100 text-gray-400'}
              `}>
                {step > s.id ? <CheckCircle size={16} /> : s.id}
              </div>
              <span className={`text-sm font-medium hidden lg:block ${step >= s.id ? 'text-gray-800' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${step > s.id ? 'bg-orange-500' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="font-bold text-gray-900 text-lg mb-5">{STEPS[step - 1]?.label}</h2>
        {step === 1 && <UnitStep onSelect={setUnit} selected={unit} />}
        {step === 2 && <CustomerStep onSelect={setCustomer} selected={customer} onFormUrl={setFormUrl} formUrl={formUrl} />}
        {step === 3 && <PlanStep onSelect={setPlan} selected={plan} unit={unit} />}
        {step === 4 && (
          <ConfirmStep
            unit={unit} customer={customer} plan={plan}
            discount={discount} onDiscountChange={setDiscount}
            applicationNo={applicationNo} onApplicationNoChange={setApplicationNo}
            formUrl={formUrl}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/bookings')}
          className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
        >
          ← {step > 1 ? 'Back' : 'Cancel'}
        </button>
        <button
          onClick={() => step < 4 ? setStep(s => s + 1) : handleBook()}
          disabled={!canProceed() || bookingMutation.isPending}
          className="px-8 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition"
        >
          {bookingMutation.isPending ? (
            <><Loader size={16} className="animate-spin" /> Processing...</>
          ) : step < 4 ? (
            <>Next <ChevronRight size={16} /></>
          ) : (
            <><CheckCircle size={16} /> Confirm Booking</>
          )}
        </button>
      </div>
    </div>
  );
}
