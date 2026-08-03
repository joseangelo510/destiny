import { describe, expect, it } from "vitest";
import { buildSeoRoadmap } from "./roadmap";

describe("truthful SEO adventure roadmap", () => {
  it("moves effort progress for completed tasks without letting outcome evidence move the marker", () => {
    const quests = [
      { id: "keywords", title: "Approve priority keywords", description: "Choose the strongest opportunities.", action_path: "/keywords", task_type: "keyword_review", status: "complete", verification_status: "unverified", week_number: 1, priority: 1 },
      { id: "content", title: "Publish your first guide", description: "Turn the approved topic into a useful page.", action_path: "/content", task_type: "content_review", status: "todo", verification_status: "unverified", week_number: 1, priority: 2 },
      { id: "reddit", title: "Answer a relevant Reddit question", description: "Help a searcher in context.", action_path: "/distribution", task_type: "community_distribution", status: "todo", verification_status: "unverified", week_number: 2, priority: 3 },
      { id: "reviews", title: "Request three customer reviews", description: "Build visible proof.", action_path: "/reviews", task_type: "reviews", status: "todo", verification_status: "unverified", week_number: 3, priority: 4 },
    ];
    const withoutEvidence = buildSeoRoadmap({ auditComplete: true, quests, searchConsole: null, analytics: null });
    const withEvidence = buildSeoRoadmap({
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
      ["Request three customer reviews"],
    ]);
  });

  it("keeps effort completion distinct from verified outcome evidence", () => {
    const roadmap = buildSeoRoadmap({
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

  it("unlocks outcome nodes only from connected search and conversion evidence", () => {
    const roadmap = buildSeoRoadmap({
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
  });

  it("uses 30-day phase windows that fit a 90-day initial plan", () => {
    const roadmap = buildSeoRoadmap({ auditComplete: false, quests: [], searchConsole: null, analytics: null });

    expect(roadmap.phases.map((phase) => phase.timing)).toEqual(["Days 1–30", "Days 31–60", "Days 61–90"]);
  });

  it("requires multiple verified signals before claiming compounding authority", () => {
    const roadmap = buildSeoRoadmap({
      auditComplete: true,
      quests: [{ task_type: "primary_quest", status: "complete", verification_status: "verified" }],
      searchConsole: { impressions: 5000, clicks: 25, topQueries: [{ query: "local realtor", position: 4.2 }] },
      analytics: { organicKeyEvents: 2 },
    });

    expect(roadmap.nodes.find((node) => node.id === "compounding-authority")?.state).toBe("complete");
    expect(roadmap.completedCount).toBe(8);
  });
});
