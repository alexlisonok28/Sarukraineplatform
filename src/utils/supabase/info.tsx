/* 
 * Supabase Configuration
 * Використовує змінні оточення для production або fallback значення для development
 */

// Для Vite використовуємо import.meta.env
// Перевіряємо чи існує import.meta.env перед доступом до властивостей
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const fallbackProjectId = "qoqsflrkyxuazgqihnrn";
const rawProjectId = typeof env.VITE_SUPABASE_PROJECT_ID === 'string' ? env.VITE_SUPABASE_PROJECT_ID.trim() : '';
const rawUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';

const buildSupabaseUrl = (projectId: string) => `https://${projectId}.supabase.co`;

const resolveProjectId = () => {
  if (rawProjectId) return rawProjectId;
  if (rawUrl && !rawUrl.includes('.')) return rawUrl;
  return fallbackProjectId;
};

const normalizeSupabaseUrl = () => {
  if (rawUrl) {
    const candidate = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : rawUrl.includes('.')
        ? `https://${rawUrl}`
        : buildSupabaseUrl(rawUrl);

    try {
      const parsed = new URL(candidate);
      return parsed.origin;
    } catch (error) {
      console.warn('[Supabase] Invalid VITE_SUPABASE_URL, falling back to project ID.', error);
    }
  }

  return buildSupabaseUrl(resolveProjectId());
};

export const projectId = resolveProjectId();

export const publicAnonKey = env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvcXNmbHJreXh1YXpncWlobnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDM4NDksImV4cCI6MjA3NTIxOTg0OX0.9APkITeLiwkzW1w8ruCcvByExB40Mcstb8mj6KsIPK0";

export const supabaseUrl = normalizeSupabaseUrl();
