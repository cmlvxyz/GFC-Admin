import React, { useMemo, useState } from 'react';
import { Activity as ActivityType } from '../types';
import { Trash2, Radio } from 'lucide-react';

interface ActivityFeedProps {
  activities: ActivityType[];
  onClear: () => void;
  loading?: boolean;
}

const typeLabels: Record<string, string> = {
  events: '📅 Events',
  sermons: '🎬 Sermons',
  prayers: '🙏 Prayers',
  attendees: '👤 Attendees',
  members: '🧑 Members',
  announcements: '📢 Announcements',
  testimonials: '🗣️ Testimonials',
  admin: '🔐 Admin',
  system: '⚙️ System'
};

const actorBadges: Record<string, string> = {
  public: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400',
  admin: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400',
  system: 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const allTypes = ['all', ...Object.keys(typeLabels)];

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, onClear, loading }) => {
  const [filter, setFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(30);

  const filtered = useMemo(() => {
    const list = filter === 'all' ? activities : activities.filter(a => a.type === filter);
    return list.slice(0, visibleCount);
  }, [activities, filter, visibleCount]);

  const showAll = () => setVisibleCount(prev => prev + 30);

  return (
    <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-500" />
          <span>Real-time Activity Log</span>
          <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse pulse-dot" />
            Live
          </span>
          <span className="text-[10px] text-gray-400 font-mono">{activities.length} events</span>
        </h3>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/5 text-xs font-bold text-gray-700 dark:text-[#A1A1A1] hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 dark:hover:text-red-400 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Log
        </button>
      </div>

      <div className="px-5 py-3 border-b border-gray-100 dark:border-white/5 flex gap-1.5 overflow-x-auto hide-scrollbar">
        {allTypes.map(t => (
          <button
            key={t}
            onClick={() => { setFilter(t); setVisibleCount(30); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
              filter === t
                ? 'bg-indigo-500 text-white shadow'
                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-[#A1A1A1] hover:bg-gray-200 dark:hover:bg-white/10'
            }`}
          >
            {t === 'all' ? 'All' : typeLabels[t]}
          </button>
        ))}
      </div>

      <div className="max-h-[460px] overflow-y-auto">
        {loading && activities.length === 0 ? (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">Connecting to GFC-DATA stream...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
            No activity yet. Everything that happens on GFC will appear here in real time.
          </div>
        ) : (
          filtered.map(item => {
            const label = typeLabels[item.type] || item.type;
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-all border-b border-gray-100 dark:border-white/5 last:border-0"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-lg shrink-0 border border-gray-100 dark:border-white/5">
                  {item.icon || '•'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${actorBadges[item.actor] || actorBadges.system}`}>
                      {item.actor === 'public' ? 'Website Visitor' : item.actor === 'admin' ? 'Admin' : 'System'}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-gray-400">{label}</span>
                  </div>
                  <p className="text-sm text-black dark:text-white mt-0.5 break-words">{item.message}</p>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono" title={new Date(item.createdAt).toLocaleString()}>
                    {relativeTime(item.createdAt)} • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filtered.length >= visibleCount && (
        <div className="p-3 text-center">
          <button onClick={showAll} className="px-4 py-2 text-xs font-bold text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all">
            Show more
          </button>
        </div>
      )}
    </div>
  );
};