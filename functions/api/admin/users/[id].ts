import { jwtVerify } from 'jose';
import { sqlFor, type D1DatabaseLike } from '../../../_shared/db';

type Env = { DB: D1DatabaseLike; JWT_SECRET: string };
type Ctx = { request: Request; env: Env; params: { id: string } };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const secretFor = (env: Env) => {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(env.JWT_SECRET);
};

async function currentUser(env: Env, authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretFor(env));
    const rows = await sqlFor(env)`SELECT id,email,name,role FROM users WHERE id=${String(payload.sub)}`;
    return rows[0] || null;
  } catch { return null; }
}

export const onRequestDelete = async ({ request, env, params }: Ctx) => {
  try {
    const sql = sqlFor(env);
    const admin = await currentUser(env, request.headers.get('authorization'));
    if (!admin) return json({ error: 'Unauthorized' }, 401);
    if (admin.role !== 'admin') return json({ error: 'Forbidden' }, 403);

    const targetUserId = String(params.id || '').trim();
    if (!targetUserId) return json({ error: 'User id is required' }, 400);
    if (targetUserId === String(admin.id)) return json({ error: 'You cannot delete your own account' }, 400);

    const targetRows = await sql`SELECT id FROM users WHERE id=${targetUserId}`;
    if (!targetRows[0]) return json({ error: 'User not found' }, 404);

    await sql`DELETE FROM app_data WHERE key IN (${`profile:${targetUserId}`}, ${`dogs:${targetUserId}`})`;

    const competitionRows = await sql`SELECT value FROM app_data WHERE key='competitions'`;
    const competitions: any[] = Array.isArray(competitionRows[0]?.value) ? competitionRows[0].value : [];
    let competitionsChanged = false;
    const cleanedCompetitions = competitions.map((competition: any) => {
      let changed = false;
      const next = { ...competition };
      if (Array.isArray(competition.participants)) {
        const filtered = competition.participants.filter((p: any) => String(p?.userId || '') !== targetUserId);
        if (filtered.length !== competition.participants.length) { next.participants = filtered; changed = true; }
      }
      if (Array.isArray(competition.results)) {
        const filtered = competition.results.filter((p: any) => String(p?.userId || '') !== targetUserId);
        if (filtered.length !== competition.results.length) { next.results = filtered; changed = true; }
      }
      if (changed) competitionsChanged = true;
      return next;
    });

    if (competitionsChanged) {
      await sql`UPDATE app_data SET value=${JSON.stringify(cleanedCompetitions)}, updated_at=CURRENT_TIMESTAMP WHERE key='competitions'`;
    }

    await sql`DELETE FROM users WHERE id=${targetUserId}`;
    return json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    return json({ error: 'Internal server error', details: error?.message || String(error) }, 500);
  }
};
