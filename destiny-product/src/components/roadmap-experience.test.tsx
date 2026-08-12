import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildSeoRoadmap } from "../lib/product/roadmap";
import { buildWeeklyProgressSummary } from "../lib/quests/streak";
import { RoadmapExperience } from "./roadmap-experience";

describe("RoadmapExperience hierarchy", () => {
  it("leads with one Apple Clarity journey, one current position, and one next action", async () => {
    const roadmap = await buildSeoRoadmap({ auditComplete: true, quests: [
      { id: "keywords", title: "Approve priority keywords", description: "Choose the strongest opportunities.", action_path: "/keywords", task_type: "keyword_review", status: "complete", verification_status: "unverified", week_number: 1, priority: 1 },
      { id: "content", title: "Publish your first guide", description: "Create the next useful page.", action_path: "/content", task_type: "content_review", status: "in_progress", verification_status: "unverified", week_number: 1, priority: 2 },
      { id: "technical", title: "Fix the first technical issue", description: "Complete the guided website fix.", action_path: "/audits/audit-1", task_type: "technical_review", status: "todo", verification_status: "unverified", week_number: 2, priority: 3 },
      { id: "reviews", title: "Ask three customers for a Google review", description: "Build visible proof.", category: "reviews", action_path: "/results", task_type: "primary_quest", status: "todo", verification_status: "unverified", week_number: 3, priority: 4 },
      { id: "reddit", title: "Answer a relevant Reddit thread", description: "Help someone with a useful answer.", action_path: "/distribution", task_type: "community_distribution", status: "todo", verification_status: "unverified", week_number: 5, priority: 5 },
    ], searchConsole: null, analytics: null });
    const weekly = await buildWeeklyProgressSummary([]);
    const html = renderToStaticMarkup(<RoadmapExperience roadmap={roadmap} weekly={weekly} />);

    expect(html).toContain("A clear path to being found");
    expect(html).toContain("Get ready to be found");
    expect(html).toContain("Build visibility");
    expect(html).toContain("Grow what works");
    expect(html).toContain("You are here");
    expect(html).toContain("1 of 5 tasks done");
    expect(html).toContain("Your next step");
    expect(html).toContain('class="apple-roadmap-next"');
    expect(html.indexOf("You are here")).toBeLessThan(html.indexOf("Your momentum history"));
    expect(html).toContain("How progress works");
    expect(html).toContain("Your momentum history");
    expect(html).toContain("Your journey");
    expect(html).toContain("Approve priority keywords");
    expect(html).toContain("Publish your first guide");
    expect(html).toContain('data-roadmap-action="keywords" href="/keywords">Review</a>');
    expect(html).toContain('data-roadmap-action="content" href="/content">Do this step</a>');
    expect(html).toContain('data-roadmap-action="technical" href="/audits/audit-1">Open step</a>');
    expect(html).toContain('data-roadmap-action="reviews" href="/reviews">Open step</a>');
    expect(html).toContain('data-roadmap-signal-action="pages-indexed" href="/integrations">Connect Search Console</a>');
    expect(html).not.toContain('data-roadmap-action="reddit"');
    expect(html).not.toContain('data-roadmap-signal-action="first-impressions"');
    expect(html).toContain("Your steps");
    expect(html).toContain("Signs it’s working");
    expect(html).not.toContain("Next landmark:");
    expect(html).not.toContain("Effort node");
    expect(html).not.toContain("Outcome node");
  });
});
