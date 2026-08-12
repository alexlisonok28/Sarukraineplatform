/*
 * АВТОРИЗАЦИЯ НА СТОРОНЕ БРАУЗЕРА
 * --------------------------------
 * Этот модуль хранит JWT-сессию пользователя и предоставляет простой API,
 * похожий на auth-клиенты популярных backend-сервисов.
 *
 * React-компонентам не нужно знать, как именно сессия хранится в localStorage.
 * Они вызывают auth.getSession(), auth.signInWithPassword(), auth.signOut() и т.д.
 *
 * Важно: настоящая проверка прав выполняется на backend. Хранение сессии в браузере
 * нужно только для того, чтобы помнить, кто вошёл, и отправлять JWT серверу.
 */

// Минимальные данные пользователя, которые входят в сессию.
export type AuthUser = { id: string; email: string };

// Сессия содержит JWT, время его окончания и пользователя.
export type Session = { access_token: string; expires_at: number; user: AuthUser };

// Listener — функция, которую можно вызвать при входе/выходе пользователя.
type Listener = (event: string, session: Session | null) => void;

// Ключ, под которым сессия хранится в localStorage браузера.
const STORAGE_KEY = 'sar-session';

// Набор подписчиков. App.tsx подписывается на изменения авторизации.
const listeners = new Set<Listener>();

/**
 * Читает сессию из localStorage.
 * Если данные повреждены или токен уже просрочен — удаляет их и возвращает null.
 */
function readSession(): Session | null {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Session | null;
    if (!session || session.expires_at <= Math.floor(Date.now() / 1000)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Сохраняет или удаляет сессию и уведомляет все подписанные React-компоненты.
 */
function saveSession(session: Session | null, event: string) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);

  // Например, App.tsx после SIGNED_IN обновит интерфейс без перезагрузки страницы.
  listeners.forEach(listener => listener(event, session));
}

// Публичный объект auth используется во всём frontend-коде.
export const auth = {
  // Возвращает текущую локальную сессию.
  async getSession() {
    return { data: { session: readSession() }, error: null };
  },

  // Отправляет email/password на backend. Сервер проверяет пароль и возвращает JWT.
  async signInWithPassword(credentials: { email: string; password: string }) {
    try {
      const response = await fetch(
        `${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      // После успешного входа сохраняем сессию и сообщаем приложению о SIGNED_IN.
      saveSession(data.session, 'SIGNED_IN');
      return { data, error: null };
    } catch (error: any) {
      return { data: { user: null, session: null }, error };
    }
  },

  // Выход здесь означает удаление JWT из браузера.
  async signOut(_options?: unknown) {
    saveSession(null, 'SIGNED_OUT');
    return { error: null };
  },

  // Сейчас сервер не выдаёт refresh token, поэтому метод лишь проверяет,
  // существует ли ещё непросроченная локальная сессия.
  async refreshSession() {
    const session = readSession();
    return {
      data: { session },
      error: session ? null : new Error('Session expired. Please sign in again.'),
    };
  },

  // Позволяет App.tsx реагировать на вход и выход пользователя.
  onAuthStateChange(listener: Listener) {
    listeners.add(listener);
    return {
      data: {
        subscription: {
          // В React cleanup-функция вызывает unsubscribe(), чтобы не было утечек памяти.
          unsubscribe: () => listeners.delete(listener),
        },
      },
    };
  },

  // Смена пароля выполняется на сервере. JWT передаётся в Authorization.
  async updateUser(attributes: { password: string }) {
    try {
      const session = readSession();
      const response = await fetch(
        `${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}/auth/password`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify(attributes),
        }
      );

      if (!response.ok) {
        throw new Error((await response.json()).error || 'Password update failed');
      }

      return { data: { user: readSession()?.user ?? null }, error: null };
    } catch (error: any) {
      return { data: { user: null }, error };
    }
  },
};
