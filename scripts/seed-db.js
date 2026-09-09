// GFC-ADMIN/scripts/seed-db.js
// One-time: i-upload ang data/data.json papunta sa database.
// Auto-detect:
//   - Turso (libsql): DATABASE_URL = libsql://... (gamitin din TURSO_AUTH_TOKEN)
//   - PostgreSQL:     DATABASE_URL = postgres://...
// Run:
//   $env:DATABASE_URL='libsql://...'; $env:TURSO_AUTH_TOKEN='...'; npm run seed

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(__dirname, '..', 'data', 'data.json');
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const IS_LIBSQL = /^(libsql:\/\/|wss:\/\/|ws:\/\/|file:)/.test(DATABASE_URL);

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Set it first, e.g.:');
  console.error('   $env:DATABASE_URL="libsql://your-db...turso.io" ; $env:TURSO_AUTH_TOKEN="..." ; npm run seed');
  console.error('   o:  $env:DATABASE_URL="postgres://user:pass@host/db" ; npm run seed');
  process.exit(1);
}

let client = null;
if (IS_LIBSQL) {
  const { createClient } = await import('@libsql/client');
  client = createClient({ url: DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
} else {
  client = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

async function query(sql, params = []) {
  if (IS_LIBSQL) {
    return client.execute({ sql, args: params });
  }
  return client.query(sql, params);
}

async function close() {
  if (IS_LIBSQL) {
    client.close();
  } else {
    await client.end();
  }
}

async function readRows(key) {
  if (IS_LIBSQL) {
    const res = await query(`SELECT value FROM gfc_store WHERE key = ?`, [key]);
    return { length: res.rows.length, value: res.rows.length ? JSON.parse(res.rows[0].value) : null };
  }
  const res = await query(`SELECT value FROM gfc_store WHERE key = $1`, [key]);
  return { length: res.rows.length, value: res.rows.length ? res.rows[0].value : null };
}

async function upsert(key, value) {
  if (IS_LIBSQL) {
    await query(
      `INSERT INTO gfc_store (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [key, JSON.stringify(value)]
    );
  } else {
    await query(
      `INSERT INTO gfc_store (key, value) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)]
    );
  }
}

async function main() {
  let raw;
  try {
    raw = await fs.promises.readFile(dataFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`❌ ${dataFile} not found. Run the server locally once so data.json is created, or make sure the file exists.`);
      process.exit(1);
    }
    throw error;
  }

  let db;
  try {
    db = JSON.parse(raw);
  } catch {
    console.error('❌ data.json is not valid JSON.');
    process.exit(1);
  }

  if (IS_LIBSQL) {
    await query(`CREATE TABLE IF NOT EXISTS gfc_store ( key TEXT PRIMARY KEY, value TEXT NOT NULL )`);
  } else {
    await query(`CREATE TABLE IF NOT EXISTS gfc_store ( key text PRIMARY KEY, value jsonb NOT NULL )`);
  }

  const existing = await readRows('db');
  if (existing.length) {
    const current = existing.value || {};
    const hasData =
      current.initialized ||
      ['events', 'sermons', 'prayers', 'attendees', 'members', 'announcements', 'testimonials']
        .some(key => Array.isArray(current[key]) && current[key].length > 0);
    if (hasData) {
      console.warn('⚠️  May laman na ang database (key="db"). Hindi ko itutuloy para hindi ma-overwrite.');
      console.warn('    Kung gusto mong palitan, i-delete muna ang row:');
      console.warn('    DELETE FROM gfc_store WHERE key=\'db\';');
      await close();
      process.exit(1);
    }
    console.log('♻️  May empty placeholder ang DB — i-o-overwrite ko ito gamit ang data.json.');
  }

  await upsert('db', db);

  const counts = ['events', 'sermons', 'prayers', 'attendees', 'members', 'announcements', 'testimonials']
    .map(key => `${key}:${Array.isArray(db[key]) ? db[key].length : 0}`)
    .join(', ');

  console.log(`✅ Data seeded to ${IS_LIBSQL ? 'Turso (libsql)' : 'PostgreSQL'}:`);
  console.log(`   initialized=${!!db.initialized}`);
  console.log(`   ${counts}`);
  console.log(`   activities:${Array.isArray(db.activities) ? db.activities.length : 0}`);
  await close();
}

main().catch(async (error) => {
  console.error('❌ Seed failed:', error.message);
  await close();
  process.exit(1);
});