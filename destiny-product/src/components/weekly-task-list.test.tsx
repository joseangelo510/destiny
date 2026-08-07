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
      openTaskId="task-from-another-category"
      tasks={[{ ...baseTask, id: "task-1", title: "Later task" }]}
    />);

    expect(html).not.toMatch(/<details[^>]* open=""/);
  });

  it("does not let users skip either required Research & strategy decision", () => {
    const html = renderToStaticMarkup(<WeeklyTaskList
      openTaskId="primary-task"
      tasks={[{
        ...baseTask,
        id: "primary-task",
        title: "Approve keyword direction",
        task_type: "keyword_review",
      }]}
    />);

    expect(html).not.toContain("Skip for now");
    expect(html).not.toContain("Approve &amp; complete");
    expect(html).toContain("Review keywords");
    expect(html).toContain("five approvals are sufficient");
  });

  it("does not offer a This Week completion bypass for keyword review", () => {
    const html = renderToStaticMarkup(<WeeklyTaskList
      openTaskId="primary-task"
      tasks={[{ ...baseTask, id: "primary-task", title: "Approve keyword direction", task_type: "keyword_review" }]}
    />);

    expect(html).not.toContain("Mark done");
    expect(html).not.toContain("Approve &amp; complete");
    expect(html).toContain("At least five recommended searches approved");
  });

  it("keeps the skip action available for other incomplete tasks", () => {
    const html = renderToStaticMarkup(<WeeklyTaskList
      openTaskId="content-task"
      tasks={[{ ...baseTask, id: "content-task", title: "Review content", task_type: "content_review" }]}
    />);

    expect(html).toContain("Skip for now");
  });
});
