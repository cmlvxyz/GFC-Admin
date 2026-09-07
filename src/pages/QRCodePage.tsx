import React, { useEffect, useMemo, useState } from 'react';
import QRCodeStyling, { Options as QRStylingOptions } from 'qr-code-styling';
import { ChurchEvent } from '../types';
import { getConfig } from '../api';
import { QrCode, Download, ChevronDown, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';

function loadLogoAsDataURL(src = '/image-circle.png'): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

interface QRSlotProps {
  data: string;
  label: string;
  logo: string;
}

const QRSlot: React.FC<QRSlotProps> = ({ data, label, logo }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const qrRef = React.useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const options: QRStylingOptions = {
      width: 240,
      height: 240,
      type: 'canvas',
      data,
      image: logo,
      margin: 6,
      qrOptions: { errorCorrectionLevel: 'H' },
      imageOptions: { crossOrigin: 'anonymous', margin: 6, imageSize: 0.32 },
      dotsOptions: { color: '#312e81', type: 'rounded' },
      backgroundOptions: { color: '#ffffff', round: 8 },
      cornersSquareOptions: { color: '#4f46e5', type: 'extra-rounded' },
      cornersDotOptions: { color: '#4338ca' }
    };
    const qr = new QRCodeStyling(options);
    qr.append(containerRef.current);
    qrRef.current = qr;
    setTimeout(() => setReady(true), 350);
    return () => { qrRef.current = null; };
  }, [data, logo]);

  const handleDownload = () => {
    qrRef.current?.download({ name: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), extension: 'png' });
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 shadow-sm">
      <div ref={containerRef} className="bg-white p-2 rounded-xl" />
      {!ready && <p className="text-[11px] text-gray-400 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Rendering...</p>}
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-gray-700 dark:text-[#E8E8F0] truncate">{label}</div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-400 dark:hover:brightness-110 text-white rounded-lg text-xs font-bold transition-all shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download PNG
          </button>
        </div>
        <div className="text-[10px] font-mono text-gray-400 dark:text-gray-500 break-all bg-gray-50 dark:bg-white/5 rounded-lg px-2 py-1.5 leading-relaxed">
          {data}
        </div>
      </div>
    </div>
  );
};

interface QRCodePageProps {
  events: ChurchEvent[];
}

export const QRCodePage: React.FC<QRCodePageProps> = ({ events }) => {
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [logo, setLogo] = useState('/image-circle.png');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getConfig()
      .then(cfg => setAppUrl(cfg.appUrl.replace(/\/$/, '')))
      .catch(() => setAppUrl(window.location.origin.replace(/\/$/, '')));
    loadLogoAsDataURL().then(setLogo);
  }, []);

  const eventsWithAlbums = useMemo(
    () => events.filter(e => Array.isArray(e.dateEntries) && e.dateEntries.length > 0),
    [events]
  );

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (!appUrl) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 dark:text-gray-500 text-sm">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-300 dark:border-indigo-800 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <p>Loading QR generator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#14141f]/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
        <h3 className="text-sm font-bold text-black dark:text-white mb-2 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-indigo-500" />
          <span>Event QR Code Generator</span>
        </h3>
        <p className="text-sm text-gray-500 dark:text-[#A1A1A1] leading-relaxed">
          I-scan ng church members ang QR code gamit ang kanilang phone para makapag-upload ng photos
          sa event gallery. Makikita ang mga na-upload na photos sa website ng church.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
          Upload URL: {appUrl}/upload?event=&lt;id&gt;&amp;date=&lt;index&gt;
        </div>
      </div>

      {eventsWithAlbums.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-400 dark:text-[#A1A1A1] font-medium">
            Walang event na may photo album (date entries) pa.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md">
            Magdagdag muna ng date album sa isang event, tapos i-generate ang QR code dito.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {eventsWithAlbums.map((event) => {
            const isOpen = expanded[event.id];
            const entries = event.dateEntries || [];
            const count = entries.reduce((n, e) => n + (e.photos?.length || 0), 0);
            return (
              <div key={event.id} className="bg-white dark:bg-[#14141f]/70 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggle(event.id)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-5 h-5 text-indigo-400" /> : <ChevronRight className="w-5 h-5 text-indigo-400" />}
                    <div>
                      <div className="text-sm font-bold text-black dark:text-white">{event.title}</div>
                      <div className="text-xs text-gray-400 dark:text-[#8888AA]">
                        {event.date} • {entries.length} albums • {count} photos
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 rounded-full font-bold shrink-0">
                    {entries.length} QR codes
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 border-t border-gray-100 dark:border-white/5 pt-4">
                    {entries.map((entry, index) => {
                      const data = `${appUrl}/upload?event=${encodeURIComponent(event.id)}&date=${index}`;
                      return (
                        <QRSlot
                          key={`${event.id}-${index}`}
                          data={data}
                          label={entry.date || `Album ${index + 1}`}
                          logo={logo}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};