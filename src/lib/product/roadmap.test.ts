import { describe, expect, it } from "vitest";
import { buildSeoRoadmap } from "./roadmap";

describe("truthful SEO adventure roadmap", () => {
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
