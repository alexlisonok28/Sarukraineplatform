/*
 * API-КЛИЕНТ ФРОНТЕНДА
 * -------------------
 * Этот файл — единая точка, через которую React-компоненты обращаются к серверу.
 * Вместо того чтобы в каждой странице писать fetch(), используется apiRequest().
 *
 * Важно для понимания:
 * - endpoint — часть адреса API, например '/judges' или '/profile';
 * - method — HTTP-метод: GET, POST, PUT, DELETE;
 * - body — данные, которые отправляем серверу;
 * - token — JWT-токен авторизованного пользователя.
 *
 * Если endpoint приватный, функция сама попробует взять JWT из текущей сессии.
 */
import { auth } from './auth';

// Базовый адрес API. В production обычно используется '/api'.
// VITE_API_URL позволяет при необходимости подменить адрес через переменную окружения.
export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

// Эти GET-запросы доступны без входа в систему.
const PUBLIC_GET = ['/competitions', '/judges', '/teams', '/documents', '/rating'];

// Определяем, можно ли вызвать endpoint без JWT-токена.
const isPublicEndpoint = (endpoint: string, method: string) =>
  (method === 'GET' && (PUBLIC_GET.includes(endpoint.split('?')[0]) || /^\/competitions\/[^/]+\/results$/.test(endpoint))) ||
  (method === 'POST' && ['/signup', '/login'].includes(endpoint));

/**
 * Универсальный запрос к backend API.
 *
 * Пример:
 *   const judges = await apiRequest('/judges');
 *   await apiRequest('/judges', 'POST', { name: '...' });
 */
export async function apiRequest(endpoint: string, method = 'GET', body?: unknown, token?: string) {
  // Для приватного запроса автоматически подставляем JWT текущего пользователя.
  if (!token && !isPublicEndpoint(endpoint, method)) {
    token = (await auth.getSession()).data.session?.access_token;
  }

  const headers: Record<string, string> = {};

  /*
   * Content-Type: application/json ставим ТОЛЬКО если действительно отправляем JSON-тело.
   *
   * Раньше заголовок добавлялся даже для DELETE без body. На сервере наличие этого
   * заголовка означало «нужно вызвать request.json()». В результате пустой DELETE-запрос
   * пытались разобрать как JSON и он падал до выполнения самого удаления.
   */
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Bearer-токен сообщает серверу, от имени какого пользователя выполняется запрос.
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });

  // Если backend отверг JWT, локальную сессию больше нельзя считать валидной.
  // Удаляем её сразу, чтобы приложение не пыталось бесконечно «обновлять» тот же
  // самый невалидный токен и могло корректно вернуть пользователя на Login.
  if (response.status === 401 && endpoint !== '/login') {
    await auth.signOut({ scope: 'local' });
  }

  // Любой HTTP-ответ 4xx/5xx превращаем в обычную JS-ошибку.
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  // Все обычные API-ответы проекта возвращаются в JSON.
  return response.json();
}
