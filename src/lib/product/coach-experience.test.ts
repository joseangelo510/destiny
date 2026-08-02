import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEEKLY_TASK_LIMIT,
  buildAuditNarrative,
  completionPresentation,
  getCoachTaskWindow,
  orderCoachTasks,
  PRIMARY_NAVIGATION,
  FEATURE_NAVIGATION,
} from "./coach-experience";

const tasks = [
  { id: "content", task_type: "content_review", status: "todo", verification_status: "unverified", priority: 1 },
  { id: "llm", task_type: "measurement", status: "todo", verification_status: "unverified", priority: 3 },
  { id: "business", task_type: "business_confirmation", status: "todo", verification_status: "unverified", priority: 1 },
  { id: "distribution", task_type: "distribution", status: "todo", verification_status: "unverified", priority: 2 },
  { id: "fix", task_type: "primary_quest", status: "todo", verification_status: "unverified", priority: 1 },
];

describe("Destiny SEO coach experience", () => {
  it("visually separates the three coaching destinations from visible feature pages", () => {
    expect(PRIMARY_NAVIGATION.map((item) => item.label)).toEqual([
      "This week",
      "Results",
      "Settings & connections",
    ]);
    expect(FEATURE_NAVIGATION.map((item) => item.label)).toEqual([
      "Website audits",
      "Six-month plan",
      "Content studio",
      "Keyword evidence",
      "Distribution",
      "Reviews",
      "Analytics",
      "LLM visibility",
    ]);
  });

  it("starts everyone with three ordered coach tasks and keeps contextual work available", () => {
    expect(DEFAULT_WEEKLY_TASK_LIMIT).toBe(3);
    expect(orderCoachTasks(tasks).map((task) => task.id)).toEqual([
      "business",
      "fix",
      "content",
      "distribution",
      "llm",
    ]);
    expect(getCoachTaskWindow(tasks, false).map((task) => task.id)).toEqual(["business", "fix", "content"]);
    expect(getCoachTaskWindow(tasks, true)).toHaveLength(5);
  });

  it("opens results with a plain-language narrative instead of a score", () => {
    expect(buildAuditNarrative({
      businessName: "Maya Torres Realty",
      issues: [
        { code: "missing_title", label: "important pages are missing clear search titles", severity: "critical" },
        { code: "slow_mobile", label: "mobile pages load slowly", severity: "warning" },
      ],
      primaryTaskTitle: "Rewrite the homepage title",
    })).toEqual({
      eyebrow: "Your clearest next move",
      title: "Important pages are missing clear search titles.",
      explanation: "Fix this first so Maya Torres Realty has a stronger foundation for every content and visibility task that follows.",
      actionLabel: "Review your first task",
    });
  });

  it("distinguishes self-reported completion from Destiny verification", () => {
    expect(completionPresentation({ status: "complete", verification_status: "unverified" })).toEqual({
      label: "Marked complete",
      tone: "reported",
      detail: "You marked this task complete. Destiny has not verified the change yet.",
    });
    expect(completionPresentation({ status: "complete", verification_status: "verified" })).toEqual({
      label: "Destiny verified",
      tone: "verified",
      detail: "Destiny verified this change using connected or crawl evidence.",
    });
  });
});
