import type { DateEntry, ChurchEvent } from '../types';

const isConcreteDate = (value: unknown): boolean => {
  const s = String(value ?? '').trim();

  if (!s) {
    return false;
  }

  if (/^every\b/i.test(s)) {
    return false;
  }

  if (/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(s)) {
    return false;
  }

  const parsed = new Date(s);

  return !Number.isNaN(parsed.getTime());
};

const isScheduleEntry = (value: unknown): boolean => {
  const s = String(value ?? '').trim();

  if (/^every\b/i.test(s)) {
    return true;
  }

  if (/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(s)) {
    return true;
  }

  return false;
};

/**
 * Anniversary-style events use YEAR albums ("1st Year
 * Anniversary") instead of calendar date albums.
 */
export const isYearAlbumEvent = (
  event?: ChurchEvent | null
): boolean => {
  if (event?.albumType === 'year') {
    return true;
  }

  return String(event?.id) === 'anniversary';
};

const ordinalOf = (value: unknown): number => {
  const match = String(value ?? '').trim().match(/^(\d+)/);

  return match
    ? parseInt(match[1], 10)
    : Number.MAX_SAFE_INTEGER;
};

const keyOf = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');

// Facebook CDN photo URLs change their signed query params (oh/oe/_nc_*)
// on every import, so the same photo can appear under several different
// strings inside an album. Collapse to the pathname so it renders once.
const isFacebookCdnUrl = (url: unknown): boolean =>
  typeof url === 'string' &&
  /^https:\/\/scontent-[\w.-]+\.(fbcdn|facebook)\.net\//.test(url);

const canonicalPhotoKey = (url: unknown): string =>
  typeof url === 'string' && isFacebookCdnUrl(url)
    ? url.split('?')[0]
    : String(url ?? '').trim();

export const uniquePhotos = (
  photos?: string[] | null
): string[] => {
  const seen = new Set<string>();
  for (const url of Array.isArray(photos) ? photos : []) {
    const key = canonicalPhotoKey(url);
    if (!seen.has(key)) seen.add(key);
  }
  return Array.from(seen.values());
};

export const getConcreteDateEntries = (
  entries?: DateEntry[] | null
): DateEntry[] =>
  (Array.isArray(entries) ? entries : [])
    .filter(entry => isConcreteDate(entry.date))
    .sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    );

export const getAlbumEntries = (
  event?: ChurchEvent | null
): DateEntry[] => {
  const entries = Array.isArray(event?.dateEntries)
    ? event.dateEntries
    : [];

  const deduped = entries.map(entry =>
    Array.isArray(entry.photos)
      ? { ...entry, photos: uniquePhotos(entry.photos) }
      : entry
  );

  if (isYearAlbumEvent(event)) {
    return deduped
      .filter(entry => !isScheduleEntry(entry.date))
      .sort(
        (a, b) =>
          ordinalOf(a.date) - ordinalOf(b.date) ||
          keyOf(a.date).localeCompare(keyOf(b.date))
      );
  }

  return getConcreteDateEntries(deduped);
};