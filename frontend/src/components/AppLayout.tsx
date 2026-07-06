import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-primary-bg text-text-primary">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-200/60 bg-sidebar-bg/95 backdrop-blur-sm shrink-0 z-30">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-lg hover:bg-brand-50/80 active:bg-brand-100"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6 text-text-primary" />
          </button>
          <img src="/logo.jpg" alt="Satya Tech Lab" className="h-9 w-auto object-contain" />
          <div className="w-10" aria-hidden />
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-transparent">
          {children}
        </main>
      </div>
    </div>
  );
};
