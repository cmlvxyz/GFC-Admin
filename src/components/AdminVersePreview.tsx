import React, { useState } from 'react';
import { BookOpen, Copy, Check, CalendarDays } from 'lucide-react';
import type { Verse } from '../types';
import { AdminPreviewHero, ManagePill } from './AdminPreviewHero';

// ============ VERSE OF THE DAY fallback (kapareho ng website) ============
const FALLBACK_VERSES: { text: string; ref: string }[] = [
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

// todayLabel at ang rotation ay 100% kapareho ng GFC/src/utils/verseOfDay.ts
const todayLabel = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric'
});

const getTodayVerse = (): { text: string; ref: string } =>
  FALLBACK_VERSES[dayOfYear() % FALLBACK_VERSES.length];

const getMoreVerses = (count = 3): { text: string; ref: string }[] => {
  const indexToday = dayOfYear() % FALLBACK_VERSES.length;
  return [...FALLBACK_VERSES.slice(indexToday + 1), ...FALLBACK_VERSES.slice(0, indexToday)].slice(0, count);
};

interface AdminVersePreviewProps {
  verses?: Verse[];
  onNavigate: (page: string) => void;
}

export const AdminVersePreview: React.FC<AdminVersePreviewProps> = ({ verses = [], onNavigate }) => {
  const [copied, setCopied] = useState(false);

  const hasAdminVerses = verses.length > 0;
  const todayVerse: { text: string; ref: string } = hasAdminVerses ? verses[0] : getTodayVerse();
  const moreVerses: { text: string; ref: string }[] = hasAdminVerses && verses.length > 1
    ? verses.slice(1, 4)
    : getMoreVerses(3);

  const copyVerse = async () => {
    try {
      await navigator.clipboard.writeText(`"${todayVerse.text}" — ${todayVerse.ref}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <ManagePill label="Verse" onManage={() => onNavigate('versesManage')} />

      <AdminPreviewHero
        eyebrow="Daily Devotion"
        title={<>The Word for <span className="italic text-indigo-400">today.</span></>}
        subtitle="A daily reminder of God's faithfulness — a verse to reflect on, memorize, and share."
      />

      <section id="verseSection" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        {/* ============ HEADER ============ */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-600">
              Daily Devotion
            </span>
            <h2 className="text-4xl sm:text-5xl font-serif text-[#0f172a] tracking-tight leading-tight">
              Verse of the Day
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
              A daily reminder of God's faithfulness — a word from the Lord to keep
              close to your heart.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
            <CalendarDays className="w-4 h-4" />
            {todayLabel}
          </div>
        </div>

        {/* ============ FEATURED VERSE ============ */}
        <div className="bg-[#0f172a] rounded-3xl p-8 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/[0.03] pointer-events-none" />
          <div className="absolute -bottom-20 -left-16 w-72 h-72 rounded-full bg-indigo-500/[0.08] pointer-events-none" />

          <div className="relative mx-auto max-w-3xl space-y-7">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>

            <div className="flex items-center justify-center gap-4 text-indigo-400 text-4xl font-serif leading-none">
              <span className="h-px w-10 bg-indigo-400/50" />
              <span>&ldquo;</span>
              <span className="h-px w-10 bg-indigo-400/50" />
            </div>

            <blockquote>
              <p className="text-2xl sm:text-3xl md:text-4xl font-serif italic leading-relaxed text-white/95">
                {todayVerse.text}
              </p>
            </blockquote>

            <p className="text-sm sm:text-base font-bold text-indigo-400 tracking-wide">
              — {todayVerse.ref}
            </p>

            <button
              onClick={copyVerse}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-sm transition-all duration-300 active:scale-[0.98]"
            >
              {copied ? <Check className="w-4 h-4 text-indigo-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
              <span>{copied ? 'Copied!' : 'Copy Verse'}</span>
            </button>
          </div>
        </div>

        {/* ============ MORE FROM THE WORD ============ */}
        <div className="space-y-6 pt-2">
          <div className="flex items-end justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
              More from the Word
            </h3>
            <span className="text-xs text-slate-400">Reflect · Memorize · Share</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {moreVerses.map((v, i) => (
              <div
                key={`${v.ref}-${i}`}
                className="group bg-white rounded-2xl p-7 border border-slate-200 hover:border-indigo-300 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.25)]"
              >
                <div className="text-[11px] font-bold text-indigo-600 tracking-[0.3em] mb-4">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <p className="text-sm italic leading-relaxed text-slate-700">
                  "{v.text}"
                </p>
                <p className="text-xs font-bold text-indigo-600 mt-4 text-right">
                  — {v.ref}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};