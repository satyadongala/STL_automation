import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Sliders, History, Code } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const activeClass = "flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-100/80 border-l-4 border-brand-500 text-text-primary font-medium transition-all duration-250";
  const inactiveClass = "flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-brand-50/80 border border-transparent text-brand-900 hover:text-brand-900 transition-all duration-250";

  return (
    <aside className="w-64 border-r border-brand-200/60 bg-sidebar-bg glass-panel flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-brand-200/50">
        <Link to="/" className="inline-block">
          <img
            src="/logo.jpg"
            alt="Satya Tech Lab"
            className="h-14 w-auto object-contain"
          />
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
        <NavLink to="/" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink to="/projects" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
          <FolderKanban className="w-5 h-5" />
          <span>Projects</span>
        </NavLink>

        <NavLink to="/environments" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
          <Sliders className="w-5 h-5" />
          <span>Environments</span>
        </NavLink>

        <NavLink to="/shared-methods" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
          <Code className="w-5 h-5" />
          <span>Shared Methods</span>
        </NavLink>

        <NavLink to="/history" className={({ isActive }) => isActive ? activeClass : inactiveClass}>
          <History className="w-5 h-5" />
          <span>Execution History</span>
        </NavLink>
      </nav>

      <div className="p-4 border-t border-brand-200/50 bg-white/30 text-center">
        <div className="text-xs text-text-secondary font-medium">Internal MVP v1.0.0</div>
      </div>
    </aside>
  );
};
