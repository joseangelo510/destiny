import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, expect, test } from "vitest";
import { assertLoopbackSupabaseUrl } from "../../scripts/qa-isolation-environment.mjs";

const localUrl = process.env.QA_SUPABASE_URL ?? "";
const anonKey = process.env.QA_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.QA_SUPABASE_SERVICE_ROLE_KEY ?? "";
const auditPath = process.env.QA_GRANT_POLICY_AUDIT_SQL ?? "";
const databaseContainer = process.env.QA_SUPABASE_DB_CONTAINER ?? "supabase_db_destiny-isolation";

if (process.env.QA_ISOLATION !== "1") throw new Error("Run through pnpm qa:isolation.");
assertLoopbackSupabaseUrl(localUrl);
if (!anonKey || !serviceRoleKey || !auditPath) throw new Error("Missing isolation environment.");

const service = createClient(localUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = randomUUID().replaceAll("-", "").slice(0, 12);
const email = `grant-policy-${runId}@isolation.destiny.invalid`;
const password = `Grant-policy-${randomUUID()}!`;
let userId = "";
let organizationId = "";
let websiteId = "";
let notificationId = "";
let owner = createClient(localUrl, anonKey);

function requireData<T>(data: T | null, error: { message: string } | null, label: string): T {
  if (error) throw new Error(`${label}: ${error.message}`);
  if (data === null) throw new Error(`${label}: no data returned`);
  return data;
}

function runDatabaseSql(sql: string) {
  const result = spawnSync("docker", [
    "exec", "-i", databaseContainer,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt",
  ], { encoding: "utf8", input: sql });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

beforeAll(async () => {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Grant", last_name: "Policy" },
  });
  userId = requireData(created.data.user, created.error, "create user").id;
  owner = createClient(localUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signedIn = await owner.auth.signInWithPassword({ email, password });
  requireData(signedIn.data.session, signedIn.error, "sign in");
  const organization = await owner.rpc("create_organization", {
    organization_name: `Grant policy ${runId}`,
  });
  organizationId = requireData(organization.data as string | null, organization.error, "create organization");
  const website = await owner.from("websites").insert({
    organization_id: organizationId,
    url: `https://grant-policy-${runId}.example/`,
    normalized_domain: `grant-policy-${runId}.example`,
    business_name: "Before update",
  }).select("id").single();
  websiteId = requireData(website.data, website.error, "create website").id;
  const notification = await service.from("notifications").insert({
    organization_id: organizationId,
    website_id: websiteId,
    user_id: userId,
    kind: "welcome",
    title: "Grant policy notification",
  }).select("id").single();
  notificationId = requireData(notification.data, notification.error, "create notification").id;
});

afterAll(async () => {
  if (organizationId) await service.from("organizations").delete().eq("id", organizationId);
  if (userId) await service.auth.admin.deleteUser(userId);
});

test("owner can update their website and mark their notification read", async () => {
  const website = await owner.from("websites")
    .update({ business_name: "After update" })
    .eq("id", websiteId)
    .select("business_name")
    .single();
  expect(website.error).toBeNull();
  expect(website.data?.business_name).toBe("After update");

  const readAt = new Date().toISOString();
  const notification = await owner.from("notifications")
    .update({ read_at: readAt })
    .eq("id", notificationId)
    .select("read_at")
    .single();
  expect(notification.error).toBeNull();
  expect(notification.data?.read_at).toBe(readAt);
});

test("grant and policy conformance audit returns zero rows", () => {
  const auditSql = readFileSync(auditPath, "utf8");
  expect(runDatabaseSql(auditSql)).toBe("");
});
