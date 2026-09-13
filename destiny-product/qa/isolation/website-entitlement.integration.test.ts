import { callerWebsiteOwner, matchingWebsiteUsage } from "../../supabase/functions/_shared/billing/caller-website";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, expect, test } from "vitest";
import { assertLoopbackSupabaseUrl } from "../../scripts/qa-isolation-environment.mjs";

const url = process.env.QA_SUPABASE_URL ?? "";
const anonKey = process.env.QA_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.QA_SUPABASE_SERVICE_ROLE_KEY ?? "";
if (process.env.QA_ISOLATION !== "1") throw new Error("Run through pnpm qa:isolation.");
assertLoopbackSupabaseUrl(url);
if (!anonKey || !serviceKey) throw new Error("Missing isolation credentials.");
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, serviceKey, options);
const people: { id: string; token: string }[] = [];
let organizationId = "";
let websiteId = "";
function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
async function request(token: string, body: unknown = { action: "website_access", websiteId, ownerId: people[1].id }) {
  return fetch(`${url}/functions/v1/billing`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeAll(async () => {
  for (let index = 0; index < 3; index++) {
    const email = `entitlement-${randomUUID()}@isolation.destiny.invalid`;
    const password = `Entitlement-${randomUUID()}!`;
    const created = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
    if (!created.user) throw new Error("Missing fixture user.");
    people.push({ id: created.user.id, token: "" });
    const client = createClient(url, anonKey, options);
    const signedIn = checked(await client.auth.signInWithPassword({ email, password }));
    if (!signedIn.session) throw new Error("Missing fixture session.");
    people[index].token = signedIn.session.access_token;
    if (index === 0) {
      organizationId = checked(await client.rpc("create_organization", { organization_name: "Entitlement isolation" })) as string;
      const website = checked(await client.from("websites").insert({ organization_id: organizationId, business_name: "Entitlement fixture", url: `https://${randomUUID()}.example`, normalized_domain: `${randomUUID()}.example` }).select("id").single());
      websiteId = website.id;
    }
  }
  checked(await admin.from("organization_members").insert({ organization_id: organizationId, user_id: people[1].id, role: "member" }));
  checked(await admin.from("billing_accounts").insert({ owner_id: people[0].id, plan: "starter", status: "active", period_start: new Date(Date.now() - 86400000).toISOString(), period_end: new Date(Date.now() + 86400000).toISOString(), paid_through: new Date(Date.now() + 86400000).toISOString() }));
});
afterAll(async () => {
  for (const person of people) checked(await admin.from("billing_usage").delete().eq("owner_id", person.id));
  for (const person of people) checked(await admin.from("billing_accounts").delete().eq("owner_id", person.id));
  if (organizationId) checked(await admin.from("organizations").delete().eq("id", organizationId));
  for (const person of people) checked(await admin.auth.admin.deleteUser(person.id));
});
test("actual Edge access follows site membership, owner payment and immediate revocation without billing disclosure", async () => {
  const selected = await request(people[0].token, { action: "select_sites", websiteIds: [websiteId], ownerId: people[1].id });
  expect(selected.status).toBe(200);
  expect((await selected.json()).selected).toEqual([websiteId]);
  const forbiddenSelection = await request(people[1].token, { action: "select_sites", websiteIds: [websiteId], ownerId: people[0].id });
  expect(forbiddenSelection.status).toBe(409);
  const memberSites = await request(people[1].token, { action: "sites", ownerId: people[0].id });
  expect(await memberSites.json()).toEqual({ capacity: 1, selected: [], websites: [] });
  const deselected = await request(people[0].token, { action: "select_sites", websiteIds: [] });
  expect(deselected.status).toBe(200);
  expect(await (await request(people[1].token)).json()).toEqual({ canRunPaidWork: false, canManageBilling: false });
  expect((await request(people[0].token, { action: "select_sites", websiteIds: [websiteId] })).status).toBe(200);
  const owner = await request(people[0].token);
  expect(owner.status).toBe(200);
  expect(await owner.json()).toEqual({ canRunPaidWork: true, canManageBilling: true });
  const member = await request(people[1].token);
  expect(member.status).toBe(200);
  expect(member.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await member.json()).toEqual({ canRunPaidWork: true, canManageBilling: false });
  const memberClient = createClient(url, anonKey, { ...options, global: { headers: { Authorization: `Bearer ${people[1].token}` } } });
  expect(checked(await memberClient.from("billing_accounts").select("*"))).toEqual([]);
  expect(await callerWebsiteOwner(memberClient, websiteId)).toBe(people[0].id);
  const reservation = checked(await admin.rpc("reserve_billing_usage", { p_owner_id: people[0].id, p_website_id: websiteId, p_request_key: `member-${randomUUID()}`, p_meter: "articles", p_units: 1 }));
  expect(reservation.allowed).toBe(true);
  expect(await matchingWebsiteUsage(admin, people[0].id, websiteId, reservation.id, "articles")).toBe(true);
  expect(await matchingWebsiteUsage(admin, people[1].id, websiteId, reservation.id, "articles")).toBe(false);
  expect(await matchingWebsiteUsage(admin, people[0].id, randomUUID(), reservation.id, "articles")).toBe(false);
  expect(await matchingWebsiteUsage(admin, people[0].id, websiteId, reservation.id, "infographics")).toBe(false);
  expect((await request(people[2].token)).status).toBe(403);
  checked(await admin.from("billing_accounts").update({ status: "past_due" }).eq("owner_id", people[0].id));
  expect(await (await request(people[1].token)).json()).toEqual({ canRunPaidWork: false, canManageBilling: false });
  checked(await admin.from("organization_members").delete().eq("organization_id", organizationId).eq("user_id", people[1].id));
  expect((await request(people[1].token)).status).toBe(403);
  expect(await callerWebsiteOwner(memberClient, websiteId)).toBeNull();
});
