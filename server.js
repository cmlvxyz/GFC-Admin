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
app.set('trust proxy', 1);

// ============================================
// CORS
// ============================================
const allowedOrigins = [
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:4000',
  process.env.CORS_ORIGIN,
  'https://gfc-admin.up.railway.app',
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

// Image proxy: serves Facebook CDN photos through this server so they
// render reliably in every browser/network (FB hotlinking is sometimes
// blocked). Only proxies URLs on Facebook's photo CDNs (no open proxy).
const photoProxyCache = new Map();

app.get('/api/photo', async (req, res, next) => {
  const u = String(req.query.u || '');
  if (!isFacebookCdnUrl(u)) {
    return res.status(400).json({ message: 'Only Facebook CDN photo URLs can be proxied.' });
  }

  const cached = photoProxyCache.get(u);
  if (cached) {
    res.set('Content-Type', cached.type);
    res.set('Cache-Control', 'public, max-age=604800');
    return res.send(cached.body);
  }

  try {
    const upstream = await fetch(u, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 GFC-PhotoProxy/1.0',
        Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*;q=0.8'
      },
      redirect: 'follow'
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    if (!upstream.ok) {
      return res.status(upstream.status).end();
    }
    if (photoProxyCache.size > 800) photoProxyCache.clear();

    const type = upstream.headers.get('content-type') || 'image/jpeg';
    photoProxyCache.set(u, { body, type });
    res.set('Content-Type', type);
    res.set('Cache-Control', 'public, max-age=604800');
    return res.send(body);
  } catch (error) {
    return next(error);
  }
});

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

// The request's public origin (forwarded by the platform's TLS proxy).
function reqOrigin(req) {
  const proto = (req.get('x-forwarded-proto') || 'https').split(',')[0].trim();
  const host = req.get('host') || 'gfc-admin.up.railway.app';
  return `${proto}://${host}`;
}

// Get all content
app.get('/api/content', async (req, res) => {
  const initialized = await dbIsInitialized();
  const origin = reqOrigin(req);
  const content = { version: 1, initialized };
  for (const key of collections) content[key] = await dbGetCollection(key);
  content.activities = await dbGetActivities();
  if (Array.isArray(content.events)) content.events = proxyizeEvents(content.events, origin);
  if (Array.isArray(content.allPhotos)) content.allPhotos = proxyizeAllPhotoBuckets(content.allPhotos, origin);
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
    const pushed = pushUniquePhotos(bucket.photos, [image]);
    if (pushed.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Photo already uploaded (skipped duplicate).',
        photoCount: bucket.photos.length
      });
    }
    const addedImgs = pushed.length;
    
    console.log(`💾 Saving to database: allPhotos (${bucket.photos.length} photos)`);
    await dbSetCollection('allPhotos', list);
    await logActivity({ collection: 'allPhotos', action: 'photo', record: bucket, actor: 'public' });

    console.log(`✅ Photo uploaded to All Photos ${m + 1}/${y} "${label}" (${bucket.photos.length} photos)`);
    res.status(201).json({ success: true, message: 'Photo uploaded successfully!', photoCount: bucket.photos.length, added: addedImgs });
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
    // URL (or a proxied copy) was sent instead of the stored value.
    const target = photoUrl;

    const photoIndex = photos.findIndex(p => {
      const stored = typeof p === 'string' ? p : '';
      return (
        stored === photoUrl ||
        normalizePhotoUrl(stored) === normalizePhotoUrl(photoUrl) ||
        photoKeysMatch(stored, target)
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

app.delete('/api/allPhotos/album', async (req, res, next) => {
  try {
    const { month, year } = req.query;

    if (
      month === undefined ||
      year === undefined ||
      Number.isNaN(parseInt(month, 10)) ||
      Number.isNaN(parseInt(year, 10))
    ) {
      return res.status(400).json({
        message: 'Month and year query parameters are required.'
      });
    }

    const targetMonth = parseInt(month, 10);
    const targetYear = parseInt(year, 10);

    const list = await dbGetCollection('allPhotos');
    const existing = Array.isArray(list) ? list : [];

    const matching = existing.filter(
      album =>
        (typeof album.month === 'number' ? album.month : parseInt(album.month, 10)) === targetMonth &&
        (typeof album.year === 'number' ? album.year : parseInt(album.year, 10)) === targetYear
    );

    if (matching.length === 0) {
      return res.status(404).json({
        message: 'No All Photos album found for that month and year.',
        month: targetMonth,
        year: targetYear
      });
    }

    const remaining = existing.filter(
      album =>
        (typeof album.month === 'number' ? album.month : parseInt(album.month, 10)) !== targetMonth ||
        (typeof album.year === 'number' ? album.year : parseInt(album.year, 10)) !== targetYear
    );

    await dbSetCollection('allPhotos', remaining);

    const removedCount = matching.reduce(
      (total, album) => total + (Array.isArray(album.photos) ? album.photos.length : 0),
      0
    );

    await logActivity({
      collection: 'allPhotos',
      action: 'deleteAlbum',
      record: {
        month: targetMonth,
        year: targetYear,
        albumsRemoved: matching.length,
        photosRemoved: removedCount
      },
      actor: 'admin',
      message: `All Photos album deleted for ${month}/${year} (${removedCount} photos)`
    });

    res.status(200).json({
      success: true,
      message: `All Photos album deleted (${matching.length} bucket(s), ${removedCount} photo(s)).`,
      albumsRemoved: matching.length,
      photosRemoved: removedCount,
      removedLabels: matching
        .map(album => album.date || 'Untitled')
        .filter(Boolean)
    });

  } catch (error) {
    console.error(
      'Delete all-photos album error:',
      error
    );

    next(error);
  }
});

// ============================================
// FACEBOOK IMPORT
// ============================================
// Detects which configured Facebook Page a URL belongs to and
// imports the post's photos into BOTH the target Event AND All Photos.
//
// Required env vars (NEVER expose these to the frontend):
//   FACEBOOK_GFC_PAGE_ID
//   FACEBOOK_GFC_PAGE_ACCESS_TOKEN
//   FACEBOOK_NEXTGEN_PAGE_ID
//   FACEBOOK_NEXTGEN_PAGE_ACCESS_TOKEN
//
// Optional:
//   FACEBOOK_GRAPH_VERSION (default: v21.0)

const GRAPH_VERSION = (process.env.FACEBOOK_GRAPH_VERSION || 'v21.0').trim();

function getFacebookPages() {
  const pages = [];
  if (process.env.FACEBOOK_GFC_PAGE_ID && process.env.FACEBOOK_GFC_PAGE_ACCESS_TOKEN) {
    pages.push({
      key: 'gfc',
      label: 'GFC',
      id: String(process.env.FACEBOOK_GFC_PAGE_ID).trim(),
      token: String(process.env.FACEBOOK_GFC_PAGE_ACCESS_TOKEN).trim()
    });
  }
  if (process.env.FACEBOOK_NEXTGEN_PAGE_ID && process.env.FACEBOOK_NEXTGEN_PAGE_ACCESS_TOKEN) {
    pages.push({
      key: 'nextgen',
      label: 'NextGen',
      id: String(process.env.FACEBOOK_NEXTGEN_PAGE_ID).trim(),
      token: String(process.env.FACEBOOK_NEXTGEN_PAGE_ACCESS_TOKEN).trim()
    });
  }
  return pages;
}

// Extract the owner segment (page id or slug) from a Facebook URL.
function extractFacebookOwner(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return null;
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const first = segments[0].toLowerCase();
    if (['photo', 'photo.php', 'media', 'watch', 'reel', 'story.php', 'permalink.php', 'share', 'groups'].includes(first)) {
      return null;
    }
    return segments[0];
  } catch {
    return null;
  }
}

// Facebook CDN photo URLs carry signed query params (oh, oe, _nc_*). The
// SAME photo re-imported from FB is served under a DIFFERENT signed URL
// every time, so string comparison treats it as a new photo and duplicates
// it inside albums. These helpers collapse such URLs to a canonical key
// (the pathname without the query) and pick the freshest signed copy.
function isFacebookCdnUrl(url) {
  return (
    typeof url === 'string' &&
    /^https:\/\/scontent-[\w.-]+\.(fbcdn|facebook)\.net\//.test(url)
  );
}

function canonicalPhotoKey(url) {
  const unwrapped = unwrapProxyUrl(url);
  return isFacebookCdnUrl(unwrapped) ? unwrapped.split('?')[0] : unwrapped;
}

function freshestSignedUrl(a, b) {
  const expiryOf = (u) => {
    const m = /(?:^|[?&])oe=([0-9a-fA-F]+)/.exec(u);
    return m ? parseInt(m[1], 16) : 0;
  };
  return expiryOf(b) > expiryOf(a) ? b : a;
}

// Deduplicate a photos array by canonical key, keeping one URL per image.
function dedupePhotosByImage(photos) {
  const seen = new Map();
  for (const url of Array.isArray(photos) ? photos : []) {
    if (typeof url !== 'string') continue;
    const key = canonicalPhotoKey(url);
    const current = seen.get(key);
    seen.set(key, current ? freshestSignedUrl(current, url) : url);
  }
  return Array.from(seen.values());
}

// Add only photos that are NOT already present (canonically). Returns the
// URLs that were actually added.
function pushUniquePhotos(target, images) {
  const seen = new Set();
  (Array.isArray(target) ? target : []).forEach((existing) => {
    if (typeof existing === 'string') {
      seen.add(canonicalPhotoKey(existing));
    }
  });
  const added = [];
  for (const img of Array.isArray(images) ? images : []) {
    if (typeof img !== 'string') continue;
    const key = canonicalPhotoKey(img);
    if (!seen.has(key)) {
      seen.add(key);
      target.push(img);
      added.push(img);
    }
  }
  return added;
}

// Some networks/browsers cannot hotlink Facebook CDN images (fbcdn.net),
// so remote FB URLs are rewritten to this server's own /api/photo proxy.
// The proxy fetches the image from the CDN once and serves it locally.
function unwrapProxyUrl(value) {
  const s = String(value || '');
  const m = /\/api\/photo\?u=([^&]+)/.exec(s);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return s;
    }
  }
  return s;
}

// True when two photo URLs point at the same underlying image, even if one
// is a proxied copy and the other the original signed FB URL.
function photoKeysMatch(a, b) {
  const A = unwrapProxyUrl(a);
  const B = unwrapProxyUrl(b);
  if (A === B) return true;
  return canonicalPhotoKey(A) === canonicalPhotoKey(B);
}

function photoProxyUrl(url, origin) {
  if (typeof origin === 'string' && origin && isFacebookCdnUrl(url)) {
    return (
      origin.replace(/\/$/, '') +
      '/api/photo?u=' +
      encodeURIComponent(url)
    );
  }
  return url;
}

// Canonical keys of every photo that exists in at least one event album.
function collectEventPhotoKeys(events) {
  const set = new Set();
  for (const ev of Array.isArray(events) ? events : []) {
    for (const d of Array.isArray(ev.dateEntries) ? ev.dateEntries : []) {
      for (const p of Array.isArray(d.photos) ? d.photos : []) {
        if (typeof p === 'string') set.add(canonicalPhotoKey(p));
      }
    }
  }
  return set;
}

// After an event update where date entries were changed (e.g. an album was
// deleted), drop from All Photos the copies of every photo that was removed
// from this event AND no longer exists in ANY event album. Albums left
// empty are removed too. This keeps the "delete an album -> its photos are
// gone everywhere" behaviour the admin expects, while photos still present
// in some other event album legitimately stay in All Photos.
async function purgeOrphanedAllPhotos(prevEntries, newEntries, allEvents) {
  const entriesKeySet = (entries) => {
    const set = new Set();
    for (const d of Array.isArray(entries) ? entries : []) {
      for (const p of Array.isArray(d.photos) ? d.photos : []) {
        if (typeof p === 'string') set.add(canonicalPhotoKey(p));
      }
    }
    return set;
  };

  const prevKeys = entriesKeySet(prevEntries);
  const newKeys = entriesKeySet(newEntries);
  const removed = [...prevKeys].filter(k => !newKeys.has(k));
  if (removed.length === 0) return;

  const globalKeys = collectEventPhotoKeys(allEvents);
  const orphaned = new Set(removed.filter(k => !globalKeys.has(k)));
  if (orphaned.size === 0) return;

  const list = await dbGetCollection('allPhotos');
  let changed = false;
  const remaining = [];
  for (const album of Array.isArray(list) ? list : []) {
    const photos = Array.isArray(album.photos) ? album.photos : [];
    const kept = photos.filter(
      p => typeof p !== 'string' || !orphaned.has(canonicalPhotoKey(p))
    );
    if (kept.length !== photos.length) changed = true;
    if (kept.length > 0) {
      remaining.push(kept.length === photos.length ? album : { ...album, photos: kept });
    } else if (photos.length > 0) {
      changed = true;
    }
  }
  if (!changed) return;

  await dbSetCollection('allPhotos', remaining);
  await logActivity({
    collection: 'allPhotos',
    action: 'updated',
    record: { purged: orphaned.size },
    actor: 'admin',
    message: `Purged ${orphaned.size} orphaned photo(s) from All Photos after an event album was deleted.`
  });
}

function proxyizePhotos(photos, origin) {
  return (Array.isArray(photos) ? photos : []).map((url) =>
    photoProxyUrl(url, origin)
  );
}

function proxyizeEvents(events, origin) {
  return (Array.isArray(events) ? events : []).map((ev) => {
    if (!Array.isArray(ev.dateEntries)) return ev;
    return {
      ...ev,
      dateEntries: ev.dateEntries.map((entry) => {
        const next = { ...entry, photos: proxyizePhotos(entry.photos, origin) };
        if (entry.coverImage) {
          next.coverImage = photoProxyUrl(String(entry.coverImage), origin);
        }
        return next;
      })
    };
  });
}

function proxyizeAllPhotoBuckets(buckets, origin) {
  return (Array.isArray(buckets) ? buckets : []).map((bucket) =>
    Array.isArray(bucket.photos)
      ? { ...bucket, photos: proxyizePhotos(bucket.photos, origin) }
      : bucket
  );
}

async function graphGet(pathname, params) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pathname}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString(), { method: 'GET' });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error?.message || `Facebook API error (${resp.status})`;
    const err = new Error(msg);
    err.status = resp.status;
    err.fb = data?.error;
    throw err;
  }
  return data;
}

async function resolveFacebookImages(rawUrl, page) {
  const token = page.token;
  const collected = new Set();

  // Known page IDs (Graph API id + URL-based ids) that map to this page.
  // The URL often uses a different id than the Graph API id.
  const PAGE_ID_ALIASES = {
    gfc: ['1074232749116315', '61590579395623'],
    nextgen: ['1085336628004750', '61590304157455']
  };
  const aliases = (PAGE_ID_ALIASES[page.key] || []).concat([page.id]);
  const knownPageIds = Array.from(new Set(aliases.map(String)));

  // ---- 0) pfbid / permalink.php links carry an opaque "pfbid..." post id.
  //      The Graph API cannot read a bare pfbid directly, but the composite
  //      "<page_id>_<pfbid>" form IS accepted for the page that owns the post,
  //      and the page's feed exposes the post under its permalink_url. We keep
  //      the original URL for the album/fallback steps and pass the pfbid into
  //      step 1 as an extra id candidate (page-prefixed composite first).
  const workingUrl = rawUrl;
  let pfbidCandidate = null;
  try {
    const pfUrl = new URL(rawUrl);
    const sfb = pfUrl.searchParams.get('story_fbid') || '';
    if (sfb && !/^\d+$/.test(sfb)) pfbidCandidate = sfb;
  } catch { /* ignore */ }

  // ---- 1) Try direct ID candidates from the URL
  const idCandidates = [];
  try {
    const u = new URL(workingUrl);
    const m1 = u.pathname.match(/\/(?:posts|photos|videos)\/(\d+)/i);
    if (m1) idCandidates.push(m1[1]);
    const fbid = u.searchParams.get('fbid');
    if (fbid && /^\d+$/.test(fbid)) idCandidates.push(fbid);
    const storyFbid = u.searchParams.get('story_fbid');
    if (storyFbid && /^\d+$/.test(storyFbid)) idCandidates.push(storyFbid);
    if (pfbidCandidate) idCandidates.push(pfbidCandidate);
  } catch { /* ignore */ }

  // Also try the URL-owner / numeric page id as prefix
  const urlOwner = extractFacebookOwner(workingUrl);

  for (const bareId of idCandidates) {
    // Build candidates: full "pageid_postid" first, then bare id.
    const candidates = [];
    // If the bare id already contains an underscore it's a full id.
    if (bareId.includes('_')) {
      candidates.push(bareId);
    } else {
      // Prefix with every known page id (alias + graph id).
      for (const pid of knownPageIds) {
        candidates.push(`${pid}_${bareId}`);
      }
      candidates.push(bareId);
    }

    let data = null;
    for (const candidateId of candidates) {
      try {
        data = await graphGet(candidateId, {
          fields: 'id,message,created_time,permalink_url,full_picture,attachments{media,subattachments.limit(100){media}},images',
          access_token: token
        });
        break;
      } catch (e) {
        // Try next candidate
      }
    }

    if (!data) continue;

    // 1a) Largest from images[]
    if (Array.isArray(data.images) && data.images.length > 0) {
      const best = data.images.reduce(
        (a, b) => (Number(a?.width || 0) >= Number(b?.width || 0) ? a : b),
        data.images[0]
      );
      if (best?.source) collected.add(best.source);
    }

    // 1b) Post cover
    if (data.full_picture) collected.add(data.full_picture);

    // ---- 1c) Attachments + subattachments (multi-photo posts)
    // Subattachments are paginated by the Graph API (default ~12 per page).
    // Follow pagination to get ALL photos from a multi-photo post.
    const atts = data.attachments?.data || [];
    for (const att of atts) {
      if (att?.media?.image?.src) collected.add(att.media.image.src);

      // Collect all subattachments including paginated pages
      let page = att?.subattachments?.data || [];
      let nextUrl = att?.subattachments?.paging?.next || null;
      let safety = 0;
      for (const s of page) {
        const src = s?.media?.image?.src || s?.media?.source;
        if (src) collected.add(src);
      }
      while (nextUrl && safety < 100) {
        try {
          const resp = await fetch(nextUrl);
          const data = await resp.json().catch(() => ({}));
          const items = data.data || [];
          for (const s of items) {
            const src = s?.media?.image?.src || s?.media?.source;
            if (src) collected.add(src);
          }
          nextUrl = data.paging?.next || null;
          safety++;
        } catch { break; }
      }
    }

    if (collected.size > 0) {
      return {
        images: Array.from(collected),
        caption: data.message || '',
        permalink: data.permalink_url || rawUrl,
        created_time: data.created_time || ''
      };
    }
  }

  // ---- 2) Album URL
  try {
    const u = new URL(workingUrl);
    const set = u.searchParams.get('set') || '';
    const albumIdMatch = set.match(/a\.(\d+)/);
    const albumPathMatch = u.pathname.match(/\/albums\/(\d+)/);
    const albumId = albumIdMatch?.[1] || albumPathMatch?.[1];
    if (albumId) {
      const data = await graphGet(`${albumId}/photos`, {
        fields: 'images,source,name',
        limit: 200,
        access_token: token
      });
      for (const p of data.data || []) {
        let src = p.source;
        if (Array.isArray(p.images) && p.images.length > 0) {
          const best = p.images.reduce(
            (a, b) => (Number(a?.width || 0) >= Number(b?.width || 0) ? a : b),
            p.images[0]
          );
          src = best?.source || src;
        }
        if (src) collected.add(src);
      }
      if (collected.size > 0) {
        return {
          images: Array.from(collected),
          caption: '',
          permalink: rawUrl,
          created_time: data.data?.[0]?.created_time || ''
        };
      }
    }
  } catch { /* fall through */ }

  // ---- 3) Fallback: match a recent post from the page
  try {
    const ownerMatches = urlOwner && knownPageIds.some(
      id => id.toLowerCase() === String(urlOwner).toLowerCase()
    );
    if (ownerMatches || !urlOwner) {
      const data = await graphGet(`${page.id}/posts`, {
        fields: 'id,message,permalink_url,full_picture,attachments{media,subattachments.limit(100){media}}',
        limit: 99,
        access_token: token
      });
      const posts = data.data || [];
      const cleanUrl = workingUrl.split('?')[0];
      // Try matching by post id suffix (e.g. "122142378597352646")
      const suffixMatch = cleanUrl.match(/\/posts\/(\d+)/);
      const postSuffix = suffixMatch ? suffixMatch[1] : null;

      const match = posts.find(p => {
        if (p.permalink_url && p.permalink_url.split('?')[0] === cleanUrl) return true;
        if (postSuffix && p.id && p.id.endsWith(`_${postSuffix}`)) return true;
        if (postSuffix && p.permalink_url && p.permalink_url.includes(postSuffix)) return true;
        if (pfbidCandidate && p.id && p.id.endsWith(`_${pfbidCandidate}`)) return true;
        if (pfbidCandidate && p.permalink_url && p.permalink_url.includes(pfbidCandidate)) return true;
        return false;
      });

      if (match) {
        if (match.full_picture) collected.add(match.full_picture);
        const firstAtt = match.attachments?.data?.[0];
        if (firstAtt?.media?.image?.src) collected.add(firstAtt.media.image.src);
        let page = firstAtt?.subattachments?.data || [];
        let nextUrl = firstAtt?.subattachments?.paging?.next || null;
        let safety = 0;
        for (const s of page) {
          const src = s?.media?.image?.src || s?.media?.source;
          if (src) collected.add(src);
        }
        while (nextUrl && safety < 100) {
          try {
            const resp = await fetch(nextUrl);
            const d = await resp.json().catch(() => ({}));
            for (const s of d.data || []) {
              const src = s?.media?.image?.src || s?.media?.source;
              if (src) collected.add(src);
            }
            nextUrl = d.paging?.next || null;
            safety++;
          } catch { break; }
        }
        if (collected.size > 0) {
          return {
            images: Array.from(collected),
            caption: match.message || '',
            permalink: match.permalink_url || rawUrl,
            created_time: match.created_time || ''
          };
        }
      }
    }
  } catch (e) {
    console.warn('Fallback (recent posts) failed:', e.message);
  }

  // ---- 4) Last resort: page's recent photos
  try {
    const ownerMatches = urlOwner && knownPageIds.some(
      id => id.toLowerCase() === String(urlOwner).toLowerCase()
    );
    if (!pfbidCandidate && (ownerMatches || !urlOwner)) {
      const data = await graphGet(`${page.id}/photos`, {
        fields: 'images,source,created_time',
        limit: 50,
        access_token: token
      });
      for (const p of data.data || []) {
        let src = p.source;
        if (Array.isArray(p.images) && p.images.length > 0) {
          const best = p.images.reduce(
            (a, b) => (Number(a?.width || 0) >= Number(b?.width || 0) ? a : b),
            p.images[0]
          );
          src = best?.source || src;
        }
        if (src) collected.add(src);
      }
      if (collected.size > 0) {
        return { images: Array.from(collected), caption: '', permalink: rawUrl };
      }
    }
  } catch (e) {
    console.warn('Fallback (recent photos) failed:', e.message);
  }

  throw new Error(
    'Could not resolve photos from that Facebook link. Make sure the post belongs to one of the configured Pages and is public.'
  );
}

// Expands a Facebook /share/ short link to its real destination URL.
// Direct post URLs are returned unchanged.
async function expandFacebookShareUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  return { url, expanded: false };
}

// Builds a unique album label from a Facebook post's creation date.
// Falls back to today's date. Appends " (2)", " (3)", ... when the
// label already exists so each import becomes its own separate album.
function albumLabelFromFbPost(iso, entries) {
  const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  const existing = new Set((entries || []).map(e => norm(e.date)));
  const d = iso ? new Date(iso) : null;
  const base = d && !isNaN(d.getTime())
    ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  let label = base;
  let n = 2;
  while (existing.has(norm(label))) {
    label = `${base} (${n++})`;
  }
  return label;
}

// Extract { month, year } (0-indexed month) from an album label like
// "August 9, 2026" or "August 2026". Returns null when the label has no
// usable date so callers can fall back to the current month.
function monthYearFromLabel(label) {
  let s = String(label || '').trim().replace(/\s*\(\d+\)$/, '');
  if (!s) return null;
  const asDate = new Date(s);
  if (!isNaN(asDate.getTime()) && /^[A-Za-z]+\s+\d{1,2},\s+\d{4}$/.test(s)) {
    return { month: asDate.getMonth(), year: asDate.getFullYear() };
  }
  const monthYear = /^([A-Za-z]+)\s+(\d{4})$/.exec(s);
  if (monthYear) {
    const d = new Date(`${monthYear[1]} 1, ${monthYear[2]}`);
    if (!isNaN(d.getTime())) {
      return { month: d.getMonth(), year: parseInt(monthYear[2], 10) };
    }
  }
  return null;
}

// POST /api/facebook/import
// Body: { url, eventId?, dateIndex? }
// - If eventId + dateIndex provided: saves to BOTH Event AND All Photos.
// - Otherwise: saves to All Photos only.
app.post('/api/facebook/import', async (req, res, next) => {
  try {
    const { url: rawInput, eventId, dateIndex, date } = req.body || {};
    if (!rawInput || typeof rawInput !== 'string') {
      return res.status(400).json({ message: 'Facebook URL is required.' });
    }

    let parsed;
    try {
      parsed = new URL(rawInput.trim());
    } catch {
      return res.status(400).json({ message: 'Please enter a valid Facebook URL.' });
    }
    if (!/(^|\.)facebook\.com$/i.test(parsed.hostname) && !/fb\.watch$/i.test(parsed.hostname)) {
      return res.status(400).json({ message: 'Only facebook.com URLs are supported.' });
    }

    // Reject bare page/profile URLs — they don't point at a post.
    if (/\/profile\.php$/i.test(parsed.pathname)) {
      return res.status(400).json({
        message: 'That is a Page profile link, not a post. Please open the specific post and copy its direct link (or use the Share → Copy link option).'
      });
    }

    // Expand /share/... short links to their real destination.
    const { url: expandedUrl, expanded } = await expandFacebookShareUrl(rawInput.trim());
    const url = expandedUrl;
    console.log(`📘 Facebook import: "${rawInput}"${expanded ? ` → "${url}"` : ''}`);

    const pages = getFacebookPages();
    if (pages.length === 0) {
      return res.status(500).json({
        message: 'No Facebook Pages are configured on the server. Please set FACEBOOK_GFC_PAGE_ID / FACEBOOK_GFC_PAGE_ACCESS_TOKEN (and/or NEXTGEN equivalents).'
      });
    }

    // Pick the matching page.
    const owner = extractFacebookOwner(url);
    let page = null;
    if (owner) {
      page = pages.find(p => p.id === owner) || pages.find(p => p.id.toLowerCase() === owner.toLowerCase());
    }

    let resolved = null;
    if (page) {
      resolved = await resolveFacebookImages(url, page);
    } else {
      let lastErr = null;
      for (const p of pages) {
        try {
          resolved = await resolveFacebookImages(url, p);
          page = p;
          break;
        } catch (e) { lastErr = e; }
      }
      if (!page || !resolved) {
        return res.status(400).json({
          message: lastErr?.message || 'Could not resolve that Facebook link against any configured Page.'
        });
      }
    }

    const images = resolved.images || [];
    if (images.length === 0) {
      return res.status(400).json({ message: 'No photos were found at that Facebook URL.' });
    }

    // ---- Save to Event (if eventId + dateIndex provided) ----
    let eventSaved = 0;
    let eventTitle = '';
    let eventDate = '';

    if (eventId) {
      const events = await dbGetCollection('events');
      const evIndex = events.findIndex(e => String(e.id) === String(eventId));
      if (evIndex === -1) {
        return res.status(404).json({ message: 'Event not found.' });
      }
      const ev = events[evIndex];
      const entries = Array.isArray(ev.dateEntries) ? ev.dateEntries : [];

      // Prefer matching by the album label (safe for year albums like
      // "1st Year Anniversary"); fall back to the numeric index.
      let entry = null;
      if (typeof date === 'string' && date.trim()) {
        const target = date.trim().toLowerCase().replace(/\s+/g, '');
        entry = entries.find(e =>
          String(e.date || '').trim().toLowerCase().replace(/\s+/g, '') === target
        ) || null;
      } else {
        const di = Number(dateIndex) || 0;
        entry = entries[di] || null;
      }

      // For events like GOSPEL NETWORK there is no date selection: each
      // import creates its OWN new album, labelled by the post's date.
      if (!entry && req.body.autoCreateAlbum === true) {
        const label = albumLabelFromFbPost(resolved.created_time, entries);
        entry = { date: label, photos: [] };
        entries.push(entry);
        await logActivity({
          collection: 'events',
          action: 'album',
          record: ev,
          actor: 'admin',
          message: `Auto-created album "${label}" in "${ev.title}"`
        });
      }

      if (!entry) {
        return res.status(400).json({ message: 'Album not found for this event.' });
      }

      entry.photos = Array.isArray(entry.photos) ? entry.photos : [];
      const eventSavedImgs = pushUniquePhotos(entry.photos, images);
      eventSaved = eventSavedImgs.length;

      await dbSetCollection('events', events);
      eventTitle = ev.title;
      eventDate = entry.date || '';

      await logActivity({
        collection: 'events',
        action: 'photo',
        record: ev,
        actor: 'admin',
        message: `Imported ${eventSaved} photo(s) from Facebook (${page.label}) into "${ev.title}"`
      });
    }

    // ---- Save to All Photos (always) ----
    // Photos are bucketed by the EVENT's date (e.g. "August 9, 2026" ->
    // August 2026) so each import lands in the month it truly belongs to
    // instead of whenever it was imported. Without an event date (a bare
    // import / a non-date album label), fall back to the current month.
    const parsedDate = monthYearFromLabel(eventDate || '');
    const now = new Date();
    const m = parsedDate ? parsedDate.month : now.getMonth();
    const y = parsedDate ? parsedDate.year : now.getFullYear();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const label = `${monthNames[m]} ${y}`;

    const list = await dbGetCollection('allPhotos');
    let bucket = list.find(a => String(a.month) === String(m) && String(a.year) === String(y));
    if (!bucket) {
      bucket = { month: m, year: y, date: label, photos: [] };
      list.push(bucket);
    }
    bucket.photos = Array.isArray(bucket.photos) ? bucket.photos : [];

    const allSavedImgs = pushUniquePhotos(bucket.photos, images);
    const allSaved = allSavedImgs.length;

    await dbSetCollection('allPhotos', list);
    await logActivity({
      collection: 'allPhotos',
      action: 'photo',
      record: bucket,
      actor: 'admin',
      message: `Imported ${allSaved} photo(s) from Facebook (${page.label})`
    });

    res.status(201).json({
      success: true,
      message: eventId
        ? `Imported ${eventSaved} photo(s) into "${eventTitle}" and ${allSaved} into All Photos.`
        : `Imported ${allSaved} photo(s) into All Photos.`,
      imported: {
        event: eventSaved,
        allPhotos: allSaved
      },
      page: page.label,
      bucket: { month: m, year: y, date: label }
    });
  } catch (error) {
    console.error('Facebook import error:', error);
    if (error.fb?.message) {
      return res.status(error.status || 400).json({ message: error.fb.message });
    }
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
      normalizePhotoUrl(String(stored)) === normalizePhotoUrl(target) ||
      photoKeysMatch(stored, target);

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
    const { image, eventId, dateIndex, date } = req.body || {};
    
    console.log('📸 Upload request received:', { eventId, dateIndex, date, imageLength: image?.length });

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

    // Prefer matching by the album label (safe for year albums like
    // "1st Year Anniversary"); fall back to the numeric index.
    let entry = null;
    if (typeof date === 'string' && date.trim()) {
      const target = date.trim().toLowerCase().replace(/\s+/g, '');
      entry = entries.find(e =>
        String(e.date || '').trim().toLowerCase().replace(/\s+/g, '') === target
      ) || null;
    } else {
      const di = Number(dateIndex) || 0;
      entry = entries[di] || null;
    }

    if (!entry) {
      return res.status(400).json({ message: 'Album not found for this event.' });
    }

    entry.photos = entry.photos || [];
    const addedImgs = pushUniquePhotos(entry.photos, [image]);
    const wasNew = addedImgs.length > 0;
    if (!wasNew) {
      return res.status(200).json({
        success: true,
        message: 'Photo already uploaded (skipped duplicate).',
        photoCount: entry.photos.length
      });
    }
    
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
    const origin = reqOrigin(req);
    const data = await dbGetCollection(req.params.collection);
    if (req.params.collection === 'events') proxyizeEvents(data, origin);
    if (req.params.collection === 'allPhotos') proxyizeAllPhotoBuckets(data, origin);
    res.json({ [req.params.collection]: data }); 
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

    if (
      req.params.collection === 'events' &&
      Array.isArray(req.body.dateEntries)
    ) {
      await purgeOrphanedAllPhotos(
        Array.isArray(previous.dateEntries) ? previous.dateEntries : [],
        req.body.dateEntries,
        items
      );
    }

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
  res.set('Cache-Control', 'no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});
app.get('/upload.js', (req, res) => {
  res.set('Cache-Control', 'no-store, must-revalidate');
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