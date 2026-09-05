import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PRIMARY_NAVIGATION, FEATURE_NAVIGATION } from "../lib/product/coach-experience";
import { CORE_NAVIGATION } from "../lib/rebound-core/routes";
import { onboardingEntryDestination } from "../lib/auth/workspace-entry";
import { WorkspaceShellView } from "./workspace-shell-view";

const sites = [
  { id: "11111111-1111-4111-8111-111111111111", business_name: "First site", normalized_domain: "first.example" },
  { id: "22222222-2222-4222-8222-222222222222", business_name: "Second site", normalized_domain: "second.example" },
];

describe("the shipped core tabs stay reachable from existing tools", () => {
  it("uses one primary navigation definition, preserving legacy pages as tools", () => {
    expect(PRIMARY_NAVIGATION).toBe(CORE_NAVIGATION);
    for (const href of ["/this-week", "/roadmap", "/results", "/analytics", "/content/infographics", "/keywords", "/integrations"]) {
      expect(FEATURE_NAVIGATION.some((item) => item.href === href)).toBe(true);
    }
  });

  it("renders all five site-scoped tabs in desktop and mobile navigation on every tool", () => {
    for (const site of sites) {
      for (const tool of FEATURE_NAVIGATION) {
        const html = renderToStaticMarkup(<WorkspaceShellView active={tool.href} activeWebsiteId={site.id} description="Existing tool" eyebrow={site.normalized_domain} title={tool.label} websites={sites}><p>Existing feature</p></WorkspaceShellView>);
        for (const navLabel of ["Rebound SEO workspace", "Primary mobile navigation"]) {
          const nav = html.match(new RegExp(`<nav aria-label="${navLabel}"[^>]*>(.*?)</nav>`))?.[1] ?? "";
          expect(nav.match(/<a /g), `${tool.href}: ${navLabel}`).toHaveLength(5);
          for (const item of CORE_NAVIGATION) expect(nav).toContain(`href="${item.href}?site=${site.id}"`);
        }
        expect(html).toContain(`href="/app/home?site=${site.id}"`);
      }
    }
  });

  it("returns existing users to the canonical workspace resolver without changing first-time onboarding", () => {
    expect(onboardingEntryDestination({ authenticated: true, hasWebsite: true })).toBe("/app");
    expect(onboardingEntryDestination({ authenticated: true, hasWebsite: true, startNew: true })).toBeNull();
    expect(onboardingEntryDestination({ authenticated: false, hasWebsite: true })).toBe("/login?next=%2Fonboarding");
  });

  it("does not automatically send completed audits back into the old navigation", async () => {
    for (const file of ["./audit-momentum-processing.tsx", "./destiny-prototype.tsx"]) {
      const source = await readFile(new URL(file, import.meta.url), "utf8");
      expect(source).not.toContain('window.location.assign("/this-week")');
      expect(source).toContain('window.location.assign("/app")');
    }
  });
});
