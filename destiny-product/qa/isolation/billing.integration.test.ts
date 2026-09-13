import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

if (process.env.QA_ISOLATION !== "1") throw new Error("Billing isolation requires disposable local infrastructure.");
const container = process.env.QA_SUPABASE_DB_CONTAINER ?? "supabase_db_destiny-isolation";
if (container !== "supabase_db_destiny-isolation") throw new Error("Unexpected billing test database.");
const owner = randomUUID(), other = randomUUID(), organization = randomUUID(), website = randomUUID();
function sql(statement: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-Atq"]);
    let output = "", errors = "";
    child.stdout.on("data", part => output += part);
    child.stderr.on("data", part => errors += part);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(errors)));
    child.stdin.end(statement);
  });
}
function reserve(key: string, meter = "articles") {
  return sql(`select public.reserve_billing_usage('${owner}',null,'${key}','${meter}',1);`).then(JSON.parse);
}
beforeAll(async () => {
  await sql(`insert into auth.users(id,email) values ('${owner}','${owner}@billing.invalid'),('${other}','${other}@billing.invalid');
    insert into public.billing_accounts(owner_id,plan,status,period_start,period_end,paid_through)
    values('${owner}','starter','active',now()-interval '1 day',now()+interval '20 days',now()+interval '20 days');
    insert into public.organizations(id,name,owner_id) values('${organization}','Billing QA','${owner}');
    insert into public.websites(id,organization_id,url,normalized_domain,business_name) values('${website}','${organization}','https://billing.invalid','billing.invalid','Billing QA');`);
});
afterAll(async () => {
  await sql(`delete from public.billing_stripe_events where stripe_customer_id='cus_${owner}'; delete from public.billing_usage where owner_id in ('${owner}','${other}'); delete from public.billing_accounts where owner_id in ('${owner}','${other}'); delete from public.organizations where id='${organization}'; delete from auth.users where id in ('${owner}','${other}');`);
});
describe.sequential("atomic billing reservations and isolation", () => {
  it("serializes checkout and webhook reconciliation and rejects stale lease releases", async () => {
    const claims = await Promise.all(Array.from({ length: 6 }, () => sql(`select public.claim_billing_operation('${owner}',false);`).then(JSON.parse)));
    const winner = claims.find(value => value.acquired);
    expect(claims.filter(value => value.acquired)).toHaveLength(1);
    expect(await sql(`select public.release_billing_operation('${owner}','${randomUUID()}');`)).toBe("f");
    expect(await sql(`select public.release_billing_operation('${owner}','${winner.token}');`)).toBe("t");
    await expect(sql(`select public.claim_billing_operation('${owner}',true);`)).rejects.toThrow("Billing mode mismatch");
    await expect(sql(`begin; set local role authenticated; select public.claim_billing_operation('${owner}',false); rollback;`)).rejects.toThrow("permission denied");
  });
  it("does not allow concurrent requests to overspend the account", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => reserve(`concurrent-${index}`)));
    expect(results.filter(result => result.allowed)).toHaveLength(4);
    expect(results.filter(result => result.reason === "limit_reached")).toHaveLength(6);
  });
  it("restores failed units without discarding provider expense and never replays completed work", async () => {
    const id = await sql(`select id from public.billing_usage where owner_id='${owner}' limit 1;`);
    await sql(`select public.finish_billing_usage('${id}',false,0.02);`);
    expect(await reserve("replacement-article")).toMatchObject({ allowed: true });
    expect(await reserve("replacement-article")).toMatchObject({ allowed: false, reason: "duplicate" });
    expect(await sql(`select provider_cost_usd from public.billing_usage where id='${id}';`)).toBe("0.020000");
    await expect(reserve("replacement-article", "keywordSearches")).rejects.toThrow("Idempotency key reused");
  });
  it("protects subscription state and ledger mutation from both browser roles", async () => {
    const identity = `select set_config('request.jwt.claims','{"sub":"${other}","role":"authenticated"}',true);`;
    for (const table of ["billing_accounts", "billing_usage"]) {
      const rows = await sql(`begin; set local role authenticated; ${identity} select count(*) from public.${table}; rollback;`);
      expect(rows.split("\n").at(-1)).toBe("0");
      const ownIdentity = `select set_config('request.jwt.claims','{"sub":"${owner}","role":"authenticated"}',true);`;
      const ownRows = await sql(`begin; set local role authenticated; ${ownIdentity} select count(*) from public.${table}; rollback;`);
      expect(Number(ownRows.split("\n").at(-1))).toBeGreaterThan(0);
    }
    await expect(sql(`begin; set local role authenticated; select * from public.billing_stripe_events; rollback;`)).rejects.toThrow("permission denied");
    await expect(sql(`begin; set local role authenticated; update public.billing_accounts set plan='premium'; rollback;`)).rejects.toThrow("permission denied");
    await expect(sql(`begin; set local role authenticated; select public.reserve_billing_usage('${owner}',null,'browser-key','articles',1); rollback;`)).rejects.toThrow("permission denied");
    await expect(sql(`begin; set local role anon; select * from public.billing_usage; rollback;`)).rejects.toThrow("permission denied");
  });
  it("exposes only the signed-in owner's aggregate and rejects anonymous usage reads", async () => {
    for (const [id, ownsUsage] of [[owner, true], [other, false]] as const) {
      const result = await sql(`begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated"}',true); select coalesce(sum(used),0) from public.billing_period_usage(); rollback;`);
      expect(Number(result.split("\n").at(-1)) > 0).toBe(ownsUsage);
    }
    expect(await sql(`select prosecdef from pg_proc where oid='public.billing_period_usage()'::regprocedure;`)).toBe("f");
    await expect(sql(`begin; set local role anon; select * from public.billing_period_usage(); rollback;`)).rejects.toThrow("permission denied");
  });
  it("blocks unpaid workers and expired trials in the database, without trusting the web UI", async () => {
    await sql(`update public.billing_accounts set status='past_due' where owner_id='${owner}';`);
    expect(await reserve("unpaid-worker", "keywordSearches")).toMatchObject({ allowed: false, reason: "payment_required" });
    await sql(`update public.billing_accounts set status='trialing', trial_started_at=now()-interval '8 days',trial_end=now()-interval '1 day' where owner_id='${owner}';`);
    expect(await reserve("expired-trial", "keywordSearches")).toMatchObject({ allowed: false });
  });
  it("applies subscription snapshots atomically, ignores duplicate events and rejects stale workers", async () => {
    await sql(`update public.billing_accounts set stripe_customer_id='cus_${owner}' where owner_id='${owner}';`);
    const lease = JSON.parse(await sql(`select public.claim_billing_operation('${owner}',false);`));
    const snapshot = { id: `sub_${owner}`, customer: `cus_${owner}`, plan: "starter", status: "active", periodStart: new Date(Date.now()-1000).toISOString(), periodEnd: new Date(Date.now()+86400000).toISOString(), paidThrough: new Date(Date.now()+86400000).toISOString(), trialStart: null, trialEnd: null, cancelAtPeriodEnd: false };
    const apply = (token: string, event: string, state = snapshot) => sql(`select public.apply_billing_snapshot('${owner}','${token}','${event}','invoice.paid',false,'${JSON.stringify(state)}'::jsonb);`);
    await expect(apply(randomUUID(), `evt_stale_${owner}`)).rejects.toThrow("Billing operation expired");
    expect(await apply(lease.token, `evt_${owner}`)).toBe("t");
    expect(await apply(lease.token, `evt_${owner}`, { ...snapshot, status: "past_due" })).toBe("f");
    expect(await sql(`select status from public.billing_accounts where owner_id='${owner}';`)).toBe("active");
    expect(await sql(`select count(*) from public.billing_stripe_events where event_id='evt_${owner}' and processed_at is not null;`)).toBe("1");
    await sql(`select public.release_billing_operation('${owner}','${lease.token}');`);
  });
  it("rejects a missing operation lease instead of accepting SQL null comparisons", async () => {
    const snapshot = { id: `sub_${owner}`, customer: `cus_${owner}`, plan: "premium", status: "active" };
    await expect(sql(`select public.apply_billing_snapshot('${owner}',null,'evt_null_${owner}','invoice.paid',false,'${JSON.stringify(snapshot)}'::jsonb);`)).rejects.toThrow("Billing operation expired");
    expect(await sql(`select plan from public.billing_accounts where owner_id='${owner}';`)).toBe("starter");
  });

  it("requires trial timestamps and never extends the original seven-day allowance", async () => {
    await sql(`update public.billing_accounts set trial_started_at=null,trial_end=null where owner_id='${owner}';`);
    const lease = JSON.parse(await sql(`select public.claim_billing_operation('${owner}',false);`));
    const start = new Date(Date.now()-86400000).toISOString();
    const end = new Date(Date.now()+30*86400000).toISOString();
    const snapshot = { id: `sub_${owner}`, customer: `cus_${owner}`, plan: "starter", status: "trialing", periodStart: start, periodEnd: end, trialEnd: end };
    const apply = (event: string, state: object) => sql(`select public.apply_billing_snapshot('${owner}','${lease.token}','${event}','customer.subscription.updated',false,'${JSON.stringify(state)}'::jsonb);`);
    await expect(apply(`evt_missing_trial_${owner}`, snapshot)).rejects.toThrow("Trial timestamps required");
    await apply(`evt_first_trial_${owner}`, { ...snapshot, trialStart: start });
    expect(await sql(`select trial_end=trial_started_at+interval '7 days' from public.billing_accounts where owner_id='${owner}';`)).toBe("t");
    await apply(`evt_repeat_trial_${owner}`, { ...snapshot, trialStart: new Date().toISOString() });
    expect(await sql(`select trial_started_at='${start}'::timestamptz and trial_end=trial_started_at+interval '7 days' from public.billing_accounts where owner_id='${owner}';`)).toBe("t");
    await sql(`select public.release_billing_operation('${owner}','${lease.token}');`);
  });

  it("binds an infographic to one reviewed plan and permits only one concurrent render", async () => {
    await sql(`update public.billing_accounts set plan='premium',status='active',period_start=now()-interval '1 day',period_end=now()+interval '20 days',paid_through=now()+interval '20 days' where owner_id='${owner}';`);
    const reservation = await reserve("infographic-bundle", "infographics");
    const digest = "a".repeat(64);
    await sql(`select public.bind_billing_artifact('${owner}','${reservation.id}','${digest}');`);
    await expect(sql(`select public.bind_billing_artifact('${owner}','${reservation.id}','${"b".repeat(64)}');`)).rejects.toThrow("Artifact already bound");
    expect(await sql(`select public.claim_billing_stage('${other}','${reservation.id}','infographic_render','${digest}');`)).toBe("f");
    expect(await sql(`select public.claim_billing_stage('${owner}','${reservation.id}','infographic_render','${"b".repeat(64)}');`)).toBe("f");
    const results = await Promise.all(Array.from({ length: 5 }, () => sql(`select public.claim_billing_stage('${owner}','${reservation.id}','infographic_render','${digest}');`)));
    expect(results.filter(value => value === "t")).toHaveLength(1);
    await expect(sql(`begin; set local role authenticated; select public.claim_billing_stage('${owner}','${reservation.id}','infographic_render','${digest}'); rollback;`)).rejects.toThrow("permission denied");
  });

  it("reserves only one scheduled check under concurrency and retains its receipt", async () => {
    const target = randomUUID();
    await sql(`insert into public.tracked_keywords(id,website_id,created_by,keyword,normalized_keyword) values('${target}','${website}','${owner}','tracking qa','tracking qa');`);
    const results = await Promise.all(Array.from({ length: 5 }, () => sql(`select public.reserve_rank_check('${target}');`).then(JSON.parse)));
    expect(results.filter(value => value.allowed)).toHaveLength(1);
    const winner = results.find(value => value.allowed);
    expect(await sql(`select meter from public.billing_usage where id='${winner.id}';`)).toBe("rankChecks");
    await sql(`delete from public.tracked_keywords where id='${target}';`);
    expect(await sql(`select count(*) from public.billing_usage where id='${winner.id}';`)).toBe("1");
    await expect(sql(`begin; set local role authenticated; select public.reserve_rank_check('${target}'); rollback;`)).rejects.toThrow("permission denied");
  });

  it("caps pooled targets and the trial's total refresh budget", async () => {
    // Seed above Starter capacity while Premium, then downgrade to preserve the legacy-target case.
    await sql(`update public.billing_accounts set plan='premium' where owner_id='${owner}';
      insert into public.tracked_keywords(website_id,created_by,keyword,normalized_keyword,created_at)
      select '${website}','${owner}','capacity '||n,'capacity '||n,now()-interval '1 hour'+n*interval '1 second' from generate_series(1,26) n;
      update public.billing_accounts set plan='starter' where owner_id='${owner}';`);
    const last = await sql(`select id from public.tracked_keywords where website_id='${website}' and normalized_keyword='capacity 26';`);
    expect(JSON.parse(await sql(`select public.reserve_rank_check('${last}');`))).toMatchObject({ allowed: false, reason: "target_limit" });
    await sql(`update public.billing_accounts set status='trialing',trial_started_at=now()-interval '1 day',trial_end=now()+interval '6 days' where owner_id='${owner}';
      insert into public.billing_usage(owner_id,website_id,request_key,meter,period_key,units,state)
      select '${owner}','${website}','trial-history-'||n,'rankChecks','trial:'||extract(epoch from trial_started_at)::text,1,'failed'
      from public.billing_accounts cross join generate_series(1,20) n where owner_id='${owner}';`);
    const first = await sql(`select id from public.tracked_keywords where website_id='${website}' and normalized_keyword='capacity 1';`);
    expect(JSON.parse(await sql(`select public.reserve_rank_check('${first}');`))).toMatchObject({ allowed: false, reason: "check_limit" });
  });

  it("selects eligible tracking work before the batch limit and excludes exhausted trials", async () => {
    // The earlier test exhausted this owner's trial. None of its targets may queue.
    expect(await sql(`select count(*) from public.billing_rank_candidates() row where row->>'website_id'='${website}';`)).toBe("0");
    const otherOrg = randomUUID(), otherSite = randomUUID();
    const rows = JSON.parse(await sql(`begin;
      update public.billing_accounts set status='active' where owner_id='${owner}';
      insert into public.organizations(id,name,owner_id) values('${otherOrg}','Unpaid QA','${other}');
      insert into public.websites(id,organization_id,url,normalized_domain,business_name) values('${otherSite}','${otherOrg}','https://unpaid.invalid','unpaid.invalid','Unpaid QA');
      insert into public.billing_accounts(owner_id,plan,status,period_start,period_end,paid_through) values('${other}','premium','active',now()-interval '1 day',now()+interval '20 days',now()+interval '20 days');
      insert into public.tracked_keywords(website_id,created_by,keyword,normalized_keyword,next_check_at)
        select '${otherSite}','${other}','unpaid '||n,'unpaid '||n,now()-interval '10 days' from generate_series(1,150) n;
      update public.billing_accounts set status='past_due' where owner_id='${other}';
      select coalesce(jsonb_agg(row),'[]') from public.billing_rank_candidates() row;
      rollback;`));
    expect(rows.filter((row: { website_id: string }) => row.website_id === website)).toHaveLength(25);
    expect(rows.some((row: { website_id: string }) => row.website_id === otherSite)).toBe(false);
    expect(rows.find((row: { website_id: string }) => row.website_id === website).websites.normalized_domain).toBe("billing.invalid");
    await expect(sql(`begin; set local role authenticated; select public.billing_rank_candidates(); rollback;`)).rejects.toThrow("permission denied");
  });

  it("grants one verified initial audit and never resets it by deleting a website", async () => {
    const org = randomUUID(), site = randomUUID(), replacement = randomUUID();
    const results = (await sql(`begin;
      insert into public.organizations(id,name,owner_id) values('${org}','Initial audit QA','${other}');
      insert into public.organization_members(organization_id,user_id,role) values('${org}','${other}','owner') on conflict do nothing;
      insert into public.websites(id,organization_id,url,normalized_domain,business_name) values('${site}','${org}','https://initial.invalid','initial.invalid','Initial QA');
      select public.begin_billed_audit('${site}','${other}','demo',false);
      update auth.users set email_confirmed_at=now() where id='${other}';
      select public.begin_billed_audit('${site}','${other}','demo',false);
      select public.begin_billed_audit('${site}','${other}','demo',false);
      delete from public.websites where id='${site}';
      insert into public.websites(id,organization_id,url,normalized_domain,business_name) values('${replacement}','${org}','https://replacement.invalid','replacement.invalid','Replacement QA');
      select public.begin_billed_audit('${replacement}','${other}','demo',false);
      rollback;`)).split("\n").map(JSON.parse);
    expect(results[0]).toMatchObject({ allowed: false, reason: "verification_required" });
    expect(results[1]).toMatchObject({ allowed: true, created: true, free: true });
    expect(results[2]).toMatchObject({ allowed: true, created: false, auditId: results[1].auditId });
    expect(results[3]).toMatchObject({ allowed: false, reason: "payment_required" });
    await expect(sql(`begin; set local role authenticated; select public.begin_billed_audit('${website}','${owner}','demo',false); rollback;`)).rejects.toThrow("permission denied");
  });

  it("reserves paid audits before creating work and rejects cross-owner access", async () => {
    const results = (await sql(`begin;
      update auth.users set email_confirmed_at=now() where id='${owner}';
      update public.billing_accounts set status='active',plan='starter',free_audit_claimed_at=now() where owner_id='${owner}';
      insert into public.organization_members(organization_id,user_id,role) values('${organization}','${owner}','owner') on conflict do nothing;
      do $$ begin perform public.set_billing_websites('${owner}',array['${website}']::uuid[]); end $$;
      select public.begin_billed_audit('${website}','${other}','demo',false);
      select public.begin_billed_audit('${website}','${owner}','demo',false);
      update public.audits set status='complete',completed_at=now() where website_id='${website}';
      select public.begin_billed_audit('${website}','${owner}','demo',false);
      rollback;`)).split("\n").map(JSON.parse);
    expect(results[0]).toMatchObject({ allowed: false, reason: "website_unavailable" });
    expect(results[1]).toMatchObject({ allowed: true, created: true, free: false });
    expect(results[1].usageId).toEqual(expect.any(String));
    expect(results[2]).toMatchObject({ allowed: false, reason: "limit_reached" });
  });

  it.each(["failed", "completed", "expired"])("bounds initial audit recovery after %s", async (outcome) => {
    const org = randomUUID(), site = randomUUID(), secondSite = randomUUID();
    const results = (await sql(`begin;
      update auth.users set email_confirmed_at=now() where id='${other}';
      insert into public.organizations(id,name,owner_id) values('${org}','Recovery QA','${other}');
      insert into public.organization_members(organization_id,user_id,role) values('${org}','${other}','owner') on conflict do nothing;
      insert into public.websites(id,organization_id,url,normalized_domain,business_name) values
        ('${site}','${org}','https://recovery.invalid','recovery.invalid','Recovery QA'),
        ('${secondSite}','${org}','https://second.invalid','second.invalid','Second QA');
      select public.begin_billed_audit('${site}','${other}','demo',false);
      update public.audits set status='failed',completed_at=now() where website_id='${site}';
      update public.billing_usage set state='${outcome === "completed" ? "completed" : "failed"}',finished_at=now() where owner_id='${other}';
      ${outcome === "expired" ? `update public.billing_accounts set free_audit_claimed_at=now()-interval '8 days' where owner_id='${other}';` : ""}
      select public.begin_billed_audit('${secondSite}','${other}','demo',false);
      select public.begin_billed_audit('${site}','${other}','demo',false);
      update public.audits set status='failed',completed_at=now() where website_id='${site}';
      update public.billing_usage set state='failed',finished_at=now() where owner_id='${other}' and state='reserved';
      select public.begin_billed_audit('${site}','${other}','demo',false);
      rollback;`)).split("\n").map(JSON.parse);
    expect(results[0]).toMatchObject({ allowed: true, free: true });
    expect(results[1]).toMatchObject({ allowed: false });
    expect(results[2]).toMatchObject(outcome === "failed" ? { allowed: true, free: true, created: true } : { allowed: false });
    expect(results[3]).toMatchObject({ allowed: false });
  });

  it("caps free onboarding discovery under concurrency and charges paid searches afterward", async () => {
    expect(JSON.parse(await sql(`select public.reserve_competitor_suggestions('${other}',false);`))).toMatchObject({ allowed: false, reason: "verification_required" });
    await sql(`update auth.users set email_confirmed_at=now() where id='${other}';`);
    const attempts = await Promise.all(Array.from({ length: 5 }, () => sql(`select public.reserve_competitor_suggestions('${other}',false);`).then(JSON.parse)));
    expect(attempts.filter(result => result.allowed)).toHaveLength(2);
    await sql(`update public.billing_usage set state='failed' where owner_id='${other}';`);
    expect(JSON.parse(await sql(`select public.reserve_competitor_suggestions('${other}',false);`))).toMatchObject({ allowed: false, reason: "payment_required" });
    await sql(`update public.billing_accounts set plan='starter',status='active',period_start=now()-interval '1 day',period_end=now()+interval '20 days',paid_through=now()+interval '20 days' where owner_id='${other}';`);
    const paid = JSON.parse(await sql(`select public.reserve_competitor_suggestions('${other}',false);`));
    expect(paid).toMatchObject({ allowed: true });
    expect(await sql(`select meter='keywordSearches' and period_key like 'paid:%' from public.billing_usage where id='${paid.id}';`)).toBe("t");
    await expect(sql(`begin; set local role authenticated; select public.reserve_competitor_suggestions('${owner}',false); rollback;`)).rejects.toThrow("permission denied");
  });

});
