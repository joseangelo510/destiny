import { describe, expect, it } from "vitest";
import {
  approvedCalendarDrafts,
  buildCalendarView,
  buildContentPipeline,
  buildDistributionView,
  buildProgressView,
  derivedCalendarCadence,
} from "./core-pages";

describe("Rebound redesign Slice 2", () => {
  it("places every content item in its highest honest state", () => {
    const pipeline = buildContentPipeline({
      approvedKeywords: [{ keyword: "kiln repair" }, { keyword: "glaze guide" }],
      drafts: [
        { id: "draft-1", keyword: "kiln repair", draft: { title: "Kiln repair", approved: true, generationStatus: "generated" } },
        { id: "draft-2", keyword: "glaze guide", draft: { title: "Glaze guide", approved: false, generationStatus: "generated" } },
      ],
      scheduleItems: [
        { id: "slot-1", keyword: "kiln repair", title: "Kiln repair", state: "published", scheduled_for: "2026-09-03T16:00:00Z" },
      ],
      receipts: [{
        articleKey: "audit-1:kiln repair",
        provider: "wordpress",
        publicationStatus: "verified_live",
        remotePermalink: "https://example.com/kiln-repair",
        verifiedLiveAt: "2026-09-03T17:00:00Z",
        verificationEvidence: { verified: true, httpStatus: 200, canonicalMatches: true, contentMatches: true, indexable: true },
      }],
    });

    expect(pipeline.columns.find((column) => column.state === "verified_live")?.items).toHaveLength(1);
    expect(pipeline.columns.find((column) => column.state === "draft")?.items[0]).toMatchObject({ id: "draft-2", moveLabel: "Review" });
    expect(pipeline.items.map((item) => item.keyword)).toEqual(["glaze guide", "kiln repair"]);
  });

  it("demotes an incomplete verified-live claim to published and waiting on proof", () => {
    const pipeline = buildContentPipeline({
      approvedKeywords: [],
      drafts: [],
      scheduleItems: [{ id: "slot-1", keyword: "thin proof", title: "Thin proof", state: "published", scheduled_for: "2026-09-03T16:00:00Z" }],
      receipts: [{ articleKey: "audit-1:thin proof", publicationStatus: "verified_live", remotePermalink: "https://example.com/thin-proof" }],
    });

    expect(pipeline.columns.find((column) => column.state === "verified_live")?.items).toHaveLength(0);
    expect(pipeline.columns.find((column) => column.state === "published")?.items[0]).toMatchObject({ keyword: "thin proof", evidenceKind: "reported" });
  });

  it("derives the calendar status and needs-you move from saved schedule items", () => {
    const view = buildCalendarView({
      month: "September 2026",
      items: [
        { id: "one", title: "Needs review", keyword: "review", scheduled_for: "2026-09-03T16:00:00Z", state: "needs_review", last_error: null },
        { id: "two", title: "Scheduled", keyword: "scheduled", scheduled_for: "2026-09-10T16:00:00Z", state: "scheduled", last_error: null },
        { id: "three", title: "Failed", keyword: "failed", scheduled_for: "2026-09-17T16:00:00Z", state: "failed", last_error: "CMS rejected the item" },
      ],
    });

    expect(view.needsYou).toMatchObject({ title: "Needs review", moveLabel: "Review" });
    expect(view.stats).toMatchObject({ needsUser: 1, scheduled: 1, stuck: 1 });
    expect(view.calendar.events).toHaveLength(3);
  });

  it("keeps only approved drafts from the current website available to Calendar", () => {
    const websiteId = "11111111-1111-4111-8111-111111111111";
    const drafts = approvedCalendarDrafts([
      { id: "approved", website_id: websiteId, keyword: "kiln repair", draft: { title: "Kiln repair guide", approved: true } },
      { id: "unapproved", website_id: websiteId, keyword: "glaze guide", draft: { title: "Glaze guide", approved: false } },
      { id: "other-website", website_id: "22222222-2222-4222-8222-222222222222", keyword: "other", draft: { title: "Other website draft", approved: true } },
    ], websiteId);

    expect(drafts).toEqual([{ id: "approved", keyword: "kiln repair", title: "Kiln repair guide" }]);
  });

  it("derives a read-only weekly cadence and stays honest when dates are insufficient", () => {
    expect(derivedCalendarCadence([
      { scheduled_for: "2026-08-27T16:00:00Z" },
      { scheduled_for: "2026-09-03T16:00:00Z" },
      { scheduled_for: "2026-09-10T16:00:00Z" },
    ], "America/Los_Angeles")).toMatchObject({ label: "Weekly", derived: true });
    expect(derivedCalendarCadence([], "America/Los_Angeles")).toEqual({
      label: "Not enough saved dates",
      detail: "Cadence will appear after at least two publishing dates are saved.",
      derived: true,
    });
  });

  it("uses existing opportunities and interlink evidence without inventing a touchpoint ledger", () => {
    const view = buildDistributionView({
      opportunities: [{ platform: "Quora", topic: "kiln repair", title: "How do I fix a kiln?", url: "https://www.quora.com/example", snippet: "A matched question", checkedAt: "2026-09-01T00:00:00Z" }],
      interlinks: [
        { id: "link-1", source_title: "Glaze basics", target_title: "Kiln repair", status: "verified", verified_at: "2026-09-01T00:00:00Z" },
        { id: "link-2", source_title: "Clay bodies", target_title: "Kiln repair", status: "reported", verified_at: null },
      ],
    });

    expect(view.rows).toHaveLength(3);
    expect(view.platformCounts).toEqual({ Quora: 1, Reddit: 0 });
    expect(view.rows[0]).toMatchObject({
      owner: "you",
      action: {
        platform: "Quora",
        url: "https://www.quora.com/example",
        hostname: "www.quora.com",
        copyText: "How do I fix a kiln?\nA matched question\nhttps://www.quora.com/example\nChecked 2026-09-01T00:00:00Z",
      },
    });
    expect(view.rows.find((row) => row.id === "link-1")).toMatchObject({ evidenceKind: "verified", moveLabel: "View evidence" });
    expect(view.needsYou).toMatchObject({ title: "How do I fix a kiln?", moveLabel: "Copy context & open Quora" });
  });

  it("keeps an unsafe saved opportunity visible but non-actionable", () => {
    const view = buildDistributionView({
      opportunities: [{ platform: "Quora", topic: "kiln repair", title: "Unsafe saved question", url: "https://quora.com.evil.com/example", snippet: "A matched question", checkedAt: "2026-09-01T00:00:00Z" }],
      interlinks: [],
    });

    expect(view.rows[0]).toMatchObject({ title: "Unsafe saved question", action: null, moveLabel: "Unavailable" });
    expect(view.needsYou).toBeNull();
    expect(view.platformCounts).toEqual({ Quora: 0, Reddit: 0 });
  });

  it("keeps completed work split between verified and user-reported evidence", () => {
    const view = buildProgressView({
      quests: [
        { id: "verified", title: "Publish the guide", description: "Done", action_path: "/content", status: "complete", verification_status: "verified", completed_at: "2026-08-31T12:00:00Z" },
        { id: "reported", title: "Add the links", description: "Done", action_path: "/internal-links", status: "complete", verification_status: "unverified", completed_at: "2026-08-30T12:00:00Z" },
        { id: "open", title: "Review the draft", description: "Waiting", action_path: "/content", status: "todo", verification_status: "unverified", completed_at: null },
      ],
      scheduleItems: [{ id: "scheduled", title: "Publish Thursday", keyword: "guide", state: "scheduled", scheduled_for: "2026-09-03T16:00:00Z" }],
      receipts: [{ articleKey: "audit-1:waiting page", publicationStatus: "published_unverified" }],
    });

    expect(view.done.map((item) => item.evidenceKind)).toEqual(["verified", "reported"]);
    expect(view.owners.you[0]).toMatchObject({ title: "Review the draft", moveLabel: "Open" });
    expect(view.owners.rebound[0]).toMatchObject({ title: "Publish Thursday" });
    expect(view.owners.google[0]).toMatchObject({ title: "Waiting page", evidenceKind: "reported" });
  });
});
