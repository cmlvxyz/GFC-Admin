// GFC-ADMIN/src/pages/AllPhotosPage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { ChurchEvent, AllPhotoAlbum } from '../types';
import {
  QrCode,
  X,
  CalendarDays,
  Images,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
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

  return 'https://gfc-admin-rosy.vercel.app';
})();

const SITE_BASE = (() => {
  const fromEnv = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost = !host || host === 'localhost' || host === '127.0.0.1';
  const isLanIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (isLocalhost || isLanIp) return host ? `http://${host}:3002` : 'http://localhost:3002';
  return typeof window !== 'undefined' ? window.location.origin : 'https://gfc-admin-rosy.vercel.app';
})();

const resolvePhotoUrl = (u: string): string => {
  if (u.startsWith('data:') || /^https?:\/\//i.test(u)) return u;
  return `${SITE_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
};

const CURRENT_YEAR = new Date().getFullYear();

const parseEntryDate = (value: string): { month: number; year: number } | null => {
  if (!value) return null;
  const hasYear = /\d{4}/.test(value);
  const d = new Date(hasYear ? value : `${value}, ${CURRENT_YEAR}`);
  if (Number.isNaN(d.getTime())) return null;
  return { month: d.getMonth(), year: d.getFullYear() };
};

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
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [qrContainerEl, setQrContainerEl] = useState<HTMLDivElement | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [deletedPhotoKeys, setDeletedPhotoKeys] = useState<Set<string>>(new Set());

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

  const allPhotosList = useMemo<PhotoItem[]>(() => {
    const list: PhotoItem[] = [];
    const add = (item: PhotoItem, occurrence: PhotoOccurrence) => {
      list.push({
        ...item,
        occurrences: [occurrence],
        source: occurrence.source,
        rawUrl: occurrence.rawUrl,
        albumIndex: occurrence.albumIndex,
        photoIndex: occurrence.photoIndex,
        eventId: occurrence.eventId,
        dateEntryIndex: occurrence.dateEntryIndex,
        photoEntryIndex: occurrence.photoEntryIndex
      });
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
          add(
            { url: resolvePhotoUrl(url), rawUrl: url, month, year, eventTitle: ev.title, date: entry.date, source: 'event' },
            { source: 'event', rawUrl: url, eventId: ev.id, dateEntryIndex: entryIndex, photoEntryIndex: urlIndex }
          );
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
        add(
          { url: resolvePhotoUrl(rawUrl), rawUrl, month, year, eventTitle: 'All Photos', date: album.date || '', source: 'allPhotos' },
          { source: 'allPhotos', rawUrl, albumIndex, photoIndex }
        );
      }
    }
    return list;
  }, [events, allPhotos]);

  const grouped = useMemo(() => {
    let filtered = allPhotosList.filter(photo => !deletedPhotoKeys.has(getPhotoKey(photo)));
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
    return order.map(o => ({ ...o, photos: byKey.get(o.key) || [] }));
  }, [allPhotosList, selectedMonth, selectedYear, deletedPhotoKeys]);

  const toggleExpand = (key: string) => setExpandedMonth(expandedMonth === key ? null : key);

  /* Instant optimistic delete: the clicked photo disappears immediately. */
  const deletePhoto = async (photo: PhotoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const photoKey = getPhotoKey(photo);

    setDeletedPhotoKeys(prev => {
      const next = new Set(prev);
      next.add(photoKey);
      return next;
    });
    setSelectedPhoto(null);

    try {
      if (photo.source === 'allPhotos') {
        if (photo.albumIndex === undefined || photo.photoIndex === undefined) {
          throw new Error('Photo location is missing. Please refresh and try again.');
        }
        const response = await fetch(`${API_URL}/api/allPhotos/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ albumIndex: photo.albumIndex, photoIndex: photo.photoIndex })
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || 'Failed to delete photo.');
        }
        onAllPhotosUpdated?.();
      } else {
        if (photo.eventId === undefined || photo.dateEntryIndex === undefined || !photo.rawUrl) {
          throw new Error('Photo location is missing. Please refresh and try again.');
        }
        const response = await fetch(`${API_URL}/api/events/photo/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: photo.eventId, dateEntryIndex: photo.dateEntryIndex, photoUrl: photo.rawUrl })
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || 'Failed to delete photo.');
        }
        onEventsUpdated?.();
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      setDeletedPhotoKeys(prev => {
        const next = new Set(prev);
        next.delete(photoKey);
        return next;
      });
      onError?.(error instanceof Error ? error.message : 'Failed to delete the photo.');
    }
  };

  useEffect(() => {
    if (!qrContainerEl) return;
    qrContainerEl.innerHTML = '';
    let qrUrl = `${GFC_BASE}/upload`;
    if (selectedMonth !== '') qrUrl += `?month=${selectedMonth + 1}`;
    if (selectedYear !== '') qrUrl += selectedMonth !== '' ? `&year=${selectedYear}` : `?year=${selectedYear}`;
    const qr = new QRCodeStyling({
      width: 240, height: 240, margin: 0, data: qrUrl, image: '/image-circle.png',
      imageOptions: { imageSize: 0.4, margin: 8, crossOrigin: 'anonymous' },
      qrOptions: { errorCorrectionLevel: 'H', typeNumber: 0 },
      dotsOptions: { color: '#1a1a2e', type: 'rounded' },
      cornersSquareOptions: { color: '#1a1a2e', type: 'extra-rounded' },
      backgroundOptions: { color: '#ffffff', round: 8 }
    });
    qr.append(qrContainerEl);
  }, [qrContainerEl, selectedMonth, selectedYear]);

  const monthCountsForYear = (year: number): number[] => {
    const counts = new Array(12).fill(0);
    for (const p of allPhotosList) {
      if (p.year === year && p.year !== -1 && !deletedPhotoKeys.has(getPhotoKey(p))) counts[p.month] += 1;
    }
    return counts;
  };

  const getUploadUrl = () => {
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
                <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-400 flex-shrink-0" /><select value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value === '' ? '' : parseInt(e.target.value)); setExpandedMonth(null); }} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"><option value="">All Months</option>{MONTH_NAMES.map((name, idx) => <option key={name} value={idx}>{name}</option>)}</select></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">Select Year</label>
                <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-400 flex-shrink-0" /><select value={selectedYear} onChange={e => { const year = e.target.value === '' ? '' : parseInt(e.target.value); setSelectedYear(year); setExpandedMonth(null); }} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"><option value="">All Years</option>{YEAR_RANGE.map(year => <option key={year} value={year}>{year}</option>)}</select></div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {grouped.length === 0 ? (
              <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-10 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm text-center"><Images className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" /><p className="text-gray-500 dark:text-gray-400">{selectedMonth === '' && selectedYear === '' ? 'No photos found. Upload some photos using the QR code.' : 'No photos found for the selected filters.'}</p></div>
            ) : (
              grouped.map(group => {
                const isExpanded = expandedMonth === group.key;
                const allPhotosInGroup = group.photos;
                return (
                  <div key={group.key} className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden transition-all">
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-all" onClick={() => toggleExpand(group.key)}>
                      <div className="flex items-center gap-3"><h4 className="text-sm font-bold text-black dark:text-white">{group.label}</h4></div>
                      <div className="flex items-center gap-2">{isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}</div>
                    </div>
                    <div className="p-3 pt-0">
                      {isExpanded ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {allPhotosInGroup.map((photo, idx) => (
                            <div key={`${getPhotoKey(photo)}-${idx}`} className="group relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all aspect-square cursor-pointer hover:scale-[1.02]" title={`${photo.eventTitle} — ${photo.date}`} onClick={() => setSelectedPhoto(photo)}>
                              <img src={photo.url} alt={`${photo.eventTitle} - ${photo.date}`} loading="lazy" className="w-full h-full object-cover transition-transform hover:scale-110 duration-500" onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100%" height="100%"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="12" fill="%23999"%3ENo image%3C/text%3E%3C/svg%3E'; }} />
                              <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-[9px] font-semibold truncate opacity-0 group-hover:opacity-100 transition-opacity">{photo.eventTitle} • {photo.date}</div>
                              <button onClick={e => deletePhoto(photo, e)} className="absolute top-1 right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg" title="Delete photo permanently" aria-label="Delete photo"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {allPhotosInGroup.slice(0, 1).map((photo, idx) => (
                            <div key={`${getPhotoKey(photo)}-${idx}`} className="relative rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all aspect-square cursor-pointer hover:scale-[1.02]" title={`${group.label} - Click to expand`} onClick={() => toggleExpand(group.key)}>
                              <img src={photo.url} alt={`${group.label} cover`} loading="lazy" className="w-full h-full object-cover transition-transform hover:scale-110 duration-500" onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect fill="%23ddd" width="100%" height="100%"/%3E%3Ctext x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="12" fill="%23999"%3ENo image%3C/text%3E%3C/svg%3E'; }} /></div>
                          ))}
                          {allPhotosInGroup.length === 0 && <div className="aspect-square rounded-lg bg-gray-100 dark:bg-black/20 flex items-center justify-center text-gray-400 text-xs">No photos</div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm lg:sticky lg:top-4">
          <div className="flex items-center gap-2 mb-3"><QrCode className="w-5 h-5 text-indigo-500" /><span className="text-sm font-bold text-black dark:text-white">Upload QR Code</span></div>
          <div className="flex justify-center bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10 p-4"><div ref={el => setQrContainerEl(el)} className="bg-white rounded-lg shadow-md" /></div>
          <a href={getUploadUrl()} target="_blank" rel="noopener noreferrer" className="mt-2 text-[11px] font-mono text-indigo-500 dark:text-indigo-400 underline break-all text-center block hover:text-indigo-600 dark:hover:text-indigo-300">{getUploadUrl()}</a>
        </div>
      </div>

      {yearModal !== null && (
        <div className="fixed inset-0 z-[60] bg-black/70 dark:bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setYearModal(null)}>
          <div className="bg-white dark:bg-[#14141f] rounded-2xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-black dark:text-white">{yearModal}</h3><button onClick={() => setYearModal(null)}><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-2">{MONTH_NAMES.map((name, idx) => { const count = monthCountsForYear(yearModal)[idx]; return <button key={name} disabled={count === 0} onClick={() => { setSelectedYear(yearModal); setSelectedMonth(idx); setYearModal(null); setExpandedMonth(null); }} className="p-3 rounded-xl border border-gray-200 dark:border-white/10 text-left text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/5 text-black dark:text-white">{name}</button>; })}</div>
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
