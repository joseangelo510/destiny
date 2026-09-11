import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FEATURE_NAVIGATION } from "@/lib/product/coach-experience";
import type { ReboundHomeView } from "@/lib/rebound-core/contracts";
import { empty, ready } from "@/lib/rebound-core/panel-result";
import { HomeDashboard } from "./home-dashboard";

const websiteId = "11111111-1111-4111-8111-111111111111";
const view: ReboundHomeView = {
  firstName: "Sam", websiteId, websiteLabel: "Example Co", timeZone: "UTC",
  websites: [{ id: websiteId, business_name: "Example Co", normalized_domain: "example.com" }],
  queue: ready({ items: [], sessionMoves: [] }), searchConsole: empty("Awaiting sync"),
  analytics: empty("Awaiting sync"), keywords: empty("No tracked keywords"),
  competitors: empty("No competitors"), calendar: empty("No schedule"),
};

describe("Coach integration preserves the complete workspace", () => {
  it("exposes every existing tool and separate Coach and Home dashboard destinations", () => {
    const html = renderToStaticMarkup(<HomeDashboard view={view} />);
    expect(html).toContain('data-coach-design="preserved"');
    expect(html).toContain('href="/app/home?view=dashboard&amp;site=' + websiteId + '"');
    expect(html).toContain('>Home dashboard</span></a>');
    expect(html).toContain('>Coach</span></a>');
    for (const tool of FEATURE_NAVIGATION) expect(html).toContain(tool.label.replaceAll("&", "&amp;"));
  });

  it("supports a direct full-dashboard entry without discarding the original panels", () => {
    const html = renderToStaticMarkup(<HomeDashboard view={view} dashboardOpen />);
    expect(html).not.toContain('data-coach-home="warmup"');
    expect(html).toContain('data-rebound-core="v1"');
    expect(html).toContain("Your progress for");
    expect(html).toContain("Back to your coach");
    expect(html).toContain("No tracked keywords");
  });

  it("uses real move estimates and states and offers no synthetic completion", () => {
    const move = { id: "technical-1", title: "Review crawl findings", description: "Check the crawl.", why: "Removes a search blocker", href: "/audits", state: "reported" as const, estimateMinutes: 18 };
    const html = renderToStaticMarkup(<HomeDashboard view={{ ...view, queue: ready({ items: [move], sessionMoves: [move] }) }} />);
    expect(html).toContain("You reported");
    expect(html).toContain("18 min");
    expect(html).toContain(`/audits?site=${websiteId}`);
    expect(html).not.toMatch(/2 of 3|Perfect Week|done for today|automatically scheduled/i);
  });
});
