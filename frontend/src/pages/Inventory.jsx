// src/pages/Inventory.jsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal, Home, Building2, Store, Briefcase } from 'lucide-react';
import api from '../utils/api';
import { fmtPKR } from '../utils/format';
import StatCard from '../components/StatCard';
import Table, { TablePagination } from '../components/Table';
import Button from '../components/Button';
import { useProjectStore } from '../store/projectStore';

const STATUS_STYLES = {
  available:   'bg-emerald-100 text-emerald-700',
  sold:        'bg-red-100 text-red-700',
  reserved:    'bg-amber-100 text-amber-700',
  maintenance: 'bg-gray-100 text-gray-600',
};

const TYPE_ICONS = {
  apartment: Home,
  shop:      Store,
  office:    Briefcase,
  penthouse: Building2,
};

const UNIT_TYPES = ['apartment', 'shop', 'office', 'penthouse'];
const STATUSES   = ['available', 'sold', 'reserved', 'maintenance'];

export default function Inventory() {
  const navigate = useNavigate();
  const { project } = useProjectStore();

  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [unitType, setUnitType] = useState('');
  const [page,     setPage]     = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', project?.id, status, unitType, page],
    queryFn: () =>
      api.get('/properties/units', {
        params: { status: status || undefined, unit_type: unitType || undefined, page, limit: 20 },
      }).then(r => r.data),
  });

  const units = data?.data || [];
  const total = data?.pagination?.total || 0;

  const filtered = search
    ? units.filter(u =>
        u.unit_number.toLowerCase().includes(search.toLowerCase()) ||
        u.customer_name?.toLowerCase().includes(search.toLowerCase())
      )
    : units;

  // Summary counts from data
  const summary = {
    total:     total,
    available: units.filter(u => u.status === 'available').length,
    sold:      units.filter(u => u.status === 'sold').length,
    reserved:  units.filter(u => u.status === 'reserved').length,
  };

  const columns = [
    {
      key: 'unit_number',
      label: 'Unit',
      sortable: true,
      render: (val, row) => {
        const Icon = TYPE_ICONS[row.unit_type] || Home;
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0098B4]/10 flex items-center justify-center flex-shrink-0">
              <Icon size={14} className="text-[#0098B4]" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{val}</p>
              <p className="text-xs text-gray-400">Floor {row.floor_no ?? '—'}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'unit_type',
      label: 'Type',
      sortable: true,
      render: val => (
        <span className="capitalize text-gray-600 text-sm">{val}</span>
      ),
    },
    {
      key: 'size_sqft',
      label: 'Size (sqft)',
      sortable: true,
      render: val => <span className="font-mono text-sm">{Number(val).toLocaleString()}</span>,
    },
    {
      key: 'total_price',
      label: 'Price',
      sortable: true,
      render: val => <span className="font-semibold text-gray-800">{fmtPKR(val)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: val => (
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize
                          ${STATUS_STYLES[val] || 'bg-gray-100 text-gray-600'}`}>
          {val}
        </span>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: val => <span className="text-sm text-gray-600">{val || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inventory</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {project?.name} — unit availability &amp; status
          </p>
        </div>
        <Button icon={Plus} onClick={() => navigate('/properties')}>
          Add Unit
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Total Units"    value={total}            icon={Home}      gradient="teal"    />
        <StatCard title="Available"      value={summary.available} icon={Home}      gradient="emerald" />
        <StatCard title="Sold"           value={summary.sold}      icon={Building2} gradient="rose"    />
        <StatCard title="Reserved"       value={summary.reserved}  icon={Building2} gradient="amber"   />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search unit or customer…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30 focus:border-[#0098B4]"
            />
          </div>

          {/* Type filter */}
          <select
            value={unitType}
            onChange={e => { setUnitType(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30 focus:border-[#0098B4]
                       bg-white text-gray-700"
          >
            <option value="">All Types</option>
            {UNIT_TYPES.map(t => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30 focus:border-[#0098B4]
                       bg-white text-gray-700"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>

          <Button variant="secondary" icon={SlidersHorizontal} size="md"
            onClick={() => { setSearch(''); setStatus(''); setUnitType(''); setPage(1); }}>
            Reset
          </Button>
        </div>
      </div>

      {/* Table */}
      <div>
        <Table
          columns={columns}
          data={filtered}
          loading={isLoading}
          emptyMessage="No units found for this project"
          onRowClick={row => row.id && navigate(`/properties/units/${row.id}`)}
        />
        <TablePagination page={page} total={total} limit={20} onChange={setPage} />
      </div>
    </div>
  );
}
