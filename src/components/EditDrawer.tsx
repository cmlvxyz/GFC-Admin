import React from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Field } from './ManagePage';

const inputClass =
  'w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all';

interface EditDrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  fields: Field[];
  values: Record<string, string>;
  onValue: (name: string, value: string) => void;
  onSave: (values: Record<string, string>) => void;
  onCancel: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  saveLabel?: string;
}

function renderField(
  field: Field,
  values: Record<string, string>,
  onValue: (name: string, value: string) => void
) {
  const value = values[field.name] ?? '';
  const base = {
    name: field.name,
    required: field.required,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onValue(field.name, e.target.value)
  };
  return (
    <div key={field.name}>
      <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] mb-1 uppercase tracking-wider">
        {field.label}{field.required ? ' *' : ''}
      </label>
      {field.type === 'textarea' ? (
        <textarea rows={4} placeholder={field.placeholder} className={inputClass} {...base} />
      ) : (
        <input type={field.type === 'number' ? 'number' : 'text'} placeholder={field.placeholder} className={inputClass} {...base} />
      )}
    </div>
  );
}

export const EditDrawer: React.FC<EditDrawerProps> = ({ open, title, subtitle, fields, values, onValue, onSave, onCancel, onDelete, deleteLabel = 'Delete', saveLabel = 'Save Changes' }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white dark:bg-[#14141f] border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col animate-slideInToast">
        <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading font-bold text-[#0f172a] dark:text-white leading-tight">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-[#A1A1A1] leading-relaxed">{subtitle}</p>}
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-[#A1A1A1] transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {fields.map(f => renderField(f, values, onValue))}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-white/10 flex items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-all"
            >
              <Trash2 className="w-4 h-4" />
              {deleteLabel}
            </button>
          )}
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-[#A1A1A1] rounded-xl text-xs font-bold transition-all border border-gray-200 dark:border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(values)}
            className="flex-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-black/10"
          >
            💾 {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
};