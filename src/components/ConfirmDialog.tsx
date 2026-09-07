import React from 'react';

export interface ConfirmState {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface ConfirmDialogProps {
  confirm: ConfirmState | null;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ confirm, onClose }) => {
  if (!confirm || !confirm.show) return null;
  return (
    <div className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#16161f] rounded-3xl max-w-md w-full p-8 text-center shadow-2xl animate-slideUpBox border border-gray-200 dark:border-white/10">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-4xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold text-black dark:text-white mb-2">{confirm.title}</h3>
        <p className="text-gray-600 dark:text-[#A1A1A1] mb-6">{confirm.message}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-800 dark:text-white font-bold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => { confirm.onConfirm(); onClose(); }}
            className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};