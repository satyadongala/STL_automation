import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Sliders, History, Code, X } from 'lucide-react';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open = false, onClose }) => {
  const activeClass =
    'flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-100/80 border-l-4 border-brand-500 text-text-primary font-medium transition-all duration-250';
  const inactiveClass =
    'flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-brand-50/80 border border-transparent text-brand-900 hover:text-brand-900 transition-all duration-250';

  const navClick = () => onClose?.();

  return (
    <aside
      className={[
        'fixed lg:sticky inset-y-0 left-0 z-50 lg:z-auto',
        'w-64 max-w-[min(100vw,16rem)] shrink-0',
        'border-r border-brand-200/60 bg-sidebar-bg glass-panel',
        'flex flex-col h-full lg:h-screen',
        'transform transition-transform duration-250 ease-out',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ].join(' ')}
    >
      <div className="p-4 border-b border-brand-200/50 flex items-center justify-between gap-2">
        <Link to="/" className="inline-block" onClick={navClick}>
          <img src="/logo.jpg" alt="Satya Tech Lab" className="h-12 sm:h-14 w-auto object-contain" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-2 rounded-lg hover:bg-brand-50/80 text-text-secondary"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 sm:px-4 py-4 sm:py-6 flex flex-col gap-1 sm:gap-2 overflow-y-auto">
        <NavLink to="/" onClick={navClick} className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/projects" onClick={navClick} className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
          <FolderKanban className="w-5 h-5 shrink-0" />
          <span>Projects</span>
        </NavLink>

        <NavLink to="/environments" onClick={navClick} className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
          <Sliders className="w-5 h-5 shrink-0" />
          <span>Environments</span>
        </NavLink>

        <NavLink to="/shared-methods" onClick={navClick} className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
          <Code className="w-5 h-5 shrink-0" />
          <span>Shared Methods</span>
        </NavLink>

        <NavLink to="/history" onClick={navClick} className={({ isActive }) => (isActive ? activeClass : inactiveClass)}>
          <History className="w-5 h-5 shrink-0" />
          <span>Execution History</span>
        </NavLink>
      </nav>

      <div className="p-4 border-t border-brand-200/50 bg-white/30 text-center">
        <div className="text-xs text-text-secondary font-medium">Internal MVP v1.0.0</div>
      </div>
    </aside>
  );
};
