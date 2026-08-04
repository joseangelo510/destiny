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
  it("renders the executive plan hierarchy without weekly checkboxes", () => {
    const html = renderToStaticMarkup(<GamePlanView auditHref="/audits/audit-1" lastUpdated="Aug 2, 2026" plan={buildGamePlan(input)} />);

    expect(html).toContain("Four focused plays");
    expect(html).toContain("Three months at a glance");
    expect(html).toContain("Scope of work");
    expect(html).toContain("Honest forecast ranges");
    expect(html).toContain("Export plan (PDF)");
    expect(html).toContain('href="/audits/audit-1"');
    expect(html).not.toContain('type="checkbox"');
  });

  it("blocks export and suppresses a conflicting stored business name", () => {
    const plan = buildGamePlan({ ...input, businessName: "DatacenterDotDev Inc." });
    const html = renderToStaticMarkup(<GamePlanView auditHref="/audits/audit-1" lastUpdated="Aug 2, 2026" plan={plan} />);

    expect(html).toContain("Destiny found conflicting business details");
    expect(html).toContain("Logicaffeine’s 90-Day SEO Game Plan");
    expect(html).toContain("Confirm details to export");
    expect(html).not.toContain("DatacenterDotDev");
  });
});
