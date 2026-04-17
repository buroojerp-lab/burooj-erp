// src/components/ProjectSelector.jsx — compact dropdown for Topbar
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Check, RefreshCw } from 'lucide-react';
import { useProjectStore, PROJECTS } from '../store/projectStore';

export default function ProjectSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { project, setProject, clearProject } = useProjectStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (proj) => {
    setProject({ ...proj, id: project?.id });
    setOpen(false);
  };

  const handleSwitch = () => {
    clearProject();
    setOpen(false);
    navigate('/select-project');
  };

  if (!project) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all
                   hover:bg-gray-50 border-gray-200 bg-white text-sm font-medium text-gray-700"
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: project.color, boxShadow: `0 0 6px ${project.color}88` }}
        />
        <span className="max-w-[140px] truncate">{project.name}</span>
        <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl
                        border border-gray-100 overflow-hidden z-50 animate-fade-in">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Select Project</p>
          </div>

          {PROJECTS.map((proj) => {
            const isActive = project.code === proj.code;
            return (
              <button
                key={proj.code}
                onClick={() => handleSelect(proj)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left
                  ${isActive ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${proj.color}18`, border: `1px solid ${proj.color}33` }}
                >
                  <Building2 size={14} style={{ color: proj.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{proj.name}</p>
                  <p className="text-xs text-gray-400 truncate">{proj.months} Month Plan</p>
                </div>
                {isActive && <Check size={14} style={{ color: proj.color }} className="flex-shrink-0" />}
              </button>
            );
          })}

          <div className="border-t border-gray-100 p-2">
            <button
              onClick={handleSwitch}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
                         text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <RefreshCw size={12} />
              Project Overview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
