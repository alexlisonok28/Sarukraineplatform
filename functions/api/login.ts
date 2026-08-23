import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { sqlFor, type D1DatabaseLike } from '../_shared/db';

type Env = { DB: D1DatabaseLike; JWT_SECRET: string };
type Ctx = { request: Request; env: Env };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const secretFor = (env: Env) => {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(env.JWT_SECRET);
};

export const onRequestPost = async ({ request, env }: Ctx) => {
  try {
    const body: any = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const rows = await sqlFor(env)`SELECT id,email,name,role,password_hash,is_activated FROM users WHERE email=${email}`;
    const user: any = rows[0];

    if (!user || !(await bcrypt.compare(String(body.password || ''), user.password_hash))) {
      return json({ error: 'Invalid email or password' }, 401);
    }

    if (Number(user.is_activated || 0) !== 1) {
      return json({ error: 'Підтвердіть email, щоб увійти до системи.', code: 'EMAIL_NOT_ACTIVATED' }, 403);
    }

    const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
    const access_token = await new SignJWT({ email: user.email, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(secretFor(env));

    return json({
      success: true,
      user: { id: user.id, email: user.email },
      session: { access_token, expires_at: expires, user: { id: user.id, email: user.email } },
    });
  } catch (error: any) {
    console.error('[login] Failed:', error);
    return json({ error: 'Internal server error', details: error?.message || String(error) }, 500);
  }
};
