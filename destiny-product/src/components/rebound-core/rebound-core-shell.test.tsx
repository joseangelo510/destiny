import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FEATURE_NAVIGATION } from "@/lib/product/coach-experience";
import type { ReboundHomeView } from "@/lib/rebound-core/contracts";
import { empty, notConnected, ready } from "@/lib/rebound-core/panel-result";
import { HomeDashboard } from "./home-dashboard";
import { ReboundCoreShell } from "./rebound-core-shell";

const websiteId = "11111111-1111-4111-8111-111111111111";
const move = { id: "move-1", title: "Review the current draft", description: "Read the draft in Content studio.", href: "/content", why: "Keeps content moving", estimateMinutes: null, state: "draft" as const };

describe("Rebound redesign Slice 1", () => {
  it("renders all five linked core destinations and every existing tool", () => {
    const html = renderToStaticMarkup(<ReboundCoreShell active="/app/home" queue={ready({ items: [move], sessionMoves: [move] })} searchConnected websiteId={websiteId} websiteLabel="Example Co"><p>Home content</p></ReboundCoreShell>);
    for (const label of ["Home", "Content", "Calendar", "Distribution", "Progress"]) expect(html).toContain(label);
    for (const tool of FEATURE_NAVIGATION) expect(html).toContain(tool.label);
    expect(html).toContain(`/app/home?site=${websiteId}`);
    for (const route of ["content", "calendar", "distribution", "progress"]) expect(html).toContain(`/app/${route}?site=${websiteId}`);
    expect(html).toContain("Preview — read-only");
    expect(html).toContain("These new core pages use current workspace data");
    expect(html).toContain(`href="/content?site=${websiteId}"`);
  });

  it("keeps the approved Home panel order and the one-list session invariant", () => {
    const view: ReboundHomeView = {
      firstName: "Jordan",
      websiteLabel: "Example Co",
      websiteId,
      queue: ready({ items: [move], sessionMoves: [move] }),
      searchConsole: notConnected("Connect Search Console"),
      analytics: notConnected("Connect Analytics"),
      keywords: empty("No keywords"),
      competitors: empty("No competitors"),
      calendar: empty("No schedule"),
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
