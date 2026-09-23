import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ offering: "", customers: "", name: "Example", market: "United States" }));
vi.mock("@/lib/workspace-context", () => ({
  getWorkspaceContext: async () => ({ website: { id: "11111111-1111-4111-8111-111111111111", url: "https://example.com", business_name: fixture.name, products_services: fixture.offering, ideal_customer: fixture.customers, market: fixture.market }, audit: { id: "audit" }, metrics: {}, supabase: { rpc: async () => ({ data: [] }) } }),
  providerResultFromMetrics: () => ({}), list: (value: unknown) => Array.isArray(value) ? value : [], record: (value: unknown) => value && typeof value === "object" ? value : {},
}));
vi.mock("@/lib/billing/website-entitlement", () => ({ loadWebsiteEntitlement: async () => ({ canRunPaidWork: true, canManageBilling: true }) }));
vi.mock("@/components/workspace-shell", () => ({ WorkspaceShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/creator-discovery", () => ({ CreatorDiscovery: () => null }));
import DistributionPage from "./page";

async function directories(offering: string, customers = "", name = "Example") {
  Object.assign(fixture, { offering, customers, name, market: "United States" });
  const html = renderToStaticMarkup(await DistributionPage());
  return html.slice(html.indexOf('id="directories"'));
}
describe("directory fit uses what the business sells", () => {
  it("does not assign ClearCheck its customers' agent profiles", async () => {
    const html = await directories("ClearCheck provides fast, secure background checks and employment verification using current court and public-record data. Reports are typically available in 10 to 30 seconds.", "United States employers and HR teams, landlords and property managers, education and public agencies, nonprofits, and individuals who need a trustworthy background check.", "ClearCheck");
    expect(html).not.toContain("Zillow"); expect(html).not.toContain("Realtor.com");
    expect(html).toContain("No additional directory");
  });
  it("preserves agent directories without misclassifying a real estate agency as marketing", async () => {
    const html = await directories("A real estate agency representing home buyers and home sellers");
    expect(html).toContain("Zillow"); expect(html).toContain("Realtor.com");
    expect(html).not.toContain("Clutch"); expect(html).not.toContain("DesignRush");
  });
  it("preserves marketing directories when customers are property managers", async () => {
    const html = await directories("A marketing and web design agency for growing brands", "Property managers and real estate agents");
    expect(html).toContain("Clutch"); expect(html).toContain("DesignRush"); expect(html).not.toContain("Zillow");
  });
  it("does not infer role eligibility from a company name or customer field when offering is missing", async () => {
    const html = await directories("", "Home buyers and real estate agents", "Property Agency Software");
    expect(html).not.toContain("Zillow"); expect(html).not.toContain("Clutch"); expect(html).toContain("No additional directory");
  });
  it("retains actual restaurant and home-service recommendations", async () => {
    expect(await directories("A neighborhood restaurant and cafe")).toContain("Tripadvisor");
    expect(await directories("Local plumbing and home repair services")).toContain("Nextdoor");
  });
  it("does not label an unspecified agency or an architecture design practice as a marketing firm", async () => {
    for (const offering of ["An agency", "Architecture and building design services", "A real estate consulting agency"]) {
      const html = await directories(offering); expect(html).not.toContain("Clutch"); expect(html).not.toContain("DesignRush");
    }
  });
});
