import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PublishingPlanManager } from "./publishing-plan-manager";
import { needsWordPressScheduleVerification, type PublishingPlanRecord, type PublishingScheduleItemRecord } from "@/lib/content/publishing-plan";

const scheduled = {
  id: "item-1",
  plan_id: "plan-1",
  position: 1,
  keyword: "ban the box laws",
  title: "Ban the Box Laws: A Practical Employer Guide",
  content_type: "Blog guide",
  scheduled_for: "2026-08-21T16:00:00.000Z",
  state: "scheduled",
  review_recommended: false,
  remote_id: "20208955",
  remote_edit_url: "https://clearcheck.app/wp-admin/post.php?post=20208955&action=edit",
  remote_permalink: null,
  last_error: null,
} as PublishingScheduleItemRecord;

describe("past-due WordPress schedule reconciliation", () => {
  it("only asks WordPress to verify scheduled article slots whose publication time has passed", () => {
    expect(needsWordPressScheduleVerification(scheduled, "wordpress", true, "2026-08-27T16:00:00.000Z")).toBe(true);
    expect(needsWordPressScheduleVerification({ ...scheduled, scheduled_for: "2026-09-21T16:00:00.000Z" }, "wordpress", true, "2026-08-27T16:00:00.000Z")).toBe(false);
    expect(needsWordPressScheduleVerification({ ...scheduled, state: "needs_review" }, "wordpress", true, "2026-08-27T16:00:00.000Z")).toBe(false);
    expect(needsWordPressScheduleVerification({ ...scheduled, content_type: "LinkedIn post" }, "wordpress", true, "2026-08-27T16:00:00.000Z")).toBe(false);
    expect(needsWordPressScheduleVerification(scheduled, "webflow", false, "2026-08-27T16:00:00.000Z")).toBe(false);
  });

  it("labels an overdue scheduled post honestly and offers a verification action", () => {
    const plan: PublishingPlanRecord = {
      id: "plan-1",
      mode: "automatic",
      status: "active",
      timezone: "America/Los_Angeles",
      holdback_hours: 72,
      start_date: "2026-08-21",
      end_date: "2026-09-18",
      confirmed_post_count: 1,
      automatic_confirmed_at: "2026-08-17T12:00:00.000Z",
    };
    const html = renderToStaticMarkup(<PublishingPlanManager
      approvedKeywordCount={1}
      auditId="33333333-3333-4333-8333-333333333333"
      calendar={[{ focusKeyword: scheduled.keyword, title: scheduled.title, contentType: scheduled.content_type }]}
      initialItems={[scheduled]}
      initialPlan={plan}
      now="2026-08-27T16:00:00.000Z"
      websiteId="11111111-1111-4111-8111-111111111111"
      websitePlatform="wordpress"
      wordpressConnected
    />);

    expect(html).toContain("Scheduled — past due, not yet verified");
    expect(html).toContain("Refresh WordPress status");
  });
});
