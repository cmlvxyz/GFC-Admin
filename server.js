// GFC-ADMIN/server.js

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4000);
const dataDirectory = path.join(__dirname, 'data');
const dataFile = path.join(dataDirectory, 'data.json');
const collections = ['events', 'sermons', 'prayers', 'attendees', 'members', 'announcements', 'testimonials', 'allPhotos'];

const emptyDatabase = () => ({ 
  version: 1, 
  initialized: false, 
  events: [], 
  sermons: [], 
  prayers: [], 
  attendees: [], 
  members: [], 
  announcements: [], 
  testimonials: [], 
  activities: [],
  allPhotos: [] 
});

// ============================================
// STORAGE LAYER
// ============================================
let fileDatabase = null;
let writeQueue = Promise.resolve();
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();

const IS_LIBSQL = /^(libsql:\/\/|wss:\/\/|ws:\/\/|file:)/.test(DATABASE_URL);

let dbClient = null;
let dbMode = 'none';

if (IS_LIBSQL) {
  const { createClient } = await import('@libsql/client');
  dbClient = createClient({ url: DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
  dbMode = 'turusql';
} else if (DATABASE_URL) {
  dbClient = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  dbMode = 'postgres';
}

async function dbEnsureSchema() {
  if (dbMode === 'postgres') {
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS gfc_store (
        key   text PRIMARY KEY,
        value jsonb NOT NULL
      )
    `);
  } else if (dbMode === 'turusql') {
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS gfc_store (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  }
}

async function dbLoadBlob() {
  if (dbMode === 'postgres') {
    const { rows } = await dbClient.query(`SELECT value FROM gfc_store WHERE key = 'db'`);
    return rows.length ? rows[0].value : null;
  }
  if (dbMode === 'turusql') {
    const res = await dbClient.execute({ sql: `SELECT value FROM gfc_store WHERE key = ?`, args: ['db'] });
    return res.rows.length ? JSON.parse(res.rows[0].value) : null;
  }
  return null;
}

function dbSaveBlob() {
  const snapshot = JSON.stringify(fileDatabase);
  if (dbMode === 'postgres') {
    return dbClient.query(
      `INSERT INTO gfc_store (key, value) VALUES ('db', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [snapshot]
    );
  }
  if (dbMode === 'turusql') {
    return dbClient.execute({
      sql: `INSERT INTO gfc_store (key, value) VALUES (?, ?)
            ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      args: ['db', snapshot],
    });
  }
  return Promise.resolve();
}

function dbPersist() {
  if (dbClient) {
    return dbSaveBlob().catch(err => {
      console.error('❌ Failed to save to database:', err.message);
      return Promise.resolve();
    });
  }
  const snapshot = JSON.stringify(fileDatabase, null, 2);
  writeQueue = writeQueue.then(() => fs.writeFile(dataFile, snapshot, 'utf8').catch(err => {
    console.error('❌ Failed to write to file:', err.message);
  }));
  return writeQueue;
}

async function dbInitialize() {
  console.log('🔄 Initializing database...');
  console.log(`   DATABASE_URL: ${DATABASE_URL ? '✅ set' : '❌ not set'}`);
  console.log(`   Mode: ${dbMode}`);
  
  try {
    await fs.mkdir(dataDirectory, { recursive: true });
  } catch (error) {
    console.warn('⚠️ Cannot create data directory (read-only FS?):', error.message);
  }
  
  let loaded = null;
  let seededFromDisk = false;
  
  if (dbClient) {
    try {
      console.log('📡 Connecting to database...');
      await dbEnsureSchema();
      console.log('✅ Database schema ready');
    } catch (error) {
      console.error(`❌ Cannot connect to ${dbMode}:`, error.message);
      console.warn('⚠️ Using in-memory fallback');
      fileDatabase = emptyDatabase();
      return;
    }
    
    loaded = await dbLoadBlob();
    console.log(`📦 Loaded from database: ${loaded ? '✅ found' : '❌ empty'}`);
    
    if (!loaded) {
      try {
        const fileContent = await fs.readFile(dataFile, 'utf8');
        loaded = JSON.parse(fileContent);
        if (loaded) {
          seededFromDisk = true;
          console.log('📦 Seeded ' + dataFile + ' into database (empty DB detected).');
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn('⚠️ Error reading data.json:', error.message);
        }
        loaded = null;
      }
    }
  } else {
    try {
      const fileContent = await fs.readFile(dataFile, 'utf8');
      loaded = JSON.parse(fileContent);
      console.log('📦 Loaded from data.json');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('⚠️ Error reading data.json:', error.message);
      }
      loaded = null;
    }
  }
  
  if (loaded) {
    fileDatabase = loaded;
    for (const key of collections) {
      if (!Array.isArray(fileDatabase[key])) fileDatabase[key] = [];
    }
    if (!Array.isArray(fileDatabase.activities)) fileDatabase.activities = [];
    if (seededFromDisk) {
      try {
        await dbPersist();
        console.log('✅ Seed data saved to database');
      } catch (error) {
        console.warn('⚠️ Failed to save seed to database:', error.message);
      }
    }
  } else {
    console.log('📝 Creating empty database');
    fileDatabase = emptyDatabase();
    try {
      await dbPersist();
      console.log('✅ Empty database initialized');
    } catch (error) {
      console.warn('⚠️ Cannot persist initial DB (read-only FS?). Isang DATABASE_URL ang kailangan sa Vercel:', error.message);
    }
  }
  
  console.log('✅ Database initialization complete');
}

async function dbGetCollection(key) {
  if (!fileDatabase) {
    console.warn(`⚠️ fileDatabase is null, returning empty array for ${key}`);
    return [];
  }
  return fileDatabase[key] || [];
}

async function dbSetCollection(key, value) {
  if (!fileDatabase) {
    console.warn(`⚠️ fileDatabase is null, cannot set ${key}`);
    return;
  }
  fileDatabase[key] = value;
  await dbPersist();
}

async function dbGetMeta(key) {
  return fileDatabase ? (fileDatabase[key] ?? null) : null;
}

async function dbSetMeta(key, value) {
  if (!fileDatabase) return;
  fileDatabase[key] = value;
  await dbPersist();
}

async function dbIsInitialized() {
  return fileDatabase ? Boolean(fileDatabase.initialized) : false;
}

async function dbSetInitialized(value) {
  if (!fileDatabase) return;
  fileDatabase.initialized = Boolean(value);
  await dbPersist();
}

async function dbGetActivities() {
  return fileDatabase ? (fileDatabase.activities || []) : [];
}

async function dbInsertActivity(entry) {
  if (!fileDatabase) return;
  fileDatabase.activities = fileDatabase.activities || [];
  fileDatabase.activities.unshift(entry);
  if (fileDatabase.activities.length > 300) {
    fileDatabase.activities = fileDatabase.activities.slice(0, 300);
  }
  await dbPersist();
}

async function dbReset() {
  fileDatabase = emptyDatabase();
  await dbPersist();
}

// ============================================
// ACTIVITY LOG
// ============================================
const icons = { 
  events: '📅', 
  sermons: '🎬', 
  prayers: '🙏', 
  attendees: '👤', 
  members: '🧑', 
  announcements: '📢', 
  testimonials: '🗣️', 
  admin: '🔐', 
  system: '⚙️', 
  uploads: '📸',
  allPhotos: '🖼️' 
};

const activityMessages = {
  events: { 
    created: (l) => `New event "${l}" was added`, 
    updated: (l) => `Event "${l}" was updated`, 
    deleted: (l) => `Event "${l}" was deleted`, 
    photo: (l) => `Photo uploaded to "${l}"` 
  },
  sermons: { 
    created: (l) => `New sermon "${l}" was added`, 
    updated: (l) => `Sermon "${l}" was updated`, 
    deleted: (l) => `Sermon "${l}" was deleted` 
  },
  announcements: { 
    created: (l) => `New announcement "${l}" was posted`, 
    updated: (l) => `Announcement "${l}" was updated`, 
    deleted: (l) => `Announcement "${l}" was deleted`, 
    pinned: (l) => `Announcement "${l}" was pinned`, 
    unpinned: (l) => `Announcement "${l}" was unpinned` 
  },
  prayers: { 
    created: (l) => `New prayer request from "${l}" was submitted`, 
    updated: (l) => `Prayer request from "${l}" was updated`, 
    deleted: (l) => `Prayer request from "${l}" was deleted`, 
    approved: (l) => `Prayer request from "${l}" was approved`, 
    answered: (l) => `Prayer request from "${l}" was marked answered` 
  },
  attendees: { 
    created: (l) => `New attendee "${l}" was registered`, 
    updated: (l) => `Attendee "${l}" was updated`, 
    deleted: (l) => `Attendee "${l}" was deleted` 
  },
  members: { 
    created: (l) => `New member "${l}" was added`, 
    updated: (l) => `Member "${l}" was updated`, 
    deleted: (l) => `Member "${l}" was deleted` 
  },
  testimonials: { 
    created: (l) => `New testimonial from "${l}" was added`, 
    updated: (l) => `Testimonial from "${l}" was updated`, 
    deleted: (l) => `Testimonial from "${l}" was deleted` 
  },
  allPhotos: { 
    photo: () => 'New photo was uploaded to All Photos',
    delete: () => 'Photo was deleted from All Photos'
  }
};

function recordLabel(record) { 
  return (record && (record.title || record.name || record.fullName || 'record')) || 'record'; 
}

function describe(collection, action, record) { 
  const table = activityMessages[collection]; 
  const fn = table && table[action]; 
  if (fn) return fn(recordLabel(record)); 
  if (table && table.created) return table.created(recordLabel(record)); 
  return `${collection} ${action}`; 
}

function logActivity({ collection, action, record, message, actor }) {
  const entry = { 
    id: crypto.randomUUID(), 
    type: collection, 
    action, 
    message: message || describe(collection, action, record), 
    icon: icons[collection] || '•', 
    actor: actor || 'admin', 
    createdAt: new Date().toISOString() 
  };
  return dbInsertActivity(entry);
}

function validCollection(req, res, next) { 
  if (!collections.includes(req.params.collection)) return res.status(404).json({ message: 'Unknown collection.' }); 
  next(); 
}

const app = express();

// ============================================
// CORS
// ============================================
const allowedOrigins = [
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:4000',
  process.env.CORS_ORIGIN,
  'https://gfc-admin-rosy.vercel.app',
  'https://gfc-591v4f663-yans-projects-3c2ad947.vercel.app',
  'https://gfc-n55az5ieq-yans-projects-3c2ad947.vercel.app'
].filter(Boolean);

app.use(cors({ 
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true 
}));

app.use(express.json({ limit: '12mb' }));

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', async (req, res) => { 
  res.json({ 
    ok: true, 
    service: 'GFC-DATA', 
    storage: dbMode === 'postgres' ? 'postgres' : dbMode === 'turusql' ? 'turusql' : 'json-file-or-memory',
    initialized: await dbIsInitialized(),
    dbConnected: !!dbClient,
    fileDatabaseExists: !!fileDatabase
  }); 
});

// Get config
app.get('/api/config', (req, res) => {
  const gfcUrl = process.env.VITE_GFC_URL || 'http://localhost:3002';
  res.json({ 
    appUrl: gfcUrl,
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '' 
  });
});

// Get all content
app.get('/api/content', async (req, res) => {
  const initialized = await dbIsInitialized();
  const content = { version: 1, initialized };
  for (const key of collections) content[key] = await dbGetCollection(key);
  content.activities = await dbGetActivities();
  res.json(content);
});

// Bootstrap data
app.post('/api/bootstrap', async (req, res, next) => { 
  try { 
    if (await dbIsInitialized()) {
      return res.status(409).json({ message: 'The database has already been initialized.' }); 
    }
    for (const collection of collections) { 
      const value = Array.isArray(req.body?.[collection]) ? req.body[collection] : []; 
      await dbSetCollection(collection, value); 
    }
    await dbSetInitialized(true); 
    await logActivity({ collection: 'system', action: 'bootstrap', message: 'Site data was initialized (bootstrap)', actor: 'system' }); 
    const content = { version: 1, initialized: true }; 
    for (const key of collections) content[key] = await dbGetCollection(key); 
    res.status(201).json(content); 
  } catch (error) { 
    next(error); 
  } 
});

// ============================================
// ACTIVITY STREAM (SSE)
// ============================================
app.get('/api/activities/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true'
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connected' })}\n\n`);

  let lastActivityId = null;
  let closed = false;

  const initialActivities = await dbGetActivities();
  if (initialActivities.length > 0) {
    lastActivityId = initialActivities[0].id;
    for (const activity of initialActivities.slice(0, 10)) {
      if (closed) break;
      res.write(`data: ${JSON.stringify({ type: 'activity', data: activity })}\n\n`);
    }
  }

  const pollInterval = setInterval(async () => {
    if (closed) {
      clearInterval(pollInterval);
      return;
    }

    try {
      const activities = await dbGetActivities();
      if (activities.length === 0) return;

      let newActivities = [];
      if (lastActivityId) {
        const lastIndex = activities.findIndex(a => a.id === lastActivityId);
        if (lastIndex > 0) {
          newActivities = activities.slice(0, lastIndex);
        } else if (lastIndex === -1) {
          newActivities = activities.slice(0, 5);
        }
      } else if (activities.length > 0) {
        newActivities = activities.slice(0, 1);
      }

      if (activities.length > 0) {
        lastActivityId = activities[0].id;
      }

      for (const activity of newActivities.reverse()) {
        if (closed) break;
        res.write(`data: ${JSON.stringify({ type: 'activity', data: activity })}\n\n`);
      }
    } catch (error) {
      console.error('SSE poll error:', error);
    }
  }, 2000);

  req.on('close', () => {
    closed = true;
    clearInterval(pollInterval);
    res.end();
  });

  const keepAlive = setInterval(() => {
    if (closed) {
      clearInterval(keepAlive);
      return;
    }
    res.write(`: keepalive\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Get all activities
app.get('/api/activities', async (req, res, next) => {
  try {
    res.json({ activities: await dbGetActivities() });
  } catch (error) {
    next(error);
  }
});

// Clear activity log
app.delete('/api/activities', async (req, res, next) => {
  try {
    await dbSetCollection('activities', []);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// ============================================
// ALL-PHOTOS UPLOAD
// ============================================
app.post('/api/uploads/all', async (req, res, next) => {
  try {
    console.log('📸 All-Photos upload request received');
    const { image, month, year, date } = req.body || {};
    
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ message: 'Image data is required.' });
    }
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (Number.isNaN(m) || m < 0 || m > 11 || Number.isNaN(y) || String(y).length !== 4) {
      return res.status(400).json({ message: 'Valid month and year are required.' });
    }
    const label = String(date || '').trim() || `${m + 1}/${y}`;

    const list = await dbGetCollection('allPhotos');
    // Match by month + year only (never by the date label) so uploads
    // with a different label always land in the SAME bucket per month.
    let bucket = list.find(a => String(a.month) === String(m) && String(a.year) === String(y));
    if (!bucket) {
      bucket = { month: m, year: y, date: label, photos: [] };
      list.push(bucket);
    }
    bucket.photos = Array.isArray(bucket.photos) ? bucket.photos : [];
    bucket.photos.push(image);
    
    console.log(`💾 Saving to database: allPhotos (${bucket.photos.length} photos)`);
    await dbSetCollection('allPhotos', list);
    await logActivity({ collection: 'allPhotos', action: 'photo', record: bucket, actor: 'public' });

    console.log(`✅ Photo uploaded to All Photos ${m + 1}/${y} "${label}" (${bucket.photos.length} photos)`);
    res.status(201).json({ success: true, message: 'Photo uploaded successfully!', photoCount: bucket.photos.length });
  } catch (error) {
    console.error('All-photos upload error:', error);
    next(error);
  }
});

// Normalizes a photo URL so a stored relative path such as
// "/uploads/photo.jpg" can be matched even if the fully resolved
// URL (e.g. "https://domain.com/uploads/photo.jpg") was sent.
function normalizePhotoUrl(u) {
  if (typeof u !== 'string') return '';
  const trimmed = u.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

app.delete('/api/events/photo/delete', async (req, res, next) => {
  try {
    const { eventId, dateEntryIndex, photoUrl } = req.body;
    
    // Validate required fields
    if (!eventId || dateEntryIndex === undefined || !photoUrl) {
      return res.status(400).json({
        message: 'Event ID, date entry index, and photo URL are required.'
      });
    }

    const events = await dbGetCollection('events');
    const eventIndex = events.findIndex(
      e => String(e.id) === String(eventId)
    );
    
    if (eventIndex === -1) {
      return res.status(404).json({
        message: 'Event not found.'
      });
    }

    const event = events[eventIndex];
    const entries = Array.isArray(event.dateEntries)
      ? event.dateEntries
      : [];
    
    if (
      dateEntryIndex < 0 ||
      dateEntryIndex >= entries.length
    ) {
      return res.status(404).json({
        message: 'Date entry not found.'
      });
    }

    const entry = entries[dateEntryIndex];
    const photos = Array.isArray(entry.photos)
      ? entry.photos
      : [];

    // Match against the ORIGINAL database value first.
    // Fall back to normalized comparison in case the resolved
    // URL was sent instead of the stored value.
    const target = normalizePhotoUrl(photoUrl);

    const photoIndex = photos.findIndex(p => {
      const stored = typeof p === 'string' ? p : '';
      return (
        stored === photoUrl ||
        normalizePhotoUrl(stored) === target
      );
    });
    
    if (photoIndex === -1) {
      return res.status(404).json({
        message: 'Photo not found in this date entry.',
        requestedUrl: photoUrl,
        availablePhotos: photos
      });
    }

    // Remove the photo from the array.
    // NOTE: The date entry itself is intentionally KEPT even if it
    // ends up with zero photos afterwards.
    photos.splice(photoIndex, 1);
    entry.photos = photos;

    // Save back to database
    await dbSetCollection('events', events);

    // Log the activity
    await logActivity({
      collection: 'events',
      action: 'delete',
      record: {
        eventId,
        dateEntryIndex,
        photoIndex
      },
      actor: 'admin',
      message: `Photo deleted from event "${event.title}"`
    });

    res.status(200).json({
      success: true,
      message: 'Photo deleted successfully.',
      eventId,
      dateEntryIndex,
      photoUrl
    });

  } catch (error) {
    console.error(
      'Delete event photo error:',
      error
    );

    next(error);
  }
});

app.delete('/api/allPhotos/delete', async (req, res, next) => {
  try {
    const { albumIndex, photoIndex } = req.body;

    // Validate required fields
    if (albumIndex === undefined || photoIndex === undefined) {
      return res.status(400).json({
        message: 'Album index and photo index are required.'
      });
    }

    const list = await dbGetCollection('allPhotos');

    const album = Array.isArray(list)
      ? list[albumIndex]
      : undefined;

    if (!album || !Array.isArray(album.photos)) {
      return res.status(404).json({
        message: 'All Photos album not found.'
      });
    }

    if (
      photoIndex < 0 ||
      photoIndex >= album.photos.length
    ) {
      return res.status(404).json({
        message: 'Photo not found in this album.',
        requestedIndex: photoIndex,
        availablePhotos: album.photos
      });
    }

    // Remove the photo from the album.
    // NOTE: The album/bucket itself is intentionally KEPT even if
    // it ends up with zero photos afterwards.
    album.photos.splice(photoIndex, 1);

    await dbSetCollection('allPhotos', list);

    await logActivity({
      collection: 'allPhotos',
      action: 'delete',
      record: {
        albumIndex,
        photoIndex
      },
      actor: 'admin',
      message: `Photo deleted from All Photos album "${album.date || 'Untitled'}"`
    });

    res.status(200).json({
      success: true,
      message: 'Photo deleted successfully.',
      albumIndex,
      photoIndex
    });

  } catch (error) {
    console.error(
      'Delete all-photos photo error:',
      error
    );

    next(error);
  }
});

// ============================================
// PHOTO UPLOADS (public - for QR upload page)
// ============================================
app.post('/api/photos/delete', async (req, res, next) => {
  try {
    // Delete EVERY occurrence of the given photo URL(s) across all
    // events AND all Photos albums. Uses the stored value (or a
    // normalized version of it) so stale indices are never a problem.
    const { photos: requested } = req.body || {};

    const urls = (Array.isArray(requested) ? requested : [String(requested || '')])
      .filter(u => typeof u === 'string' && u.trim().length > 0);

    if (urls.length === 0) {
      return res.status(400).json({ message: 'Photo URL is required.' });
    }

    const matches = (stored, target) =>
      String(stored) === target ||
      normalizePhotoUrl(String(stored)) === normalizePhotoUrl(target);

    let removed = 0;
    const touched = [];

    // 1) Remove from every EVENT date entry.
    const events = await dbGetCollection('events');
    let eventsChanged = false;

    events.forEach(ev => {
      if (!Array.isArray(ev.dateEntries)) return;

      ev.dateEntries.forEach(entry => {
        if (!Array.isArray(entry.photos) || entry.photos.length === 0) return;

        const before = entry.photos.length;
        entry.photos = entry.photos.filter(p => !urls.some(u => matches(p, u)));

        if (entry.photos.length !== before) {
          eventsChanged = true;
          removed += before - entry.photos.length;
          touched.push(`${ev.title} / ${entry.date}`);
        }
      });
    });

    if (eventsChanged) {
      await dbSetCollection('events', events);
    }

    // 2) Remove from every All Photos bucket.
    const list = await dbGetCollection('allPhotos');
    let albumsChanged = false;

    list.forEach(album => {
      if (!Array.isArray(album.photos) || album.photos.length === 0) return;

      const before = album.photos.length;
      album.photos = album.photos.filter(p => !urls.some(u => matches(p, u)));

      if (album.photos.length !== before) {
        albumsChanged = true;
        removed += before - album.photos.length;
        touched.push(`${album.date || 'Untitled'} (${album.month !== undefined ? Number(album.month) + 1 : '?'}/${album.year || '?'})`);
      }
    });

    if (albumsChanged) {
      await dbSetCollection('allPhotos', list);
    }

    if (removed === 0) {
      return res.status(404).json({
        message: 'Photo not found in any album.',
        requestedUrls: urls
      });
    }

    await logActivity({
      collection: 'photos',
      action: 'delete',
      record: { removed, urls },
      actor: 'admin',
      message: `Deleted ${removed} photo(s)` + (touched.length ? ` from ${touched.join(', ')}` : '')
    });

    res.status(200).json({
      success: true,
      removed,
      message: `Deleted ${removed} photo(s).`
    });
  } catch (error) {
    console.error('Delete photos error:', error);
    next(error);
  }
});

// ============================================
// PHOTO UPLOADS (public - for QR upload page)
// ============================================
app.post('/api/uploads', async (req, res, next) => {
  try {
    const { image, eventId, dateIndex } = req.body || {};
    
    console.log('📸 Upload request received:', { eventId, dateIndex, imageLength: image?.length });

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ message: 'Image data is required.' });
    }
    if (!eventId) {
      return res.status(400).json({ message: 'Event is required.' });
    }

    const events = await dbGetCollection('events');
    const event = events.find(e => String(e.id) === String(eventId));
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const entries = Array.isArray(event.dateEntries) ? event.dateEntries : [];
    const di = Number(dateIndex) || 0;
    const entry = entries[di];
    if (!entry) {
      return res.status(400).json({ message: 'Date album not found for this event.' });
    }

    entry.photos = entry.photos || [];
    entry.photos.push(image);
    
    console.log(`💾 Saving to database: events (${entry.photos.length} photos)`);
    await dbSetCollection('events', events);
    await logActivity({ collection: 'events', action: 'photo', record: event, actor: 'public' });

    console.log(`✅ Photo uploaded to ${event.title} - ${entry.date} (${entry.photos.length} photos)`);

    res.status(201).json({ 
      success: true, 
      message: 'Photo uploaded successfully!',
      photoCount: entry.photos.length 
    });
  } catch (error) { 
    console.error('Upload error:', error);
    next(error); 
  }
});

// ============================================
// GENERIC COLLECTION ACCESS
// ============================================
app.get('/api/:collection', validCollection, async (req, res, next) => { 
  try { 
    res.json({ [req.params.collection]: await dbGetCollection(req.params.collection) }); 
  } catch (error) { 
    next(error); 
  } 
});

app.post('/api/:collection', validCollection, async (req, res, next) => { 
  try { 
    const record = { ...req.body, id: req.body?.id || crypto.randomUUID() }; 
    const actor = 'admin';
    const items = await dbGetCollection(req.params.collection); 
    items.unshift(record); 
    await dbSetCollection(req.params.collection, items); 
    await dbSetInitialized(true); 
    await logActivity({ collection: req.params.collection, action: 'created', record, actor }); 
    res.status(201).json(record); 
  } catch (error) { 
    next(error); 
  } 
});

app.patch('/api/:collection/:id', validCollection, async (req, res, next) => { 
  try { 
    const items = await dbGetCollection(req.params.collection); 
    const index = items.findIndex(item => String(item.id) === req.params.id); 
    if (index === -1) return res.status(404).json({ message: 'Record not found.' }); 
    const previous = items[index]; 
    let action = 'updated'; 
    if (req.params.collection === 'prayers' && req.body.status === 'approved') action = 'approved'; 
    else if (req.params.collection === 'prayers' && req.body.status === 'answered') action = 'answered'; 
    else if (req.params.collection === 'announcements' && typeof req.body.isPinned === 'boolean') {
      action = req.body.isPinned ? 'pinned' : 'unpinned'; 
    }
    items[index] = { ...previous, ...req.body, id: previous.id }; 
    await dbSetCollection(req.params.collection, items); 
    await logActivity({ collection: req.params.collection, action, record: items[index], actor: 'admin' }); 
    res.json(items[index]); 
  } catch (error) { 
    next(error); 
  } 
});

app.delete('/api/:collection/:id', validCollection, async (req, res, next) => { 
  try { 
    const items = await dbGetCollection(req.params.collection); 
    const index = items.findIndex(item => String(item.id) === req.params.id); 
    if (index === -1) return res.status(404).json({ message: 'Record not found.' }); 
    const [removed] = items.splice(index, 1); 
    await dbSetCollection(req.params.collection, items); 
    await logActivity({ collection: req.params.collection, action: 'deleted', record: removed, actor: 'admin' }); 
    res.status(204).end(); 
  } catch (error) { 
    next(error); 
  } 
});

app.delete('/api/content', async (req, res, next) => { 
  try { 
    await dbReset(); 
    await logActivity({ collection: 'system', action: 'reset', message: 'All site data was reset', actor: 'admin' }); 
    res.status(204).end(); 
  } catch (error) { 
    next(error); 
  } 
});

// ============================================
// SERVE STATIC FILES
// ============================================
const distDirectory = path.join(__dirname, 'dist');

app.get(['/upload', '/upload/', '/upload.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});
app.get('/upload.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.js'));
});

app.use(express.static(distDirectory));
app.use(express.static(path.join(__dirname, 'public')));

app.get(['/', '/index.html'], (req, res) => {
  const spaIndex = path.join(distDirectory, 'index.html');
  res.sendFile(spaIndex, (err) => {
    if (err) res.sendFile(path.join(__dirname, 'public', 'upload.html'));
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((error, req, res, next) => { 
  console.error('Server error:', error); 
  res.status(500).json({ message: 'Internal server error.' }); 
});

// ============================================
// START SERVER
// ============================================
try {
  await dbInitialize();
} catch (error) {
  console.error('❌ Database initialization failed. Running with in-memory fallback:', error);
  if (!fileDatabase) fileDatabase = emptyDatabase();
}

export { app };
export default app;

const runningDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (runningDirectly) {
  console.log('========================================');
  console.log('  GFC-DATA API Server');
  console.log('========================================');
  console.log(`  Port: ${port}`);
  console.log(`  Storage: ${dbMode === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : dbMode === 'turusql' ? 'Turso/libsql' : `JSON file (${dataFile})`}`);
  console.log(`  CORS allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`  Database initialized: ${fileDatabase ? '✅' : '❌'}`);
  console.log(`  Database connected: ${dbClient ? '✅' : '❌'}`);
  console.log('========================================');
  console.log('  ✅ Server is ready!');
  console.log('========================================');
  app.listen(port, '0.0.0.0');
}