import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

if (process.env.QA_ISOLATION !== "1") throw new Error("Billing isolation requires disposable local infrastructure.");
const container = process.env.QA_SUPABASE_DB_CONTAINER ?? "supabase_db_destiny-isolation";
if (container !== "supabase_db_destiny-isolation") throw new Error("Unexpected billing test database.");
const owner = randomUUID(), other = randomUUID();
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
    values('${owner}','starter','active',now()-interval '1 day',now()+interval '20 days',now()+interval '20 days');`);
});
afterAll(async () => {
  await sql(`delete from public.billing_usage where owner_id='${owner}'; delete from public.billing_accounts where owner_id='${owner}'; delete from auth.users where id in ('${owner}','${other}');`);
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
  it("blocks unpaid workers and expired trials in the database, without trusting the web UI", async () => {
    await sql(`update public.billing_accounts set status='past_due' where owner_id='${owner}';`);
    expect(await reserve("unpaid-worker", "keywordSearches")).toMatchObject({ allowed: false, reason: "payment_required" });
    await sql(`update public.billing_accounts set status='trialing', trial_started_at=now()-interval '8 days',trial_end=now()-interval '1 day' where owner_id='${owner}';`);
    expect(await reserve("expired-trial", "keywordSearches")).toMatchObject({ allowed: false });
  });
});
