// GFC-ADMIN/src/pages/QRCodePage.tsx

import React, { useEffect, useState, useRef } from 'react';
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
  CalendarPlus
} from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import { updateRecord as apiUpdateRecord } from '../api';

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

// SHA-256 caches so repeated selections do not re-hash the same data.
const stringHashCache = new Map<string, string | null>();
const pathHashCache = new Map<string, string | null>();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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

interface QRCodePageProps {
  events: ChurchEvent[];
  onUpdateEvent?: (updatedEvent: ChurchEvent) => void;
  onReload?: () => void;
  allPhotos?: AllPhotoAlbum[];
  onAllPhotosUpdated?: () => void;
}

export const QRCodePage: React.FC<QRCodePageProps> = ({
  events,
  onUpdateEvent,
  onReload,
  allPhotos = [],
  onAllPhotosUpdated
}) => {
  const GFC_BASE = (() => {
    const fromEnv = (import.meta.env.VITE_GFC_URL as string | undefined)?.trim();

    if (fromEnv) return fromEnv;

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
      : 'https://gfc-admin-rosy.vercel.app';
  })();

  /*
   * IMPORTANT:
   * The QR URL must use the ACTUAL DATE VALUE, not the array index.
   * No re-encoding trick - the month must not be converted.
   *
   * Example:
   * selectedDateIndex = 11
   * selected entry = { date: "August 30", photos: [...] }
   *
   * QR URL:
   * /upload?event=sunday&date=August30
   *
   * NOT:
   * /upload?event=sunday&date=11
   *
   * Spaces are removed so the URL has no %20 encoding:
   * "August 30" -> "August30"
   */
  const getUploadUrl = (eventId: string, dateValue: string) =>
    `${GFC_BASE}/upload?event=${encodeURIComponent(eventId)}&date=${encodeURIComponent(dateValue.replace(/\s+/g, ''))}`;

  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [newDateInput, setNewDateInput] = useState('');
  const [addDateError, setAddDateError] = useState('');
  const [addingDate, setAddingDate] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const [qrContainerEl, setQrContainerEl] =
    useState<HTMLDivElement | null>(null);
  const qrStylingRef = useRef<QRCodeStyling | null>(null);

  const getSelectedEvent = (): ChurchEvent | undefined =>
    events.find(e => e.id === selectedEventId);

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

    return event.dateEntries[selectedDateIndex];
  };

  /*
   * Get the actual selected date value.
   *
   * selectedDateIndex is ONLY used internally to locate the selected
   * DateEntry. The QR code itself receives entry.date.
   */
  const getSelectedDateValue = (): string => {
    const entry = getSelectedDateEntry();

    return entry?.date
      ? String(entry.date).trim()
      : '';
  };

  const getSelectedUploadUrl = (): string => {
    const dateValue = getSelectedDateValue();

    return getUploadUrl(
      selectedEventId || 'none',
      dateValue
    );
  };

  /*
   * Collect every existing photo across ALL events/date entries + All Photos.
   * The location label always uses the real date value (entry.date), never
   * the array index.
   */
  const collectExistingPhotoRefs = (): {
    resource: string;
    location: string;
  }[] => {
    const refs: { resource: string; location: string }[] = [];

    for (const ev of events) {
      if (!Array.isArray(ev.dateEntries)) continue;

      ev.dateEntries.forEach(entry => {
        (entry.photos || []).forEach((photo: string) => {
          refs.push({
            resource: photo,
            location: `${ev.title} • ${entry.date}`
          });
        });
      });
    }

    for (const album of allPhotos) {
      if (!Array.isArray(album?.photos)) continue;

      const monthName = new Date(
        0,
        album.month
      ).toLocaleString('default', {
        month: 'long'
      });

      const albumLocation =
        `All Photos • ${monthName} ${album.year}`;

      album.photos.forEach((photo: string) => {
        refs.push({
          resource: photo,
          location: albumLocation
        });
      });
    }

    return refs;
  };

  /*
   * Content-based image identity check.
   *
   * 1. Exact-string match (stored string === resized data URL). Both the admin
   *    and the public uploader re-encode with canvas.toDataURL('image/jpeg',
   *    0.75), so the SAME source image produces the SAME stored string.
   * 2. SHA-256 hash of the stored photo string vs the selected image hash.
   * 3. Best-effort: path-based photos (e.g. seed images) are fetched and
   *    hashed on the fly. Cross-origin/CORS failures are treated as
   *    "not duplicate" and never block the upload.
   */
  const checkDuplicateForNewPhoto = async (
    dataUrl: string,
    hash: string | null
  ): Promise<{
    isDuplicate: boolean;
    location: string | null;
  }> => {
    const refs = collectExistingPhotoRefs();

    const exact = refs.find(r => r.resource === dataUrl);
    if (exact) {
      return { isDuplicate: true, location: exact.location };
    }

    if (!hash) {
      return { isDuplicate: false, location: null };
    }

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

  /*
   * Auto-select a sensible event on load.
   */
  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      const firstWithAlbum = events.find(
        e =>
          Array.isArray(e.dateEntries) &&
          e.dateEntries.length > 0
      );

      const eventToSelect =
        firstWithAlbum || events[0];

      setSelectedEventId(eventToSelect.id);
      setSelectedDateIndex(0);
    }
  }, [events, selectedEventId]);

  /*
   * Create the QR code.
   *
   * IMPORTANT:
   * Use the actual selected date value instead of selectedDateIndex.
   */
  useEffect(() => {
    if (!qrContainerEl) return;

    qrContainerEl.innerHTML = '';

    const qr = new QRCodeStyling({
      width: 260,
      height: 260,
      margin: 0,
      data: getSelectedUploadUrl(),
      image: '/image-circle.png',
      imageOptions: {
        imageSize: 0.4,
        margin: 8,
        crossOrigin: 'anonymous'
      },
      qrOptions: {
        errorCorrectionLevel: 'H',
        typeNumber: 0
      },
      dotsOptions: {
        color: '#1a1a2e',
        type: 'rounded'
      },
      cornersSquareOptions: {
        color: '#1a1a2e',
        type: 'extra-rounded'
      },
      backgroundOptions: {
        color: '#ffffff',
        round: 8
      }
    });

    qr.append(qrContainerEl);
    qrStylingRef.current = qr;

    return () => {
      qrStylingRef.current = null;
    };
  }, [
    qrContainerEl,
    selectedEventId,
    selectedDateIndex,
    events
  ]);

  /*
   * Update QR whenever the selected event/date changes.
   *
   * The date value comes from the selected DateEntry,
   * NOT from selectedDateIndex.
   */
  useEffect(() => {
    if (!qrStylingRef.current || !selectedEventId) return;

    qrStylingRef.current.update({
      data: getSelectedUploadUrl()
    });
  }, [
    selectedEventId,
    selectedDateIndex,
    events,
    qrContainerEl
  ]);

  /*
   * Resize image for faster upload.
   */
  const resizeImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();

      reader.onload = () => {
        img.onload = () => {
          const MAX = 1200;

          const scale = Math.min(
            1,
            MAX / Math.max(img.width, img.height)
          );

          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);

          const canvas = document.createElement('canvas');

          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext('2d');

          if (!ctx) {
            return reject(
              new Error('Canvas not supported')
            );
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);

          ctx.drawImage(
            img,
            0,
            0,
            w,
            h
          );

          resolve(
            canvas.toDataURL(
              'image/jpeg',
              0.75
            )
          );
        };

        img.onerror = reject;
        img.src = reader.result as string;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /*
   * Handle photo selection.
   */
  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;

    if (!files) return;

    setUploadStatus('loading');
    setUploadProgress(0);

    const photos: UploadedPhoto[] = [];
    const totalFiles = files.length;

    let processed = 0;

    for (const file of Array.from(files)) {
      if (
        file &&
        file.type &&
        file.type.indexOf('image') === 0
      ) {
        try {
          const imageData =
            await resizeImage(file);

          const hash =
            await sha256String(imageData);

          const duplicate =
            await checkDuplicateForNewPhoto(
              imageData,
              hash
            );

          photos.push({
            id: nextPhotoId(),
            dataUrl: imageData,
            hash,
            isDuplicate: duplicate.isDuplicate,
            duplicateLocation: duplicate.location
          });

          processed++;

          setUploadProgress(
            Math.round(
              (processed / totalFiles) * 100
            )
          );
        } catch {
          // Skip unreadable image
        }
      }
    }

    if (photos.length > 0) {
      setUploadedPhotos(prev => [
        ...prev,
        ...photos
      ]);

      setUploadStatus('idle');
      setErrorMessage('');
    } else {
      setUploadStatus('idle');
    }

    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = '';
    }
  };

  const handleRemoveUploadedPhoto = (
    index: number
  ) => {
    setUploadedPhotos(prev =>
      prev.filter((_, i) => i !== index)
    );
  };

  /*
   * Save photos to the selected event and All Photos.
   */
  const handleSavePhotosToEvent = async () => {
    if (!selectedEventId) {
      setErrorMessage(
        'Please select an event first.'
      );
      return;
    }

    if (uploadedPhotos.length === 0) {
      setErrorMessage(
        'Please select photos to upload.'
      );
      return;
    }

    /*
     * IMPORTANT: duplicates are NEVER uploaded. Only remove them from the
     * current selection via X; the existing database photos stay untouched.
     */
    const uploadable = uploadedPhotos.filter(
      p => !p.isDuplicate
    );

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
      const event = getSelectedEvent();

      if (
        !event ||
        !Array.isArray(event.dateEntries)
      ) {
        setErrorMessage(
          'Event or date entry not found.'
        );

        setIsUploading(false);
        return;
      }

      const targetIndex =
        selectedDateIndex >= 0 &&
        selectedDateIndex <
          event.dateEntries.length
          ? selectedDateIndex
          : 0;

      const currentPhotos =
        event.dateEntries[targetIndex]?.photos || [];

      const existingPhotoSet =
        new Set(currentPhotos);

      const newPhotos =
        uploadable
          .map(p => p.dataUrl)
          .filter(
            (p: string) =>
              !existingPhotoSet.has(p)
          );

      const updatedPhotos = [
        ...currentPhotos,
        ...newPhotos
      ];

      const updatedEntries = [
        ...event.dateEntries
      ];

      updatedEntries[targetIndex] = {
        ...updatedEntries[targetIndex],
        photos: updatedPhotos
      };

      const updatedEvent: ChurchEvent = {
        ...event,
        dateEntries: updatedEntries
      };

      /*
       * Save to Events first.
       */
      await apiUpdateRecord(
        'events',
        event.id,
        {
          dateEntries: updatedEntries
        }
      );

      if (onUpdateEvent) {
        onUpdateEvent(updatedEvent);
      }

      /*
       * Upload to All Photos.
       */
      const now = new Date();

      const currentMonth =
        now.getMonth();

      const currentYear =
        now.getFullYear();

      const dateLabel =
        event.dateEntries[targetIndex]?.date ||
        `${currentMonth + 1}/${currentYear}`;

      const uploadPromises =
        newPhotos.map(
          (photoData, index) => {
            return fetch(
              `${GFC_BASE}/api/uploads/all`,
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json'
                },
                body: JSON.stringify({
                  image: photoData,
                  month: currentMonth,
                  year: currentYear,
                  date: dateLabel
                })
              }
            )
              .then(response => {
                setUploadProgress(
                  Math.round(
                    ((index + 1) /
                      newPhotos.length) *
                      100
                  )
                );

                if (!response.ok) {
                  console.warn(
                    'Failed to save photo to All Photos:',
                    response.status
                  );
                }

                return response;
              })
              .catch(err => {
                console.warn(
                  'Error saving photo to All Photos:',
                  err
                );
              });
          }
        );

      await Promise.all(
        uploadPromises
      );

      if (onAllPhotosUpdated) {
        onAllPhotosUpdated();
      }

      setUploadStatus('success');
      setUploadProgress(100);

      setUploadedPhotos([]);

      /*
       * Auto-hide success after 3 seconds.
       */
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 3000);
    } catch (error) {
      console.error(
        'Error uploading photos:',
        error
      );

      setUploadStatus('error');
      setErrorMessage(
        'Error uploading photos. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  /*
   * Add a new date album.
   */
  const handleAddDate = async () => {
    const event = getSelectedEvent();
    const value = newDateInput.trim();

    if (!event) {
      setAddDateError(
        'Please select an event first.'
      );
      return;
    }

    if (!value) {
      setAddDateError(
        'Please enter a date first.'
      );
      return;
    }

    const entries = Array.isArray(
      event.dateEntries
    )
      ? event.dateEntries
      : [];

    if (
      entries.some(
        (e: DateEntry) =>
          e.date === value
      )
    ) {
      setAddDateError(
        `The date "${value}" already exists in this event.`
      );
      return;
    }

    const updatedEntries = [
      ...entries,
      {
        date: value,
        photos: []
      }
    ];

    const updatedEvent: ChurchEvent = {
      ...event,
      dateEntries: updatedEntries
    };

    setAddingDate(true);
    setAddDateError('');

    try {
      await apiUpdateRecord(
        'events',
        event.id,
        {
          dateEntries: updatedEntries
        }
      );

      if (onUpdateEvent) {
        onUpdateEvent(updatedEvent);
      }

      setNewDateInput('');

      setSelectedDateIndex(
        updatedEntries.length - 1
      );
    } catch (error) {
      console.error(
        'Error adding date:',
        error
      );

      setAddDateError(
        'Error adding date. Please try again.'
      );

      setAddingDate(false);
      return;
    }

    setAddingDate(false);
  };

  /*
   * Reset selected/uploaded photos.
   */
  const handleResetUpload = () => {
    setUploadedPhotos([]);
    setUploadStatus('idle');
    setErrorMessage('');
    setUploadProgress(0);

    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = '';
    }
  };

  /*
   * No events.
   */
  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
          <h3 className="text-sm font-bold text-black dark:text-white mb-2 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-500" />

            <span>
              Event QR Code Generator
            </span>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
        <h3 className="text-sm font-bold text-black dark:text-white mb-2 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-500" />

          <span>
            Event QR Code Generator
          </span>
        </h3>

        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
          Upload page: {GFC_BASE}
        </div>
      </div>

      {/* Selection Section */}
      <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Event Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">
                Select Event
              </label>

              <select
                value={selectedEventId}
                onChange={e => {
                  setSelectedEventId(
                    e.target.value
                  );

                  setSelectedDateIndex(0);

                  handleResetUpload();
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
              >
                <option value="">
                  -- Select an event --
                </option>

                {events.map(event => (
                  <option
                    key={event.id}
                    value={event.id}
                  >
                    {event.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedEventId &&
              getSelectedEvent() &&
              (() => {
                const selectedEvent =
                  getSelectedEvent()!;

                const hasDates =
                  Array.isArray(
                    selectedEvent.dateEntries
                  ) &&
                  selectedEvent.dateEntries
                    .length > 0;

                return (
                  <>
                    {hasDates && (
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">
                          Select Date Album (for upload)
                        </label>

                        <select
                          value={
                            selectedDateIndex
                          }
                          onChange={e => {
                            setSelectedDateIndex(
                              parseInt(
                                e.target.value,
                                10
                              )
                            );

                            handleResetUpload();
                          }}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                        >
                          {selectedEvent.dateEntries?.map(
                            (
                              entry: DateEntry,
                              index: number
                            ) => (
                              <option
                                key={index}
                                value={index}
                              >
                                {entry.date}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">
                        Add Date Album
                      </label>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={
                            newDateInput
                          }
                          onChange={e => {
                            setNewDateInput(
                              e.target.value
                            );

                            setAddDateError('');
                          }}
                          onKeyDown={e => {
                            if (
                              e.key ===
                              'Enter'
                            ) {
                              void handleAddDate();
                            }
                          }}
                          placeholder="e.g. August 18, 2026"
                          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                        />

                        <button
                          onClick={() =>
                            void handleAddDate()
                          }
                          disabled={
                            addingDate
                          }
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all"
                        >
                          {addingDate ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CalendarPlus className="w-4 h-4" />
                          )}

                          Add Date
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

            {selectedEventId &&
              getSelectedDateEntry() && (
                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-400/30">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      Selected:
                    </span>

                    <span className="text-black dark:text-white">
                      {getSelectedEvent()?.title}
                    </span>

                    <span className="text-gray-400">
                      •
                    </span>

                    <span className="text-black dark:text-white">
                      {getSelectedDateEntry()?.date}
                    </span>
                  </div>
                </div>
              )}
          </div>

          {/* Right: QR Code Display */}
          <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10">
            {selectedEventId &&
            getSelectedDateEntry() ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="w-5 h-5 text-indigo-500" />

                  <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">
                    GFC QR Code
                  </span>
                </div>

                <div
                  ref={setQrContainerEl}
                  className="bg-white rounded-xl shadow-md"
                />

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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Photos */}
      {selectedEventId &&
        getSelectedDateEntry() && (
          <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
            <h4 className="text-sm font-bold text-black dark:text-white mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-500" />
              Upload Photos to Event
            </h4>

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

            {/* Progress Bar */}
            {uploadStatus === 'loading' &&
              uploadProgress > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>
                      Processing...
                    </span>

                    <span>
                      {uploadProgress}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                      style={{
                        width: `${uploadProgress}%`
                      }}
                    />
                  </div>
                </div>
              )}

            {uploadedPhotos.length >
              0 && (
              <div className="mt-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {uploadedPhotos.map(
                    (photo, index) => {
                      const isDuplicate =
                        photo.isDuplicate;

                      const location =
                        photo.duplicateLocation;

                      return (
                        <div
                          key={photo.id}
                          className="relative group"
                        >
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
                              onClick={() =>
                                handleRemoveUploadedPhoto(
                                  index
                                )
                              }
                              className={`absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 text-white rounded-full shadow-lg transition-all ${
                                isDuplicate
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100'
                              }`}
                              title={
                                isDuplicate
                                  ? 'Remove duplicate from selection (existing photo is kept)'
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
                                  📍{' '}
                                  {location ||
                                    'Already exists'}
                                </div>
                              </>
                            )}
                          </div>

                          <div className="mt-1 text-[9px] text-gray-400 dark:text-gray-500 truncate">
                            Photo {index + 1}

                            {isDuplicate && (
                              <span className="text-red-400 ml-1">
                                (duplicate)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {uploadedPhotos.length}{' '}
                  photo
                  {uploadedPhotos.length > 1
                    ? 's'
                    : ''}{' '}
                  selected
                  {(() => {
                    const dupCount =
                      uploadedPhotos.filter(
                        p => p.isDuplicate
                      ).length;
                    return dupCount > 0 ? (
                      <span className="text-red-400 ml-2">
                        ⚠️ {dupCount}{' '}
                        photo
                        {dupCount > 1 ? 's are' : ' is'}{' '}
                        duplicate
                        {dupCount > 1 ? 's' : ''}{' '}
                        (click X to remove; they will
                        NOT be uploaded)
                      </span>
                    ) : null;
                  })()}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={
                  handleSavePhotosToEvent
                }
                disabled={
                  uploadedPhotos.length ===
                    0 ||
                  isUploading
                }
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Save to Event & All Photos
                  </>
                )}
              </button>

              {uploadStatus ===
                'success' && (
                <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400 text-sm font-bold">
                  <CheckCircle className="w-4 h-4" />
                  Photos saved!
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