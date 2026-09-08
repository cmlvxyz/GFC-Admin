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
const collections = ['events', 'sermons', 'prayers', 'attendees', 'members', 'announcements', 'testimonials'];

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
  activities: [] 
});

// ============================================
// STORAGE LAYER
// Mode A: PostgreSQL (JSONB) kapag may DATABASE_URL (para sa Vercel).
// Mode B: JSON file (data/data.json) - fallback para sa local dev.
// ============================================
let fileDatabase = null;
let writeQueue = Promise.resolve();
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();

const pgPool = DATABASE_URL
  ? new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function dbEnsureSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS gfc_store (
      key   text PRIMARY KEY,
      value jsonb NOT NULL
    )
  `);
}

async function dbLoadBlob() {
  const { rows } = await pgPool.query(`SELECT value FROM gfc_store WHERE key = 'db'`);
  return rows.length ? rows[0].value : null;
}

function dbSaveBlob() {
  const snapshot = JSON.stringify(fileDatabase);
  return pgPool.query(
    `INSERT INTO gfc_store (key, value) VALUES ('db', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [snapshot]
  );
}

async function dbInitialize() {
  await fs.mkdir(dataDirectory, { recursive: true });
  let loaded = null;
  if (pgPool) {
    await dbEnsureSchema();
    loaded = await dbLoadBlob();
  } else {
    try {
      loaded = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      loaded = null;
    }
  }
  if (loaded) {
    fileDatabase = loaded;
    for (const key of collections) {
      if (!Array.isArray(fileDatabase[key])) fileDatabase[key] = [];
    }
    if (!Array.isArray(fileDatabase.activities)) fileDatabase.activities = [];
  } else {
    fileDatabase = emptyDatabase();
    await dbPersist();
  }
}

function dbPersist() {
  if (pgPool) {
    return dbSaveBlob();
  }
  const snapshot = JSON.stringify(fileDatabase, null, 2);
  writeQueue = writeQueue.then(() => fs.writeFile(dataFile, snapshot, 'utf8'));
  return writeQueue;
}

async function dbGetCollection(key) {
  return fileDatabase[key] || [];
}

async function dbSetCollection(key, value) {
  fileDatabase[key] = value;
  await dbPersist();
}

async function dbGetMeta(key) {
  return fileDatabase[key] ?? null;
}

async function dbSetMeta(key, value) {
  fileDatabase[key] = value;
  await dbPersist();
}

async function dbIsInitialized() {
  return Boolean(fileDatabase.initialized);
}

async function dbSetInitialized(value) {
  fileDatabase.initialized = Boolean(value);
  await dbPersist();
}

async function dbGetActivities() {
  return fileDatabase.activities || [];
}

async function dbInsertActivity(entry) {
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
  uploads: '📸' 
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
// CORS - Allow Vercel production domain
// ============================================
const allowedOrigins = [
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:4000',
  process.env.CORS_ORIGIN,
  // Add your Vercel URL here
  'https://gfc-591v4f663-yans-projects-3c2ad947.vercel.app',
  'https://gfc-n55az5ieq-yans-projects-3c2ad947.vercel.app',
  'https://gfc-xxxxxxxxx.vercel.app' // Replace with your actual URL
].filter(Boolean);

app.use(cors({ 
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // For production, you might want to be stricter
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
  res.json({ ok: true, service: 'GFC-DATA', initialized: await dbIsInitialized() }); 
});

// Get config - for QR code generation
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

// Login route removed - admin is now open (no authentication) per user request.

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

    // Store the image directly as base64 in the photos array
    entry.photos = entry.photos || [];
    entry.photos.push(image);
    
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
// SERVE STATIC FILES (upload page)
// ============================================
app.use('/upload', express.static('public', { index: 'upload.html' }));
app.use('/assets', express.static('public', { index: 'upload.html' }));
// Redirect / para sa upload page din (gawing convenient kung walang event/date)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'upload.html')));
app.use(express.static('public'));

// ============================================
// ERROR HANDLER
// ============================================
app.use((error, req, res, next) => { 
  console.error('Server error:', error); 
  res.status(500).json({ message: 'Internal server error.' }); 
});

// ============================================
// START SERVER (only when run directly, not on Vercel)
// ============================================
await dbInitialize();

export { app };
export default app;

const runningDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (runningDirectly) {
  console.log('========================================');
  console.log('  GFC-DATA API Server');
  console.log('========================================');
  console.log(`  Port: ${port}`);
  console.log(`  Storage: ${pgPool ? 'PostgreSQL (DATABASE_URL)' : `JSON file (${dataFile})`}`);
  console.log(`  CORS allowed origins: ${allowedOrigins.join(', ')}`);
  console.log('========================================');
  console.log('  ✅ Server is ready!');
  console.log('========================================');
  app.listen(port, '0.0.0.0');
}