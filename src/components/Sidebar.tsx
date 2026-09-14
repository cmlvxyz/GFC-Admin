import React from 'react';
import { Sun, Moon } from 'lucide-react';

export interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge: number | null;
}

export interface MenuGroup {
  label?: string;
  items: MenuItem[];
}

interface SidebarProps {
  groups: MenuGroup[];
  active: string;
  onNavigate: (id: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  active,
  onNavigate,
  isDark,
  onToggleTheme,
  mobileOpen,
  onCloseMobile
}) => {
  return (
    <>
      <aside
        className={`w-[280px] bg-[#0f172a] text-slate-300 border-r border-white/5 shrink-0 overflow-y-auto transition-all duration-500 flex flex-col ${
          mobileOpen ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'relative'
        }`}
      >
        {/* Brand */}
        <div className="p-6 border-b border-white/10 flex items-center gap-3 shrink-0">
          <div className="w-12 h-12 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
            <img src="/image-circle.png" alt="GFC Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-heading font-extrabold text-white text-lg leading-tight tracking-tight">
              GOSPEL FELLOWSHIP
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Admin
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-5 overflow-y-auto flex-1 hide-scrollbar">
          {groups.map((group, gi) => (
            <div key={group.label || gi}>
              {group.label && (
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 px-3 py-2 font-bold">
                  {group.label}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); onCloseMobile(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active === item.id
                        ? 'bg-white/10 text-white ring-1 ring-white/10 shadow-inner'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className={active === item.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {active === item.id && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                    {item.badge !== null && item.badge > 0 && (
                      <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 shrink-0">
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-400" />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <div className="mt-3 px-3 text-[10px] text-slate-600 leading-relaxed">
            Connected to <span className="font-mono font-bold text-indigo-400">GFC-DATA</span> API
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={onCloseMobile} />
      )}
    </>
  );
};