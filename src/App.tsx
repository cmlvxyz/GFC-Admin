import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Bell, Menu, ArrowLeft, LayoutDashboard, Calendar as CalendarIcon, Video, Megaphone, Heart, Users, MessageSquare, Settings, Shield, Trash2, X, QrCode, Images } from 'lucide-react';
import type { Activity, ChurchEvent, Collection, RecordMap } from './types';
import { API_URL, clearActivities, createRecord, deleteRecord as apiDeleteRecord, getActivities, getActivityStream, listCollection, resetRemoteData, updateRecord as apiUpdateRecord } from './api';
import { Sidebar } from './components/Sidebar';
import { ToastHost, ToastItem, ToastType } from './components/ToastHost';
import { ConfirmDialog, ConfirmState } from './components/ConfirmDialog';
import { ManagePage } from './components/ManagePage';
import { DashboardPage } from './pages/DashboardPage';
import { QRCodePage } from './pages/QRCodePage';
import { AllPhotosPage } from './pages/AllPhotosPage';
import { collections, todayDisplay } from './config';

const pageTitles: Record<string, { title: string; icon: string }> = {
  dashboard: { title: 'Dashboard', icon: '📊' },
  events: { title: 'Events', icon: '📅' },
  qrcodes: { title: 'QR Codes', icon: '🔳' },
  photos: { title: 'All Photos', icon: '🖼️' },
  sermons: { title: 'Sermons', icon: '🎬' },
  announcements: { title: 'Announcements', icon: '📢' },
  prayers: { title: 'Prayer Requests', icon: '🙏' },
  attendees: { title: 'Attendees', icon: '👥' },
  testimonials: { title: 'Testimonials', icon: '🗣️' },
  members: { title: 'Members', icon: '🧑' },
  settings: { title: 'Settings', icon: '⚙️' }
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [isDark, setIsDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const [data, setData] = useState<RecordMap>({
    events: [],
    sermons: [],
    prayers: [],
    attendees: [],
    members: [],
    announcements: [],
    testimonials: [],
    allPhotos: []
  });

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  // ============ CLOCK ============
  useEffect(() => {
    const update = () => setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // ============ LOAD DATA ============
  const [dataLoadedOnce, setDataLoadedOnce] = useState(false);
  const loadAll = useCallback(async () => {
    try {
      const [events, sermons, prayers, attendees, members, announcements, testimonials, allPhotos] = await Promise.all([
        listCollection('events'), listCollection('sermons'), listCollection('prayers'), listCollection('attendees'),
        listCollection('members'), listCollection('announcements'), listCollection('testimonials'), listCollection('allPhotos')
      ]);
      setData({
        events: events.events || [],
        sermons: sermons.sermons || [],
        prayers: prayers.prayers || [],
        attendees: attendees.attendees || [],
        members: members.members || [],
        announcements: announcements.announcements || [],
        testimonials: testimonials.testimonials || [],
        allPhotos: allPhotos.allPhotos || []
      });
      setDataLoadedOnce(true);
    } catch (error) {
      console.error('Failed to load data:', error);
      // If error, still show empty data
      setData({
        events: [],
        sermons: [],
        prayers: [],
        attendees: [],
        members: [],
        announcements: [],
        testimonials: [],
        allPhotos: []
      });
      setDataLoadedOnce(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Start loading immediately
    setLoading(true);
    void loadAll();
  }, [loadAll]);

  // Auto-retry only if data never loaded successfully
  useEffect(() => {
    if (dataLoadedOnce) return;
    const t = setInterval(() => { 
      if (!dataLoadedOnce) {
        void loadAll(); 
      }
    }, 5000);
    return () => clearInterval(t);
  }, [dataLoadedOnce, loadAll]);

  // ============ TARGETED REFRESH FUNCTIONS ============
  const refreshAllPhotos = useCallback(async () => {
    try {
      const result = await listCollection('allPhotos');
      setData(prev => ({
        ...prev,
        allPhotos: result.allPhotos || []
      }));
    } catch (error) {
      console.error('Failed to refresh All Photos:', error);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const result = await listCollection('events');
      setData(prev => ({
        ...prev,
        events: result.events || []
      }));
    } catch (error) {
      console.error('Failed to refresh Events:', error);
    }
  }, []);

  // ============ ACTIVITIES (SSE + polling) ============
  const setActivitiesMerged = useCallback((incoming: Activity[]) => {
    setActivities(prev => {
      const map = new Map<string, Activity>();
      for (const a of incoming) map.set(a.id, a);
      for (const a of prev) if (!map.has(a.id)) map.set(a.id, a);
      return Array.from(map.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 300);
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let closeStream: (() => void) | undefined;
    const refresh = () => {
      getActivities()
        .then(res => { if (!disposed) { setActivitiesMerged(res.activities || []); setActivitiesLoading(false); } })
        .catch(() => { if (!disposed) setActivitiesLoading(false); });
    };
    refresh();
    void getActivityStream(activity => {
      if (!disposed) {
        setActivities(prev => prev.some(a => a.id === activity.id) ? prev : [activity, ...prev].slice(0, 300));

        if (activity.type === 'allPhotos' && activity.action === 'photo') {
          void refreshAllPhotos();
        }

        if (activity.type === 'events' && activity.action === 'photo') {
          void refreshEvents();
          void refreshAllPhotos();
        }
      }
    }).then(close => { if (disposed) close(); else closeStream = close; });
    const poll = setInterval(refresh, 10000);
    return () => { disposed = true; closeStream?.(); clearInterval(poll); };
  }, [setActivitiesMerged, refreshAllPhotos, refreshEvents]);

  // ============ CRUD ============
  const handleCreate = async (collection: Collection, record: unknown) => {
    try {
      const created = await createRecord(collection, record);
      setData(prev => ({ ...prev, [collection]: [created, ...(prev[collection] as unknown[])] } as RecordMap));
      showToast(`✅ ${pageTitles[collection]?.title || collection} added successfully!`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to add record.', 'error');
    }
  };

  const handleUpdate = async (collection: Collection, id: string, record: unknown) => {
    try {
      const updated = (await apiUpdateRecord(collection, id, record)) as Record<string, unknown>;
      setData(prev => ({ ...prev, [collection]: (prev[collection] as unknown[]).map(item => (item as Record<string, unknown>).id === id ? updated : item) } as RecordMap));
      showToast(`✏️ ${pageTitles[collection]?.title || collection} updated!`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update record.', 'error');
    }
  };

  const handleDelete = async (collection: Collection, id: string) => {
    try {
      await apiDeleteRecord(collection, id);
      setData(prev => ({ ...prev, [collection]: (prev[collection] as unknown[]).filter(item => (item as Record<string, unknown>).id !== id) } as RecordMap));
      showToast(`🗑️ ${pageTitles[collection]?.title || collection} deleted!`, 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete record.', 'error');
    }
  };

  const handleReset = () => {
    setConfirm({
      show: true,
      title: 'Reset all site data?',
      message: 'This will delete ALL records (events, sermons, prayers, attendees, announcements, testimonials, members). This cannot be undone.',
      onConfirm: async () => {
        try {
          await resetRemoteData();
          await clearActivities();
          setData({ events: [], sermons: [], prayers: [], attendees: [], members: [], announcements: [], testimonials: [], allPhotos: [] });
          setActivities([]);
          showToast('💾 All data was reset.', 'success');
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Failed to reset data.', 'error');
        }
      }
    });
  };

  const handleClearActivities = () => {
    setConfirm({
      show: true,
      title: 'Clear activity log?',
      message: 'This will remove all entries from the real-time activity log.',
      onConfirm: async () => {
        try {
          await clearActivities();
          setActivities([]);
          showToast('🧹 Activity log cleared.', 'success');
        } catch (error) {
          showToast(error instanceof Error ? error.message : 'Failed to clear log.', 'error');
        }
      }
    });
  };

  // ============ RECORD BUILDERS ============
  const buildRecord = (key: string) => (values: Record<string, string>): any => {
    const idPrefix = key === 'events' ? 'event' : key === 'sermons' ? 'sermon' : key === 'announcements' ? 'ann' : key === 'prayers' ? 'prayer' : key === 'attendees' ? 'att' : key === 'testimonials' ? 'test' : 'mem';
    const id = `${idPrefix}-${Date.now()}`;
    switch (key) {
      case 'events':
        return { id, title: values.title, date: values.date, tag: values.tag, description: values.description || 'Everyone is invited!', location: values.location || '📍 Gospel Fellowship Church, Limay, Bataan' };
      case 'sermons':
        return { id, title: values.title, sermonDate: values.sermonDate, speaker: values.speaker || 'Pastor Zaldy Bernaldo', verse: values.verse, verseRef: values.verseRef || '', videoUrl: values.videoUrl || undefined, image: values.image || undefined };
      case 'announcements':
        return { id, title: values.title, details: values.details, date: todayDisplay, category: values.category || 'General' };
      case 'prayers':
        return { id, name: values.name || 'Anonymous', request: values.request, createdAt: todayDisplay, status: 'pending', category: values.category || 'General' };
      case 'attendees':
        return { id, name: values.name, facebookName: values.facebookName || undefined, contact: values.contact || undefined, age: values.age || undefined, registeredAt: todayDisplay };
      case 'testimonials':
        return { id, name: values.name, role: values.role || undefined, text: values.text, createdAt: todayDisplay };
      case 'members':
        return { id, fullName: values.fullName, role: values.role || 'Member', ministry: values.ministry || 'General', contactNumber: values.contactNumber || undefined, facebookName: values.facebookName || undefined, birthMonth: values.birthMonth || '', isBaptized: false, joinDate: values.joinDate || undefined };
      default:
        return { id, ...values };
    }
  };

  const toFormFor = (key: string) => (record: any) => {
    const config = collections.find(c => c.key === key)!;
    const out: Record<string, string> = {};
    for (const field of config.fields) out[field.name] = String(record?.[field.name] ?? '');
    return out;
  };

  // ============ RENDER HELPERS ============
  const renderPage = () => {
    if (page === 'dashboard') {
      return (
        <DashboardPage
          counts={{
            events: data.events.length,
            sermons: data.sermons.length,
            prayers: data.prayers.length,
            attendees: data.attendees.length,
            members: data.members.length,
            announcements: data.announcements.length,
            testimonials: data.testimonials.length
          }}
          activities={activities}
          loadingActivities={activitiesLoading}
          onClearActivities={handleClearActivities}
          onNavigate={setPage}
        />
      );
    }

    if (page === 'qrcodes') {
      return (
        <QRCodePage
          events={data.events}
          onUpdateEvent={(updatedEvent) => {
            setData(prev => ({
              ...prev,
              events: (prev.events as ChurchEvent[]).map(e => e.id === updatedEvent.id ? updatedEvent : e)
            }));
          }}
          onReload={() => void loadAll()}
          allPhotos={data.allPhotos}
          onAllPhotosUpdated={refreshAllPhotos}
        />
      );
    }

    if (page === 'photos') {
      return (
        <AllPhotosPage 
          events={data.events} 
          allPhotos={data.allPhotos}
          onAllPhotosUpdated={refreshAllPhotos}
          onEventsUpdated={refreshEvents}
        />
      );
    }

    if (page === 'settings') {
      return (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
            <h3 className="text-sm font-bold text-black dark:text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-500" />
              <span>System Settings</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5">
                <div className="text-xs font-bold text-gray-500 dark:text-[#A1A1A1] uppercase tracking-wider mb-1">Backend API URL</div>
                <div className="font-mono font-bold text-black dark:text-white">{API_URL}</div>
              </div>
            </div>
            <div className="mt-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/30">
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1">Database Summary</div>
              <div className="grid grid-cols-2 gap-1 text-sm mt-2">
                <p className="text-gray-600 dark:text-[#A1A1A1]">Events: <strong className="text-black dark:text-white">{data.events.length}</strong></p>
                <p className="text-gray-600 dark:text-[#A1A1A1]">Sermons: <strong className="text-black dark:text-white">{data.sermons.length}</strong></p>
                <p className="text-gray-600 dark:text-[#A1A1A1]">Announcements: <strong className="text-black dark:text-white">{data.announcements.length}</strong></p>
                <p className="text-gray-600 dark:text-[#A1A1A1]">Prayers: <strong className="text-black dark:text-white">{data.prayers.length}</strong></p>
                <p className="text-gray-600 dark:text-[#A1A1A1]">Attendees: <strong className="text-black dark:text-white">{data.attendees.length}</strong></p>
                <p className="text-gray-600 dark:text-[#A1A1A1]">Members: <strong className="text-black dark:text-white">{data.members.length}</strong></p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Reset All Data
              </button>
              <button
                onClick={handleClearActivities}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-[#A1A1A1] rounded-xl text-xs font-bold transition-all border border-gray-200 dark:border-white/10"
              >
                Clear Activity Log
              </button>
            </div>
          </div>
        </div>
      );
    }

    const config = collections.find(c => c.key === page);
    if (!config) return null;

    const collection = page as Collection;
    const records = data[collection] as any[];
    const extraRender = page === 'prayers'
      ? (p: any) => (
          <>
            {p.status === 'pending' && (
              <button
                onClick={() => handleUpdate('prayers', p.id, { status: 'approved' })}
                className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-all mr-2"
              >
                ✅ Approve
              </button>
            )}
            {p.status !== 'answered' && (
              <button
                onClick={() => {
                  const t = prompt('Testimony/answer for this prayer:');
                  if (t !== null) handleUpdate('prayers', p.id, { status: 'answered', answeredTestimony: t });
                }}
                className="px-3 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-all mr-2"
              >
                💫 Mark Answered
              </button>
            )}
          </>
        )
      : page === 'announcements'
      ? (a: any) => (
          <button
            onClick={() => handleUpdate('announcements', a.id, { isPinned: !a.isPinned })}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all mr-2 ${
              a.isPinned
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50'
                : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-[#A1A1A1] hover:bg-gray-200 dark:hover:bg-white/20'
            }`}
          >
            {a.isPinned ? '🚫 Unpin' : '📌 Pin'}
          </button>
        )
      : undefined;

    return (
      <ManagePage
        title={config.title}
        icon={config.icon}
        accent={config.accent}
        fields={config.fields}
        columns={config.columns}
        records={records}
        idOf={(record: any) => record.id}
        toForm={toFormFor(page)}
        buildRecord={buildRecord(page)}
        onAdd={(record) => void handleCreate(collection, record)}
        onUpdate={(id, record) => void handleUpdate(collection, id, record)}
        onDelete={(id) => void handleDelete(collection, id)}
        extraRender={extraRender}
        addLabel={`Add ${config.title}`}
        csvFileName={page}
      />
    );
  };

  const sidebarItems = useMemo(() => [
    { id: 'dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', badge: null },
    { id: 'events', icon: <CalendarIcon className="w-5 h-5" />, label: 'Events', badge: data.events.length },
    { id: 'qrcodes', icon: <QrCode className="w-5 h-5" />, label: 'QR Codes', badge: null },
    { id: 'photos', icon: <Images className="w-5 h-5" />, label: 'All Photos', badge: null },
    { id: 'sermons', icon: <Video className="w-5 h-5" />, label: 'Sermons', badge: data.sermons.length },
    { id: 'announcements', icon: <Megaphone className="w-5 h-5" />, label: 'Announcements', badge: data.announcements.length },
    { id: 'prayers', icon: <Heart className="w-5 h-5" />, label: 'Prayer Requests', badge: data.prayers.length },
    { id: 'attendees', icon: <Users className="w-5 h-5" />, label: 'Attendees', badge: data.attendees.length },
    { id: 'testimonials', icon: <MessageSquare className="w-5 h-5" />, label: 'Testimonials', badge: data.testimonials.length },
    { id: 'members', icon: <Users className="w-5 h-5" />, label: 'Members', badge: data.members.length },
    { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings', badge: null }
  ], [data]);

  // Sa App.tsx - hanapin ang return statement

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/30 via-white to-purple-50/30 dark:bg-[#0a0a14] dark:from-[#0a0a14] dark:via-[#0f0f1a] dark:to-[#0a0a14] flex h-screen overflow-hidden">
        <ToastHost toasts={toasts} dismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
        <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />

        <Sidebar
          items={sidebarItems}
          active={page}
          onNavigate={setPage}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-white/5 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage('dashboard')}
                className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-[#A1A1A1] transition-all flex items-center gap-2"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-black dark:text-white">
                {pageTitles[page]?.icon} {pageTitles[page]?.title || page}
              </h1>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-[#A1A1A1]">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>{currentTime}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setPage('dashboard')}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                title="Live activity feed"
              >
                <Bell className="w-5 h-5 text-gray-600 dark:text-[#A1A1A1]" />
                {activities.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full text-center min-w-[18px]">
                    {activities.length}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-3 text-sm font-medium text-black dark:text-white">
                <span className="hidden sm:inline">Admin</span>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-lg">
                  <Shield className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* REMOVED: loading condition - always render page */}
          {renderPage()}
        </main>
      </div>
    </div>
  );
}