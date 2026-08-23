import { jwtVerify } from 'jose';
import { sqlFor, type D1DatabaseLike } from '../../../../_shared/db';

type Env = { DB: D1DatabaseLike; JWT_SECRET: string };
type Ctx = { request: Request; env: Env };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const secretFor = (env: Env) => {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(env.JWT_SECRET);
};

const getData = async (env: Env, key: string) => (await sqlFor(env)`SELECT value FROM app_data WHERE key=${key}`)[0]?.value;
const setData = async (env: Env, key: string, value: unknown) => {
  await sqlFor(env)`INSERT INTO app_data(key,value) VALUES(${key},${JSON.stringify(value)})
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`;
};

async function currentUser(env: Env, authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretFor(env));
    const rows = await sqlFor(env)`SELECT id,email,name,role FROM users WHERE id=${String(payload.sub)}`;
    return rows[0] || null;
  } catch {
    return null;
  }
}

const canManageCompetition = (user: any, competition: any) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.role === 'organizer' && competition?.status !== 'completed' && String(competition?.organizerId || '') === String(user.id);
};

const normalizeCompetitionResults = (results: any) => {
  if (!results || (results.search === undefined && results.obedience === undefined)) return results;
  const search = Number(results.search || 0);
  const obedience = Number(results.obedience || 0);
  const total = search + obedience;
  let qualification = 'Не класифіковано';
  if (search < 140 || obedience < 70 || total <= 209.5) qualification = 'Недостатньо';
  else if (total <= 239.5) qualification = 'Задовільно';
  else if (total <= 269.5) qualification = 'Добре';
  else if (total <= 285.5) qualification = 'Дуже добре';
  else if (total <= 300) qualification = 'Відмінно';
  return {
    ...results,
    total,
    qualification,
    place: qualification === 'Недостатньо' || qualification === 'Не класифіковано' ? undefined : results.place,
  };
};

export const onRequestPut = async ({ request, env }: Ctx) => {
  try {
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const match = new URL(request.url).pathname.match(/\/api\/competitions\/([^/]+)\/participants\/batch\/?$/);
    const competitionId = match?.[1];
    if (!competitionId) return json({ error: 'Competition id is required' }, 400);

    const body: any = await request.json();
    const updates: any[] = Array.isArray(body?.participants) ? body.participants : [];
    if (!updates.length) return json({ error: 'Participants are required' }, 400);

    // Read the competition collection ONCE. All participant changes are applied to this
    // single snapshot and persisted with ONE D1 write, eliminating the lost-update race
    // caused by many simultaneous PUT requests overwriting the same JSON document.
    const competitions: any[] = await getData(env, 'competitions') || [];
    const competition = competitions.find(item => String(item.id) === String(competitionId));
    if (!competition) return json({ error: 'Competition not found' }, 404);
    if (!canManageCompetition(user, competition)) return json({ error: 'Forbidden' }, 403);

    competition.participants = Array.isArray(competition.participants) ? competition.participants : [];
    const saved: any[] = [];

    for (const update of updates) {
      const index = competition.participants.findIndex((participant: any) =>
        update.participantId
          ? String(participant.id) === String(update.participantId)
          : String(participant.userId) === String(update.userId) &&
            String(participant.dogId) === String(update.dogId) &&
            String(participant.category || '') === String(update.category || ''));

      // Fail the WHOLE operation before writing anything if even one participant cannot
      // be matched. The UI therefore never receives a false full-success response.
      if (index < 0) {
        return json({ error: 'Participant not found', participantId: update.participantId || null }, 404);
      }

      const existing = competition.participants[index];
      const next = {
        ...existing,
        ...update,
        id: existing.id,
        userId: existing.userId,
        results: update.results ? normalizeCompetitionResults(update.results) : update.results,
      };
      competition.participants[index] = next;
      saved.push(next);
    }

    await setData(env, 'competitions', competitions);

    // Return the exact persisted participant payloads so the frontend can resolve every
    // queued save only after D1 has acknowledged the single write.
    return json({ success: true, savedCount: saved.length, participants: saved });
  } catch (error: any) {
    console.error('Batch competition results save failed:', error);
    return json({ error: 'Failed to save competition results', details: error?.message || String(error) }, 500);
  }
};
