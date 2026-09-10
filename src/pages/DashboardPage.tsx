import React, { useMemo } from 'react';
import {
  Calendar,
  PlaySquare,
  Heart,
  UserCheck,
  Quote,
  Megaphone,
  Users,
  Layers,
  TrendingUp,
  Activity,
  Wifi,
  Radio,
  Clock,
  ArrowRight,
  FileText
} from 'lucide-react';
import { Activity as ActivityType } from '../types';
import { ActivityFeed } from '../components/ActivityFeed';

interface DashboardPageProps {
  counts: Record<string, number>;
  activities: ActivityType[];
  loadingActivities: boolean;
  onClearActivities: () => void;
  onNavigate: (page: string) => void;
}

interface ModuleStat {
  id: string;
  label: string;
  icon: React.ReactNode;
  tile: string;
  bar: string;
}

const statsConfig: ModuleStat[] = [
  {
    id: 'events',
    label: 'Events',
    icon: <Calendar className="w-4 h-4" />,
    tile: 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white',
    bar: 'bg-indigo-500'
  },
  {
    id: 'sermons',
    label: 'Sermons',
    icon: <PlaySquare className="w-4 h-4" />,
    tile: 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white',
    bar: 'bg-purple-500'
  },
  {
    id: 'prayers',
    label: 'Prayer Requests',
    icon: <Heart className="w-4 h-4" />,
    tile: 'bg-rose-100 text-rose-600 group-hover:bg-rose-600 group-hover:text-white',
    bar: 'bg-rose-500'
  },
  {
    id: 'attendees',
    label: 'Attendees',
    icon: <UserCheck className="w-4 h-4" />,
    tile: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white',
    bar: 'bg-emerald-500'
  },
  {
    id: 'testimonials',
    label: 'Testimonials',
    icon: <Quote className="w-4 h-4" />,
    tile: 'bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white',
    bar: 'bg-amber-500'
  },
  {
    id: 'announcements',
    label: 'Announcements',
    icon: <Megaphone className="w-4 h-4" />,
    tile: 'bg-cyan-100 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white',
    bar: 'bg-cyan-500'
  },
  {
    id: 'members',
    label: 'Members',
    icon: <Users className="w-4 h-4" />,
    tile: 'bg-fuchsia-100 text-fuchsia-600 group-hover:bg-fuchsia-600 group-hover:text-white',
    bar: 'bg-fuchsia-500'
  }
];

const quickActions = [
  { label: 'Add Event', page: 'events', icon: <Calendar className="w-3.5 h-3.5" />, chip: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white' },
  { label: 'Add Sermon', page: 'sermons', icon: <PlaySquare className="w-3.5 h-3.5" />, chip: 'bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white' },
  { label: 'Add Announcement', page: 'announcements', icon: <Megaphone className="w-3.5 h-3.5" />, chip: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-600 hover:text-white' },
  { label: 'Add Prayer', page: 'prayers', icon: <Heart className="w-3.5 h-3.5" />, chip: 'bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white' },
  { label: 'Add Attendee', page: 'attendees', icon: <UserCheck className="w-3.5 h-3.5" />, chip: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white' },
  { label: 'Add Testimonial', page: 'testimonials', icon: <Quote className="w-3.5 h-3.5" />, chip: 'bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white' },
  { label: 'Add Member', page: 'members', icon: <Users className="w-3.5 h-3.5" />, chip: 'bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-600 hover:text-white' }
];

function moduleLabel(type: string): string {
  switch (type) {
    case 'events': return 'Events';
    case 'sermons': return 'Sermons';
    case 'prayers': return 'Prayers';
    case 'attendees': return 'Attendees';
    case 'members': return 'Members';
    case 'announcements': return 'Announcements';
    case 'testimonials': return 'Testimonials';
    case 'allPhotos': return 'Photos';
    case 'admin': return 'Admin';
    case 'system': return 'System';
    default: return type || 'Other';
  }
}

const actionMeta: Record<string, { label: string; color: string }> = {
  created: { label: 'Created', color: '#6366f1' },
  updated: { label: 'Updated', color: '#818cf8' },
  deleted: { label: 'Deleted', color: '#10b981' },
  photo: { label: 'Photo upload', color: '#f59e0b' }
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  counts,
  activities,
  loadingActivities,
  onClearActivities,
  onNavigate
}) => {
  const totalCounts = useMemo(
    () => statsConfig.reduce((sum, s) => sum + (counts[s.id] || 0), 0),
    [counts]
  );

  const shareOf = (value: number): number =>
    totalCounts > 0 ? Math.round((value / totalCounts) * 100) : 0;

  const moduleActivity = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of activities) {
      const key = moduleLabel(a.type);
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((x, y) => y.value - x.value)
      .slice(0, 8);
  }, [activities]);

  const actionShare = useMemo(() => {
    const countsByAction: Record<string, number> = {};
    for (const a of activities) {
      if (actionMeta[a.action]) {
        countsByAction[a.action] = (countsByAction[a.action] || 0) + 1;
      }
    }
    const segments = Object.entries(countsByAction)
      .map(([key, value]) => ({ key, ...actionMeta[key], value }))
      .sort((x, y) => y.value - x.value);
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    return { segments, total };
  }, [activities]);

  const maxModuleActivity =
    moduleActivity.length > 0
      ? Math.max(...moduleActivity.map(m => m.value))
      : 1;

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <div className="bg-white dark:bg-[#14141f]/80 rounded-2xl p-6 md:p-7 border border-gray-200 dark:border-white/5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-[#A1A1A1] border border-gray-200 dark:border-white/10 text-xs px-3 py-0.5 rounded-full font-bold">
              GOSPEL FELLOWSHIP CHURCH • LIMAY, BATAAN
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white mt-3">
            Church Admin Dashboard
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl mt-2">
            Lahat ng nangyayari sa GFC — prayer requests, registrations, events, sermons,
            at photo uploads — ay naka-log dito nang real time. Madaling i-manage ang
            bawat data mula sa isang lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => onNavigate('events')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15 text-gray-700 dark:text-[#A1A1A1] font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            <FileText className="w-4 h-4 text-indigo-500" />
            <span>View Records</span>
          </button>
          <button
            onClick={() => onNavigate('announcements')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            <Megaphone className="w-4 h-4" />
            <span>Post Announcement</span>
          </button>
        </div>
      </div>

      {/* KPI stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {statsConfig.map(stat => {
          const value = counts[stat.id] || 0;
          return (
            <button
              key={stat.id}
              onClick={() => onNavigate(stat.id)}
              className="bg-white dark:bg-[#14141f]/80 p-4 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-white/10 transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-600 dark:text-[#A1A1A1] font-semibold">{stat.label}</span>
                <div className={`p-2 rounded-xl transition-colors ${stat.tile}`}>
                  {stat.icon}
                </div>
              </div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">
                {value.toLocaleString()}
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Records</span>
              <div className="mt-3 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stat.bar}`}
                  style={{ width: `${shareOf(value)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Activity per module - bar chart */}
        <div className="bg-white dark:bg-[#14141f]/80 rounded-2xl p-6 border border-gray-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Activity per Module</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Logged actions by feature, real time</p>
            </div>
          </div>
          {moduleActivity.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
              No activity logged yet.
            </div>
          ) : (
            <div className="flex items-end gap-3 h-48 mt-5">
              {moduleActivity.map(m => (
                <div key={m.label} className="flex-1 flex flex-col justify-end items-center gap-1.5 min-w-0" title={`${m.label}: ${m.value}`}>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-[#A1A1A1]">{m.value}</span>
                  <div
                    className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t-md transition-all"
                    style={{ height: `${Math.max((m.value / maxModuleActivity) * 100, 4)}%` }}
                  />
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 truncate w-full text-center">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action share - donut chart */}
        <div className="bg-white dark:bg-[#14141f]/80 rounded-2xl p-6 border border-gray-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Action Breakdown</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Types of actions across the activity log</p>
            </div>
          </div>
          {actionShare.total === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
              No activity logged yet.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6 mt-4">
              <div className="relative w-40 h-40 shrink-0">
                <svg className="w-40 h-40 -rotate-90" viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                  {(() => {
                    const C = 2 * Math.PI * 15.9155;
                    let offset = 0;
                    return actionShare.segments.map(seg => {
                      const pct = seg.value / actionShare.total;
                      const dash = pct * C;
                      const el = (
                        <circle
                          key={seg.key}
                          cx="21"
                          cy="21"
                          r="15.9155"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={`${dash} ${C - dash}`}
                          strokeDashoffset={-offset}
                        />
                      );
                      offset += dash;
                      return el;
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {actionShare.total.toLocaleString()}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                    Actions
                  </span>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2">
                {actionShare.segments.map(seg => (
                  <div key={seg.key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-gray-600 dark:text-[#A1A1A1] font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                      {seg.label}
                    </span>
                    <span className="font-bold text-gray-800 dark:text-white">
                      {seg.value.toLocaleString()}{' '}
                      <span className="text-gray-400 dark:text-gray-500 font-medium">
                        ({Math.round((seg.value / actionShare.total) * 100)}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ActivityFeed
            activities={activities}
            onClear={onClearActivities}
            loading={loadingActivities}
          />
        </div>

        <div className="space-y-5">
          <div className="bg-white dark:bg-[#14141f]/80 p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              <span>Quick Actions</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(action => (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.page)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${action.chip}`}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const json = JSON.stringify({
                  initialized: true,
                  events: counts.events,
                  sermons: counts.sermons,
                  prayers: counts.prayers,
                  attendees: counts.attendees,
                  members: counts.members,
                  announcements: counts.announcements,
                  testimonials: counts.testimonials
                }, null, 2);
                console.log(json);
              }}
              className="mt-4 w-full px-3 py-2.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-[#A1A1A1] hover:bg-gray-200 dark:hover:bg-white/15 transition-all border border-gray-200 dark:border-white/10"
            >
              📤 System Summary
            </button>
          </div>

          <div className="bg-white dark:bg-[#14141f]/80 p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">System Status</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-500 dark:text-[#A1A1A1]">
                  <Wifi className="w-4 h-4" />
                  Backend API
                </span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-500 dark:text-[#A1A1A1]">
                  <Radio className="w-4 h-4" />
                  Live Stream
                </span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse pulse-dot" />
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-gray-500 dark:text-[#A1A1A1]">
                  <Clock className="w-4 h-4" />
                  Monitored Activities
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {activities.length}
                </span>
              </div>
              <div className="border-t border-gray-100 dark:border-white/5 pt-3 mt-1">
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  Ang admin system na ito ay kumokonekta sa GFC-DATA API. Awtomatikong
                  lumalabas dito ang bawat ginagawa ng mga bisita o admin sa GFC.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('events')}
            className="w-full p-4 rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-[#14141f]/80 hover:border-indigo-300 dark:hover:border-indigo-400/30 transition-all text-left group"
          >
            <span className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Manage all records
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:translate-x-1 group-hover:text-indigo-500 transition-all" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};