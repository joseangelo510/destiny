import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ billing: vi.fn(), context: vi.fn() }));
vi.mock("@/lib/workspace-context", () => ({ getWorkspaceContext: mocks.context }));
vi.mock("@/lib/billing/account", () => ({ loadBillingAccount: mocks.billing }));
vi.mock("@/components/workspace-shell", () => ({ WorkspaceShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/feature-journey-callout", () => ({ FeatureJourneyCallout: () => null }));
import BacklinksPage from "./page";

describe("BacklinksPage allowance disclosure", () => {
  it("uses the signed-in owner's domain-report meter for the selected website", async () => {
    mocks.context.mockResolvedValue({ userId: "owner-1", website: { normalized_domain: "clearcheck.app" } });
    mocks.billing.mockResolvedValue({ available: true, access: { limits: { domainReports: 25 } }, used: { domainReports: 6 } });
    const html = renderToStaticMarkup(await BacklinksPage());
    expect(mocks.billing).toHaveBeenCalledWith("owner-1");
    expect(html).toContain('value="clearcheck.app"');
    expect(html).toContain("Uses 1 Domain report");
    expect(html).toContain("6 of 25 used");
    expect(html).toContain("19 remaining");
  });

  it("keeps the meter name truthful when billing could not be loaded", async () => {
    mocks.context.mockResolvedValue({ userId: "owner-1", website: { normalized_domain: "clearcheck.app" } });
    mocks.billing.mockResolvedValue({ available: false, access: { limits: null }, used: {} });
    const html = renderToStaticMarkup(await BacklinksPage());
    expect(html).toContain("Uses 1 Domain report");
    expect(html).toContain("Check billing for your remaining allowance");
    expect(html).not.toContain("0 remaining");
  });
});
