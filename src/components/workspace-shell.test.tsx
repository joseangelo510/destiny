import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "./workspace-shell";

describe("WorkspaceShell coaching hierarchy", () => {
  it("keeps coaching destinations visible and puts secondary tools behind one calm disclosure", () => {
    const html = renderToStaticMarkup(<WorkspaceShell active="/this-week" description="One useful step." eyebrow="example.com" title="This week"><p>Work</p></WorkspaceShell>);

    expect(html).toContain("This week");
    expect(html).toContain("Roadmap");
    expect(html).toContain("Strategy");
    expect(html).toContain("Results");
    expect(html).toContain("Tools &amp; reports");
    expect(html).toContain("Content studio");
    expect(html).toContain('data-active="/this-week"');
    expect(html).not.toContain("LOGOS rules active");
    expect(html).not.toMatch(/<details[^>]*class="desktop-feature-menu"[^>]*open/);
  });

  it("opens the tool disclosure when the user is already inside a secondary tool", () => {
    const html = renderToStaticMarkup(<WorkspaceShell active="/keywords" description="Review demand." eyebrow="example.com" title="Keyword strategy"><p>Work</p></WorkspaceShell>);

    expect(html).toMatch(/<details[^>]*class="desktop-feature-menu"[^>]*open/);
    expect(html).toContain("Keyword strategy");
  });
});
