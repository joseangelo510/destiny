import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildSeoRoadmap } from "../lib/product/roadmap";
import { buildWeeklyProgressSummary } from "../lib/quests/streak";
import { RoadmapExperience } from "./roadmap-experience";

describe("RoadmapExperience hierarchy", () => {
  it("leads with the current landmark and progressively discloses explanation and momentum history", () => {
    const roadmap = buildSeoRoadmap({ auditComplete: true, quests: [], searchConsole: null, analytics: null });
    const weekly = buildWeeklyProgressSummary([]);
    const html = renderToStaticMarkup(<RoadmapExperience roadmap={roadmap} weekly={weekly} />);

    expect(html.indexOf("Next landmark: Foundations")).toBeLessThan(html.indexOf("Current streak"));
    expect(html.indexOf("Next landmark: Foundations")).toBeLessThan(html.indexOf("Your SEO compass"));
    expect(html).toContain("How Destiny verifies progress");
    expect(html).toContain("Your momentum history");
    expect(html).toContain("Effort node");
    expect(html).toContain("Outcome node");
  });
});
