import bcrypt from 'bcryptjs';
import { sqlFor, type D1DatabaseLike } from '../../_shared/db';

type Env = { DB: D1DatabaseLike };
type Ctx = { request: Request; env: Env };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost = async ({ request, env }: Ctx) => {
  try {
    const body: any = await request.json();
    const token = String(body.token || '').trim();
    const password = String(body.password || '');
    if (!token) return json({ error: 'Reset token is required' }, 400);
    if (password.length < 8) return json({ error: 'Пароль має містити щонайменше 8 символів' }, 400);

    const sql = sqlFor(env);
    const tokenHash = await sha256(token);
    const rows = await sql`
      SELECT prt.id, prt.user_id
      FROM password_reset_tokens prt
      WHERE prt.token_hash=${tokenHash}
        AND prt.used_at IS NULL
        AND prt.expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `;

    const reset = rows[0];
    if (!reset) return json({ error: 'Посилання недійсне або термін його дії закінчився' }, 400);

    const passwordHash = await bcrypt.hash(password, 12);
    await sql`UPDATE users SET password_hash=${passwordHash} WHERE id=${reset.user_id}`;
    await sql`UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=${reset.user_id} AND used_at IS NULL`;
    return json({ success: true });
  } catch (error: any) {
    console.error('[reset-password] Unexpected error:', error);
    return json({ error: 'Помилка зміни пароля', details: error?.message || String(error) }, 500);
  }
};
