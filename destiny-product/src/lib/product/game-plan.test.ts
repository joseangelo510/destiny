import { describe, expect, it } from "vitest";
import { buildGamePlan, businessIdentityMatchCount } from "./game-plan";

describe("90-Day Game Plan", () => {
  it("uses a confirmed business name when it matches the website identity", () => {
    expect(businessIdentityMatchCount({
      businessName: "Logic Caffeine",
      normalizedDomain: "logicaffeine.com",
    })).toBe(1);
  });

  it("never exports a conflicting business name", () => {
    expect(businessIdentityMatchCount({
      businessName: "DatacenterDotDev Inc.",
      normalizedDomain: "logicaffeine.com",
    })).toBe(0);
  });

  it("builds a distinct executive plan instead of another weekly checklist", async () => {
    const plan = await buildGamePlan({
      auditCompletedAt: "2026-08-02T20:10:55.000Z",
      businessName: "Logic Caffeine",
      normalizedDomain: "logicaffeine.com",
      criticalIssues: 2,
      rankingKeywords: 7,
      estimatedOrganicTraffic: 120,
      approvedKeywords: 18,
      usableKeywords: 50,
      tasks: [
        { category: "content", status: "complete", task_type: "keyword_review" },
        { category: "content", status: "todo", task_type: "content_review" },
        { category: "technical", status: "todo", task_type: "technical_review" },
        { category: "reviews", status: "todo", task_type: "primary_quest" },
      ],
    });

    expect(plan.title).toBe("Logic Caffeine’s 90-Day SEO Game Plan");
    expect(plan.months).toHaveLength(3);
    expect(plan.plays.map((play) => play.title)).toEqual([
      "Own valuable customer searches",
      "Answer the questions customers ask",
      "Strengthen the website foundation",
      "Build trust across the web",
    ]);
    expect(plan.forecasts.every((forecast) => forecast.kind === "projection")).toBe(true);
    expect(plan.forecastDisclaimer).toMatch(/cannot be guaranteed/i);
    expect(plan.scope.outThisQuarter).toContain("Guaranteed page-one rankings or traffic promises");
    expect(plan.taskProgress).toEqual({ complete: 1, total: 4 });
    expect(plan.canExport).toBe(true);
  });

  it("uses LOGOS to floor zero-demand forecasts and downgrade incomplete evidence", async () => {
    const plan = await buildGamePlan({
      businessName: "Unknown", normalizedDomain: "example.com", criticalIssues: 0, rankingKeywords: 0,
      estimatedOrganicTraffic: 0, approvedKeywords: 0, usableKeywords: 0, tasks: [], dataQualityFlags: 1,
    });
    expect(plan.canExport).toBe(false);
    expect(plan.forecasts[0].expectedRange).toBe("0–0 priority themes actively targeted");
    expect(plan.forecasts.at(-1)?.confidence).toMatch(/limited confidence/i);
  });
});
