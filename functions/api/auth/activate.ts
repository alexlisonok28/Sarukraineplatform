import { sqlFor, type D1DatabaseLike } from '../../_shared/db';

type Env = { DB: D1DatabaseLike };
type Ctx = { request: Request; env: Env };

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function page(title: string, message: string, ok: boolean, request: Request) {
  const loginUrl = new URL('/', request.url);
  const body = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#F5F5F7;font-family:Arial,sans-serif;color:#111827"><div style="max-width:520px;margin:80px auto;padding:0 20px"><div style="background:white;border-radius:20px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center"><div style="font-size:48px;margin-bottom:16px">${ok ? '✓' : '!'}</div><h1 style="font-size:28px;margin:0 0 12px">${title}</h1><p style="color:#6B7280;line-height:1.6;margin-bottom:28px">${message}</p><a href="${loginUrl.toString()}" style="display:inline-block;background:#007AFF;color:white;text-decoration:none;padding:12px 22px;border-radius:10px">Увійти до системи</a></div></div></body></html>`;
  return new Response(body, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export const onRequestGet = async ({ request, env }: Ctx) => {
  try {
    const url = new URL(request.url);
    const token = String(url.searchParams.get('token') || '').trim();
    if (!token) return page('Посилання недійсне', 'Не знайдено токен активації.', false, request);

    const tokenHash = await sha256(token);
    const rows = await sqlFor(env)`
      SELECT id,user_id,expires_at
      FROM account_activation_tokens
      WHERE token_hash=${tokenHash}
        AND used_at IS NULL
        AND datetime(expires_at) > CURRENT_TIMESTAMP
      LIMIT 1
    `;
    const activation: any = rows[0];
    if (!activation) {
      return page('Посилання недійсне', 'Посилання вже використано або термін його дії закінчився.', false, request);
    }

    await sqlFor(env)`UPDATE users SET is_activated=1 WHERE id=${activation.user_id}`;
    await sqlFor(env)`UPDATE account_activation_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=${activation.user_id} AND used_at IS NULL`;

    return page('Email підтверджено', 'Ваш обліковий запис успішно активовано. Тепер ви можете увійти.', true, request);
  } catch (error: any) {
    console.error('[activate] Failed:', error);
    return page('Помилка активації', 'Не вдалося активувати обліковий запис. Спробуйте ще раз пізніше.', false, request);
  }
};
