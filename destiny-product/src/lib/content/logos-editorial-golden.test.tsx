import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JUNKIT_GOLDEN_KEYWORDS } from "../../../supabase/functions/process-audit/fixtures/98junkit-keywords";
import { GamePlanView } from "../../components/game-plan-view";
import { buildGamePlan } from "../product/game-plan";
import { buildEditorialCalendar, selectKeywordsForCalendar } from "./editorial-calendar";

describe("98junkit LOGOS editorial and game-plan golden flow", () => {
  it("renders a deterministic 12-week plan from sanitized live audit evidence with zero fallbacks", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const context = {
      productsServices: "Residential and commercial junk removal, hauling, property cleanouts, furniture and appliance removal",
      locationEvidence: "Serving Fremont, San Jose, Livermore, Pleasanton, Redwood City, and the Bay Area",
      competitorNames: ["LoadUp", "Junkman"],
    };
    const eligible = selectKeywordsForCalendar(JUNKIT_GOLDEN_KEYWORDS, {}, context);
    const calendar = await buildEditorialCalendar(eligible, 12, "service", context);
    const gamePlan = await buildGamePlan({
      auditCompletedAt: "2026-08-02T20:10:55.000Z",
      businessName: "98 Junk It",
      normalizedDomain: "98junkit.com",
      criticalIssues: 0,
      rankingKeywords: 17,
      estimatedOrganicTraffic: 120,
      approvedKeywords: 0,
      usableKeywords: eligible.length,
      tasks: [],
    });
    const rendered = renderToStaticMarkup(<GamePlanView auditHref="/audits/junkit-golden" lastUpdated="Aug 2, 2026" plan={gamePlan} />);

    expect(calendar).toHaveLength(12);
    expect(calendar.map((item) => `${item.month}:${item.week}`)).toEqual([
      "1:1", "1:2", "1:3", "1:4", "2:1", "2:2", "2:3", "2:4", "3:1", "3:2", "3:3", "3:4",
    ]);
    expect(calendar.every((item) => item.searchVolume > 0)).toBe(true);
    expect(calendar.map((item) => item.focusKeyword)).not.toEqual(expect.arrayContaining([
      "free junk removal services", "junk removal services in usa", "loadup junk removal", "junkman junk removal",
    ]));
    expect(gamePlan).toMatchObject({
      canExport: true,
      months: [{ theme: "Build the foundation" }, { theme: "Build the content engine" }, { theme: "Expand authority" }],
    });
    expect(gamePlan.forecasts[0].expectedRange).toBe(`12–${Math.min(eligible.length, 24)} priority themes actively targeted`);
    expect(rendered).toContain("98 Junk It’s 90-Day SEO Game Plan");
    expect(rendered).toContain("Three months at a glance");
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"event":"logos_editorial_plan"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"fallbacks":0'));
  });
});
