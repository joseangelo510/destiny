import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { WorkspaceShellView } from "./workspace-shell-view";

const site = { id: "11111111-1111-4111-8111-111111111111", business_name: "Example Co", normalized_domain: "example.com" };

describe("WorkspaceShell coaching hierarchy", () => {
  it("keeps coaching destinations visible and keeps every secondary tool visible in the approved navigation", () => {
    const html = renderToStaticMarkup(<WorkspaceShellView active="/this-week" activeWebsiteId={site.id} description="One useful step." eyebrow="example.com" title="This week" websites={[site]}><p>Work</p></WorkspaceShellView>);

    expect(html).toContain("This week");
    expect(html).toContain("Roadmap");
    expect(html).toContain("Game Plan");
    expect(html).toContain("Analytics");
    expect(html).toContain('aria-label="All tools"');
    expect(html).toContain("Content studio");
    expect(html).toContain("Keyword research");
    expect(html).toContain("Backlink analytics");
    expect(html).toContain('data-active="/this-week"');
    expect(html).not.toContain("LOGOS rules active");
    expect(html).toContain('data-approved-navigation="preservation"');
    expect(html).toContain("Current website");
    expect(html).toContain("Example Co");
    expect(html).toContain(`/roadmap?site=${site.id}`);
    expect(html).toContain(`/app/home?site=${site.id}`);
    expect(html).not.toContain('aria-label="Rebound SEO homepage"');
    expect(html).toContain(`href="/account?site=${site.id}"`);
    expect(html).toMatch(/>Account<[\s\S]*>Sign out</);
  });

  it("marks the current tool without collapsing the others", () => {
    const html = renderToStaticMarkup(<WorkspaceShellView active="/keywords" activeWebsiteId={site.id} description="Review demand." eyebrow="example.com" title="Keyword strategy" websites={[site]}><p>Work</p></WorkspaceShellView>);

    expect(html).toContain('data-approved-navigation="preservation"');
    expect(html).toContain("Keyword strategy");
  });

  it("uses document navigation for the cross-route Editorial calendar link and keeps the selected site", async () => {
    const html = renderToStaticMarkup(<WorkspaceShellView active="/this-week" activeWebsiteId={site.id} description="One useful step." eyebrow="example.com" title="This week" websites={[site]}><p>Work</p></WorkspaceShellView>);
    const editorialLink = html.match(new RegExp(`<a[^>]*href="/content\\?site=${site.id}#publishing-plan"[^>]*>.*?Editorial calendar</span></a>`))?.[0] ?? "";
    const source = await readFile(new URL("./product-navigation.tsx", import.meta.url), "utf8");

    expect(editorialLink).toContain('data-document-navigation="true"');
    expect(new URL(`/content?site=${site.id}#publishing-plan`, `https://destiny.local/this-week?site=${site.id}`).href)
      .toBe(`https://destiny.local/content?site=${site.id}#publishing-plan`);
    expect(source).toContain('item.href.includes("#") ? <a');
  });

  it("exposes the approved Claude design scope only when the keyword workspace requests it", () => {
    const html = renderToStaticMarkup(<WorkspaceShellView active="/keywords" activeWebsiteId={site.id} design="claude-keyword-strategy" description="100 keywords reviewed." eyebrow="Keyword strategy" title="Your strategy is set." websites={[site]}><p>Work</p></WorkspaceShellView>);

    expect(html).toContain('data-design="claude-keyword-strategy"');
    expect(html).toContain("Your strategy is set.");
    expect(html).toContain("100 keywords reviewed.");
  });

  it("offers an explicit website switcher when the account has multiple websites", () => {
    const secondSite = { id: "22222222-2222-4222-8222-222222222222", business_name: "Second Co", normalized_domain: "second.example" };
    const html = renderToStaticMarkup(<WorkspaceShellView active="/this-week" activeWebsiteId={site.id} description="One useful step." eyebrow="example.com" title="This week" websites={[site, secondSite]}><p>Work</p></WorkspaceShellView>);

    expect(html).toContain("Choose another website");
    expect(html).toContain("Second Co");
    expect(html).toContain(`/this-week?site=${secondSite.id}`);
    expect(html).toContain(`data-site-switch="${secondSite.id}"`);
    expect(html).toContain(`data-workspace-website="${site.id}"`);
    expect(html).toContain("+ Add another website");
  });

  it("keeps notifications in a dedicated top-right header action instead of the title flow", () => {
    const html = renderToStaticMarkup(<WorkspaceShellView active="/this-week" activeWebsiteId={site.id} description="One useful step." eyebrow="example.com" title="This week" websites={[site]}><p>Work</p></WorkspaceShellView>);

    expect(html).toContain('class="workspace-header-copy"');
    expect(html).toMatch(/<header class="workspace-header"><div class="workspace-header-copy">.*<\/div><div class="workspace-notification-center">/);
    expect(html).toContain('class="workspace-notification-icon"');
    expect(html).toContain('aria-label="Open notifications"');
  });

  it("includes Repurpose content immediately after Content studio in feature navigation", () => {
    const html = renderToStaticMarkup(<WorkspaceShellView active="/this-week" activeWebsiteId={site.id} description="One useful step." eyebrow="example.com" title="This week" websites={[site]}><p>Work</p></WorkspaceShellView>);

    // Both items are present
    expect(html).toContain("Content studio");
    expect(html).toContain("Repurpose content");

    // Repurpose content href is site-scoped
    expect(html).toContain(`href="/content/repurpose?site=${site.id}"`);

    // Adjacency: Content studio appears immediately before Repurpose content
    const contentStudioPos = html.indexOf("Content studio");
    const repurposePos = html.indexOf("Repurpose content");
    expect(contentStudioPos).toBeGreaterThan(-1);
    expect(repurposePos).toBeGreaterThan(-1);
    expect(contentStudioPos).toBeLessThan(repurposePos);

    // Nothing else appears between Content studio and Repurpose content
    const between = html.slice(contentStudioPos + "Content studio".length, repurposePos);
    expect(between).not.toContain("Editorial calendar");
    expect(between).not.toContain("Keyword strategy");
    expect(between).not.toContain("Keyword research");
  });

  it("shows Internal links with audits in Website optimization", () => {
    const html = renderToStaticMarkup(<WorkspaceShellView active="/internal-links" activeWebsiteId={site.id} description="Find links." eyebrow="example.com" title="Internal links" websites={[site]}><p>Work</p></WorkspaceShellView>);
    const navigation = html.match(/<nav aria-label="All tools"[^>]*>(.*?)<\/nav>/)?.[1] ?? "";
    expect(navigation).toContain(`href="/internal-links?site=${site.id}"`);
    expect(navigation.indexOf(`href="/audits?site=${site.id}"`)).toBeLessThan(navigation.indexOf(`href="/internal-links?site=${site.id}"`));
    expect(navigation).toMatch(/data-tool-group="Website optimization"[^]*?Website audits[^]*?Internal links/);
  });

  it("keeps every tool and account action in the mobile drawer with a shrinkable site selector", async () => {
    const css = await readFile(new URL("./product-navigation.module.css", import.meta.url), "utf8");
    const html = renderToStaticMarkup(<WorkspaceShellView active="/this-week" activeWebsiteId={site.id} description="One useful step." eyebrow="example.com" title="This week" websites={[site]}><p>Work</p></WorkspaceShellView>);
    expect(html).toContain('aria-label="Open navigation"');
    expect(html).toContain('aria-label="All tools"');
    expect(html).toContain('href="/account?site=' + site.id + '"');
    expect(html).toContain('action="/auth/signout"');
    expect(css).toContain('width: min(280px, calc(100vw - 36px))');
    expect(css).toContain('min-width: 0');
  });
});
