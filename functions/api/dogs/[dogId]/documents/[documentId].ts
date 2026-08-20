import { currentUser, ensureStorageSchema, json, sqlFor, userOwnsDog, type StorageEnv } from '../../../../_shared/storage';

type Ctx = { request: Request; env: StorageEnv; params: { dogId: string; documentId: string } };

export const onRequestDelete = async ({ request, env, params }: Ctx) => {
  try {
    await ensureStorageSchema(env);
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const dogId = String(params.dogId || '');
    if (!(await userOwnsDog(env, String(user.id), dogId))) return json({ error: 'Forbidden' }, 403);

    const sql = sqlFor(env);
    const rows = await sql`
      SELECT d.id,d.file_id,f.storage_key
      FROM dog_documents d JOIN stored_files f ON f.id=d.file_id
      WHERE d.id=${String(params.documentId || '')} AND d.dog_id=${dogId} AND d.owner_id=${user.id}
    `;
    const document: any = rows[0];
    if (!document) return json({ error: 'Document not found' }, 404);

    await env.DOCUMENTS_BUCKET.delete(document.storage_key);
    await sql`DELETE FROM dog_documents WHERE id=${document.id}`;
    await sql`DELETE FROM stored_files WHERE id=${document.file_id}`;

    return json({ success: true });
  } catch (error: any) {
    console.error(error);
    return json({ error: 'Failed to delete dog document', details: error?.message || String(error) }, 500);
  }
};
