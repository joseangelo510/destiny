import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { assertLoopbackSupabaseUrl, parseSupabaseStatus } from "./qa-isolation-environment.mjs";

const productRoot = path.resolve(import.meta.dirname, "..");
const supabaseBin = path.join(productRoot, "node_modules", ".bin", "supabase");
const artifactRoot = process.env.RUNNER_TEMP || tmpdir();
const authStatePath = path.join(artifactRoot, "destiny-local-auth-state.json");
const manifestPath = path.join(artifactRoot, "destiny-local-browser-fixture.json");
const runId = randomUUID().replaceAll("-", "").slice(0, 12);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: productRoot, encoding: "utf8" });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const status = parseSupabaseStatus(run(supabaseBin, ["status", "-o", "json"]));
const apiUrl = assertLoopbackSupabaseUrl(status.apiUrl);
const service = createClient(status.apiUrl, status.serviceRoleKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

function requireValue(data, error, label) {
  if (error) throw new Error(`${label}: ${error.message}`);
  if (data === null || data === undefined) throw new Error(`${label}: no value returned.`);
  return data;
}

async function createUser(label) {
  const email = `browser-${runId}-${label.toLowerCase()}@isolation.destiny.invalid`;
  const password = `Local-browser-${randomUUID()}!`;
  const result = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: `Browser ${label}`, last_name: "Isolation" },
  });
  const user = requireValue(result.data.user, result.error, `Create browser ${label} user`);
  const client = createClient(status.apiUrl, status.anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  requireValue(signedIn.data.session, signedIn.error, `Sign in browser ${label} user`);
  return { client, email, password, userId: user.id };
}

async function createOrganization(client, label) {
  const result = await client.rpc("create_organization", {
    organization_name: `Destiny browser ${runId} ${label}`,
  });
  return requireValue(result.data, result.error, `Create browser ${label} organization`);
}

async function createWebsite(client, organizationId, label, ownerId) {
  const normalizedDomain = `browser-${label.toLowerCase()}.example`;
  const result = await client.from("websites").insert({
    organization_id: organizationId,
    url: `https://${normalizedDomain}/`,
    normalized_domain: normalizedDomain,
    business_name: `Browser ${label}`,
    products_services: `Browser ${label} services`,
    ideal_customer: `Browser ${label} customers`,
    differentiation: `Browser ${label} difference`,
    market: "United States",
    onboarding_completed_at: new Date().toISOString(),
  }).select("id").single();
  const website = requireValue(result.data, result.error, `Create browser ${label} website`);

  const auditIds = [];
  const count = label === "Alpha" ? 1 : label === "Beta" ? 2 : label === "Member" ? 3 : 4;
  for (let index = 0; index < count; index += 1) {
    const auditResult = await client.from("audits").insert({
      website_id: website.id,
      requested_by: ownerId,
      provider: "dataforseo",
      status: "queued",
      progress: 0,
    }).select("id").single();
    const audit = requireValue(auditResult.data, auditResult.error, `Create browser ${label} audit ${index + 1}`);
    auditIds.push(audit.id);
  }
  return { auditIds, businessName: `Browser ${label}`, normalizedDomain, websiteId: website.id };
}

async function createBrowserCookies(email, password) {
  const jar = new Map();
  const auth = createServerClient(status.apiUrl, status.anonKey, {
    cookies: {
      getAll() {
        return [...jar.values()].map(({ name, value }) => ({ name, value }));
      },
      setAll(cookies) {
        for (const cookie of cookies) jar.set(cookie.name, cookie);
      },
    },
  });
  const result = await auth.auth.signInWithPassword({ email, password });
  requireValue(result.data.session, result.error, "Create authenticated browser session");

  return [...jar.values()].map(({ name, options = {}, value }) => ({
    name,
    value,
    domain: apiUrl.hostname,
    path: options.path || "/",
    httpOnly: options.httpOnly ?? false,
    secure: false,
    sameSite: options.sameSite === "strict" ? "Strict" : options.sameSite === "none" ? "None" : "Lax",
    expires: -1,
  }));
}

async function seedMvpCertification({ auditId, organizationId, ownerId, websiteId }) {
  const now = new Date();
  const completedAt = now.toISOString();
  const keywords = [
    { keyword: "seo consulting services", intent: "commercial", searchVolume: 900, difficulty: 35, cpc: 8.4, opportunity: "site_idea", themeId: "seo-services", themeLabel: "SEO services", themeRole: "core" },
    { keyword: "small business seo consultant", intent: "commercial", searchVolume: 600, difficulty: 31, cpc: 7.2, opportunity: "site_idea", themeId: "seo-services", themeLabel: "SEO services", themeRole: "core" },
    { keyword: "seo audit services", intent: "commercial", searchVolume: 450, difficulty: 29, cpc: 6.8, opportunity: "site_idea", themeId: "seo-audits", themeLabel: "SEO audits", themeRole: "supporting" },
  ];

  const auditUpdate = await service.from("audits").update({
    status: "complete",
    progress: 100,
    started_at: new Date(now.getTime() - 90_000).toISOString(),
    completed_at: completedAt,
  }).eq("id", auditId);
  if (auditUpdate.error) throw new Error(`Complete MVP browser audit: ${auditUpdate.error.message}`);

  const metrics = await service.from("audit_metrics").insert({
    audit_id: auditId,
    critical_issues: 1,
    warnings: 3,
    ranking_keywords: 3,
    new_keywords: 1,
    lost_keywords: 0,
    estimated_organic_traffic: 125,
    referring_domains: 12,
    content_gaps: 3,
    google_reviews: 8,
    raw_provider_payload: {
      growthStage: "foundation",
      providerResult: {
        sourceLabel: "Disposable browser certification evidence",
        keywords,
        pages: [{
          role: "homepage",
          title: "Browser Member SEO Consulting",
          url: "https://browser-member.example/",
          text: "SEO consulting services and practical SEO audits for small businesses across the United States.",
        }],
      },
    },
  });
  if (metrics.error) throw new Error(`Create MVP browser metrics: ${metrics.error.message}`);

  const preferences = await service.from("keyword_preferences").insert(keywords.map((item) => ({
    organization_id: organizationId,
    website_id: websiteId,
    user_id: ownerId,
    source_audit_id: auditId,
    keyword: item.keyword,
    normalized_keyword: item.keyword,
    decision: "approved",
    theme_id: item.themeId,
    theme_label: item.themeLabel,
    provider_intent: item.intent,
    search_intent: "consideration",
    search_volume: item.searchVolume,
    difficulty: item.difficulty,
    priority_score: 90,
  })));
  if (preferences.error) throw new Error(`Create MVP browser keyword preferences: ${preferences.error.message}`);

  const quests = await service.from("quests").insert([
    { website_id: websiteId, audit_id: auditId, title: "Approve your priority keyword strategy", description: "Confirm the searches that match the business.", category: "content", status: "todo", priority: 1, task_type: "keyword_review", action_path: "/keywords", estimated_minutes: 8, requires_approval: true, week_number: 1 },
    { website_id: websiteId, audit_id: auditId, title: "Review this week’s article", description: "Review the generated article before CMS delivery.", category: "content", status: "todo", priority: 2, task_type: "content_review", action_path: "/content", estimated_minutes: 15, requires_approval: true, week_number: 1 },
    { website_id: websiteId, audit_id: auditId, title: "Fix the highest-impact technical issue", description: "Use the saved audit evidence to complete one technical improvement.", category: "technical", status: "todo", priority: 3, task_type: "primary_quest", action_path: `/audits/${auditId}`, estimated_minutes: 20, requires_approval: false, week_number: 1 },
    { website_id: websiteId, audit_id: auditId, title: "Review the technical evidence", description: "Confirm the crawl and performance findings.", category: "technical", status: "todo", priority: 4, task_type: "technical_review", action_path: `/audits/${auditId}#technical-evidence`, estimated_minutes: 12, requires_approval: false, week_number: 1 },
    { website_id: websiteId, audit_id: auditId, title: "Share the article on social media", description: "This post-launch activity must not enter the certified MVP checklist.", category: "distribution", status: "todo", priority: 5, task_type: "social_distribution", action_path: "/distribution#social", estimated_minutes: 10, requires_approval: true, week_number: 1 },
  ]);
  if (quests.error) throw new Error(`Create MVP browser quests: ${quests.error.message}`);

  const integrationResult = await service.from("integrations").insert({
    organization_id: organizationId,
    website_id: websiteId,
    provider: "wordpress",
    external_account_id: "browser-member.example",
    status: "connected",
    metadata: { siteUrl: "https://browser-member.example/", label: "Disposable WordPress certification" },
    connected_at: completedAt,
    last_synced_at: completedAt,
  }).select("id").single();
  const integration = requireValue(integrationResult.data, integrationResult.error, "Create MVP browser WordPress integration");

  const body = "# SEO Consulting Services: A Practical Guide\n\nThis saved certification draft proves that CMS state is rendered from persisted website-scoped data.\n\n## What to review\n\nConfirm the business claims, links, and next step before publishing.";
  const drafts = await service.from("article_drafts").insert(keywords.map((item) => ({
    organization_id: organizationId,
    website_id: websiteId,
    audit_id: auditId,
    created_by: ownerId,
    user_id: ownerId,
    keyword: item.keyword,
    draft: {
      keyword: item.keyword,
      title: `${item.keyword}: a practical guide`,
      metaTitle: `${item.keyword}: a practical guide`,
      titleCandidates: [],
      metaDescription: `A practical guide to ${item.keyword} for small businesses.`,
      metaDescriptions: [`A practical guide to ${item.keyword} for small businesses.`],
      body,
      sources: [],
      infographics: [],
      bucketBrigades: [],
      generationStatus: "needs_generation",
      qualityIssues: [],
      optimization: [],
    },
  })));
  if (drafts.error) throw new Error(`Create MVP browser article drafts: ${drafts.error.message}`);

  const transfers = await service.from("cms_transfers").insert(keywords.map((item, index) => ({
    website_id: websiteId,
    integration_id: integration.id,
    article_key: `${auditId}:${item.keyword}`,
    content_hash: `browser-certification-${index + 1}`,
    remote_id: String(800 + index),
    remote_edit_url: `https://browser-member.example/wp-admin/post.php?post=${800 + index}&action=edit`,
    status: "succeeded",
    publication_status: "delivered_draft",
    remote_status: "draft",
    last_reconciled_at: completedAt,
    field_report: [{ field: "title", label: "Article title", status: "transferred", note: "Saved in the WordPress draft." }],
    completed_at: completedAt,
  })));
  if (transfers.error) throw new Error(`Create MVP browser CMS transfers: ${transfers.error.message}`);

  const scheduledFor = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const planResult = await service.from("publishing_plans").insert({
    organization_id: organizationId,
    website_id: websiteId,
    audit_id: auditId,
    mode: "automatic",
    status: "active",
    timezone: "UTC",
    holdback_hours: 72,
    start_date: scheduledFor.slice(0, 10),
    end_date: new Date(now.getTime() + 11 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    confirmed_post_count: 1,
    automatic_confirmed_at: completedAt,
  }).select("id").single();
  const plan = requireValue(planResult.data, planResult.error, "Create MVP browser publishing plan");
  const scheduleResult = await service.from("publishing_schedule_items").insert({
    organization_id: organizationId,
    website_id: websiteId,
    audit_id: auditId,
    plan_id: plan.id,
    position: 1,
    keyword: keywords[0].keyword,
    normalized_keyword: keywords[0].keyword,
    title: `${keywords[0].keyword}: a practical guide`,
    content_type: "Blog guide",
    scheduled_for: scheduledFor,
    state: "scheduled",
    article_key: `${auditId}:${keywords[0].keyword}`,
    review_recommended: false,
    remote_id: "800",
    remote_edit_url: "https://browser-member.example/wp-admin/post.php?post=800&action=edit",
  });
  if (scheduleResult.error) throw new Error(`Create MVP browser publishing schedule: ${scheduleResult.error.message}`);

  const trackedResult = await service.from("tracked_keywords").insert({
    website_id: websiteId,
    created_by: ownerId,
    keyword: keywords[0].keyword,
    normalized_keyword: keywords[0].keyword,
    source: "strategy",
    status: "active",
    last_checked_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    next_check_at: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString(),
  }).select("id").single();
  const tracked = requireValue(trackedResult.data, trackedResult.error, "Create MVP browser tracked keyword");
  const observations = await service.from("rank_observations").insert([
    { tracked_keyword_id: tracked.id, website_id: websiteId, observed_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), found: true, position: 18, result_url: "https://browser-member.example/seo-consulting", search_depth: 100, evidence: { fixture: true, phase: "previous" } },
    { tracked_keyword_id: tracked.id, website_id: websiteId, observed_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), found: true, position: 9, result_url: "https://browser-member.example/seo-consulting", search_depth: 100, evidence: { fixture: true, phase: "current" } },
  ]);
  if (observations.error) throw new Error(`Create MVP browser rank observations: ${observations.error.message}`);

  return { auditId, keyword: keywords[0].keyword, trackedKeywordId: tracked.id, websiteId };
}

const ownerA = await createUser("Owner-A");
const ownerB = await createUser("Owner-B");
const member = await createUser("Member-C");
const outsider = await createUser("Outsider-D");

const organizationA = await createOrganization(ownerA.client, "Alpha");
const organizationB = await createOrganization(ownerB.client, "Beta");
const organizationC = await createOrganization(member.client, "Member");
const organizationD = await createOrganization(outsider.client, "Outsider");

const alpha = await createWebsite(ownerA.client, organizationA, "Alpha", ownerA.userId);
const beta = await createWebsite(ownerB.client, organizationB, "Beta", ownerB.userId);
const memberSite = await createWebsite(member.client, organizationC, "Member", member.userId);
const outsiderSite = await createWebsite(outsider.client, organizationD, "Outsider", outsider.userId);

const mvp = await seedMvpCertification({
  auditId: memberSite.auditIds.at(-1),
  organizationId: organizationC,
  ownerId: member.userId,
  websiteId: memberSite.websiteId,
});

const alphaMembership = await ownerA.client.from("organization_members").insert({
  organization_id: organizationA,
  user_id: member.userId,
  role: "member",
});
if (alphaMembership.error) throw new Error(`Grant Alpha browser membership: ${alphaMembership.error.message}`);
const betaMembership = await ownerB.client.from("organization_members").insert({
  organization_id: organizationB,
  user_id: member.userId,
  role: "member",
});
if (betaMembership.error) throw new Error(`Grant Beta browser membership: ${betaMembership.error.message}`);

await mkdir(artifactRoot, { recursive: true });
await writeFile(authStatePath, JSON.stringify({ cookies: await createBrowserCookies(member.email, member.password), origins: [] }, null, 2));
await writeFile(manifestPath, JSON.stringify({
  alpha,
  beta,
  member: memberSite,
  mvp,
  outsiderAuditId: outsiderSite.auditIds[0],
  outsiderSiteId: outsiderSite.websiteId,
}, null, 2));

const environment = [
  `NEXT_PUBLIC_SUPABASE_URL=${status.apiUrl}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.anonKey}`,
  `QA_AUTH_STATE=${authStatePath}`,
  `QA_LOCAL_BROWSER_FIXTURE=${manifestPath}`,
  "",
].join("\n");

if (process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV, environment);
if (process.env.QA_BROWSER_ENV_FILE) await writeFile(process.env.QA_BROWSER_ENV_FILE, environment);

process.stdout.write(`Prepared local authenticated browser fixture at ${manifestPath}\n`);
