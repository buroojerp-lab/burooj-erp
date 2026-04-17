// src/pages/Payroll.jsx
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import {
  DollarSign, Play, Printer, Download, Filter,
  CheckCircle, Loader, X, Calendar, TrendingUp, Users
} from 'lucide-react';
import api from '../utils/api';
import { fmtPKR, fmtPKRFull } from '../utils/format';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Payslip Component (printable) ──
function Payslip({ employee, month, year }) {
  const gross = parseFloat(employee.gross_salary || employee.basic_salary);
  const hra = Math.round(gross * 0.4 / 1.4);
  const basic = gross - hra - 2000;
  const pf = Math.round(basic * 0.0833);
  const tax = gross * 12 > 600000 ? Math.round((gross * 12 - 600000) * 0.05 / 12) : 0;
  const net = gross - pf - tax;

  return (
    <div className="p-8 bg-white max-w-xl mx-auto font-sans text-sm">
      {/* Header */}
      <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
        <div className="text-xl font-black tracking-wider text-gray-900">BUROOJ HEIGHTS</div>
        <div className="text-gray-500 text-xs mt-0.5">Integrated Real Estate ERP</div>
        <div className="mt-2 text-sm font-bold text-gray-700">
          SALARY SLIP — {MONTHS[month - 1]?.toUpperCase()} {year}
        </div>
      </div>

      {/* Employee Info */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-5 text-sm">
        <div><span className="text-gray-500">Employee Name:</span> <b>{employee.name}</b></div>
        <div><span className="text-gray-500">Emp Code:</span> <b>{employee.emp_code}</b></div>
        <div><span className="text-gray-500">Department:</span> <b>{employee.department_name}</b></div>
        <div><span className="text-gray-500">Designation:</span> <b>{employee.designation}</b></div>
        <div><span className="text-gray-500">Bank:</span> <b>{employee.bank_name || '—'}</b></div>
        <div><span className="text-gray-500">Account:</span> <b>{employee.bank_account || '—'}</b></div>
      </div>

      {/* Earnings & Deductions */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-green-600 text-white text-xs font-bold px-3 py-2">EARNINGS</div>
          <div className="p-3 space-y-2">
            {[
              { l: 'Basic Salary', v: basic },
              { l: 'HRA (40%)', v: hra },
              { l: 'Medical Allowance', v: 2000 },
            ].map(r => (
              <div key={r.l} className="flex justify-between text-xs">
                <span className="text-gray-600">{r.l}</span>
                <span className="font-medium">{fmtPKRFull(r.v)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-2 border-t border-gray-200 font-bold">
              <span>Gross Salary</span>
              <span>{fmtPKRFull(gross)}</span>
            </div>
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-red-600 text-white text-xs font-bold px-3 py-2">DEDUCTIONS</div>
          <div className="p-3 space-y-2">
            {[
              { l: 'Provident Fund (8.33%)', v: pf },
              { l: 'Income Tax', v: tax },
            ].map(r => (
              <div key={r.l} className="flex justify-between text-xs">
                <span className="text-gray-600">{r.l}</span>
                <span className="font-medium text-red-600">{fmtPKRFull(r.v)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-2 border-t border-gray-200 font-bold text-red-600">
              <span>Total Deductions</span>
              <span>{fmtPKRFull(pf + tax)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Pay */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-4 text-center mb-5">
        <div className="text-xs text-green-600 font-bold uppercase tracking-wide mb-1">Net Salary Payable</div>
        <div className="text-2xl font-black text-green-700">{fmtPKRFull(net)}</div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end mt-8 pt-4 border-t border-gray-200">
        <div className="text-center">
          <div className="h-10 border-b border-gray-400 w-32 mb-1" />
          <div className="text-xs text-gray-500">Employee Signature</div>
        </div>
        <div className="text-xs text-gray-400 text-right">
          <div>Generated: {new Date().toLocaleDateString('en-PK')}</div>
          <div>Burooj Heights ERP v1.0</div>
        </div>
        <div className="text-center">
          <div className="h-10 border-b border-gray-400 w-32 mb-1" />
          <div className="text-xs text-gray-500">HR Manager</div>
        </div>
      </div>
    </div>
  );
}

// ── Payslip Modal ──
function PayslipModal({ employee, month, year, open, onClose }) {
  const printRef = useRef();
  const handlePrint = useReactToPrint({ content: () => printRef.current });

  if (!open || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Payslip — {employee.name}</h2>
          <div className="flex gap-3">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <Printer size={15} /> Print
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto" ref={printRef}>
          <Payslip employee={employee} month={month} year={year} />
        </div>
      </div>
    </div>
  );
}

export default function Payroll() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState('');
  const [payslipEmp, setPayslipEmp] = useState(null);
  const qc = useQueryClient();

  const { data: payrollData, isLoading } = useQuery({
    queryKey: ['payroll', { month, year, deptFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ month, year });
      if (deptFilter) params.set('department', deptFilter);
      return (await api.get(`/payroll?${params}`)).data;
    },
  });

  const runPayrollMutation = useMutation({
    mutationFn: () => api.post('/payroll/run', { month, year, department: deptFilter || undefined }),
    onSuccess: () => {
      toast.success(`Payroll processed for ${MONTHS[month - 1]} ${year}!`);
      qc.invalidateQueries(['payroll']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const employees = payrollData?.data || [];
  const summary = payrollData?.summary || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monthly salary processing and payslips</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => runPayrollMutation.mutate()}
            disabled={runPayrollMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
            {runPayrollMutation.isPending ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
            Run Payroll
          </button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 items-center">
        <Calendar size={18} className="text-gray-400" />
        <div className="font-medium text-gray-700">Processing Period:</div>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
          {[2022, 2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
        </select>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
          <option value="">All Departments</option>
          {['Construction', 'Finance', 'Admin', 'Sales', 'HR', 'IT'].map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Employees', value: summary.total_employees || employees.length, icon: Users },
          { label: 'Total Gross',     value: fmtPKR(summary.total_gross || 0),           icon: DollarSign },
          { label: 'Total PF',        value: fmtPKR(summary.total_pf || 0),              icon: TrendingUp },
          { label: 'Total Tax',       value: fmtPKR(summary.total_tax || 0),             icon: TrendingUp },
          { label: 'Net Payable',     value: fmtPKR(summary.total_net || 0),             icon: CheckCircle },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={16} className="text-orange-500" />
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
            <div className="text-lg font-bold text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            Payroll Register — {MONTHS[month - 1]} {year}
          </h2>
          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Download size={14} /> Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Employee', 'Department', 'Basic', 'HRA', 'Medical', 'Gross', 'PF', 'Tax', 'Net Salary', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? Array(6).fill(0).map((_, i) => (
                <tr key={i}>{Array(10).fill(0).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              )) : employees.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-16 text-center">
                  <DollarSign size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 mb-3">No payroll data. Click "Run Payroll" to process.</p>
                </td></tr>
              ) : employees.map(emp => {
                const basic = parseFloat(emp.basic_salary);
                const hra = Math.round(basic * 0.4);
                const med = 2000;
                const gross = basic + hra + med;
                const pf = Math.round(basic * 0.0833);
                const tax = gross * 12 > 600000 ? Math.round((gross * 12 - 600000) * 0.05 / 12) : 0;
                const net = gross - pf - tax;

                return (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {emp.name?.[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{emp.name}</div>
                          <div className="text-xs text-gray-400">{emp.emp_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.department_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtPKR(basic)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtPKR(hra)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtPKR(med)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fmtPKR(gross)}</td>
                    <td className="px-4 py-3 text-red-600">-{fmtPKR(pf)}</td>
                    <td className="px-4 py-3 text-red-600">-{fmtPKR(tax)}</td>
                    <td className="px-4 py-3 font-bold text-green-700 text-base">{fmtPKR(net)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setPayslipEmp(emp)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition">
                        <Printer size={13} /> Payslip
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {employees.length > 0 && (
              <tfoot>
                <tr className="bg-gray-800 text-white">
                  <td colSpan={5} className="px-4 py-3 font-bold">TOTAL</td>
                  <td className="px-4 py-3 font-bold">
                    {fmtPKR(employees.reduce((s, e) => s + parseFloat(e.basic_salary) * 1.4 + 2000, 0))}
                  </td>
                  <td className="px-4 py-3 text-red-300">
                    -{fmtPKR(employees.reduce((s, e) => s + Math.round(parseFloat(e.basic_salary) * 0.0833), 0))}
                  </td>
                  <td className="px-4 py-3 text-red-300">—</td>
                  <td className="px-4 py-3 font-bold text-green-300">
                    {fmtPKR(employees.reduce((s, e) => {
                      const g = parseFloat(e.basic_salary) * 1.4 + 2000;
                      const pf = Math.round(parseFloat(e.basic_salary) * 0.0833);
                      return s + g - pf;
                    }, 0))}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <PayslipModal
        employee={payslipEmp}
        month={month}
        year={year}
        open={!!payslipEmp}
        onClose={() => setPayslipEmp(null)}
      />
    </div>
  );
}
