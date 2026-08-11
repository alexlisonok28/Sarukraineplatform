import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

type Env = { DATABASE_URL: string; JWT_SECRET: string };
type Ctx = { request: Request; env: Env };

const sqlFor = (env: Env) => {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(env.DATABASE_URL);
};
const secretFor = (env: Env) => {
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return new TextEncoder().encode(env.JWT_SECRET);
};
const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

let schemaReady: Promise<void> | undefined;
const ensureSchema = (env: Env) => {
  if (!schemaReady) {
    const sql = sqlFor(env);
    schemaReady = (async () => {
      await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
      await sql`CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','organizer','judge','admin')),
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
    })().catch(error => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
};

const getData = async (env: Env, key: string) => (await sqlFor(env)`SELECT value FROM app_data WHERE key=${key}`)[0]?.value;
const setData = async (env: Env, key: string, value: unknown) => {
  await sqlFor(env)`INSERT INTO app_data(key,value) VALUES(${key},${JSON.stringify(value)}::jsonb)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=now()`;
};

async function currentUser(env: Env, authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretFor(env));
    const rows = await sqlFor(env)`SELECT id,email,name,role FROM users WHERE id=${String(payload.sub)}`;
    return rows[0] || null;
  } catch { return null; }
}

async function sessionFor(env: Env, user: any) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const access_token = await new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime(expires).sign(secretFor(env));
  return { access_token, expires_at: expires, user: { id: user.id, email: user.email } };
}

const requireRole = (user: any, roles: string[]) => user && roles.includes(user.role);

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const onRequest = async ({ request, env }: Ctx) => {
  try {
    await ensureSchema(env);
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
    const contentType = request.headers.get('content-type') || '';
    const body: any = method !== 'GET' && contentType.includes('application/json') ? await request.json() : {};
    const user = await currentUser(env, request.headers.get('authorization'));
    const sql = sqlFor(env);

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }});

    if (path === '/health') {
      const rows = await sql`SELECT current_database() AS database, now() AS server_time`;
      return json({ status: 'ok', provider: 'neon-cloudflare', ...rows[0] });
    }

    if (path === '/init/db') {
      const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('users','app_data','files') ORDER BY tablename`;
      return json({ status: 'ok', provider: 'neon-cloudflare', tables: tables.map((x:any) => x.tablename) });
    }

    if (path === '/signup' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || String(body.password || '').length < 8) return json({ error: 'Email and password (minimum 8 characters) are required' }, 400);
      const hash = await bcrypt.hash(String(body.password), 12);
      try {
        const rows = await sql`INSERT INTO users(email,password_hash,name) VALUES(${email},${hash},${String(body.name || '').trim()}) RETURNING id,email,name,role`;
        const u = rows[0];
        await setData(env, `profile:${u.id}`, { id:u.id, email:u.email, name:u.name, role:u.role, joinedAt:new Date().toISOString() });
        return json({ success:true, user:{ id:u.id, email:u.email }, session:await sessionFor(env,u) }, 201);
      } catch (e:any) {
        return json({ error: e.code === '23505' ? 'This email is already registered' : 'Signup failed' }, e.code === '23505' ? 409 : 500);
      }
    }

    if (path === '/login' && method === 'POST') {
      const rows = await sql`SELECT id,email,name,role,password_hash FROM users WHERE email=${String(body.email || '').trim().toLowerCase()}`;
      const u = rows[0];
      if (!u || !(await bcrypt.compare(String(body.password || ''), u.password_hash))) return json({ error:'Invalid email or password' }, 401);
      return json({ success:true, user:{ id:u.id, email:u.email }, session:await sessionFor(env,u) });
    }

    if (path === '/auth/password' && method === 'PUT') {
      if (!user) return json({ error:'Unauthorized' }, 401);
      if (String(body.password || '').length < 8) return json({ error:'Password must contain at least 8 characters' }, 400);
      await sql`UPDATE users SET password_hash=${await bcrypt.hash(String(body.password),12)} WHERE id=${user.id}`;
      return json({ success:true });
    }

    if (path === '/profile' && method === 'GET') {
      if (!user) return json({ error:'Unauthorized' }, 401);
      return json((await getData(env, `profile:${user.id}`)) || user);
    }
    if (path === '/profile' && method === 'POST') {
      if (!user) return json({ error:'Unauthorized' }, 401);
      const profile = { ...((await getData(env, `profile:${user.id}`)) || user), ...body, id:user.id, email:user.email, role:user.role };
      await setData(env, `profile:${user.id}`, profile);
      return json(profile);
    }
    if (path === '/profile/registrations' && method === 'GET') {
      if (!user) return json({ error:'Unauthorized' }, 401);
      const comps:any[] = await getData(env,'competitions') || [];
      const dogs:any[] = await getData(env,`dogs:${user.id}`) || [];
      return json(comps.flatMap(c => (c.participants || []).filter((p:any) => p.userId === user.id).map((p:any) => ({
        competitionId:c.id, competitionName:c.name, startDate:c.startDate||c.date, endDate:c.endDate,
        location:c.location, dogName:dogs.find(d=>d.id===p.dogId)?.name||'Unknown', ...p
      }))));
    }

    if (path === '/dogs' && method === 'GET') {
      if (!user) return json({error:'Unauthorized'},401);
      return json(await getData(env,`dogs:${user.id}`) || []);
    }
    if (path === '/dogs' && method === 'POST') {
      if (!user) return json({error:'Unauthorized'},401);
      const list:any[] = await getData(env,`dogs:${user.id}`) || [];
      const item = { ...body, id:crypto.randomUUID(), userId:user.id };
      list.push(item); await setData(env,`dogs:${user.id}`,list); return json(item,201);
    }
    const dogMatch = path.match(/^\/dogs\/([^/]+)$/);
    if (dogMatch && ['PUT','DELETE'].includes(method)) {
      if (!user) return json({error:'Unauthorized'},401);
      const list:any[] = await getData(env,`dogs:${user.id}`) || [];
      const i = list.findIndex(x=>x.id===dogMatch[1]);
      if (i<0) return json({error:'Dog not found'},404);
      if (method==='DELETE') list.splice(i,1); else list[i]={...list[i],...body,id:list[i].id,userId:user.id};
      await setData(env,`dogs:${user.id}`,list); return json(method==='DELETE'?{success:true}:list[i]);
    }

    const collections: Record<string,string[]> = { competitions:['organizer','admin'], judges:['admin'], teams:['admin'], documents:['admin'] };
    for (const [name, roles] of Object.entries(collections)) {
      if (path === `/${name}` && method === 'GET') return json(await getData(env,name) || []);
      if (path === `/${name}` && method === 'POST') {
        if (!requireRole(user,roles)) return json({error:'Forbidden'},403);
        const list:any[] = await getData(env,name) || [];
        const item={...body,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
        list.push(item); await setData(env,name,list); return json(item,201);
      }
      const match=path.match(new RegExp(`^/${name}/([^/]+)$`));
      if (match && ['PUT','DELETE'].includes(method)) {
        if (!requireRole(user,roles)) return json({error:'Forbidden'},403);
        const list:any[] = await getData(env,name) || [];
        const i=list.findIndex(x=>x.id===match[1]);
        if(i<0) return json({error:'Not found'},404);
        if(method==='DELETE') list.splice(i,1); else list[i]={...list[i],...body,id:list[i].id};
        await setData(env,name,list); return json(method==='DELETE'?{success:true}:list[i]);
      }
    }

    const compResults=path.match(/^\/competitions\/([^/]+)\/results$/);
    if(compResults && method==='GET') {
      const list:any[]=await getData(env,'competitions')||[]; const c=list.find(x=>x.id===compResults[1]);
      return c?json(c.results||c.participants||[]):json({error:'Competition not found'},404);
    }
    const register=path.match(/^\/competitions\/([^/]+)\/register$/);
    if(register && method==='POST') {
      if(!user)return json({error:'Unauthorized'},401);
      const list:any[]=await getData(env,'competitions')||[]; const c=list.find(x=>x.id===register[1]);
      if(!c)return json({error:'Competition not found'},404);
      c.participants=c.participants||[]; const p={...body,id:crypto.randomUUID(),userId:user.id,status:'pending',registeredAt:new Date().toISOString()};
      c.participants.push(p); await setData(env,'competitions',list); return json(p,201);
    }
    const details=path.match(/^\/competitions\/([^/]+)\/(details|participants)$/);
    if(details) {
      const list:any[]=await getData(env,'competitions')||[]; const c=list.find(x=>x.id===details[1]);
      if(!c)return json({error:'Competition not found'},404);
      if(method==='GET')return json(c);
      if(method==='PUT'&&requireRole(user,['organizer','admin'])) {
        c.participants=c.participants||[];
        const i=c.participants.findIndex((p:any)=>body.participantId?p.id===body.participantId:p.userId===body.userId&&p.dogId===body.dogId&&p.category===body.category);
        if(i<0)return json({error:'Participant not found'},404);
        c.participants[i]={...c.participants[i],...body,id:c.participants[i].id,userId:c.participants[i].userId};
        await setData(env,'competitions',list); return json(c.participants[i]);
      }
    }

    if(path==='/files'&&method==='POST') {
      if(!user)return json({error:'Unauthorized'},401);
      if(!body.content||!body.name)return json({error:'File content and name are required'},400);
      const bytes=decodeBase64(String(body.content));
      if(bytes.length>4*1024*1024)return json({error:'Maximum file size is 4 MB'},413);
      const rows=await sql`INSERT INTO files(owner_id,name,content_type,content) VALUES(${user.id},${body.name},${body.contentType||'application/octet-stream'},${bytes}) RETURNING id,name`;
      return json({id:rows[0].id,path:rows[0].id,fileName:rows[0].name},201);
    }
    const fileMatch=path.match(/^\/files\/([^/]+)$/);
    if(fileMatch&&method==='GET') {
      if(!user)return json({error:'Unauthorized'},401);
      const rows=await sql`SELECT name,content_type,content FROM files WHERE id=${fileMatch[1]}`;
      if(!rows[0])return json({error:'File not found'},404);
      const raw:any=rows[0].content;
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      return new Response(bytes,{status:200,headers:{'Content-Type':rows[0].content_type,'Content-Disposition':`inline; filename="${String(rows[0].name).replace(/[\r\n"]/g,'')}"`}});
    }
    const documentDownload=path.match(/^\/documents\/([^/]+)\/download$/);
    if(documentDownload&&method==='GET') {
      const documents:any[]=await getData(env,'documents')||[]; const document=documents.find(item=>item.id===documentDownload[1]);
      if(!document?.filePath)return json({error:'File not found'},404);
      return json({url:`/api/files/${document.filePath}`});
    }

    if(path==='/rating'&&method==='GET') { const comps:any[]=await getData(env,'competitions')||[]; return json(comps.flatMap(c=>c.results||[])); }
    if(path==='/rating/debug'&&method==='GET') return json({competitions:(await getData(env,'competitions')||[]).length});
    if(path==='/admin/users'&&method==='GET') {
      if(!requireRole(user,['admin']))return json({error:'Forbidden'},403);
      return json(await sql`SELECT id,email,name,role,created_at AS "createdAt" FROM users ORDER BY created_at DESC`);
    }
    const roleMatch=path.match(/^\/admin\/users\/([^/]+)\/role$/);
    if(roleMatch&&method==='PUT') {
      if(!requireRole(user,['admin']))return json({error:'Forbidden'},403);
      if(!['user','organizer','judge','admin'].includes(body.role))return json({error:'Invalid role'},400);
      await sql`UPDATE users SET role=${body.role} WHERE id=${roleMatch[1]}`;
      const profile=await getData(env,`profile:${roleMatch[1]}`); if(profile)await setData(env,`profile:${roleMatch[1]}`,{...profile,role:body.role});
      return json({success:true});
    }

    return json({error:'Endpoint not found'},404);
  } catch (error:any) {
    console.error(error);
    return json({ error:'Internal server error', details:error?.message || String(error) },500);
  }
};
