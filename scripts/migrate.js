#!/usr/bin/env node
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

function getDatabaseUrl() {
  const fileEnv = process.env.DATABASE_URL_FILE;
  if (fileEnv && fs.existsSync(fileEnv)) {
    return fs.readFileSync(fileEnv, 'utf-8').trim();
  }
  return process.env.DATABASE_URL;
}

const DATABASE_URL = getDatabaseUrl();

if (!DATABASE_URL) {
  console.error('DATABASE_URL or DATABASE_URL_FILE must be set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: false, max: 1 });

const SAFE_ERROR_CODES = new Set(['42P07', '42710', '42P06', '42P16', '42701', '23505']);

async function runMigrations() {
  console.log('Running database migrations...');

  const client = await pool.connect();
  let hasLock = false;

  try {
    const lockResult = await client.query('SELECT pg_try_advisory_lock(987654321) as acquired');
    hasLock = lockResult.rows[0].acquired;

    if (!hasLock) {
      console.log('Another instance is running migrations, waiting...');
      await client.query('SELECT pg_advisory_lock(987654321)');
      hasLock = true;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        created_at BIGINT NOT NULL
      );
    `);

    const applied = await client.query('SELECT hash FROM __drizzle_migrations ORDER BY created_at');
    const appliedSet = new Set(applied.rows.map(r => r.hash));

    const migrationsDir = path.join(__dirname, '../drizzle');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No drizzle directory found, skipping migrations');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found');
      return;
    }

    let applied_count = 0;
    let skipped = 0;

    for (const file of files) {
      const hash = file;

      if (appliedSet.has(hash)) {
        skipped++;
        continue;
      }

      console.log(`Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT (hash) DO NOTHING',
          [hash, Date.now()]
        );
        console.log(`Applied ${file}`);
        applied_count++;
      } catch (error) {
        if (SAFE_ERROR_CODES.has(error.code)) {
          console.log(`${file}: objects already exist, marking as applied`);
          await client.query(
            'INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT (hash) DO NOTHING',
            [hash, Date.now()]
          );
        } else {
          console.error(`Failed to apply ${file}:`, error.message);
          throw error;
        }
      }
    }

    console.log(`Migrations done. Applied: ${applied_count}, Skipped: ${skipped}`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (hasLock) await client.query('SELECT pg_advisory_unlock(987654321)');
    client.release();
    await pool.end();
  }
}

runMigrations();
