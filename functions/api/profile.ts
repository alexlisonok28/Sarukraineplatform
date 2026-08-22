import { jwtVerify } from 'jose';
import { sqlFor, type D1DatabaseLike } from '../_shared/db';

type Env = {
  DB: D1DatabaseLike;
  JWT_SECRET: string;
};

type Ctx = { request: Request; env: Env };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const secretFor = (env: Env) => {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters');
  }
  return new TextEncoder().encode(env.JWT_SECRET);
};

async function currentUser(env: Env, authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretFor(env));
    const rows = await sqlFor(env)`
      SELECT id,email,name,role
      FROM users
      WHERE id=${String(payload.sub)}
    `;
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function storedProfile(env: Env, userId: string) {
  const rows = await sqlFor(env)`SELECT value FROM app_data WHERE key=${`profile:${userId}`}`;
  return rows[0]?.value || null;
}

/**
 * The profile JSON contains editable presentation data, but identity and access
 * fields must always come from the authoritative users row in D1. This prevents
 * an old profile JSON (for example role="user") from hiding a later role change
 * made in users (for example role="admin").
 */
export const onRequestGet = async ({ request, env }: Ctx) => {
  try {
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const profile = (await storedProfile(env, String(user.id))) || {};
    return json({
      ...profile,
      id: user.id,
      email: user.email,
      name: profile.name ?? user.name ?? '',
      role: user.role,
    });
  } catch (error: any) {
    console.error('[profile:get] Failed:', error);
    return json({ error: 'Internal server error', details: error?.message || String(error) }, 500);
  }
};

export const onRequestPost = async ({ request, env }: Ctx) => {
  try {
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body: any = await request.json();
    const existing = (await storedProfile(env, String(user.id))) || {};
    const profile = {
      ...existing,
      ...body,
      id: user.id,
      email: user.email,
      role: user.role,
    };

    await sqlFor(env)`
      INSERT INTO app_data(key,value)
      VALUES(${`profile:${user.id}`},${JSON.stringify(profile)})
      ON CONFLICT(key) DO UPDATE SET
        value=excluded.value,
        updated_at=CURRENT_TIMESTAMP
    `;

    return json(profile);
  } catch (error: any) {
    console.error('[profile:post] Failed:', error);
    return json({ error: 'Internal server error', details: error?.message || String(error) }, 500);
  }
};
