import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RoadmapExperience } from "../../components/roadmap-experience";
import { REAL_USER_ZERO_HISTORY } from "../quests/fixtures/real-user-zero-history";
import { buildWeeklyProgressSummary } from "../quests/streak";
import { buildAiVisibilityProgress } from "../llm/progress";
import { buildLlmSourceProgress } from "../llm/source-progress";
import { buildSeoRoadmap } from "./roadmap";

describe("LOGOS progress and roadmap golden flow", () => {
  it("replays sanitized user-zero task history through roadmap, AI readiness, source progress, and rendering", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const quests = REAL_USER_ZERO_HISTORY.map((task, index) => ({
      id: `user-zero-${index}`,
      title: task.task_type.replaceAll("_", " "),
      description: "Saved user-zero task evidence",
      action_path: "/this-week",
      task_type: task.task_type,
      status: task.status,
      verification_status: task.task_type === "business_confirmation" ? "verified" : "unverified",
      week_number: task.week_number,
      priority: index + 1,
    }));
    const roadmap = await buildSeoRoadmap({ auditComplete: true, quests, searchConsole: null, analytics: null });
    const weekly = await buildWeeklyProgressSummary(REAL_USER_ZERO_HISTORY, new Date("2026-08-03T12:00:00Z"));
    const ai = await buildAiVisibilityProgress({ quests, llmVisibility: { status: "available", totalMentions: 0, platforms: [] } });
    const sources = await buildLlmSourceProgress({ records: [], llmVisibility: { status: "available", totalMentions: 0, platforms: [] } });
    const html = renderToStaticMarkup(<RoadmapExperience roadmap={roadmap} weekly={weekly} />);

    expect(roadmap.nodes.map((node) => node.state)).toEqual(["complete", "complete", "current", "locked", "locked", "locked", "locked", "locked", "locked"]);
    expect(roadmap.currentNode?.id).toBe("pages-indexed");
    expect(roadmap.effortCompleted).toBe(2);
    expect(roadmap.currentTask?.state).toBe("current");
    expect(ai).toMatchObject({ readiness: { completed: 1, total: 3 }, verifiedVisibility: { detected: false, evidenceAvailable: true }, nextStep: { id: "trusted-platform-presence" } });
    expect(sources).toMatchObject({ readiness: { completed: 0, total: 27, percent: 0 }, publicProof: { attached: 0, possible: 8, percent: 0 }, verifiedVisibility: { detected: false } });
    expect(sources.nextTask).toMatchObject({ sourceKey: "owned-site", policyState: "current" });
    expect(html).toContain("Get ready to be found");
    expect(html).toContain("You are here");
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"event":"logos_progress_roadmap"'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"fallbacks":0'));
  });

  it("pins outcome thresholds at their exact boundaries", async () => {
    const roadmap = await buildSeoRoadmap({
      auditComplete: true,
      quests: [
        { task_type: "primary_quest", status: "complete", verification_status: "verified" },
        { task_type: "content_review", status: "complete", verification_status: "verified" },
      ],
      searchConsole: { impressions: 1, clicks: 25, topQueries: [{ position: 10 }] },
      analytics: { organicKeyEvents: 1 },
    });
    expect(roadmap.nodes.every((node) => node.state === "complete")).toBe(true);
    expect(roadmap.currentNode).toBeNull();
  });

  it("separates verified effort from zero outcome evidence and flags an absent provider", async () => {
    const quests = [
      { task_type: "primary_quest", status: "complete", verification_status: "verified" },
      { task_type: "content_review", status: "complete", verification_status: "verified" },
    ];
    const zeroEvidence = await buildSeoRoadmap({ auditComplete: true, quests, searchConsole: { impressions: 0, clicks: 0, topQueries: [] }, analytics: { organicKeyEvents: 0 } });
    expect(zeroEvidence.nodes.slice(0, 2).map((node) => node.state)).toEqual(["complete", "complete"]);
    expect(zeroEvidence.nodes[2].state).toBe("current");
    expect(zeroEvidence.dataQuality).toBe("complete");
    const absent = await buildSeoRoadmap({ auditComplete: true, quests, searchConsole: null, analytics: null });
    expect(absent.dataQuality).toBe("provider_missing");
    expect(absent.nodes).toHaveLength(9);
  });

  it("keeps readiness ties deterministic and handles an all-excluded coaching plan", async () => {
    const first = await buildAiVisibilityProgress({ quests: [], llmVisibility: {} });
    const second = await buildAiVisibilityProgress({ quests: [], llmVisibility: {} });
    expect(first.nextStep.id).toBe("owned-source-content");
    expect(second.nextStep.id).toBe(first.nextStep.id);
    const { buildCoachTaskSet } = await import("./coach-experience");
    const coach = await buildCoachTaskSet([
      { id: "confirmation", task_type: "business_confirmation", status: "complete", priority: 1 },
      { id: "vocabulary", task_type: "vocabulary_review", status: "complete", priority: 2 },
      { id: "measurement", task_type: "measurement", status: "todo", priority: 3 },
    ]);
    expect(coach).toMatchObject({ actionable: [], window: [], currentTask: null, groups: [] });
  });
});
