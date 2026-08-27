import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(process.cwd(), "supabase", "functions", "calendar-orphan-repair", "index.ts");

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

describe("calendar orphan repair Edge Function boundary", () => {
  it("authorizes the website before reading configuration or service-role data", async () => {
    const source = compact(await readFile(sourcePath, "utf8"));
    const claims = source.indexOf("context.userClaims?.id");
    const website = source.indexOf('context.supabase.from("websites")');
    const denial = source.indexOf("You do not have access to that website.");
    const environment = source.indexOf('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    const privileged = source.indexOf('context.supabaseAdmin .from("publishing_schedule_items")');

    expect(claims).toBeGreaterThanOrEqual(0);
    expect(website).toBeGreaterThan(claims);
    expect(denial).toBeGreaterThan(website);
    expect(environment).toBeGreaterThan(denial);
    expect(privileged).toBeGreaterThan(environment);
  });

  it("requires dry-run evidence and exact null preconditions before one row update", async () => {
    const source = compact(await readFile(sourcePath, "utf8"));
    const confirmation = source.indexOf("confirmationIsValid(");
    const publicProof = source.indexOf("verifyRepairPermalink(");
    const update = source.indexOf('.from("publishing_schedule_items") .update({');
    const exactItem = source.indexOf('.eq("id", result.match.itemId)', update);
    const exactAudit = source.indexOf('.eq("audit_id", result.match.auditId)', update);
    const exactKeyword = source.indexOf('.eq("normalized_keyword", result.match.normalizedKeyword)', update);
    const exactTitle = source.indexOf('.eq("title", result.match.title)', update);
    const orphanState = source.indexOf('.eq("state", "needs_review")', update);
    const nullArticle = source.indexOf('.is("article_key", null)', update);
    const nullRemoteId = source.indexOf('.is("remote_id", null)', update);
    const nullPermalink = source.indexOf('.is("remote_permalink", null)', update);

    expect(publicProof).toBeGreaterThanOrEqual(0);
    expect(confirmation).toBeGreaterThan(publicProof);
    expect(update).toBeGreaterThan(confirmation);
    for (const position of [exactItem, exactAudit, exactKeyword, exactTitle, orphanState, nullArticle, nullRemoteId, nullPermalink]) {
      expect(position).toBeGreaterThan(update);
    }
  });

  it("uses an HMAC secret and never accepts a client-supplied user identity", async () => {
    const source = await readFile(sourcePath, "utf8");
    expect(source).toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(source).toContain("confirmationDigest(result.match, userId, checkedAt, confirmationSecret)");
    expect(source).not.toMatch(/body\.(?:userId|user_id)/);
  });
});
