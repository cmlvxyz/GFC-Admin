// GFC-ADMIN/src/pages/QRCodePage.tsx

import React, { useEffect, useState, useRef } from 'react';
import { ChurchEvent, DateEntry, AllPhotoAlbum } from '../types';
import { QrCode, AlertCircle, Upload, Image, X, CheckCircle, Loader2, RefreshCw, CalendarPlus } from 'lucide-react';
import QRCodeStyling from 'qr-code-styling';
import { updateRecord as apiUpdateRecord } from '../api';

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
  // Base URL ng GFC upload page (configurable via VITE_GFC_URL).
  const GFC_BASE = (() => {
    const fromEnv = (import.meta.env.VITE_GFC_URL as string | undefined)?.trim();
    if (fromEnv) return fromEnv;
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocalhost = !host || host === 'localhost' || host === '127.0.0.1';
    const isLanIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (isLocalhost || isLanIp) {
      return host ? `http://${host}:4000` : 'http://localhost:4000';
    }
    return typeof window !== 'undefined' ? window.location.origin : 'https://gfc-admin-rosy.vercel.app';
  })();

  const getUploadUrl = (eventId: string, dateIndex: number) =>
    `${GFC_BASE}/upload?event=${encodeURIComponent(eventId)}&date=${dateIndex}`;

  // States
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploadedPhotoPreviews, setUploadedPhotoPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [newDateInput, setNewDateInput] = useState('');
  const [addDateError, setAddDateError] = useState('');
  const [addingDate, setAddingDate] = useState(false);
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const [qrContainerEl, setQrContainerEl] = useState<HTMLDivElement | null>(null);
  const qrStylingRef = useRef<QRCodeStyling | null>(null);

  // Helper: Check if a photo already exists in All Photos
  const isPhotoInAllPhotos = (photoData: string): boolean => {
    for (const album of allPhotos) {
      if (album.photos && album.photos.some((p: string) => p === photoData)) {
        return true;
      }
    }
    return false;
  };

  // Helper: Get the month/year where this photo exists in All Photos
  const getPhotoAllPhotosLocation = (photoData: string): string | null => {
    for (const album of allPhotos) {
      if (album.photos && album.photos.some((p: string) => p === photoData)) {
        const monthName = new Date(0, album.month).toLocaleString('default', { month: 'long' });
        return `${monthName} ${album.year}`;
      }
    }
    return null;
  };

  // Auto-select a sensible event on load so a QR code always shows when possible
  useEffect(() => {
    if (!selectedEventId && events.length > 0) {
      const firstWithAlbum = events.find(e => Array.isArray(e.dateEntries) && e.dateEntries.length > 0);
      setSelectedEventId((firstWithAlbum || events[0]).id);
      setSelectedDateIndex(0);
    }
  }, [events, selectedEventId]);

  // Build the branded QR
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

  // Resize image
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

  // Handle photo upload - with duplicate detection
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (file && file.type && file.type.indexOf('image') === 0) {
        try {
          const imageData = await resizeImage(file);
          urls.push(imageData);
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

  // Save photos to event AND All Photos
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

      const targetIndex = selectedDateIndex >= 0 && selectedDateIndex < event.dateEntries.length ? selectedDateIndex : 0;
      const currentPhotos = event.dateEntries[targetIndex]?.photos || [];
      
      // Combine existing photos with new ones (avoid duplicates within event)
      const existingPhotoSet = new Set(currentPhotos);
      const newPhotos = uploadedPhotos.filter((p: string) => !existingPhotoSet.has(p));
      const updatedPhotos = [...currentPhotos, ...newPhotos];
      
      const updatedEntries = [...event.dateEntries];
      updatedEntries[targetIndex] = {
        ...updatedEntries[targetIndex],
        photos: updatedPhotos
      };

      const updatedEvent: ChurchEvent = {
        ...event,
        dateEntries: updatedEntries
      };

      // Save to events
      await apiUpdateRecord('events', event.id, { dateEntries: updatedEntries });
      if (onUpdateEvent) onUpdateEvent(updatedEvent);

      // ALSO SAVE TO ALL PHOTOS
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const dateLabel = event.dateEntries[targetIndex]?.date || `${currentMonth + 1}/${currentYear}`;

      // Save each new photo to All Photos
      for (const photoData of newPhotos) {
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
            console.warn('Failed to save photo to All Photos:', await response.text());
          }
        } catch (err) {
          console.warn('Error saving photo to All Photos:', err);
        }
      }

      // Notify parent to refresh All Photos
      if (onAllPhotosUpdated) {
        onAllPhotosUpdated();
      }

      setUploadStatus('success');
      setUploadedPhotos([]);
      setUploadedPhotoPreviews([]);
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage('Error uploading photos. Please try again.');
    } finally {
      setIsUploading(false);
    }
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
    if (entries.some((e: DateEntry) => e.date === value)) {
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

  const handleResetUpload = () => {
    setUploadedPhotos([]);
    setUploadedPhotoPreviews([]);
    setUploadStatus('idle');
    setErrorMessage('');
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
                        {selectedEvent.dateEntries?.map((entry: DateEntry, index: number) => (
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

          {/* Right: QR Code Display */}
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
                  rel="noopener noreferrer"
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

      {/* Upload Section */}
      {selectedEventId && getSelectedDateEntry() && (
        <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
          <h4 className="text-sm font-bold text-black dark:text-white mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-500" />
            Upload Photos to Event
          </h4>
          {/* Photo Preview Grid with Duplicate Detection */}
          {uploadedPhotoPreviews.length > 0 && (
            <div className="mt-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {uploadedPhotoPreviews.map((preview: string, index: number) => {
                  const isDuplicate = isPhotoInAllPhotos(preview);
                  const location = getPhotoAllPhotosLocation(preview);
                  return (
                    <div key={index} className="relative group">
                      <div className="relative rounded-xl overflow-hidden aspect-square bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                        <img
                          src={preview}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {/* Duplicate indicator */}
                        {isDuplicate && (
                          <div className="absolute top-0 right-0 m-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            In All Photos
                          </div>
                        )}
                        {/* Location tooltip */}
                        {isDuplicate && location && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[9px] px-1.5 py-0.5 truncate">
                            📍 {location}
                          </div>
                        )}
                        {/* Remove button */}
                        <button
                          onClick={() => handleRemoveUploadedPhoto(index)}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove photo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-1 text-[9px] text-gray-400 dark:text-gray-500 truncate">
                        Photo {index + 1}
                        {isDuplicate && (
                          <span className="text-red-400 ml-1">(duplicate)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {uploadedPhotoPreviews.length} photo{uploadedPhotoPreviews.length > 1 ? 's' : ''} selected
                {uploadedPhotoPreviews.some((preview: string) => isPhotoInAllPhotos(preview)) && (
                  <span className="text-red-400 ml-2">
                    ⚠️ Some photos already exist in All Photos
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Upload Button */}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleSavePhotosToEvent}
              disabled={uploadedPhotos.length === 0 || isUploading}
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
            {uploadStatus === 'success' && (
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