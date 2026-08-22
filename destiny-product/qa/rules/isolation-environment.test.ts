import { describe, expect, it } from "vitest";
import { assertLoopbackSupabaseUrl, parseSupabaseStatus } from "../../scripts/qa-isolation-environment.mjs";

describe("isolation environment guard", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "http://[::1]:54321",
  ])("accepts the loopback Supabase URL %s", (value) => {
    expect(assertLoopbackSupabaseUrl(value).hostname).toMatch(/^(127\.0\.0\.1|localhost|\[::1\])$/);
  });

  it.each([
    "https://example.supabase.co",
    "https://supabase.example.test",
    "http://192.168.1.10:54321",
    "file:///tmp/database",
  ])("rejects the non-loopback target %s", (value) => {
    expect(() => assertLoopbackSupabaseUrl(value)).toThrow(/refusing non-loopback Supabase URL/i);
  });

  it("extracts local credentials without logging or hardcoding them", () => {
    expect(parseSupabaseStatus(JSON.stringify({
      API_URL: "http://127.0.0.1:54321",
      ANON_KEY: "local-anon",
      SERVICE_ROLE_KEY: "local-service",
      DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    }))).toEqual({
      apiUrl: "http://127.0.0.1:54321",
      anonKey: "local-anon",
      serviceRoleKey: "local-service",
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    });
  });
});
