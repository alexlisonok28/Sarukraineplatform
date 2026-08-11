# Деплой із Git на Netlify

Проєкт і надалі деплоїться безпосередньо з Git. Після кожного push Netlify автоматично збере frontend і Netlify Function; змінювати цей процес не потрібно.

## Одноразово підключіть Netlify DB до вже існуючого сайту

Команда нижче **не деплоїть сайт вручну** і не замінює Git deployment. Вона лише знаходить ваш уже створений Netlify-сайт і додає до нього керовану Postgres-базу:

```bash
# у локальному clone Git-репозиторію
npx netlify login
npx netlify link       # виберіть існуючий сайт, який уже деплоїться з Git
npx netlify db init
```

Після `db init` Netlify автоматично створить для Functions змінну `NETLIFY_DATABASE_URL`. Connection string не потрібно додавати в Git, `.env` або `VITE_*` змінні.

Якщо у вашому Netlify Dashboard доступна кнопка створення Netlify DB, можна скористатися нею замість команд вище: важливо підключити базу саме до існуючого Git-сайту.

## Таблиці створюються автоматично

Після наступного Git deploy відкрийте сайт або `/api/health`. Netlify Function автоматично й безпечно виконає `CREATE ... IF NOT EXISTS` для всіх таблиць та індексів. Окремо копіювати SQL у консоль більше не потрібно. Файл `database/schema.sql` залишено як документацію та для ручного відновлення.

## Додайте секрет авторизації

У Netlify Dashboard відкрийте **Site configuration → Environment variables** і додайте:

```text
JWT_SECRET=<довгий випадковий секрет>
```

Згенерувати його можна локально:

```bash
openssl rand -base64 48
```

Секрет повинен бути доступним для Functions. После добавления запустіть **Trigger deploy** або зробіть новий push у Git.

## Перевірка після Git deploy

```bash
curl https://ВАШ-САЙТ.netlify.app/api/health
```

Endpoint виконує реальний SQL-запит. У відповіді мають бути `status: "ok"`, `provider: "netlify-db"`, ім'я бази та серверний час.

## Перший адміністратор

Спочатку зареєструйте користувача через сайт, потім виконайте в SQL-консолі Netlify DB:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```
