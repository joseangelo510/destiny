import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { PublishingPlanManager } from "./publishing-plan-manager";
import type { PublishingPlanRecord, PublishingScheduleItemRecord } from "@/lib/content/publishing-plan";

const calendar = [{ focusKeyword: "commercial junk removal", title: "Commercial Junk Removal Guide", contentType: "Blog guide" }];

function render(options: { approved?: number; wordpress?: boolean; platform?: string | null } = {}) {
  return renderToStaticMarkup(<PublishingPlanManager
    approvedKeywordCount={options.approved ?? 0}
    auditId="11111111-1111-4111-8111-111111111111"
    calendar={calendar}
    initialItems={[]}
    initialPlan={null}
    websiteId="22222222-2222-4222-8222-222222222222"
    websitePlatform={options.platform ?? null}
    wordpressConnected={options.wordpress ?? false}
  />);
}

describe("PublishingPlanManager readiness", () => {
  it("does not offer a schedule built from unapproved suggestions", () => {
    const html = render({ wordpress: true });
    expect(html).toContain("Approve topics before scheduling");
    expect(html).toContain("Start this publishing plan");
    expect(html).toContain("disabled");
  });

  it("tells Wix users that automatic scheduling is not yet supported", () => {
    const html = render({ approved: 3, platform: "wix" });
    expect(html).toContain("Wix scheduling is not connected yet");
    expect(html).toContain("Destiny cannot honestly confirm a Wix-native scheduled post yet");
  });

  it("allows a connected WordPress site with approved topics to configure a plan", () => {
    const html = render({ approved: 3, wordpress: true, platform: "wordpress" });
    expect(html).not.toContain("Approve topics before scheduling");
    expect(html).not.toContain("Wix scheduling is not connected yet");
  });

  it("renders Spark's calendar view with the complete truthful queue", () => {
    const plan: PublishingPlanRecord = {
      id: "plan-1",
      mode: "automatic",
      status: "active",
      timezone: "America/Los_Angeles",
      holdback_hours: 72,
      start_date: "2026-08-21",
      end_date: "2026-09-18",
      confirmed_post_count: 5,
      automatic_confirmed_at: "2026-08-17T12:00:00.000Z",
    };
    const items = [
      ["one", "Planned guide", "planned", null, null],
      ["two", "Review guide", "needs_review", null, null],
      ["three", "Scheduled guide", "scheduled", "20208955", null],
      ["four", "Published guide", "published", "20208956", "https://example.com/live"],
      ["five", "Failed guide", "failed", null, null],
    ].map(([id, title, state, remoteId, permalink], index) => ({
      id,
      plan_id: "plan-1",
      position: index + 1,
      keyword: `${id} keyword`,
      title,
      content_type: "Blog guide",
      scheduled_for: `2026-${index === 0 ? "08-21" : `09-${String(index).padStart(2, "0")}`}T16:00:00.000Z`,
      state,
      review_recommended: false,
      remote_id: remoteId,
      remote_edit_url: remoteId ? `https://example.com/wp-admin/post.php?post=${remoteId}&action=edit` : null,
      remote_permalink: permalink,
      last_error: state === "failed" ? "WordPress connection expired." : null,
    })) as PublishingScheduleItemRecord[];

    const html = renderToStaticMarkup(<PublishingPlanManager
      approvedKeywordCount={5}
      auditId="11111111-1111-4111-8111-111111111111"
      calendar={calendar}
      initialItems={items}
      initialPlan={plan}
      websiteId="22222222-2222-4222-8222-222222222222"
      websitePlatform="wordpress"
      wordpressConnected
    />);

    expect(html).toContain("Publishing calendar view");
    expect(html).toContain("Calendar");
    expect(html).toContain("List");
    expect(html).toContain("America/Los_Angeles");
    expect(html).toContain("Scheduled guide");
    expect(html).toContain("Published guide");
    expect(html).toContain("Failed guide");
    expect(html).toContain("CMS-confirmed scheduled");
    expect(html).toContain("Live and verified");
    expect(html).not.toContain("items.slice(0, 4)");
  });
});
