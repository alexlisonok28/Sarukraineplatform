/*
 * API-КЛИЕНТ ФРОНТЕНДА
 * -------------------
 * Единая точка, через которую React-компоненты обращаются к backend.
 */
import { auth } from './auth';
import { localizeApiError } from './errors';

export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const PUBLIC_GET = ['/competitions', '/judges', '/teams', '/documents', '/rating', '/breeds'];
const isPublicEndpoint = (endpoint: string, method: string) =>
  (method === 'GET' && (PUBLIC_GET.includes(endpoint.split('?')[0]) || /^\/competitions\/[^/]+\/results$/.test(endpoint))) ||
  (method === 'POST' && ['/signup', '/login'].includes(endpoint));

type QueuedParticipantSave = { body: any; token?: string; resolve: (value: any) => void; reject: (reason: any) => void; };
const participantSaveQueues = new Map<string, QueuedParticipantSave[]>();
const participantFlushTimers = new Map<string, number>();

async function rawApiRequest(endpoint: string, method = 'GET', body?: unknown, token?: string) {
  if (!token && !isPublicEndpoint(endpoint, method)) token = (await auth.getSession()).data.session?.access_token;
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${endpoint}`, { method, headers, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) });
  const payload = response.ok ? null : await response.json().catch(() => ({}));
  if (response.status === 401 && endpoint !== '/login') {
    window.dispatchEvent(new CustomEvent('sar:auth-required', { detail: { reason: 'expired' } }));
    await auth.signOut({ scope: 'local' });
  }
  if (!response.ok) throw new Error(localizeApiError(payload?.error || `Request failed with status ${response.status}`, response.status));
  return response.json();
}

function queueParticipantSave(competitionId: string, body: any, token?: string) {
  return new Promise((resolve, reject) => {
    const queue = participantSaveQueues.get(competitionId) || [];
    queue.push({ body, token, resolve, reject });
    participantSaveQueues.set(competitionId, queue);
    if (participantFlushTimers.has(competitionId)) return;
    const timer = window.setTimeout(async () => {
      participantFlushTimers.delete(competitionId);
      const batch = participantSaveQueues.get(competitionId) || [];
      participantSaveQueues.delete(competitionId);
      if (!batch.length) return;
      try {
        const response = await rawApiRequest(`/competitions/${encodeURIComponent(competitionId)}/participants/batch`, 'PUT', { participants: batch.map(item => item.body) }, batch.find(item => item.token)?.token);
        if (!response?.success || Number(response.savedCount) !== batch.length) throw new Error(localizeApiError('Backend did not confirm all participant changes'));
        const saved = Array.isArray(response.participants) ? response.participants : [];
        batch.forEach((item, index) => item.resolve(saved[index] ?? { success: true }));
      } catch (error) { batch.forEach(item => item.reject(error)); }
    }, 0);
    participantFlushTimers.set(competitionId, timer);
  });
}

export async function apiRequest(endpoint: string, method = 'GET', body?: unknown, token?: string) {
  const participantMatch = endpoint.match(/^\/competitions\/([^/]+)\/participants$/);
  if (method === 'PUT' && participantMatch && body && !(body instanceof FormData)) return queueParticipantSave(decodeURIComponent(participantMatch[1]), body, token);
  return rawApiRequest(endpoint, method, body, token);
}
