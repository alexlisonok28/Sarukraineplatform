import { canReviewDogDocuments, currentUser, ensureStorageSchema, json, sqlFor, type StorageEnv } from '../../../../../_shared/storage';

type Ctx = {
  request: Request;
  env: StorageEnv;
  params: { dogId: string; documentId: string };
};

export const onRequestPost = async ({ request, env, params }: Ctx) => {
  try {
    await ensureStorageSchema(env);
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const dogId = String(params.dogId || '');
    const documentId = String(params.documentId || '');
    if (!(await canReviewDogDocuments(env, user, dogId))) return json({ error: 'Forbidden' }, 403);

    const sql = sqlFor(env);
    const rows = await sql`
      SELECT id,is_checked AS "isChecked"
      FROM dog_documents
      WHERE id=${documentId} AND dog_id=${dogId}
    `;
    const document: any = rows[0];
    if (!document) return json({ error: 'Document not found' }, 404);
    if (document.isChecked) return json({ error: 'Document is already checked' }, 409);

    const updated = await sql`
      UPDATE dog_documents
      SET is_checked=true, checked_by=${user.id}, checked_at=now()
      WHERE id=${documentId} AND dog_id=${dogId} AND is_checked=false
      RETURNING id,is_checked AS "isChecked",checked_by AS "checkedBy",checked_at AS "checkedAt"
    `;

    if (!updated[0]) return json({ error: 'Document is already checked' }, 409);
    return json({
      ...updated[0],
      checkedByName: user.name || user.email || '',
      checkedByEmail: user.email || '',
    });
  } catch (error: any) {
    console.error(error);
    return json({ error: 'Failed to verify dog document', details: error?.message || String(error) }, 500);
  }
};
