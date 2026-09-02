import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "vitest";
import { assertLoopbackSupabaseUrl } from "../../scripts/qa-isolation-environment.mjs";

type RowResult = { id: string } & Record<string, unknown>;
type Client = SupabaseClient;

type ReadIsolationRow = {
  table: string;
  key: string;
  value: string;
};

type Tenant = {
  userId: string;
  organizationId: string;
  websiteId: string;
  auditId: string;
  planId: string;
  cmsTransferId: string;
  agentConversationId: string;
  agentMessageId: string;
  agentProposalId: string;
  client: Client;
  readRows: ReadIsolationRow[];
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

function seedReadIsolationRows(input: {
  label: "A" | "B" | "C";
  organizationId: string;
  websiteId: string;
  auditId: string;
  userId: string;
  interlinkRunId: string;
  interviewId: string;
}) {
  const ids = {
    competitor: randomUUID(),
    integration: randomUUID(),
    quest: randomUUID(),
    rankList: randomUUID(),
    trackedKeyword: randomUUID(),
    rankObservation: randomUUID(),
    rankRun: randomUUID(),
    directory: randomUUID(),
    preference: randomUUID(),
    reoptimization: randomUUID(),
    llmTask: randomUUID(),
    digestSend: randomUUID(),
    repurpose: randomUUID(),
    interlinkOpportunity: randomUUID(),
    interviewQuestion: randomUUID(),
    interviewAnswer: randomUUID(),
    voiceItem: randomUUID(),
    cmsTransfer: randomUUID(),
    agentConversation: randomUUID(),
    agentMessage: randomUUID(),
    agentProposal: randomUUID(),
  };
  const label = input.label;
  runDatabaseSql(`
    insert into public.audit_metrics (audit_id, ranking_keywords, raw_provider_payload)
    values ('${input.auditId}', ${label.charCodeAt(0)}, '{"tenant":"${label}"}'::jsonb);

    insert into public.competitors (id, website_id, name, url)
    values ('${ids.competitor}', '${input.websiteId}', 'Competitor ${label}', 'https://competitor-${label.toLowerCase()}.invalid');

    insert into public.integrations (id, organization_id, website_id, provider, status, metadata)
    values ('${ids.integration}', '${input.organizationId}', '${input.websiteId}', 'google_search_console', 'connected', '{"tenant":"${label}"}'::jsonb);

    insert into public.quests (id, website_id, audit_id, title, category, status)
    values ('${ids.quest}', '${input.websiteId}', '${input.auditId}', 'Quest ${label}', 'content', 'todo');

    insert into public.rank_tracker_lists (id, website_id, created_by, name)
    values ('${ids.rankList}', '${input.websiteId}', '${input.userId}', 'Rank list ${label}');

    insert into public.tracked_keywords
      (id, website_id, list_id, created_by, keyword, normalized_keyword, source, status)
    values
      ('${ids.trackedKeyword}', '${input.websiteId}', '${ids.rankList}', '${input.userId}',
       'Tracked keyword ${label} ${runId}', 'tracked keyword ${label.toLowerCase()} ${runId}', 'manual', 'active');

    insert into public.rank_observations
      (id, tracked_keyword_id, website_id, observed_at, found, position, search_depth, evidence)
    values
      ('${ids.rankObservation}', '${ids.trackedKeyword}', '${input.websiteId}', now(), true, 42, 100,
       '{"tenant":"${label}"}'::jsonb);

    insert into public.rank_tracker_runs
      (id, website_id, status, requested_count, completed_count, completed_at)
    values ('${ids.rankRun}', '${input.websiteId}', 'complete', 1, 1, now());

    insert into public.directory_profiles
      (id, organization_id, website_id, directory_key, profile_url, status)
    values
      ('${ids.directory}', '${input.organizationId}', '${input.websiteId}', 'qa-${label.toLowerCase()}',
       'https://directory-${label.toLowerCase()}.invalid/profile', 'saved');

    insert into public.keyword_preferences
      (id, organization_id, website_id, user_id, source_audit_id, keyword, normalized_keyword, decision)
    values
      ('${ids.preference}', '${input.organizationId}', '${input.websiteId}', '${input.userId}', '${input.auditId}',
       'Preference ${label} ${runId}', 'preference ${label.toLowerCase()} ${runId}', 'approved');

    insert into public.reoptimization_documents
      (id, organization_id, website_id, audit_id, user_id, keyword, normalized_keyword, page_url, manifest)
    values
      ('${ids.reoptimization}', '${input.organizationId}', '${input.websiteId}', '${input.auditId}', '${input.userId}',
       'Reoptimization ${label}', 'reoptimization ${label.toLowerCase()}',
       'https://page-${label.toLowerCase()}.invalid/service', '{"version":4,"tenant":"${label}"}'::jsonb);

    insert into public.llm_visibility_tasks
      (id, website_id, source_key, task_key, status)
    values ('${ids.llmTask}', '${input.websiteId}', 'owned-site', 'qa-task-${label.toLowerCase()}', 'todo');

    insert into public.rank_digest_sends
      (id, website_id, organization_id, period_key, recipient, status)
    values
      ('${ids.digestSend}', '${input.websiteId}', '${input.organizationId}', 'qa-${label.toLowerCase()}-${runId}',
       'qa-${label.toLowerCase()}@isolation.destiny.invalid', 'accepted');

    insert into public.repurpose_sources
      (id, organization_id, website_id, user_id, source_kind, source_name, source_size_bytes,
       extracted_text_ciphertext, extracted_characters, status)
    values
      ('${ids.repurpose}', '${input.organizationId}', '${input.websiteId}', '${input.userId}', 'paste',
       'Repurpose ${label}', 100, repeat('x', 64), 100, 'ready');

    insert into public.interlink_opportunities
      (id, run_id, organization_id, website_id, source_url, source_title, target_url, target_title,
       anchor_text, source_sentence, reason, priority_score, priority, status)
    values
      ('${ids.interlinkOpportunity}', '${input.interlinkRunId}', '${input.organizationId}', '${input.websiteId}',
       'https://source-${label.toLowerCase()}.invalid/article', 'Source ${label}',
       'https://target-${label.toLowerCase()}.invalid/service', 'Target ${label}', 'helpful anchor ${label}',
       'A useful source sentence for tenant ${label}.', 'A relevant internal link for tenant ${label}.', 80, 'high', 'suggested');

    insert into public.interview_questions
      (id, organization_id, website_id, interview_id, position, kind, text)
    values
      ('${ids.interviewQuestion}', '${input.organizationId}', '${input.websiteId}', '${input.interviewId}',
       1, 'warm_up', 'What should customers know for tenant ${label}?');

    insert into public.interview_answers
      (id, organization_id, website_id, interview_id, question_id, user_id, verbatim_text)
    values
      ('${ids.interviewAnswer}', '${input.organizationId}', '${input.websiteId}', '${input.interviewId}',
       '${ids.interviewQuestion}', '${input.userId}', 'Verbatim expertise for tenant ${label}.');

    insert into public.voice_library_items
      (id, organization_id, website_id, interview_id, answer_id, type, title, body, provenance, status)
    values
      ('${ids.voiceItem}', '${input.organizationId}', '${input.websiteId}', '${input.interviewId}',
       '${ids.interviewAnswer}', 'pov', 'Point of view ${label}', 'Voice evidence for tenant ${label}.',
       '[{"answer_id":"${ids.interviewAnswer}"}]'::jsonb, 'confirmed_by_owner');

    insert into public.cms_transfers
      (id, website_id, integration_id, article_key, content_hash, status)
    values
      ('${ids.cmsTransfer}', '${input.websiteId}', '${ids.integration}', 'qa-${label.toLowerCase()}-${runId}',
       'local-only-${label.toLowerCase()}', 'succeeded');

    insert into public.agent_conversations
      (id, organization_id, website_id, user_id, title)
    values
      ('${ids.agentConversation}', '${input.organizationId}', '${input.websiteId}', '${input.userId}',
       'Agent conversation ${label}');

    insert into public.agent_messages
      (id, organization_id, website_id, conversation_id, role, content)
    values
      ('${ids.agentMessage}', '${input.organizationId}', '${input.websiteId}', '${ids.agentConversation}',
       'assistant', '{"text":"Tenant ${label} evidence"}'::jsonb);

    insert into public.agent_proposals
      (id, organization_id, website_id, conversation_id, message_id, payload)
    values
      ('${ids.agentProposal}', '${input.organizationId}', '${input.websiteId}', '${ids.agentConversation}',
       '${ids.agentMessage}', '{"title":"Tenant ${label} draft","targetKeyword":"tenant ${label}"}'::jsonb);
  `);

  return {
    cmsTransferId: ids.cmsTransfer,
    agentConversationId: ids.agentConversation,
    agentMessageId: ids.agentMessage,
    agentProposalId: ids.agentProposal,
    readRows: [
      { table: "audit_metrics", key: "audit_id", value: input.auditId },
      { table: "competitors", key: "id", value: ids.competitor },
      { table: "integrations", key: "id", value: ids.integration },
      { table: "quests", key: "id", value: ids.quest },
      { table: "rank_tracker_lists", key: "id", value: ids.rankList },
      { table: "tracked_keywords", key: "id", value: ids.trackedKeyword },
      { table: "rank_observations", key: "id", value: ids.rankObservation },
      { table: "rank_tracker_runs", key: "id", value: ids.rankRun },
      { table: "directory_profiles", key: "id", value: ids.directory },
      { table: "keyword_preferences", key: "id", value: ids.preference },
      { table: "reoptimization_documents", key: "id", value: ids.reoptimization },
      { table: "llm_visibility_tasks", key: "id", value: ids.llmTask },
      { table: "notification_preferences", key: "website_id", value: input.websiteId },
      { table: "rank_digest_sends", key: "id", value: ids.digestSend },
      { table: "repurpose_sources", key: "id", value: ids.repurpose },
      { table: "interlink_opportunities", key: "id", value: ids.interlinkOpportunity },
      { table: "interview_questions", key: "id", value: ids.interviewQuestion },
      { table: "interview_answers", key: "id", value: ids.interviewAnswer },
      { table: "voice_library_items", key: "id", value: ids.voiceItem },
    ],
  };
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

  const extended = seedReadIsolationRows({
    label,
    organizationId,
    websiteId: website.id,
    auditId: audit.id,
    userId: user.id,
    interlinkRunId: interlink.id,
    interviewId: interview.id,
  });

  return {
    userId: user.id,
    organizationId,
    websiteId: website.id,
    auditId: audit.id,
    planId: plan.id,
    cmsTransferId: extended.cmsTransferId,
    agentConversationId: extended.agentConversationId,
    agentMessageId: extended.agentMessageId,
    agentProposalId: extended.agentProposalId,
    client,
    readRows: extended.readRows,
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
      { table: "agent_conversations", id: extended.agentConversationId, field: "title", original: `Agent conversation ${label}`, attempted: "Cross-tenant agent conversation" },
      { table: "agent_messages", id: extended.agentMessageId, field: "partial", original: false, attempted: true },
      { table: "agent_proposals", id: extended.agentProposalId, field: "result", original: null, attempted: { crossTenant: true } },
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

async function verifyExtendedReadIsolation(owner: Tenant, outsider: Tenant) {
  const ownProfile = await owner.client.from("profiles").select("id").eq("id", owner.userId).single();
  expect(ownProfile.error, "The user could not read their own profile.").toBeNull();
  expect(ownProfile.data?.id).toBe(owner.userId);
  const crossProfile = await outsider.client.from("profiles").select("id").eq("id", owner.userId).maybeSingle();
  expect(crossProfile.error, "A hidden cross-user profile should resolve as no row.").toBeNull();
  expect(crossProfile.data, "A user profile leaked to another tenant.").toBeNull();

  for (const row of owner.readRows) {
    const ownRead = await owner.client
      .from(row.table)
      .select(row.key)
      .eq(row.key, row.value)
      .maybeSingle();
    expect(ownRead.error, `${row.table}: same-tenant extended read failed.`).toBeNull();
    expect(ownRead.data?.[row.key], `${row.table}: owner could not read the registered fixture.`).toBe(row.value);

    const crossRead = await outsider.client
      .from(row.table)
      .select(row.key)
      .eq(row.key, row.value)
      .maybeSingle();
    expect(crossRead.error, `${row.table}: cross-tenant extended read should resolve as hidden.`).toBeNull();
    expect(crossRead.data, `${row.table}: registered tenant data leaked.`).toBeNull();
  }

  const serviceOnly = await owner.client
    .from("cms_transfers")
    .select("id")
    .eq("id", owner.cmsTransferId)
    .maybeSingle();
  expect(serviceOnly.data, "cms_transfers became directly visible to an authenticated user.").toBeNull();
}

async function verifyBlendedPairRejection(a: Tenant, b: Tenant) {
  await expectInsertRejected(a.client, "agent_conversations", {
    organization_id: a.organizationId,
    website_id: b.websiteId,
    user_id: a.userId,
    title: "Blended agent conversation",
  });
  await expectInsertRejected(a.client, "agent_messages", {
    organization_id: a.organizationId,
    website_id: b.websiteId,
    conversation_id: a.agentConversationId,
    role: "user",
    content: { text: "Must not exist" },
  });
  await expectInsertRejected(a.client, "agent_proposals", {
    organization_id: a.organizationId,
    website_id: b.websiteId,
    conversation_id: a.agentConversationId,
    message_id: a.agentMessageId,
    payload: { title: "Must not exist", targetKeyword: "blocked" },
  });
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

  for (const [table, id] of [
    ["agent_conversations", owner.agentConversationId],
    ["agent_messages", owner.agentMessageId],
    ["agent_proposals", owner.agentProposalId],
  ] as const) {
    const privateAgentRead = await member.client.from(table).select("id").eq("id", id).maybeSingle();
    expect(privateAgentRead.error, `${table}: a same-organization non-owner read should resolve as hidden.`).toBeNull();
    expect(privateAgentRead.data, `${table}: a user-owned agent record leaked to another organization member.`).toBeNull();
  }
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
    ["/functions/v1/calendar-orphan-repair", { websiteId: outsider.websiteId, itemId: randomUUID(), mode: "dry_run" }],
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
    redirect: "manual",
  });
  expect(callback.status, "Google OAuth did not reject an invalid one-time state with an error redirect.").toBe(302);
  const callbackLocation = callback.headers.get("location");
  expect(callbackLocation, "Google OAuth did not provide a safe error destination.").toBeTruthy();
  const callbackDestination = new URL(callbackLocation!);
  expect(callbackDestination.pathname).toBe("/integrations");
  expect(callbackDestination.searchParams.get("google")).toBe("failed");
  expect(callbackDestination.searchParams.get("reason")).toBe("invalid_response");

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
    const directedPairs = [[a, b], [b, a], [a, c], [c, a], [b, c], [c, b]] as const;
    for (const [owner, outsider] of directedPairs) {
      await verifyTenantBoundary(owner, outsider);
      await verifyExtendedReadIsolation(owner, outsider);
      await verifyBlendedPairRejection(owner, outsider);
    }
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
