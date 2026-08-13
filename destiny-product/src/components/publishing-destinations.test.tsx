import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { PublishingDestinations } from "./publishing-destinations";

describe("PublishingDestinations", () => {
  const render = () => renderToStaticMarkup(
    <PublishingDestinations webflowConnected={false} wordpressConnected={false} websiteId="w1" />,
  );

  it("shows the major CMS and code publishing options in one section", () => {
    const html = render();
    expect(html).toContain("Publishing destinations");
    for (const destination of [
      "WordPress", "Shopify", "Webflow", "Wix", "Squarespace", "Lovable",
      "Replit", "v0", "Bolt", "Base44", "GitHub / code-based site", "GoDaddy Website Builder",
      "Joomla", "Weebly", "Duda", "Drupal", "Sitecore", "Other CMS",
    ]) expect(html).toContain(destination);
    expect(html).toContain("ChatGPT / Claude-built website");
    expect(html).toContain("Where do you make changes to this website?");
  });

  it("keeps WordPress actionable and labels every unbuilt connector honestly", () => {
    const html = render();
    expect(html).toContain("Connect WordPress");
    expect(html).toContain("Connect Webflow");
    expect(html.match(/Coming soon/g)).toHaveLength(17);
    expect(html).toContain("Available now");
  });

  it("routes AI-created websites to their real publishing system", () => {
    const html = render();
    expect(html).toContain("The AI created the site; Destiny connects to where its files or content are managed.");
    expect(html).toContain("WordPress, Wix, Webflow, Shopify, or another CMS");
    expect(html).toContain("GitHub, Vercel, Netlify, or a developer-managed repository");
    expect(html).not.toContain("Connect ChatGPT");
    expect(html).not.toContain("Connect Claude");
  });
});
