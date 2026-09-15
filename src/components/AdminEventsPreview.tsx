import React, { useState } from 'react';
import type { ChurchEvent, DateEntry } from '../types';
import { MapPin, Clock, X, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { getAlbumEntries } from '../utils/dateEntries';
import { AdminPreviewHero, ManagePill } from './AdminPreviewHero';

interface AdminEventsPreviewProps {
  events: ChurchEvent[];
  onNavigate: (page: string) => void;
}

export const AdminEventsPreview: React.FC<AdminEventsPreviewProps> = ({ events, onNavigate }) => {
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [selectedEvent, setSelectedEvent] = useState<ChurchEvent | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<DateEntry | null>(null);

  const closeModal = () => {
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  const getFallbackImage = (event: ChurchEvent): string => {
    const fallbacks: Record<string, string> = {
      '⛪ Worship': '/Sunday Service/sunday-service.jpg',
      '🎵 Music': '/Worship Night/worship-night.jpg',
      '🙏 Prayer': '/Prayer Meeting/prayer-meeting.jpg',
      '📖 Word': '/Bible Study/bible-study.jpg',
      '🌟 Youth': '/Next Gen/next-gen.jpg',
      '🎉 Celebration': '/Anniversary/3rd Year.jpg'
    };
    return fallbacks[event.tag] || 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=800&q=80';
  };

  const handleImageError = (eventId: string) => {
    setImageErrors(prev => ({ ...prev, [eventId]: true }));
  };

  const getImageSrc = (event: ChurchEvent): string => {
    if (imageErrors[event.id]) {
      return getFallbackImage(event);
    }
    return event.image || getFallbackImage(event);
  };

  return (
    <>
      <ManagePill label="Events" onManage={() => onNavigate('eventsManage')} />

      <AdminPreviewHero
        eyebrow="Events & Gatherings"
        title={<>Worship, prayer, <span className="italic text-indigo-400">& community.</span></>}
        subtitle="From Sunday celebration to midweek prayer meetings — there's always a place for you."
      />

      <section id="eventsSection" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        {/* ============ HEADER ============ */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-indigo-600">
              Events & Gatherings
            </span>
            <h2 className="text-4xl sm:text-5xl font-serif text-[#0f172a] tracking-tight leading-tight">
              Church events & schedule
            </h2>
          </div>
          <div className="h-px flex-1 max-w-xs hidden md:block bg-slate-200 translate-y-[-8px]" />
          <p className="text-sm text-slate-500 md:text-right">
            {events.length} active gatherings this season
          </p>
        </div>

        {/* ============ EVENTS CARDS GRID ============ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 text-center py-16 bg-white rounded-3xl border border-slate-200">
              <p className="text-slate-500">No events yet. Check back soon for upcoming gatherings and activities.</p>
            </div>
          ) : (
            events.map(ev => {
              const imageSrc = getImageSrc(ev);
              const albumCount = getAlbumEntries(ev).length;

              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    setSelectedEvent(ev);
                    setSelectedDate(null);
                  }}
                  className="group bg-white rounded-2xl border border-slate-200 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-28px_rgba(15,23,42,0.25)] hover:border-indigo-300"
                >
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={imageSrc}
                      alt={ev.title}
                      loading="lazy"
                      onError={() => handleImageError(ev.id)}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/60 via-transparent to-transparent opacity-70" />
                    <span className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3.5 py-1.5 rounded-full text-xs font-bold text-[#0f172a] shadow-sm">
                      {ev.tag}
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    {ev.date && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-widest">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{ev.date}</span>
                      </div>
                    )}

                    <h3 className="font-serif text-xl text-[#0f172a] transition-colors duration-300 group-hover:text-indigo-700">
                      {ev.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                      {ev.description}
                    </p>

                    {ev.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" />
                        <span>{ev.location.replace(/^📍\s*/, '')}</span>
                      </div>
                    )}

                    {albumCount > 0 && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 pt-1">
                        <ImageIcon className="w-3.5 h-3.5" />
                        {albumCount} photo album{albumCount > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ============ EVENT DETAILS MODAL ============ */}
        {selectedEvent && (
          <div
            className="fixed inset-0 z-50 bg-[#0f172a]/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn cursor-pointer"
            onClick={() => (selectedDate ? setSelectedDate(null) : closeModal())}
          >
            <div
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 sm:p-10 relative shadow-2xl border border-slate-100 animate-slideUp hide-scrollbar cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate(null)}
                  className="absolute top-5 left-6 z-10 flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-full transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}

              <button
                onClick={closeModal}
                aria-label="Close"
                className="absolute top-5 right-6 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>

              {selectedDate ? (
                /* ===== DATE VIEW ===== */
                <>
                  <div className="text-center mb-6 pt-3">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 inline-block mb-3">
                      {selectedEvent.tag}
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-serif text-[#0f172a] tracking-tight">
                      {selectedEvent.title}
                    </h2>
                    <p className="text-sm text-slate-500 mt-2 font-semibold">
                      {selectedDate.date}
                    </p>
                  </div>

                  {selectedDate.photos && selectedDate.photos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {selectedDate.photos.map((photo, idx) => (
                        <div
                          key={idx}
                          className="group relative rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all aspect-[4/3] cursor-pointer"
                        >
                          <img
                            src={photo}
                            alt={`Event photo ${idx + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                            loading="lazy"
                            onClick={() => setSelectedPhoto(photo)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                      <p className="text-sm text-slate-500">
                        No photos uploaded yet for this date.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* ===== EVENT VIEW ===== */
                <>
                  <div className="text-center mb-6 pt-3">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 inline-block mb-3">
                      {selectedEvent.tag}
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-serif text-[#0f172a] tracking-tight">
                      {selectedEvent.title}
                    </h2>
                    <p className="text-sm text-slate-500 mt-2">
                      {selectedEvent.date}
                    </p>
                    {selectedEvent.location && (
                      <p className="text-sm text-slate-400 flex items-center justify-center gap-1 mt-1">
                        <MapPin className="w-4 h-4 text-indigo-400" />
                        {selectedEvent.location.replace(/^📍\s*/, '')}
                      </p>
                    )}
                  </div>

                  {/* PAST EVENTS / DATE ENTRIES SECTION */}
                  <div className="my-5">
                    {getAlbumEntries(selectedEvent).length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {getAlbumEntries(selectedEvent).map((entry, index) => (
                          <div
                            key={index}
                            onClick={() => setSelectedDate(entry)}
                            className="relative group flex flex-col items-center cursor-pointer gap-1.5 p-2 rounded-xl transition-all bg-white border-2 border-transparent hover:border-indigo-300"
                          >
                            {(entry.coverImage || (entry.photos && entry.photos.length > 0)) && (
                              <img
                                src={entry.coverImage || entry.photos[0]}
                                alt={entry.date}
                                className="w-full h-20 object-cover rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            )}
                            <span className="text-[11px] font-bold text-center block mt-1 text-[#0f172a]">
                              {entry.date}
                            </span>
                            <span className="text-[9px] block text-slate-400">
                              {entry.photos?.length || 0} photos
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <p className="text-sm text-slate-500">
                          No photo albums yet for this event.
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedEvent.defaultVerse && getAlbumEntries(selectedEvent).length === 0 && (
                    <div className="bg-slate-50 p-6 rounded-2xl border-l-4 border-indigo-500 mt-4">
                      <p className="text-sm italic text-slate-700 leading-relaxed">
                        "{selectedEvent.defaultVerse}"
                      </p>
                      {selectedEvent.defaultVerseRef && (
                        <p className="text-right text-sm font-bold text-indigo-600 mt-2">
                          — {selectedEvent.defaultVerseRef}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="mt-7 text-center">
                <button
                  onClick={closeModal}
                  className="px-8 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold rounded-xl text-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ PHOTO LIGHTBOX ============ */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-pointer animate-fadeIn"
            onClick={() => setSelectedPhoto(null)}
          >
            <img
              src={selectedPhoto}
              alt="Full size"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPhoto(null);
              }}
              aria-label="Close"
              className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-all"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
        )}
      </section>
    </>
  );
};