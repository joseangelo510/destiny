import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReboundHomeView } from "@/lib/rebound-core/contracts";
import { empty, failed, ready } from "@/lib/rebound-core/panel-result";
import { HomeDashboard } from "./home-dashboard";

const move = { id: "review", title: "Review your saved article", description: "Your article is ready for review.", href: "/app/content/article-1", why: "Keeps content moving", state: "draft" as const, estimateMinutes: null };
const view: ReboundHomeView = {
  firstName: "Sam", websiteId: "00000000-0000-4000-8000-000000000001", websiteLabel: "Example Studio", websites: [{ id: "00000000-0000-4000-8000-000000000001", business_name: "Example Studio", normalized_domain: "example.com" }], timeZone: "UTC",
  queue: ready({ items: [move], sessionMoves: [move] }),
  searchConsole: empty("Waiting for a sync"), analytics: empty("Waiting for a sync"), keywords: empty("No tracked keywords"), competitors: empty("No saved competitors"), calendar: empty("No calendar"),
};

describe("Warm-up coach Home", () => {
  it("focuses the real first move and preserves its site-scoped destination", () => {
    const html = renderToStaticMarkup(<HomeDashboard view={view} />);
    expect(html).toContain('data-coach-home="warmup"');
    expect(html).toContain('data-coach-title');
    expect(html).toContain("Review your saved article");
    expect(html).toContain("/app/content/article-1?site=00000000-0000-4000-8000-000000000001");
    expect(html).toContain("Open full workspace");
    expect(html).toContain('aria-label="All tools"');
    expect(html).not.toContain("5-minute");
    expect(html).not.toContain("See another move");
    expect(html).not.toMatch(/pottery|glaze|Thursday|automatically scheduled|Since your last visit/i);
  });

  it("does not hide an unavailable queue behind a reassuring empty state", () => {
    const html = renderToStaticMarkup(<HomeDashboard view={{ ...view, queue: failed("Please try again shortly.") }} />);
    expect(html).toContain("Your next move is temporarily unavailable.");
    expect(html).toContain("Please try again shortly.");
    expect(html).not.toContain("Nothing needs you right now");
    expect(html).toContain("Open full workspace");
  });

  it("handles a ready empty queue without an undefined move", () => {
    const html = renderToStaticMarkup(<HomeDashboard view={{ ...view, queue: ready({ items: [], sessionMoves: [] }) }} />);
    expect(html).toContain("Nothing needs you right now.");
    expect(html).not.toContain("Open this move");
  });

  it("shows zero measured impressions while distinguishing missing evidence", () => {
    const measured = { ...view, searchConsole: ready({ impressions: 0, impressionsChange: null, clicks: null, clicksChange: null, averagePosition: null, previousAveragePosition: null, series: [], syncedAt: "2026-09-09T12:00:00Z" }) };
    const html = renderToStaticMarkup(<HomeDashboard view={measured} />);
    expect(html).toContain("0 impressions");
    expect(html).toContain("Search Console · last 30 days");
    expect(html).toContain("2026-09-09T12:00:00Z");
    expect(renderToStaticMarkup(<HomeDashboard view={view} />)).not.toContain("0 impressions");
  });
});
