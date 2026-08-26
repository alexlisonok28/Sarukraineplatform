import { sqlFor, type D1DatabaseLike } from '../_shared/db';
import { getBreedNames } from '../_data/breeds';

type Env = { DB: D1DatabaseLike };
type Ctx = { request: Request; env: Env };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

async function ensureBreeds(env: Env) {
  const sql = sqlFor(env);

  // Keep the reference table intentionally small: only stable ID + displayed name.
  // If an older deployment already created extra FCI columns, SQLite keeps them;
  // this API deliberately ignores them and uses only id/name.
  await sql`CREATE TABLE IF NOT EXISTS breeds (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  )`;
  await sql`CREATE INDEX IF NOT EXISTS breeds_name_idx ON breeds(name)`;

  const countRows = await sql`SELECT COUNT(*) AS count FROM breeds`;
  const existingCount = Number(countRows[0]?.count || 0);
  if (existingCount > 0) return;

  const names = await getBreedNames();
  if (!names.length) throw new Error('Breed seed is empty');

  // One D1 statement seeds the whole dictionary, avoiding hundreds of round trips.
  // IDs follow the already-normalized Ukrainian alphabetical order. The final item
  // is intentionally БЕЗПОРОДНИЙ.
  const placeholders = names.map(() => '(?, ?)').join(', ');
  const values: Array<number | string> = [];
  names.forEach((name, index) => values.push(index + 1, name));

  await env.DB
    .prepare(`INSERT INTO breeds (id, name) VALUES ${placeholders}`)
    .bind(...values)
    .all();
}

export const onRequestGet = async ({ env }: Ctx) => {
  try {
    await ensureBreeds(env);
    const sql = sqlFor(env);
    const rows = await sql`SELECT id, name FROM breeds ORDER BY id`;
    return json(rows);
  } catch (error: any) {
    console.error('Breeds API failed:', error);
    return json({ error: 'Failed to load breeds', details: error?.message || String(error) }, 500);
  }
};
