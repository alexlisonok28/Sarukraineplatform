import type { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler: Handler = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      return json(500, { status: 'error', error: 'DATABASE_URL is not configured' });
    }

    const sql = neon(process.env.DATABASE_URL);

    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'organizer', 'judge', 'admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS app_data (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      content BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS files_owner_id_idx ON files(owner_id)`;

    const info = await sql`SELECT current_database() AS database, current_user AS "user", now() AS server_time`;
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','app_data','files') ORDER BY table_name`;

    return json(200, {
      status: 'ok',
      provider: 'neon',
      ...info[0],
      tables: tables.map((row: any) => row.table_name),
    });
  } catch (error: any) {
    console.error(error);
    return json(500, { status: 'error', error: error?.message || 'Database initialization failed' });
  }
};
