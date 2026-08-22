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
const rlsPolicyAuditSqlPath = process.env.QA_RLS_POLICY_AUDIT_SQL ?? "";
const databaseContainer = process.env.QA_SUPABASE_DB_CONTAINER ?? "supabase_db_destiny-isolation";

if (process.env.QA_ISOLATION !== "1") {
  throw new Error("The isolation suite must run through pnpm qa:isolation.");
}
assertLoopbackSupabaseUrl(localUrl);
if (!anonKey || !serviceRoleKey || !auditSqlPath || !rlsPolicyAuditSqlPath) {
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
    runDatabaseSql(`delete from public.organizations where id in (${createdOrganizationIds.map((id) => `'${id}'`).join(",")});`);
    createdOrganizationIds.length = 0;
  }

  for (const userId of createdUserIds.splice(0)) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Isolation cleanup user: ${error.message}`);
  }
}

async function sweepAbandonedLocalFixtures() {
  runDatabaseSql("delete from public.organizations where name like 'Destiny isolation %';");

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

async function createTenant(label: "A" | "B" | "C"): Promise<Tenant> {
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

  const notificationId = randomUUID();
  runDatabaseSql(`
    insert into public.notifications
      (id, organization_id, website_id, user_id, kind, title, body)
    values
      ('${notificationId}', '${organizationId}', '${website.id}', '${user.id}', 'welcome',
       'Tenant ${label} notification', 'Local isolation fixture');
  `);

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
      { table: "notifications", id: notificationId, field: "read_at", original: null, attempted: new Date().toISOString() },
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

    const afterUpdate = await owner.client.from(row.table).select(`id,${row.field}`).eq("id", row.id).single();
    expect(afterUpdate.error, `${row.table}: owner verification after update failed.`).toBeNull();
    expect(afterUpdate.data?.[row.field], `${row.table}: cross-tenant update changed protected data.`).toEqual(row.original);

    const crossDelete = await outsider.client.from(row.table).delete().eq("id", row.id).select("id");
    expect(crossDelete.data ?? [], `${row.table}: cross-tenant delete affected a row.`).toHaveLength(0);

    const afterDelete = await owner.client.from(row.table).select("id").eq("id", row.id).maybeSingle();
    expect(afterDelete.error, `${row.table}: owner verification after delete failed.`).toBeNull();
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
  expectDatabaseSqlRejected(`
    insert into public.notifications
      (id, organization_id, website_id, user_id, kind, title)
    values
      ('${randomUUID()}', '${a.organizationId}', '${b.websiteId}', '${a.userId}', 'welcome', 'Blended notification');
  `, /does not belong to its organization/i);
}

async function grantSharedMembership(owner: Tenant, member: Tenant) {
  const { data, error } = await owner.client
    .from("organization_members")
    .insert({
      organization_id: owner.organizationId,
      user_id: member.userId,
      role: "member",
    })
    .select("organization_id,user_id,role")
    .single();
  expect(error, "The organization owner could not grant the shared membership.").toBeNull();
  expect(data).toMatchObject({
    organization_id: owner.organizationId,
    user_id: member.userId,
    role: "member",
  });

  const sharedRead = await member.client
    .from("websites")
    .select("id,business_name")
    .eq("id", owner.websiteId)
    .maybeSingle();
  expect(sharedRead.error, "The authorized shared member could not read the shared site.").toBeNull();
  expect(sharedRead.data).toMatchObject({
    id: owner.websiteId,
    business_name: "Isolation business A",
  });
}

async function verifyMemberCannotEscalate(owner: Tenant, member: Tenant, thirdParty: Tenant) {
  const selfPromotion = await member.client
    .from("organization_members")
    .update({ role: "admin" })
    .eq("organization_id", owner.organizationId)
    .eq("user_id", member.userId)
    .select("role");
  expect(selfPromotion.data ?? [], "A basic member promoted their own organization role.").toHaveLength(0);

  const memberGrant = await member.client
    .from("organization_members")
    .insert({
      organization_id: owner.organizationId,
      user_id: thirdParty.userId,
      role: "member",
    })
    .select("user_id");
  expect(memberGrant.data ?? [], "A basic member granted another user organization access.").toHaveLength(0);
  expect(memberGrant.error, "The rejected member grant should return an authorization error.").not.toBeNull();

  const unauthorizedRename = await member.client
    .from("organizations")
    .update({ name: "Unauthorized organization rename" })
    .eq("id", owner.organizationId)
    .select("id");
  expect(unauthorizedRename.data ?? [], "A basic member renamed the organization.").toHaveLength(0);

  const membership = await owner.client
    .from("organization_members")
    .select("role")
    .eq("organization_id", owner.organizationId)
    .eq("user_id", member.userId)
    .single();
  expect(membership.error, "The owner could not verify the member role after escalation attempts.").toBeNull();
  expect(membership.data?.role).toBe("member");

  const organization = await owner.client
    .from("organizations")
    .select("name")
    .eq("id", owner.organizationId)
    .single();
  expect(organization.error, "The owner could not verify the organization after the rename attempt.").toBeNull();
  expect(organization.data?.name).toBe(`${namePrefix} A`);
}

async function verifyRevokedMembership(owner: Tenant, member: Tenant) {
  const removal = await owner.client
    .from("organization_members")
    .delete()
    .eq("organization_id", owner.organizationId)
    .eq("user_id", member.userId)
    .select("user_id")
    .single();
  expect(removal.error, "The owner could not remove the shared member.").toBeNull();
  expect(removal.data?.user_id).toBe(member.userId);

  // The same signed-in session must lose access without a token refresh or new login.
  const revokedRead = await member.client
    .from("websites")
    .select("id")
    .eq("id", owner.websiteId)
    .maybeSingle();
  expect(revokedRead.error, "A revoked read should resolve as no visible row.").toBeNull();
  expect(revokedRead.data, "A removed member retained read access through the existing session.").toBeNull();

  const revokedUpdate = await member.client
    .from("websites")
    .update({ business_name: "Revoked member mutation" })
    .eq("id", owner.websiteId)
    .select("id");
  expect(revokedUpdate.data ?? [], "A removed member retained write access through the existing session.").toHaveLength(0);

  const ownerVerification = await owner.client
    .from("websites")
    .select("business_name")
    .eq("id", owner.websiteId)
    .single();
  expect(ownerVerification.error, "The owner could not verify the site after membership removal.").toBeNull();
  expect(ownerVerification.data?.business_name).toBe("Isolation business A");

  const ownSite = await member.client
    .from("websites")
    .select("id")
    .eq("id", member.websiteId)
    .single();
  expect(ownSite.error, "Removing shared access also broke the user's own organization access.").toBeNull();
  expect(ownSite.data?.id).toBe(member.websiteId);
}

async function edgeRequest(pathname: string, body?: Record<string, unknown>, accessToken?: string) {
  const headers: Record<string, string> = {
    apikey: anonKey,
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${localUrl}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
  });
}

async function verifyPrivilegedEdgeFunctionDenials(owner: Tenant, outsider: Tenant) {
  const session = await owner.client.auth.getSession();
  const accessToken = session.data.session?.access_token;
  expect(session.error, "The Edge denial suite could not read user A's local session.").toBeNull();
  expect(accessToken, "The Edge denial suite requires a real user A JWT.").toBeTruthy();

  const article = `<p>${"Approved local article content. ".repeat(8)}</p>`;
  const crossTenantRequests = [
    ["/functions/v1/google-oauth-start", { websiteId: outsider.websiteId, provider: "google_search_console" }],
    ["/functions/v1/google-sync", { websiteId: outsider.websiteId, provider: "google_search_console" }],
    ["/functions/v1/process-audit", { websiteId: outsider.websiteId }],
    ["/functions/v1/webflow-connect", { websiteId: outsider.websiteId, apiToken: "qa_webflow_token_that_never_leaves_localhost" }],
    ["/functions/v1/webflow-draft", { websiteId: outsider.websiteId, articleKey: "qa-webflow", title: "QA article", contentHtml: article }],
    ["/functions/v1/wordpress-connect", { websiteId: outsider.websiteId, siteUrl: "https://cms.invalid", username: "qa-user", applicationPassword: "local-only-password" }],
    ["/functions/v1/wordpress-draft", { websiteId: outsider.websiteId, articleKey: "qa-wordpress", title: "QA article", contentHtml: article }],
    ["/functions/v1/wordpress-reconcile", { websiteId: outsider.websiteId, articleKey: "qa-wordpress" }],
  ] as const;

  for (const [pathname, body] of crossTenantRequests) {
    const response = await edgeRequest(pathname, body, accessToken);
    expect(response.status, `${pathname} did not reject user A operating website B.`).toBe(403);
  }

  const deleteAccount = await edgeRequest("/functions/v1/delete-account");
  expect(deleteAccount.status, "Account deletion accepted an anonymous caller.").toBe(401);

  const callback = await fetch(`${localUrl}/functions/v1/google-oauth-callback?state=invalid&code=invalid`, {
    headers: { apikey: anonKey },
  });
  expect(callback.status, "Google OAuth accepted an invalid one-time state.").toBe(400);

  const digest = await edgeRequest("/functions/v1/rank-digest");
  expect(digest.status, "Rank digest accepted a caller without its cron secret.").toBe(401);

  const refresh = await edgeRequest("/functions/v1/rank-tracker-refresh");
  expect(refresh.status, "Rank refresh accepted a caller without its cron secret.").toBe(401);
}

function runPsql(sql: string) {
  return spawnSync("docker", [
    "exec", "-i", databaseContainer,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt",
  ], {
    encoding: "utf8",
    input: sql,
    maxBuffer: 4 * 1024 * 1024,
  });
}

function runDatabaseSql(sql: string) {
  const result = runPsql(sql);
  if (result.status !== 0) {
    throw new Error(`Isolation database command failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function expectDatabaseSqlRejected(sql: string, message: RegExp) {
  const result = runPsql(sql);
  expect(result.status, "A privileged blended-pair insert unexpectedly succeeded.").not.toBe(0);
  expect(`${result.stderr}\n${result.stdout}`).toMatch(message);
}

function verifyExecutableAudit(a: Tenant, b: Tenant) {
  const auditSql = readFileSync(auditSqlPath, "utf8");
  expect(runDatabaseSql(auditSql), "The clean three-site fixture should have zero mismatches.").toBe("");

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
  const poisonOutput = runDatabaseSql(poison);
  expect(poisonOutput).toContain("article_drafts.organization");
  expect(poisonOutput).toContain("article_drafts.audit");
  expect(runDatabaseSql(auditSql), "The poison transaction must roll back completely.").toBe("");
}

function verifyRlsPolicyAudit() {
  const auditSql = readFileSync(rlsPolicyAuditSqlPath, "utf8");
  expect(
    runDatabaseSql(auditSql),
    "Every public application table must enable RLS and expose a reviewed policy boundary.",
  ).toBe("");
}

test("three real local users cannot read, mutate, or blend each other's website data", async () => {
  await sweepAbandonedLocalFixtures();
  try {
    const a = await createTenant("A");
    const b = await createTenant("B");
    const c = await createTenant("C");

    expect(a.websiteId).not.toBe(b.websiteId);
    expect(b.websiteId).not.toBe(c.websiteId);
    expect(c.websiteId).not.toBe(a.websiteId);
    await verifyTenantBoundary(a, b);
    await verifyTenantBoundary(b, c);
    await verifyTenantBoundary(c, a);
    await verifyBlendedPairRejection(a, b);
    await verifyBlendedPairRejection(b, c);
    await verifyPrivilegedEdgeFunctionDenials(a, b);
    await grantSharedMembership(a, c);
    await verifyMemberCannotEscalate(a, c, b);
    await verifyRevokedMembership(a, c);
    verifyExecutableAudit(a, b);
    verifyRlsPolicyAudit();
  } finally {
    await deleteLocalFixtures();
  }
});
