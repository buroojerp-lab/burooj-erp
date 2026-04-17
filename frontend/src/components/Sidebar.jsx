// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, FileText, Users, CreditCard,
  TrendingUp, UserCog, BarChart3, Settings, MessageCircle,
  Package, Wrench, DollarSign, Briefcase, UserCheck,
  Building, BadgeDollarSign, ShieldCheck, Calculator,
  ChevronDown, PanelLeftClose, PanelLeftOpen, FolderKanban,
  Warehouse, LineChart, Sliders, AreaChart, ClipboardList,
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';

const NAV = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
      { path: '/projects',   label: 'Projects',   icon: FolderKanban },
    ],
  },
  {
    label: 'Sales',
    items: [
      { path: '/bookings',     label: 'Bookings',     icon: FileText },
      { path: '/customers',    label: 'Customers',    icon: Users },
      { path: '/agents',       label: 'Agents',       icon: UserCheck },
      { path: '/installments', label: 'Installments', icon: CreditCard },
      { path: '/payments',     label: 'Payments',     icon: DollarSign },
    ],
  },
  {
    label: 'Property',
    items: [
      { path: '/inventory',  label: 'Inventory',  icon: Warehouse },
      { path: '/properties', label: 'Properties', icon: Building2 },
      { path: '/investors',  label: 'Investors',  icon: Building },
    ],
  },
  {
    label: 'Finance',
    items: [
      { path: '/finance',   label: 'Accounting', icon: TrendingUp },
      { path: '/expenses',  label: 'Expenses',   icon: BadgeDollarSign },
      { path: '/audit',     label: 'Auto Audit', icon: ShieldCheck },
    ],
  },
  {
    label: 'HR & Ops',
    items: [
      { path: '/hr',          label: 'Human Resources', icon: UserCog },
      { path: '/payroll',     label: 'Payroll',         icon: Briefcase },
      { path: '/procurement', label: 'Procurement',     icon: Package },
      { path: '/facility',    label: 'Facility',        icon: Wrench },
      { path: '/whatsapp',    label: 'WhatsApp',        icon: MessageCircle },
    ],
  },
  {
    label: 'Feasibility',
    items: [
      { path: '/feasibility',        label: 'AI Feasibility',  icon: LineChart },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { path: '/reports',                  label: 'Reports',     icon: BarChart3 },
      { path: '/tools/payment-calculator', label: 'Plan Calc',   icon: Calculator },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
      { path: '/users',    label: 'Users',    icon: Users },
    ],
  },
];

function NavGroup({ group, collapsed, openGroups, onToggle }) {
  const location = useLocation();
  const isGroupActive = group.items.some(i => location.pathname.startsWith(i.path));
  const isOpen = openGroups.includes(group.label);

  if (collapsed) {
    return (
      <div className="mb-1">
        {group.items.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            className={({ isActive }) =>
              `flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all mb-0.5
               ${isActive ? 'bg-[#0098B4]/20 text-[#0098B4]' : 'text-[#8b949e] hover:bg-white/5 hover:text-white'}`
            }
          >
            <item.icon size={17} />
          </NavLink>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => onToggle(group.label)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px]
                    font-semibold uppercase tracking-widest transition-colors mb-0.5
                    ${isGroupActive ? 'text-[#0098B4]' : 'text-[#8b949e]/60 hover:text-[#8b949e]'}`}
      >
        <span>{group.label}</span>
        <ChevronDown
          size={11}
          className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="space-y-0.5">
          {group.items.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all
                 ${isActive
                   ? 'bg-[#0098B4]/15 text-[#26b8d6] font-semibold'
                   : 'text-[#8b949e] hover:bg-white/5 hover:text-white font-medium'
                 }`
              }
            >
              <item.icon size={15} className="flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle }) {
  const { project } = useProjectStore();
  const location = useLocation();

  const defaultOpen = NAV
    .filter(g => g.items.some(i => location.pathname.startsWith(i.path)))
    .map(g => g.label);

  const [openGroups, setOpenGroups] = useState(
    defaultOpen.length > 0 ? defaultOpen : ['Overview', 'Sales']
  );

  const toggleGroup = (label) => {
    setOpenGroups(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  return (
    <aside
      className="flex flex-col bg-[#0d1117] border-r border-[#21262d] flex-shrink-0 transition-all duration-200 h-full"
      style={{ width: collapsed ? '60px' : '220px' }}
    >
      {/* Logo */}
      <div className={`flex items-center border-b border-[#21262d] flex-shrink-0 h-14
                       ${collapsed ? 'justify-center px-2' : 'px-4 gap-2.5'}`}>
        <div className="w-8 h-8 rounded-lg bg-[#0098B4]/20 border border-[#0098B4]/30
                        flex items-center justify-center flex-shrink-0">
          <Building2 size={16} className="text-[#0098B4]" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-white leading-tight tracking-wide">Burooj ERP</p>
            <p className="text-[10px] text-[#8b949e] leading-tight truncate">Marketing Suite</p>
          </div>
        )}
      </div>

      {/* Active project pill */}
      {project && !collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg border"
          style={{
            background: `${project.color}12`,
            borderColor: `${project.color}30`,
          }}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: project.color, boxShadow: `0 0 6px ${project.color}` }} />
            <span className="text-xs font-semibold truncate" style={{ color: project.color }}>
              {project.name}
            </span>
          </div>
          <p className="text-[10px] text-[#8b949e] mt-0.5 truncate">{project.months}-Month Plan</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-2 scrollbar-thin
                      scrollbar-track-transparent scrollbar-thumb-[#21262d]">
        {NAV.map(group => (
          <NavGroup
            key={group.label}
            group={group}
            collapsed={collapsed}
            openGroups={openGroups}
            onToggle={toggleGroup}
          />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-[#21262d] p-2 flex-shrink-0">
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full flex items-center justify-center p-2 rounded-lg
                     text-[#8b949e] hover:bg-white/5 hover:text-white transition-colors"
        >
          {collapsed
            ? <PanelLeftOpen size={16} />
            : <PanelLeftClose size={16} />
          }
        </button>
      </div>
    </aside>
  );
}
