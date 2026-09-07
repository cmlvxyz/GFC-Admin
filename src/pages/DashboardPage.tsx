import React from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { Activity } from '../types';
import { ActivityFeed } from '../components/ActivityFeed';

interface DashboardPageProps {
  counts: Record<string, number>;
  activities: Activity[];
  loadingActivities: boolean;
  onClearActivities: () => void;
  onNavigate: (page: string) => void;
}

const quickActions = [
  { label: 'Add Event', page: 'events', icon: '📅', color: 'from-indigo-500 to-indigo-600' },
  { label: 'Add Sermon', page: 'sermons', icon: '🎬', color: 'from-purple-500 to-purple-600' },
  { label: 'Add Announcement', page: 'announcements', icon: '📢', color: 'from-cyan-500 to-cyan-600' },
  { label: 'Add Prayer', page: 'prayers', icon: '🙏', color: 'from-rose-500 to-rose-600' },
  { label: 'Add Attendee', page: 'attendees', icon: '👤', color: 'from-emerald-500 to-emerald-600' },
  { label: 'Add Testimonial', page: 'testimonials', icon: '🗣️', color: 'from-amber-500 to-amber-600' },
  { label: 'Add Member', page: 'members', icon: '🧑', color: 'from-indigo-500 to-indigo-600' }
];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  counts,
  activities,
  loadingActivities,
  onClearActivities,
  onNavigate
}) => {
  const stats = [
    { id: 'events', label: 'Total Events', value: counts.events || 0, icon: '📅', color: 'from-indigo-500 to-indigo-600' },
    { id: 'sermons', label: 'Total Sermons', value: counts.sermons || 0, icon: '🎬', color: 'from-purple-500 to-purple-600' },
    { id: 'prayers', label: 'Prayer Requests', value: counts.prayers || 0, icon: '🙏', color: 'from-rose-500 to-rose-600' },
    { id: 'attendees', label: 'Attendees', value: counts.attendees || 0, icon: '👥', color: 'from-emerald-500 to-emerald-600' },
    { id: 'testimonials', label: 'Testimonials', value: counts.testimonials || 0, icon: '🗣️', color: 'from-amber-500 to-amber-600' },
    { id: 'announcements', label: 'Announcements', value: counts.announcements || 0, icon: '📢', color: 'from-cyan-500 to-cyan-600' },
    { id: 'members', label: 'Members', value: counts.members || 0, icon: '🧑', color: 'from-fuchsia-500 to-fuchsia-600' }
  ];

  const historyTab = () => onNavigate('events');

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-sm font-medium text-white/80">
            <Sparkles className="w-4 h-4" />
            <span>Welcome back, Admin!</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-serif mt-2">
            Gospel Fellowship Church — Admin System
          </h2>
          <p className="text-white/80 text-sm mt-1 max-w-lg">
            Lahat ng gagawin sa GFC — prayer requests, registrations, events, sermons — ay lalabas dito sa real time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.map(stat => (
          <button
            key={stat.id}
            onClick={() => onNavigate(stat.id)}
            className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 text-left"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-2xl font-bold text-black dark:text-white">{stat.value}</div>
                <div className="text-[10px] text-gray-500 dark:text-[#A1A1A1] font-medium mt-0.5 uppercase tracking-wider">{stat.label}</div>
              </div>
              <div className={`text-xl bg-gradient-to-br ${stat.color} text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg`}>
                {stat.icon}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed activities={activities} onClear={onClearActivities} loading={loadingActivities} />
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-black dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>Quick Actions</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {quickActions.map(action => (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.page)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all bg-gradient-to-r ${action.color} text-white shadow-md hover:shadow-lg hover:scale-105`}
                >
                  {action.icon} {action.label}
                </button>
              ))}
              <button
                onClick={() => { const json = JSON.stringify({
                  initialized: true,
                  events: counts.events,
                  sermons: counts.sermons,
                  prayers: counts.prayers,
                  attendees: counts.attendees,
                  members: counts.members,
                  announcements: counts.announcements,
                  testimonials: counts.testimonials
                }, null, 2); console.log(json); }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-[#A1A1A1] hover:bg-gray-200 dark:hover:bg-white/20 transition-all border border-gray-200 dark:border-white/10"
              >
                📤 System Summary
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-black dark:text-white mb-4">ℹ️ System Status</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-[#A1A1A1]">Backend API</span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-[#A1A1A1]">Live Stream</span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse pulse-dot" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-[#A1A1A1]">Monitored Activities</span>
                <span className="font-bold text-black dark:text-white">{activities.length}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-white/5 pt-3 mt-1">
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  Ang admin system na ito ay kumokonekta sa GFC-DATA API. Ang bawat ginagawa ng mga bisita o admin sa GFC ay naka-log dito sa real time.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={historyTab}
            className="w-full p-4 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-400/30 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-all text-xs font-bold"
          >
            📚 Tingnan ang lahat ng records → Mag-manage ng data
          </button>
        </div>
      </div>
    </div>
  );
};