import { describe, expect, it } from "vitest";
import { isWorkspacePathname, workspaceRedirectHref } from "./workspace-routes";

const siteId = "11111111-1111-4111-8111-111111111111";

describe("workspace route safety", () => {
  it("recognizes workspace pages without treating public and onboarding pages as private workspace routes", () => {
    expect(isWorkspacePathname("/this-week")).toBe(true);
    expect(isWorkspacePathname("/audits/example")).toBe(true);
    expect(isWorkspacePathname("/internal-links")).toBe(true);
    expect(isWorkspacePathname("/")).toBe(false);
    expect(isWorkspacePathname("/onboarding")).toBe(false);
  });

  it("makes a bare workspace route explicit from the saved active website", () => {
    expect(workspaceRedirectHref({ activeWebsiteId: siteId, pathname: "/content", requestedWebsiteId: null, search: "?tab=drafts" }))
      .toBe(`/content?tab=drafts&site=${siteId}`);
  });

  it("does not redirect an already scoped route, invalid cookie, or public route", () => {
    expect(workspaceRedirectHref({ activeWebsiteId: siteId, pathname: "/content", requestedWebsiteId: siteId, search: `?site=${siteId}` })).toBeNull();
    expect(workspaceRedirectHref({ activeWebsiteId: "invalid", pathname: "/content", requestedWebsiteId: null, search: "" })).toBeNull();
    expect(workspaceRedirectHref({ activeWebsiteId: siteId, pathname: "/", requestedWebsiteId: null, search: "" })).toBeNull();
  });
});
