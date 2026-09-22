import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ opportunities: [] as Record<string, unknown>[] }));
vi.mock("@/lib/workspace-context", () => ({
  getWorkspaceContext: async () => ({ website: { id: "11111111-1111-4111-8111-111111111111", url: "https://example.com", business_name: "Example" }, audit: { id: "audit" }, metrics: {}, supabase: { rpc: async () => ({ data: [] }) } }),
  providerResultFromMetrics: () => ({ distributionOpportunities: fixture.opportunities }),
  list: (value: unknown) => Array.isArray(value) ? value : [],
  record: (value: unknown) => value && typeof value === "object" ? value : {},
}));
vi.mock("@/lib/billing/website-entitlement", () => ({ loadWebsiteEntitlement: async () => ({ canRunPaidWork: true, canManageBilling: true }) }));
vi.mock("@/components/workspace-shell", () => ({ WorkspaceShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/creator-discovery", () => ({ CreatorDiscovery: () => null }));
import DistributionPage from "./page";
import { buildDistributionView } from "@/lib/rebound-core/core-pages";

const saved = { title: "Saved discussion", platform: "Reddit", snippet: "Saved context", url: "https://www.reddit.com/r/seo/comments/abc/saved" };

describe("Distribution detail freshness matches overview evidence", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-22T00:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it.each(["2026-08-01T00:00:00Z", null, "invalid", "2027-01-01T00:00:00Z"])("does not upgrade stale or unavailable evidence %s by navigation", async (checkedAt) => {
    fixture.opportunities = [{ ...saved, checkedAt }];
    const overview = buildDistributionView({ opportunities: fixture.opportunities, interlinks: [] });
    const html = renderToStaticMarkup(await DistributionPage());
    expect(html).toContain(overview.rows[0].freshness!.label);
    expect(html).not.toContain("Verified Reddit thread");
    expect(html).toContain("Run a fresh audit");
    expect(html).toContain("Review saved thread");
  });
  it("shows the new observation date after a completed audit supplies fresh evidence", async () => {
    fixture.opportunities = [{ ...saved, checkedAt: "2026-09-21T00:00:00Z" }];
    const html = renderToStaticMarkup(await DistributionPage());
    expect(html).toContain("Checked Sep 21");
    expect(html).not.toContain("Verified Reddit thread");
    expect(html).toContain(saved.url);
  });
  it("does not turn malformed saved destinations into external links", async () => {
    fixture.opportunities = [{ ...saved, url: "https://reddit.com.evil.example/discussion", checkedAt: "2026-09-21T00:00:00Z" }];
    const html = renderToStaticMarkup(await DistributionPage());
    expect(html).not.toContain('href="https://reddit.com.evil.example');
    expect(html).toContain("Destination unavailable");
  });
});
