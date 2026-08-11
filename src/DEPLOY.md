# Деплой Neon + Netlify

## 1. Neon

Створіть безкоштовний Neon Postgres проєкт. У SQL Editor виконайте весь файл `database/schema.sql`. Скопіюйте pooled connection string.

## 2. Netlify

Імпортуйте Git-репозиторій. Конфігурація збірки вже міститься у кореневому `netlify.toml`.

У **Site configuration → Environment variables** додайте:

```text
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
JWT_SECRET=<результат openssl rand -base64 48>
```

Ці значення мають бути доступні Functions. Не використовуйте `VITE_` для секретів.

## 3. Перевірка

```bash
npm install
npm run build
npx netlify dev
curl http://localhost:8888/api/health
```

Після деплою перевірте `https://ВАШ-САЙТ.netlify.app/api/health`. Очікувана відповідь: `{"status":"ok","database":"neon"}`.

## Перший адміністратор

Спочатку зареєструйте користувача через сайт, потім виконайте в Neon SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```
