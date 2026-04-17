// src/utils/format.js

export const fmtPKR = (value, decimals = 0) => {
  const n = parseFloat(value) || 0;
  if (n >= 10000000) return `₨${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 1000000)  return `₨${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)     return `₨${(n / 1000).toFixed(0)}K`;
  return `₨${n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

export const fmtPKRFull = (value) => {
  const n = parseFloat(value) || 0;
  return `PKR ${n.toLocaleString('en-PK')}`;
};

export const fmtNum = (value) => {
  return parseInt(value || 0).toLocaleString('en-PK');
};

export const fmtDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export const fmtDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const fmtPct = (value, total) => {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
};

export const daysFromToday = (date) => {
  const diff = new Date(date) - new Date();
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

export const isOverdue = (date) => new Date(date) < new Date();

export const genBookingNo = (count) =>
  `BRJ-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
