import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
if (process.env.QA_ISOLATION !== "1") throw new Error("Use disposable isolation infrastructure.");
const owner = randomUUID(), member = randomUUID(), organization = randomUUID(), siteA = randomUUID(), siteB = randomUUID();
function sql(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", "supabase_db_destiny-isolation", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-Atq"]);
    let output = "", error = "";
    child.stdout.on("data", chunk => output += chunk);
    child.stderr.on("data", chunk => error += chunk);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
    child.stdin.end(input);
  });
}
const identity = (id: string) => `set local role authenticated; select set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated"}',true);`;
const insert = (keyword: string, site = siteA) => `insert into public.tracked_keywords(website_id,created_by,keyword,normalized_keyword) values('${site}','${member}','${keyword}','${keyword}') returning status;`;
beforeAll(async () => {
  await sql(`insert into auth.users(id,email) values('${owner}','${owner}@billing.invalid'),('${member}','${member}@billing.invalid');
    insert into public.organizations(id,name,owner_id) values('${organization}','Activation fixture','${owner}');
    insert into public.organization_members(organization_id,user_id,role) values('${organization}','${owner}','owner'),('${organization}','${member}','member');
    insert into public.websites(id,organization_id,url,normalized_domain,business_name) values('${siteA}','${organization}','https://a.example','a.example','A'),('${siteB}','${organization}','https://b.example','b.example','B');
    insert into public.billing_accounts(owner_id,plan,status,period_start,period_end,paid_through) values('${owner}','starter','active',now()-interval '1 day',now()+interval '20 days',now()+interval '20 days');`);
});
afterAll(async () => {
  await sql(`delete from public.billing_accounts where owner_id='${owner}'; delete from public.organizations where id='${organization}'; delete from auth.users where id in ('${owner}','${member}');`);
});
describe.sequential("tracked activation billing capacity", () => {
  it("serializes direct authenticated inserts across owner sites and saves excess paused", async () => {
    const rows = await Promise.all(Array.from({ length: 30 }, (_, index) => sql(`begin; ${identity(member)} ${insert(`keyword ${index}`, index % 2 ? siteA : siteB)} commit;`).then(result => result.split("\n").at(-1))));
    expect(rows.filter(status => status === "pending")).toHaveLength(25);
    expect(rows.filter(status => status === "paused")).toHaveLength(5);
    expect(await sql(`select count(*) from public.tracked_keywords where website_id in ('${siteA}','${siteB}');`)).toBe("30");
  });
  it("keeps unpaid activation paused, permits free saved changes and allows later explicit resume", async () => {
    await sql(`update public.billing_accounts set status='past_due' where owner_id='${owner}';`);
    expect((await sql(`begin; ${identity(member)} ${insert("unpaid")} commit;`)).split("\n").at(-1)).toBe("paused");
    await sql(`begin; ${identity(member)} update public.tracked_keywords set status='paused' where website_id in ('${siteA}','${siteB}'); commit;`);
    expect((await sql(`begin; ${identity(member)} update public.tracked_keywords set status='pending' where normalized_keyword='unpaid' and website_id='${siteA}' returning status; commit;`)).split("\n").at(-1)).toBe("paused");
    await sql(`update public.billing_accounts set status='active' where owner_id='${owner}';`);
    expect((await sql(`begin; ${identity(member)} update public.tracked_keywords set status='pending' where normalized_keyword='unpaid' and website_id='${siteA}' returning status; commit;`)).split("\n").at(-1)).toBe("pending");
  });
  it("caps a trial at ten and prevents outsider activation or direct private execution", async () => {
    await sql(`update public.tracked_keywords set status='paused' where website_id in ('${siteA}','${siteB}'); update public.billing_accounts set status='trialing',trial_started_at=now()-interval '1 day',trial_end=now()+interval '6 days' where owner_id='${owner}';`);
    await sql(`begin; ${identity(member)} update public.tracked_keywords set status='pending' where website_id in ('${siteA}','${siteB}'); commit;`);
    expect(await sql(`select count(*) from public.tracked_keywords where website_id in ('${siteA}','${siteB}') and status<>'paused';`)).toBe("10");
    await expect(sql(`begin; ${identity(randomUUID())} ${insert("outsider")} rollback;`)).rejects.toThrow();
    expect(await sql(`select has_function_privilege('authenticated','private.enforce_tracking_capacity()','EXECUTE');`)).toBe("f");
  });
});
