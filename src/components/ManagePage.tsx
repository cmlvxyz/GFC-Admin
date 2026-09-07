import React, { useMemo, useState } from 'react';
import { Search, Pencil, Trash2, Download } from 'lucide-react';
import { Modal } from './Modal';
import { ConfirmDialog, ConfirmState } from './ConfirmDialog';

export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number';
  placeholder?: string;
  required?: boolean;
  full?: boolean;
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (record: T) => React.ReactNode;
}

export type Accent = 'indigo' | 'purple' | 'cyan' | 'rose' | 'emerald' | 'amber';

const accents: Record<Accent, { grad: string; hover: string; chip: string; text: string }> = {
  indigo: { grad: 'from-indigo-500 to-indigo-600', hover: 'hover:from-indigo-600 hover:to-indigo-700', chip: 'bg-indigo-50 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400', text: 'text-indigo-500 dark:text-indigo-400' },
  purple: { grad: 'from-purple-500 to-purple-600', hover: 'hover:from-purple-600 hover:to-purple-700', chip: 'bg-purple-50 dark:bg-purple-400/10 text-purple-600 dark:text-purple-400', text: 'text-purple-500 dark:text-purple-400' },
  cyan: { grad: 'from-cyan-500 to-cyan-600', hover: 'hover:from-cyan-600 hover:to-cyan-700', chip: 'bg-cyan-50 dark:bg-cyan-400/10 text-cyan-600 dark:text-cyan-400', text: 'text-cyan-500 dark:text-cyan-400' },
  rose: { grad: 'from-rose-500 to-rose-600', hover: 'hover:from-rose-600 hover:to-rose-700', chip: 'bg-rose-50 dark:bg-rose-400/10 text-rose-600 dark:text-rose-400', text: 'text-rose-500 dark:text-rose-400' },
  emerald: { grad: 'from-emerald-500 to-emerald-600', hover: 'hover:from-emerald-600 hover:to-emerald-700', chip: 'bg-emerald-50 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400', text: 'text-emerald-500 dark:text-emerald-400' },
  amber: { grad: 'from-amber-500 to-amber-600', hover: 'hover:from-amber-600 hover:to-amber-700', chip: 'bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400', text: 'text-amber-500 dark:text-amber-400' }
};

const inputClass = "w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all";

interface ManagePageProps<T> {
  title: string;
  subtitle?: string;
  icon: string;
  accent: Accent;
  fields: Field[];
  columns: Column<T>[];
  records: T[];
  idOf: (record: T) => string;
  toForm: (record: T) => Record<string, string>;
  buildRecord: (values: Record<string, string>) => T;
  onAdd: (record: T) => void;
  onUpdate: (id: string, record: T) => void;
  onDelete: (id: string) => void;
  extraRender?: (record: T) => React.ReactNode;
  addLabel?: string;
  csvFileName?: string;
}

function renderField(field: Field, values: Record<string, string>, onChange: (name: string, value: string) => void) {
  const value = values[field.name] ?? '';
  const base = { name: field.name, required: field.required, value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(field.name, e.target.value) };
  return (
    <div key={field.name} className={field.full ? 'col-span-1 md:col-span-2' : ''}>
      <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] mb-1 uppercase tracking-wider">
        {field.label}{field.required ? ' *' : ''}
      </label>
      {field.type === 'textarea' ? (
        <textarea rows={3} placeholder={field.placeholder} className={inputClass} {...base} />
      ) : (
        <input type={field.type === 'number' ? 'number' : 'text'} placeholder={field.placeholder} className={inputClass} {...base} />
      )}
    </div>
  );
}

function exportCSV<T>(records: T[], columns: Column<T>[], filename: string) {
  const rows = records.map(record => columns.map(col => String(col.render ? extractText(record) : (record as unknown as Record<string, unknown>)[col.key] ?? '').replace(/"/g, '""')));
  const header = columns.map(c => c.label).join(',');
  const csv = [header, ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = filename.toLowerCase().endsWith('.csv') ? filename : filename + '.csv';
  a.href = url;
  a.download = safe;
  a.click();
  URL.revokeObjectURL(url);
}

function extractText(_record: unknown): string {
  return '';
}

export const ManagePage = <T,>(props: ManagePageProps<T>): React.ReactElement => {
  const { title, subtitle, icon, accent, fields, columns, records, idOf, toForm, buildRecord, onAdd, onUpdate, onDelete, extraRender, addLabel = 'Add', csvFileName } = props;
  const a = accents[accent];

  const [form, setForm] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ id: string; form: Record<string, string> } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const setFormValue = (name: string, value: string) => setForm(prev => ({ ...prev, [name]: value }));
  const setEditValue = (name: string, value: string) => setEditing(prev => prev ? { ...prev, form: { ...prev.form, [name]: value } } : prev);

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  }, [records, query]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(buildRecord(form));
    setForm({});
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    onUpdate(editing.id, buildRecord(editing.form));
    setEditing(null);
  };

  const resetForm = () => setForm({});

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
        <h4 className="text-sm font-bold text-black dark:text-white mb-4 flex items-center gap-2">
          <span className={a.text}>➕</span> Add New {title}
        </h4>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map(f => renderField(f, form, setFormValue))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className={`px-6 py-2.5 bg-gradient-to-r ${a.grad} ${a.hover} text-white rounded-xl text-xs font-bold transition-all shadow-md`}>
              ➕ {addLabel}
            </button>
            <button type="button" onClick={resetForm} className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-[#A1A1A1] rounded-xl text-xs font-bold transition-all border border-gray-200 dark:border-white/10">
              ↺ Clear
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-black/30 px-4 py-1.5 rounded-full border border-gray-200 dark:border-white/5">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${title.toLowerCase()}...`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="bg-transparent border-none text-sm text-black dark:text-white focus:outline-hidden w-40"
            />
          </div>
          <button
            onClick={() => exportCSV(records, columns, csvFileName || title.toLowerCase())}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-gray-200 dark:border-white/5 text-xs font-bold text-gray-700 dark:text-[#A1A1A1] hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-black/20">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{col.label}</th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-gray-400 dark:text-gray-600 text-sm">
                    No {title.toLowerCase()} found. Add one above.
                  </td>
                </tr>
              ) : (
                filtered.map(record => (
                  <tr key={idOf(record)} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-sm text-gray-600 dark:text-[#A1A1A1]">
                        {col.render ? col.render(record) : String((record as unknown as Record<string, unknown>)[col.key] ?? '')}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      {extraRender && extraRender(record)}
                      <button
                        onClick={() => setEditing({ id: idOf(record), form: toForm(record) })}
                        className={`px-3 py-1 ${a.chip} rounded-lg text-xs font-bold hover:opacity-80 transition-all mr-2`}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => setConfirm({
                          show: true,
                          title: `Delete ${title}?`,
                          message: `Are you sure you want to delete this record?`,
                          onConfirm: () => onDelete(idOf(record))
                        })}
                        className="px-3 py-1 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-950/50 transition-all"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`✏️ Edit ${title}`}>
        <form onSubmit={handleEditSave} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map(f => renderField(f, editing?.form || {}, setEditValue))}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className={`px-6 py-2.5 bg-gradient-to-r ${a.grad} ${a.hover} text-white rounded-xl text-xs font-bold transition-all shadow-md`}>
              💾 Save Changes
            </button>
            <button type="button" onClick={() => setEditing(null)} className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-[#A1A1A1] rounded-xl text-xs font-bold transition-all border border-gray-200 dark:border-white/10">
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};