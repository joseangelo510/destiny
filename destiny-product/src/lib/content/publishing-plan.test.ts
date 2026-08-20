import { describe, expect, it } from "vitest";
import { buildWeeklySchedule, calendarLocalDateTimeAsUtc, canScheduleArticle, editorialContentChannel, isArticleCalendarItem, publishingCalendarState, publishingDeliveryMode, publishingItemKey, reconcilePublishingItems, stateForMissedSchedule, unapprovedCalendarKeywords, validatePublishingPlan, wordpressRemoteIdFromEditUrl, wordpressScheduleDate, type PublishingScheduleItemRecord } from "./publishing-plan";

describe("publishing plans", () => {
  it("keeps social calendar entries out of the CMS article scheduler", () => {
    expect(editorialContentChannel("Blog guide")).toBe("article");
    expect(editorialContentChannel("LinkedIn post")).toBe("linkedin");
    expect(editorialContentChannel("X post")).toBe("x");
    expect(editorialContentChannel("Approved draft")).toBe("approved_draft");
    expect(isArticleCalendarItem({ content_type: "Blog guide", position: 3 }, 12)).toBe(true);
    expect(isArticleCalendarItem({ content_type: "LinkedIn post", position: 13 }, 12)).toBe(false);
    expect(isArticleCalendarItem({ content_type: "Blog guide", position: 13 }, 12)).toBe(false);
  });
  it("keeps CMS delivery capability explicit", () => {
    expect(publishingDeliveryMode("wordpress", ["wordpress"])).toBe("direct_wordpress");
    expect(publishingDeliveryMode("webflow", ["webflow"])).toBe("manual_webflow");
    expect(publishingDeliveryMode("wix", [])).toBe("manual_wix");
    expect(publishingDeliveryMode("squarespace", [])).toBe("unavailable");
    expect(publishingDeliveryMode("wix", ["wordpress"])).toBe("direct_wordpress");
  });
  it("requires a deliberate mode and explicit automatic confirmation", () => {
    expect(() => validatePublishingPlan({ mode: "automatic", startDate: "2026-08-25", timezone: "America/Los_Angeles", postCount: 12 })).toThrow(/confirm/i);
    expect(validatePublishingPlan({ mode: "automatic", startDate: "2026-08-25", timezone: "America/Los_Angeles", postCount: 12, automaticConfirmed: true })).toMatchObject({ mode: "automatic" });
  });

  it("builds weekly slots at 9 a.m. in the selected timezone, including DST", () => {
    const dates = buildWeeklySchedule("2026-08-25", 12, "America/Los_Angeles");
    expect(dates).toHaveLength(12);
    expect(dates[0]).toBe("2026-08-25T16:00:00.000Z");
    expect(dates[11]).toBe("2026-11-10T17:00:00.000Z");
    expect(buildWeeklySchedule("2026-08-25", 1, "America/New_York")[0]).toBe("2026-08-25T13:00:00.000Z");
    expect(calendarLocalDateTimeAsUtc("2026-08-25T09:30", "America/Los_Angeles")).toBe("2026-08-25T16:30:00.000Z");
    expect(calendarLocalDateTimeAsUtc("2026-11-10T09:30", "America/Los_Angeles")).toBe("2026-11-10T17:30:00.000Z");
  });

  it("rejects calendar topics that were not explicitly approved for the website", () => {
    const calendar = [{ keyword: "approved topic" }, { keyword: "Unapproved Topic" }, { keyword: "approved   topic" }];
    expect(unapprovedCalendarKeywords(calendar, ["approved topic"])).toEqual(["Unapproved Topic"]);
  });

  it("blocks scheduling until generation, quality, connection, and holdback checks pass", () => {
    expect(canScheduleArticle({ generated: false, qualityIssues: 0, connected: true, scheduledFor: "2026-08-25T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).reason).toMatch(/generate/i);
    expect(canScheduleArticle({ generated: true, qualityIssues: 1, connected: true, scheduledFor: "2026-08-25T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).reason).toMatch(/review/i);
    expect(canScheduleArticle({ generated: true, qualityIssues: 0, connected: false, scheduledFor: "2026-08-25T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).reason).toMatch(/WordPress/i);
    expect(canScheduleArticle({ generated: true, qualityIssues: 0, connected: true, scheduledFor: "2026-08-18T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).reason).toMatch(/72 hours/i);
    expect(canScheduleArticle({ generated: true, qualityIssues: 0, connected: true, scheduledFor: "2026-08-25T16:00:00.000Z", now: "2026-08-16T16:00:00.000Z" }).allowed).toBe(true);
  });

  it("creates stable idempotency keys and never silently publishes a missed slot late", () => {
    expect(publishingItemKey("plan-1", "  College   Counselor Pricing ")).toBe("plan-1:1:college counselor pricing");
    expect(stateForMissedSchedule("2026-08-15T16:00:00.000Z", "2026-08-16T16:00:00.000Z")).toBe("needs_review");
    expect(wordpressScheduleDate("2026-08-25T16:00:00.000Z", "2026-08-16T16:00:00.000Z")).toBe("2026-08-25T16:00:00");
  });

  it("keeps one article identity per plan slot even when a focus keyword repeats", () => {
    expect(publishingItemKey("plan-1", "background check compliance", 1)).not.toBe(
      publishingItemKey("plan-1", "background check compliance", 4),
    );
  });

  it("reconciles the live queue returned by a scheduling run", () => {
    const current = [{ id: "item-1", state: "needs_review" }] as PublishingScheduleItemRecord[];
    const refreshed = [{ id: "item-1", state: "scheduled" }] as PublishingScheduleItemRecord[];
    expect(reconcilePublishingItems(current, refreshed)[0].state).toBe("scheduled");
    expect(reconcilePublishingItems(current, undefined)[0].state).toBe("needs_review");
  });

  it("only presents scheduled and published states when CMS proof exists", () => {
    const item = {
      id: "item-1",
      state: "scheduled",
      scheduled_for: "2026-08-21T16:00:00.000Z",
      remote_id: null,
      remote_permalink: null,
    } as PublishingScheduleItemRecord;
    expect(publishingCalendarState(item, "wordpress")).toBe("planned");
    expect(publishingCalendarState({ ...item, remote_id: "20208955" }, "wordpress")).toBe("scheduled");
    expect(publishingCalendarState({ ...item, state: "published", remote_id: "20208955" }, "wordpress")).toBe("planned");
    expect(publishingCalendarState({ ...item, state: "published", remote_id: "20208955", remote_permalink: "https://example.com/post" }, "wordpress")).toBe("published");
  });

  it("keeps Wix publishing visibly manual and extracts WordPress proof IDs", () => {
    const item = {
      id: "item-1",
      state: "scheduled",
      remote_id: "20208955",
      remote_permalink: null,
    } as PublishingScheduleItemRecord;
    expect(publishingCalendarState(item, "wix")).toBe("manual");
    expect(wordpressRemoteIdFromEditUrl("https://clearcheck.app/wp-admin/post.php?post=20208955&action=edit")).toBe("20208955");
    expect(wordpressRemoteIdFromEditUrl("https://clearcheck.app/wp-admin/edit.php")).toBeNull();
  });
});
