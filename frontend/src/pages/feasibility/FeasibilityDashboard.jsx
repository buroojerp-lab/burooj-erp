// src/pages/feasibility/FeasibilityDashboard.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Plus, TrendingUp, DollarSign, BarChart3,
  ShieldAlert, Calculator, ArrowRight, Trash2, Loader2,
  AlertTriangle, CheckCircle, Clock, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { feasibilityApi, fmtPKRm, RISK_LABEL } from '../../utils/feasibilityApi';
import { useProjectStore } from '../../store/projectStore';

function KPICard({ label, value, sub, icon: Icon, color = '#0098B4', dark = false }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 border
      ${dark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="absolute right-4 top-4 opacity-[0.08] pointer-events-none">
        <Icon size={56} color={dark ? '#fff' : color} />
      </div>
      <div className="relative">
        <p className={`text-xs font-semibold uppercase tracking-widest mb-1
          ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
        <p className={`text-2xl font-extrabold leading-none ${dark ? 'text-white' : 'text-gray-900'}`}
           style={!dark ? { color } : undefined}>
          {value}
        </p>
        {sub && <p className={`text-xs mt-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{sub}</p>}
      </div>
    </div>
  );
}

function ProjectCard({ project, onDelete }) {
  const navigate   = useNavigate();
  const risk       = RISK_LABEL(project.risk_score ?? 50);
  const statusColor = {
    draft:     'bg-gray-100 text-gray-500',
    active:    'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    archived:  'bg-amber-100 text-amber-700',
  }[project.status] || 'bg-gray-100 text-gray-500';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md
                    transition-all duration-200 overflow-hidden group">
      <div className="h-1 bg-gradient-to-r from-[#0098B4] to-[#26b8d6]" />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0098B4]/10 border border-[#0098B4]/20
                            flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-[#0098B4]" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm leading-tight">{project.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{project.location || 'Location not set'}</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
            {project.status}
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-50 rounded-xl p-2.5 text-center">
            <p className="text-sm font-extrabold text-gray-800">
              {project.roi_pct != null ? `${parseFloat(project.roi_pct).toFixed(1)}%` : '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">ROI</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
            <p className="text-sm font-extrabold text-emerald-700">
              {project.net_profit != null ? fmtPKRm(project.net_profit) : '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Net Profit</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-2.5 text-center">
            <p className="text-sm font-extrabold text-blue-700">
              {project.irr_pct != null ? `${parseFloat(project.irr_pct).toFixed(1)}%` : '—'}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">IRR</p>
          </div>
        </div>

        {/* Risk badge */}
        {project.risk_score != null && (
          <div className="flex items-center gap-1.5 mb-4">
            <ShieldAlert size={11} style={{ color: risk.color }} />
            <span className="text-xs font-semibold" style={{ color: risk.color }}>{risk.label}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden ml-1">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${project.risk_score}%`, background: risk.color }} />
            </div>
            <span className="text-[10px] text-gray-400">{project.risk_score}/100</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/feasibility/builder/${project.id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
                       bg-[#0098B4] hover:bg-[#007a91] text-white text-xs font-bold transition"
          >
            Open <ArrowRight size={12} />
          </button>
          <button
            onClick={() => navigate(`/feasibility/report/${project.id}`)}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200
                       text-gray-600 text-xs font-medium transition"
          >
            <BarChart3 size={13} />
          </button>
          <button
            onClick={() => onDelete(project.id)}
            className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100
                       text-red-500 text-xs font-medium transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function NewProjectModal({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', location: '', description: '' });
  const { project: activeProject } = useProjectStore();

  const mutation = useMutation({
    mutationFn: () => feasibilityApi.createProject({
      ...form,
      tower_id: activeProject?.id || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['feasibility-projects']);
      toast.success('Project created');
      setForm({ name: '', location: '', description: '' });
      onClose();
    },
    onError: () => toast.error('Failed to create project'),
  });

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">New Feasibility Project</h2>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: 'name',        label: 'Project Name *',  placeholder: 'e.g. Burooj Heights Tower 4' },
            { key: 'location',    label: 'Location',        placeholder: 'e.g. Gulberg, Lahore' },
            { key: 'description', label: 'Description',     placeholder: 'Brief overview…' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">{f.label}</label>
              {f.key === 'description' ? (
                <textarea
                  value={form[f.key]} rows={2}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30 resize-none"
                />
              ) : (
                <input
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#0098B4]/30"
                />
              )}
            </div>
          ))}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.name || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-[#0098B4] hover:bg-[#007a91] text-white text-sm font-bold
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeasibilityDashboard() {
  const [showModal, setShowModal] = useState(false);
  const qc = useQueryClient();
  const { project: activeProject } = useProjectStore();

  const { data, isLoading } = useQuery({
    queryKey: ['feasibility-projects', activeProject?.id],
    queryFn:  () => feasibilityApi.listProjects(
      activeProject?.id ? { tower_id: activeProject.id } : {}
    ).then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => feasibilityApi.deleteProject(id),
    onSuccess:  () => { qc.invalidateQueries(['feasibility-projects']); toast.success('Deleted'); },
  });

  const projects = data || [];
  const withResults = projects.filter(p => p.roi_pct != null);

  const totalInvestment = withResults.reduce((s, p) => s + parseFloat(p.total_project_cost || 0), 0);
  const avgROI          = withResults.length
    ? withResults.reduce((s, p) => s + parseFloat(p.roi_pct || 0), 0) / withResults.length
    : 0;
  const avgIRR          = withResults.filter(p => p.irr_pct).length
    ? withResults.filter(p => p.irr_pct).reduce((s, p) => s + parseFloat(p.irr_pct), 0)
      / withResults.filter(p => p.irr_pct).length
    : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            AI Feasibility Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            High-rise investment analysis & financial modelling
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => qc.invalidateQueries(['feasibility-projects'])}
            className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition">
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0098B4] hover:bg-[#007a91]
                       text-white text-sm font-bold shadow-sm transition"
          >
            <Plus size={15} /> New Project
          </button>
        </div>
      </div>

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Total Projects"   value={projects.length}          icon={Building2}  color="#0098B4" />
        <KPICard label="Total Investment" value={fmtPKRm(totalInvestment)} icon={DollarSign}  color="#8b5cf6" />
        <KPICard label="Avg ROI"          value={`${avgROI.toFixed(1)}%`}  icon={TrendingUp}  color="#10b981" />
        <KPICard label="Avg IRR"          value={`${avgIRR.toFixed(1)}%`}  icon={Calculator}  color="#f59e0b" />
      </div>

      {/* ── Project Grid ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#0098B4]" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl
                        border border-gray-100 shadow-sm">
          <Building2 size={40} className="text-gray-200 mb-4" />
          <h3 className="font-bold text-gray-500 mb-1">No feasibility projects yet</h3>
          <p className="text-sm text-gray-400 mb-6 text-center max-w-xs">
            Create your first project to run AI-powered financial feasibility analysis
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0098B4] text-white
                       text-sm font-bold hover:bg-[#007a91] transition"
          >
            <Plus size={14} /> Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onDelete={(id) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}

      <NewProjectModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
