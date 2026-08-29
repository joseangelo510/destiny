import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { AI_BUILDER_TOOLS, WEBSITE_PLATFORMS } from "../lib/integrations/website-profile";
import { GoogleIntegrationAction } from "./google-integration-action";
import { WebsiteProfileCard } from "./website-profile-card";
import { WordPressIntegrationAction } from "./wordpress-integration-action";

describe("existing account connection rendering (characterization)", () => {
  it("keeps the Google connect/reconnect and sync behavior unchanged", () => {
    const disconnected = renderToStaticMarkup(<GoogleIntegrationAction connected={false} connectHref="/api/integrations/google/start?provider=google_search_console&websiteId=w1" provider="google_search_console" websiteId="w1" />);
    expect(disconnected).toContain("Connect Google");
    expect(disconnected).toContain("/api/integrations/google/start?provider=google_search_console");

    const connected = renderToStaticMarkup(<GoogleIntegrationAction connected connectHref="/x" provider="google_search_console" websiteId="w1" />);
    expect(connected).toContain("Reconnect");
    expect(connected).toContain("Sync now");
  });

  it("keeps the WordPress connect flow unchanged", () => {
    const disconnected = renderToStaticMarkup(<WordPressIntegrationAction connected={false} websiteId="w1" />);
    expect(disconnected).toContain("Connect WordPress");
    const connected = renderToStaticMarkup(<WordPressIntegrationAction connected savedSiteUrl="https://example.com" websiteId="w1" />);
    expect(connected).toContain("Reconnect WordPress");
  });
});

describe("WebsiteProfileCard", () => {
  const render = (platform: string | null = null, tools: string[] = []) =>
    renderToStaticMarkup(<WebsiteProfileCard initialBuilderTools={tools} initialPlatform={platform} websiteId="w1" />);

  it("renders the section framing as editable profile info, not a claimed connection", () => {
    const html = render();
    expect(html).toContain("Your website");
    expect(html).toContain("Tell Rebound SEO where your site is built so advice fits your tools.");
    expect(html).toContain("Where is your site built?");
    expect(html).toContain("Did AI tools help you build it?");
    expect(html).toContain("not account connections");
  });

  it("offers every requested platform as a native single-select radio group with search", () => {
    const html = render();
    expect(html).toContain('aria-label="Search platforms"');
    for (const platform of WEBSITE_PLATFORMS) expect(html).toContain(`<span>${platform.label}</span>`);
    // Native radios: full keyboard interaction model comes from the browser.
    expect(html.match(/type="radio"/g)).toHaveLength(WEBSITE_PLATFORMS.length);
    expect(html.match(/name="website-platform"/g)).toHaveLength(WEBSITE_PLATFORMS.length);
    expect(html).not.toContain('checked=""');
  });

  it("offers the AI builder tools as a multi-select checkbox group", () => {
    const html = render();
    for (const tool of AI_BUILDER_TOOLS) expect(html).toContain(`<span>${tool.label}</span>`);
    expect(html.match(/type="checkbox"/g)).toHaveLength(AI_BUILDER_TOOLS.length);
  });

  it("hydrates saved selections and marks them Selected — never Connected", () => {
    const html = render("wix", ["chatgpt", "claude"]);
    expect(html.match(/checked=""/g)).toHaveLength(3);
    expect(html.match(/<small>Selected<\/small>/g)).toHaveLength(3);
    expect(html).not.toContain("Connected");
    expect(html).not.toContain("Coming soon");
    expect(html).not.toContain("Notify me");
  });

  it("invariant: no platform tile ever renders a Connect action", () => {
    for (const platform of WEBSITE_PLATFORMS) {
      const html = render(platform.id, []);
      const websiteSection = html.slice(html.indexOf("Where is your site built?"));
      expect(websiteSection).not.toContain(">Connect<");
      expect(websiteSection).not.toMatch(/Connect\s+(Wix|Webflow|Squarespace|Shopify|Lovable|GoDaddy|Joomla|Weebly|Duda|Drupal|Sitecore|WordPress|Other)/);
    }
  });

  it("has a polite live region for save confirmation and a disabled save button until changes exist", () => {
    const html = render("wix", []);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Save website profile");
    expect(html).toContain("disabled");
  });
});
