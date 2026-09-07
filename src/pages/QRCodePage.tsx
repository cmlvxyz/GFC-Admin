// GFC-ADMIN/src/pages/QRCodePage.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChurchEvent } from '../types';
import { QrCode, AlertCircle } from 'lucide-react';

interface QRCodePageProps {
  events: ChurchEvent[];
}

export const QRCodePage: React.FC<QRCodePageProps> = ({ events }) => {
  // Get the production GFC URL from environment
  const GFC_URL = import.meta.env.VITE_GFC_URL || 'https://gfc-591v4f663-yans-projects-3c2ad947.vercel.app';

  const eventsWithAlbums = useMemo(
    () => events.filter(e => Array.isArray(e.dateEntries) && e.dateEntries.length > 0),
    [events]
  );

  // Build QR URL using production GFC URL
  const getQRUrl = (eventId: string, dateIndex: number) => {
    return `${GFC_URL}/upload?event=${encodeURIComponent(eventId)}&date=${dateIndex}`;
  };

  if (eventsWithAlbums.length === 0) {
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
            Upload URL: {GFC_URL}/upload?event=&lt;id&gt;&amp;date=&lt;index&gt;
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-400 dark:text-[#A1A1A1] font-medium">
            Walang event na may photo album (date entries) pa.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md">
            Magdagdag muna ng date album sa isang event, tapos i-generate ang QR code dito.
          </p>
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
          Upload URL: {GFC_URL}/upload?event=&lt;id&gt;&amp;date=&lt;index&gt;
        </div>
        <div className="mt-2 text-xs text-emerald-500 dark:text-emerald-400">
          ✅ QR codes point to: {GFC_URL}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {eventsWithAlbums.map((event) => {
          const entries = event.dateEntries || [];
          const count = entries.reduce((n, e) => n + (e.photos?.length || 0), 0);
          
          return (
            <div
              key={event.id}
              className="bg-white dark:bg-[#14141f]/70 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden p-5"
            >
              {/* Event Info */}
              <div className="mb-4 pb-3 border-b border-gray-100 dark:border-white/5">
                <div className="text-sm font-bold text-black dark:text-white">{event.title}</div>
                <div className="text-xs text-gray-400 dark:text-[#8888AA]">
                  {event.date} • {entries.length} albums • {count} photos
                </div>
              </div>

              {/* QR Codes per date entry */}
              <div className="space-y-4">
                {entries.map((entry, index) => {
                  const qrData = getQRUrl(event.id, index);
                  
                  return (
                    <div key={index} className="flex flex-col items-center p-3 bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-200 dark:border-white/10">
                      <div className="text-xs font-bold text-gray-600 dark:text-[#A1A1A1] mb-2">
                        {entry.date} ({entry.photos?.length || 0} photos)
                      </div>
                      <QRCodeSVG
                        value={qrData}
                        size={160}
                        level="H"
                        includeMargin
                        bgColor="#ffffff"
                        fgColor="#1a1a2e"
                      />
                      <div className="text-[8px] font-mono text-gray-400 dark:text-gray-500 break-all mt-1 text-center w-full">
                        {qrData}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};