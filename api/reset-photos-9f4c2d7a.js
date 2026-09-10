import pg from 'pg';
import { createClient } from '@libsql/client';

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const IS_LIBSQL = /^(libsql:\/\/|wss:\/\/|ws:\/\/|file:)/.test(DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  if (!DATABASE_URL) {
    return res.status(500).json({ message: 'DATABASE_URL is not configured.' });
  }

  try {
    let db;
    let snapshot;

    if (IS_LIBSQL) {
      db = createClient({
        url: DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN || undefined,
      });
      const result = await db.execute({
        sql: 'SELECT value FROM gfc_store WHERE key = ?',
        args: ['db'],
      });
      if (!result.rows.length) {
        return res.status(404).json({ message: 'Database record not found.' });
      }
      snapshot = JSON.parse(result.rows[0].value);
    } else {
      db = new pg.Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      const result = await db.query("SELECT value FROM gfc_store WHERE key = 'db'");
      if (!result.rows.length) {
        await db.end();
        return res.status(404).json({ message: 'Database record not found.' });
      }
      snapshot = result.rows[0].value;
    }

    const events = Array.isArray(snapshot.events) ? snapshot.events : [];
    let eventPhotoCount = 0;

    for (const event of events) {
      if (!Array.isArray(event.dateEntries)) continue;
      for (const entry of event.dateEntries) {
        if (Array.isArray(entry.photos)) {
          eventPhotoCount += entry.photos.length;
          entry.photos = [];
        }
      }
    }

    const allPhotoAlbums = Array.isArray(snapshot.allPhotos) ? snapshot.allPhotos : [];
    let allPhotoCount = 0;
    for (const album of allPhotoAlbums) {
      if (Array.isArray(album.photos)) {
        allPhotoCount += album.photos.length;
        album.photos = [];
      }
    }

    snapshot.events = events;
    snapshot.allPhotos = allPhotoAlbums;

    const nextSnapshot = JSON.stringify(snapshot);

    if (IS_LIBSQL) {
      await db.execute({
        sql: `INSERT INTO gfc_store (key, value) VALUES (?, ?)
              ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        args: ['db', nextSnapshot],
      });
      db.close();
    } else {
      await db.query(
        `INSERT INTO gfc_store (key, value) VALUES ('db', $1::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [nextSnapshot]
      );
      await db.end();
    }

    return res.status(200).json({
      success: true,
      message: 'One-time photo reset completed.',
      eventsPhotosCleared: eventPhotoCount,
      allPhotosCleared: allPhotoCount,
    });
  } catch (error) {
    console.error('One-time photo reset error:', error);
    return res.status(500).json({ message: error.message || 'Reset failed.' });
  }
}
