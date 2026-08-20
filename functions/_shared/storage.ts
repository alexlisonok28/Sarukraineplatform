import { neon } from '@neondatabase/serverless';
import { jwtVerify } from 'jose';

export type R2ObjectBodyLike = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

export type R2BucketLike = {
  put: (key: string, value: ArrayBuffer | ArrayBufferView, options?: any) => Promise<any>;
  get: (key: string) => Promise<R2ObjectBodyLike | null>;
  delete: (key: string) => Promise<void>;
};

export type StorageEnv = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  DOCUMENTS_BUCKET: R2BucketLike;
};

export const sqlFor = (env: StorageEnv) => {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(env.DATABASE_URL);
};

const secretFor = (env: StorageEnv) => {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(env.JWT_SECRET);
};

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export async function currentUser(env: StorageEnv, authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretFor(env));
    const rows = await sqlFor(env)`SELECT id,email,name,role FROM users WHERE id=${String(payload.sub)}`;
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function ensureStorageSchema(env: StorageEnv) {
  if (!env.DOCUMENTS_BUCKET) throw new Error('DOCUMENTS_BUCKET R2 binding is not configured');
  const sql = sqlFor(env);

  await sql`CREATE TABLE IF NOT EXISTS stored_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    file_size INTEGER NOT NULL,
    scope TEXT NOT NULL DEFAULT 'generic',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE INDEX IF NOT EXISTS stored_files_owner_id_idx ON stored_files(owner_id)`;

  await sql`CREATE TABLE IF NOT EXISTS dog_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dog_id TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('pedigree','attestation')),
    category TEXT,
    file_id UUID NOT NULL REFERENCES stored_files(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE INDEX IF NOT EXISTS dog_documents_dog_id_idx ON dog_documents(dog_id)`;
  await sql`CREATE INDEX IF NOT EXISTS dog_documents_owner_id_idx ON dog_documents(owner_id)`;
}

export function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function safeExtension(fileName: string) {
  const match = String(fileName || '').toLowerCase().match(/(\.[a-z0-9]{1,10})$/);
  return match ? match[1] : '';
}

export function safeDownloadName(fileName: string) {
  return String(fileName || 'document').replace(/[\r\n"\\]/g, '_');
}

export async function userOwnsDog(env: StorageEnv, userId: string, dogId: string) {
  const rows = await sqlFor(env)`SELECT value FROM app_data WHERE key=${`dogs:${userId}`}`;
  const dogs: any[] = rows[0]?.value || [];
  return dogs.some(dog => String(dog?.id) === String(dogId));
}

export const DOG_DOCUMENT_CATEGORIES = [
  'RH-FL-V', 'RH-FL-A', 'RH-FL-B',
  'RH-T-V', 'RH-T-A', 'RH-T-B',
  'RH-F-V', 'RH-F-A', 'RH-F-B',
] as const;
