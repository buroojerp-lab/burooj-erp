// src/pages/UnitDetail.jsx
import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Maximize2, Home, MapPin, DollarSign } from 'lucide-react';
import api from '../utils/api';
import { fmtPKR } from '../utils/format';

export default function UnitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['unit', id],
    queryFn: () => api.get(`/property/units/${id}`).then(r => r.data),
  });

  const unit = data?.unit;

  const STATUS_COLOR = {
    available:   'bg-emerald-100 text-emerald-700',
    reserved:    'bg-amber-100 text-amber-700',
    sold:        'bg-gray-100 text-gray-600',
    maintenance: 'bg-red-100 text-red-700',
  };

  if (isLoading) return (
    <div className="p-6 space-y-4">{Array(3).fill(0).map((_, i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}</div>
  );
  if (!unit) return <div className="p-6 text-gray-400 text-center py-20">Unit not found</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={20} /></button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Unit {unit.unit_number}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${STATUS_COLOR[unit.status] || 'bg-gray-100 text-gray-600'}`}>
              {unit.status}
            </span>
          </div>
          <p className="text-sm text-gray-400">{unit.tower_name} · Floor {unit.floor_no}</p>
        </div>
        {unit.status === 'available' && (
          <Link to="/bookings/new" className="ml-auto flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
            Book This Unit
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Unit Information</h2>
          <div className="space-y-4">
            {[
              { label: 'Unit Number', value: unit.unit_number },
              { label: 'Type', value: unit.unit_type },
              { label: 'Tower', value: unit.tower_name },
              { label: 'Floor', value: unit.floor_no },
              { label: 'Size', value: `${parseFloat(unit.size_sqft).toLocaleString()} sqft` },
              { label: 'Bedrooms', value: unit.bedrooms },
              { label: 'Bathrooms', value: unit.bathrooms },
            ].map(r => (
              <div key={r.label} className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-sm text-gray-500">{r.label}</span>
                <span className="text-sm font-medium text-gray-800 capitalize">{r.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Pricing</h2>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 text-center">
              <div className="text-xs text-gray-400 mb-1">Total Unit Price</div>
              <div className="text-3xl font-bold text-gray-900">{fmtPKR(unit.total_price)}</div>
              <div className="text-sm text-gray-400 mt-1">₨{parseInt(unit.price_per_sqft).toLocaleString()} per sqft</div>
            </div>
            {unit.description && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Description</div>
                <p className="text-sm text-gray-700">{unit.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
