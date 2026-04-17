// src/utils/feasibilityApi.js
import api from './api';

const BASE = '/feasibility';

export const feasibilityApi = {
  listProjects:    (params)   => api.get(`${BASE}/projects`, { params }),
  createProject:   (data)     => api.post(`${BASE}/projects`, data),
  getProject:      (id)       => api.get(`${BASE}/projects/${id}`),
  deleteProject:   (id)       => api.delete(`${BASE}/projects/${id}`),
  saveInputs:      (id, data) => api.put(`${BASE}/projects/${id}/inputs`, data),
  calculate:       (id)       => api.post(`${BASE}/calculate/${id}`),
  getCashflow:     (id)       => api.get(`${BASE}/cashflow/${id}`),
  getScenarios:    (id)       => api.get(`${BASE}/scenarios/${id}`),
  runScenario:     (id, body) => api.post(`${BASE}/scenarios/${id}/run`, body),
  aiSuggest:       (body)     => api.post(`${BASE}/ai-suggest`, body),
  getReportData:   (id)       => api.get(`${BASE}/report-data/${id}`),
};

export function fmtM(val) {
  if (!val && val !== 0) return '—';
  const n = parseFloat(val);
  if (Math.abs(n) >= 1e9) return `${(n/1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n/1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n/1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

export function fmtPKRm(val) {
  return `PKR ${fmtM(val)}`;
}

export const RISK_LABEL = (score) =>
  score >= 70 ? { label: 'High Risk',    color: '#ef4444' }
: score >= 40 ? { label: 'Medium Risk',  color: '#f59e0b' }
:               { label: 'Low Risk',     color: '#10b981' };
