// scripts/remove-covers.js
// Removes coverImage from every non-anniversary event's date entries
// (including e.g. Sunday Service "June 14"). Only the Church Anniversary
// event keeps its covers. Runs against whichever storage is configured:
// Turso/libsql or Postgres when DATABASE_URL is set, otherwise data.json.
//
// Run the script while the API server is STOPPED (or restart the server
// afterwards), so the server's in-memory copy does not overwrite the change.

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(__dirname, '..', 'data', 'data.json');

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const IS_LIBSQL = /^(libsql:\/\/|wss:\/\/|ws:\/\/|file:)/.test(DATABASE_URL);

const isAnniversary = (ev) =>
  String(ev?.id) === 'anniversary' ||
  /anniversary/i.test(String(ev?.title || ''));

// Returns the events array with covers stripped from non-anniversary events.
function stripCovers(events) {
  let removed = 0;
  const out = (Array.isArray(events) ? events : []).map((ev) => {
    if (isAnniversary(ev)) return ev;
    if (!Array.isArray(ev.dateEntries)) return ev;
    let changed = false;
    const dateEntries = ev.dateEntries.map((entry) => {
      if (!entry || !('coverImage' in entry) || entry.coverImage === undefined) return entry;
      changed = true;
      const { coverImage, ...rest } = entry;
      void coverImage;
      removed++;
      return rest;
    });
    return changed ? { ...ev, dateEntries } : ev;
  });
  return { events: out, removed };
}

async function main() {
  let sourceLabel = '';
  let blob = null;
  let write = null;

  if (DATABASE_URL) {
    sourceLabel = DATABASE_URL;
    let client;
    if (IS_LIBSQL) {
      const { createClient } = await import('@libsql/client');
      client = createClient({
        url: DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN || undefined
      });
    } else {
      const pg = await import('pg');
      client = new pg.default.Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
    }

    if (IS_LIBSQL) {
      const res = await client.execute({
        sql: 'SELECT value FROM gfc_store WHERE key = ?',
        args: ['db']
      });
      if (res.rows.length) blob = JSON.parse(res.rows[0].value);
      write = async (snapshot) => {
        await client.execute({
          sql: `INSERT INTO gfc_store (key, value) VALUES (?, ?)
                ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
          args: ['db', JSON.stringify(snapshot)]
        });
        await client.close();
      };
    } else {
      const { rows } = await client.query(`SELECT value FROM gfc_store WHERE key = 'db'`);
      if (rows.length) blob = rows[0].value;
      write = async (snapshot) => {
        await client.query(
          `INSERT INTO gfc_store (key, value) VALUES ('db', $1::jsonb)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [JSON.stringify(snapshot)]
        );
        await client.end();
      };
    }
  } else {
    sourceLabel = dataFile;
    const content = await fs.readFile(dataFile, 'utf8');
    blob = JSON.parse(content);
    write = async (snapshot) => {
      await fs.writeFile(dataFile, JSON.stringify(snapshot, null, 2), 'utf8');
    };
  }

  if (!blob || !Array.isArray(blob.events)) {
    console.log('No events found in storage; nothing to do.');
    return;
  }

  const { events, removed } = stripCovers(blob.events);
  if (removed === 0) {
    console.log('No coverImage found on non-anniversary events.');
    return;
  }

  blob.events = events;
  await write(blob);
  console.log(`Removed ${removed} cover(s). Storage updated: ${sourceLabel}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});