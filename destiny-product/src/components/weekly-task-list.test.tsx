import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { WeeklyTaskList } from "./weekly-task-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const baseTask = {
  description: "A useful next step.",
  status: "todo",
  action_path: "/keywords",
  estimated_minutes: 12,
  requires_approval: true,
  external_url: null,
  task_type: "keyword_review",
  verification_status: "unverified",
  verification_method: null,
  verified_at: null,
};

describe("WeeklyTaskList", () => {
  it("reserves an earned completion moment that sends momentum to the roadmap", () => {
    const source = readFileSync(new URL("./weekly-task-list.tsx", import.meta.url), "utf8");
    expect(source).toContain("celebrationMessage");
    expect(source).toContain("celebration.detail");
    expect(source).toContain('href="/roadmap"');
    expect(source).toContain("just-completed");
  });

  it("opens only the task selected by the coach instead of the first task in every category", () => {
    const html = renderToStaticMarkup(<WeeklyTaskList
      auditId="audit-1"
      openTaskId="task-2"
      tasks={[
        { ...baseTask, id: "task-1", title: "First task" },
        { ...baseTask, id: "task-2", title: "Focused task" },
      ]}
    />);

    expect((html.match(/<details[^>]* open=""/g) ?? [])).toHaveLength(1);
    expect(html).toMatch(/<details[^>]*data-task-id="task-2"[^>]*open=""/);
    expect(html).not.toMatch(/<details[^>]*data-task-id="task-1"[^>]*open=""/);
  });

  it("keeps a category collapsed when its tasks are not the selected focus", () => {
    const html = renderToStaticMarkup(<WeeklyTaskList
      auditId="audit-1"
      openTaskId="task-from-another-category"
      tasks={[{ ...baseTask, id: "task-1", title: "Later task" }]}
    />);

    expect(html).not.toMatch(/<details[^>]* open=""/);
  });

  it("does not let users skip either required Research & strategy decision", () => {
    const html = renderToStaticMarkup(<WeeklyTaskList
      auditId="audit-1"
      openTaskId="primary-task"
      tasks={[{
        ...baseTask,
        id: "primary-task",
        title: "Approve keyword direction",
        task_type: "keyword_review",
      }]}
    />);

    expect(html).not.toContain("Skip for now");
    expect(html).toContain("Review keywords");
    expect(html).toContain("Approve Destiny’s 5");
    expect(html).not.toContain("Approve &amp; complete");
    expect(html).not.toContain("finish this right now");
    expect(html).toContain("At least five recommended searches are approved");
  });

  it("keeps the skip action available for other incomplete tasks", () => {
    const html = renderToStaticMarkup(<WeeklyTaskList
      auditId="audit-1"
      openTaskId="content-task"
      tasks={[{ ...baseTask, id: "content-task", title: "Review content", task_type: "content_review" }]}
    />);

    expect(html).toContain("Skip for now");
    expect(html).not.toContain("finish this right now");
  });

  it("renders the Reviews destination for a review-led primary task", () => {
    const html = renderToStaticMarkup(<WeeklyTaskList
      auditId="audit-1"
      openTaskId="review-task"
      tasks={[{
        ...baseTask,
        id: "review-task",
        title: "Ask recent customers for a Google review",
        category: "reviews",
        task_type: "primary_quest",
        action_path: "/audits/audit-1#recommended-fix",
      }]}
    />);

    expect(html).toContain('href="/reviews"');
    expect(html).toContain("Open guided step");
    expect(html).not.toContain('href="/audits/audit-1#recommended-fix"');
  });

  it("renders a working destination for every guided Game Plan task", () => {
    const html = renderToStaticMarkup(<WeeklyTaskList
      auditId="audit-1"
      openTaskId="keywords"
      tasks={[
        { ...baseTask, id: "keywords", title: "Review keywords", category: "content", task_type: "keyword_review", action_path: "/keywords" },
        { ...baseTask, id: "content", title: "Review content", category: "content", task_type: "content_review", action_path: "/content" },
        { ...baseTask, id: "community", title: "Join a discussion", category: "distribution", task_type: "community_distribution", action_path: "/distribution#community" },
        { ...baseTask, id: "social", title: "Share an article", category: "distribution", task_type: "social_distribution", action_path: "/distribution#social" },
        { ...baseTask, id: "outreach", title: "Contact a creator", category: "distribution", task_type: "publisher_outreach", action_path: "/distribution#outreach" },
        { ...baseTask, id: "directories", title: "Complete a directory", category: "distribution", task_type: "directory_growth", action_path: "/distribution#directories" },
        { ...baseTask, id: "reviews", title: "Request Google reviews", category: "reviews", task_type: "primary_quest", action_path: "/audits/audit-1#recommended-fix" },
        { ...baseTask, id: "technical", title: "Review technical evidence", category: "technical", task_type: "technical_review", action_path: "/audits/audit-1#technical-evidence" },
      ]}
    />);

    for (const href of [
      "/keywords",
      "/content",
      "/distribution#community",
      "/distribution#social",
      "/distribution#outreach",
      "/distribution#directories",
      "/reviews",
      "/audits/audit-1#technical-evidence",
    ]) expect(html).toContain(`href="${href}"`);
  });
});
