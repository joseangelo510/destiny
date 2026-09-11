import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductNavigation } from "./product-navigation";
import { WorkspaceShellView } from "./workspace-shell-view";
import { ReboundCoreShell } from "./rebound-core/rebound-core-shell";
import { ready } from "@/lib/rebound-core/panel-result";

const site = { id: "11111111-1111-4111-8111-111111111111", business_name: "Example", normalized_domain: "example.com" };
const other = { ...site, id: "22222222-2222-4222-8222-222222222222", business_name: "Other" };

describe("the selected preservation prototype", () => {
  it("does not claim the first website is selected when no site is resolved", () => {
    const html = renderToStaticMarkup(<ProductNavigation active="/keywords" websiteId={null} websites={[site, other]} />);
    expect(html).toContain("Choose a website");
    expect(html).not.toContain("Current website: Example");
    expect(html).toContain(`data-site-switch="${other.id}"`);
  });

  it("has the same complete navigation on Coach and every legacy tool", () => {
    const pages = [<ReboundCoreShell key="coach" active="/app/home" coach queue={ready({items:[],sessionMoves:[]})} searchConnected={false} websiteId={site.id} websiteLabel="Example" websites={[site,other]}>Coach</ReboundCoreShell>,
      ...["/keywords","/reviews","/content","/integrations"].map(active => <WorkspaceShellView key={active} active={active} activeWebsiteId={site.id} title="Tool" eyebrow="Example" description="Original body" websites={[site,other]}>Original body</WorkspaceShellView>)];
    for (const page of pages) {
      const html = renderToStaticMarkup(page);
      expect(html).toContain('data-approved-navigation="preservation"');
      expect(html).toContain('aria-label="Main navigation"');
      const nav = html.match(/<nav aria-label="Main navigation"[^>]*>(.*?)<\/nav>/)?.[1] ?? "";
      expect([...nav.matchAll(/<span>(.*?)<\/span>/g)].map(match=>match[1])).toEqual(["Home dashboard","Coach","Content","Calendar","Distribution","Progress"]);
      expect(html).toContain('aria-label="All tools"');
      expect(html).toContain("Distribution tools");
      expect(html).toContain("Open navigation");
      expect(html).toContain("Sign out");
      expect(html).toContain(`data-site-switch="${other.id}"`);
      expect(html).toContain(`/content?site=${site.id}#publishing-plan`);
    }
  });
});
