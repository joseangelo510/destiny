import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentWorkspace } from "./agent-workspace";

describe("AgentWorkspace", () => {
  it("renders the scoped conversation, visible-work, and permission surfaces", () => {
    const html = renderToStaticMarkup(<AgentWorkspace
      conversations={[{ id: "c1", title: "Find content opportunities", updatedAt: "2026-09-02T00:00:00Z" }]}
      initialMessages={[
        { id: "m1", role: "user", text: "What should I improve?" },
        { id: "m2", role: "assistant", text: "Improve the service page.", work: ["Loaded Search Console evidence"] },
      ]}
      initialProposals={[{
        id: "p1", status: "proposed", title: "Create a technical SEO audit draft",
        targetKeyword: "technical seo audit", angle: "Evidence first", outlineBullets: ["Proof", "Decision"],
      }]}
      selectedConversationId="c1"
      website={{ id: "11111111-1111-4111-8111-111111111111", label: "Example Co", domain: "example.com" }}
    />);
    expect(html).toContain("Ask Rebound");
    expect(html).toContain("Loaded Search Console evidence");
    expect(html).toContain("Create draft");
    expect(html).toContain("Reject");
    expect(html).toContain("What outcome do you want?");
  });
});
