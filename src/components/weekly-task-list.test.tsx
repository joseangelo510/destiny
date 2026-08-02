import { renderToStaticMarkup } from "react-dom/server";
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
});
