# SAR Ukraine Platform

Frontend на React/Vite та Netlify Function API. Дані, користувачі й JWT-авторизація працюють через **Neon Postgres** — Supabase більше не потрібен.

## Локальний запуск

```bash
npm install
cp .env.example .env
npm run dev
```

Для локальної перевірки API використовуйте `netlify dev`, а не лише `npm run dev`.

## База даних

1. Створіть безкоштовний проєкт у Neon.
2. Відкрийте Neon SQL Editor і виконайте [`database/schema.sql`](database/schema.sql).
3. Згенеруйте секрет командою `openssl rand -base64 48`.
4. У Netlify → **Site configuration → Environment variables** задайте:
   - `DATABASE_URL` — Neon connection string (з `sslmode=require`);
   - `JWT_SECRET` — згенерований секрет, щонайменше 32 випадкових байти.
5. Розгорніть сайт. API доступний за `/api/*`.

Паролі зберігаються лише як bcrypt-хеші. `DATABASE_URL` і `JWT_SECRET` є серверними змінними — не додавайте до них префікс `VITE_`.

## Команди

- `npm run dev` — Vite frontend;
- `netlify dev` — frontend разом із Netlify Functions;
- `npm run build` — production build.
