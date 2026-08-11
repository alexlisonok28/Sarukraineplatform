# SAR Ukraine Platform

Frontend на React/Vite та Netlify Function API. Дані, користувачі й JWT-авторизація працюють через **Netlify DB (Postgres)** — Supabase більше не потрібен.

## Локальний запуск

```bash
npm install
cp .env.example .env
npm run dev
```

Для локальної перевірки API використовуйте `netlify dev`, а не лише `npm run dev`.

## База даних та Git deploy

Сайт продовжує автоматично деплоїтися з Git. Для вже існуючого Netlify-сайту потрібно лише один раз підключити Netlify DB:

```bash
npx netlify login
npx netlify link       # виберіть існуючий Git-сайт
npx netlify db init
```

Netlify автоматично додасть `NETLIFY_DATABASE_URL`. Таблиці створить сама Function під час першого запиту після deploy; вручну запускати SQL не потрібно. У Dashboard вручну додайте лише `JWT_SECRET`, згенерований командою `openssl rand -base64 48`. Деталі наведені у [`src/DEPLOY.md`](src/DEPLOY.md).

## Команди

- `npm run dev` — Vite frontend;
- `netlify dev` — frontend разом із Netlify Functions;
- `npm run build` — production build.
