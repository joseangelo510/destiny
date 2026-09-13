import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
if (process.env.QA_ISOLATION !== "1") throw new Error("Use disposable isolation infrastructure.");
const managedTable = "billing_managed_websites";
const owner = randomUUID(), member = randomUUID(), organization = randomUUID();
const sites = Array.from({ length: 12 }, () => randomUUID());
function sql(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", "supabase_db_destiny-isolation", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-Atq"]);
    let output = "", error = "";
    child.stdout.on("data", chunk => output += chunk); child.stderr.on("data", chunk => error += chunk);
    child.on("error", reject); child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error))); child.stdin.end(input);
  });
}
const array = (values: string[]) => `array[${values.map(value => `'${value}'`).join(",")}]::uuid[]`;
const choose = (values: string[]) => sql(`select public.set_billing_websites('${owner}',${array(values)});`).then(JSON.parse);
beforeAll(async () => {
  await sql(`insert into auth.users(id,email) values('${owner}','${owner}@billing.invalid'),('${member}','${member}@billing.invalid');
    insert into public.organizations(id,name,owner_id) values('${organization}','Managed fixture','${owner}');
    insert into public.organization_members(organization_id,user_id,role) values('${organization}','${owner}','owner'),('${organization}','${member}','member');
    insert into public.websites(id,organization_id,url,normalized_domain,business_name) values ${sites.map((id, i) => `('${id}','${organization}','https://site${i}.example','site${i}.example','Site ${i}')`).join(",")};
    insert into public.billing_accounts(owner_id,plan,status,period_start,period_end,paid_through) values('${owner}','growth','active',now()-interval '1 day',now()+interval '20 days',now()+interval '20 days');`);
});
afterAll(async () => {
  await sql(`delete from public.billing_usage where owner_id='${owner}'; delete from public.organizations where id='${organization}'; delete from public.billing_accounts where owner_id='${owner}'; delete from auth.users where id in ('${owner}','${member}');`);
});
describe.sequential("managed website selection", () => {
  it("preserves twelve saved sites while selecting only the paid allowance", async () => {
    const result = await choose(sites.slice(0, 3));
    expect(result.capacity).toBe(3); expect(result.selected).toHaveLength(3); expect(result.websites).toHaveLength(12);
    await expect(choose(sites.slice(0, 4))).rejects.toThrow("Managed website limit exceeded");
    await expect(sql(`select public.set_billing_websites('${member}',${array([sites[0]])});`)).rejects.toThrow("Website ownership required");
    await expect(choose([randomUUID()])).rejects.toThrow("Website ownership required");
  });
  it("serializes replacement selections and requires a new choice after downgrade", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => choose(sites.slice(i, i+3))));
    expect(results.every(result => result.selected.length === 3)).toBe(true);
    await sql(`update public.billing_accounts set plan='premium' where owner_id='${owner}';`);
    expect((await choose(sites.slice(0, 10))).selected).toHaveLength(10);
    await sql(`update public.billing_accounts set plan='starter' where owner_id='${owner}';`);
    expect(await sql(`select public.is_billing_website_managed('${owner}','${sites[0]}');`)).toBe("f");
    expect((await sql(`select count(*) from public.billing_managed_websites where owner_id='${owner}';`))).toBe("10");
    expect((await choose([sites[2]])).selected).toEqual([sites[2]]);
    expect(await sql(`select public.is_billing_website_managed('${owner}','${sites[2]}');`)).toBe("t");
    expect((await choose([])).websites).toHaveLength(12);
  });
  it("blocks new credits on unselected sites while preserving settlement and unscoped research", async () => {
    await sql(`update public.billing_accounts set plan='growth',status='active' where owner_id='${owner}';`);
    await choose([sites[0]]);
    const reserve = (site: string | null, key: string) => sql(`select public.reserve_billing_usage('${owner}',${site ? `'${site}'` : "null"},'${key}','articles',1);`).then(JSON.parse);
    expect(await reserve(sites[1], randomUUID())).toMatchObject({ allowed: false, reason: "managed_website_required" });
    const started = await reserve(sites[0], randomUUID());
    expect(started.allowed).toBe(true);
    await choose([]);
    expect(await reserve(sites[0], randomUUID())).toMatchObject({ allowed: false, reason: "managed_website_required" });
    await sql(`select public.finish_billing_usage('${started.id}',true,null);`);
    expect(await sql(`select state from public.billing_usage where id='${started.id}';`)).toBe("completed");
    expect(await reserve(null, randomUUID())).toMatchObject({ allowed: true });
    await sql(`delete from public.billing_usage where owner_id='${owner}';`);
  });
  it("filters unmanaged tracking before queue limits and keeps new unmanaged targets paused", async () => {
    await sql(`update public.billing_accounts set plan='premium',status='active' where owner_id='${owner}';`);
    await choose([sites[0]]);
    await sql(`insert into public.tracked_keywords(website_id,created_by,keyword,normalized_keyword,created_at,next_check_at)
      select '${sites[0]}','${owner}','old '||n,'old '||n,now()-interval '2 days',now()-interval '2 days' from generate_series(1,150) n;`);
    await choose([sites[1]]);
    await sql(`update public.billing_accounts set plan='starter' where owner_id='${owner}';
      insert into public.tracked_keywords(website_id,created_by,keyword,normalized_keyword) values('${sites[1]}','${owner}','selected','selected'),('${sites[0]}','${owner}','unselected','unselected');`);
    expect(await sql(`select status from public.tracked_keywords where website_id='${sites[0]}' and keyword='unselected';`)).toBe("paused");
    const target = await sql(`select id from public.tracked_keywords where website_id='${sites[1]}' and keyword='selected';`);
    expect(await sql(`select status from public.tracked_keywords where id='${target}';`)).toBe("pending");
    expect(await sql(`select count(*) from public.billing_rank_candidates() row where row->>'website_id'='${sites[0]}';`)).toBe("0");
    expect(await sql(`select count(*) from public.billing_rank_candidates() row where row->>'id'='${target}';`)).toBe("1");
    const old = await sql(`select id from public.tracked_keywords where website_id='${sites[0]}' and keyword='old 1';`);
    expect(JSON.parse(await sql(`select public.reserve_rank_check('${old}');`))).toMatchObject({ allowed: false, reason: "managed_website_required" });
    expect(JSON.parse(await sql(`select public.reserve_rank_check('${target}');`))).toMatchObject({ allowed: true });
    expect(await sql(`select count(*) from public.tracked_keywords where website_id='${sites[0]}';`)).toBe("151");
  });
  it("filters unpaid and unselected digests before the batch limit without altering preferences", async () => {
    await sql(`update public.billing_accounts set status='active',plan='starter' where owner_id='${owner}';`);
    await choose([sites[0]]);
    const results = await sql(`begin;
      insert into public.websites(organization_id,url,normalized_domain,business_name)
        select '${organization}','https://digest'||n||'.example','digest'||n||'.example','Digest '||n from generate_series(1,60) n;
      insert into public.notification_preferences(website_id,organization_id,next_digest_at)
        select id,organization_id,now()-interval '3 days' from public.websites where organization_id='${organization}'
        on conflict(website_id) do update set next_digest_at=excluded.next_digest_at;
      update public.notification_preferences set next_digest_at=now()-interval '1 day' where website_id='${sites[0]}';
      select count(*) from public.billing_digest_candidates(null) r where r->>'website_id'='${sites[0]}';
      select count(*) from public.billing_digest_candidates('${sites[1]}');
      update public.billing_accounts set status='past_due' where owner_id='${owner}';
      select count(*) from public.billing_digest_candidates('${sites[0]}');
      select count(*) from public.notification_preferences where organization_id='${organization}';
      rollback;`);
    expect(results.split("\n")).toEqual(["1", "0", "0", "72"]);
    await expect(sql(`begin; set local role authenticated; select public.billing_digest_candidates(null); rollback;`)).rejects.toThrow("permission denied");
  });
  it("keeps owner selections private and prevents browser mutation or RPC execution", async () => {
    for (const who of [owner, member]) {
      const identity = `select set_config('request.jwt.claims','{"sub":"${who}","role":"authenticated"}',true);`;
      await choose([sites[0]]);
      const rows = await sql(`begin; set local role authenticated; ${identity} select count(*) from public.${managedTable}; rollback;`);
      expect(rows.split("\n").at(-1)).toBe(who === owner ? "1" : "0");
      await expect(sql(`begin; set local role authenticated; ${identity} select public.set_billing_websites('${owner}',${array([])}); rollback;`)).rejects.toThrow("permission denied");
    }
    await expect(sql(`begin; set local role authenticated; delete from public.billing_managed_websites; rollback;`)).rejects.toThrow("permission denied");
    await sql(`update public.billing_accounts set status='trialing',trial_started_at=now(),trial_end=now()+interval '7 days' where owner_id='${owner}';`);
    expect((await choose([sites[1]])).capacity).toBe(1);
  });
});
