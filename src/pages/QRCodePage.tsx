// GFC-ADMIN/src/pages/QRCodePage.tsx

import React, { useEffect, useState, useRef } from 'react';
import { ChurchEvent, DateEntry } from '../types';
import { QrCode, AlertCircle, Upload, Image, X, CheckCircle, Loader2, RefreshCw, CalendarPlus } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import { updateRecord as apiUpdateRecord } from '../api';

interface QRCodePageProps {
  events: ChurchEvent[];
  onUpdateEvent?: (updatedEvent: ChurchEvent) => void;
  onReload?: () => void;
}

export const QRCodePage: React.FC<QRCodePageProps> = ({ events, onUpdateEvent, onReload }) => {
  // Base URL ng GFC upload page (configurable via VITE_GFC_URL).
  // Kapag naka-deploy (Vercel): same-origin (admin + API + upload page ay nasa iisang URL).
  // Kapag local: `http://<host>:4000` para ma-scan sa phone gamit LAN IP.
  const GFC_BASE = (() => {
    const fromEnv = (import.meta.env.VITE_GFC_URL as string | undefined)?.trim();
    if (fromEnv) return fromEnv;
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalhost = !host || host === 'localhost' || host === '127.0.0.1';
    const isLanIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (isLocalhost || isLanIp) {
      return host ? `http://${host}:4000` : 'http://localhost:4000';
    }
    // Deployed (e.g. Vercel) - huwag magdagdag ng port, gamitin ang current origin.
    return typeof window !== 'undefined' ? window.location.origin : 'https://gfc-admin-rosy.vercel.app';
  })();

  const getUploadUrl = (eventId: string, dateIndex: number) =>
    `${GFC_BASE}/upload?event=${encodeURIComponent(eventId)}&date=${dateIndex}`;

  // States
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadedPhotoPreviews, setUploadedPhotoPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [photoDateTitle, setPhotoDateTitle] = useState('');
  const [photoVerse, setPhotoVerse] = useState('');
  const [photoVerseRef, setPhotoVerseRef] = useState('');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [newDateInput, setNewDateInput] = useState('');
  const [addDateError, setAddDateError] = useState('');
  const [addingDate, setAddingDate] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const [qrContainerEl, setQrContainerEl] = useState<HTMLDivElement | null>(null);
  const qrStylingRef = useRef<QRCodeStyling | null>(null);

  // Auto-select a sensible event on load so a QR code always shows when possible
  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      const firstWithAlbum = events.find(e => Array.isArray(e.dateEntries) && e.dateEntries.length > 0);
      setSelectedEventId((firstWithAlbum || events[0]).id);
      setSelectedDateIndex(0);
    }
  }, [events, selectedEventId]);

  // Build the branded QR (may church logo sa gitna) - gumagana ang scan papunta sa upload page
  useEffect(() => {
    if (!qrContainerEl) return;
    qrContainerEl.innerHTML = '';
    const qr = new QRCodeStyling({
      width: 260,
      height: 260,
      margin: 0,
      data: getUploadUrl(selectedEventId || 'none', selectedDateIndex),
      image: '/image-circle.png',
      imageOptions: { imageSize: 0.4, margin: 8, crossOrigin: 'anonymous' },
      qrOptions: { errorCorrectionLevel: 'H', typeNumber: 0 },
      dotsOptions: { color: '#1a1a2e', type: 'rounded' },
      cornersSquareOptions: { color: '#1a1a2e', type: 'extra-rounded' },
      backgroundOptions: { color: '#ffffff', round: 8 },
    });
    qr.append(qrContainerEl);
    qrStylingRef.current = qr;
    return () => {
      qrStylingRef.current = null;
    };
  }, [qrContainerEl]);

  // Update the QR kapag may binago sa event/date
  useEffect(() => {
    if (!qrStylingRef.current || !selectedEventId) return;
    qrStylingRef.current.update({ data: getUploadUrl(selectedEventId, selectedDateIndex) });
  }, [selectedEventId, selectedDateIndex, qrContainerEl]);

  const getSelectedEvent = () => events.find(e => e.id === selectedEventId);
  const getSelectedDateEntry = (): DateEntry | null => {
    const event = getSelectedEvent();
    if (!event || !event.dateEntries || selectedDateIndex < 0 || selectedDateIndex >= event.dateEntries.length) {
      return null;
    }
    return event.dateEntries[selectedDateIndex];
  };

  // Resize image para hindi lumagpas sa Vercel serverless body limit (4.5MB)
  const resizeImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          const MAX = 1600;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas not supported'));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (file && file.type && file.type.indexOf('image') === 0) {
        try {
          urls.push(await resizeImage(file));
        } catch {
          /* skip unreadable image */
        }
      }
    }

    if (urls.length > 0) {
      setUploadedPhotoPreviews(prev => [...prev, ...urls]);
      setUploadedPhotos(prev => [...prev, ...urls]);
      setUploadStatus('idle');
      setErrorMessage('');
    }

    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = '';
    }
  };

  const handleRemoveUploadedPhoto = (index: number) => {
    setUploadedPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddDate = async () => {
    const event = getSelectedEvent();
    const value = newDateInput.trim();
    if (!event) {
      setAddDateError('Please select an event first.');
      return;
    }
    if (!value) {
      setAddDateError('Please enter a date first.');
      return;
    }
    const entries = Array.isArray(event.dateEntries) ? event.dateEntries : [];
    if (entries.some(e => e.date === value)) {
      setAddDateError(`The date "${value}" already exists in this event.`);
      return;
    }

    const updatedEntries = [...entries, { date: value, photos: [] }];
    const updatedEvent: ChurchEvent = { ...event, dateEntries: updatedEntries };

    setAddingDate(true);
    setAddDateError('');
    try {
      await apiUpdateRecord('events', event.id, { dateEntries: updatedEntries });
      if (onUpdateEvent) onUpdateEvent(updatedEvent);
      setNewDateInput('');
      setSelectedDateIndex(updatedEntries.length - 1);
    } catch (error) {
      setAddDateError('Error adding date. Please try again.');
      setAddingDate(false);
      return;
    }
    setAddingDate(false);
  };

  const handleSavePhotosToEvent = async () => {
    if (!selectedEventId) {
      setErrorMessage('Please select an event first.');
      return;
    }

    if (uploadedPhotos.length === 0) {
      setErrorMessage('Please select photos to upload.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('loading');
    setErrorMessage('');

    try {
      const event = getSelectedEvent();
      if (!event || !event.dateEntries) {
        setErrorMessage('Event or date entry not found.');
        setIsUploading(false);
        return;
      }

      // Use the selected date index (default 0)
      const targetIndex = selectedDateIndex >= 0 && selectedDateIndex < event.dateEntries.length ? selectedDateIndex : 0;
      const currentPhotos = event.dateEntries[targetIndex]?.photos || [];
      const updatedPhotos = [...currentPhotos, ...uploadedPhotos];
      
      const updatedEntries = [...event.dateEntries];
      updatedEntries[targetIndex] = {
        ...updatedEntries[targetIndex],
        photos: updatedPhotos,
        verse: photoVerse || updatedEntries[targetIndex]?.verse || undefined,
        verseRef: photoVerseRef || updatedEntries[targetIndex]?.verseRef || undefined
      };

      const updatedEvent: ChurchEvent = {
        ...event,
        dateEntries: updatedEntries
      };

      await apiUpdateRecord('events', event.id, { dateEntries: updatedEntries });
      if (onUpdateEvent) onUpdateEvent(updatedEvent);

      setUploadStatus('success');
      setUploadedPhotos([]);
      setUploadedPhotoPreviews([]);
      setPhotoDateTitle('');
      setPhotoVerse('');
      setPhotoVerseRef('');
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage('Error uploading photos. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetUpload = () => {
    setUploadedPhotos([]);
    setUploadedPhotoPreviews([]);
    setUploadStatus('idle');
    setErrorMessage('');
    setPhotoDateTitle('');
    setPhotoVerse('');
    setPhotoVerseRef('');
    if (photoFileInputRef.current) {
      photoFileInputRef.current.value = '';
    }
  };

  // Check if there are events at all
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
          <span>Event QR Code Generator</span>
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
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  setSelectedDateIndex(0);
                  handleResetUpload();
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
              >
                <option value="">-- Select an event --</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedEventId && getSelectedEvent() && (() => {
              const selectedEvent = getSelectedEvent()!;
              const hasDates = Array.isArray(selectedEvent.dateEntries) && selectedEvent.dateEntries.length > 0;
              return (
                <>
                  {hasDates && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-[#A1A1A1] uppercase tracking-wider mb-2">
                        Select Date Album (for upload)
                      </label>
                      <select
                        value={selectedDateIndex}
                        onChange={(e) => {
                          setSelectedDateIndex(parseInt(e.target.value));
                          handleResetUpload();
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-black dark:text-white text-sm focus:border-indigo-400 dark:focus:border-indigo-400/50 focus:outline-hidden focus:ring-2 focus:ring-indigo-400/20 transition-all"
                      >
                        {selectedEvent.dateEntries?.map((entry, index) => (
                          <option key={index} value={index}>
                            {entry.date}
                          </option>
                        ))}
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
                        value={newDateInput}
                        onChange={(e) => {
                          setNewDateInput(e.target.value);
                          setAddDateError('');
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { void handleAddDate(); } }}
                        placeholder="e.g. August 18, 2026"
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
                        Add Date
                      </button>
                    </div>
                    {addDateError && (
                      <p className="mt-2 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {addDateError}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}

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

          {/* Right: QR Code Display - GFC QR image */}
          <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10">
            {selectedEventId && getSelectedDateEntry() ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <QrCode className="w-5 h-5 text-indigo-500" />
                  <span className="text-xs font-bold text-indigo-500 dark:text-indigo-400">
                    GFC QR Code
                  </span>
                </div>
                <div ref={(el) => setQrContainerEl(el)} className="bg-white rounded-xl shadow-md" />
                <a
                  href={getUploadUrl(selectedEventId, selectedDateIndex)}
                  target="_blank"
                  rel=""
                  className="mt-2 text-[11px] font-mono text-indigo-500 dark:text-indigo-400 underline break-all text-center block hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  {getUploadUrl(selectedEventId, selectedDateIndex)}
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
    </div>
  );
};