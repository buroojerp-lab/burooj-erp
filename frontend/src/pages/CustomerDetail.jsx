// src/pages/CustomerDetail.jsx
import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, MessageCircle,
  Building2, Home, Layers, Store, CreditCard, TrendingUp,
  CheckCircle, Clock, AlertTriangle, DollarSign, Calendar,
  Pencil, X, Loader, User, Hash, Globe, Briefcase,
  Tag, StickyNote, CreditCard as IDCard, BarChart2, Download, Printer
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtDate } from '../utils/format';
import { pdfUrl } from '../utils/pdfUrl';

const STATUS_COLORS = {
  active:    'bg-green-100 text-green-700',
  pending:   'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

const UNIT_TYPE_ICONS = { apartment: Home, shop: Store, office: Building2, penthouse: Layers };

// ── Edit Customer Modal (inline in detail) ──
function EditModal({ customer, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: customer.name, phone: customer.phone, email: customer.email,
      address: customer.address, city: customer.city, occupation: customer.occupation,
      lead_source: customer.lead_source, nationality: customer.nationality,
      ntn: customer.ntn, notes: customer.notes,
    },
  });

  const mut = useMutation({
    mutationFn: (d) => api.put(`/customers/${customer.id}`, d),
    onSuccess: () => {
      toast.success('Customer updated!');
      qc.invalidateQueries(['customer', String(customer.id)]);
      qc.invalidateQueries(['customers']);
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">Edit — {customer.name}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(d => mut.mutate(d))} className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">
          <div className="col-span-2">
            <label className="label-sm">Full Name</label>
            <input {...register('name', { required: true })} className="input-field" />
          </div>
          <div>
            <label className="label-sm">Phone</label>
            <input {...register('phone')} type="tel" className="input-field" />
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
            <label className="label-sm">Nationality</label>
            <input {...register('nationality')} placeholder="Pakistani" className="input-field" />
          </div>
          <div>
            <label className="label-sm">Occupation</label>
            <input {...register('occupation')} className="input-field" />
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
            <textarea {...register('notes')} rows={3} className="input-field resize-none" />
          </div>
          <div className="col-span-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Cancel</button>
            <button type="submit" disabled={mut.isPending}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
              {mut.isPending && <Loader size={15} className="animate-spin" />} Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Unit Detail Card ──
function UnitDetailCard({ booking }) {
  const TypeIcon = UNIT_TYPE_ICONS[booking.unit_type] || Building2;
  const paid = parseFloat(booking.total_paid || 0);
  const total = parseFloat(booking.final_price || 0);
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const remaining = Math.max(0, total - paid);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className={`h-1.5 ${booking.status === 'active' ? 'bg-green-500' : booking.status === 'cancelled' ? 'bg-red-500' : booking.status === 'completed' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
              <TypeIcon size={22} className="text-orange-500" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-lg">Unit {booking.unit_number}</div>
              <div className="text-sm text-gray-500">{booking.tower_name} · Floor {booking.floor_no}</div>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${STATUS_COLORS[booking.status] || 'bg-gray-100 text-gray-600'}`}>
            {booking.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Booking No',    value: booking.booking_no,                icon: FileText },
            { label: 'Booking Date',  value: fmtDate(booking.booking_date),     icon: Calendar },
            { label: 'Unit Type',     value: booking.unit_type?.replace('_',' '), icon: Building2 },
            { label: 'Size',          value: booking.size_sqft ? `${booking.size_sqft} sqft` : '—', icon: Layers },
            { label: 'Total Price',   value: fmtPKR(booking.final_price),       icon: DollarSign },
            { label: 'Down Payment',  value: fmtPKR(booking.down_payment_amount), icon: CreditCard },
            { label: 'Monthly Inst.', value: fmtPKR(booking.monthly_installment), icon: TrendingUp },
            { label: 'Remaining',     value: fmtPKR(remaining),                 icon: AlertTriangle },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                <Icon size={11} /> {label}
              </div>
              <div className="font-semibold text-gray-800 text-sm truncate">{value || '—'}</div>
            </div>
          ))}
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Payment Progress</span>
            <span className="font-semibold text-gray-700">{pct.toFixed(0)}% paid</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Paid: {fmtPKR(paid)}</span>
            <span>Remaining: {fmtPKR(remaining)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="font-bold text-blue-700">{booking.total_count || 0}</div>
            <div className="text-blue-400">Total</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <div className="font-bold text-green-700">{booking.paid_count || 0}</div>
            <div className="text-green-400">Paid</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <div className="font-bold text-orange-700">{(booking.total_count || 0) - (booking.paid_count || 0)}</div>
            <div className="text-orange-400">Pending</div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
          <Link to={`/bookings/${booking.id}`}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition">
            <FileText size={13} /> View Booking
          </Link>
          <a href={pdfUrl(`/bookings/${booking.id}/statement`)} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-green-200 bg-green-50 text-xs font-medium text-green-700 hover:bg-green-100 transition">
            <BarChart2 size={13} /> Statement
          </a>
          <a href={pdfUrl(`/bookings/${booking.id}/allotment`)} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-blue-200 bg-blue-50 text-xs font-medium text-blue-700 hover:bg-blue-100 transition">
            <Download size={13} /> Allotment
          </a>
          <a href={pdfUrl(`/bookings/${booking.id}/booking-form`)} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-purple-200 bg-purple-50 text-xs font-medium text-purple-700 hover:bg-purple-100 transition">
            <Printer size={13} /> Booking Form
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Info Row helper ──
function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon size={15} className="text-orange-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="font-medium text-gray-700 break-words">{value}</p>
      </div>
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('bookings');

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get(`/customers/${id}`).then(r => r.data),
  });

  const { data: bookingData } = useQuery({
    queryKey: ['customer-bookings', id],
    queryFn: () => api.get(`/bookings?customer_id=${id}&limit=20`).then(r => r.data),
  });

  if (isLoading) return (
    <div className="p-6 space-y-4">
      {Array(3).fill(0).map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  const c = data?.customer;
  if (!c) return <div className="p-6 text-center text-gray-400 py-20">Customer not found</div>;

  const bookings = bookingData?.data || [];
  const payments = data?.payments || [];
  const phone = c.phone?.replace(/[^0-9]/g, '');
  const totalPaid = bookings.reduce((s, b) => s + parseFloat(b.total_paid || 0), 0);
  const totalValue = bookings.reduce((s, b) => s + parseFloat(b.final_price || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {showEdit && <EditModal customer={c} onClose={() => setShowEdit(false)} />}

      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg">
            {c.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{c.name}</h1>
            <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-400 flex-wrap">
              <span className="font-mono">CNIC: {c.cnic}</span>
              {c.city && <><span>·</span><span>{c.city}</span></>}
              {c.nationality && <><span>·</span><span>{c.nationality}</span></>}
              {c.lead_source && <><span>·</span><span className="capitalize">{c.lead_source.replace('_',' ')}</span></>}
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Pencil size={15} /> Edit
            </button>
            <a href={`https://wa.me/92${phone?.replace(/^0/, '')}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
              <MessageCircle size={16} /> WhatsApp
            </a>
            <Link to="/bookings/new"
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
              <FileText size={16} /> New Booking
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left: Full Profile */}
        <div className="space-y-4">

          {/* Contact & Identity Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Profile</h2>
            <div className="space-y-3">
              <InfoRow icon={Phone}    label="Phone"       value={c.phone} />
              <InfoRow icon={Mail}     label="Email"       value={c.email} />
              <InfoRow icon={IDCard}   label="CNIC"        value={c.cnic} />
              <InfoRow icon={Hash}     label="NTN"         value={c.ntn} />
              <InfoRow icon={Globe}    label="Nationality" value={c.nationality} />
              <InfoRow icon={Briefcase} label="Occupation" value={c.occupation} />
              <InfoRow icon={MapPin}   label="City"        value={c.city} />
              <InfoRow icon={MapPin}   label="Address"     value={c.address} />
              <InfoRow icon={Tag}      label="Lead Source" value={c.lead_source?.replace('_', ' ')} />
              <InfoRow icon={User}     label="Member Since" value={fmtDate(c.created_at)} />
            </div>
            {c.notes && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                  <StickyNote size={11} /> Notes
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{c.notes}</p>
              </div>
            )}
          </div>

          {/* Portfolio Summary */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Portfolio</h2>
            {[
              { label: 'Total Bookings', value: bookings.length,                                         color: 'text-blue-600' },
              { label: 'Active Units',   value: bookings.filter(b => b.status === 'active').length,      color: 'text-green-600' },
              { label: 'Total Value',    value: fmtPKR(totalValue),                                      color: 'text-gray-900' },
              { label: 'Total Paid',     value: fmtPKR(totalPaid),                                       color: 'text-emerald-600' },
              { label: 'Balance Due',    value: fmtPKR(Math.max(0, totalValue - totalPaid)),             color: 'text-orange-600' },
              { label: 'Payments Made',  value: payments.length,                                          color: 'text-purple-600' },
            ].map(s => (
              <div key={s.label} className="flex justify-between text-sm">
                <span className="text-gray-400">{s.label}</span>
                <span className={`font-bold ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Tabs — Bookings / Payments */}
        <div className="lg:col-span-3 space-y-4">

          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {[
              { key: 'bookings', label: `Booked Units (${bookings.length})` },
              { key: 'payments', label: `Payment History (${payments.length})` },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Booked Units */}
          {activeTab === 'bookings' && (
            bookings.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
                <Building2 size={48} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No bookings yet</p>
                <Link to="/bookings/new"
                  className="mt-3 inline-flex items-center gap-2 px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
                  <FileText size={15} /> Create First Booking
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {bookings.map(b => <UnitDetailCard key={b.id} booking={b} />)}
              </div>
            )
          )}

          {/* Payment History */}
          {activeTab === 'payments' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {payments.length === 0 ? (
                <div className="py-16 text-center">
                  <CreditCard size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">No payments recorded yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Date', 'Amount', 'Method', 'Installment #', 'Reference', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700">{fmtDate(p.payment_date)}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">{fmtPKR(p.amount)}</td>
                        <td className="px-4 py-3">
                          <span className="capitalize px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                            {p.payment_method || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {p.installment_no ? `#${p.installment_no}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                          {p.reference_no || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <a href={pdfUrl(`/payments/${p.id}/receipt`)} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 text-xs font-medium transition">
                            <Download size={12} /> Receipt
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
