import React, { useEffect, useState } from 'react';
import {
  Users, CalendarDays, BookOpen, Heart, ArrowRight, ArrowUpRight,
  MapPin, Clock, Megaphone, ChevronDown, Pencil, Plus
} from 'lucide-react';
import { EditDrawer } from './EditDrawer';
import { collections, todayDisplay } from '../config';
import type { Field } from './ManagePage';
import type { Announcement, ChurchEvent, Collection, SiteSetting, Verse } from '../types';

// ============ STATIC TEXT (gaya mismo ng website, may fallback) ============
const SETTING_FALLBACKS: Record<string, string> = {
  heroHeading1: 'Your home in faith,',
  heroHeading2: 'hope and love.',
  heroImage: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=2000&q=80',
  marqueeLine1: 'WELCOME',
  marqueeLine2: 'Gospel Fellowship Church',
  prayerTitle1: 'Facing a burden?',
  prayerTitle2: 'Tell us.',
  prayerText: 'Share a prayer request with our church family. No request is too small or too big for the Lord.',
  visitAddress: "008 National Road SF. 2 Purok 1, Limay, Bataan. Come as you are — we can't wait to meet you.",
  giveBlurb: 'Your tithes and offerings help us continue sharing the Gospel in Limay and beyond.'
};
const SETTING_LABELS: Record<string, string> = {
  heroHeading1: 'Headline — Line 1',
  heroHeading2: 'Headline — Line 2 (italic)',
  heroImage: 'Hero Background Image URL',
  marqueeLine1: 'Marquee — Line 1',
  marqueeLine2: 'Marquee — Line 2',
  prayerTitle1: 'Prayer Band Title — Part 1',
  prayerTitle2: 'Prayer Band Title — Part 2 (italic)',
  prayerText: 'Prayer Band Text',
  visitAddress: 'Visit Teaser Address',
  giveBlurb: 'Give Teaser Text'
};

// ============ VERSE OF THE DAY fallback (kapareho ng website) ============
const FALLBACK_VERSES = [
  { text: 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.', ref: 'Jeremiah 29:11' },
  { text: 'I can do all things through Christ who strengthens me.', ref: 'Philippians 4:13' },
  { text: 'Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.', ref: 'Proverbs 3:5-6' },
  { text: 'The Lord is my shepherd; I shall not want.', ref: 'Psalm 23:1' },
  { text: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.', ref: 'John 3:16' },
  { text: 'Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.', ref: 'Joshua 1:9' },
  { text: 'The Lord is close to the brokenhearted and saves those who are crushed in spirit.', ref: 'Psalm 34:18' },
  { text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.', ref: 'Philippians 4:6' },
  { text: 'He gives strength to the weary and increases the power of the weak.', ref: 'Isaiah 40:29' },
  { text: 'Therefore encourage one another and build each other up, just as in fact you are doing.', ref: '1 Thessalonians 5:11' }
];
const dayOfYear = (): number => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
};
const getTodayVerse = () => FALLBACK_VERSES[dayOfYear() % FALLBACK_VERSES.length];

// ============ FIELDS (reuse sa admin config) ============
const eventsFields: Field[] = collections.find(c => c.key === 'events')?.fields || [];
const announcementFields: Field[] = [
  ...(collections.find(c => c.key === 'announcements')?.fields || []),
  { name: 'image', label: 'Image URL', placeholder: 'https://... or blank' },
  { name: 'isPinned', label: 'Pinned?', placeholder: 'type "true" para ma-pin' }
];
const verseFields: Field[] = collections.find(c => c.key === 'verses')?.fields || [];

const toForm = (record: unknown, fields: Field[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const f of fields) out[f.name] = String((record as Record<string, unknown>)?.[f.name] ?? '');
  return out;
};

// ============ EDITABLE WRAPPER (naka-hover lang -> may lalabas na edit) ============
function Editable({
  onClick, chip = 'Edit', children, className = '', chipPosition = 'right-2 top-2', fill = false
}: {
  onClick: () => void;
  chip?: string;
  children: React.ReactNode;
  className?: string;
  chipPosition?: string;
  fill?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      title="Click to edit"
      className={`group relative cursor-pointer transition-all ${
        fill ? 'absolute inset-0 overflow-hidden' : 'hover:z-10'
      } ${className}`}
    >
      {children}
      <span className={`pointer-events-none absolute z-20 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 text-white shadow-lg text-[11px] font-bold px-2.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity ${chipPosition}`}>
        <Pencil className="w-3 h-3" /> {chip}
      </span>
    </div>
  );
}

const directionsUrl =
  'https://www.google.com/maps/place/The+GOSPEL+FELLOWSHIP+CHURCH/@14.5704036,120.593831,17a,75y,37.02h,95.15t/data=!3m7!1e1!3m5!1sCDu7Ag3FdMxDoJ-Gn1eCHg!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D-5.151389058547025%26panoid%3DCDu7Ag3FdMxDoJ-Gn1eCHg%26yaw%3D37.019568306389516!7i16384!8i8192!4m6!3m5!1s0x33963c3c526760cd:0x94fbb15c37673676!8m2!3d14.5704469!4d120.5938904!16s%2Fg%2F11w2_p47g1';

const schedule = [
  { name: 'Sunday Worship', time: '8:30 AM', day: 'Sunday' },
  { name: 'Prayer Meeting', time: '7:00 PM', day: 'Monday' },
  { name: 'Worship Night', time: '7:00 PM', day: 'Friday' },
  { name: 'Next Gen Youth', time: '7:00 PM', day: 'Sunday' }
];

const journeyTiles = [
  { to: 'about', icon: <Users className="w-6 h-6" />, title: 'Who We Are', text: 'Our mission, vision, ministries and leaders.', cta: 'About GFC' },
  { to: 'events', icon: <CalendarDays className="w-6 h-6" />, title: 'Events & Schedule', text: 'Weekly services and photo albums from gatherings.', cta: 'See Events' },
  { to: 'verses', icon: <BookOpen className="w-6 h-6" />, title: 'Verse of the Day', text: 'A daily word from the Lord to keep close.', cta: 'Read Today' },
  { to: 'prayers', icon: <Heart className="w-6 h-6" />, title: 'Prayer Requests', text: 'Share a request with our prayer team.', cta: 'Pray With Us' }
];

const eventPhoto = (ev: ChurchEvent): string =>
  ev.image || 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=900&q=80';

type Editor =
  | { kind: 'event'; id: string; record: ChurchEvent; values: Record<string, string> }
  | { kind: 'new-event'; values: Record<string, string> }
  | { kind: 'announcement'; id: string; record: Announcement; values: Record<string, string> }
  | { kind: 'new-announcement'; values: Record<string, string> }
  | { kind: 'verse'; id: string; record: Verse; values: Record<string, string> }
  | { kind: 'new-verse'; values: Record<string, string> }
  | { kind: 'settings'; title: string; subtitle: string; keys: string[]; fields: Field[]; values: Record<string, string> }
  | null;

interface AdminHomePreviewProps {
  events: ChurchEvent[];
  announcements: Announcement[];
  verses: Verse[];
  settings: SiteSetting[];
  getSetting: (key: string, fallback: string) => string;
  onUpdate: (collection: Collection, id: string, record: unknown) => void;
  onCreate: (collection: Collection, record: unknown) => void;
  onDelete: (collection: Collection, id: string) => void;
  onSaveSetting: (key: string, value: string) => void;
  onNavigate: (page: string) => void;
}

export const AdminHomePreview: React.FC<AdminHomePreviewProps> = ({
  events, announcements, verses, getSetting, onUpdate, onCreate, onDelete, onSaveSetting, onNavigate
}) => {
  const [editor, setEditor] = useState<Editor>(null);

  const setValue = (name: string, value: string) =>
    setEditor(prev => (prev ? { ...prev, values: { ...prev.values, [name]: value } } : prev));

  // ============ CLICK HANDLERS ============
  const openEvent = (record: ChurchEvent) =>
    setEditor({ kind: 'event', id: record.id, record, values: toForm(record, eventsFields) });
  const openNewEvent = () => setEditor({ kind: 'new-event', values: toForm({}, eventsFields) });
  const openAnnouncement = (record: Announcement) =>
    setEditor({ kind: 'announcement', id: record.id, record, values: toForm(record, announcementFields) });
  const openNewAnnouncement = () => setEditor({ kind: 'new-announcement', values: toForm({}, announcementFields) });
  const openVerse = (record: Verse) =>
    setEditor({ kind: 'verse', id: record.id, record, values: toForm(record, verseFields) });
  const openNewVerse = () => setEditor({ kind: 'new-verse', values: toForm({}, verseFields) });
  const openSettings = (keys: string[], title: string, subtitle: string) =>
    setEditor({
      kind: 'settings', title, subtitle, keys,
      fields: keys.map(k => ({
        name: k,
        label: SETTING_LABELS[k] || k,
        type: ['prayerText', 'visitAddress', 'giveBlurb'].includes(k) ? 'textarea' : 'text',
        placeholder: SETTING_FALLBACKS[k],
        full: true
      })),
      values: Object.fromEntries(keys.map(k => [k, getSetting(k, SETTING_FALLBACKS[k])]))
    });

  // ============ SAVE / DELETE ============
  const handleSave = (values: Record<string, string>) => {
    if (!editor) return;
    if (editor.kind === 'settings') {
      for (const key of editor.keys) onSaveSetting(key, (values[key] ?? '').trim());
      setEditor(null);
      return;
    }
    if (editor.kind === 'event') {
      const r = editor.record;
      onUpdate('events', editor.id, {
        ...r,
        title: values.title || r.title,
        date: values.date || r.date,
        tag: values.tag || r.tag,
        description: values.description || r.description,
        location: values.location || '',
        image: values.image || undefined
      });
    } else if (editor.kind === 'new-event') {
      onCreate('events', {
        id: `event-${Date.now()}`, title: values.title, date: values.date, tag: values.tag,
        description: values.description || 'Everyone is invited!',
        location: values.location || '📍 Gospel Fellowship Church, Limay, Bataan',
        image: values.image || undefined
      });
    } else if (editor.kind === 'announcement') {
      const r = editor.record;
      onUpdate('announcements', editor.id, {
        ...r,
        title: values.title || r.title,
        details: values.details || r.details,
        category: values.category || r.category || 'General',
        image: values.image || undefined,
        isPinned: values.isPinned === 'true'
      });
    } else if (editor.kind === 'new-announcement') {
      onCreate('announcements', {
        id: `ann-${Date.now()}`, title: values.title, details: values.details, date: todayDisplay,
        category: values.category || 'General', image: values.image || undefined,
        isPinned: values.isPinned === 'true'
      });
    } else if (editor.kind === 'verse') {
      onUpdate('verses', editor.id, { ...editor.record, text: values.text, ref: values.ref });
    } else if (editor.kind === 'new-verse') {
      onCreate('verses', { id: `verse-${Date.now()}`, text: values.text, ref: values.ref });
    }
    setEditor(null);
  };

  const handleDelete = () => {
    if (!editor) return;
    if (editor.kind === 'event') onDelete('events', editor.id);
    else if (editor.kind === 'announcement') onDelete('announcements', editor.id);
    else if (editor.kind === 'verse') onDelete('verses', editor.id);
    setEditor(null);
  };

  // ============ COUNTDOWN (kapareho ng website) ============
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const setDays = (d: number) => setTimeLeft(prev => ({ ...prev, days: d }));
    const setHours = (h: number) => setTimeLeft(prev => ({ ...prev, hours: h }));
    const setMinutes = (m: number) => setTimeLeft(prev => ({ ...prev, minutes: m }));
    const setSeconds = (s: number) => setTimeLeft(prev => ({ ...prev, seconds: s }));

    const calculateCountdown = () => {
      const now = new Date();
      const nextSunday = new Date();
      const daysUntilSunday = (7 - now.getDay()) % 7;
      nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 && now.getHours() >= 12 ? 7 : daysUntilSunday));
      nextSunday.setHours(8, 30, 0, 0);
      const diff = nextSunday.getTime() - now.getTime();
      if (diff > 0) {
        setDays(Math.floor(diff / (1000 * 60 * 60 * 24)));
        setHours(Math.floor((diff / (1000 * 60 * 60)) % 24));
        setMinutes(Math.floor((diff / 1000 / 60) % 60));
        setSeconds(Math.floor((diff / 1000) % 60));
      }
    };
    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const [serviceOpen, setServiceOpen] = useState(false);
  const featured = events.filter(ev => ev.date).slice(0, 3);
  const visibleAnnouncements = announcements.slice(0, 3);
  const todayVerse = verses[0] ?? getTodayVerse();
  const S = (key: string) => getSetting(key, SETTING_FALLBACKS[key]);
  const countdownUnits = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Mins' },
    { value: timeLeft.seconds, label: 'Secs' }
  ];

  // ============ DRAWER ============
  let drawerProps: Omit<React.ComponentProps<typeof EditDrawer>, 'open'> | null = null;
  if (editor) {
    if (editor.kind === 'settings') {
      drawerProps = {
        title: `✏️ ${editor.title}`,
        subtitle: editor.subtitle,
        fields: editor.fields,
        values: editor.values,
        onValue: setValue,
        onSave: handleSave,
        onCancel: () => setEditor(null)
      };
    } else if (editor.kind === 'event' || editor.kind === 'new-event') {
      drawerProps = {
        title: editor.kind === 'event' ? '✏️ Edit Event' : '➕ Add Event',
        subtitle: editor.kind === 'event' ? editor.record.title : 'Lalabas ito sa featured events ng Home page.',
        fields: eventsFields,
        values: editor.values,
        onValue: setValue,
        onSave: handleSave,
        onCancel: () => setEditor(null),
        onDelete: editor.kind === 'event' ? handleDelete : undefined
      };
    } else if (editor.kind === 'announcement' || editor.kind === 'new-announcement') {
      drawerProps = {
        title: editor.kind === 'announcement' ? '✏️ Edit Announcement' : '➕ Add Announcement',
        subtitle: editor.kind === 'announcement' ? editor.record.title : 'Lalabas ito sa Announcements ng Home page.',
        fields: announcementFields,
        values: editor.values,
        onValue: setValue,
        onSave: handleSave,
        onCancel: () => setEditor(null),
        onDelete: editor.kind === 'announcement' ? handleDelete : undefined
      };
    } else {
      drawerProps = {
        title: editor.kind === 'verse' ? '✏️ Edit Verse of the Day' : '➕ Add Verse of the Day',
        subtitle: editor.kind === 'verse' ? editor.record.ref : 'Ang unang verse ang lalabas bilang Verse of the Day.',
        fields: verseFields,
        values: editor.values,
        onValue: setValue,
        onSave: handleSave,
        onCancel: () => setEditor(null),
        onDelete: editor.kind === 'verse' ? handleDelete : undefined
      };
    }
  }

  return (
    <main className="w-full">
      {/* ============ HERO (100% kapareho ng website) ============ */}
      <section id="homeSection" className="relative w-full">
        <div className="relative w-full min-h-[90vh] flex items-center bg-[#0f1a2e]">
          {/* Background image — full width, naka-absolute */}
          <div className="absolute inset-0 overflow-hidden">
            <Editable
              onClick={() => openSettings(['heroImage'], 'Hero Background Image', 'Ang background image ng hero ng Home page.')}
              chip="Edit Image"
              chipPosition="right-4 top-4"
              fill
              className="w-full h-full"
            >
              <img
                src={S('heroImage')}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover animate-kenburns"
              />
            </Editable>
          </div>

          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f1a2e]/95 via-[#0f1a2e]/80 to-[#0f1a2e]/55" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1a2e] via-transparent to-[#0f1a2e]/40" />

          {/* Content — naka-center */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-32 pb-60 sm:pb-48 text-center">
            <div className="max-w-3xl mx-auto space-y-7">
              {/* Eyebrow */}
              <div
                className="inline-flex items-center gap-2.5 animate-fadeUp"
                style={{ animationDelay: '0.1s' }}
              >
              </div>

              {/* Headline */}
              <Editable
                onClick={() => openSettings(['heroHeading1', 'heroHeading2'], 'Hero Headline', 'Ang malaking text sa itaas ng Home page.')}
                chip="Edit Headline"
              >
                <h1
                  className="text-4xl sm:text-6xl lg:text-7xl font-serif text-white tracking-tight leading-[1.05] animate-fadeUp"
                  style={{ animationDelay: '0.25s' }}
                >
                  {S('heroHeading1')}
                  <br />
                  <span className="italic text-indigo-400">{S('heroHeading2')}</span>
                </h1>
              </Editable>

              {/* Primary CTAs */}
              <div
                className="flex flex-wrap items-center justify-center gap-2.5 pt-2 animate-fadeUp sm:gap-3.5"
                style={{ animationDelay: '0.55s' }}
              >
                <button
                  onClick={() => onNavigate('contact')}
                  className="group inline-flex items-center gap-2 px-3.5 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm sm:px-7 sm:py-4 sm:gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-lg shadow-black/20"
                >
                  Plan a Visit
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1 sm:w-4.5 sm:h-4.5" />
                </button>

                <button
                  onClick={() => onNavigate('events')}
                  className="inline-flex items-center gap-2 px-3.5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm sm:px-7 sm:py-4 sm:gap-2.5 border border-white/25 backdrop-blur-sm transition-all duration-300 active:scale-[0.98]"
                >
                  <CalendarDays className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                  Upcoming Events
                </button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="absolute bottom-5 left-0 right-0 z-10 px-4 sm:px-8 animate-fadeUp"
            style={{ animationDelay: '0.7s' }}
          >
            <div className="relative flex flex-col items-center justify-center gap-3">
              {/* Service + Get Directions */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {/* Service dropdown */}
              <div className="group">
                <button
                  type="button"
                  onClick={() => setServiceOpen(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-[10px] sm:text-base sm:px-7 sm:py-4 sm:gap-2.5 border border-white/25 backdrop-blur-sm transition-all duration-300 active:scale-[0.98]"
                >
                  Service
                  <ChevronDown
                    className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300 ${serviceOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <div
                  className={`absolute left-1/2 -translate-x-1/2 top-full mt-3 w-60 rounded-2xl border border-white/25 bg-[#0f172a]/90 p-1.5 backdrop-blur-xl shadow-2xl shadow-black/40 transition-all duration-200 ${
                    serviceOpen
                      ? 'opacity-100 translate-y-0 pointer-events-auto'
                      : 'opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto'
                  }`}
                >
                  <div className="px-3 pb-1 pt-2 text-left text-[9px] font-bold uppercase tracking-[0.25em] text-white/50">
                    Service Times
                  </div>
                  {schedule.map(item => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => onNavigate('events')}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-white/10 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[9px] font-bold uppercase">
                          {item.day.slice(0, 3)}
                        </span>
                        <span className="text-xs font-semibold text-white">{item.name}</span>
                      </span>
                      <span className="text-xs font-bold text-indigo-300">{item.time}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Get Directions */}
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1.5 px-2.5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] sm:text-base sm:px-7 sm:py-4 sm:gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-lg shadow-black/20"
              >
                Get Directions
                <ArrowRight className="w-3 h-3 sm:w-4.5 sm:h-4.5 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
              </div>

              {/* Next Service countdown */}
              <div className="flex max-w-full items-center justify-center gap-x-2 px-2.5 py-2 sm:gap-x-4 sm:px-5 sm:py-3 rounded-full bg-white/10 border border-white/25 backdrop-blur-sm">
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-300 bg-indigo-500/25 px-3 py-1 rounded-full">
                  <Clock className="w-3 h-3" />
                  Sunday · 8:30 AM
                </span>
                <span className="hidden sm:block h-4 w-px bg-white/20" />
                <span className="flex items-center justify-center gap-2 sm:gap-3 text-white tabular-nums">
                  {countdownUnits.map(unit => (
                    <span key={unit.label} className="flex flex-col items-center leading-none gap-0.5 sm:flex-row sm:items-baseline sm:gap-1">
                      <span className="font-serif text-sm sm:text-xl font-semibold">
                        {String(unit.value).padStart(2, '0')}
                      </span>
                      <span className="text-[7px] uppercase tracking-widest text-white/50 sm:text-[10px]">
                        {unit.label}
                      </span>
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WELCOME ============ */}
      <section className="bg-white overflow-hidden">
        <Editable
          onClick={() => openSettings(['marqueeLine1', 'marqueeLine2'], 'Welcome Marquee', 'Ang malaking umiikot na text.')}
          chip="Edit Marquee"
          chipPosition="right-10 top-4"
          className="py-16 sm:py-20 overflow-hidden whitespace-nowrap group"
        >
          <div className="flex w-max animate-marquee-left group-hover:[animation-play-state:paused]">
            {[0, 4].map(group => (
              <div key={group} className="flex shrink-0" aria-hidden={group === 1}>

                {/* SOLID VERSION (Itim na buo) */}
                <div className="shrink-0 px-6 sm:px-10 flex flex-col justify-center items-center space-y-2">
                  <span className="block font-heading font-black leading-none tracking-tighter text-6xl sm:text-4xl lg:text-4xl text-black uppercase">
                    {S('marqueeLine1')}
                  </span>
                  <span className="block font-heading font-bold leading-none tracking-tight text-xl sm:text-4xl lg:text-4xl text-black uppercase">
                    {S('marqueeLine2')}
                  </span>
                </div>

                {/* OUTLINE VERSION - manipis na stroke */}
                <div className="shrink-0 px-6 sm:px-10 flex flex-col justify-center items-center space-y-2">
                  <span className="block font-heading font-normal leading-none tracking-tighter text-6xl sm:text-4xl lg:text-4xl text-transparent uppercase [-webkit-text-stroke:1px_black]">
                    {S('marqueeLine1')}
                  </span>
                  <span className="block font-heading font-normal leading-none tracking-tight text-xl sm:text-4xl lg:text-4xl text-transparent uppercase [-webkit-text-stroke:1px_black]">
                    {S('marqueeLine2')}
                  </span>
                </div>

              </div>
            ))}
          </div>
        </Editable>
      </section>

      {/* ============ JOURNEY TILES ============ */}
      <section className="bg-slate-50">
        <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {journeyTiles.map(tile => (
            <button
              key={tile.to}
              onClick={() => onNavigate(tile.to)}
              className="group bg-white rounded-2xl border border-slate-200 p-7 text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-28px_rgba(15,23,42,0.28)] hover:border-indigo-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0f172a] text-indigo-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                {tile.icon}
              </div>
              <h3 className="mt-5 font-serif text-xl text-[#0f172a]">{tile.title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{tile.text}</p>
              <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-indigo-600">
                {tile.cta}
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </button>
          ))}
        </div>
        </div>
      </section>

      {/* ============ VERSE OF THE DAY BAND ============ */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-20">
        <div className="bg-[#0f172a] rounded-3xl px-8 py-14 sm:px-14 relative overflow-hidden text-center">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/[0.03] pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-indigo-500/[0.07] pointer-events-none" />

          <div className="relative mx-auto max-w-3xl space-y-6">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-400">
              <BookOpen className="w-4 h-4" />
              Verse of the Day
            </span>
            {verses[0] ? (
              <Editable onClick={() => openVerse(verses[0])} chip="Edit Verse">
                <p className="font-serif text-2xl sm:text-3xl italic leading-relaxed text-white/95">
                  "{todayVerse.text}"
                </p>
                <p className="text-sm font-bold text-indigo-400 tracking-wide">— {todayVerse.ref}</p>
              </Editable>
            ) : (
              <Editable onClick={openNewVerse} chip="Add Verse">
                <p className="font-serif text-2xl sm:text-3xl italic leading-relaxed text-white/95">
                  "{todayVerse.text}"
                </p>
                <p className="text-sm font-bold text-indigo-400 tracking-wide">— {todayVerse.ref}</p>
              </Editable>
            )}
            <button
              onClick={() => onNavigate('verses')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-all duration-300"
            >
              Read More from the Word
              <ArrowUpRight className="w-4 h-4 text-indigo-400" />
            </button>
          </div>
        </div>
      </section>

      {/* ============ FEATURED EVENTS ============ */}
      <section className="bg-indigo-50/50">
        <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-600">
              Gatherings
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif text-[#0f172a] tracking-tight">
              Upcoming events
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={openNewEvent}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-white rounded-full px-4 py-2 border border-indigo-200 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Event
            </button>
            <button
              onClick={() => onNavigate('events')}
              className="group inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              View All Events
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-12 bg-white rounded-2xl border border-slate-200">
              <p className="text-slate-500">No upcoming events yet. Check back soon.</p>
            </div>
          ) : (
            featured.map(ev => (
              <Editable
                key={ev.id}
                onClick={() => openEvent(ev)}
                chip="Edit Event"
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-28px_rgba(15,23,42,0.25)] hover:border-indigo-300"
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={eventPhoto(ev)}
                    alt={ev.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/60 via-transparent to-transparent opacity-70" />
                  <span className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3.5 py-1.5 rounded-full text-xs font-bold text-[#0f172a] shadow-sm">
                    {ev.tag}
                  </span>
                </div>
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-widest">
                    <Clock className="w-3.5 h-3.5" />
                    {ev.date}
                  </div>
                  <h3 className="font-serif text-xl text-[#0f172a] group-hover:text-indigo-700 transition-colors">
                    {ev.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{ev.description}</p>
                </div>
              </Editable>
            ))
          )}
        </div>
        </div>
      </section>

      {/* ============ ANNOUNCEMENTS ============ */}
      {visibleAnnouncements.length > 0 && (
        <section className="bg-slate-50">
          <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-600">
                <Megaphone className="w-4 h-4" />
                Announcements
              </span>
              <h2 className="text-3xl sm:text-4xl font-serif text-[#0f172a] tracking-tight">
                What's new at GFC
              </h2>
            </div>
            <button
              onClick={openNewAnnouncement}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-white rounded-full px-4 py-2 border border-indigo-200 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Announcement
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {visibleAnnouncements.map(a => (
              <Editable
                key={a.id}
                onClick={() => openAnnouncement(a)}
                chip="Edit"
                className="bg-white rounded-2xl border border-slate-200 p-7 space-y-3 transition-colors duration-300 hover:border-indigo-300"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-indigo-600">
                  {a.category || 'Announcement'}
                  {a.isPinned && <span className="text-indigo-600">· Pinned</span>}
                </div>
                <h3 className="font-serif text-lg text-[#0f172a]">{a.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{a.details}</p>
                {a.date && <p className="text-xs text-slate-400 pt-1">{a.date}</p>}
              </Editable>
            ))}
          </div>
          </div>
        </section>
      )}

      {/* ============ PRAYER CTA BAND ============ */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-20">
        <div className="rounded-3xl overflow-hidden relative">
          <img
            src="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1800&q=80"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f1a2e]/95 via-[#0f1a2e]/85 to-[#0f1a2e]/70" />

          <div className="relative z-10 px-8 py-16 sm:px-14 sm:py-20 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <Editable
              onClick={() => openSettings(['prayerTitle1', 'prayerTitle2', 'prayerText'], 'Prayer Band', 'Ang section na "We\'re praying with you" sa Home page.')}
              chip="Edit Text"
              chipPosition="right-8 top-8"
              className="space-y-4 max-w-xl"
            >
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-400">
                <Heart className="w-4 h-4 fill-current" />
                We're praying with you
              </span>
              <h2 className="text-3xl sm:text-4xl font-serif text-white tracking-tight leading-tight">
                {S('prayerTitle1')} <span className="italic text-indigo-400">{S('prayerTitle2')}</span>
              </h2>
              <p className="text-white/75 text-sm sm:text-base leading-relaxed">
                {S('prayerText')}
              </p>
            </Editable>
            <button
              onClick={() => onNavigate('prayers')}
              className="group inline-flex items-center gap-2.5 px-7 py-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base transition-all duration-300 active:scale-[0.98] shadow-lg shadow-black/20 shrink-0"
            >
              Submit a Prayer Request
              <ArrowRight className="w-4.5 h-4.5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* ============ VISIT TEASER ============ */}
      <section className="bg-indigo-50/40">
        <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Editable
            onClick={() => openSettings(['visitAddress'], 'Where to Find Us', 'Ang address na nakikita sa Visit teaser.')}
            chip="Edit Address"
            className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#0f172a] text-indigo-400 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="font-serif text-xl text-[#0f172a]">Where to find us</h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              {S('visitAddress')}
            </p>
            <div className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
              Get Directions & Register
              <ArrowRight className="w-4 h-4" />
            </div>
          </Editable>

          <div className="bg-[#0f172a] rounded-2xl p-8 space-y-4 text-white">
            <Editable
              onClick={() => openSettings(['giveBlurb'], 'Bless the Church', 'Ang text ng Give teaser (tithes & offering).')}
              chip="Edit Text"
              chipPosition="right-6 top-6"
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-400 flex items-center justify-center">
                  <Heart className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl">Bless the church</h3>
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                {S('giveBlurb')}
              </p>
            </Editable>
            <button
              onClick={() => onNavigate('giveInfo')}
              className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-white transition-colors"
            >
              Give Tithes & Offering
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>
      </section>

      {drawerProps && (
        <EditDrawer
          open={true}
          title={drawerProps.title}
          subtitle={drawerProps.subtitle}
          fields={drawerProps.fields}
          values={drawerProps.values}
          onValue={drawerProps.onValue}
          onSave={drawerProps.onSave}
          onCancel={drawerProps.onCancel}
          onDelete={drawerProps.onDelete}
        />
      )}
    </main>
    );
};