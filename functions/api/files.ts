import { currentUser, decodeBase64, ensureStorageSchema, json, safeExtension, sqlFor, type StorageEnv } from '../_shared/storage';

type Ctx = { request: Request; env: StorageEnv };

export const onRequestPost = async ({ request, env }: Ctx) => {
  try {
    await ensureStorageSchema(env);
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body: any = await request.json();
    const originalName = String(body.name || '').trim();
    const contentType = String(body.contentType || 'application/octet-stream');
    if (!originalName || !body.content) return json({ error: 'File content and name are required' }, 400);

    const bytes = decodeBase64(String(body.content));
    // Загальні файли та файли заявок поки зберігають попередній ліміт 4 МБ.
    // Для документів собак окремий endpoint застосовує погоджений ліміт 1 МБ.
    if (bytes.length > 4 * 1024 * 1024) return json({ error: 'Maximum file size is 4 MB' }, 413);

    const fileId = crypto.randomUUID();
    const storageName = `${crypto.randomUUID()}${safeExtension(originalName)}`;
    const storageKey = `uploads/${user.id}/${fileId}/${storageName}`;

    await env.DOCUMENTS_BUCKET.put(storageKey, bytes, {
      httpMetadata: { contentType },
      customMetadata: { originalName },
    });

    try {
      const rows = await sqlFor(env)`
        INSERT INTO stored_files(id,owner_id,storage_key,original_name,content_type,file_size,scope)
        VALUES(${fileId},${user.id},${storageKey},${originalName},${contentType},${bytes.length},'generic')
        RETURNING id, original_name AS "fileName", file_size AS "fileSize"
      `;
      return json({ id: rows[0].id, path: rows[0].id, fileName: rows[0].fileName, fileSize: rows[0].fileSize }, 201);
    } catch (error) {
      await env.DOCUMENTS_BUCKET.delete(storageKey);
      throw error;
    }
  } catch (error: any) {
    console.error(error);
    return json({ error: 'File upload failed', details: error?.message || String(error) }, 500);
  }
};
