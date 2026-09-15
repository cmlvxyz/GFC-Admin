import React from 'react';
import { Settings } from 'lucide-react';

// ============ Admin preview overlay pill ============
// Floating "Manage" button para buksan ang kaukulang manage screen.
export const ManagePill: React.FC<{ label: string; onManage: () => void }> = ({ label, onManage }) => (
  <div className="fixed right-4 sm:right-6 top-44 sm:top-52 z-30">
    <button
      onClick={onManage}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0f172a]/90 backdrop-blur-sm border border-indigo-400/40 text-indigo-300 hover:text-white hover:bg-[#0f172a] text-xs font-bold shadow-lg shadow-black/30 transition-all active:scale-[0.97]"
    >
      <Settings className="w-4 h-4" />
      Manage {label}
    </button>
  </div>
);

// ============ Page hero (100% kapareho ng GFC website PageHero) ============
interface AdminPreviewHeroProps {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
}

export const AdminPreviewHero: React.FC<AdminPreviewHeroProps> = ({ eyebrow, title, subtitle }) => {
  return (
    <section id="page-hero" className="relative min-h-[90vh] flex items-center overflow-hidden bg-[#0f1a2e]">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=2000&q=80"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover animate-kenburns"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f1a2e]/95 via-[#0f1a2e]/85 to-[#0f1a2e]/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1a2e] via-transparent to-[#0f1a2e]/50" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-36 pb-28 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2.5 animate-fadeUp">
            <span className="h-px w-8 bg-indigo-400" />
            <span className="text-[11px] sm:text-xs uppercase tracking-[0.35em] font-semibold text-indigo-400">
              {eyebrow}
            </span>
            <span className="h-px w-8 bg-indigo-400" />
          </div>

          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white tracking-tight leading-[1.1] animate-fadeUp"
            style={{ animationDelay: '0.15s' }}
          >
            {title}
          </h1>

          {subtitle && (
            <p
              className="mx-auto max-w-xl text-base sm:text-lg text-white/75 leading-relaxed animate-fadeUp"
              style={{ animationDelay: '0.3s' }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};