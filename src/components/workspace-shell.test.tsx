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

  it("keeps the title text block together and places the notification action at the header's top-right corner", () => {
    const html = renderToStaticMarkup(<WorkspaceShell active="/this-week" description="One useful step." eyebrow="example.com" title="This week"><p>Work</p></WorkspaceShell>);

    // A dedicated left text block (eyebrow + title + description together)…
    expect(html).toMatch(/<div class="workspace-header-text"><div class="eyebrow">example.com<\/div><h1>This week<\/h1><p>One useful step.<\/p><\/div>/);
    // …followed by the sole trailing notification action at the far top-right.
    expect(html).toMatch(/workspace-header-text[\s\S]*workspace-header-action/);
    expect(html).toContain('class="workspace-header-action"');
    // The action is a bell icon, not the old diamond glyph, wired for accessibility.
    expect(html).toContain("workspace-notification-bell");
    expect(html).not.toContain("◇");
    expect(html).toContain('aria-haspopup="true"');
    expect(html).toContain('aria-controls="workspace-notification-panel"');
    expect(html).toContain('aria-label="Open notifications"');
  });
});
