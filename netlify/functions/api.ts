import type { Handler } from '@netlify/functions';
import { neon } from '@netlify/neon';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

// Netlify injects NETLIFY_DATABASE_URL for Functions after `netlify db init`.
const db = () => neon();

let schemaReady: Promise<void> | undefined;
const ensureSchema = () => {
  if (!schemaReady) {
    const sql = db();
    schemaReady = (async () => {
      await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
      await sql`CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'organizer', 'judge', 'admin')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS app_data (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        content BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS files_owner_id_idx ON files(owner_id)`;
    })().catch(error => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
};
const secret = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(process.env.JWT_SECRET);
};
const json = (statusCode: number, body: unknown, headers = {}) => ({ statusCode, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const get = async (key: string) => (await db()`SELECT value FROM app_data WHERE key = ${key}`)[0]?.value;
const set = async (key: string, value: unknown) => { await db()`INSERT INTO app_data (key,value) VALUES (${key},${JSON.stringify(value)}::jsonb) ON CONFLICT (key) DO UPDATE SET value=excluded.value, updated_at=now()`; };

async function currentUser(header?: string) {
  const token = header?.replace(/^Bearer\s+/i, '');
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const rows = await db()`SELECT id,email,name,role FROM users WHERE id=${String(payload.sub)}`;
    return rows[0] || null;
  } catch { return null; }
}
const sessionFor = async (user: any) => {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const access_token = await new SignJWT({ email: user.email, role: user.role }).setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime(expires).sign(secret());
  return { access_token, expires_at: expires, user: { id: user.id, email: user.email } };
};
const requireRole = (user: any, roles: string[]) => user && roles.includes(user.role);

export const handler: Handler = async event => {
  try {
    const method = event.httpMethod;
    const path = ('/' + (event.path.split('/api/')[1] || event.path.split('/api')[1] || '')).replace(/\/$/, '') || '/';
    const body = event.body && event.headers['content-type']?.includes('application/json') ? JSON.parse(event.body) : {};
    const sql = db();
    await ensureSchema();
    const user = await currentUser(event.headers.authorization);

    if (method === 'OPTIONS') return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' }, body: '' };
    if (path === '/health') {
      const result = await sql`SELECT current_database() AS database, now() AS server_time`;
      return json(200, { status: 'ok', provider: 'netlify-db', database: result[0].database, serverTime: result[0].server_time });
    }
    if (path === '/signup' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || String(body.password || '').length < 8) return json(400, { error: 'Email and password (minimum 8 characters) are required' });
      const hash = await bcrypt.hash(body.password, 12);
      try {
        const rows = await sql`INSERT INTO users(email,password_hash,name) VALUES(${email},${hash},${String(body.name || '').trim()}) RETURNING id,email,name,role`;
        const u = rows[0];
        await set(`profile:${u.id}`, { id: u.id, email: u.email, name: u.name, role: u.role, joinedAt: new Date().toISOString() });
        return json(201, { success: true, user: { id: u.id, email: u.email }, session: await sessionFor(u) });
      } catch (e: any) { return json(e.code === '23505' ? 409 : 500, { error: e.code === '23505' ? 'This email is already registered' : 'Signup failed' }); }
    }
    if (path === '/login' && method === 'POST') {
      const rows = await sql`SELECT id,email,name,role,password_hash FROM users WHERE email=${String(body.email || '').trim().toLowerCase()}`;
      const u = rows[0];
      if (!u || !(await bcrypt.compare(String(body.password || ''), u.password_hash))) return json(401, { error: 'Invalid email or password' });
      return json(200, { success: true, user: { id: u.id, email: u.email }, session: await sessionFor(u) });
    }
    if (path === '/auth/password' && method === 'PUT') {
      if (!user) return json(401, { error: 'Unauthorized' });
      if (String(body.password || '').length < 8) return json(400, { error: 'Password must contain at least 8 characters' });
      await sql`UPDATE users SET password_hash=${await bcrypt.hash(body.password, 12)} WHERE id=${user.id}`;
      return json(200, { success: true });
    }
    if (path === '/profile' && method === 'GET') {
      if (!user) return json(401, { error: 'Unauthorized' });
      return json(200, (await get(`profile:${user.id}`)) || user);
    }
    if (path === '/profile' && method === 'POST') {
      if (!user) return json(401, { error: 'Unauthorized' });
      const profile = { ...(await get(`profile:${user.id}`) || user), ...body, id: user.id, email: user.email, role: user.role };
      await set(`profile:${user.id}`, profile); return json(200, profile);
    }
    if (path === '/profile/registrations' && method === 'GET') {
      if (!user) return json(401, { error: 'Unauthorized' });
      const comps: any[] = await get('competitions') || []; const dogs: any[] = await get(`dogs:${user.id}`) || [];
      return json(200, comps.flatMap(c => (c.participants || []).filter((p:any) => p.userId === user.id).map((p:any) => ({ competitionId:c.id,competitionName:c.name,startDate:c.startDate||c.date,endDate:c.endDate,location:c.location,dogName:dogs.find(d=>d.id===p.dogId)?.name||'Unknown',...p }))));
    }
    if (path === '/dogs' && method === 'GET') { if (!user) return json(401,{error:'Unauthorized'}); return json(200, await get(`dogs:${user.id}`) || []); }
    if (path === '/dogs' && method === 'POST') { if (!user) return json(401,{error:'Unauthorized'}); const list=await get(`dogs:${user.id}`)||[]; const item={...body,id:crypto.randomUUID(),userId:user.id}; list.push(item); await set(`dogs:${user.id}`,list); return json(201,item); }
    const dogMatch=path.match(/^\/dogs\/([^/]+)$/);
    if (dogMatch && ['PUT','DELETE'].includes(method)) { if(!user)return json(401,{error:'Unauthorized'}); const list:any[]=await get(`dogs:${user.id}`)||[]; const i=list.findIndex(x=>x.id===dogMatch[1]); if(i<0)return json(404,{error:'Dog not found'}); if(method==='DELETE')list.splice(i,1);else list[i]={...list[i],...body,id:list[i].id,userId:user.id}; await set(`dogs:${user.id}`,list); return json(200,method==='DELETE'?{success:true}:list[i]); }

    const collections: Record<string,string[]> = { competitions:['organizer','admin'], judges:['admin'], teams:['admin'], documents:['admin'] };
    for (const [name, roles] of Object.entries(collections)) {
      if (path === `/${name}` && method === 'GET') return json(200, await get(name) || []);
      if (path === `/${name}` && method === 'POST') { if(!requireRole(user,roles))return json(403,{error:'Forbidden'}); const list=await get(name)||[]; const item={...body,id:crypto.randomUUID(),createdAt:new Date().toISOString()}; list.push(item); await set(name,list); return json(201,item); }
      const match=path.match(new RegExp(`^/${name}/([^/]+)$`));
      if(match && ['PUT','DELETE'].includes(method)){if(!requireRole(user,roles))return json(403,{error:'Forbidden'});const list:any[]=await get(name)||[];const i=list.findIndex(x=>x.id===match[1]);if(i<0)return json(404,{error:'Not found'});if(method==='DELETE')list.splice(i,1);else list[i]={...list[i],...body,id:list[i].id};await set(name,list);return json(200,method==='DELETE'?{success:true}:list[i]);}
    }
    const compResults=path.match(/^\/competitions\/([^/]+)\/results$/);
    if(compResults && method==='GET'){const list:any[]=await get('competitions')||[];const c=list.find(x=>x.id===compResults[1]);return c?json(200,c.results||c.participants||[]):json(404,{error:'Competition not found'});}
    const register=path.match(/^\/competitions\/([^/]+)\/register$/);
    if(register && method==='POST'){if(!user)return json(401,{error:'Unauthorized'});const list:any[]=await get('competitions')||[];const c=list.find(x=>x.id===register[1]);if(!c)return json(404,{error:'Competition not found'});c.participants=c.participants||[];const p={...body,id:crypto.randomUUID(),userId:user.id,status:'pending',registeredAt:new Date().toISOString()};c.participants.push(p);await set('competitions',list);return json(201,p);}
    const details=path.match(/^\/competitions\/([^/]+)\/(details|participants)$/);
    if(details){const list:any[]=await get('competitions')||[];const c=list.find(x=>x.id===details[1]);if(!c)return json(404,{error:'Competition not found'});if(method==='GET')return json(200,c);if(method==='PUT'&&requireRole(user,['organizer','admin'])){c.participants=c.participants||[];const i=c.participants.findIndex((p:any)=>body.participantId?p.id===body.participantId:p.userId===body.userId&&p.dogId===body.dogId&&p.category===body.category);if(i<0)return json(404,{error:'Participant not found'});c.participants[i]={...c.participants[i],...body,id:c.participants[i].id,userId:c.participants[i].userId};await set('competitions',list);return json(200,c.participants[i]);}}
    if (path === '/files' && method === 'POST') {
      if (!user) return json(401, { error: 'Unauthorized' });
      if (!body.content || !body.name) return json(400, { error: 'File content and name are required' });
      const bytes = Buffer.from(body.content, 'base64');
      if (bytes.length > 4 * 1024 * 1024) return json(413, { error: 'Maximum file size is 4 MB' });
      const rows = await sql`INSERT INTO files(owner_id,name,content_type,content) VALUES(${user.id},${body.name},${body.contentType || 'application/octet-stream'},${bytes}) RETURNING id,name`;
      return json(201, { id: rows[0].id, path: rows[0].id, fileName: rows[0].name });
    }
    const fileMatch = path.match(/^\/files\/([^/]+)$/);
    if (fileMatch && method === 'GET') {
      if (!user) return json(401, { error: 'Unauthorized' });
      const rows = await sql`SELECT name,content_type,content FROM files WHERE id=${fileMatch[1]}`;
      if (!rows[0]) return json(404, { error: 'File not found' });
      return { statusCode: 200, headers: { 'Content-Type': rows[0].content_type, 'Content-Disposition': `inline; filename=\"${String(rows[0].name).replace(/[\r\n\"]/g, '')}\"` }, body: Buffer.from(rows[0].content).toString('base64'), isBase64Encoded: true };
    }
    const documentDownload = path.match(/^\/documents\/([^/]+)\/download$/);
    if (documentDownload && method === 'GET') {
      const documents:any[] = await get('documents') || [];
      const document = documents.find(item => item.id === documentDownload[1]);
      if (!document?.filePath) return json(404, { error: 'File not found' });
      return json(200, { url: `/api/files/${document.filePath}` });
    }
    if (path === '/rating' && method === 'GET') { const comps:any[]=await get('competitions')||[]; return json(200, comps.flatMap(c=>c.results||[])); }
    if (path === '/rating/debug' && method === 'GET') return json(200, { competitions: (await get('competitions')||[]).length });
    if (path === '/admin/users' && method === 'GET') { if(!requireRole(user,['admin']))return json(403,{error:'Forbidden'}); return json(200, await sql`SELECT id,email,name,role,created_at AS "createdAt" FROM users ORDER BY created_at DESC`); }
    const roleMatch=path.match(/^\/admin\/users\/([^/]+)\/role$/);
    if(roleMatch&&method==='PUT'){if(!requireRole(user,['admin']))return json(403,{error:'Forbidden'});await sql`UPDATE users SET role=${body.role} WHERE id=${roleMatch[1]}`;const profile=await get(`profile:${roleMatch[1]}`);if(profile)await set(`profile:${roleMatch[1]}`,{...profile,role:body.role});return json(200,{success:true});}
    return json(404, { error: 'Endpoint not found' });
  } catch (error) { console.error(error); return json(500, { error: 'Internal server error' }); }
};
