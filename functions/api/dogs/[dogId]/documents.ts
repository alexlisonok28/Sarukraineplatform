import { currentUser, decodeBase64, DOG_DOCUMENT_CATEGORIES, ensureStorageSchema, json, safeExtension, sqlFor, userOwnsDog, type StorageEnv } from '../../../_shared/storage';

type Ctx = { request: Request; env: StorageEnv; params: { dogId: string } };

export const onRequestGet = async ({ request, env, params }: Ctx) => {
  try {
    await ensureStorageSchema(env);
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const dogId = String(params.dogId || '');
    const ownsDog = await userOwnsDog(env, String(user.id), dogId);
    if (!ownsDog && user.role !== 'admin') return json({ error: 'Forbidden' }, 403);

    const ownerId = ownsDog ? String(user.id) : null;
    const rows = ownerId
      ? await sqlFor(env)`
          SELECT d.id,d.dog_id AS "dogId",d.document_type AS "documentType",d.category,
                 d.created_at AS "createdAt",f.id AS "fileId",f.original_name AS "fileName",
                 f.content_type AS "contentType",f.file_size AS "fileSize"
          FROM dog_documents d JOIN stored_files f ON f.id=d.file_id
          WHERE d.dog_id=${dogId} AND d.owner_id=${ownerId}
          ORDER BY d.created_at DESC
        `
      : await sqlFor(env)`
          SELECT d.id,d.dog_id AS "dogId",d.document_type AS "documentType",d.category,
                 d.created_at AS "createdAt",f.id AS "fileId",f.original_name AS "fileName",
                 f.content_type AS "contentType",f.file_size AS "fileSize"
          FROM dog_documents d JOIN stored_files f ON f.id=d.file_id
          WHERE d.dog_id=${dogId}
          ORDER BY d.created_at DESC
        `;

    return json(rows);
  } catch (error: any) {
    console.error(error);
    return json({ error: 'Failed to load dog documents', details: error?.message || String(error) }, 500);
  }
};

export const onRequestPost = async ({ request, env, params }: Ctx) => {
  try {
    await ensureStorageSchema(env);
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const dogId = String(params.dogId || '');
    if (!(await userOwnsDog(env, String(user.id), dogId))) return json({ error: 'Forbidden' }, 403);

    const body: any = await request.json();
    const documentType = String(body.documentType || '');
    const category = body.category ? String(body.category).toUpperCase() : null;
    const originalName = String(body.name || '').trim();
    const contentType = String(body.contentType || 'application/octet-stream');

    if (!['pedigree', 'attestation'].includes(documentType)) return json({ error: 'Invalid document type' }, 400);
    if (documentType === 'attestation' && !DOG_DOCUMENT_CATEGORIES.includes(category as any)) return json({ error: 'Invalid attestation category' }, 400);
    if (documentType === 'pedigree' && category) return json({ error: 'Pedigree document must not have a category' }, 400);
    if (!originalName || !body.content) return json({ error: 'File content and name are required' }, 400);

    const bytes = decodeBase64(String(body.content));
    if (bytes.length > 1024 * 1024) return json({ error: 'Maximum file size is 1 MB' }, 413);

    const fileId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const storageName = `${crypto.randomUUID()}${safeExtension(originalName)}`;
    const storageKey = `dogs/${user.id}/${dogId}/${documentId}/${storageName}`;

    await env.DOCUMENTS_BUCKET.put(storageKey, bytes, {
      httpMetadata: { contentType },
      customMetadata: { originalName, dogId, documentType, category: category || '' },
    });

    const sql = sqlFor(env);
    let fileRowCreated = false;
    try {
      await sql`
        INSERT INTO stored_files(id,owner_id,storage_key,original_name,content_type,file_size,scope)
        VALUES(${fileId},${user.id},${storageKey},${originalName},${contentType},${bytes.length},'dog')
      `;
      fileRowCreated = true;

      const rows = await sql`
        INSERT INTO dog_documents(id,dog_id,owner_id,document_type,category,file_id)
        VALUES(${documentId},${dogId},${user.id},${documentType},${category},${fileId})
        RETURNING id,dog_id AS "dogId",document_type AS "documentType",category,created_at AS "createdAt"
      `;

      return json({ ...rows[0], fileId, fileName: originalName, contentType, fileSize: bytes.length }, 201);
    } catch (error) {
      if (fileRowCreated) {
        try { await sql`DELETE FROM stored_files WHERE id=${fileId}`; } catch {}
      }
      await env.DOCUMENTS_BUCKET.delete(storageKey);
      throw error;
    }
  } catch (error: any) {
    console.error(error);
    return json({ error: 'Failed to upload dog document', details: error?.message || String(error) }, 500);
  }
};
