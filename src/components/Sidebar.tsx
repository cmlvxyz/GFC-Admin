import React from 'react';
import { Sun, Moon, LogOut } from 'lucide-react';

export interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge: number | null;
}

interface SidebarProps {
  items: MenuItem[];
  active: string;
  onNavigate: (id: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  items,
  active,
  onNavigate,
  isDark,
  onToggleTheme,
  onLogout,
  mobileOpen,
  onCloseMobile
}) => {
  return (
    <>
      <aside
        className={`w-[280px] bg-white/85 dark:bg-[#14141f]/95 backdrop-blur-xl border-r border-gray-200 dark:border-white/5 shrink-0 overflow-y-auto transition-all duration-500 ${
          mobileOpen ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'relative'
        }`}
      >
        <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
            <img src="/image-circle.png" alt="GFC Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="font-extrabold text-black dark:text-white text-lg leading-tight">
              GF<span className="text-indigo-500 dark:text-indigo-400">C</span>-ADMIN
            </div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Management System</div>
          </div>
        </div>

        <nav className="p-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-2 font-bold">Main Navigation</div>
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); onCloseMobile(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active === item.id
                  ? 'bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-400/20 dark:to-indigo-400/10 text-indigo-600 dark:text-indigo-400 border-l-2 border-indigo-500 dark:border-indigo-400'
                  : 'text-gray-600 dark:text-[#8888AA] hover:bg-gray-50 dark:hover:bg-white/5 hover:text-black dark:hover:text-white'
              }`}
            >
              <span className={active === item.id ? 'text-indigo-500' : 'text-indigo-400'}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== null && item.badge > 0 && (
                <span className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-gray-200 dark:border-white/5 p-3">
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-[#8888AA] hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-400" />}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
          <div className="mt-4 px-3 text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed">
            Connected to <span className="font-mono font-bold text-indigo-400">GFC-DATA</span> API
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden" onClick={onCloseMobile} />
      )}
    </>
  );
};