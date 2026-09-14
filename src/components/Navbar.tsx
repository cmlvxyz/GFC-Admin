import React, { useState } from 'react';
import { Menu, X, Heart, Sun, Moon, Settings } from 'lucide-react';

export interface NavLinkItem {
  id: string;
  label: string;
  pages: string[];
}

export interface NavMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge: number | null;
}

interface NavbarProps {
  active: string;
  onNavigate: (id: string) => void;
  navItems: NavLinkItem[];
  menuItems: NavMenuItem[];
  isDark: boolean;
  onToggleTheme: () => void;
  now?: string;
  activityCount?: number;
  overlay?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  active,
  onNavigate,
  navItems,
  menuItems,
  isDark,
  onToggleTheme,
  overlay
}) => {
  const [open, setOpen] = useState(false);

  const spanBase = 'font-serif tracking-tight text-white text-lg sm:text-3xl lg:text-2xl leading-tight whitespace-nowrap';

  const go = (id: string) => {
    onNavigate(id);
    setOpen(false);
  };

  const activeNav = navItems.find(n => n.pages.includes(active));

  const linkBase = 'relative text-sm font-medium tracking-wide py-1 transition-colors duration-300';
  const linkColor = (isActive: boolean) => isActive ? 'text-indigo-400' : 'text-white/80 hover:text-white';
  const underline = (isActive: boolean) =>
    `absolute -bottom-0.5 left-0 h-px bg-current transition-all duration-300 ease-out ${
      isActive ? 'w-0' : 'w-0 group-hover:w-full'
    }`;

  const giveActive = active === 'giveInfo';

  return (
    <header className={`${overlay ? 'absolute inset-x-0 top-0' : 'relative bg-[#0f172a]'} z-40 text-slate-300 shrink-0`}>
      <div className={`max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3.5 ${overlay ? 'relative top-10' : ''}`}>
        {/* Brand & Logo - gaya sa website */}
        <button
          onClick={() => go('dashboard')}
          className="flex items-center gap-3 group shrink-0"
        >
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden ring-1 ring-white/25 shadow-md bg-white/90 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
            <img
              src="/image-circle.png"
              alt="Gospel Fellowship Church Logo"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              className="w-full h-full object-cover"
            />
          </div>
          <span
            className={spanBase}
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
          >
            Gospel <span className="text-indigo-400">Fellowship</span> Church
          </span>
        </button>

        {/* Desktop Navigation - kanan */}
        <nav className="hidden lg:flex items-center gap-7">
          {navItems.filter(link => link.id !== 'give').map(link => {
            const isActive = activeNav?.id === link.id;
            return (
              <button
                key={link.id}
                onClick={() => go(link.pages[0])}
                className={`group ${linkBase} ${linkColor(isActive)}`}
              >
                {link.label}
                <span className={underline(isActive)} />
              </button>
            );
          })}

          {/* Give - bahagi ng navbar */}
          <button
            onClick={() => go('giveInfo')}
            className={`group relative flex items-center gap-1.5 text-sm font-bold py-1 transition-colors duration-300 ${
              giveActive ? 'text-white' : 'text-indigo-400 hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4" />
            Give
            <span className={underline(giveActive)} />
          </button>

          {/* Hamburger - nasa tabi ng Give */}
          <button
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="inline-flex w-11 h-11 items-center justify-center rounded-full bg-white/10 text-white border border-white/20 transition-all duration-300 hover:bg-white/20"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {/* Mobile: hamburger rin lantad sa mobile */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="lg:hidden inline-flex w-11 h-11 items-center justify-center rounded-full bg-white/10 text-white border border-white/20 transition-all duration-300"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Dropdown panel */}
        <div
          className={`absolute top-full right-4 sm:right-6 z-50 origin-top-right transition-all duration-300 ${
            open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          <div className="-mt-2 w-64 rounded-2xl bg-[#0f172a]/95 backdrop-blur-xl border border-white/25 shadow-2xl shadow-black/40 p-1.5">
            {/* Admin pages */}
            <nav className="flex flex-col">
              {menuItems.map(item => {
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-indigo-400 bg-white/10 font-semibold' : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span className={isActive ? 'text-indigo-400' : 'text-white/50'}>{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge !== null && item.badge > 0 && (
                      <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                        {item.badge}
                      </span>
                    )}
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                  </button>
                );
              })}
              <div className="my-1 h-px bg-white/10" />
              <button
                onClick={() => go('settings')}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active === 'settings' ? 'text-indigo-400 bg-white/10 font-semibold' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <Settings className={active === 'settings' ? 'w-4 h-4 text-indigo-400' : 'w-4 h-4 text-white/50'} />
                <span className="flex-1 text-left">Settings</span>
                {active === 'settings' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
              </button>
            </nav>

            {/* Site nav links - lumalabas lang sa mobile */}
            <nav className="lg:hidden flex flex-col mt-1">
              <div className="my-1 h-px bg-white/10" />
              {navItems.filter(link => link.id !== 'give').map(link => {
                const isActive = activeNav?.id === link.id;
                return (
                  <button
                    key={link.id}
                    onClick={() => go(link.pages[0])}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-indigo-400 bg-white/10 font-semibold' : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {link.label}
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                  </button>
                );
              })}
              <button
                onClick={() => go('giveInfo')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-indigo-400 transition-colors hover:bg-white/10"
              >
                <Heart className="w-3.5 h-3.5" />
                Give
              </button>
            </nav>

            {/* Footer: LIVE + theme + API */}
            <div className="mt-1 pt-2 border-t border-white/10 flex items-center justify-between px-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse pulse-dot" />
                Live
              </span>
              <button
                onClick={onToggleTheme}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:bg-white/10 transition-all"
              >
                {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay para mag-close pag nag-click sa labas */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </header>
  );
};