// src/components/Table.jsx
import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Loader2, Inbox } from 'lucide-react';

function SortIcon({ direction }) {
  if (direction === 'asc')  return <ChevronUp size={12} className="inline ml-1 opacity-80" />;
  if (direction === 'desc') return <ChevronDown size={12} className="inline ml-1 opacity-80" />;
  return <ChevronsUpDown size={12} className="inline ml-1 opacity-40" />;
}

export default function Table({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  onRowClick,
  rowKey = 'id',
  compact = false,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const sorted = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const pad = compact ? 'px-4 py-2' : 'px-4 py-3';

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-teal-600 text-white">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`${pad} text-left font-semibold whitespace-nowrap select-none
                              ${col.sortable ? 'cursor-pointer hover:bg-teal-700' : ''}
                              ${col.className || ''}`}
                  style={{ width: col.width }}
                  onClick={() => handleSort(col)}
                >
                  {col.label}
                  {col.sortable && <SortIcon direction={sortKey === col.key ? sortDir : null} />}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Loader2 size={22} className="animate-spin text-teal-600" />
                    <span className="text-xs">Loading…</span>
                  </div>
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox size={26} className="text-gray-300" />
                    <span className="text-xs text-gray-400">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={row[rowKey] || i}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-gray-50 last:border-0 transition-colors
                              ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                >
                  {columns.map(col => (
                    <td key={col.key} className={`${pad} text-gray-700 ${col.cellClassName || ''}`}>
                      {col.render ? col.render(row[col.key], row, i) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TablePagination({ page, total, limit, onChange }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from  = Math.min((page - 1) * limit + 1, total);
  const to    = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-1 pt-3 text-xs text-gray-500">
      <span>Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50
                     disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Prev
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page + i - 2;
          if (p < 1 || p > pages) return null;
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-8 py-1.5 rounded-lg border text-xs font-medium transition
                ${p === page
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'}`}
            >
              {p}
            </button>
          );
        })}
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50
                     disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}
