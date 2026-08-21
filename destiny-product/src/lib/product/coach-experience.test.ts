import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEEKLY_TASK_LIMIT,
  buildAuditNarrative,
  buildGuidedFix,
  buildCoachTaskSet,
  completionPresentation,
  guidedTaskPath,
  PRIMARY_NAVIGATION,
  FEATURE_NAVIGATION,
  taskRoadmapTarget,
} from "./coach-experience";

const tasks = [
  { id: "content", task_type: "content_review", status: "todo", verification_status: "unverified", priority: 1 },
  { id: "legacy-analysis", task_type: "measurement", status: "todo", verification_status: "unverified", priority: 3 },
  { id: "technical", task_type: "technical_review", status: "todo", verification_status: "unverified", priority: 3 },
  { id: "business", task_type: "business_confirmation", status: "todo", verification_status: "unverified", priority: 1 },
  { id: "keywords", task_type: "keyword_review", status: "todo", verification_status: "unverified", priority: 1 },
  { id: "community", task_type: "community_distribution", status: "todo", verification_status: "unverified", priority: 2 },
  { id: "social", task_type: "social_distribution", status: "todo", verification_status: "unverified", priority: 2 },
  { id: "fix", task_type: "primary_quest", status: "todo", verification_status: "unverified", priority: 1 },
];

describe("Destiny SEO coach experience", () => {
  it("visually separates the four coaching destinations from visible feature pages", () => {
    expect(PRIMARY_NAVIGATION.map((item) => item.label)).toEqual([
      "This week",
      "Roadmap",
      "Game Plan",
      "Analytics",
    ]);
    expect(FEATURE_NAVIGATION.map((item) => item.label)).toEqual([
      "Home",
      "Website audits",
      "Content studio",
      "Infographic generator",
      "Editorial calendar",
      "Keyword strategy",
      "Keyword research",
      "Rank tracker",
      "Backlink analytics",
      "Distribution",
      "Reviews",
      "Connections",
      "LLM visibility",
    ]);
  });

  it("keeps review work in trust-building instead of Technical SEO", async () => {
    const reviewQuest = {
      id: "review-quest",
      task_type: "primary_quest",
      category: "reviews",
      status: "todo",
      verification_status: "unverified",
      priority: 1,
    };

    expect((await buildCoachTaskSet([reviewQuest])).groups.map((group) => [group.id, group.tasks.map((task) => task.id)])).toEqual([
      ["distribution", ["review-quest"]],
    ]);
  });

  it("shows the truthful roadmap destination each coaching task advances", () => {
    expect(taskRoadmapTarget("primary_quest")).toBe("Get ready to be found");
    expect(taskRoadmapTarget("content_review")).toBe("Get ready to be found");
    expect(taskRoadmapTarget("community_distribution")).toBe("Build visibility");
    expect(taskRoadmapTarget("directory_growth")).toBe("Grow what works");
    expect(taskRoadmapTarget("technical_review")).toBe("Get ready to be found");
  });

  it("removes the redundant business confirmation and groups all actionable work", async () => {
    const coach = await buildCoachTaskSet(tasks, false);
    expect(DEFAULT_WEEKLY_TASK_LIMIT).toBe(8);
    expect(coach.actionable.map((task) => task.id)).toEqual(["keywords", "fix", "content", "community", "social", "technical"]);
    expect(coach.window.map((task) => task.id)).toEqual(["keywords", "fix", "content", "community", "social", "technical"]);
    expect(coach.groups.map((group) => [group.id, group.tasks.map((task) => task.id)])).toEqual([
      ["research-strategy", ["keywords"]],
      ["content-creation", ["content"]],
      ["distribution", ["community", "social"]],
      ["technical-seo", ["fix", "technical"]],
    ]);
  });

  it("opens results with a plain-language narrative instead of a score", () => {
    expect(buildAuditNarrative({
      businessName: "Maya Torres Realty",
      issues: [
        { code: "has_render_blocking_resources", label: "Page has render-blocking resources", severity: "critical" },
        { code: "slow_mobile", label: "mobile pages load slowly", severity: "warning" },
      ],
      primaryTaskTitle: "Rewrite the homepage title",
    })).toEqual({
      eyebrow: "Your clearest next move",
      title: "Make your homepage load faster for visitors.",
      explanation: "Some behind-the-scenes website files make people wait before they can see your page. Loading the most important parts first helps visitors get there sooner. This can make people leave and can weaken search performance for Maya Torres Realty.",
      actionLabel: "Show me how to fix this",
    });
  });

  it("turns technical findings into a guided, non-technical fix", () => {
    expect(buildGuidedFix({ code: "has_render_blocking_resources", label: "Page has render-blocking resources" })).toEqual({
      title: "Make your homepage load faster for visitors",
      explanation: "Some behind-the-scenes website files make people wait before they can see your page. Loading the most important parts first helps visitors get there sooner.",
      steps: [
        "Open your homepage in Google PageSpeed Insights and find the section about files delaying the first view of the page.",
        "Ask your website developer or site builder to load the visible page first and delay any files that are not needed right away.",
        "Run a fresh Destiny audit after the change so Destiny can verify the improvement.",
      ],
    });
    expect(guidedTaskPath({ task_type: "primary_quest", action_path: "/audits/abc" })).toBe("/audits/abc#recommended-fix");
  });

  it("sends review-led guided work to Reviews while preserving every other task destination", () => {
    expect(guidedTaskPath({ task_type: "primary_quest", category: "reviews", action_path: "/audits/abc#recommended-fix" })).toBe("/reviews");
    expect(guidedTaskPath({ task_type: "reviews", category: "reviews", action_path: "/this-week" })).toBe("/reviews");
    expect(guidedTaskPath({ task_type: "keyword_review", category: "content", action_path: "/keywords" })).toBe("/keywords");
    expect(guidedTaskPath({ task_type: "content_review", category: "content", action_path: "/content" })).toBe("/content");
    expect(guidedTaskPath({ task_type: "community_distribution", category: "distribution", action_path: "/distribution#community" })).toBe("/distribution#community");
    expect(guidedTaskPath({ task_type: "social_distribution", category: "distribution", action_path: "/distribution#social" })).toBe("/distribution#social");
    expect(guidedTaskPath({ task_type: "publisher_outreach", category: "distribution", action_path: "/distribution#outreach" })).toBe("/distribution#outreach");
    expect(guidedTaskPath({ task_type: "directory_growth", category: "distribution", action_path: "/distribution#directories" })).toBe("/distribution#directories");
    expect(guidedTaskPath({ task_type: "technical_review", category: "technical", action_path: "/audits/abc#technical-evidence" })).toBe("/audits/abc#technical-evidence");
    expect(guidedTaskPath({ task_type: "primary_quest", category: "technical", action_path: "/this-week" })).toBe("/this-week");
    expect(guidedTaskPath({ task_type: "primary_quest", category: "technical", action_path: "/results" })).toBe("/results");
  });

  it("backs every guided destination with a real page and every deep link with a real section", () => {
    expect(existsSync(new URL("../../app/keywords/page.tsx", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../../app/content/page.tsx", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../../app/reviews/page.tsx", import.meta.url))).toBe(true);

    const distribution = readFileSync(new URL("../../app/distribution/page.tsx", import.meta.url), "utf8");
    for (const id of ["community", "social", "outreach", "directories"]) {
      expect(distribution).toContain(`id="${id}"`);
    }

    const audit = readFileSync(new URL("../../app/audits/[id]/page.tsx", import.meta.url), "utf8");
    expect(audit).toContain('id="recommended-fix"');
    expect(audit).toContain('id="technical-evidence"');
  });

  it("distinguishes self-reported completion from Destiny verification", () => {
    expect(completionPresentation({ status: "complete", verification_status: "unverified" })).toEqual({
      label: "Marked done by you",
      tone: "reported",
      detail: "You marked this done. Destiny will check it when automatic verification is available.",
    });
    expect(completionPresentation({ status: "complete", verification_status: "verified" })).toEqual({
      label: "Verified by Destiny",
      tone: "verified",
      detail: "Destiny checked the available site or connected data and confirmed this change.",
    });
  });

  it("keeps one current task in focus and preserves work already in progress", async () => {
    expect((await buildCoachTaskSet([
      { id: "keywords", task_type: "keyword_review", status: "todo", verification_status: "unverified", priority: 1 },
      { id: "content", task_type: "content_review", status: "in_progress", verification_status: "unverified", priority: 1 },
      { id: "fix", task_type: "primary_quest", status: "todo", verification_status: "unverified", priority: 1 },
    ])).currentTask?.id).toBe("content");
    expect((await buildCoachTaskSet(tasks)).currentTask?.id).toBe("keywords");
    expect((await buildCoachTaskSet(tasks.map((task) => ({ ...task, status: "complete" })))).currentTask).toBeNull();
  });

  it("keeps future waiting and blocked work out of the one-task focus while preserving it for follow-up", async () => {
    const coach = await buildCoachTaskSet([
      { id: "waiting", task_type: "keyword_review", status: "todo", verification_status: "unverified", guidance_state: "waiting", follow_up_at: "2999-01-01T00:00:00.000Z", priority: 1 },
      { id: "blocked", task_type: "content_review", status: "todo", verification_status: "unverified", guidance_state: "blocked", priority: 2 },
      { id: "current", task_type: "primary_quest", status: "todo", verification_status: "unverified", guidance_state: "active", priority: 1 },
    ]);
    expect(coach.currentTask?.id).toBe("current");
    expect(coach.pausedTasks.map((task) => task.id)).toEqual(["waiting", "blocked"]);
  });
});
