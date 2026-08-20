import { currentUser, ensureStorageSchema, json, safeDownloadName, sqlFor, type StorageEnv } from '../../_shared/storage';

type Ctx = { request: Request; env: StorageEnv; params: { fileId: string } };

export const onRequestGet = async ({ request, env, params }: Ctx) => {
  try {
    await ensureStorageSchema(env);
    const fileId = String(params.fileId || '');
    const sql = sqlFor(env);
    const user = await currentUser(env, request.headers.get('authorization'));

    const appRows = await sql`SELECT key,value FROM app_data WHERE key IN ('documents','competitions')`;
    const appData: Record<string, any> = Object.fromEntries(appRows.map((row: any) => [row.key, row.value]));
    const documents: any[] = appData.documents || [];
    const competitions: any[] = appData.competitions || [];

    const isPublicDocumentFile = documents.some(document => String(document?.filePath || '') === fileId);
    const isCompetitionRegistrationFile = competitions.some(competition =>
      (competition?.participants || []).some((participant: any) =>
        Array.isArray(participant?.documents) && participant.documents.some((id: any) => String(id) === fileId)
      )
    );

    const rows = await sql`
      SELECT id, owner_id, storage_key, original_name, content_type, scope
      FROM stored_files WHERE id=${fileId}
    `;
    const file: any = rows[0];

    if (file) {
      const isOwner = user && String(file.owner_id) === String(user.id);
      const isAdmin = user?.role === 'admin';
      if (!isPublicDocumentFile && !isCompetitionRegistrationFile && !isOwner && !isAdmin) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const object = await env.DOCUMENTS_BUCKET.get(file.storage_key);
      if (!object) return json({ error: 'File not found in storage' }, 404);

      const disposition = isCompetitionRegistrationFile && !isPublicDocumentFile ? 'inline' : 'attachment';
      return new Response(object.body, {
        status: 200,
        headers: {
          'Content-Type': file.content_type || object.httpMetadata?.contentType || 'application/octet-stream',
          'Content-Disposition': `${disposition}; filename="${safeDownloadName(file.original_name)}"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    // Сумісність зі старими файлами, які до підключення R2 зберігалися у Neon BYTEA.
    const legacyRows = await sql`
      SELECT owner_id,name,content_type,content FROM files WHERE id=${fileId}
    `;
    const legacy: any = legacyRows[0];
    if (!legacy) return json({ error: 'File not found' }, 404);

    const isOwner = user && String(legacy.owner_id) === String(user.id);
    const isAdmin = user?.role === 'admin';
    if (!isPublicDocumentFile && !isCompetitionRegistrationFile && !isOwner && !isAdmin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const raw: any = legacy.content;
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    const disposition = isCompetitionRegistrationFile && !isPublicDocumentFile ? 'inline' : 'attachment';
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': legacy.content_type || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${safeDownloadName(legacy.name)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: any) {
    console.error(error);
    return json({ error: 'File download failed', details: error?.message || String(error) }, 500);
  }
};
