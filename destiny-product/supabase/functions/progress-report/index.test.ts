import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(process.cwd(), "supabase", "functions", "progress-report", "index.ts");

function compact(source: string) {
  return source.replace(/\s+/g, " ");
}

describe("Progress report Edge Function boundary", () => {
  it("authorizes the selected website before reading report data or invoking the provider", async () => {
    const source = compact(await readFile(sourcePath, "utf8"));
    const claims = source.indexOf("context.userClaims?.id");
    const website = source.indexOf('context.supabase .from("websites")');
    const denial = source.indexOf("You do not have access to that website.");
    const quests = source.indexOf('.from("quests")', denial);
    const send = source.indexOf("sendProgressReport(", denial);

    expect(claims).toBeGreaterThanOrEqual(0);
    expect(website).toBeGreaterThan(claims);
    expect(denial).toBeGreaterThan(website);
    expect(quests).toBeGreaterThan(denial);
    expect(send).toBeGreaterThan(quests);
  });

  it("never accepts a client-supplied recipient or user identity", async () => {
    const source = await readFile(sourcePath, "utf8");
    expect(source).toContain("notificationRecipient(website.notification_email, profile?.contact_email)");
    expect(source).not.toMatch(/body\.(?:recipient|email|userId|user_id)/);
  });
});
