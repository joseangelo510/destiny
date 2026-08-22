import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = path.resolve(import.meta.dirname, "../..");
const migrationsRoot = path.join(productRoot, "supabase", "migrations");

async function migrationSource() {
  const files = (await readdir(migrationsRoot)).filter((file) => file.endsWith(".sql")).sort();
  const entries = await Promise.all(files.map(async (file) => ({
    file,
    sql: await readFile(path.join(migrationsRoot, file), "utf8"),
  })));
  return entries;
}

describe("hosted grant and policy conformance", () => {
  it("ships one forward migration that removes inherited browser privileges", async () => {
    const entries = await migrationSource();
    const hardening = entries.find((entry) => entry.file.endsWith("_revoke_default_grants_regrant_policy_backed.sql"));
    expect(hardening, "The hosted grant-policy drift needs an append-only hardening migration.").toBeDefined();
    expect(hardening?.sql).toContain("revoke all on all tables in schema public from public, anon, authenticated");
    expect(hardening?.sql).toContain("revoke execute on all functions in schema public from public, anon, authenticated");
    expect(hardening?.sql).toContain("alter default privileges for role postgres in schema public");
    expect(hardening?.sql).toContain("grant execute on function public.create_organization(text) to authenticated");
    expect(hardening?.sql).toContain("grant execute on function public.read_cms_transfer_states(uuid) to authenticated");
  });

  it("keeps the zero-row conformance audit in the isolation runner", async () => {
    const runner = await readFile(path.join(productRoot, "scripts", "qa-isolation.mjs"), "utf8");
    const audit = await readFile(path.join(productRoot, "qa", "sql", "grant-policy-conformance-audit.sql"), "utf8");
    expect(runner).toContain("QA_GRANT_POLICY_AUDIT_SQL");
    expect(audit).toContain("anonymous_table_grant");
    expect(audit).toContain("unsafe_authenticated_table_grant");
    expect(audit).toContain("public_policy_role");
    expect(audit).toContain("browser_public_function_execute");
    expect(audit).toContain("unsafe_browser_view");
  });
});
