const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function assertLoopbackSupabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Refusing non-loopback Supabase URL: invalid URL.");
  }

  if (parsed.protocol !== "http:" || !LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`Refusing non-loopback Supabase URL: ${parsed.origin}.`);
  }

  return parsed;
}

function requiredString(record, key) {
  const value = record?.[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Supabase status did not provide ${key}.`);
  }
  return value;
}

export function parseSupabaseStatus(statusJson) {
  let status;
  try {
    status = JSON.parse(statusJson);
  } catch {
    throw new Error("Supabase status was not valid JSON.");
  }

  const apiUrl = requiredString(status, "API_URL");
  const databaseUrl = requiredString(status, "DB_URL");
  assertLoopbackSupabaseUrl(apiUrl);

  const databaseTarget = new URL(databaseUrl);
  if (databaseTarget.protocol !== "postgresql:" || !LOOPBACK_HOSTS.has(databaseTarget.hostname)) {
    throw new Error(`Refusing non-loopback Supabase URL: ${databaseTarget.hostname}.`);
  }

  return {
    apiUrl,
    anonKey: requiredString(status, "ANON_KEY"),
    serviceRoleKey: requiredString(status, "SERVICE_ROLE_KEY"),
    databaseUrl,
  };
}
