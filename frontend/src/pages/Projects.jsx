// src/pages/Projects.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, ArrowRight, TrendingUp, Home, CheckCircle, Clock } from 'lucide-react';
import { useProjectStore, PROJECTS } from '../store/projectStore';
import StatCard from '../components/StatCard';
import api from '../utils/api';
import { fmtPKR } from '../utils/format';

function ProjectCard({ proj, tower, stats, onEnter }) {
  const isActive = stats?.loading !== true;

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
                 hover:shadow-md transition-all duration-200"
    >
      {/* Color bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${proj.color}, ${proj.color}66)` }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${proj.color}18`, border: `1px solid ${proj.color}33` }}
            >
              <Building2 size={18} style={{ color: proj.color }} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">{proj.name}</h3>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${proj.color}15`, color: proj.color }}
              >
                {proj.months}-Month Plan
              </span>
            </div>
          </div>
          <span className="text-xs text-gray-400 font-mono">{proj.code}</span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-lg font-extrabold text-gray-800">
              {stats?.units?.total ?? '—'}
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Total Units</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-lg font-extrabold text-emerald-600">
              {stats?.units?.sold ?? '—'}
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Sold</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-lg font-extrabold text-blue-600">
              {stats?.units?.available ?? '—'}
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">Available</p>
          </div>
        </div>

        {/* Revenue */}
        {stats?.revenue && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5 mb-4">
            <span className="text-xs text-gray-500 font-medium">Revenue Collected</span>
            <span className="text-sm font-bold text-gray-800">
              {fmtPKR(stats.revenue.total_collected)}
            </span>
          </div>
        )}

        {/* Enter button */}
        <button
          onClick={() => onEnter(proj)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                     font-semibold text-sm transition-all duration-150 hover:gap-3"
          style={{
            background: `linear-gradient(135deg, ${proj.color}, ${proj.color}cc)`,
            color: '#fff',
          }}
        >
          Enter Project
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

export default function Projects() {
  const navigate  = useNavigate();
  const { setProject, project: activeProject } = useProjectStore();

  const { data: towers = [] } = useQuery({
    queryKey: ['towers'],
    queryFn: () => api.get('/properties/towers').then(r => r.data.data || []),
  });

  // Fetch stats for each tower independently (no project filter — overview mode)
  const statsQueries = PROJECTS.map(proj => {
    const tower = towers.find(t => t.code === proj.code);
    return useQuery({
      queryKey: ['project-stats', tower?.id],
      queryFn: () =>
        tower
          ? api.get('/dashboard/stats', { params: { tower_id: tower.id } }).then(r => r.data)
          : null,
      enabled: !!tower,
    });
  });

  const handleEnter = (proj) => {
    const tower = towers.find(t => t.code === proj.code);
    setProject({ ...proj, id: tower?.id || null });
    navigate('/dashboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Projects Overview</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          All Burooj projects — select one to view its full data
        </p>
      </div>

      {/* Summary stats (all projects combined) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Projects"
          value={PROJECTS.length}
          icon={Building2}
          gradient="teal"
        />
        <StatCard
          title="Total Units"
          value={statsQueries.reduce((s, q) => s + (q.data?.units?.total || 0), 0)}
          icon={Home}
          gradient="indigo"
        />
        <StatCard
          title="Units Sold"
          value={statsQueries.reduce((s, q) => s + (q.data?.units?.sold || 0), 0)}
          icon={CheckCircle}
          gradient="emerald"
        />
        <StatCard
          title="Active Bookings"
          value={statsQueries.reduce((s, q) => s + (q.data?.bookings?.active || 0), 0)}
          icon={Clock}
          gradient="amber"
        />
      </div>

      {/* Per-project cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PROJECTS.map((proj, i) => (
          <ProjectCard
            key={proj.code}
            proj={proj}
            tower={towers.find(t => t.code === proj.code)}
            stats={statsQueries[i].data}
            onEnter={handleEnter}
          />
        ))}
      </div>

      {/* Active project note */}
      {activeProject && (
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-100
                        rounded-xl px-4 py-3 shadow-sm">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: activeProject.color }}
          />
          Currently active: <strong className="text-gray-800">{activeProject.name}</strong>
          <span className="text-gray-400">— all module data is scoped to this project</span>
        </div>
      )}
    </div>
  );
}
