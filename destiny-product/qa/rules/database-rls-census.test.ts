import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const productRoot = process.cwd();
const migrationDirectory = path.join(productRoot, "supabase", "migrations");
const manifestPath = path.join(productRoot, "qa", "inventory", "database-rls.json");
const specificationPath = path.join(productRoot, "qa", "specs", "database-rls.md");
const auditPath = path.join(productRoot, "qa", "sql", "rls-policy-audit.sql");

type AccessMode = "authenticated" | "service_role_only";
type Scope = "website" | "organization" | "user";
type ManifestEntry = {
  table: string;
  scope: Scope;
  access: AccessMode;
};

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function migrationSource() {
  const files = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  return (await Promise.all(files.map((file) => readFile(path.join(migrationDirectory, file), "utf8"))))
    .join("\n")
    .toLowerCase();
}

function createdPublicTables(source: string) {
  return [...source.matchAll(/create table(?: if not exists)? public\.([a-z0-9_]+)/g)]
    .map((match) => match[1])
    .sort();
}

function manifestTables(entries: ManifestEntry[]) {
  return entries.map((entry) => entry.table).sort();
}

describe("database RLS census", () => {
  it("requires a reviewed manifest, specification, and executable database audit", async () => {
    expect(await exists(manifestPath)).toBe(true);
    expect(await exists(specificationPath)).toBe(true);
    expect(await exists(auditPath)).toBe(true);
  });

  it("fails closed when a public table is added without a declared access boundary", async () => {
    const source = await migrationSource();
    const entries = JSON.parse(await readFile(manifestPath, "utf8")) as ManifestEntry[];

    expect(manifestTables(entries)).toEqual(createdPublicTables(source));
    expect(new Set(manifestTables(entries)).size).toBe(entries.length);
  });

  it("requires RLS on every public application table and policies for authenticated tables", async () => {
    const source = await migrationSource();
    const entries = JSON.parse(await readFile(manifestPath, "utf8")) as ManifestEntry[];

    for (const entry of entries) {
      expect(["website", "organization", "user"]).toContain(entry.scope);
      expect(["authenticated", "service_role_only"]).toContain(entry.access);
      expect(source, `${entry.table} must enable row-level security.`)
        .toMatch(new RegExp(`alter table public\\.${entry.table} enable row level security`));

      if (entry.access === "authenticated") {
        expect(source, `${entry.table} must declare at least one authenticated policy.`)
          .toMatch(new RegExp(`create policy[\\s\\S]{0,240}?on public\\.${entry.table}\\b`));
      }
    }
  });

  it("runs the live catalog audit inside the disposable Supabase gate", async () => {
    const runner = await readFile(path.join(productRoot, "scripts", "qa-isolation.mjs"), "utf8");
    const isolation = await readFile(
      path.join(productRoot, "qa", "isolation", "two-tenant.integration.test.ts"),
      "utf8",
    );
    const audit = await readFile(auditPath, "utf8");

    expect(runner).toContain("QA_RLS_POLICY_AUDIT_SQL");
    expect(isolation).toContain("QA_RLS_POLICY_AUDIT_SQL");
    expect(isolation).toContain("verifyRlsPolicyAudit");
    expect(audit).toContain("pg_class");
    expect(audit).toContain("pg_policy");
    expect(audit).toContain("cms_transfers");
  });
});
