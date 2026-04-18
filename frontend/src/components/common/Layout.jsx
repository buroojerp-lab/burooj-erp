// src/components/common/Layout.jsx — Multi-Techno style header
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard, Building2, FileText, Users, CreditCard,
  TrendingUp, UserCog, BarChart3, Settings, MessageCircle,
  Package, Wrench, LogOut, Bell, DollarSign, Briefcase,
  UserCheck, Building, BadgeDollarSign, ChevronDown, Plus,
  ShoppingCart, ShieldCheck, Calculator, Menu, X
} from 'lucide-react';
import VoiceCommand from './VoiceCommand';
import LanguageSwitcher from './LanguageSwitcher';
import { useProjectStore } from '../../store/projectStore';
import { RefreshCw } from 'lucide-react';

// ── Module groups (matching Multi-Techno style) ──
const MODULE_GROUPS = [
  {
    label: 'Dashboards',
    single: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Sales Module',
    icon: FileText,
    items: [
      { path: '/bookings',     label: 'Bookings',     icon: FileText },
      { path: '/customers',    label: 'Customers',    icon: Users },
      { path: '/agents',       label: 'Agents',       icon: UserCheck },
      { path: '/installments', label: 'Installments', icon: CreditCard },
      { path: '/payments',                  label: 'Payments',    icon: DollarSign  },
      { path: '/tools/payment-calculator', label: 'Plan Calc',   icon: Calculator  },
    ],
  },
  {
    label: 'Financial Module',
    icon: TrendingUp,
    items: [
      { path: '/finance',   label: 'Accounting',   icon: TrendingUp },
      { path: '/expenses',  label: 'Expenses',     icon: BadgeDollarSign },
      { path: '/audit',     label: 'Auto Audit',   icon: ShieldCheck },
    ],
  },
  {
    label: 'Property Module',
    icon: Building2,
    items: [
      { path: '/properties', label: 'Properties', icon: Building2 },
      { path: '/investors',  label: 'Investors',  icon: Building },
    ],
  },
  {
    label: 'HR & Payroll',
    icon: UserCog,
    items: [
      { path: '/hr',      label: 'HR',      icon: UserCog },
      { path: '/payroll', label: 'Payroll', icon: Briefcase },
    ],
  },
  {
    label: 'Operations',
    icon: Package,
    items: [
      { path: '/procurement', label: 'Procurement', icon: Package },
      { path: '/facility',    label: 'Facility',    icon: Wrench },
      { path: '/whatsapp',    label: 'WhatsApp',    icon: MessageCircle },
    ],
  },
  {
    label: 'Reports',
    single: '/reports',
    icon: BarChart3,
  },
  {
    label: 'Settings',
    single: '/settings',
    icon: Settings,
  },
];

// ── Dropdown Nav Item — uses portal to escape overflow clipping ──
function NavDropdown({ group, location }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const isActive = group.items?.some(i => location.pathname.startsWith(i.path));

  const handleOpen = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inBtn  = btnRef.current  && btnRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inBtn && !inMenu) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="flex-shrink-0">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all
          ${isActive ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
      >
        <group.icon size={13} className="flex-shrink-0" />
        {group.label}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
          className="w-48 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 overflow-hidden"
        >
          {group.items.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors
                 ${isActive ? 'bg-orange-50 text-orange-600' : 'text-gray-700 hover:bg-gray-50'}`
              }
            >
              <item.icon size={13} className="flex-shrink-0 text-gray-400" />
              {item.label}
            </NavLink>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Single Nav Link ──
function NavItem({ group, location }) {
  const isActive = location.pathname === group.single || location.pathname.startsWith(group.single + '/');
  return (
    <NavLink
      to={group.single}
      className={() =>
        `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0
         ${isActive ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
      }
    >
      <group.icon size={13} className="flex-shrink-0" />
      {group.label}
    </NavLink>
  );
}

export default function Layout() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { project, clearProject } = useProjectStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleSwitchProject = () => {
    clearProject();
    navigate('/select-project');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabel = {
    admin:       'Administrator',
    manager:     'Manager',
    sales_agent: 'Sales Agent',
    accountant:  'Accountant',
    investor:    'Investor',
  }[user?.role] || user?.role;

  // Filter Settings for non-admins if desired
  const groups = MODULE_GROUPS;

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Mobile Drawer Overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-gray-900 h-full overflow-y-auto flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
              <div>
                <div className="font-extrabold text-xs text-orange-400 uppercase tracking-widest">Burooj ERP</div>
                <div className="text-xs text-gray-400 mt-0.5">{user?.name} · {roleLabel}</div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700">
                <X size={18} />
              </button>
            </div>
            {/* Drawer Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              {groups.map(group => (
                <div key={group.label}>
                  {group.single ? (
                    <NavLink to={group.single}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                         ${isActive ? 'bg-orange-500 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
                      }>
                      <group.icon size={16} />
                      {group.label}
                    </NavLink>
                  ) : (
                    <div className="mb-1">
                      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <group.icon size={12} />
                        {group.label}
                      </div>
                      {group.items.map(item => (
                        <NavLink key={item.path} to={item.path}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition ml-2
                             ${isActive ? 'bg-orange-500 text-white font-medium' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`
                          }>
                          <item.icon size={14} />
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
            {/* Drawer Footer */}
            <div className="px-3 py-4 border-t border-gray-700 space-y-1">
              <NavLink to="/settings"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition">
                <Settings size={16} /> Settings
              </NavLink>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/30 transition">
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          TOP BAR
      ══════════════════════════════════════ */}
      <header className="flex-shrink-0 bg-gray-900 text-white z-30 shadow-xl">

        <div className="flex items-center px-3 md:px-4 h-13 border-b border-gray-700/60 py-2 gap-2">

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 flex-shrink-0">
            <Menu size={20} />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0 md:mr-6">
            <img src="/logo.png" alt="Burooj Marketing" className="h-7 md:h-8 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
            <div className="hidden sm:block border-l border-gray-600 pl-3">
              <div className="font-extrabold text-xs leading-tight tracking-widest text-orange-400 uppercase">Burooj Marketing ERP</div>
              <div className="text-xs text-gray-400 leading-tight">Integrated Solutions · Adnan Sindhu</div>
            </div>
          </div>

          {/* Active Project Badge */}
          {project && (
            <button onClick={handleSwitchProject}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 flex-shrink-0"
              style={{ borderColor: `${project.color}55`, background: `${project.color}15` }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: project.color }} />
              <span className="text-xs font-semibold text-white">{project.name}</span>
              <RefreshCw size={11} className="text-gray-400" />
            </button>
          )}

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <NavLink to="/bookings/new"
              className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm">
              <Plus size={13} />
              <span className="hidden sm:inline">New Booking</span>
            </NavLink>

            <div className="hidden md:block text-gray-400 hover:text-white">
              <VoiceCommand />
            </div>

            <div className="hidden md:block border border-gray-700 rounded-lg">
              <LanguageSwitcher />
            </div>

            <button className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white relative transition">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>

            {/* User Menu */}
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 pl-2 pr-2 py-1.5 rounded-lg hover:bg-gray-700 transition border border-gray-700">
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-extrabold">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-semibold leading-tight text-white">{user?.name}</div>
                  <div className="text-xs text-orange-400 leading-tight">{roleLabel}</div>
                </div>
                <ChevronDown size={12} className="text-gray-400 hidden md:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-semibold rounded-full capitalize">{roleLabel}</span>
                  </div>
                  <NavLink to="/settings" onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                    <Settings size={14} className="text-gray-400" /> Settings
                  </NavLink>
                  <button onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition">
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Module Nav — desktop only */}
        <nav className="hidden md:flex items-center overflow-x-auto scrollbar-none h-10 px-3 gap-0.5 bg-gray-800">
          {groups.map(group =>
            group.single
              ? <NavItem key={group.label} group={group} location={location} />
              : <NavDropdown key={group.label} group={group} location={location} />
          )}
        </nav>
      </header>

      {/* ── Page Content ── */}
      <main className="flex-1 overflow-y-auto bg-gray-50"
        onClick={() => userMenuOpen && setUserMenuOpen(false)}>
        <Outlet />
      </main>
    </div>
  );
}
