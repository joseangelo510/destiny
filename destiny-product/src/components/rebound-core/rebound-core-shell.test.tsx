import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FEATURE_NAVIGATION } from "@/lib/product/coach-experience";
import type { ReboundHomeView } from "@/lib/rebound-core/contracts";
import { empty, notConnected, ready } from "@/lib/rebound-core/panel-result";
import { HomeDashboard } from "./home-dashboard";
import { ReboundCoreShell } from "./rebound-core-shell";

const websiteId = "11111111-1111-4111-8111-111111111111";
const move = { id: "move-1", title: "Review the current draft", description: "Read the draft in Content studio.", href: "/content", why: "Keeps content moving", estimateMinutes: null, state: "draft" as const };
const originalTimeZone = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  process.env.TZ = originalTimeZone;
});

describe("Rebound redesign Slice 1", () => {
  it("renders all five linked core destinations and every existing tool", () => {
    const html = renderToStaticMarkup(<ReboundCoreShell active="/app/home" queue={ready({ items: [move], sessionMoves: [move] })} searchConnected websiteId={websiteId} websiteLabel="Example Co" websites={[{ id: websiteId, business_name: "Example Co", normalized_domain: "example.com" }]}><p>Home content</p></ReboundCoreShell>);
    for (const label of ["Home", "Content", "Calendar", "Distribution", "Progress"]) expect(html).toContain(label);
    for (const tool of FEATURE_NAVIGATION) expect(html).toContain(tool.label);
    expect(html).toContain(`/app/home?site=${websiteId}`);
    for (const route of ["content", "calendar", "distribution", "progress"]) expect(html).toContain(`/app/${route}?site=${websiteId}`);
    expect(html).toContain("Preview — read-only");
    expect(html).toContain("These new core pages use current workspace data");
    expect(html).toContain(`href="/content?site=${websiteId}"`);
  });

  it("offers the existing site-scoped website switcher in the core shell", () => {
    const secondWebsiteId = "22222222-2222-4222-8222-222222222222";
    const props = {
      active: "/app/home",
      queue: ready({ items: [], sessionMoves: [] }),
      searchConnected: true,
      websiteId,
      websiteLabel: "Example Co",
      websites: [
        { id: websiteId, business_name: "Example Co", normalized_domain: "example.com" },
        { id: secondWebsiteId, business_name: "ClearCheck", normalized_domain: "clearcheck.app" },
      ],
    };
    const html = renderToStaticMarkup(<ReboundCoreShell {...props}><p>Home content</p></ReboundCoreShell>);

    expect(html).toContain("Choose another website");
    expect(html).toContain("ClearCheck");
    expect(html).toContain(`/app/home?site=${secondWebsiteId}`);
    expect(html).toContain(`data-site-switch="${secondWebsiteId}"`);
  });

  it("formats the Home greeting in the saved website timezone", () => {
    process.env.TZ = "UTC";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T00:30:00Z"));
    const view: ReboundHomeView = {
      firstName: "Jordan",
      websiteLabel: "Example Co",
      websiteId,
      websites: [{ id: websiteId, business_name: "Example Co", normalized_domain: "example.com" }],
      timeZone: "America/Los_Angeles",
      queue: ready({ items: [move], sessionMoves: [move] }),
      searchConsole: notConnected("Connect Search Console"),
      analytics: notConnected("Connect Analytics"),
      keywords: empty("No keywords"),
      competitors: empty("No competitors"),
      calendar: ready({ month: "September 2026", anchorDate: "2026-09-01", events: [], suggestions: [{ id: "topic-1", title: "Youtube SEO checklist", approvedAt: "2026-09-01T12:00:00Z" }] }),
    };

    const html = renderToStaticMarkup(<HomeDashboard view={view} />);
    expect(html).toContain("Monday, August 31. Jordan, here is the clearest next move.");
    expect(html).toContain("Youtube SEO checklist");
    expect(html).toContain("Approved topic · not scheduled");
  });

  it("keeps the approved Home panel order and the one-list session invariant", () => {
    const view: ReboundHomeView = {
      firstName: "Jordan",
      websiteLabel: "Example Co",
      websiteId,
      websites: [{ id: websiteId, business_name: "Example Co", normalized_domain: "example.com" }],
      timeZone: "America/Los_Angeles",
      queue: ready({ items: [move], sessionMoves: [move] }),
      searchConsole: notConnected("Connect Search Console"),
      analytics: notConnected("Connect Analytics"),
      keywords: empty("No keywords"),
      competitors: empty("No competitors"),
      calendar: ready({ month: "September 2026", anchorDate: "2026-09-01", events: [], suggestions: [] }),
    };
    const html = renderToStaticMarkup(<HomeDashboard view={view} />);
    const labels = ["How your SEO is doing", "Keywords", "Competitors", "The month"];
    labels.reduce((previous, label) => {
      const index = html.indexOf(label);
      expect(index).toBeGreaterThan(previous);
      return index;
    }, -1);
    expect(html.match(/Review the current draft/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("move 1 and queue item 1 cannot drift apart");
  });
});
