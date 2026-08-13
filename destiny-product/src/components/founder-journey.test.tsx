import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryMomentCard, FounderWhyVault, SeasonRecap, WitnessLog } from "./founder-journey";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("Founder journey surfaces", () => {
  it("renders a quiet truthful discovery celebration", () => {
    const html = renderToStaticMarkup(<DiscoveryMomentCard moment={{ title: "Someone found you.", detail: "Google Search recorded 7 clicks in the latest connected period.", value: "7", label: "search clicks", source: "Google Search Console" }} />);
    expect(html).toContain("Someone found you");
    expect(html).toContain("Google Search Console");
    expect(html).toContain("Verified connected data");
  });

  it("shows the founder what Destiny witnessed and labels proof honestly", () => {
    const html = renderToStaticMarkup(<WitnessLog entries={[
      { id: "one", title: "Fix published", detail: "Your change is live.", proof: "Verified by Destiny", source: "Website evidence", tone: "verified" },
      { id: "two", title: "Guide drafted", detail: "You marked this work complete.", proof: "Marked done by you", source: "Your task history", tone: "reported" },
    ]} />);
    expect(html).toContain("Destiny noticed");
    expect(html).toContain("Verified by Destiny");
    expect(html).toContain("Marked done by you");
  });

  it("keeps the optional Why Vault private and outside required onboarding", () => {
    const html = renderToStaticMarkup(<FounderWhyVault initialWhy="I want neighborhood businesses to thrive." />);
    expect(html).toContain("Your Why Vault");
    expect(html).toContain("Private to your workspace");
    expect(html).toContain("I want neighborhood businesses to thrive");
    expect(html).toContain("Save my why");
  });

  it("frames the three-month plan as a season with observed progress", () => {
    const html = renderToStaticMarkup(<SeasonRecap snapshot={{ activeWeeks: 3, completedTasks: 6, currentWeek: 4, totalWeeks: 13, verifiedResults: 2 }} />);
    expect(html).toContain("Your 90-day season");
    expect(html).toContain("Week 4 of 13");
    expect(html).toContain("6");
    expect(html).toContain("2");
    expect(html).toContain("No projections");
  });
});
