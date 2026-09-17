export function preserveHostDatabaseUrl({ hostDatabaseUrl, runtimeEnv }) {
  const env = { ...(runtimeEnv || {}) };
  const value = String(hostDatabaseUrl || '').trim();
  if (value) env.DATABASE_URL = value;
  return env;
}

export function databaseNameFromUrl(value) {
  try {
    const pathname = new URL(String(value || '')).pathname.replace(/^\/+/, '');
    return pathname || null;
  } catch {
    return null;
  }
}

export function selectAuthorizedMaterialChunks(rows, prefix = 'HW-') {
  const normalizedPrefix = String(prefix || '').trim();
  const selected = (Array.isArray(rows) ? rows : []).filter(row =>
    String(row?.original_name || '').startsWith(normalizedPrefix)
  );
  const materialIds = [...new Set(selected.map(row => row.material_id).filter(Boolean))].sort();
  const materialIdSet = new Set(materialIds);
  return {
    materialIds,
    chunks: selected.filter(row => materialIdSet.has(row.material_id))
  };
}
