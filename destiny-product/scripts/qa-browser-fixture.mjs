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
  outsiderAuditId: outsiderSite.auditIds[0],
  outsiderSiteId: outsiderSite.websiteId,
}, null, 2));

if (process.env.GITHUB_ENV) {
  await appendFile(process.env.GITHUB_ENV, [
    `NEXT_PUBLIC_SUPABASE_URL=${status.apiUrl}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.anonKey}`,
    `QA_AUTH_STATE=${authStatePath}`,
    `QA_LOCAL_BROWSER_FIXTURE=${manifestPath}`,
    "",
  ].join("\n"));
}

process.stdout.write(`Prepared local authenticated browser fixture at ${manifestPath}\n`);
