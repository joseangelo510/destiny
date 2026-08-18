import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { PublishingPlanManager } from "./publishing-plan-manager";

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
});
