import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildGamePlan } from "../lib/product/game-plan";
import { GamePlanView } from "./game-plan-view";

const input = {
  approvedKeywords: 14,
  auditCompletedAt: "2026-08-02T20:10:55.000Z",
  businessName: "Logic Caffeine",
  criticalIssues: 2,
  estimatedOrganicTraffic: 120,
  normalizedDomain: "logicaffeine.com",
  rankingKeywords: 7,
  tasks: [
    { category: "content", status: "complete", task_type: "keyword_review" },
    { category: "technical", status: "todo", task_type: "technical_review" },
  ],
  usableKeywords: 50,
};

describe("GamePlanView", () => {
  it("renders Fable's calm executive-plan hierarchy without execution clutter", async () => {
    const html = renderToStaticMarkup(<GamePlanView auditHref="/audits/audit-1" lastUpdated="Aug 2, 2026" plan={await buildGamePlan(input)} />);

    expect(html).toContain("Game Plan");
    expect(html).toContain("the why");
    expect(html).toContain("Roadmap");
    expect(html).toContain("the when");
    expect(html).toContain("This Week");
    expect(html).toContain("the doing");
    expect(html).toContain("Your 90-day SEO game plan");
    expect(html).toContain("The four plays");
    expect(html).toContain("What to expect, month by month");
    expect(html).toContain("What this plan does and doesn’t cover");
    expect(html).toContain("Share this plan");
    expect(html).toContain('href="/audits/audit-1"');
    expect(html).toContain('href="/roadmap"');
    expect(html).toContain('href="/this-week"');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("milestones complete");
    expect(html).not.toContain("Honest forecast ranges");
    expect(html).not.toContain("Review keyword strategy");
  });

  it("leaves the single page H1 to the workspace shell by rendering its hero heading as an H2", async () => {
    const html = renderToStaticMarkup(<GamePlanView auditHref="/audits/audit-1" lastUpdated="Aug 2, 2026" plan={await buildGamePlan(input)} />);

    expect(html).not.toContain("<h1");
    expect(html).toContain('<h2 class="game-plan-hero-title">Your 90-day SEO game plan</h2>');
  });

  it("moves conflicting business identity confirmation into the share flow", async () => {
    const plan = await buildGamePlan({ ...input, businessName: "DatacenterDotDev Inc." });
    const html = renderToStaticMarkup(<GamePlanView auditHref="/audits/audit-1" lastUpdated="Aug 2, 2026" plan={plan} />);

    expect(html).toContain("You’ll confirm your business name before anything is shared");
    expect(html).toContain("Share this plan");
    expect(html).toContain("Confirm business details");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("DatacenterDotDev");
  });
});
