import { describe, expect, it } from "vitest";
import { buildSeoRoadmap } from "./roadmap";

describe("truthful SEO adventure roadmap", () => {
  it("keeps every journey phase inside the included 90-day plan", async () => {
    const roadmap = await buildSeoRoadmap({ auditComplete: true, quests: [], searchConsole: null, analytics: null });

    expect(roadmap.phases.map((phase) => phase.timing)).toEqual([
      "Days 1–30",
      "Days 31–60",
      "Days 61–90",
    ]);
    expect(roadmap.phases.map((phase) => phase.timing).join(" ")).not.toMatch(/120|180/);
  });

  it("moves effort progress for completed tasks without letting outcome evidence move the marker", async () => {
    const quests = [
      { id: "keywords", title: "Approve priority keywords", description: "Choose the strongest opportunities.", action_path: "/keywords", task_type: "keyword_review", status: "complete", verification_status: "unverified", week_number: 1, priority: 1 },
      { id: "content", title: "Publish your first guide", description: "Turn the approved topic into a useful page.", action_path: "/content", task_type: "content_review", status: "todo", verification_status: "unverified", week_number: 1, priority: 2 },
      { id: "reddit", title: "Answer a relevant Reddit question", description: "Help a searcher in context.", action_path: "/distribution", task_type: "community_distribution", status: "todo", verification_status: "unverified", week_number: 2, priority: 3 },
      { id: "reviews", title: "Request three customer reviews", description: "Build visible proof.", action_path: "/reviews", task_type: "reviews", status: "todo", verification_status: "unverified", week_number: 3, priority: 4 },
    ];
    const withoutEvidence = await buildSeoRoadmap({ auditComplete: true, quests, searchConsole: null, analytics: null });
    const withEvidence = await buildSeoRoadmap({
      auditComplete: true,
      quests,
      searchConsole: { impressions: 1000, clicks: 30, topQueries: [{ query: "example", position: 7 }] },
      analytics: { organicKeyEvents: 2 },
    });

    expect(withoutEvidence.effortCompleted).toBe(1);
    expect(withoutEvidence.effortTotal).toBe(4);
    expect(withoutEvidence.effortProgress).toBe(25);
    expect(withoutEvidence.pathProgress).toBe(17);
    expect(withEvidence.effortProgress).toBe(25);
    expect(withoutEvidence.currentTask?.label).toBe("Publish your first guide");
    expect(withoutEvidence.phases.map((phase) => phase.tasks.map((task) => task.label))).toEqual([
      ["Approve priority keywords", "Publish your first guide"],
      ["Answer a relevant Reddit question"],
      ["Get reviews"],
    ]);
  });

  it("normalizes legacy review-led task titles and routes them to Reviews", async () => {
    const roadmap = await buildSeoRoadmap({
      auditComplete: true,
      quests: [
        { id: "legacy-google", title: "Ask three recent customers for a Google review", description: "Build proof.", action_path: "/audits/audit-1#recommended-fix", task_type: "primary_quest", status: "todo", week_number: 1, priority: 1 },
        { id: "legacy-request", title: "Request reviews from happy clients", description: "Build proof.", category: null, action_path: "/results", task_type: "directory_growth", status: "todo", week_number: 2, priority: 2 },
      ],
      searchConsole: null,
      analytics: null,
    });
    const tasks = roadmap.phases.flatMap((phase) => phase.tasks);

    expect(tasks.map((task) => [task.id, task.label, task.actionHref])).toEqual([
      ["legacy-google", "Get reviews", "/reviews"],
      ["legacy-request", "Get reviews", "/reviews"],
    ]);
  });

  it("keeps effort completion distinct from verified outcome evidence", async () => {
    const roadmap = await buildSeoRoadmap({
      auditComplete: true,
      quests: [
        { task_type: "primary_quest", status: "complete", verification_status: "unverified" },
        { task_type: "content_review", status: "complete", verification_status: "unverified" },
      ],
      searchConsole: null,
      analytics: null,
    });

    expect(roadmap.nodes.slice(0, 2).map((node) => [node.id, node.kind, node.state])).toEqual([
      ["foundations", "effort", "complete"],
      ["content-published", "effort", "complete"],
    ]);
    expect(roadmap.nodes.slice(2).every((node) => node.state !== "complete")).toBe(true);
    expect(roadmap.nodes.find((node) => node.id === "content-published")?.evidence).toContain("marked complete");
    expect(roadmap.nodes.find((node) => node.id === "pages-indexed")?.kind).toBe("outcome");
    expect(roadmap.nodes.find((node) => node.id === "page-two")?.label).toBe("Rankings improving");
    expect(roadmap.nodes.find((node) => node.id === "page-one")?.label).toBe("Strong search visibility");
  });

  it("unlocks outcome nodes only from connected search and conversion evidence", async () => {
    const roadmap = await buildSeoRoadmap({
      auditComplete: true,
      quests: [
        { task_type: "primary_quest", status: "complete", verification_status: "verified" },
        { task_type: "content_review", status: "complete", verification_status: "unverified" },
      ],
      searchConsole: {
        impressions: 940,
        clicks: 12,
        topQueries: [{ query: "san francisco family realtor", position: 8.4 }],
      },
      analytics: { organicKeyEvents: 1 },
    });

    expect(roadmap.nodes.filter((node) => node.state === "complete").map((node) => node.id)).toEqual([
      "foundations",
      "content-published",
      "pages-indexed",
      "first-impressions",
      "first-clicks",
      "page-two",
      "page-one",
      "first-organic-lead",
    ]);
    expect(roadmap.currentNode?.id).toBe("compounding-authority");
    expect(roadmap.nodes.find((node) => node.id === "first-clicks")?.evidence).toContain("12 clicks");
    expect(roadmap.nodes.find((node) => node.id === "pages-indexed")).toMatchObject({
      actionHref: "/analytics",
      actionLabel: "View search data",
    });
  });

  it("routes the first search-evidence action to connection setup until data exists", async () => {
    const roadmap = await buildSeoRoadmap({ auditComplete: true, quests: [], searchConsole: null, analytics: null });

    expect(roadmap.nodes.find((node) => node.id === "pages-indexed")).toMatchObject({
      actionHref: "/integrations",
      actionLabel: "Connect Search Console",
    });
  });

  it("routes every Roadmap task to the feature where the work is completed", async () => {
    const roadmap = await buildSeoRoadmap({
      auditComplete: true,
      quests: [
        { id: "keywords", category: "content", action_path: "/keywords", task_type: "keyword_review", status: "complete", week_number: 1, priority: 1 },
        { id: "content", category: "content", action_path: "/content", task_type: "content_review", status: "todo", week_number: 1, priority: 2 },
        { id: "reviews", category: "reviews", action_path: "/results", task_type: "primary_quest", status: "todo", week_number: 1, priority: 3 },
        { id: "community", category: "distribution", action_path: "/distribution#community", task_type: "community_distribution", status: "todo", week_number: 2, priority: 4 },
        { id: "social", category: "distribution", action_path: "/distribution#social", task_type: "social_distribution", status: "todo", week_number: 2, priority: 5 },
        { id: "outreach", category: "distribution", action_path: "/distribution#outreach", task_type: "publisher_outreach", status: "todo", week_number: 3, priority: 6 },
        { id: "directories", category: "distribution", action_path: "/distribution#directories", task_type: "directory_growth", status: "todo", week_number: 3, priority: 7 },
        { id: "technical", category: "technical", action_path: "/audits/audit-1#technical-evidence", task_type: "technical_review", status: "todo", week_number: 4, priority: 8 },
      ],
      searchConsole: null,
      analytics: null,
    });
    const destinations = Object.fromEntries(roadmap.phases.flatMap((phase) => phase.tasks).map((task) => [task.id, task.actionHref]));

    expect(destinations).toEqual({
      keywords: "/keywords",
      content: "/content",
      reviews: "/reviews",
      community: "/distribution#community",
      social: "/distribution#social",
      outreach: "/distribution#outreach",
      directories: "/distribution#directories",
      technical: "/audits/audit-1#technical-evidence",
    });
  });

  it("requires multiple verified signals before claiming compounding authority", async () => {
    const roadmap = await buildSeoRoadmap({
      auditComplete: true,
      quests: [{ task_type: "primary_quest", status: "complete", verification_status: "verified" }],
      searchConsole: { impressions: 5000, clicks: 25, topQueries: [{ query: "local realtor", position: 4.2 }] },
      analytics: { organicKeyEvents: 2 },
    });

    expect(roadmap.nodes.find((node) => node.id === "compounding-authority")?.state).toBe("complete");
    expect(roadmap.completedCount).toBe(8);
  });
});
