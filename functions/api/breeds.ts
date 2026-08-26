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

  // Reference data intentionally contains only ID + displayed breed name.
  // Older deployments may physically retain now-unused FCI columns; they are ignored.
  await sql`CREATE TABLE IF NOT EXISTS breeds (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
  )`;
  await sql`CREATE INDEX IF NOT EXISTS breeds_name_idx ON breeds(name)`;

  const names = await getBreedNames();
  if (!names.length) throw new Error('Breed seed is empty');

  const countRows = await sql`SELECT COUNT(*) AS count FROM breeds`;
  const existingCount = Number(countRows[0]?.count || 0);
  if (existingCount >= names.length) return;

  // Keep every statement comfortably below D1/SQLite bind-variable limits.
  // INSERT OR IGNORE also makes interrupted first-time seeding safely resumable.
  const chunkSize = 40;
  for (let offset = 0; offset < names.length; offset += chunkSize) {
    const chunk = names.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => '(?, ?)').join(', ');
    const values: Array<number | string> = [];
    chunk.forEach((name, index) => values.push(offset + index + 1, name));

    await env.DB
      .prepare(`INSERT OR IGNORE INTO breeds (id, name) VALUES ${placeholders}`)
      .bind(...values)
      .all();
  }
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
