import { sqlFor, type D1DatabaseLike } from '../_shared/db';

type Env = { DB: D1DatabaseLike };
type Ctx = { request: Request; env: Env };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const QUALIFYING_LEVELS = new Set([
  'Відбіркові',
  'Відбіркові CACT',
  'Відбіркові CACIT',
]);

const normalizeDiscipline = (value: unknown) =>
  String(value || '').trim().toLowerCase();

async function getData(env: Env, key: string) {
  const rows = await sqlFor(env)`SELECT value FROM app_data WHERE key=${key}`;
  return rows[0]?.value;
}

type RawResult = {
  userId: string;
  dogId: string;
  athlete: string;
  dog: string;
  team: string;
  score: number;
};

/**
 * Rating is derived from the authoritative competition participant results.
 * We intentionally do not persist separate rating rows: reopening or saving a
 * competition cannot create duplicates, and the rating always reflects the
 * latest final results stored in the competition.
 */
export const onRequestGet = async ({ request, env }: Ctx) => {
  try {
    const url = new URL(request.url);
    const discipline = normalizeDiscipline(url.searchParams.get('discipline'));
    if (!discipline) return json({ error: 'discipline is required' }, 400);

    const competitions: any[] = (await getData(env, 'competitions')) || [];
    const eligible = competitions.filter(competition =>
      competition?.status === 'completed' &&
      QUALIFYING_LEVELS.has(String(competition?.level || '').trim())
    );

    const raw: RawResult[] = [];
    const profileCache = new Map<string, any>();
    const dogCache = new Map<string, any[]>();

    for (const competition of eligible) {
      const participants: any[] = Array.isArray(competition?.participants) ? competition.participants : [];

      for (const participant of participants) {
        if (participant?.status !== 'confirmed') continue;

        const participantDiscipline = normalizeDiscipline(participant?.class || participant?.category);
        if (participantDiscipline !== discipline) continue;

        const total = Number(participant?.results?.total);
        if (!Number.isFinite(total)) continue;

        const userId = String(participant?.userId || '');
        const dogId = String(participant?.dogId || '');
        if (!userId || !dogId) continue;

        if (!profileCache.has(userId)) {
          profileCache.set(userId, (await getData(env, `profile:${userId}`)) || {});
        }
        if (!dogCache.has(userId)) {
          dogCache.set(userId, (await getData(env, `dogs:${userId}`)) || []);
        }

        const profile = profileCache.get(userId) || {};
        const dog = (dogCache.get(userId) || []).find((item: any) => String(item?.id) === dogId) || {};

        raw.push({
          userId,
          dogId,
          athlete: participant?.userName || profile?.name || 'Невідомий учасник',
          dog: participant?.dogName || dog?.name || 'Невідома собака',
          team: participant?.teamName || participant?.team || profile?.teamName || profile?.team || '—',
          score: total,
        });
      }
    }

    // One rating entry represents one athlete + dog pair in one discipline.
    // Business rule: only the two best qualifying competition results count.
    const grouped = new Map<string, RawResult[]>();
    for (const result of raw) {
      const key = `${result.userId}:${result.dogId}`;
      const list = grouped.get(key) || [];
      list.push(result);
      grouped.set(key, list);
    }

    const rating = Array.from(grouped.values())
      .map(results => {
        const sorted = [...results].sort((a, b) => b.score - a.score);
        const best = sorted.slice(0, 2);
        return {
          athlete: sorted[0].athlete,
          dog: sorted[0].dog,
          team: sorted[0].team,
          score: best.reduce((sum, item) => sum + item.score, 0),
          competitions: best.length,
        };
      })
      .sort((a, b) => b.score - a.score || a.athlete.localeCompare(b.athlete, 'uk'))
      .map((entry, index) => ({ place: index + 1, ...entry }));

    return json(rating);
  } catch (error: any) {
    console.error('[rating] Failed:', error);
    return json({ error: 'Failed to build rating', details: error?.message || String(error) }, 500);
  }
};
