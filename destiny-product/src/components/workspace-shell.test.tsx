import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "./workspace-shell";

describe("WorkspaceShell coaching hierarchy", () => {
  it("keeps coaching destinations visible and puts secondary tools behind one calm disclosure", () => {
    const html = renderToStaticMarkup(<WorkspaceShell active="/this-week" description="One useful step." eyebrow="example.com" title="This week"><p>Work</p></WorkspaceShell>);

    expect(html).toContain("This week");
    expect(html).toContain("Roadmap");
    expect(html).toContain("Game Plan");
    expect(html).toContain("Analytics");
    expect(html).toContain("Tools &amp; reports");
    expect(html).toContain("Content studio");
    expect(html).toContain("Keyword research");
    expect(html).toContain("Backlink analytics");
    expect(html).toContain('data-active="/this-week"');
    expect(html).not.toContain("LOGOS rules active");
    expect(html).not.toMatch(/<details[^>]*class="desktop-feature-menu"[^>]*open/);
  });

  it("opens the tool disclosure when the user is already inside a secondary tool", () => {
    const html = renderToStaticMarkup(<WorkspaceShell active="/keywords" description="Review demand." eyebrow="example.com" title="Keyword strategy"><p>Work</p></WorkspaceShell>);

    expect(html).toMatch(/<details[^>]*class="desktop-feature-menu"[^>]*open/);
    expect(html).toContain("Keyword strategy");
  });

  it("keeps notifications in a dedicated top-right header action instead of the title flow", () => {
    const html = renderToStaticMarkup(<WorkspaceShell active="/this-week" description="One useful step." eyebrow="example.com" title="This week"><p>Work</p></WorkspaceShell>);

    expect(html).toContain('class="workspace-header-copy"');
    expect(html).toMatch(/<header class="workspace-header"><div class="workspace-header-copy">.*<\/div><div class="workspace-notification-center">/);
    expect(html).toContain('class="workspace-notification-icon"');
    expect(html).toContain('aria-label="Open notifications"');
  });
});
