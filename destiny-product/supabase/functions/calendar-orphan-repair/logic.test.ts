import { describe, expect, it } from "vitest";
import {
  confirmationDigest,
  confirmationIsValid,
  selectCalendarRepair,
  verifyRepairPermalink,
  type CalendarRepairInput,
} from "./logic";

const websiteId = "99a7af37-6588-4b97-a848-8877760182a9";
const auditId = "c9699c3f-0f6f-477c-99dd-a42f7e165e05";
const itemId = "287eedbf-33b5-4fb7-9bfc-b2d461caa676";
const transferId = "558f3d60-1f46-41c6-b745-d7675d72fb7e";
const articleKey = `${auditId}:background check fcra compliance`;
const title = "FCRA-Compliant Background Checks: Employer Guide";
const permalink = "https://clearcheck.app/2026/08/fcra-compliant-background-checks-employer-guide/";
const confirmationSecret = "local-test-secret-that-never-leaves-vitest";

function fixture(overrides: Partial<CalendarRepairInput> = {}): CalendarRepairInput {
  return {
    websiteId,
    requestedItemId: itemId,
    items: [{ id: itemId, websiteId, auditId, keyword: "background check fcra compliance", normalizedKeyword: "background check fcra compliance", title, state: "needs_review", articleKey: null, remoteId: null, remotePermalink: null }],
    preferences: [{ id: "approved-preference", websiteId, auditId, normalizedKeyword: "background check fcra compliance", decision: "approved" }],
    drafts: [{ id: "6851e267-a7fb-40aa-9073-a29626dfc9cc", websiteId, auditId, keyword: "background check fcra compliance", title }],
    transfers: [{ id: transferId, websiteId, articleKey, publicationStatus: "verified_live", remoteId: "20208951", remotePermalink: permalink }],
    ...overrides,
  };
}

describe("orphaned CMS/calendar repair", () => {
  it("selects one exact website, audit, keyword, title, and transfer-key match", () => {
    expect(selectCalendarRepair(fixture())).toMatchObject({
      status: "ready",
      match: { itemId, transferId, articleKey, remoteId: "20208951", remotePermalink: permalink },
    });
  });

  it("refuses two exact transfer candidates", () => {
    const input = fixture();
    expect(selectCalendarRepair({ ...input, transfers: [...input.transfers, { ...input.transfers[0], id: "second-transfer" }] }))
      .toMatchObject({ status: "ambiguous", reason: "multiple_transfers" });
  });

  it("refuses two exact calendar-row candidates", () => {
    const input = fixture();
    expect(selectCalendarRepair({ ...input, items: [...input.items, { ...input.items[0], id: "second-item" }] }))
      .toMatchObject({ status: "ambiguous", reason: "multiple_items" });
  });

  it("makes no change when no verified transfer exists", () => {
    expect(selectCalendarRepair(fixture({ transfers: [] }))).toMatchObject({ status: "no_match", reason: "transfer_not_found" });
  });

  it("rejects a keyword that has no exact approved preference for the originating audit", () => {
    expect(selectCalendarRepair(fixture({ preferences: [] }))).toMatchObject({ status: "no_match", reason: "approved_keyword_not_found" });
  });

  it("rejects a similar title when the stored approved title is not exact", () => {
    const input = fixture();
    expect(selectCalendarRepair({ ...input, drafts: [{ ...input.drafts[0], title: "The FCRA-Compliant Background Check Employer Guide" }] }))
      .toMatchObject({ status: "no_match", reason: "draft_not_found" });
  });

  it("rejects missing, malformed, and non-2xx public permalinks", () => {
    expect(verifyRepairPermalink("", 200)).toBe(false);
    expect(verifyRepairPermalink("not-a-url", 200)).toBe(false);
    expect(verifyRepairPermalink(permalink, 404)).toBe(false);
    expect(verifyRepairPermalink(permalink, 200)).toBe(true);
  });

  it("reports an already repaired row as an idempotent no-op", () => {
    const input = fixture();
    expect(selectCalendarRepair({
      ...input,
      items: [{ ...input.items[0], state: "published", articleKey, remoteId: "20208951", remotePermalink: permalink }],
    })).toMatchObject({ status: "already_repaired", match: { itemId, transferId } });
  });

  it("requires the exact user-bound, unexpired dry-run confirmation", async () => {
    const result = selectCalendarRepair(fixture());
    if (result.status !== "ready") throw new Error("Expected a ready repair fixture.");
    const checkedAt = "2026-08-27T23:20:00.000Z";
    const userId = "11111111-1111-4111-8111-111111111111";
    const token = await confirmationDigest(result.match, userId, checkedAt, confirmationSecret);
    expect(await confirmationIsValid(result.match, userId, checkedAt, token, "2026-08-27T23:29:59.000Z", confirmationSecret)).toBe(true);
    expect(await confirmationIsValid(result.match, userId, checkedAt, "", "2026-08-27T23:29:59.000Z", confirmationSecret)).toBe(false);
    expect(await confirmationIsValid(result.match, "other-user", checkedAt, token, "2026-08-27T23:29:59.000Z", confirmationSecret)).toBe(false);
    expect(await confirmationIsValid(result.match, userId, checkedAt, token, "2026-08-27T23:29:59.000Z", "wrong-secret")).toBe(false);
    expect(await confirmationIsValid(result.match, userId, checkedAt, token, "2026-08-27T23:35:01.000Z", confirmationSecret)).toBe(false);
  });
});
