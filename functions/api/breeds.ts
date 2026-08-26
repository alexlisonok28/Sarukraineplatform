import { sqlFor, type D1DatabaseLike } from '../_shared/db';

type Env = { DB: D1DatabaseLike };
type Ctx = { request: Request; env: Env };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

async function ensureBreedsTable(env: Env) {
  const sql = sqlFor(env);
  await sql`CREATE TABLE IF NOT EXISTS breeds (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    fci_group_number INTEGER NOT NULL DEFAULT 0,
    breed_number INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE INDEX IF NOT EXISTS breeds_name_idx ON breeds(name)`;
}

export const onRequestGet = async ({ env }: Ctx) => {
  try {
    await ensureBreedsTable(env);
    const sql = sqlFor(env);
    const rows = await sql`
      SELECT id, name, fci_group_number AS fciGroupNumber, breed_number AS breedNumber
      FROM breeds
      ORDER BY CASE WHEN UPPER(TRIM(name)) = 'БЕЗПОРОДНИЙ' THEN 1 ELSE 0 END, name COLLATE NOCASE
    `;
    return json(rows);
  } catch (error: any) {
    console.error('Breeds API failed:', error);
    return json({ error: 'Failed to load breeds', details: error?.message || String(error) }, 500);
  }
};
