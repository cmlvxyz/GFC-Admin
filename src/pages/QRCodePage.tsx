// GFC-ADMIN/src/pages/QRCodePage.tsx

import React, { useEffect, useRef, useState } from 'react';
import { ChurchEvent, DateEntry, AllPhotoAlbum } from '../types';
import {
  QrCode,
  AlertCircle,
  Upload,
  Image,
  X,
  CheckCircle,
  Loader2,
  RefreshCw,
  CalendarPlus,
  Facebook,
  Trash2
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { updateRecord as apiUpdateRecord, API_URL } from '../api';

interface UploadedPhoto {
  id: string;
  dataUrl: string;
  hash: string | null;
  isDuplicate: boolean;
  duplicateLocation: string | null;
}

let photoIdSeed = 0;

const nextPhotoId = (): string =>
  `photo-${Date.now()}-${photoIdSeed++}`;

// ============================================================
// DATE HELPERS
// ============================================================

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const isConcreteDate = (value: unknown): boolean => {
  const s = String(value ?? '').trim();
  if (!s) return false;
  if (/^every\b/i.test(s)) return false;
  if (/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(s)) return false;

  // Tanggapin ang "Month Year" format (halimbawa "August 2026")
  const monthYearMatch = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const monthName = monthYearMatch[1][0].toUpperCase() + monthYearMatch[1].slice(1).toLowerCase();
    return MONTH_NAMES.indexOf(monthName) !== -1;
  }

  // Tanggapin ang "Month Day, Year" format (halimbawa "August 30, 2026")
  const parsed = new Date(s);
  return !Number.isNaN(parsed.getTime());
};

const isScheduleEntry = (value: unknown): boolean => {
  const s = String(value ?? '').trim();
  if (/^every\b/i.test(s)) return true;
  if (/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(s)) return true;
  return false;
};

const isYearAlbumEvent = (event?: ChurchEvent | null): boolean => {
  if (event?.albumType === 'year') return true;
  return String(event?.id) === 'anniversary';
};

const ordinalOf = (value: unknown): number => {
  const match = String(value ?? '').trim().match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
};

const dateKey = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');

const autoAlbumLabel = (existing: DateEntry[] | null | undefined): string => {
  const base = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
  const keys = new Set((existing || []).map(e => dateKey(e.date)));
  let label = base;
  let n = 2;
  while (keys.has(dateKey(label))) {
    label = `${base} (${n++})`;
  }
  return label;
};

const mergeDateEntriesIntoRaw = (
  rawEntries: DateEntry[] | null | undefined,
  updatedEntries: DateEntry[]
): DateEntry[] => {
  const raw = Array.isArray(rawEntries) ? rawEntries : [];
  const queue = updatedEntries.map(entry => ({
    ...entry,
    date: String(entry.date ?? '').trim(),
    photos: Array.isArray(entry.photos) ? entry.photos : []
  }));

  const merged: DateEntry[] = [];

  for (const entry of raw) {
    const key = dateKey(entry.date);
    const index = queue.findIndex(candidate => dateKey(candidate.date) === key);
    if (index >= 0) {
      merged.push(queue[index]);
      queue.splice(index, 1);
    } else {
      merged.push({
        ...entry,
        date: String(entry.date ?? '').trim(),
        photos: Array.isArray(entry.photos) ? entry.photos : []
      });
    }
  }

  merged.push(...queue);
  return merged;
};

const isMonthYear = (value: string): boolean => {
  const match = value.trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return false;
  const monthName = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const monthIndex = MONTH_NAMES.indexOf(monthName);
  if (monthIndex === -1) return false;
  const parsed = new Date(`${monthName} 1, ${match[2]}`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getFullYear() === parseInt(match[2], 10);
};

const toMonthYear = (value: string): string => {
  const parsed = new Date(`${value} 1`);
  const month = parsed.getMonth();
  const year = parsed.getFullYear();
  return `${MONTH_NAMES[month]} ${year}`;
};

// ↓↓↓ IDAGDAG ITO ↓↓↓
const isMonthDayYear = (value: string): boolean => {
  const match = value.trim().match(/^([A-Za-z]+)[\s.]?(\d{1,2}),\s*(\d{4})$/);
  if (!match) return false;
  const monthName = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const monthIndex = MONTH_NAMES.indexOf(monthName);
  if (monthIndex === -1) return false;
  const parsed = new Date(`${monthName} ${match[2]}, ${match[3]}`);
  if (Number.isNaN(parsed.getTime())) return false;
  return (
    parsed.getFullYear() === parseInt(match[3], 10) &&
    parsed.getMonth() === monthIndex
  );
};

const toMonthDayYear = (value: string): string => {
  const parsed = new Date(value);
  const day = parsed.getDate();
  const month = parsed.getMonth();
  const year = parsed.getFullYear();
  return `${MONTH_NAMES[month]} ${day}, ${year}`;
};

// ============================================================
// HASH HELPERS
// ============================================================

const stringHashCache = new Map<string, string | null>();
const pathHashCache = new Map<string, string | null>();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256String(text: string): Promise<string | null> {
  const cached = stringHashCache.get(text);
  if (cached !== undefined) return cached;

  try {
    if (!globalThis.crypto?.subtle) {
      stringHashCache.set(text, null);
      return null;
    }
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(text)
    );
    const hash = bytesToHex(new Uint8Array(digest));
    stringHashCache.set(text, hash);
    return hash;
  } catch {
    stringHashCache.set(text, null);
    return null;
  }
}

async function sha256Bytes(bytes: ArrayBuffer): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return bytesToHex(new Uint8Array(digest));
  } catch {
    return null;
  }
}

async function hashRemoteResource(url: string): Promise<string | null> {
  if (pathHashCache.has(url)) return pathHashCache.get(url) ?? null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      pathHashCache.set(url, null);
      return null;
    }
    const bytes = await res.arrayBuffer();
    const hash = await sha256Bytes(bytes);
    pathHashCache.set(url, hash);
    return hash;
  } catch {
    pathHashCache.set(url, null);
    return null;
  }
}

// ============================================================
// PROPS
// ============================================================

interface QRCodePageProps {
  events: ChurchEvent[];
  onUpdateEvent?: (updatedEvent: ChurchEvent) => void;
  onReload?: () => void;
  allPhotos?: AllPhotoAlbum[];
  onAllPhotosUpdated?: () => void;
}

// ============================================================
// PAGE
// ============================================================

export const QRCodePage: React.FC<QRCodePageProps> = ({
  events,
  onUpdateEvent,
  onReload,
  allPhotos = [],
  onAllPhotosUpdated
}) => {

  // ==========================================================
// BASE URL — ito ang scan destination
// ==========================================================

const GFC_BASE = (() => {
  const fromEnv = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost = !host || host === 'localhost' || host === '127.0.0.1';
  const isLanIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

  if (isLocalhost || isLanIp) {
    return host ? `http://${host}:3002` : 'http://localhost:3002';
  }

  return typeof window !== 'undefined'
    ? window.location.origin
    : 'https://gfc-admin.up.railway.app';  // ← Railway URL
})();

// ==========================================================
// QR URL — ito ang naka-encode sa QR at nakadisplay
// ==========================================================

const getUploadUrl = (eventId: string, dateValue: string) => {
  return (
    `${GFC_BASE}/upload` +
    `?event=${encodeURIComponent(eventId)}` +
    `&date=${encodeURI(dateValue.replace(/\s+/g, ''))}`
  );
};

  // ==========================================================
  // STATE
  // ==========================================================

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [newDateInput, setNewDateInput] = useState('');
  const [addDateError, setAddDateError] = useState('');
  const [deletingDate, setDeletingDate] = useState(false);
  const [addingDate, setAddingDate] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const photoFileInputRef = useRef<HTMLInputElement>(null);

  // Facebook Import State
  const [facebookUrl, setFacebookUrl] = useState('');
  const [facebookImporting, setFacebookImporting] = useState(false);
  const [facebookStatus, setFacebookStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [facebookMessage, setFacebookMessage] = useState('');

  // ==========================================================
  // NORMALIZE EVENT
  // ==========================================================

  const normalizeEvent = (event: ChurchEvent): ChurchEvent => {
    const isYear = isYearAlbumEvent(event);

    if (Array.isArray(event.dateEntries) && event.dateEntries.length > 0) {
      const sorted = event.dateEntries
        .map((entry: DateEntry) => ({
          ...entry,
          date: String(entry.date ?? '').trim(),
          photos: Array.isArray(entry.photos) ? entry.photos : []
        }))
        .filter(entry => (isYear ? !isScheduleEntry(entry.date) : isConcreteDate(entry.date)));

      sorted.sort(
        isYear
          ? (a, b) => ordinalOf(a.date) - ordinalOf(b.date) || String(a.date).localeCompare(String(b.date))
          : (a, b) => {
            const dateA = new Date(a.date).getTime() || 0;
            const dateB = new Date(b.date).getTime() || 0;
            return dateA - dateB;
          }
      );

      return { ...event, dateEntries: sorted };
    }

    if (event.date && !isScheduleEntry(event.date)) {
      return {
        ...event,
        dateEntries: [{ date: String(event.date).trim(), photos: [] }]
      };
    }

    return { ...event, dateEntries: [] };
  };

  // ==========================================================
  // SELECTED EVENT
  // ==========================================================

  const getSelectedEvent = (): ChurchEvent | undefined => {
    const event = events.find(e => e.id === selectedEventId);
    if (!event) return undefined;
    return normalizeEvent(event);
  };

  const isGospelNetwork = false; // Alisin ang espesyal na handling

  // ==========================================================
  // SELECTED DATE
  // ==========================================================

  const getSelectedDateEntry = (): DateEntry | null => {
    const event = getSelectedEvent();
    if (
      !event ||
      !Array.isArray(event.dateEntries) ||
      selectedDateIndex < 0 ||
      selectedDateIndex >= event.dateEntries.length
    ) {
      return null;
    }
    return event.dateEntries[selectedDateIndex] ?? null;
  };

  const getSelectedDateValue = (): string => {
    const entry = getSelectedDateEntry();
    return entry?.date ? String(entry.date).trim() : '';
  };

  const getSelectedUploadUrl = (): string => {
    return getUploadUrl(selectedEventId || 'none', getSelectedDateValue());
  };

  // ==========================================================
  // COLLECT ALL EXISTING PHOTOS
  // ==========================================================

  const collectExistingPhotoRefs = (): { resource: string; location: string }[] => {
    const refs: { resource: string; location: string }[] = [];

    for (const ev of events) {
      const normalized = normalizeEvent(ev);
      if (!Array.isArray(normalized.dateEntries)) continue;

      normalized.dateEntries.forEach(entry => {
        (entry.photos || []).forEach((photo: string) => {
          refs.push({
            resource: photo,
            location: `${normalized.title} • ${entry.date}`
          });
        });
      });
    }

    for (const album of allPhotos) {
      if (!Array.isArray(album?.photos)) continue;

      const monthName = new Date(0, album.month).toLocaleString('default', { month: 'long' });
      const albumLocation = `All Photos • ${monthName} ${album.year}`;

      album.photos.forEach((photo: string) => {
        refs.push({ resource: photo, location: albumLocation });
      });
    }

    return refs;
  };

  // ==========================================================
  // DUPLICATE CHECK
  // ==========================================================

  const checkDuplicateForNewPhoto = async (
    dataUrl: string,
    hash: string | null
  ): Promise<{ isDuplicate: boolean; location: string | null }> => {

    const refs = collectExistingPhotoRefs();

    const exact = refs.find(r => r.resource === dataUrl);
    if (exact) return { isDuplicate: true, location: exact.location };
    if (!hash) return { isDuplicate: false, location: null };

    for (const ref of refs) {
      if (!ref.resource.startsWith('data:')) continue;
      const refHash = await sha256String(ref.resource);
      if (refHash && refHash === hash) {
        return { isDuplicate: true, location: ref.location };
      }
    }

    for (const ref of refs) {
      if (ref.resource.startsWith('data:')) continue;
      const resolved = ref.resource.startsWith('http')
        ? ref.resource
        : GFC_BASE + (ref.resource.startsWith('/') ? ref.resource : '/' + ref.resource);

      const refHash = await hashRemoteResource(resolved);
      if (refHash && refHash === hash) {
        return { isDuplicate: true, location: ref.location };
      }
    }

    return { isDuplicate: false, location: null };
  };

  // ==========================================================
  // AUTO SELECT EVENT
  // ==========================================================

  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      const eventToSelect =
        events.find(event => {
          const normalized = normalizeEvent(event);
          return normalized.dateEntries && normalized.dateEntries.length > 0;
        }) || events[0];

      setSelectedEventId(eventToSelect.id);
      setSelectedDateIndex(0);
    }
  }, [events, selectedEventId]);

  // ==========================================================
  // IF CURRENT EVENT DISAPPEARED
  // ==========================================================

  useEffect(() => {
    if (selectedEventId && !events.some(e => e.id === selectedEventId)) {
      setSelectedEventId('');
      setSelectedDateIndex(0);
      handleResetUpload();
    }
  }, [events, selectedEventId]);

  // ==========================================================
  // QR CODE
  // ==========================================================

  // ==========================================================
  // RESIZE IMAGE
  // ==========================================================

  const resizeImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();

      reader.onload = () => {
        img.onload = () => {
          const MAX = 1200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };

        img.onerror = reject;
        img.src = reader.result as string;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // ==========================================================
  // PHOTO SELECTION
  // ==========================================================

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploadStatus('loading');
    setUploadProgress(0);

    const photos: UploadedPhoto[] = [];
    const totalFiles = files.length;
    let processed = 0;

    for (const file of Array.from(files)) {
      if (!file || !file.type || !file.type.startsWith('image')) continue;

      try {
        const imageData = await resizeImage(file);
        const hash = await sha256String(imageData);
        const duplicate = await checkDuplicateForNewPhoto(imageData, hash);

        photos.push({
          id: nextPhotoId(),
          dataUrl: imageData,
          hash,
          isDuplicate: duplicate.isDuplicate,
          duplicateLocation: duplicate.location
        });

        processed++;
        setUploadProgress(Math.round((processed / totalFiles) * 100));
      } catch {
        // Skip unreadable image
      }
    }

    if (photos.length > 0) {
      setUploadedPhotos(prev => [...prev, ...photos]);
      setUploadStatus('idle');
      setErrorMessage('');
    } else {
      setUploadStatus('idle');
    }

    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = '';
    }
  };

  // ==========================================================
  // REMOVE PHOTO
  // ==========================================================

  const handleRemoveUploadedPhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // ==========================================================
  // SAVE PHOTOS
  // ==========================================================

  const handleSavePhotosToEvent = async () => {
    if (!selectedEventId) {
      setErrorMessage('Please select an event first.');
      return;
    }

    if (uploadedPhotos.length === 0) {
      setErrorMessage('Please select photos to upload.');
      return;
    }

    const uploadable = uploadedPhotos.filter(p => !p.isDuplicate);
    if (uploadable.length === 0) {
      setErrorMessage(
        'All selected photos are duplicates (existing already). Click the X to remove them, then upload again.'
      );
      return;
    }

    setIsUploading(true);
    setUploadStatus('loading');
    setUploadProgress(0);
    setErrorMessage('');

    try {
      const rawEvent = events.find(e => e.id === selectedEventId);
      if (!rawEvent) {
        setErrorMessage('Event not found. Please reload the data.');
        setIsUploading(false);
        return;
      }

      const event = normalizeEvent(rawEvent);
      if (!Array.isArray(event.dateEntries)) {
        setErrorMessage('Event date information could not be found.');
        setIsUploading(false);
        return;
      }

      const isGospel = String(rawEvent.id) === 'gospel-network';

      const targetIndex =
        selectedDateIndex >= 0 && selectedDateIndex < event.dateEntries.length
          ? selectedDateIndex
          : 0;

      const targetEntry = event.dateEntries[targetIndex] ?? null;

      if (!targetEntry) {
        setErrorMessage('Selected date album was not found.');
        setIsUploading(false);
        return;
      }

      const albumEntry: DateEntry = targetEntry;

      const currentPhotos = Array.isArray(albumEntry.photos) ? albumEntry.photos : [];
      const existingPhotoSet = new Set(currentPhotos);

      const newPhotos = uploadable
        .map(p => p.dataUrl)
        .filter(photo => !existingPhotoSet.has(photo));

      if (newPhotos.length === 0) {
        setErrorMessage('The selected photos already exist in this album.');
        setIsUploading(false);
        return;
      }

      const updatedEntries = isGospel
        ? [...(event.dateEntries || []), { date: albumEntry.date, photos: newPhotos }]
        : event.dateEntries.map((entry, index) => {
            if (index !== targetIndex) return entry;
            return {
              ...entry,
              date: String(entry.date).trim(),
              photos: [...(entry.photos || []), ...newPhotos]
            };
          });

      const finalEntries = mergeDateEntriesIntoRaw(rawEvent.dateEntries, updatedEntries);

      const updatedEvent: ChurchEvent = { ...rawEvent, dateEntries: finalEntries };

      await apiUpdateRecord('events', rawEvent.id, { dateEntries: finalEntries });

      if (onUpdateEvent) {
        onUpdateEvent(updatedEvent);
      }

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const dateLabel = albumEntry.date || rawEvent.date || `${currentMonth + 1}/${currentYear}`;

      for (let index = 0; index < newPhotos.length; index++) {
        const photoData = newPhotos[index];
        setUploadProgress(Math.round(((index + 1) / newPhotos.length) * 100));

        try {
          const response = await fetch(`${GFC_BASE}/api/uploads/all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: photoData,
              month: currentMonth,
              year: currentYear,
              date: dateLabel
            })
          });

          if (!response.ok) {
            console.warn('Failed to save photo to All Photos:', response.status);
          }
        } catch (err) {
          console.warn('Error saving photo to All Photos:', err);
        }
      }

      if (onAllPhotosUpdated) {
        onAllPhotosUpdated();
      }

      setUploadStatus('success');
      setUploadProgress(100);
      setUploadedPhotos([]);

      setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 3000);

    } catch (error) {
      console.error('Error uploading photos:', error);
      setUploadStatus('error');
      setErrorMessage('Error uploading photos. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // ==========================================================
  // ADD DATE
  // ==========================================================

  const handleAddDate = async () => {
  const rawEvent = events.find(e => e.id === selectedEventId);
  const value = newDateInput.trim();

  if (!rawEvent) {
    setAddDateError('Please select an event first.');
    return;
  }

  if (!value) {
    setAddDateError(
      isYearAlbumEvent(rawEvent)
        ? 'Please enter a year album name first.'
        : 'Please enter a date first.'
    );
    return;
  }

  const isYear = isYearAlbumEvent(rawEvent);
  const isGospelNetwork = String(rawEvent.id) === 'gospel-network';

  if (!isYear) {
    if (isGospelNetwork) {
      // GOSPEL NETWORK: Month Year format ("August 2026")
      if (!isMonthYear(value)) {
        setAddDateError(
          'Please enter a real date as "Month Year" (e.g. August 2026).'
        );
        return;
      }
    } else {
      // Iba pang events: Month Day, Year format ("August 14, 2026")
      if (!isMonthDayYear(value)) {
        setAddDateError(
          'Please enter a real date as "Month Day, Year" (e.g. August 14, 2026).'
        );
        return;
      }
    }
  } else {
    if (isScheduleEntry(value)) {
      setAddDateError('Please enter a year like "3rd Year Anniversary" (not a schedule).');
      return;
    }

    if (isConcreteDate(value)) {
      setAddDateError('Please enter a year like "1st Year Anniversary" (not a calendar date).');
      return;
    }
  }

  // Conversion: GOSPEL NETWORK → Month Year; iba pa → Month Day, Year
  const valueDate = isYear
    ? value
    : isGospelNetwork
      ? toMonthYear(value)
      : toMonthDayYear(value);

  const event = normalizeEvent(rawEvent);
  const entries = Array.isArray(event.dateEntries) ? event.dateEntries : [];

  const dateAlreadyExists = entries.some(
    entry => dateKey(entry.date) === dateKey(valueDate)
  );

  if (dateAlreadyExists) {
    setAddDateError(`The album "${value}" already exists in this event.`);
    return;
  }

  const updatedEntries = [...entries, { date: valueDate, photos: [] }];
  const savedDateEntries = mergeDateEntriesIntoRaw(rawEvent.dateEntries, updatedEntries);

  const updatedEvent: ChurchEvent = { ...rawEvent, dateEntries: savedDateEntries };

  setAddingDate(true);
  setAddDateError('');

  try {
    await apiUpdateRecord('events', rawEvent.id, { dateEntries: savedDateEntries });

    if (onUpdateEvent) {
      onUpdateEvent(updatedEvent);
    }

    setNewDateInput('');

    const savedNormalized = normalizeEvent(updatedEvent);
    const finalEntries = savedNormalized.dateEntries ?? [];
    const nextIndex = finalEntries.findIndex(
      (entry: DateEntry) => dateKey(entry.date) === dateKey(valueDate)
    );

    setSelectedDateIndex(nextIndex >= 0 ? nextIndex : finalEntries.length - 1);

  } catch (error) {
    console.error('Error adding date:', error);
    setAddDateError('Error adding date. Please try again.');
    setAddingDate(false);
    return;
  }

  setAddingDate(false);
};

  // ==========================================================
  // DELETE ALBUM (WHOLE ALBUM)
  // ==========================================================

  const handleDeleteAlbum = async () => {
    if (selectedDateIndex === null || selectedDateIndex < 0) return;

    const rawEvent = events.find(e => e.id === selectedEventId);
    if (!rawEvent) return;

    const norm = normalizeEvent(rawEvent);
    const list = Array.isArray(norm.dateEntries) ? norm.dateEntries : [];

    if (selectedDateIndex >= list.length) return;

    const target = list[selectedDateIndex];
    const targetKey = dateKey(String(target.date));
    const targetPhotos = Array.isArray(target.photos) ? target.photos : [];

    if (
      !window.confirm(
        `Delete the whole album "${target.date}" (${targetPhotos.length} photo${targetPhotos.length === 1 ? '' : 's'})?\n\nThe album and all its photos will be removed from the website and cannot be undone.`
      )
    ) {
      return;
    }

    const savedDateEntries = (
      Array.isArray(rawEvent.dateEntries) ? rawEvent.dateEntries : []
    ).filter(rawEntry => dateKey(rawEntry.date) !== targetKey);

    const updatedEvent: ChurchEvent = { ...rawEvent, dateEntries: savedDateEntries };

    setDeletingDate(true);

    try {
      await apiUpdateRecord('events', rawEvent.id, { dateEntries: savedDateEntries });

      if (onUpdateEvent) {
        onUpdateEvent(updatedEvent);
      }

      setSelectedDateIndex(0);
    } catch (error) {
      console.error('Error deleting album:', error);
      window.alert('Error deleting album. Please try again.');
      return;
    }

    setDeletingDate(false);
  };

  // ==========================================================
  // IMPORT FROM FACEBOOK
  // ==========================================================

  const handleFacebookImport = async () => {
    const url = facebookUrl.trim();

    if (!selectedEventId) {
      setFacebookStatus('error');
      setFacebookMessage('Please select an event first.');
      return;
    }

    if (!getSelectedDateEntry()) {
      setFacebookStatus('error');
      setFacebookMessage('Please select a date album first.');
      return;
    }

    if (!url) {
      setFacebookStatus('error');
      setFacebookMessage('Please paste a Facebook URL.');
      return;
    }

    if (
      !/^https?:\/\/(www\.|m\.|web\.)?facebook\.com\//i.test(url) &&
      !/^https?:\/\/fb\.watch\//i.test(url)
    ) {
      setFacebookStatus('error');
      setFacebookMessage('Please enter a valid Facebook URL.');
      return;
    }

    setFacebookImporting(true);
    setFacebookStatus('idle');
    setFacebookMessage('');

    try {
      const response = await fetch(`${API_URL}/api/facebook/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          eventId: selectedEventId,
          date: getSelectedDateValue(),
          dateIndex: selectedDateIndex,
          autoCreateAlbum: false
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to import from Facebook.');
      }

      setFacebookStatus('success');
      setFacebookMessage(data?.message || 'Imported successfully!');
      setFacebookUrl('');

      onReload?.();
      onAllPhotosUpdated?.();

      setTimeout(() => {
        setFacebookStatus('idle');
        setFacebookMessage('');
      }, 5000);

    } catch (error) {
      console.error('Facebook import error:', error);
      setFacebookStatus('error');
      setFacebookMessage(
        error instanceof Error ? error.message : 'Failed to import from Facebook.'
      );
    } finally {
      setFacebookImporting(false);
    }
  };

  // ==========================================================
  // RESET
  // ==========================================================

  const handleResetUpload = () => {
    setUploadedPhotos([]);
    setUploadStatus('idle');
    setErrorMessage('');
    setUploadProgress(0);

    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = '';
    }
  };

  // ==========================================================
  // NO EVENTS
  // ==========================================================

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
          <h3 className="text-sm font-bold text-black dark:text-white mb-2 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-500" />
            <span>Event QR Code Generator</span>
          </h3>

          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
            Upload page: {GFC_BASE}
          </div>

          <div className="mt-2 text-xs text-emerald-500 dark:text-emerald-400">
            ✅ GFC QR code image + upload link
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No events found.</p>

          {onReload && (
            <button
              onClick={onReload}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Data
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
        <h3 className="text-sm font-bold text-black dark:text-white mb-2 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-500" />
          <span>Event QR Code Generator</span>
        </h3>

        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
          Upload page: {GFC_BASE}
        </div>
      </div>

      {/* SELECTION */}
      <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* LEFT */}
          <div className="space-y-4">

            {/* EVENT */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">
                Select Event
              </label>

              <select
                value={selectedEventId}
                onChange={e => {
                  setSelectedEventId(e.target.value);
                  setSelectedDateIndex(e.target.value === 'gospel-network' ? -1 : 0);
                  handleResetUpload();
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
              >
                <option value="">Select Event</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>
            </div>

            {/* DATE ALBUM */}
            {selectedEventId && getSelectedEvent() && (() => {
              const selectedEvent = getSelectedEvent()!;
              const isYearAlbum = isYearAlbumEvent(selectedEvent);

              const albumLabel = isYearAlbum ? 'Year Album' : 'Date Album';
              const albumAddLabel = isYearAlbum ? 'Add Year Album' : 'Add Date Album';
              const albumPlaceholder = isYearAlbum ? 'e.g. 1st Year Anniversary' : 'e.g. August 18, 2026';

              const hasDates =
                Array.isArray(selectedEvent.dateEntries) &&
                selectedEvent.dateEntries.length > 0;

              return (
                <>
                  {hasDates && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">
                        Select {albumLabel} (for upload)
                      </label>

                      <select
                        value={selectedDateIndex}
                        onChange={e => {
                          setSelectedDateIndex(parseInt(e.target.value, 10));
                          handleResetUpload();
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                      >
                        {selectedEvent.dateEntries?.map((entry, index) => (
                          <option key={`${entry.date}-${index}`} value={index}>{entry.date}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void handleDeleteAlbum()}
                        disabled={deletingDate}
                        className="mt-2 w-full px-4 py-2 rounded-xl border border-red-200 dark:border-red-400/30 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {deletingDate ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Deleting...
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Selected Album
                          </span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* ADD DATE */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">
                      {albumAddLabel}
                    </label>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDateInput}
                        onChange={e => {
                          setNewDateInput(e.target.value);
                          setAddDateError('');
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') void handleAddDate();
                        }}
                        placeholder={albumPlaceholder}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                      />

                      <button
                        onClick={() => void handleAddDate()}
                        disabled={addingDate}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all"
                      >
                        {addingDate ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CalendarPlus className="w-4 h-4" />
                        )}
                        {isYearAlbum ? 'Add Year' : 'Add Date'}
                      </button>
                    </div>

                    {addDateError && (
                      <p className="mt-2 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {addDateError}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* SELECTED */}
            {selectedEventId && getSelectedDateEntry() && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-400/30">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Selected:</span>
                  <span className="text-black dark:text-white">{getSelectedEvent()?.title}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-black dark:text-white">{getSelectedDateEntry()?.date}</span>
                </div>
              </div>
            )}
          </div>

          {/* QR */}
          <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-black rounded-xl border border-white dark:border-white">
            {selectedEventId && getSelectedDateEntry() ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="w-5 h-5 text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">
                    GFC QR Code
                  </span>
                </div>

                <div className="bg-white rounded-xl shadow-md p-2">
                  <QRCodeCanvas
                    value={getSelectedUploadUrl()}
                    size={320}
                    level="H"
                    fgColor="#111827"
                    bgColor="#ffffff"
                    marginSize={4}
                    imageSettings={{
                      src: '/image-circle.png',
                      width: 38,
                      height: 38,
                      excavate: true
                    }}
                  />
                </div>

                <a
                  href={getSelectedUploadUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-[11px] font-mono text-indigo-500 dark:text-indigo-400 underline break-all text-center block hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  {getSelectedUploadUrl()}
                </a>
              </>
            ) : (
              <div className="text-center py-6">
                <QrCode className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Select Event & Date</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* UPLOAD */}
      {selectedEventId && getSelectedDateEntry() && (
        <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">

          <h4 className="text-sm font-bold text-black dark:text-white mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-500" />
            Upload Photos to Event
          </h4>

          {/* BUTTONS */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md">
              <Image className="w-4 h-4" />
              Select Photos
              <input
                ref={photoFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleResetUpload}
              className="px-4 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-[#A1A1A1] rounded-xl text-xs font-bold transition-all border border-gray-200 dark:border-white/10"
            >
              Clear All
            </button>
          </div>

          {/* IMPORT FROM FACEBOOK */}
          <div className="mt-5 pt-5 border-t border-gray-200 dark:border-white/10">
            <h5 className="text-xs font-bold text-black dark:text-white mb-2 flex items-center gap-2">
              Import from Facebook
            </h5>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
              {' '}
              {isGospelNetwork ? (
                <>
                  {' '}
                  <strong>{getSelectedEvent()?.title}</strong>
                </>
              ) : (
                <>
                  {' '}
                  <strong>{getSelectedEvent()?.title}</strong> •{' '}
                  <strong>{getSelectedDateEntry()?.date}</strong>
                </>
              )}
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={facebookUrl}
                onChange={e => {
                  setFacebookUrl(e.target.value);
                  if (facebookStatus !== 'idle') {
                    setFacebookStatus('idle');
                    setFacebookMessage('');
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !facebookImporting) {
                    void handleFacebookImport();
                  }
                }}
                placeholder="Import Facebook Link"
                disabled={facebookImporting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all disabled:opacity-50"
              />

              <button
                onClick={() => void handleFacebookImport()}
                disabled={facebookImporting || !facebookUrl.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md whitespace-nowrap"
              >
                {facebookImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing
                  </>
                ) : (
                  <>
                    Import
                  </>
                )}
              </button>
            </div>

            {facebookStatus === 'success' && facebookMessage && (
              <p className="mt-2 text-xs text-emerald-500 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" />
                {facebookMessage}
              </p>
            )}

            {facebookStatus === 'error' && facebookMessage && (
              <p className="mt-2 text-xs text-red-500 dark:text-red-400 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />
                {facebookMessage}
              </p>
            )}
          </div>

          {/* PROGRESS */}
          {uploadStatus === 'loading' && uploadProgress > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>Processing...</span>
                <span>{uploadProgress}%</span>
              </div>

              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* PREVIEWS */}
          {uploadedPhotos.length > 0 && (
            <div className="mt-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {uploadedPhotos.map((photo, index) => {
                  const isDuplicate = photo.isDuplicate;
                  const location = photo.duplicateLocation;

                  return (
                    <div key={photo.id} className="relative group">
                      <div
                        className={`relative rounded-xl overflow-hidden aspect-square bg-gray-100 dark:bg-black/20 ${
                          isDuplicate
                            ? 'border-2 border-red-500'
                            : 'border border-gray-200 dark:border-white/10'
                        }`}
                      >
                        <img
                          src={photo.dataUrl}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-full object-cover"
                        />

                        <button
                          onClick={() => handleRemoveUploadedPhoto(index)}
                          className={`absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 text-white rounded-full shadow-lg transition-all ${
                            isDuplicate ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title={
                            isDuplicate
                              ? 'Remove duplicate from selection'
                              : 'Remove photo from selection'
                          }
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>

                        {isDuplicate && (
                          <>
                            <div className="absolute top-0 left-0 m-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                              Duplicate
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 bg-red-500/85 text-white text-[9px] px-1.5 py-0.5 truncate">
                              📍 {location || 'Already exists'}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="mt-1 text-[9px] text-gray-400 dark:text-gray-500 truncate">
                        Photo {index + 1}
                        {isDuplicate && <span className="text-red-400 ml-1">(duplicate)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {uploadedPhotos.length} photo{uploadedPhotos.length > 1 ? 's' : ''} selected
                {(() => {
                  const dupCount = uploadedPhotos.filter(p => p.isDuplicate).length;
                  return dupCount > 0 ? (
                    <span className="text-red-400 ml-2">
                      ⚠️ {dupCount} photo{dupCount > 1 ? 's are' : ' is'} duplicate
                      {dupCount > 1 ? 's' : ''} (click X to remove)
                    </span>
                  ) : null;
                })()}
              </p>
            </div>
          )}

          {/* SAVE */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleSavePhotosToEvent}
              disabled={uploadedPhotos.length === 0 || isUploading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading
                </>
              ) : (
                <>
                  Save to Event & All Photos
                </>
              )}
            </button>

            {uploadStatus === 'success' && (
              <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400 text-sm font-bold">
                <CheckCircle className="w-4 h-4" />
                Photos Saved!
              </span>
            )}

            {errorMessage && (
              <span className="flex items-center gap-1 text-red-500 dark:text-red-400 text-sm font-bold">
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};