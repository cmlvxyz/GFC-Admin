import React, { useEffect, useState, useRef } from 'react';
import {
  Users, CalendarDays, BookOpen, Heart, ArrowRight, ArrowUpRight,
  MapPin, Clock, Megaphone, ChevronDown, Pencil, Plus, Upload, X, Type, Palette, Image as ImageIcon
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
  marqueeImageSolid: '/solid.png',
  marqueeImageOutline: '/outline.png',
  marqueeBgColor: '#ffffff',
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
  marqueeImageSolid: 'Marquee Image — Solid',
  marqueeImageOutline: 'Marquee Image — Outline',
  marqueeBgColor: 'Marquee Background Color',
  prayerTitle1: 'Prayer Band Title — Part 1',
  prayerTitle2: 'Prayer Band Title — Part 2 (italic)',
  prayerText: 'Prayer Band Text',
  visitAddress: 'Visit Teaser Address',
  giveBlurb: 'Give Teaser Text'
};

// ============ VERSE OF THE DAY fallback ============
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

// ============ FIELDS ============
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

// ============ EDITABLE WRAPPER ============
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

// ============ UNIVERSAL EDIT MODAL ============
interface UniversalField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'font' | 'size' | 'weight' | 'image' | 'background';
}

function UniversalEditModal({
  title,
  subtitle,
  fields,
  values,
  onChange,
  onSave,
  onCancel,
}: {
  title: string;
  subtitle: string;
  fields: UniversalField[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const fonts = ['Inter', 'Poppins', 'Montserrat', 'Playfair Display', 'Georgia', 'Arial', 'serif', 'sans-serif'];
  const sizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl', 'text-7xl'];
  const weights = ['font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-black'];
  const colors = ['#000000', '#ffffff', '#4f46e5', '#dc2626', '#16a34a', '#f59e0b', '#ec4899', '#0f172a', '#f1f5f9', '#64748b'];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      onChange(key, result);
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = (key: string) => {
    setUploadTarget(key);
    fileInputRef.current?.click();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="font-serif text-lg text-[#0f172a]">✏️ {title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                {f.label}
              </label>

              {/* TEXT */}
              {f.type === 'text' && (
                <input
                  type="text"
                  value={values[f.key] || ''}
                  onChange={e => onChange(f.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                />
              )}

              {/* TEXTAREA */}
              {f.type === 'textarea' && (
                <textarea
                  rows={3}
                  value={values[f.key] || ''}
                  onChange={e => onChange(f.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                />
              )}

              {/* COLOR — circles + custom */}
              {f.type === 'color' && (
                <div className="flex flex-wrap items-center gap-2">
                  {colors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChange(f.key, c)}
                      className={`w-9 h-9 rounded-full border-2 transition-all ${
                        values[f.key] === c ? 'border-indigo-600 scale-110' : 'border-slate-200 hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={values[f.key] || '#000000'}
                    onChange={e => onChange(f.key, e.target.value)}
                    className="w-9 h-9 rounded-full cursor-pointer border-2 border-slate-200"
                  />
                </div>
              )}

              {/* FONT */}
              {f.type === 'font' && (
                <select
                  value={values[f.key] || 'Inter'}
                  onChange={e => onChange(f.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {fonts.map(font => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
              )}

              {/* SIZE */}
              {f.type === 'size' && (
                <select
                  value={values[f.key] || 'text-4xl'}
                  onChange={e => onChange(f.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {sizes.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              {/* WEIGHT */}
              {f.type === 'weight' && (
                <select
                  value={values[f.key] || 'font-bold'}
                  onChange={e => onChange(f.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {weights.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              )}

              {/* IMAGE — URL + upload */}
              {f.type === 'image' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={values[f.key] || ''}
                    onChange={e => onChange(f.key, e.target.value)}
                    placeholder="https://... o /solid.png"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => triggerUpload(f.key)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload from device
                    </button>
                  </div>
                  {values[f.key] && (
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <img src={values[f.key]} alt="Preview" className="w-full h-24 object-cover" />
                    </div>
                  )}
                </div>
              )}

              {/* BACKGROUND — color circles + custom + upload */}
              {f.type === 'background' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {colors.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onChange(f.key, c)}
                        className={`w-9 h-9 rounded-full border-2 transition-all ${
                          values[f.key] === c ? 'border-indigo-600 scale-110' : 'border-slate-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={values[f.key]?.startsWith('#') ? values[f.key] : '#ffffff'}
                      onChange={e => onChange(f.key, e.target.value)}
                      className="w-9 h-9 rounded-full cursor-pointer border-2 border-slate-200"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => triggerUpload(f.key)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload image
                    </button>
                  </div>
                  {values[f.key] && values[f.key].startsWith('data:image') && (
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <img src={values[f.key]} alt="Preview" className="w-full h-24 object-cover" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm"
          >
            Save
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            if (uploadTarget) handleFileUpload(e, uploadTarget);
          }}
        />
      </div>
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
  | { kind: 'universal'; title: string; subtitle: string; fields: UniversalField[]; keys: string[]; values: Record<string, string> }
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

  // ============ UNIVERSAL EDIT HANDLER ============
  const openUniversal = (
    title: string,
    subtitle: string,
    fields: UniversalField[],
    initialKeys: string[]
  ) => {
    setEditor({
      kind: 'universal',
      title,
      subtitle,
      fields,
      keys: initialKeys,
      values: Object.fromEntries(initialKeys.map(k => [k, getSetting(k, SETTING_FALLBACKS[k] ?? '')]))
    });
  };

  // ============ SAVE / DELETE ============
  const handleSave = (values: Record<string, string>) => {
    if (!editor) return;
    if (editor.kind === 'universal') {
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

  // ============ COUNTDOWN ============
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

  // ============ DRAWER (events, announcements, verses) ============
  let drawerProps: Omit<React.ComponentProps<typeof EditDrawer>, 'open'> | null = null;
  if (editor) {
    if (editor.kind === 'event' || editor.kind === 'new-event') {
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
    } else if (editor.kind === 'verse' || editor.kind === 'new-verse') {
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
      {/* ============ HERO ============ */}
      <section id="homeSection" className="relative w-full">
        <div className="relative w-full min-h-[90vh] flex items-center bg-[#0f1a2e]">
          <div className="absolute inset-0 overflow-hidden">
            <Editable
              onClick={() => openUniversal(
                'Hero Background Image',
                'Ang background image ng hero. Pwede URL o upload.',
                [{ key: 'heroImage', label: 'Background Image', type: 'image' }],
                ['heroImage']
              )}
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

          <div className="absolute inset-0 bg-gradient-to-br from-[#0f1a2e]/95 via-[#0f1a2e]/80 to-[#0f1a2e]/55" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1a2e] via-transparent to-[#0f1a2e]/40" />

          <div className="relative z-10 w-full max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-32 pb-60 sm:pb-48 text-center">
            <div className="max-w-3xl mx-auto space-y-7">
              <Editable
                onClick={() => openUniversal(
                  'Hero Headline',
                  'I-edit ang headline, font, size, at color.',
                  [
                    { key: 'heroHeading1', label: 'Line 1', type: 'text' },
                    { key: 'heroHeading2', label: 'Line 2 (italic)', type: 'text' },
                    { key: 'heroHeadingFont', label: 'Font Family', type: 'font' },
                    { key: 'heroHeadingSize', label: 'Font Size', type: 'size' },
                    { key: 'heroHeadingColor', label: 'Text Color', type: 'color' }
                  ],
                  ['heroHeading1', 'heroHeading2', 'heroHeadingFont', 'heroHeadingSize', 'heroHeadingColor']
                )}
                chip="Edit Headline"
              >
                <h1
                  className={`${S('heroHeadingSize') || 'text-7xl'} text-white tracking-tight leading-[1.05] animate-fadeUp`}
                  style={{
                    fontFamily: S('heroHeadingFont') || 'serif',
                    color: S('heroHeadingColor') || '#ffffff',
                  }}
                >
                  {S('heroHeading1')}
                  <br />
                  <span className="italic text-indigo-400">{S('heroHeading2')}</span>
                </h1>
              </Editable>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 animate-fadeUp sm:gap-3.5">
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
          <div className="absolute bottom-5 left-0 right-0 z-10 px-4 sm:px-8 animate-fadeUp">
            <div className="relative flex flex-col items-center justify-center gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <div className="group">
                  <button
                    type="button"
                    onClick={() => setServiceOpen(prev => !prev)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-[10px] sm:text-base sm:px-7 sm:py-4 sm:gap-2.5 border border-white/25 backdrop-blur-sm transition-all duration-300 active:scale-[0.98]"
                  >
                    Service
                    <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-300 ${serviceOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`absolute left-1/2 -translate-x-1/2 top-full mt-3 w-60 rounded-2xl border border-white/25 bg-[#0f172a]/90 p-1.5 backdrop-blur-xl shadow-2xl shadow-black/40 transition-all duration-200 ${serviceOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto'}`}>
                    <div className="px-3 pb-1 pt-2 text-left text-[9px] font-bold uppercase tracking-[0.25em] text-white/50">Service Times</div>
                    {schedule.map(item => (
                      <button key={item.name} type="button" onClick={() => onNavigate('events')} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-white/10 transition-colors">
                        <span className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-indigo-500/30 text-indigo-300 flex items-center justify-center text-[9px] font-bold uppercase">{item.day.slice(0, 3)}</span>
                          <span className="text-xs font-semibold text-white">{item.name}</span>
                        </span>
                        <span className="text-xs font-bold text-indigo-300">{item.time}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 px-2.5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] sm:text-base sm:px-7 sm:py-4 sm:gap-2.5 transition-all duration-300 active:scale-[0.98] shadow-lg shadow-black/20">
                  Get Directions
                  <ArrowRight className="w-3 h-3 sm:w-4.5 sm:h-4.5 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </div>
              <div className="flex max-w-full items-center justify-center gap-x-2 px-2.5 py-2 sm:gap-x-4 sm:px-5 sm:py-3 rounded-full bg-white/10 border border-white/25 backdrop-blur-sm">
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-indigo-300 bg-indigo-500/25 px-3 py-1 rounded-full">
                  <Clock className="w-3 h-3" />
                  Sunday · 8:30 AM
                </span>
                <span className="hidden sm:block h-4 w-px bg-white/20" />
                <span className="flex items-center justify-center gap-2 sm:gap-3 text-white tabular-nums">
                  {countdownUnits.map(unit => (
                    <span key={unit.label} className="flex flex-col items-center leading-none gap-0.5 sm:flex-row sm:items-baseline sm:gap-1">
                      <span className="font-serif text-sm sm:text-xl font-semibold">{String(unit.value).padStart(2, '0')}</span>
                      <span className="text-[7px] uppercase tracking-widest text-white/50 sm:text-[10px]">{unit.label}</span>
                    </span>
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WELCOME ============ */}
      <section
        className="overflow-hidden"
        style={{
          backgroundColor: S('marqueeBgColor') || '#ffffff',
          backgroundImage: S('marqueeBgColor')?.startsWith('data:image') ? `url(${S('marqueeBgColor')})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Editable
          onClick={() => openUniversal(
            'Welcome Marquee',
            'I-edit ang marquee images, background, at iba pa.',
            [
              { key: 'marqueeImageSolid', label: 'Solid Image', type: 'image' },
              { key: 'marqueeImageOutline', label: 'Outline Image', type: 'image' },
              { key: 'marqueeBgColor', label: 'Background', type: 'background' },
            ],
            ['marqueeImageSolid', 'marqueeImageOutline', 'marqueeBgColor']
          )}
          chip="Edit Marquee"
          chipPosition="right-10 top-4"
          className="py-16 sm:py-20 overflow-hidden whitespace-nowrap"
        >
          <div className="flex w-max animate-marquee-left items-center">
            {[0, 4].map(group => (
              <div key={group} className="flex shrink-0 items-center" aria-hidden={group === 1}>
                <img src={S('marqueeImageSolid')} alt="Welcome" className="shrink-0 h-20 sm:h-28 lg:h-32 w-auto px-10 sm:px-16" />
                <img src={S('marqueeImageOutline')} alt="" aria-hidden="true" className="shrink-0 h-20 sm:h-28 lg:h-32 w-auto px-10 sm:px-16" />
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
              <button key={tile.to} onClick={() => onNavigate(tile.to)} className="group bg-white rounded-2xl border border-slate-200 p-7 text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-28px_rgba(15,23,42,0.28)] hover:border-indigo-300">
                <div className="w-12 h-12 rounded-xl bg-[#0f172a] text-indigo-400 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">{tile.icon}</div>
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
                <p className="font-serif text-2xl sm:text-3xl italic leading-relaxed text-white/95">"{todayVerse.text}"</p>
                <p className="text-sm font-bold text-indigo-400 tracking-wide">— {todayVerse.ref}</p>
              </Editable>
            ) : (
              <Editable onClick={openNewVerse} chip="Add Verse">
                <p className="font-serif text-2xl sm:text-3xl italic leading-relaxed text-white/95">"{todayVerse.text}"</p>
                <p className="text-sm font-bold text-indigo-400 tracking-wide">— {todayVerse.ref}</p>
              </Editable>
            )}
            <button onClick={() => onNavigate('verses')} className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-all duration-300">
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
              <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-600">Gatherings</span>
              <h2 className="text-3xl sm:text-4xl font-serif text-[#0f172a] tracking-tight">Upcoming events</h2>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={openNewEvent} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-white rounded-full px-4 py-2 border border-indigo-200 shadow-sm">
                <Plus className="w-3.5 h-3.5" />
                Add Event
              </button>
              <button onClick={() => onNavigate('events')} className="group inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
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
                <Editable key={ev.id} onClick={() => openEvent(ev)} chip="Edit Event" className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-28px_rgba(15,23,42,0.25)] hover:border-indigo-300">
                  <div className="relative h-48 overflow-hidden">
                    <img src={eventPhoto(ev)} alt={ev.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/60 via-transparent to-transparent opacity-70" />
                    <span className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3.5 py-1.5 rounded-full text-xs font-bold text-[#0f172a] shadow-sm">{ev.tag}</span>
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-widest">
                      <Clock className="w-3.5 h-3.5" />
                      {ev.date}
                    </div>
                    <h3 className="font-serif text-xl text-[#0f172a] group-hover:text-indigo-700 transition-colors">{ev.title}</h3>
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
                <h2 className="text-3xl sm:text-4xl font-serif text-[#0f172a] tracking-tight">What's new at GFC</h2>
              </div>
              <button onClick={openNewAnnouncement} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors bg-white rounded-full px-4 py-2 border border-indigo-200 shadow-sm">
                <Plus className="w-3.5 h-3.5" />
                Add Announcement
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {visibleAnnouncements.map(a => (
                <Editable key={a.id} onClick={() => openAnnouncement(a)} chip="Edit" className="bg-white rounded-2xl border border-slate-200 p-7 space-y-3 transition-colors duration-300 hover:border-indigo-300">
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
          <img src="https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1800&q=80" alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f1a2e]/95 via-[#0f1a2e]/85 to-[#0f1a2e]/70" />
          <div className="relative z-10 px-8 py-16 sm:px-14 sm:py-20 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <Editable
              onClick={() => openUniversal(
                'Prayer Band',
                'I-edit ang prayer band text at font.',
                [
                  { key: 'prayerTitle1', label: 'Title — Part 1', type: 'text' },
                  { key: 'prayerTitle2', label: 'Title — Part 2 (italic)', type: 'text' },
                  { key: 'prayerText', label: 'Description', type: 'textarea' },
                  { key: 'prayerTitleFont', label: 'Font Family', type: 'font' },
                  { key: 'prayerTitleSize', label: 'Font Size', type: 'size' },
                ],
                ['prayerTitle1', 'prayerTitle2', 'prayerText', 'prayerTitleFont', 'prayerTitleSize']
              )}
              chip="Edit Text"
              chipPosition="right-8 top-8"
              className="space-y-4 max-w-xl"
            >
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-400">
                <Heart className="w-4 h-4 fill-current" />
                We're praying with you
              </span>
              <h2
                className={`${S('prayerTitleSize') || 'text-4xl'} text-white tracking-tight leading-tight`}
                style={{ fontFamily: S('prayerTitleFont') || 'serif' }}
              >
                {S('prayerTitle1')} <span className="italic text-indigo-400">{S('prayerTitle2')}</span>
              </h2>
              <p className="text-white/75 text-sm sm:text-base leading-relaxed">{S('prayerText')}</p>
            </Editable>
            <button onClick={() => onNavigate('prayers')} className="group inline-flex items-center gap-2.5 px-7 py-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base transition-all duration-300 active:scale-[0.98] shadow-lg shadow-black/20 shrink-0">
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
              onClick={() => openUniversal(
                'Where to Find Us',
                'I-edit ang address text.',
                [
                  { key: 'visitAddress', label: 'Address Text', type: 'textarea' },
                ],
                ['visitAddress']
              )}
              chip="Edit Address"
              className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#0f172a] text-indigo-400 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-xl text-[#0f172a]">Where to find us</h3>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{S('visitAddress')}</p>
              <div className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">
                Get Directions & Register
                <ArrowRight className="w-4 h-4" />
              </div>
            </Editable>
            <div className="bg-[#0f172a] rounded-2xl p-8 space-y-4 text-white">
              <Editable
                onClick={() => openUniversal(
                  'Bless the Church',
                  'I-edit ang give teaser text.',
                  [
                    { key: 'giveBlurb', label: 'Give Teaser Text', type: 'textarea' },
                  ],
                  ['giveBlurb']
                )}
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
                <p className="text-sm text-white/70 leading-relaxed">{S('giveBlurb')}</p>
              </Editable>
              <button onClick={() => onNavigate('giveInfo')} className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-white transition-colors">
                Give Tithes & Offering
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ UNIVERSAL EDIT MODAL ============ */}
      {editor?.kind === 'universal' && (
        <UniversalEditModal
          title={editor.title}
          subtitle={editor.subtitle}
          fields={editor.fields}
          values={editor.values}
          onChange={setValue}
          onSave={() => handleSave(editor.values)}
          onCancel={() => setEditor(null)}
        />
      )}

      {/* ============ DRAWER (events, announcements, verses) ============ */}
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