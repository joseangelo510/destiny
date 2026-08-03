import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KeywordResearchWorkspace } from "./keyword-research-workspace";

describe("KeywordResearchWorkspace", () => {
  it("starts with a domain-or-keyword research choice and live-data explanation", () => {
    const html = renderToStaticMarkup(<KeywordResearchWorkspace initialQuery="empowerly.com" />);
    expect(html).toContain("Destiny Research Lab");
    expect(html).toContain("Domain");
    expect(html).toContain("Keyword");
    expect(html).toContain("empowerly.com");
    expect(html).toContain("Run your first research report");
  });
});
