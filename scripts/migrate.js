#!/usr/bin/env node
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const SAFE_CODES = new Set(['42P07', '42710', '42P06', '42P16', '42701', '23505']);

async function runMigrations() {
  console.log('Running database migrations...');

  const sql = postgres(DATABASE_URL, { max: 1, ssl: false });

  try {
    await sql`SELECT pg_advisory_lock(987654321)`;

    await sql`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        created_at BIGINT NOT NULL
      )
    `;

    const applied = await sql`SELECT hash FROM __drizzle_migrations ORDER BY created_at`;
    const appliedSet = new Set(applied.map(r => r.hash));

    const migrationsDir = path.join(__dirname, '../drizzle');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No drizzle directory, skipping migrations');
      return;
    }

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    if (!files.length) { console.log('No migration files'); return; }

    let applied_count = 0, skipped = 0;

    for (const file of files) {
      if (appliedSet.has(file)) { skipped++; continue; }

      console.log(`Applying ${file}...`);
      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      try {
        await sql.unsafe(migrationSql);
        await sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${file}, ${Date.now()}) ON CONFLICT (hash) DO NOTHING`;
        console.log(`Applied ${file}`);
        applied_count++;
      } catch (error) {
        if (SAFE_CODES.has(error.code)) {
          console.log(`${file}: objects already exist, marking applied`);
          await sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${file}, ${Date.now()}) ON CONFLICT (hash) DO NOTHING`;
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
    await sql`SELECT pg_advisory_unlock(987654321)`.catch(() => {});
    await sql.end();
  }
}

runMigrations();
