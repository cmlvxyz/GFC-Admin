import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4000);
const dataDirectory = path.join(__dirname, 'data');
const dataFile = path.join(dataDirectory, 'data.json');
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');
const collections = ['events', 'sermons', 'prayers', 'attendees', 'members', 'announcements', 'testimonials'];
const publicCollections = new Set(['prayers', 'attendees']);
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const tokenSecret = process.env.ADMIN_TOKEN_SECRET || 'change-this-secret-in-production';
const emptyDatabase = () => ({ version: 1, initialized: false, events: [], sermons: [], prayers: [], attendees: [], members: [], announcements: [], testimonials: [], activities: [] });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ============================================
// STORAGE LAYER (PostgreSQL + JSON file fallback)
// ============================================
// Kapag may DATABASE_URL, PostgreSQL ang gamit (permanent storage sa Render).
// Kung wala, JSON file sa ./data/data.json (local development).
const usePostgres = Boolean(process.env.DATABASE_URL);
const pool = usePostgres ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

let fileDatabase = null;
let writeQueue = Promise.resolve();

async function dbInitialize() {
  if (!usePostgres) {
    await fs.mkdir(dataDirectory, { recursive: true });
    try {
      fileDatabase = JSON.parse(await fs.readFile(dataFile, 'utf8'));
      for (const key of collections) if (!Array.isArray(fileDatabase[key])) fileDatabase[key] = [];
      if (!Array.isArray(fileDatabase.activities)) fileDatabase.activities = [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      fileDatabase = emptyDatabase();
      await dbPersist();
    }
    return;
  }
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS collections (key TEXT PRIMARY KEY, data JSONB NOT NULL)`);
    await client.query(`CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, type TEXT, action TEXT, message TEXT, icon TEXT, actor TEXT, created_at TEXT)`);
    await client.query(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value JSONB NOT NULL)`);
  } finally {
    client.release();
  }
}

function dbPersist() {
  const snapshot = JSON.stringify(fileDatabase, null, 2);
  writeQueue = writeQueue.then(() => fs.writeFile(dataFile, snapshot, 'utf8'));
  return writeQueue;
}

async function dbGetCollection(key) {
  if (!usePostgres) return fileDatabase[key] || [];
  const result = await pool.query('SELECT data FROM collections WHERE key = $1', [key]);
  if (!result.rows.length) return [];
  const data = result.rows[0].data;
  return Array.isArray(data) ? data : [];
}

async function dbSetCollection(key, value) {
  if (!usePostgres) {
    fileDatabase[key] = value;
    await dbPersist();
    return;
  }
  await pool.query(
    'INSERT INTO collections (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data',
    [key, JSON.stringify(value)]
  );
}

async function dbGetMeta(key) {
  if (!usePostgres) return fileDatabase[key] ?? null;
  const result = await pool.query('SELECT value FROM meta WHERE key = $1', [key]);
  return result.rows.length ? result.rows[0].value : null;
}

async function dbSetMeta(key, value) {
  if (!usePostgres) {
    fileDatabase[key] = value;
    await dbPersist();
    return;
  }
  await pool.query(
    'INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, JSON.stringify(value)]
  );
}

async function dbIsInitialized() {
  if (!usePostgres) return Boolean(fileDatabase.initialized);
  return Boolean(await dbGetMeta('initialized'));
}

async function dbSetInitialized(value) {
  await dbSetMeta('initialized', Boolean(value));
}

async function dbGetActivities() {
  if (!usePostgres) return fileDatabase.activities || [];
  const result = await pool.query('SELECT id, type, action, message, icon, actor, created_at AS "createdAt" FROM activities ORDER BY created_at DESC LIMIT 300');
  return result.rows.map(row => ({ id: row.id, type: row.type, action: row.action, message: row.message, icon: row.icon, actor: row.actor, createdAt: row.createdAt }));
}

async function dbInsertActivity(entry) {
  if (!usePostgres) {
    fileDatabase.activities = fileDatabase.activities || [];
    fileDatabase.activities.unshift(entry);
    if (fileDatabase.activities.length > activityLimit) fileDatabase.activities = fileDatabase.activities.slice(0, activityLimit);
    await dbPersist();
    return;
  }
  await pool.query(
    'INSERT INTO activities (id, type, action, message, icon, actor, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [entry.id, entry.type, entry.action, entry.message, entry.icon, entry.actor, entry.createdAt]
  );
  await pool.query('DELETE FROM activities WHERE id NOT IN (SELECT id FROM activities ORDER BY created_at DESC LIMIT $1)', [activityLimit]);
}

async function dbClearActivities() {
  if (!usePostgres) {
    fileDatabase.activities = [];
    await dbPersist();
    return;
  }
  await pool.query('DELETE FROM activities');
}

async function dbReset() {
  if (!usePostgres) {
    fileDatabase = emptyDatabase();
    await dbPersist();
    return;
  }
  await pool.query('DELETE FROM collections');
  await pool.query('DELETE FROM meta WHERE key = $1', ['initialized']);
}

// ============================================
// ACTIVITY LOG
// ============================================
const activityLimit = 300;
const sseClients = new Set();
const icons = { events: '📅', sermons: '🎬', prayers: '🙏', attendees: '👤', members: '🧑', announcements: '📢', testimonials: '🗣️', admin: '🔐', system: '⚙️', uploads: '📸' };
const activityMessages = {
  events: { created: (l) => `New event "${l}" was added`, updated: (l) => `Event "${l}" was updated`, deleted: (l) => `Event "${l}" was deleted`, photo: (l) => `Photo uploaded to "${l}"` },
  sermons: { created: (l) => `New sermon "${l}" was added`, updated: (l) => `Sermon "${l}" was updated`, deleted: (l) => `Sermon "${l}" was deleted` },
  announcements: { created: (l) => `New announcement "${l}" was posted`, updated: (l) => `Announcement "${l}" was updated`, deleted: (l) => `Announcement "${l}" was deleted`, pinned: (l) => `Announcement "${l}" was pinned`, unpinned: (l) => `Announcement "${l}" was unpinned` },
  prayers: { created: (l) => `New prayer request from "${l}" was submitted`, updated: (l) => `Prayer request from "${l}" was updated`, deleted: (l) => `Prayer request from "${l}" was deleted`, approved: (l) => `Prayer request from "${l}" was approved`, answered: (l) => `Prayer request from "${l}" was marked answered` },
  attendees: { created: (l) => `New attendee "${l}" was registered`, updated: (l) => `Attendee "${l}" was updated`, deleted: (l) => `Attendee "${l}" was deleted` },
  members: { created: (l) => `New member "${l}" was added`, updated: (l) => `Member "${l}" was updated`, deleted: (l) => `Member "${l}" was deleted` },
  testimonials: { created: (l) => `New testimonial from "${l}" was added`, updated: (l) => `Testimonial from "${l}" was updated`, deleted: (l) => `Testimonial from "${l}" was deleted` }
};
function recordLabel(record) { return (record && (record.title || record.name || record.fullName || 'record')) || 'record'; }
function describe(collection, action, record) { const table = activityMessages[collection]; const fn = table && table[action]; if (fn) return fn(recordLabel(record)); if (table && table.created) return table.created(recordLabel(record)); return `${collection} ${action}`; }
function broadcast(payload) { const data = 'data: ' + JSON.stringify(payload) + '\n\n'; for (const client of sseClients) { try { client.write(data); } catch (error) { sseClients.delete(client); } } }
function logActivity({ collection, action, record, message, actor }) {
  const entry = { id: crypto.randomUUID(), type: collection, action, message: message || describe(collection, action, record), icon: icons[collection] || '•', actor: actor || 'admin', createdAt: new Date().toISOString() };
  broadcast({ type: 'activity', data: entry });
  return dbInsertActivity(entry);
}
function tokenFor(username) { const payload = Buffer.from(JSON.stringify({ sub: username, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url'); const signature = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url'); return payload + '.' + signature; }
function isValidToken(value) { if (!value) return false; const [payload, signature] = value.split('.'); if (!payload || !signature) return false; const expected = crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url'); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false; try { const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); return decoded.sub === adminUsername && decoded.exp > Date.now(); } catch { return false; } }
function readToken(req) { const header = req.headers.authorization || ''; if (header.startsWith('Bearer ')) return header.slice(7); if (req.query && typeof req.query.token === 'string') return req.query.token; return ''; }
function requireAdmin(req, res, next) { if (!isValidToken(readToken(req))) return res.status(401).json({ message: 'Admin authentication required.' }); next(); }
function validCollection(req, res, next) { if (!collections.includes(req.params.collection)) return res.status(404).json({ message: 'Unknown collection.' }); next(); }

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '12mb' }));

// ============================================
// PUBLIC CONFIG (for upload page + QR generator)
// ============================================
app.get('/api/config', (req, res) => {
  const appUrl = process.env.APP_URL || `http://localhost:${port}`;
  res.json({ appUrl, cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '' });
});

app.get('/api/health', async (req, res) => { res.json({ ok: true, service: 'GFC-DATA', initialized: await dbIsInitialized() }); });
app.get('/api/content', async (req, res) => {
  const initialized = await dbIsInitialized();
  const content = { version: 1, initialized };
  for (const key of collections) content[key] = await dbGetCollection(key);
  content.activities = await dbGetActivities();
  res.json(content);
});
app.post('/api/auth/login', async (req, res, next) => { try { const { username, password } = req.body || {}; if (username !== adminUsername || password !== adminPassword) return res.status(401).json({ message: 'Invalid username or password.' }); const token = tokenFor(username); await logActivity({ collection: 'admin', action: 'login', message: 'Admin signed in to the system', actor: 'admin' }); res.json({ token, expiresIn: 8 * 60 * 60 }); } catch (error) { next(error); } });
app.post('/api/bootstrap', async (req, res, next) => { try { if (await dbIsInitialized()) return res.status(409).json({ message: 'The database has already been initialized.' }); for (const collection of collections) { const value = Array.isArray(req.body?.[collection]) ? req.body[collection] : []; await dbSetCollection(collection, value); } await dbSetInitialized(true); await logActivity({ collection: 'system', action: 'bootstrap', message: 'Site data was initialized (bootstrap)', actor: 'system' }); const content = { version: 1, initialized: true }; for (const key of collections) content[key] = await dbGetCollection(key); res.status(201).json(content); } catch (error) { next(error); } });

// ============================================
// PHOTO UPLOADS (public - para sa QR upload page)
// ============================================
app.post('/api/uploads', async (req, res, next) => {
  try {
    const { image, eventId, dateIndex } = req.body || {};
    if (!image || typeof image !== 'string') return res.status(400).json({ message: 'Image data is required.' });
    if (!eventId) return res.status(400).json({ message: 'Event is required.' });

    const events = await dbGetCollection('events');
    const event = events.find(e => String(e.id) === String(eventId));
    if (!event) return res.status(404).json({ message: 'Event not found.' });

    const entries = Array.isArray(event.dateEntries) ? event.dateEntries : [];
    const di = Number(dateIndex) || 0;
    const entry = entries[di];
    if (!entry) return res.status(400).json({ message: 'Date album not found for this event.' });

    const result = await cloudinary.uploader.upload(image, {
      folder: `gfc/${eventId}/${di + 1}`,
      transformation: [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }]
    });

    entry.photos = entry.photos || [];
    entry.photos.push(result.secure_url);
    await dbSetCollection('events', events);
    await logActivity({ collection: 'events', action: 'photo', record: event, actor: 'public' });

    res.status(201).json({ success: true, url: result.secure_url, publicId: result.public_id });
  } catch (error) { next(error); }
});

// Activities API
app.get('/api/activities', requireAdmin, async (req, res, next) => { try { res.json({ activities: await dbGetActivities() }); } catch (error) { next(error); } });
app.get('/api/activities/stream', (req, res) => { if (!isValidToken(readToken(req))) return res.status(401).json({ message: 'Admin authentication required.' }); res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.write('retry: 5000\n\n'); sseClients.add(res); const heartbeat = setInterval(() => { try { res.write(': keep-alive\n\n'); } catch { /* ignore */ } }, 15000); req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); }); });
app.delete('/api/activities', requireAdmin, async (req, res, next) => { try { await dbClearActivities(); res.status(204).end(); } catch (error) { next(error); } });

// Generic collection access
app.get('/api/:collection', validCollection, requireAdmin, async (req, res, next) => { try { res.json({ [req.params.collection]: await dbGetCollection(req.params.collection) }); } catch (error) { next(error); } });
app.post('/api/:collection', validCollection, async (req, res, next) => { try { if (!publicCollections.has(req.params.collection) && !isValidToken(readToken(req))) return res.status(401).json({ message: 'Admin authentication required.' }); const actor = publicCollections.has(req.params.collection) ? 'public' : 'admin'; const record = { ...req.body, id: req.body?.id || crypto.randomUUID() }; const items = await dbGetCollection(req.params.collection); items.unshift(record); await dbSetCollection(req.params.collection, items); await dbSetInitialized(true); await logActivity({ collection: req.params.collection, action: 'created', record, actor }); res.status(201).json(record); } catch (error) { next(error); } });
app.patch('/api/:collection/:id', validCollection, requireAdmin, async (req, res, next) => { try { const items = await dbGetCollection(req.params.collection); const index = items.findIndex(item => String(item.id) === req.params.id); if (index === -1) return res.status(404).json({ message: 'Record not found.' }); const previous = items[index]; let action = 'updated'; if (req.params.collection === 'prayers' && req.body.status === 'approved') action = 'approved'; else if (req.params.collection === 'prayers' && req.body.status === 'answered') action = 'answered'; else if (req.params.collection === 'announcements' && typeof req.body.isPinned === 'boolean') action = req.body.isPinned ? 'pinned' : 'unpinned'; items[index] = { ...previous, ...req.body, id: previous.id }; await dbSetCollection(req.params.collection, items); await logActivity({ collection: req.params.collection, action, record: items[index], actor: 'admin' }); res.json(items[index]); } catch (error) { next(error); } });
app.delete('/api/:collection/:id', validCollection, requireAdmin, async (req, res, next) => { try { const items = await dbGetCollection(req.params.collection); const index = items.findIndex(item => String(item.id) === req.params.id); if (index === -1) return res.status(404).json({ message: 'Record not found.' }); const [removed] = items.splice(index, 1); await dbSetCollection(req.params.collection, items); await logActivity({ collection: req.params.collection, action: 'deleted', record: removed, actor: 'admin' }); res.status(204).end(); } catch (error) { next(error); } });
app.delete('/api/content', requireAdmin, async (req, res, next) => { try { await dbReset(); await logActivity({ collection: 'system', action: 'reset', message: 'All site data was reset', actor: 'admin' }); res.status(204).end(); } catch (error) { next(error); } });

// ============================================
// STATIC SERVING (admin panel + public upload page)
// ============================================
app.get('/upload', (req, res) => res.sendFile(path.join(publicDir, 'upload.html')));
app.get('/upload.js', (req, res) => res.sendFile(path.join(publicDir, 'upload.js')));
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

app.use((error, req, res, next) => { console.error(error); res.status(500).json({ message: 'Internal server error.' }); });

dbInitialize().then(() => { if (!usePostgres && adminUsername === 'admin' && adminPassword === 'admin123') console.warn('Using demo admin credentials. Set ADMIN_USERNAME and ADMIN_PASSWORD before production.'); console.log(`GFC-DATA API listening on port ${port} (storage: ${usePostgres ? 'PostgreSQL' : 'JSON file'})`); app.listen(port, '0.0.0.0'); }).catch(error => { console.error('Unable to load database.', error); process.exit(1); });