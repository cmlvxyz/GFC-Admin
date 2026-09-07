// GFC-ADMIN/src/pages/AdminPage.tsx

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChurchEvent, 
  Announcement, 
  Sermon, 
  PrayerRequest, 
  Member, 
  Attendee,
  Testimonial,
  DateEntry
} from '../types';
import { login as loginWithBackend } from '../api';
import {
  Shield,
  X,
  Plus,
  Trash2,
  Users,
  Calendar,
  Headphones,
  Heart,
  Megaphone,
  Check,
  LayoutDashboard,
  Calendar as CalendarIcon,
  Video,
  Cog,
  Moon,
  Sun,
  Bell,
  Search,
  Download,
  LogOut,
  Menu,
  MessageSquare,
  UserPlus,
  UserCheck,
  Eye,
  Send,
  Clock,
  MapPin,
  Mail,
  Facebook,
  Phone,
  Home,
  ArrowLeft,
  Settings,
  TrendingUp,
  Award,
  Sparkles,
  FileText,
  Loader2,
  QrCode,
  Scan,
  Upload,
  ChevronDown,
  ChevronRight,
  Image,
  Save
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// ============================================
// TYPES
// ============================================
interface AdminPageProps {
  events: ChurchEvent[];
  announcements: Announcement[];
  sermons: Sermon[];
  prayers: PrayerRequest[];
  members: Member[];
  attendees: Attendee[];
  testimonials: Testimonial[];
  onAddEvent: (event: ChurchEvent) => void;
  onUpdateEvent?: (event: ChurchEvent) => void;
  onDeleteEvent: (id: string) => void;
  onAddAnnouncement: (announcement: Announcement) => void;
  onDeleteAnnouncement: (id: string) => void;
  onTogglePinAnnouncement: (id: string) => void;
  onAddSermon: (sermon: Sermon) => void;
  onDeleteSermon: (id: string) => void;
  onAddPrayer: (prayer: PrayerRequest) => void;
  onDeletePrayer: (id: string) => void;
  onApprovePrayer: (id: string) => void;
  onMarkPrayerAnswered: (id: string, testimony?: string) => void;
  onAddAttendee: (attendee: Attendee) => void;
  onAddMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onResetData: () => void;
  onAddTestimonial?: (testimonial: Testimonial) => void;
  onDeleteTestimonial?: (id: string) => void;
  onClose: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  events,
  announcements,
  sermons,
  prayers,
  members,
  attendees,
  testimonials = [],
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onAddAnnouncement,
  onDeleteAnnouncement,
  onTogglePinAnnouncement,
  onAddSermon,
  onDeleteSermon,
  onAddPrayer,
  onDeletePrayer,
  onApprovePrayer,
  onMarkPrayerAnswered,
  onAddAttendee,
  onAddMember,
  onDeleteMember,
  onResetData,
  onAddTestimonial,
  onDeleteTestimonial,
  onClose
}) => {
  // ============================================
  // STATE
  // ============================================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [errorMsg, setErrorMsg] = useState('');
  const [activePage, setActivePage] = useState<string>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [activityFeed, setActivityFeed] = useState<{ icon: string; text: string; time: string }[]>([]);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // QR Code States
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(-1);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadedPhotoPreviews, setUploadedPhotoPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [photoDateTitle, setPhotoDateTitle] = useState('');
  const [photoVerse, setPhotoVerse] = useState('');
  const [photoVerseRef, setPhotoVerseRef] = useState('');
  const photoFileInputRef = useRef<HTMLInputElement>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);
  let toastIdCounter = 0;

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setCurrentTime(time);
    };
    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    if (isAutoRefresh) {
      const interval = setInterval(() => {
        addRandomActivity();
      }, 8000);
      return () => {
        clearInterval(interval);
        clearInterval(clockInterval);
      };
    }
    return () => clearInterval(clockInterval);
  }, [isAutoRefresh]);

  // ============================================
  // TOAST FUNCTIONS
  // ============================================
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    const id = toastIdCounter++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const addActivity = (icon: string, text: string) => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    setActivityFeed(prev => [{ icon, text, time }, ...prev.slice(0, 19)]);
  };

  const addRandomActivity = () => {
    const messages = [
      { icon: '📊', text: 'Dashboard stats updated' },
      { icon: '🔄', text: 'System auto-refresh completed' },
      { icon: '💾', text: 'Data synced successfully' }
    ];
    const random = messages[Math.floor(Math.random() * messages.length)];
    addActivity(random.icon, random.text);
  };

  // ============================================
  // AUTH HANDLERS
  // ============================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setErrorMsg('');
    try { await loginWithBackend(username, password); setIsAuthenticated(true); showToast('✅ Welcome to Admin Dashboard!', 'success'); }
    catch (error) { setErrorMsg(error instanceof Error ? error.message : 'Invalid username or password.'); }
    finally { setIsLoading(false); }
  };

  // ============================================
  // PAGE NAVIGATION
  // ============================================
  const showPage = (page: string) => {
    setActivePage(page);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  // ============================================
  // QR CODE HANDLERS
  // ============================================
  
  const getEventById = (id: string) => events.find(e => e.id === id);
  
  const getSelectedEvent = () => getEventById(selectedEventId);
  
  const getSelectedDateEntry = (): DateEntry | null => {
    const event = getSelectedEvent();
    if (!event || !event.dateEntries || selectedDateIndex < 0 || selectedDateIndex >= event.dateEntries.length) {
      return null;
    }
    return event.dateEntries[selectedDateIndex];
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPreviews: string[] = [];
    const newUrls: string[] = [];
    let processed = 0;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        newPreviews[index] = base64String;
        newUrls[index] = base64String;
        processed++;
        
        if (processed === files.length) {
          setUploadedPhotoPreviews(prev => [...prev, ...newPreviews]);
          setUploadedPhotos(prev => [...prev, ...newUrls]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = '';
    }
  };

  const handleRemoveUploadedPhoto = (index: number) => {
    setUploadedPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSavePhotosToEvent = async () => {
    if (!selectedEventId || selectedDateIndex < 0) {
      showToast('Please select an event and date first.', 'error');
      return;
    }

    if (uploadedPhotos.length === 0 || !photoDateTitle.trim()) {
      showToast('Please add a date title and select photos.', 'error');
      return;
    }

    setIsUploading(true);

    try {
      const event = getSelectedEvent();
      if (!event || !event.dateEntries) {
        showToast('Event or date entry not found.', 'error');
        setIsUploading(false);
        return;
      }

      const currentPhotos = event.dateEntries[selectedDateIndex]?.photos || [];
      const updatedPhotos = [...currentPhotos, ...uploadedPhotos];
      
      const updatedEntries = [...event.dateEntries];
      updatedEntries[selectedDateIndex] = {
        ...updatedEntries[selectedDateIndex],
        photos: updatedPhotos,
        verse: photoVerse || undefined,
        verseRef: photoVerseRef || undefined
      };

      const updatedEvent: ChurchEvent = {
        ...event,
        dateEntries: updatedEntries
      };

      if (onUpdateEvent) {
        onUpdateEvent(updatedEvent);
        showToast(`✅ ${uploadedPhotos.length} photo(s) uploaded successfully!`, 'success');
        addActivity('📸', `${uploadedPhotos.length} photos uploaded to ${event.title}`);
        
        setUploadedPhotos([]);
        setUploadedPhotoPreviews([]);
        setPhotoDateTitle('');
        setPhotoVerse('');
        setPhotoVerseRef('');
      }
    } catch (error) {
      showToast('Error uploading photos. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Get events that have date entries
  const eventsWithDateEntries = events.filter(e => e.dateEntries && e.dateEntries.length > 0);

  // Get local IP for QR code
  const getLocalIP = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return hostname;
      }
    }
    return '192.168.100.4'; // Palitan ng IP ng computer mo
  };

  const getQRUrl = (eventId: string, dateIndex: number) => {
    const ip = getLocalIP();
    return `http://${ip}:4000/upload?event=${eventId}&date=${dateIndex}`;
  };

  // ============================================
  // SIDEBAR MENU ITEMS
  // ============================================
  const menuItems = [
    { id: 'dashboard', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', badge: null },
    { id: 'events', icon: <CalendarIcon className="w-5 h-5" />, label: 'Events', badge: events.length },
    { id: 'qrcodes', icon: <QrCode className="w-5 h-5" />, label: 'QR Codes', badge: null },
    { id: 'sermons', icon: <Video className="w-5 h-5" />, label: 'Sermons', badge: sermons.length },
    { id: 'announcements', icon: <Megaphone className="w-5 h-5" />, label: 'Announcements', badge: announcements.length },
    { id: 'prayers', icon: <Heart className="w-5 h-5" />, label: 'Prayer Requests', badge: prayers.length },
    { id: 'attendees', icon: <Users className="w-5 h-5" />, label: 'Attendees', badge: attendees.length },
    { id: 'testimonials', icon: <MessageSquare className="w-5 h-5" />, label: 'Testimonials', badge: testimonials.length },
    { id: 'members', icon: <Users className="w-5 h-5" />, label: 'Members', badge: members.length },
    { id: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings', badge: null }
  ];

  // ============================================
  // RENDER - LOGIN SCREEN
  // ============================================
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-[#0a0a14] dark:via-[#0f0f1a] dark:to-[#0a0a14] flex items-center justify-center p-4">
          <div className="bg-white/80 dark:bg-[#1A1A1A]/95 backdrop-blur-xl border border-gray-200 dark:border-indigo-400/30 text-black dark:text-[#F5F5F5] rounded-3xl max-w-md w-full p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-white rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-xl">
                <Shield className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-2xl font-serif text-black dark:text-white">
                  GFC-ADMIN
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#A1A1A1] mt-1">
                  Gospel Fellowship Church • Management System
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-gray-700 dark:text-[#A1A1A1] mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/50 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-gray-700 dark:text-[#A1A1A1] mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="admin123"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/50 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 dark:from-indigo-400 dark:to-indigo-500 dark:hover:brightness-110 text-white font-extrabold uppercase tracking-wider text-xs rounded-xl shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    'Sign In to GFC-ADMIN'
                  )}
                </button>
              </form>

              <div className="text-[11px] text-gray-500 dark:text-[#A1A1A1] bg-gray-50 dark:bg-black/30 p-4 rounded-xl border border-gray-200 dark:border-white/10">
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium">Default Login:</span>
                  <span className="font-mono font-bold text-indigo-500 dark:text-indigo-400">admin</span>
                  <span className="text-gray-400">|</span>
                  <span className="font-mono font-bold text-indigo-500 dark:text-indigo-400">admin123</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - MAIN ADMIN DASHBOARD
  // ============================================
  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/30 via-white to-purple-50/30 dark:bg-[#0a0a14] dark:from-[#0a0a14] dark:via-[#0f0f1a] dark:to-[#0a0a14] flex h-screen overflow-hidden">
        {/* ========================================== */}
        {/* TOAST CONTAINER */}
        {/* ========================================== */}
        <div className="fixed top-4 right-4 z-[999999] flex flex-col gap-2 max-w-md">
          {toasts.map(toast => {
            const bgColors = {
              success: 'bg-emerald-500 dark:bg-emerald-600',
              error: 'bg-red-500 dark:bg-red-600',
              warning: 'bg-amber-500 dark:bg-amber-600',
              info: 'bg-blue-500 dark:bg-blue-600'
            };
            const icons = {
              success: '✅',
              error: '❌',
              warning: '⚠️',
              info: 'ℹ️'
            };
            return (
              <div
                key={toast.id}
                className={`${bgColors[toast.type as keyof typeof bgColors]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slideInToast`}
              >
                <span>{icons[toast.type as keyof typeof icons]}</span>
                <span className="text-sm font-medium">{toast.message}</span>
                <button
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="ml-auto opacity-70 hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* ========================================== */}
        {/* SIDEBAR */}
        {/* ========================================== */}
        <aside
          className={`w-[280px] bg-white/80 dark:bg-[#141424]/95 backdrop-blur-xl border-r border-gray-200 dark:border-white/5 shrink-0 overflow-y-auto transition-all duration-500 ${
            isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'relative'
          }`}
          style={{ transform: isMobileMenuOpen ? 'translateX(0)' : '' }}
        >
          <div className="p-6 border-b border-gray-200 dark:border-white/5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
              <img src="/image.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="font-extrabold text-black dark:text-white text-lg leading-tight">
                GFC-<span className="text-indigo-500 dark:text-indigo-400">ADMIN</span>
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-600 font-medium">Management System</div>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-600 px-3 py-2 font-bold">
              Main Navigation
            </div>
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => showPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activePage === item.id
                    ? 'bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-400/20 dark:to-indigo-400/10 text-indigo-600 dark:text-indigo-400 border-l-2 border-indigo-500 dark:border-indigo-400'
                    : 'text-gray-600 dark:text-[#8888AA] hover:bg-gray-50 dark:hover:bg-white/5 hover:text-black dark:hover:text-white'
                }`}
              >
                <span className={activePage === item.id ? 'text-indigo-500' : 'text-indigo-400'}>{item.icon}</span>
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
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-[#8888AA] hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-400" />}
              <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setActivePage('dashboard');
                showToast('👋 Logged out successfully', 'info');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* ========================================== */}
        {/* MAIN CONTENT */}
        {/* ========================================== */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-white/5 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-[#A1A1A1] transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">Back to Site</span>
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-black dark:text-white">
                {activePage === 'dashboard' && '📊 Dashboard'}
                {activePage === 'events' && '📅 Events'}
                {activePage === 'qrcodes' && '📱 QR Codes'}
                {activePage === 'sermons' && '🎬 Sermons'}
                {activePage === 'announcements' && '📢 Announcements'}
                {activePage === 'prayers' && '🙏 Prayer Requests'}
                {activePage === 'attendees' && '👥 Attendees'}
                {activePage === 'testimonials' && '🗣️ Testimonials'}
                {activePage === 'members' && '🧑 Members'}
                {activePage === 'settings' && '⚙️ Settings'}
              </h1>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-4 py-1.5 rounded-full text-xs font-semibold text-gray-600 dark:text-[#A1A1A1]">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>{currentTime}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-[#A1A1A1] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAutoRefresh}
                  onChange={() => setIsAutoRefresh(!isAutoRefresh)}
                  className="w-4 h-4 accent-indigo-500 rounded"
                />
                <span>Auto-refresh</span>
              </label>
              <div className="flex items-center gap-3 text-sm font-medium text-black dark:text-white">
                <span className="hidden sm:inline">Admin</span>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-lg">
                  A
                </div>
              </div>
            </div>
          </div>

          {/* ========================================== */}
          {/* PAGE: QR CODES - ISANG QR CODE LANG, WALANG DOWNLOAD */}
          {/* ========================================== */}
          {activePage === 'qrcodes' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                    <QrCode className="w-5 h-5" />
                    <span>Event QR Code Generator</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-serif mt-2">
                    Event QR Code Generator
                  </h2>
                  <p className="text-white/80 text-sm mt-1 max-w-2xl">
                    I-scan ng church members ang QR code gamit ang kanilang phone para makapag-upload ng photos sa event gallery. 
                    Makikita ang mga na-upload na photos sa website ng church.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm text-xs font-mono font-bold">
                    Upload URL: {getQRUrl('event-id', 0).replace('event-id', '&lt;id&gt;').replace('0', '&lt;date&gt;')}
                  </div>
                </div>
              </div>

              {/* Debug info */}
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-black/30 p-2 rounded-lg">
                <span className="font-bold">Debug:</span> {events.length} total events, {eventsWithDateEntries.length} events with date entries
                <br />
                <span className="text-indigo-500">📡 Local IP:</span> {getLocalIP()}:4000
              </div>

              {/* QR Code Generator - ISANG QR CODE LANG, WALANG DOWNLOAD BUTTON */}
              <div className="bg-white dark:bg-[#141424]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Side - Event Selection */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-black dark:text-white">Select Event & Date</h3>
                    
                    {/* Event Selection */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">
                        Select Event
                      </label>
                      <select
                        value={selectedEventId}
                        onChange={(e) => {
                          setSelectedEventId(e.target.value);
                          setSelectedDateIndex(-1);
                          setUploadedPhotos([]);
                          setUploadedPhotoPreviews([]);
                          setPhotoDateTitle('');
                          setPhotoVerse('');
                          setPhotoVerseRef('');
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                      >
                        <option value="">-- Select an event --</option>
                        {eventsWithDateEntries.map(event => (
                          <option key={event.id} value={event.id}>
                            {event.title} ({event.dateEntries?.length || 0} albums)
                          </option>
                        ))}
                      </select>
                      {eventsWithDateEntries.length === 0 && (
                        <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                          ⚠️ Walang event na may photo album. Mag-add ng date album sa events section.
                        </p>
                      )}
                    </div>

                    {/* Date Selection */}
                    {selectedEventId && getSelectedEvent() && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">
                          Select Date Album
                        </label>
                        <select
                          value={selectedDateIndex}
                          onChange={(e) => {
                            setSelectedDateIndex(parseInt(e.target.value));
                            setUploadedPhotos([]);
                            setUploadedPhotoPreviews([]);
                            setPhotoDateTitle('');
                            setPhotoVerse('');
                            setPhotoVerseRef('');
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                        >
                          <option value="-1">-- Select a date --</option>
                          {getSelectedEvent()?.dateEntries?.map((entry, index) => (
                            <option key={index} value={index}>
                              {entry.date} ({entry.photos?.length || 0} photos)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Selected Date Info */}
                    {selectedDateIndex >= 0 && getSelectedDateEntry() && (
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-400/30">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">Selected:</span>
                          <span className="text-black dark:text-white">{getSelectedEvent()?.title}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-black dark:text-white">{getSelectedDateEntry()?.date}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-[#A1A1A1] mt-1">
                          📸 {getSelectedDateEntry()?.photos?.length || 0} photos currently in this album
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Side - QR Code Display & Upload - ISANG QR CODE LANG, WALANG DOWNLOAD */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-black dark:text-white">QR Code & Upload</h3>
                    
                    {selectedEventId && selectedDateIndex >= 0 ? (
                      <>
                        {/* QR Code Display - ISA LANG, WALANG DOWNLOAD BUTTON */}
                        <div className="flex flex-col items-center p-4 bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10">
                          <div className="flex items-center gap-2 mb-2">
                            <QrCode className="w-5 h-5 text-indigo-500" />
                            <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">
                              {getSelectedEvent()?.title} - {getSelectedDateEntry()?.date}
                            </span>
                          </div>
                          <QRCodeSVG
                            value={getQRUrl(selectedEventId, selectedDateIndex)}
                            size={220}
                            level="H"
                            includeMargin
                            bgColor="#ffffff"
                            fgColor="#1a1a2e"
                          />
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center break-all max-w-xs">
                            {getQRUrl(selectedEventId, selectedDateIndex)}
                          </p>
                          {/* WALANG DOWNLOAD BUTTON DITO */}
                        </div>

                        {/* Photo Upload Section */}
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                              <Upload className="w-4 h-4" />
                              Upload Photos to This Date
                            </h4>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              {uploadedPhotoPreviews.length} selected
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-1">
                              Date Title *
                            </label>
                            <input
                              type="text"
                              required
                              value={photoDateTitle}
                              onChange={e => setPhotoDateTitle(e.target.value)}
                              placeholder="e.g. August 25, 2026"
                              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/50 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-1">
                                Verse (Optional)
                              </label>
                              <input
                                type="text"
                                value={photoVerse}
                                onChange={e => setPhotoVerse(e.target.value)}
                                placeholder="e.g. Pray without ceasing"
                                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/50 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-1">
                                Reference
                              </label>
                              <input
                                type="text"
                                value={photoVerseRef}
                                onChange={e => setPhotoVerseRef(e.target.value)}
                                placeholder="e.g. 1 Thess 5:17"
                                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black/50 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          {/* Uploaded Images Preview */}
                          {uploadedPhotoPreviews.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
                              {uploadedPhotoPreviews.map((preview, index) => (
                                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700">
                                  <img src={preview} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveUploadedPhoto(index)}
                                    className="absolute top-1 right-1 p-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-3 mt-2">
                            <label className="flex-1 px-4 py-2.5 bg-white dark:bg-black/30 hover:bg-gray-50 dark:hover:bg-white/10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center cursor-pointer transition-all flex items-center justify-center gap-2 min-h-[44px]">
                              <Image className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                {uploadedPhotoPreviews.length > 0 ? 'Add More Photos' : 'Select Photos to Upload'}
                              </span>
                              <input
                                type="file"
                                ref={photoFileInputRef}
                                accept="image/*"
                                multiple
                                onChange={handlePhotoUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                            Select multiple photos to upload to this date album.
                          </p>

                          <button
                            onClick={handleSavePhotosToEvent}
                            disabled={uploadedPhotos.length === 0 || isUploading || !photoDateTitle.trim()}
                            className="w-full mt-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4" />
                                Upload {uploadedPhotos.length} Photo(s)
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 dark:bg-black/30 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                        <div className="w-16 h-16 mx-auto bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                          <QrCode className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
                          {!selectedEventId ? 'Select an event first' : 'Select a date album from the dropdown'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {eventsWithDateEntries.length === 0 ? 'No events with photo albums yet. Add a date entry to an event first.' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Events with Date Entries List */}
              <div className="bg-white dark:bg-[#141424]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                <h3 className="text-sm font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-indigo-500" />
                  Events with Photo Albums ({eventsWithDateEntries.length})
                </h3>
                
                {eventsWithDateEntries.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-[#A1A1A1] text-sm">
                      Walang event na may photo album (date entries) pa.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Magdagdag muna ng date album sa isang event, tapos i-generate ang QR code dito.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {eventsWithDateEntries.map(event => (
                      <div
                        key={event.id}
                        className="p-4 bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-400/30 transition-all cursor-pointer"
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setSelectedDateIndex(-1);
                          setUploadedPhotos([]);
                          setUploadedPhotoPreviews([]);
                          setPhotoDateTitle('');
                          setPhotoVerse('');
                          setPhotoVerseRef('');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-sm text-black dark:text-white">{event.title}</h4>
                            <p className="text-xs text-gray-500 dark:text-[#A1A1A1]">
                              {event.dateEntries?.length || 0} album(s)
                            </p>
                          </div>
                          <span className="text-indigo-500">➔</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {event.dateEntries?.slice(0, 4).map((entry, idx) => (
                            <span key={idx} className="text-[10px] bg-white dark:bg-black/50 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#A1A1A1]">
                              {entry.date}
                            </span>
                          ))}
                          {(event.dateEntries?.length || 0) > 4 && (
                            <span className="text-[10px] text-gray-400">+{(event.dateEntries?.length || 0) - 4} more</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* PAGE: DASHBOARD */}
          {/* ========================================== */}
          {activePage === 'dashboard' && (
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
                    GFC-ADMIN Dashboard
                  </h2>
                  <p className="text-white/80 text-sm mt-1 max-w-lg">
                    Manage your church's events, sermons, prayer requests, and community data all in one place.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Events', value: events.length, icon: '📅', color: 'from-indigo-500 to-indigo-600' },
                  { label: 'Sermons', value: sermons.length, icon: '🎬', color: 'from-purple-500 to-purple-600' },
                  { label: 'Prayer Requests', value: prayers.length, icon: '🙏', color: 'from-rose-500 to-rose-600' },
                  { label: 'Attendees', value: attendees.length, icon: '👥', color: 'from-emerald-500 to-emerald-600' },
                  { label: 'Testimonials', value: testimonials.length, icon: '🗣️', color: 'from-amber-500 to-amber-600' },
                  { label: 'Announcements', value: announcements.length, icon: '📢', color: 'from-cyan-500 to-cyan-600' },
                  { label: 'Members', value: members.length, icon: '🧑', color: 'from-fuchsia-500 to-fuchsia-600' }
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="bg-white dark:bg-[#141424]/80 backdrop-blur-sm p-5 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-2xl font-bold text-black dark:text-white">{stat.value}</div>
                        <div className="text-[10px] text-gray-500 dark:text-[#A1A1A1] font-medium mt-0.5 uppercase tracking-wider">{stat.label}</div>
                      </div>
                      <div className={`text-2xl bg-gradient-to-br ${stat.color} text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg`}>
                        {stat.icon}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* OTHER PAGES (Placeholder) */}
          {/* ========================================== */}
          {activePage === 'events' && (
            <div className="text-center py-12 bg-white dark:bg-[#141424]/80 rounded-2xl border border-gray-200 dark:border-white/5">
              <p className="text-gray-500 dark:text-[#A1A1A1]">Events management page - Add your event management here</p>
            </div>
          )}

          {activePage === 'sermons' && (
            <div className="text-center py-12 bg-white dark:bg-[#141424]/80 rounded-2xl border border-gray-200 dark:border-white/5">
              <p className="text-gray-500 dark:text-[#A1A1A1]">Sermons management page - Add your sermon management here</p>
            </div>
          )}

          {activePage === 'announcements' && (
            <div className="text-center py-12 bg-white dark:bg-[#141424]/80 rounded-2xl border border-gray-200 dark:border-white/5">
              <p className="text-gray-500 dark:text-[#A1A1A1]">Announcements management page - Add your announcement management here</p>
            </div>
          )}

          {activePage === 'prayers' && (
            <div className="text-center py-12 bg-white dark:bg-[#141424]/80 rounded-2xl border border-gray-200 dark:border-white/5">
              <p className="text-gray-500 dark:text-[#A1A1A1]">Prayer requests management page - Add your prayer management here</p>
            </div>
          )}

          {activePage === 'attendees' && (
            <div className="text-center py-12 bg-white dark:bg-[#141424]/80 rounded-2xl border border-gray-200 dark:border-white/5">
              <p className="text-gray-500 dark:text-[#A1A1A1]">Attendees management page - Add your attendee management here</p>
            </div>
          )}

          {activePage === 'testimonials' && (
            <div className="text-center py-12 bg-white dark:bg-[#141424]/80 rounded-2xl border border-gray-200 dark:border-white/5">
              <p className="text-gray-500 dark:text-[#A1A1A1]">Testimonials management page - Add your testimonial management here</p>
            </div>
          )}

          {activePage === 'members' && (
            <div className="text-center py-12 bg-white dark:bg-[#141424]/80 rounded-2xl border border-gray-200 dark:border-white/5">
              <p className="text-gray-500 dark:text-[#A1A1A1]">Members management page - Add your member management here</p>
            </div>
          )}

          {activePage === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#141424]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                <h3 className="text-sm font-bold text-black dark:text-white mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-500" />
                  <span>System Settings</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/5">
                    <div className="text-xs font-bold text-gray-500 dark:text-[#A1A1A1] uppercase tracking-wider mb-1">Admin Credentials</div>
                    <div><span className="font-mono font-bold text-indigo-500 dark:text-indigo-400">admin</span> <span className="text-gray-400 mx-1">|</span> <span className="font-mono font-bold text-indigo-500 dark:text-indigo-400">admin123</span></div>
                  </div>
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/30">
                    <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-1">Database Summary</div>
                    <div className="grid grid-cols-2 gap-1 text-sm mt-2">
                      <p className="text-gray-600 dark:text-[#A1A1A1]">Events: <strong className="text-black dark:text-white">{events.length}</strong></p>
                      <p className="text-gray-600 dark:text-[#A1A1A1]">Sermons: <strong className="text-black dark:text-white">{sermons.length}</strong></p>
                      <p className="text-gray-600 dark:text-[#A1A1A1]">Announcements: <strong className="text-black dark:text-white">{announcements.length}</strong></p>
                      <p className="text-gray-600 dark:text-[#A1A1A1]">Prayers: <strong className="text-black dark:text-white">{prayers.length}</strong></p>
                      <p className="text-gray-600 dark:text-[#A1A1A1]">Attendees: <strong className="text-black dark:text-white">{attendees.length}</strong></p>
                      <p className="text-gray-600 dark:text-[#A1A1A1]">Members: <strong className="text-black dark:text-white">{members.length}</strong></p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={onResetData}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset All Data
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ========================================== */}
        {/* CSS ANIMATIONS */}
        {/* ========================================== */}
        <style>{`
          @keyframes slideInToast {
            from { opacity: 0; transform: translateX(80px) scale(0.9); }
            to { opacity: 1; transform: translateX(0) scale(1); }
          }
          .animate-slideInToast {
            animation: slideInToast 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          }
        `}</style>
      </div>
    </div>
  );
};