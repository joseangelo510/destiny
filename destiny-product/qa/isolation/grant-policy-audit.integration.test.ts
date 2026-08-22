import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { assertLoopbackSupabaseUrl } from "../../scripts/qa-isolation-environment.mjs";

const localUrl = process.env.QA_SUPABASE_URL ?? "";
const auditPath = process.env.QA_GRANT_POLICY_AUDIT_SQL ?? "";
const databaseContainer = process.env.QA_SUPABASE_DB_CONTAINER ?? "supabase_db_destiny-isolation";

const serviceRoleWorkerAudit = String.raw`
with required_table_privileges as (
  select table_row.table_name, required_privilege.privilege_type
  from information_schema.tables table_row
  cross join (
    values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
  ) as required_privilege(privilege_type)
  where table_row.table_schema = 'public'
    and table_row.table_type = 'BASE TABLE'
)
select table_name || ':' || privilege_type
from required_table_privileges required_row
where not exists (
  select 1
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'public'
    and grant_row.table_name = required_row.table_name
    and grant_row.grantee = 'service_role'
    and grant_row.privilege_type = required_row.privilege_type
)
order by 1;
`;

if (process.env.QA_ISOLATION !== "1") throw new Error("Run through pnpm qa:isolation.");
assertLoopbackSupabaseUrl(localUrl);
if (!auditPath) throw new Error("Missing grant-policy audit path.");

function runDatabaseSql(sql: string) {
  const result = spawnSync("docker", [
    "exec", "-i", databaseContainer,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt",
  ], { encoding: "utf8", input: sql });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

test("fresh database grant and policy conformance audit returns zero rows", () => {
  const auditSql = readFileSync(auditPath, "utf8");
  expect(runDatabaseSql(auditSql)).toBe("");
});

test("fresh database explicitly grants worker table privileges to service_role", () => {
  expect(runDatabaseSql(serviceRoleWorkerAudit)).toBe("");
});
