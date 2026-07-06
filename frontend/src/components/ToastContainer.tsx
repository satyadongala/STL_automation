import React from 'react';
import { useStore } from '../store/useStore';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:bottom-5 z-50 flex flex-col gap-2 max-w-sm sm:w-full pointer-events-none">
      {toasts.map((toast) => {
        let bgColor = 'bg-white/85 border-brand-200/50';
        let icon = <Info className="w-5 h-5 text-blue-400 animate-pulse" />;
        
        if (toast.type === 'success') {
          bgColor = 'bg-white/90 border-emerald-500/30 text-text-primary';
          icon = <CheckCircle className="w-5 h-5 text-emerald-700" />;
        } else if (toast.type === 'error') {
          bgColor = 'bg-white/90 border-rose-500/30 text-text-primary';
          icon = <AlertCircle className="w-5 h-5 text-rose-700" />;
        }

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-4 rounded-xl border glass-panel shadow-2xl transition-all duration-300 animate-slide-in pointer-events-auto ${bgColor}`}
          >
            <div className="flex-shrink-0">{icon}</div>
            <div className="flex-grow text-sm font-medium">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-text-secondary hover:text-brand-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
