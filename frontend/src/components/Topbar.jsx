// src/components/Topbar.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Bell, ChevronDown, LogOut, Settings, Plus,
  Search, Menu,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ProjectSelector from './ProjectSelector';

const PAGE_TITLES = {
  '/dashboard':                'Dashboard',
  '/projects':                 'Projects',
  '/inventory':                'Inventory',
  '/properties':               'Properties',
  '/bookings':                 'Bookings',
  '/bookings/new':             'New Booking',
  '/customers':                'Customers',
  '/agents':                   'Agents',
  '/installments':             'Installments',
  '/payments':                 'Payments',
  '/expenses':                 'Expenses',
  '/finance':                  'Accounting',
  '/audit':                    'Financial Audit',
  '/investors':                'Investors',
  '/hr':                       'Human Resources',
  '/payroll':                  'Payroll',
  '/procurement':              'Procurement',
  '/facility':                 'Facility',
  '/whatsapp':                 'WhatsApp',
  '/reports':                  'Reports',
  '/settings':                 'Settings',
  '/users':                    'Users',
  '/tools/payment-calculator': 'Payment Calculator',
};

export default function Topbar({ onMenuToggle }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate    = useNavigate();
  const location    = useLocation();

  const pageTitle = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => location.pathname.startsWith(path))?.[1] || 'Burooj ERP';

  const roleLabel = {
    admin:       'Administrator',
    manager:     'Manager',
    sales_agent: 'Sales Agent',
    accountant:  'Accountant',
    investor:    'Investor',
  }[user?.role] || user?.role;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="flex-shrink-0 h-14 bg-white border-b border-gray-100
                        flex items-center gap-3 px-4 z-20 shadow-sm">

      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                   transition-colors lg:hidden"
      >
        <Menu size={18} />
      </button>

      {/* Page title */}
      <h1 className="font-bold text-gray-800 text-base leading-none mr-2 hidden sm:block">
        {pageTitle}
      </h1>

      <div className="flex-1" />

      {/* Project Selector */}
      <ProjectSelector />

      {/* New Booking shortcut */}
      <NavLink
        to="/bookings/new"
        className="flex items-center gap-1.5 bg-[#0098B4] hover:bg-[#007a91] text-white
                   px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm whitespace-nowrap"
      >
        <Plus size={13} />
        <span className="hidden sm:inline">New Booking</span>
      </NavLink>

      {/* Notifications */}
      <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
        <Bell size={17} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(o => !o)}
          className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg
                     hover:bg-gray-100 transition border border-gray-100"
        >
          <div className="w-7 h-7 rounded-full bg-[#0098B4] flex items-center justify-center
                          text-xs font-extrabold text-white flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="hidden md:block text-left pr-1">
            <p className="text-xs font-semibold text-gray-800 leading-tight">{user?.name}</p>
            <p className="text-[10px] text-[#0098B4] leading-tight font-medium">{roleLabel}</p>
          </div>
          <ChevronDown size={12} className="text-gray-400" />
        </button>

        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl
                            border border-gray-100 z-50 py-1 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
                <span className="inline-block mt-1.5 px-2 py-0.5 bg-[#0098B4]/10 text-[#0098B4]
                                 text-xs font-semibold rounded-full capitalize">
                  {roleLabel}
                </span>
              </div>
              <NavLink
                to="/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700
                           hover:bg-gray-50 transition"
              >
                <Settings size={14} className="text-gray-400" />
                Settings
              </NavLink>
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm
                           text-red-600 hover:bg-red-50 transition"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
