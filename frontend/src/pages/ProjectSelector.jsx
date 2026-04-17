// src/pages/ProjectSelector.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { useProjectStore, PROJECTS } from '../store/projectStore';
import api from '../utils/api';

export default function ProjectSelector() {
  const navigate        = useNavigate();
  const { setProject }  = useProjectStore();
  const [towers,   setTowers]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [entering, setEntering] = useState(null); // code of project being selected

  useEffect(() => {
    api.get('/properties/towers')
      .then(r => setTowers(r.data.data || []))
      .catch(() => setTowers([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (proj) => {
    setEntering(proj.code);
    // Match tower by code
    const tower = towers.find(t => t.code === proj.code);
    if (tower) {
      setProject({ ...proj, id: tower.id });
    } else {
      // Tower not found — try by name
      const byName = towers.find(t => t.name === proj.name);
      setProject({ ...proj, id: byName?.id || null });
    }
    // Short pause so animation shows
    await new Promise(r => setTimeout(r, 400));
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#07090f] relative overflow-hidden px-4">

      {/* Background radial glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#0098B4]/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] rounded-full bg-amber-600/5 blur-[100px]" />
      </div>

      {/* Logo + header */}
      <div className="relative z-10 text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-5 shadow-2xl">
          <Building2 size={32} className="text-[#0098B4]" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
          Burooj Marketing ERP
        </h1>
        <p className="text-gray-400 text-sm">
          Select the project you want to manage
        </p>
      </div>

      {/* Project cards */}
      <div className="relative z-10 flex flex-col md:flex-row gap-6 w-full max-w-4xl">
        {PROJECTS.map((proj) => {
          const isEntering = entering === proj.code;
          return (
            <button
              key={proj.code}
              onClick={() => !entering && handleSelect(proj)}
              disabled={!!entering}
              className="group relative flex-1 text-left rounded-2xl overflow-hidden border border-white/10
                         bg-white/5 backdrop-blur-xl p-7 transition-all duration-300
                         hover:border-white/20 hover:bg-white/8 hover:scale-[1.02]
                         disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none"
              style={{ boxShadow: `0 0 0 0 ${proj.color}00` }}
            >
              {/* Colored top bar */}
              <div
                className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
                style={{ background: `linear-gradient(90deg, ${proj.color}, ${proj.color}88)` }}
              />

              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"
                style={{ background: `radial-gradient(circle at 50% 0%, ${proj.color}18 0%, transparent 70%)` }}
              />

              {/* Icon */}
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
                style={{ background: `${proj.color}22`, border: `1px solid ${proj.color}44` }}
              >
                {isEntering
                  ? <Loader2 size={22} className="animate-spin" style={{ color: proj.color }} />
                  : <Building2 size={22} style={{ color: proj.color }} />
                }
              </div>

              {/* Project name */}
              <h2 className="text-xl font-bold text-white mb-1">{proj.name}</h2>

              {/* Plan badge */}
              <span
                className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full mb-4"
                style={{ background: `${proj.color}22`, color: proj.color, border: `1px solid ${proj.color}44` }}
              >
                {proj.months} Months
              </span>

              {/* Description */}
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">{proj.desc}</p>

              {/* Enter button */}
              <div
                className="flex items-center gap-2 text-sm font-semibold transition-all duration-200
                           group-hover:gap-3"
                style={{ color: proj.color }}
              >
                {isEntering ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Entering…</span>
                  </>
                ) : (
                  <>
                    <span>Enter Project</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Loading indicator while fetching towers */}
      {loading && (
        <div className="relative z-10 mt-8 flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          <span>Connecting to server…</span>
        </div>
      )}

      {/* Footer */}
      <p className="relative z-10 mt-12 text-gray-600 text-xs">
        Burooj Marketing ERP v2.0 &mdash; Powered by Burooj Heights
      </p>
    </div>
  );
}
