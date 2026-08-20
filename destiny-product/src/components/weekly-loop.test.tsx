import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { runDestinyLogic } from "../lib/logicaffeine";
import { buildCoachTaskSet } from "../lib/product/coach-experience";
import { JUNKIT_RECOMMENDATION_FIXTURE } from "../../supabase/functions/process-audit/fixtures/98junkit-recommendation";
import { WeeklyLoop } from "./weekly-loop";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const task = (overrides: Partial<{
  id: string;
  title: string;
  task_type: string;
  status: string;
  action_path: string;
}> = {}) => ({
  id: "keyword-task",
  title: "Approve your priority keywords",
  description: "Choose the searches with the clearest path to customers.",
  status: "todo",
  action_path: "/keywords",
  estimated_minutes: 12,
  requires_approval: true,
  external_url: null,
  task_type: "keyword_review",
  verification_status: "unverified",
  verification_method: null,
  verified_at: null,
  ...overrides,
});

const groups = [
  {
    id: "research-strategy",
    label: "Research & strategy",
    description: "Choose the opportunities most likely to bring qualified customers.",
    taskTypes: ["keyword_review"],
    tasks: [task()],
  },
  {
    id: "content-creation",
    label: "Content creation",
    description: "Turn your expertise into useful pages customers can discover.",
    taskTypes: ["content_review"],
    tasks: [task({ id: "content-task", title: "Review your first article", task_type: "content_review" })],
  },
  {
    id: "distribution",
    label: "Distribution",
    description: "Bring approved expertise to the places customers already spend time.",
    taskTypes: ["community_distribution"],
    tasks: [],
  },
  {
    id: "technical-seo",
    label: "Technical SEO",
    description: "Fix crawlability, indexing, page structure, and performance issues.",
    taskTypes: ["primary_quest", "technical_review"],
    tasks: [task({ id: "technical-task", title: "Run a PageSpeed and deeper technical check", task_type: "technical_review" })],
  },
];

describe("WeeklyLoop", () => {
  it("renders the calm four-step map with every category preview and the recommended checklist", () => {
    const mapGroups = groups.map((group) => group.id === "distribution"
      ? { ...group, tasks: [task({ id: "distribution-task", title: "Share your approved article", task_type: "social_distribution", action_path: "/distribution#social" })] }
      : group.id === "technical-seo"
      ? { ...group, tasks: [
        task({ id: "technical-task", title: "Run a PageSpeed and deeper technical check", task_type: "technical_review", action_path: "/audits/audit-1#technical-evidence" }),
        task({ id: "technical-follow-up", title: "Review the technical findings", task_type: "technical_review", action_path: "/audits/audit-1#technical-evidence" }),
      ] }
      : group);
    const html = renderToStaticMarkup(<WeeklyLoop auditId="audit-1" currentStreak={2} currentTaskId="content-task" groups={mapGroups} remainingTasks={4} />);

    expect(html).toContain("Choose a category to see its complete checklist.");
    expect(html).not.toContain("Four kinds of work build your visibility");
    expect(html).toContain('aria-label="Weekly plan categories"');
    expect(html).toContain("1");
    expect(html).toContain("2");
    expect(html).toContain("3");
    expect(html).toContain("4");
    for (const label of ["Research &amp; strategy", "Content creation", "Distribution", "Technical SEO"]) expect(html).toContain(label);
    for (const preview of ["Approve your priority keywords", "Review your first article", "Share your approved article", "Run a PageSpeed and deeper technical check"]) expect(html).toContain(preview);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Step 2");
    expect(html).toContain("Ready to start");
    expect((html.match(/Review your first article/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((html.match(/0 of 5 weekly tasks complete/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(html).not.toContain("Data analysis");
    expect(html).toContain("See full audit details");
    expect(html).toContain('href="/audits/audit-1"');
  });

  it("keeps empty categories visible and labels their checklist honestly", () => {
    const html = renderToStaticMarkup(<WeeklyLoop auditId="audit-1" currentStreak={2} groups={groups} remainingTasks={2} />);

    expect(html).toContain("Distribution");
    expect(html).toContain("No task needed here this week.");
    expect(html).toContain("0 tasks");
  });

  it("renders every real task in the selected category checklist with its saved destination", () => {
    const technicalGroups = groups.map((group) => group.id === "technical-seo"
      ? { ...group, tasks: [
        task({ id: "technical-task", title: "Run a PageSpeed and deeper technical check", task_type: "technical_review", action_path: "/audits/audit-1#technical-evidence" }),
        task({ id: "technical-follow-up", title: "Review the technical findings", task_type: "technical_review", action_path: "/audits/audit-1#technical-evidence" }),
      ] }
      : group);
    const html = renderToStaticMarkup(<WeeklyLoop auditId="audit-1" currentStreak={2} currentTaskId="technical-task" groups={technicalGroups} remainingTasks={3} />);

    expect(html).toContain("Step 4");
    expect(html).toContain('data-task-id="technical-task" open=""');
    expect(html).toContain('data-task-id="technical-follow-up"');
    expect(html.split('href="/audits/audit-1#technical-evidence"')).toHaveLength(3);
    expect(html).toContain("12 min");
  });

  it("keeps the category map interaction local to the weekly surface", async () => {
    const source = await readFile(new URL("./weekly-loop.tsx", import.meta.url), "utf8");

    expect(source).toContain('onClick={() => setActiveGroupId(group.id)}');
    expect(source).toContain('type="button"');
    expect(source).toContain("weekly-map-focus-panel");
    expect(source).not.toContain("weekly-loop-tabs");
    expect(source).not.toContain("weekly-loop-task-pane");
  });

  it("stacks the complete selector above the focus panel on mobile without horizontal overflow", async () => {
    const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

    expect(css).toContain(".weekly-map-layout");
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*\.weekly-map-layout \{[^}]*grid-template-columns: 1fr/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*\.weekly-map-path \{[^}]*overflow: visible/);
  });

  it("keeps the one-time post-audit plan reveal available", () => {
    const html = renderToStaticMarkup(<WeeklyLoop auditId="audit-1" currentStreak={0} groups={groups} initialRevealOpen remainingTasks={2} />);

    expect(html).toContain("Your audit is complete");
    expect(html).toContain("Your audit is done. Here’s your plan.");
    expect(html).not.toContain("ready this week");
    expect(html).toContain("Start: Approve your priority keywords");
    expect(html).toContain("Start here — your next move is based on what the audit found.");
    expect(html).toContain("See full audit details");
    expect(html).toContain('href="/audits/audit-1"');
    expect(html).toContain("Replay plan reveal");
  });

  it("can make the week smaller without changing or completing any task", () => {
    const html = renderToStaticMarkup(<WeeklyLoop auditId="audit-1" currentStreak={2} groups={groups} initialFocusMode remainingTasks={2} />);

    expect(html).toContain("I hear you. Let’s make this smaller.");
    expect(html).toContain("One step");
    expect(html).toContain("about 12 minutes");
    expect(html).toContain("Approve your priority keywords");
    expect(html).not.toContain("Review your first article");
    expect(html).toContain("Show my full week");
    expect(html).not.toContain('aria-label="Weekly plan categories"');
  });

  it("opens a completed-only strategy task so the saved review remains reachable", () => {
    const completedGroups = groups.map((group) => group.id === "research-strategy"
      ? { ...group, tasks: [task({ status: "complete", action_path: "/keywords" })] }
      : { ...group, tasks: [] });
    const html = renderToStaticMarkup(<WeeklyLoop auditId="audit-1" currentStreak={1} groups={completedGroups} remainingTasks={1} />);

    expect(html).toContain('data-task-id="keyword-task" open=""');
    expect(html).toContain('href="/keywords"');
    expect(html).toContain("Review saved strategy");
    expect(html).toContain("Marked done by you");
  });

  it("renders a real-audit weekly screen from the LOGOS-owned manifest", async () => {
    const bytes = await readFile(new URL("../../public/logic/destiny-logic-engine.wasm", import.meta.url));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes)));
    const logic = await runDestinyLogic(JUNKIT_RECOMMENDATION_FIXTURE.input);
    vi.unstubAllGlobals();
    const tasks = logic.weeklyTaskManifest.map((taskType, index) => ({
      id: `logos-${index}`,
      title: taskType === "primary_quest" ? logic.weeklyQuest : taskType.replaceAll("_", " "),
      description: taskType === "primary_quest" ? logic.explanation : "LOGOS selected this task for the current plan.",
      status: "todo",
      action_path: taskType === "primary_quest" ? "/audits/audit-1#recommended-fix" : `/${taskType}`,
      estimated_minutes: 15,
      requires_approval: logic.weeklyTaskApprovals[index],
      external_url: null,
      task_type: taskType,
      category: taskType === "primary_quest" ? logic.questCategory : taskType.includes("distribution") || taskType.includes("outreach") || taskType.includes("growth") ? "distribution" : "content",
      priority: logic.weeklyTaskPriorities[index],
      verification_status: "unverified",
      verification_method: null,
      verified_at: null,
    }));
    const logosGroups = (await buildCoachTaskSet(tasks)).loopGroups;
    const html = renderToStaticMarkup(<WeeklyLoop auditId="audit-1" currentStreak={0} currentTaskId="logos-1" groups={logosGroups} initialRevealOpen remainingTasks={tasks.length} />);

    expect(html).toContain("Make your homepage load faster for visitors");
    expect(html).toContain('aria-label="0 of 8 weekly tasks complete"');
    expect(html).toContain("Technical SEO");
    expect(logic.weeklyTaskManifest).toHaveLength(8);
  });
});
