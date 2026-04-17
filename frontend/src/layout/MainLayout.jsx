// src/layout/MainLayout.jsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar  from '../components/Topbar';

export default function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuToggle={() => setCollapsed(c => !c)} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* React Router nested routes */}
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
