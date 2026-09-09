// GFC-ADMIN/scripts/seed-postgres.js
// One-time: i-upload ang data/data.json papunta sa PostgreSQL (DATABASE_URL).
// Ginagamit ito para i-seed ang Render/Neon database gamit ang local data.
// Run:  $env:DATABASE_URL='postgres://...' ; node scripts/seed-postgres.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(__dirname, '..', 'data', 'data.json');
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Set it first, e.g.:');
  console.error('   $env:DATABASE_URL="postgres://user:pass@host/db" ; node scripts/seed-postgres.js');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gfc_store (
      key   text PRIMARY KEY,
      value jsonb NOT NULL
    )
  `);

  const existing = await pool.query(`SELECT value FROM gfc_store WHERE key = 'db'`);
  if (existing.rows.length) {
    const current = existing.rows[0].value || {};
    const hasData =
      current.initialized ||
      ['events', 'sermons', 'prayers', 'attendees', 'members', 'announcements', 'testimonials']
        .some(key => Array.isArray(current[key]) && current[key].length > 0);
    if (hasData) {
      console.warn('⚠️  May laman na ang database (key="db"). Hindi ko itutuloy para hindi ma-overwrite.');
      console.warn('    Kung gusto mong palitan, i-delete muna ang row:');
      console.warn('    DELETE FROM gfc_store WHERE key=\'db\';');
      await pool.end();
      process.exit(1);
    }
    console.log('♻️  May empty placeholder ang DB — i-o-overwrite ko ito gamit ang data.json.');
    await pool.query(`UPDATE gfc_store SET value = $1::jsonb WHERE key = 'db'`, [JSON.stringify(db)]);
  } else {
    await pool.query(
      `INSERT INTO gfc_store (key, value) VALUES ('db', $1::jsonb)`,
      [JSON.stringify(db)]
    );
  }

  const counts = ['events', 'sermons', 'prayers', 'attendees', 'members', 'announcements', 'testimonials']
    .map(key => `${key}:${Array.isArray(db[key]) ? db[key].length : 0}`)
    .join(', ');

  console.log('✅ Data seeded to PostgreSQL:');
  console.log(`   initialized=${!!db.initialized}`);
  console.log(`   ${counts}`);
  console.log(`   activities:${Array.isArray(db.activities) ? db.activities.length : 0}`);
  await pool.end();
}

main().catch(async (error) => {
  console.error('❌ Seed failed:', error.message);
  await pool.end();
  process.exit(1);
});