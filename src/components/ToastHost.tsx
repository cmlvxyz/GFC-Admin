import React from 'react';
import { X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastHostProps {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}

const styles: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: 'bg-emerald-500 dark:bg-emerald-600', icon: '✅' },
  error: { bg: 'bg-red-500 dark:bg-red-600', icon: '❌' },
  warning: { bg: 'bg-amber-500 dark:bg-amber-600', icon: '⚠️' },
  info: { bg: 'bg-blue-500 dark:bg-blue-600', icon: 'ℹ️' }
};

export const ToastHost: React.FC<ToastHostProps> = ({ toasts, dismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 max-w-md">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${styles[toast.type].bg} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slideInToast`}
        >
          <span>{styles[toast.type].icon}</span>
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => dismiss(toast.id)} className="ml-auto opacity-70 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};