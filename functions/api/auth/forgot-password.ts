import { sendSmtpMail } from '../../_lib/smtp';
import { sqlFor, type D1DatabaseLike } from '../../_shared/db';

type Env = {
  DB: D1DatabaseLike;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
};

type Ctx = { request: Request; env: Env };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost = async ({ request, env }: Ctx) => {
  try {
    const body: any = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return json({ error: 'Email is required' }, 400);

    const sql = sqlFor(env);
    await sql`PRAGMA foreign_keys = ON`;
    await sql`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
    await sql`CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens(user_id)`;

    const users = await sql`SELECT id, email, name FROM users WHERE email=${email}`;
    const user = users[0];
    if (!user) return json({ success: true, message: 'Якщо цей email зареєстрований, інструкції буде надіслано на пошту.' });

    if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
      console.error('[forgot-password] SMTP secrets are not configured');
      return json({ error: 'Сервіс відправлення пошти ще не налаштований.' }, 503);
    }

    await sql`UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=${user.id} AND used_at IS NULL`;
    const token = randomToken();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await sql`INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at)
      VALUES(${crypto.randomUUID()},${user.id},${tokenHash},${expiresAt.toISOString()})`;

    const resetUrl = new URL('/', request.url);
    resetUrl.searchParams.set('resetToken', token);
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:auto">
        <h2 style="margin-bottom:16px">Відновлення пароля SAR Ukraine</h2>
        <p>Ви отримали цей лист, тому що для вашого облікового запису було запитано відновлення пароля.</p>
        <p style="margin:28px 0"><a href="${resetUrl.toString()}" style="background:#007AFF;color:white;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block">Створити новий пароль</a></p>
        <p>Посилання дійсне протягом 1 години та може бути використане лише один раз.</p>
        <p style="color:#6B7280;font-size:14px">Якщо ви не запитували відновлення пароля, просто проігноруйте цей лист.</p>
      </div>`;

    try {
      await sendSmtpMail({ host: env.SMTP_HOST || 'smtp.ukr.net', port: Number(env.SMTP_PORT || 465), user: env.SMTP_USER, password: env.SMTP_PASSWORD },
        { to: user.email, subject: 'Відновлення пароля SAR Ukraine', html, fromName: 'SAR Ukraine' });
    } catch (error) {
      await sql`DELETE FROM password_reset_tokens WHERE token_hash=${tokenHash}`;
      console.error('[forgot-password] SMTP send failed:', error);
      return json({ error: 'Не вдалося відправити лист. Спробуйте ще раз пізніше.' }, 503);
    }

    return json({ success: true, message: 'Якщо цей email зареєстрований, інструкції буде надіслано на пошту.' });
  } catch (error: any) {
    console.error('[forgot-password] Unexpected error:', error);
    return json({ error: 'Помилка відновлення пароля', details: error?.message || String(error) }, 500);
  }
};
