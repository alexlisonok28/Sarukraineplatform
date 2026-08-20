import { currentUser, ensureStorageSchema, json, sqlFor, type StorageEnv } from '../../_shared/storage';

type Ctx = { request: Request; env: StorageEnv; params: { dogId: string } };

async function loadDogs(env: StorageEnv, userId: string) {
  const rows = await sqlFor(env)`SELECT value FROM app_data WHERE key=${`dogs:${userId}`}`;
  return (rows[0]?.value || []) as any[];
}

async function saveDogs(env: StorageEnv, userId: string, dogs: any[]) {
  await sqlFor(env)`
    INSERT INTO app_data(key,value) VALUES(${`dogs:${userId}`},${JSON.stringify(dogs)}::jsonb)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=now()
  `;
}

export const onRequestPut = async ({ request, env, params }: Ctx) => {
  try {
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const dogId = String(params.dogId || '');
    const dogs = await loadDogs(env, String(user.id));
    const index = dogs.findIndex(dog => String(dog.id) === dogId);
    if (index < 0) return json({ error: 'Dog not found' }, 404);

    const body: any = await request.json();
    dogs[index] = { ...dogs[index], ...body, id: dogs[index].id, userId: user.id };
    await saveDogs(env, String(user.id), dogs);
    return json(dogs[index]);
  } catch (error: any) {
    console.error(error);
    return json({ error: 'Failed to update dog', details: error?.message || String(error) }, 500);
  }
};

export const onRequestDelete = async ({ request, env, params }: Ctx) => {
  try {
    await ensureStorageSchema(env);
    const user = await currentUser(env, request.headers.get('authorization'));
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const dogId = String(params.dogId || '');
    const dogs = await loadDogs(env, String(user.id));
    const index = dogs.findIndex(dog => String(dog.id) === dogId);
    if (index < 0) return json({ error: 'Dog not found' }, 404);

    const sql = sqlFor(env);
    const documentRows = await sql`
      SELECT d.id,d.file_id,f.storage_key
      FROM dog_documents d JOIN stored_files f ON f.id=d.file_id
      WHERE d.dog_id=${dogId} AND d.owner_id=${user.id}
    `;

    for (const document of documentRows as any[]) {
      try { await env.DOCUMENTS_BUCKET.delete(document.storage_key); } catch (error) { console.error('R2 cleanup failed', error); }
    }

    if (documentRows.length > 0) {
      const fileIds = (documentRows as any[]).map(item => String(item.file_id));
      await sql`DELETE FROM dog_documents WHERE dog_id=${dogId} AND owner_id=${user.id}`;
      for (const fileId of fileIds) await sql`DELETE FROM stored_files WHERE id=${fileId}`;
    }

    dogs.splice(index, 1);
    await saveDogs(env, String(user.id), dogs);
    return json({ success: true });
  } catch (error: any) {
    console.error(error);
    return json({ error: 'Failed to delete dog', details: error?.message || String(error) }, 500);
  }
};
