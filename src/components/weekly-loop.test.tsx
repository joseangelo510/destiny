import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WeeklyLoop } from "./weekly-loop";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const task = (overrides: Partial<{
  id: string;
  title: string;
  task_type: string;
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
];

describe("WeeklyLoop", () => {
  it("uses one category surface and exposes the active category task in place", () => {
    const html = renderToStaticMarkup(<WeeklyLoop auditId="audit-1" currentStreak={2} groups={groups} remainingTasks={2} />);

    expect(html).toContain("Your weekly SEO loop");
    expect(html).toContain("Four kinds of work build your visibility");
    expect(html).toContain("Approve your priority keywords");
    expect(html).not.toContain("Review your first article");
    expect(html).not.toContain("Your next useful step");
    expect(html).not.toContain("See the full week");
    expect((html.match(/Research &amp; strategy/g) ?? [])).toHaveLength(1);
    expect((html.match(/Content creation/g) ?? [])).toHaveLength(1);
  });

  it("keeps the one-time post-audit plan reveal available", () => {
    const html = renderToStaticMarkup(<WeeklyLoop auditId="audit-1" currentStreak={0} groups={groups} initialRevealOpen remainingTasks={2} />);

    expect(html).toContain("Your audit is complete");
    expect(html).toContain("Your path to being found has four parts");
    expect(html).toContain("See my week 1 plan");
    expect(html).toContain("Replay plan reveal");
  });
});
