import bcrypt from 'bcryptjs';
import { sqlFor, type D1DatabaseLike } from '../_shared/db';
import { sendSmtpMail } from '../_lib/smtp';

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

async function ensureActivationSchema(env: Env) {
  await sqlFor(env)`CREATE TABLE IF NOT EXISTS account_activation_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sqlFor(env)`CREATE INDEX IF NOT EXISTS account_activation_tokens_user_idx ON account_activation_tokens(user_id)`;
}

export const onRequestPost = async ({ request, env }: Ctx) => {
  let createdUserId = '';
  try {
    const body: any = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();

    if (!email || password.length < 8) {
      return json({ error: 'Email and password (minimum 8 characters) are required' }, 400);
    }

    if (!env.SMTP_USER || !env.SMTP_PASSWORD) {
      return json({ error: 'Сервіс відправлення пошти ще не налаштований.' }, 503);
    }

    await ensureActivationSchema(env);
    const existing = await sqlFor(env)`SELECT id FROM users WHERE email=${email}`;
    if (existing[0]) return json({ error: 'This email is already registered' }, 409);

    createdUserId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    await sqlFor(env)`
      INSERT INTO users(id,email,password_hash,name,role,is_activated)
      VALUES(${createdUserId},${email},${passwordHash},${name},'user',0)
    `;

    const profile = {
      id: createdUserId,
      email,
      name,
      role: 'user',
      joinedAt: new Date().toISOString(),
    };
    await sqlFor(env)`
      INSERT INTO app_data(key,value)
      VALUES(${`profile:${createdUserId}`},${JSON.stringify(profile)})
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    `;

    const token = randomToken();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await sqlFor(env)`
      INSERT INTO account_activation_tokens(id,user_id,token_hash,expires_at)
      VALUES(${crypto.randomUUID()},${createdUserId},${tokenHash},${expiresAt})
    `;

    const activationUrl = new URL('/api/auth/activate', request.url);
    activationUrl.searchParams.set('token', token);

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:auto">
        <h2 style="margin-bottom:16px">Активація облікового запису SAR Ukraine</h2>
        <p>Вітаємо${name ? `, ${name}` : ''}!</p>
        <p>Для завершення реєстрації підтвердіть вашу email-адресу.</p>
        <p style="margin:28px 0">
          <a href="${activationUrl.toString()}" style="background:#007AFF;color:white;text-decoration:none;padding:12px 20px;border-radius:10px;display:inline-block">Підтвердити email</a>
        </p>
        <p>Посилання дійсне протягом 24 годин та може бути використане лише один раз.</p>
        <p style="color:#6B7280;font-size:14px">Якщо ви не реєструвалися на платформі, просто проігноруйте цей лист.</p>
      </div>`;

    await sendSmtpMail(
      {
        host: env.SMTP_HOST || 'smtp.ukr.net',
        port: Number(env.SMTP_PORT || 465),
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
      },
      {
        to: email,
        subject: 'Підтвердження email — SAR Ukraine',
        html,
        fromName: 'SAR Ukraine',
      },
    );

    return json({
      success: true,
      activationRequired: true,
      message: 'Реєстрація успішна. Перевірте пошту та підтвердіть email.',
    }, 201);
  } catch (error: any) {
    console.error('[signup] Failed:', error);
    if (createdUserId) {
      try { await sqlFor(env)`DELETE FROM account_activation_tokens WHERE user_id=${createdUserId}`; } catch {}
      try { await sqlFor(env)`DELETE FROM app_data WHERE key=${`profile:${createdUserId}`}`; } catch {}
      try { await sqlFor(env)`DELETE FROM users WHERE id=${createdUserId}`; } catch {}
    }
    return json({ error: 'Не вдалося завершити реєстрацію. Спробуйте ще раз.', details: error?.message || String(error) }, 500);
  }
};
