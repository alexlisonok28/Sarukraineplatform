export type D1PreparedStatementLike = {
  bind: (...values: any[]) => D1PreparedStatementLike;
  all: <T = Record<string, any>>() => Promise<{ results?: T[] }>;
};

export type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatementLike;
};

export type D1Env = { DB: D1DatabaseLike };

const normalizeSql = (query: string) => query
  .replace(/::jsonb\b/gi, '')
  .replace(/\bnow\(\)/gi, 'CURRENT_TIMESTAMP')
  .replace(/\bILIKE\b/gi, 'LIKE');

const normalizeValue = (value: any) => {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Uint8Array) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  return value;
};

const parseRow = (row: any) => {
  if (!row || typeof row !== 'object') return row;
  const result = { ...row };
  if (typeof result.value === 'string') {
    try { result.value = JSON.parse(result.value); } catch {}
  }
  for (const key of Object.keys(result)) {
    if (/^(is_|has_)/.test(key) && result[key] === 0) result[key] = false;
    else if (/^(is_|has_)/.test(key) && result[key] === 1) result[key] = true;
  }
  return result;
};

/**
 * Tagged-template adapter that keeps the existing `sql`...${value}`` call style
 * while executing all queries against the Cloudflare D1 binding named DB.
 */
export const sqlFor = (env: D1Env) => {
  if (!env.DB) throw new Error('DB D1 binding is not configured');
  return async (strings: TemplateStringsArray, ...values: any[]) => {
    let query = strings[0];
    for (let i = 0; i < values.length; i++) query += `?${strings[i + 1]}`;
    const statement = env.DB.prepare(normalizeSql(query)).bind(...values.map(normalizeValue));
    const response = await statement.all<any>();
    return (response.results || []).map(parseRow);
  };
};
