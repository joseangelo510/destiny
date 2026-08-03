import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildSeoRoadmap } from "../lib/product/roadmap";
import { buildWeeklyProgressSummary } from "../lib/quests/streak";
import { RoadmapExperience } from "./roadmap-experience";

describe("RoadmapExperience hierarchy", () => {
  it("leads with one Apple Clarity journey, one current position, and one next action", () => {
    const roadmap = buildSeoRoadmap({ auditComplete: true, quests: [], searchConsole: null, analytics: null });
    const weekly = buildWeeklyProgressSummary([]);
    const html = renderToStaticMarkup(<RoadmapExperience roadmap={roadmap} weekly={weekly} />);

    expect(html).toContain("A clear path to being found");
    expect(html).toContain("Get ready to be found");
    expect(html).toContain("Build visibility");
    expect(html).toContain("Grow what works");
    expect(html).toContain("You are here");
    expect(html).toContain("Your next step");
    expect(html).toContain('class="apple-roadmap-next"');
    expect(html.indexOf("You are here")).toBeLessThan(html.indexOf("Your momentum history"));
    expect(html).toContain("How progress works");
    expect(html).toContain("Your momentum history");
    expect(html).toContain("Your steps");
    expect(html).toContain("Signs it’s working");
    expect(html).not.toContain("Next landmark:");
    expect(html).not.toContain("Effort node");
    expect(html).not.toContain("Outcome node");
  });
});
