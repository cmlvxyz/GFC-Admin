// GFC-ADMIN/src/pages/AllPhotosPage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { ChurchEvent, AllPhotoAlbum } from '../types';
import {
  QrCode,
  X,
  CalendarDays,
  Images,
  Trash2
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { API_URL } from '../api';

interface AllPhotosPageProps {
  events: ChurchEvent[];
  allPhotos?: AllPhotoAlbum[];
  onAllPhotosUpdated?: () => void;
  onEventsUpdated?: () => void;
  onError?: (message: string) => void;
}

interface PhotoOccurrence {
  source: 'event' | 'allPhotos';
  rawUrl: string;
  albumIndex?: number;
  photoIndex?: number;
  eventId?: string;
  dateEntryIndex?: number;
  photoEntryIndex?: number;
}

interface PhotoItem {
  url: string;
  rawUrl: string;
  month: number;
  year: number;
  eventTitle: string;
  date: string;
  source: 'event' | 'allPhotos';
  occurrences?: PhotoOccurrence[];
  albumIndex?: number;
  photoIndex?: number;
  eventId?: string;
  dateEntryIndex?: number;
  photoEntryIndex?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const GFC_BASE = (() => {
  const fromEnv = (import.meta.env.VITE_GFC_URL as string | undefined)?.trim();

  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  const host =
    typeof window !== 'undefined'
      ? window.location.hostname
      : '';

  const isLocalhost =
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1';

  const isLanIp =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

  if (isLocalhost || isLanIp) {
    return host
      ? `http://${host}:4000`
      : 'http://localhost:4000';
  }

  return typeof window !== 'undefined'
    ? window.location.origin
    : 'https://gfc-admin.up.railway.app';
})();

const SITE_BASE = (() => {
  const fromEnv = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost = !host || host === 'localhost' || host === '127.0.0.1';
  const isLanIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isLocalhost || isLanIp) return host ? `http://${host}:3002` : 'http://localhost:3002';
  return typeof window !== 'undefined' ? window.location.origin : 'https://gfc-admin.up.railway.app';
})();

const resolvePhotoUrl = (u: string): string => {
  if (u.startsWith('data:') || /^https?:\/\//i.test(u)) return u;
  return `${SITE_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
};

const canonicalPhotoKey = (url: string): string =>
  /^https:\/\/scontent-[\w.-]+\.(fbcdn|facebook)\.net\//.test(url)
    ? url.split('?')[0]
    : url;

const CURRENT_YEAR = new Date().getFullYear();

const parseEntryDate = (value: string): { month: number; year: number } | null => {
  if (!value) return null;
  const hasYear = /\d{4}/.test(value);
  const d = new Date(hasYear ? value : `${value}, ${CURRENT_YEAR}`);
  if (Number.isNaN(d.getTime())) return null;
  return { month: d.getMonth(), year: d.getFullYear() };
};

const photoDateValue = (p: PhotoItem): number => {
  const raw = String(p.date || '').trim();
  if (!raw) return -1;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? -1 : d.getTime();
};

const sortPhotosByDateDesc = (photos: PhotoItem[]): PhotoItem[] =>
  [...photos].sort((a, b) => {
    const byDate = photoDateValue(b) - photoDateValue(a);
    if (byDate !== 0) return byDate;
    return (b.year ?? -1) - (a.year ?? -1) || (b.month ?? -1) - (a.month ?? -1);
  });

const YEAR_RANGE = Array.from({ length: 10 }, (_, i) => 2021 + i);

export const AllPhotosPage: React.FC<AllPhotosPageProps> = ({
  events,
  allPhotos = [],
  onAllPhotosUpdated,
  onEventsUpdated,
  onError
}) => {
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [yearModal, setYearModal] = useState<number | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<{ key: string; label: string; photos: PhotoItem[] } | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [deletedPhotoKeys, setDeletedPhotoKeys] = useState<Set<string>>(new Set());
  const [facebookUrl, setFacebookUrl] = useState('');
  const [facebookImporting, setFacebookImporting] = useState(false);
  const [facebookStatus, setFacebookStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [facebookMessage, setFacebookMessage] = useState('');

  const getPhotoKey = (photo: PhotoItem): string => {
    return [
      photo.source,
      photo.year ?? '',
      photo.month ?? '',
      photo.eventId ?? '',
      photo.dateEntryIndex ?? '',
      photo.photoEntryIndex ?? '',
      photo.albumIndex ?? '',
      photo.photoIndex ?? '',
      String(photo.rawUrl ?? '').trim()
    ].join('|');
  };

  const occurrenceKey = (photo: PhotoItem, occ: PhotoOccurrence): string => {
    return [
      occ.source,
      occ.eventId ?? '',
      occ.dateEntryIndex ?? '',
      occ.photoEntryIndex ?? '',
      occ.albumIndex ?? '',
      occ.photoIndex ?? '',
      String(photo.rawUrl ?? '').trim()
    ].join('|');
  };

  const isPhotoDeleted = (photo: PhotoItem): boolean => {
    const occs =
      Array.isArray(photo.occurrences) &&
      photo.occurrences.length > 0
        ? photo.occurrences
        : null;
    if (!occs) return deletedPhotoKeys.has(getPhotoKey(photo));
    return occs.every(occ => deletedPhotoKeys.has(occurrenceKey(photo, occ)));
  };

  const allPhotosList = useMemo<PhotoItem[]>(() => {
    const byUrl = new Map<string, PhotoItem>();
    const ensure = (rawUrl: string, month: number, year: number): PhotoItem => {
      const key = canonicalPhotoKey(rawUrl);
      let item = byUrl.get(key);
      if (!item) {
        item = {
          url: resolvePhotoUrl(rawUrl),
          rawUrl,
          month,
          year,
          eventTitle: '',
          date: '',
          source: 'event',
          occurrences: []
        };
        byUrl.set(key, item);
      }
      return item;
    };

    for (const ev of events) {
      if (!ev.dateEntries || ev.dateEntries.length === 0) continue;
      for (let entryIndex = 0; entryIndex < ev.dateEntries.length; entryIndex++) {
        const entry = ev.dateEntries[entryIndex];
        const parsed = parseEntryDate(entry.date);
        const month = parsed ? parsed.month : -1;
        const year = parsed ? parsed.year : -1;
        for (let urlIndex = 0; urlIndex < (entry.photos || []).length; urlIndex++) {
          const url = entry.photos[urlIndex];
          const item = ensure(url, month, year);
          if (!item.eventTitle) {
            item.eventTitle = ev.title;
            item.date = entry.date;
          }
          item.occurrences?.push({
            source: 'event',
            rawUrl: url,
            eventId: ev.id,
            dateEntryIndex: entryIndex,
            photoEntryIndex: urlIndex
          });
        }
      }
    }

    for (let albumIndex = 0; albumIndex < allPhotos.length; albumIndex++) {
      const album = allPhotos[albumIndex];
      if (!Array.isArray(album?.photos)) continue;
      const month = typeof album.month === 'number' ? album.month : -1;
      const year = typeof album.year === 'number' ? album.year : -1;
      for (let photoIndex = 0; photoIndex < album.photos.length; photoIndex++) {
        const rawUrl = album.photos[photoIndex];
        const item = ensure(rawUrl, month, year);
        if (!item.eventTitle) {
          item.eventTitle = 'All Photos';
          item.date = album.date || '';
        }
        item.occurrences?.push({
          source: 'allPhotos',
          rawUrl,
          albumIndex,
          photoIndex
        });
      }
    }

    return Array.from(byUrl.values());
  }, [events, allPhotos]);

  const grouped = useMemo(() => {
    let filtered = allPhotosList.filter(photo => !isPhotoDeleted(photo));
    if (selectedMonth !== '') filtered = filtered.filter(p => p.month === selectedMonth);
    if (selectedYear !== '') filtered = filtered.filter(p => p.year === selectedYear);

    const order: { key: string; label: string; year: number; month: number; photos: PhotoItem[] }[] = [];
    const byKey = new Map<string, PhotoItem[]>();
    for (const p of filtered) {
      const key = `${p.year}-${p.month}`;
      if (!byKey.has(key)) {
        byKey.set(key, []);
        order.push({ key, label: p.year === -1 ? '📁 Other / Not Categorized' : `${MONTH_NAMES[p.month]} ${p.year}`, year: p.year, month: p.month, photos: [] });
      }
      byKey.get(key)!.push(p);
    }
    order.sort((a, b) => b.year - a.year || b.month - a.month);
    return order.map(o => ({ ...o, photos: sortPhotosByDateDesc(byKey.get(o.key) || []) }));
  }, [allPhotosList, selectedMonth, selectedYear, deletedPhotoKeys]);

  const deletePhoto = async (photo: PhotoItem, e: React.MouseEvent) => {
    e.stopPropagation();

    const occs: PhotoOccurrence[] =
      Array.isArray(photo.occurrences) && photo.occurrences.length > 0
        ? photo.occurrences
        : [{
            source: photo.source,
            rawUrl: photo.rawUrl,
            eventId: photo.eventId,
            dateEntryIndex: photo.dateEntryIndex,
            photoEntryIndex: photo.photoEntryIndex,
            albumIndex: photo.albumIndex,
            photoIndex: photo.photoIndex
          }];

    const keys = occs.map(occ => occurrenceKey(photo, occ));

    setDeletedPhotoKeys(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.add(k));
      return next;
    });
    setSelectedPhoto(null);

    try {
      for (const occ of occs) {
        if (occ.source === 'allPhotos') {
          if (occ.albumIndex === undefined || occ.photoIndex === undefined) {
            throw new Error('Photo location is missing. Please refresh and try again.');
          }
          const response = await fetch(`${API_URL}/api/allPhotos/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ albumIndex: occ.albumIndex, photoIndex: occ.photoIndex })
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || 'Failed to delete photo.');
          }
        } else {
          if (occ.eventId === undefined || occ.dateEntryIndex === undefined || !photo.rawUrl) {
            throw new Error('Photo location is missing. Please refresh and try again.');
          }
          const response = await fetch(`${API_URL}/api/events/photo/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: occ.eventId, dateEntryIndex: occ.dateEntryIndex, photoUrl: photo.rawUrl })
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || 'Failed to delete photo.');
          }
        }
      }
      onAllPhotosUpdated?.();
      onEventsUpdated?.();
    } catch (error) {
      console.error('Error deleting photo:', error);
      setDeletedPhotoKeys(prev => {
        const next = new Set(prev);
        keys.forEach(k => next.delete(k));
        return next;
      });
      onError?.(error instanceof Error ? error.message : 'Failed to delete the photo.');
    }
  };

  // ==========================================================
  // UPLOAD URL — para sa QR code at link
  // ==========================================================

  const getUploadUrl = (): string => {
    const params = new URLSearchParams();

    if (selectedMonth !== '') {
      params.set('month', String(selectedMonth + 1));
    }

    if (selectedYear !== '') {
      params.set('year', String(selectedYear));
    }

    const query = params.toString();

    return `${GFC_BASE}/upload${query ? `?${query}` : ''}`;
  };

  

  const monthCountsForYear = (year: number): number[] => {
    const counts = new Array(12).fill(0);
    for (const p of allPhotosList) {
      if (p.year === year && p.year !== -1 && !isPhotoDeleted(p)) counts[p.month] += 1;
    }
    return counts;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
        <h3 className="text-sm font-bold text-black dark:text-white mb-2 flex items-center gap-2"><Images className="w-5 h-5 text-indigo-500" /><span>All Photos</span></h3>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">Upload page: {getUploadUrl()}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">Select Month</label>
                <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-400 flex-shrink-0" /><select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value === '' ? '' : parseInt(e.target.value)); }} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"><option value="">All Months</option>{MONTH_NAMES.map((name, idx) => <option key={name} value={idx}>{name}</option>)}</select></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">Select Year</label>
                <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-400 flex-shrink-0" /><select value={selectedYear} onChange={e => { const year = e.target.value === '' ? '' : parseInt(e.target.value); setSelectedYear(year); }} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"><option value="">All Years</option>{YEAR_RANGE.map(year => <option key={year} value={year}>{year}</option>)}</select></div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {grouped.length === 0 ? (
              <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-10 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm text-center"><Images className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-gray-500 dark:text-gray-400">{selectedMonth === '' && selectedYear === '' ? 'No photos found. Upload some photos using the QR code.' : 'No photos found for the selected filters.'}</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {grouped.map(group => {
                  const cover = group.photos[0]?.url;
                  return (
                    <button
                      key={group.key}
                      onClick={() => setSelectedAlbum({ key: group.key, label: group.label, photos: group.photos })}
                      className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-xl transition-all text-left"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden">
                        {cover ? (
                          <img src={cover} alt={group.label} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100%" height="100%"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="12" fill="%23999"%3ENo image%3C/text%3E%3C/svg%3E'; }} />
                        ) : (
                          <div className="w-full h-full bg-gray-100 dark:bg-black/20 flex items-center justify-center text-gray-400 text-xs">No photos</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute bottom-2.5 left-3 right-3">
                          <div className="text-white font-bold text-sm drop-shadow-md">{group.label}</div>
                          <div className="text-white/85 text-[11px] font-semibold drop-shadow">{group.photos.length} photo{group.photos.length === 1 ? '' : 's'}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm lg:sticky lg:top-4">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-5 h-5 text-indigo-500" />
            <span className="text-sm font-bold text-black dark:text-white">Upload QR Code</span>
          </div>

          <div className="flex justify-center">
            <div className="bg-white rounded-xl shadow-md p-2">
              <QRCodeCanvas
                value={getUploadUrl()}
                size={300}
                level="H"
                fgColor="#111827"
                bgColor="#ffffff"
                marginSize={4}
                imageSettings={{
                  src: '/image-circle.png',
                  width: 36,
                  height: 36,
                  excavate: true
                }}
              />
            </div>
          </div>

          <a
            href={getUploadUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-[11px] font-mono text-indigo-500 dark:text-indigo-400 underline break-all text-center block hover:text-indigo-600 dark:hover:text-indigo-300"
          >
            {getUploadUrl()}
          </a>
        </div>
      </div>

      {yearModal !== null && (
        <div className="fixed inset-0 z-[60] bg-black/70 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setYearModal(null)}>
          <div className="bg-white dark:bg-[#14141f] rounded-2xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-black dark:text-white">{yearModal}</h3><button onClick={() => setYearModal(null)}><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-2">{MONTH_NAMES.map((name, idx) => { const count = monthCountsForYear(yearModal)[idx]; return <button key={name} disabled={count === 0} onClick={() => { setSelectedYear(yearModal); setSelectedMonth(idx); setYearModal(null); }} className="p-3 rounded-xl border border-gray-200 dark:border-white/10 text-left text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5 text-black dark:text-white">{name}</button>; })}</div>
          </div>
        </div>
      )}

      {selectedAlbum && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/10 dark:bg-black/20 p-3" onClick={() => setSelectedAlbum(null)}>
          <div className="w-full max-w-4xl max-h-[82vh] overflow-y-auto hide-scrollbar rounded-3xl border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-[#14141f]/80 backdrop-blur-md shadow-2xl p-4 sm:p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-black dark:text-white">{selectedAlbum.label}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedAlbum.photos.filter(p => !isPhotoDeleted(p)).length} photo{selectedAlbum.photos.filter(p => !isPhotoDeleted(p)).length === 1 ? '' : 's'}</p>
              </div>
              <button onClick={() => setSelectedAlbum(null)} className="p-2 rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/15" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {selectedAlbum.photos
                .filter(p => !isPhotoDeleted(p))
                .map((photo, idx) => (
                  <div key={`${getPhotoKey(photo)}-${idx}`} className="group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all aspect-square cursor-pointer hover:scale-[1.02]" title={`${photo.eventTitle} — ${photo.date}`} onClick={() => setSelectedPhoto(photo)}>
                    <img src={photo.url} alt={`${photo.eventTitle} - ${photo.date}`} loading="lazy" className="w-full h-full object-cover transition-transform hover:scale-110 duration-500" onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100%" height="100%"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="12" fill="%23999"%3ENo image%3C/text%3E%3C/svg%3E'; }} />
                    {photo.source === 'event' && <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-[9px] font-semibold truncate opacity-0 group-hover:opacity-100 transition-opacity">{photo.eventTitle} • {photo.date}</div>}
                    <button onClick={e => deletePhoto(photo, e)} className="absolute top-1 right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg" title="Delete photo permanently" aria-label="Delete photo"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <button onClick={() => setSelectedPhoto(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white" aria-label="Close"><X className="w-6 h-6" /></button>
          <div className="relative max-w-5xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={selectedPhoto.url} alt={`${selectedPhoto.eventTitle} - ${selectedPhoto.date}`} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <button onClick={e => deletePhoto(selectedPhoto, e)} className="absolute top-3 right-3 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg" title="Delete photo permanently" aria-label="Delete photo"><Trash2 className="w-5 h-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
};