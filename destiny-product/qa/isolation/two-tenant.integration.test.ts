import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "vitest";
import { assertLoopbackSupabaseUrl } from "../../scripts/qa-isolation-environment.mjs";

type RowResult = { id: string } & Record<string, unknown>;
type Client = SupabaseClient;

type Tenant = {
  userId: string;
  organizationId: string;
  websiteId: string;
  auditId: string;
  planId: string;
  client: Client;
  rows: Array<{
    table: string;
    id: string;
    field: string;
    original: unknown;
    attempted: unknown;
  }>;
};

const runId = randomUUID().replaceAll("-", "").slice(0, 16);
const namePrefix = `Destiny isolation ${runId}`;
const localUrl = process.env.QA_SUPABASE_URL ?? "";
const anonKey = process.env.QA_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.QA_SUPABASE_SERVICE_ROLE_KEY ?? "";
const auditSqlPath = process.env.QA_ISOLATION_AUDIT_SQL ?? "";
const databaseContainer = process.env.QA_SUPABASE_DB_CONTAINER ?? "supabase_db_destiny-isolation";

if (process.env.QA_ISOLATION !== "1") {
  throw new Error("The isolation suite must run through pnpm qa:isolation.");
}
assertLoopbackSupabaseUrl(localUrl);
if (!anonKey || !serviceRoleKey || !auditSqlPath) {
  throw new Error("The disposable Supabase stack did not provide the isolation test environment.");
}

const service = createClient(localUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const createdOrganizationIds: string[] = [];
const createdUserIds: string[] = [];

function requireRow<T>(data: T | null, error: { message: string } | null, label: string): T {
  if (error) throw new Error(`${label}: ${error.message}`);
  if (data === null) throw new Error(`${label}: no row returned.`);
  return data;
}

async function deleteLocalFixtures() {
  if (createdOrganizationIds.length > 0) {
    const { error } = await service.from("organizations").delete().in("id", createdOrganizationIds);
    if (error) throw new Error(`Isolation cleanup organizations: ${error.message}`);
    createdOrganizationIds.length = 0;
  }

  for (const userId of createdUserIds.splice(0)) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Isolation cleanup user: ${error.message}`);
  }
}

async function sweepAbandonedLocalFixtures() {
  const { data: organizations, error: organizationError } = await service
    .from("organizations")
    .select("id")
    .like("name", "Destiny isolation %");
  if (organizationError) throw new Error(`Isolation pre-run organization sweep: ${organizationError.message}`);
  const organizationIds = (organizations ?? []).map((row) => row.id);
  if (organizationIds.length > 0) {
    const { error } = await service.from("organizations").delete().in("id", organizationIds);
    if (error) throw new Error(`Isolation pre-run organization cleanup: ${error.message}`);
  }

  const { data: users, error: userError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userError) throw new Error(`Isolation pre-run user sweep: ${userError.message}`);
  for (const user of users.users) {
    if (user.email?.endsWith("@isolation.destiny.invalid")) {
      const { error } = await service.auth.admin.deleteUser(user.id);
      if (error) throw new Error(`Isolation pre-run user cleanup: ${error.message}`);
    }
  }
}

async function insertOne(client: Client, table: string, values: Record<string, unknown>, label: string) {
  const { data, error } = await client.from(table).insert(values).select("*").single<RowResult>();
  return requireRow(data, error, label);
}

async function createTenant(label: "A" | "B"): Promise<Tenant> {
  const email = `qa-${runId}-${label.toLowerCase()}@isolation.destiny.invalid`;
  const password = `Local-only-${randomUUID()}!`;
  const userResult = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: `Tenant ${label}`, last_name: "Isolation" },
  });
  const user = requireRow(userResult.data.user, userResult.error, `Create tenant ${label} user`);
  createdUserIds.push(user.id);

  const client = createClient(localUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Sign in tenant ${label}: ${signInError.message}`);

  const organizationResult = await client.rpc("create_organization", {
    organization_name: `${namePrefix} ${label}`,
  });
  const organizationId = requireRow(
    organizationResult.data as string | null,
    organizationResult.error,
    `Create tenant ${label} organization`,
  );
  createdOrganizationIds.push(organizationId);

  const website = await insertOne(client, "websites", {
    organization_id: organizationId,
    url: "https://shared-domain.example/",
    normalized_domain: "shared-domain.example",
    business_name: `Isolation business ${label}`,
    products_services: `Products ${label}`,
    ideal_customer: `Audience ${label}`,
    differentiation: `Difference ${label}`,
    market: "United States",
  }, `Create tenant ${label} website`);

  const audit = await insertOne(client, "audits", {
    website_id: website.id,
    requested_by: user.id,
    provider: "dataforseo",
    status: "queued",
  }, `Create tenant ${label} audit`);

  const keyword = await insertOne(client, "keyword_decisions", {
    audit_id: audit.id,
    website_id: website.id,
    user_id: user.id,
    keyword: `isolation keyword ${label} ${runId}`,
    decision: "approved",
  }, `Create tenant ${label} keyword decision`);

  const article = await insertOne(client, "article_drafts", {
    organization_id: organizationId,
    website_id: website.id,
    audit_id: audit.id,
    user_id: user.id,
    keyword: `isolation article ${label} ${runId}`,
    draft: { title: `Tenant ${label} draft` },
  }, `Create tenant ${label} article draft`);

  const start = new Date();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 89);
  const plan = await insertOne(client, "publishing_plans", {
    organization_id: organizationId,
    website_id: website.id,
    audit_id: audit.id,
    created_by: user.id,
    mode: "review_each",
    status: "active",
    timezone: "America/Los_Angeles",
    holdback_hours: 72,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    confirmed_post_count: 1,
  }, `Create tenant ${label} publishing plan`);

  const schedule = await insertOne(client, "publishing_schedule_items", {
    plan_id: plan.id,
    organization_id: organizationId,
    website_id: website.id,
    audit_id: audit.id,
    position: 1,
    keyword: `scheduled keyword ${label} ${runId}`,
    normalized_keyword: `scheduled keyword ${label.toLowerCase()} ${runId}`,
    title: `Tenant ${label} scheduled article`,
    content_type: "blog",
    scheduled_for: new Date(Date.now() + 86_400_000).toISOString(),
    state: "planned",
  }, `Create tenant ${label} publishing schedule item`);

  const interview = await insertOne(client, "interviews", {
    organization_id: organizationId,
    website_id: website.id,
    audit_id: audit.id,
    created_by: user.id,
    topic_title: `Tenant ${label} expertise interview`,
    focus_keyword: `interview ${label}`,
    mode: "typed",
    status: "in_progress",
    question_count: 1,
  }, `Create tenant ${label} interview`);

  const interlink = await insertOne(client, "interlink_runs", {
    organization_id: organizationId,
    website_id: website.id,
    audit_id: audit.id,
    user_id: user.id,
    status: "complete",
    pages_checked: 2,
    manifest: { tenant: label },
    completed_at: new Date().toISOString(),
  }, `Create tenant ${label} interlink run`);

  const notification = await insertOne(service, "notifications", {
    organization_id: organizationId,
    website_id: website.id,
    user_id: user.id,
    kind: "welcome",
    title: `Tenant ${label} notification`,
    body: "Local isolation fixture",
  }, `Create tenant ${label} notification`);

  return {
    userId: user.id,
    organizationId,
    websiteId: website.id,
    auditId: audit.id,
    planId: plan.id,
    client,
    rows: [
      { table: "websites", id: website.id, field: "business_name", original: `Isolation business ${label}`, attempted: `Cross-tenant website ${label}` },
      { table: "audits", id: audit.id, field: "status", original: "queued", attempted: "cancelled" },
      { table: "keyword_decisions", id: keyword.id, field: "decision", original: "approved", attempted: "declined" },
      { table: "article_drafts", id: article.id, field: "draft", original: { title: `Tenant ${label} draft` }, attempted: { title: "Cross-tenant draft" } },
      { table: "publishing_plans", id: plan.id, field: "status", original: "active", attempted: "paused" },
      { table: "publishing_schedule_items", id: schedule.id, field: "state", original: "planned", attempted: "drafting" },
      { table: "interviews", id: interview.id, field: "status", original: "in_progress", attempted: "partial" },
      { table: "interlink_runs", id: interlink.id, field: "status", original: "complete", attempted: "running" },
      { table: "notifications", id: notification.id, field: "read_at", original: null, attempted: new Date().toISOString() },
    ],
  };
}

async function expectInsertRejected(client: Client, table: string, values: Record<string, unknown>) {
  const { data, error } = await client.from(table).insert(values).select("id");
  expect(data ?? [], `${table} unexpectedly accepted a blended tenant row.`).toHaveLength(0);
  expect(error, `${table} should explain that the blended tenant row was rejected.`).not.toBeNull();
}

async function verifyTenantBoundary(owner: Tenant, outsider: Tenant) {
  for (const row of owner.rows) {
    const ownRead = await owner.client.from(row.table).select("id").eq("id", row.id).maybeSingle();
    expect(ownRead.error, `${row.table}: same-tenant read failed.`).toBeNull();
    expect(ownRead.data?.id, `${row.table}: same-tenant row was not visible.`).toBe(row.id);

    const crossRead = await outsider.client.from(row.table).select("id").eq("id", row.id).maybeSingle();
    expect(crossRead.error, `${row.table}: cross-tenant read should resolve as no visible row.`).toBeNull();
    expect(crossRead.data, `${row.table}: cross-tenant row leaked.`).toBeNull();

    const crossUpdate = await outsider.client
      .from(row.table)
      .update({ [row.field]: row.attempted })
      .eq("id", row.id)
      .select("id");
    expect(crossUpdate.data ?? [], `${row.table}: cross-tenant update affected a row.`).toHaveLength(0);

    const afterUpdate = await service.from(row.table).select(`id,${row.field}`).eq("id", row.id).single();
    expect(afterUpdate.error, `${row.table}: service verification after update failed.`).toBeNull();
    expect(afterUpdate.data?.[row.field], `${row.table}: cross-tenant update changed protected data.`).toEqual(row.original);

    const crossDelete = await outsider.client.from(row.table).delete().eq("id", row.id).select("id");
    expect(crossDelete.data ?? [], `${row.table}: cross-tenant delete affected a row.`).toHaveLength(0);

    const afterDelete = await service.from(row.table).select("id").eq("id", row.id).maybeSingle();
    expect(afterDelete.error, `${row.table}: service verification after delete failed.`).toBeNull();
    expect(afterDelete.data?.id, `${row.table}: cross-tenant delete removed protected data.`).toBe(row.id);
  }
}

async function verifyBlendedPairRejection(a: Tenant, b: Tenant) {
  await expectInsertRejected(a.client, "websites", {
    organization_id: b.organizationId,
    url: "https://cross-tenant-website.example/",
    normalized_domain: `cross-${runId}.example`,
    business_name: "Cross tenant website",
  });
  await expectInsertRejected(a.client, "audits", {
    website_id: b.websiteId,
    requested_by: a.userId,
    provider: "dataforseo",
  });
  await expectInsertRejected(a.client, "keyword_decisions", {
    audit_id: a.auditId,
    website_id: b.websiteId,
    user_id: a.userId,
    keyword: `blended keyword ${runId}`,
    decision: "approved",
  });
  await expectInsertRejected(a.client, "article_drafts", {
    organization_id: a.organizationId,
    website_id: a.websiteId,
    audit_id: b.auditId,
    user_id: a.userId,
    keyword: `blended article ${runId}`,
    draft: { title: "Must not exist" },
  });
  await expectInsertRejected(a.client, "publishing_plans", {
    organization_id: a.organizationId,
    website_id: a.websiteId,
    audit_id: b.auditId,
    created_by: a.userId,
    mode: "review_each",
    status: "active",
    timezone: "America/Los_Angeles",
    holdback_hours: 72,
    start_date: "2026-08-21",
    end_date: "2026-11-18",
    confirmed_post_count: 1,
  });
  await expectInsertRejected(a.client, "publishing_schedule_items", {
    plan_id: a.planId,
    organization_id: a.organizationId,
    website_id: a.websiteId,
    audit_id: b.auditId,
    position: 2,
    keyword: `blended schedule ${runId}`,
    normalized_keyword: `blended schedule ${runId}`,
    title: "Must not be scheduled",
    content_type: "blog",
    scheduled_for: new Date(Date.now() + 172_800_000).toISOString(),
  });
  await expectInsertRejected(a.client, "interviews", {
    organization_id: a.organizationId,
    website_id: a.websiteId,
    audit_id: b.auditId,
    created_by: a.userId,
    topic_title: "Blended interview",
    question_count: 1,
  });
  await expectInsertRejected(a.client, "interlink_runs", {
    organization_id: a.organizationId,
    website_id: a.websiteId,
    audit_id: b.auditId,
    user_id: a.userId,
    pages_checked: 1,
  });
  await expectInsertRejected(service, "notifications", {
    organization_id: a.organizationId,
    website_id: b.websiteId,
    user_id: a.userId,
    kind: "welcome",
    title: "Blended notification",
  });
}

function runAuditSql(sql: string) {
  const result = spawnSync("docker", [
    "exec", "-i", databaseContainer,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt",
  ], {
    encoding: "utf8",
    input: sql,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`Isolation SQL audit failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function verifyExecutableAudit(a: Tenant, b: Tenant) {
  const auditSql = readFileSync(auditSqlPath, "utf8");
  expect(runAuditSql(auditSql), "The clean two-tenant fixture should have zero mismatches.").toBe("");

  const poisonKeyword = `poison-${runId}`;
  const poison = `
    begin;
    insert into public.article_drafts
      (organization_id, website_id, audit_id, user_id, keyword, draft)
    values
      ('${a.organizationId}', '${b.websiteId}', '${a.auditId}', '${a.userId}', '${poisonKeyword}', '{"title":"poison"}'::jsonb);
    ${auditSql}
    rollback;
  `;
  const poisonOutput = runAuditSql(poison);
  expect(poisonOutput).toContain("article_drafts.organization");
  expect(poisonOutput).toContain("article_drafts.audit");
  expect(runAuditSql(auditSql), "The poison transaction must roll back completely.").toBe("");
}

test("two real local users cannot read, mutate, or blend each other's website data", async () => {
  await sweepAbandonedLocalFixtures();
  try {
    const a = await createTenant("A");
    const b = await createTenant("B");

    expect(a.websiteId).not.toBe(b.websiteId);
    await verifyTenantBoundary(a, b);
    await verifyTenantBoundary(b, a);
    await verifyBlendedPairRejection(a, b);
    await verifyBlendedPairRejection(b, a);
    verifyExecutableAudit(a, b);
  } finally {
    await deleteLocalFixtures();
  }
});
