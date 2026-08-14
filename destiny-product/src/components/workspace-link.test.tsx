import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceLink, WorkspaceWebsiteProvider } from "./workspace-link";

const siteId = "11111111-1111-4111-8111-111111111111";

describe("WorkspaceLink", () => {
  it("makes in-workspace links safe to share by carrying the selected website", () => {
    const html = renderToStaticMarkup(<WorkspaceWebsiteProvider websiteId={siteId}><WorkspaceLink href="/content#drafts">Content</WorkspaceLink></WorkspaceWebsiteProvider>);
    expect(html).toContain(`href="/content?site=${siteId}#drafts"`);
  });

  it("leaves links usable outside a workspace provider", () => {
    expect(renderToStaticMarkup(<WorkspaceLink href="/content">Content</WorkspaceLink>)).toContain('href="/content"');
  });
});
