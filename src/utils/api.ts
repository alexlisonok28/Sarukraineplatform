import { auth } from './auth';

export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const PUBLIC_GET = ['/competitions', '/judges', '/teams', '/documents', '/rating'];

const isPublicEndpoint = (endpoint: string, method: string) =>
  (method === 'GET' && (PUBLIC_GET.includes(endpoint.split('?')[0]) || /^\/competitions\/[^/]+\/results$/.test(endpoint))) ||
  (method === 'POST' && ['/signup', '/login'].includes(endpoint));

export async function apiRequest(endpoint: string, method = 'GET', body?: unknown, token?: string) {
  if (!token && !isPublicEndpoint(endpoint, method)) {
    token = (await auth.getSession()).data.session?.access_token;
  }
  const headers: Record<string, string> = {};
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}
