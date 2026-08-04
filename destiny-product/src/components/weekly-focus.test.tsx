import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WeeklyFocus } from "./weekly-focus";

const task = {
  id: "task-1",
  title: "Approve the searches that can become customers",
  description: "Choose the keywords with the clearest path to a useful business outcome.",
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

describe("WeeklyFocus", () => {
  it("puts one useful action before dashboards and secondary statistics", () => {
    const html = renderToStaticMarkup(<WeeklyFocus completed={1} currentStreak={2} task={task} total={6} />);

    expect(html).toContain("Your next useful step");
    expect(html).toContain(task.title);
    expect(html).toContain("Begin this step");
    expect(html).toContain("12 minutes");
    expect(html).toContain("Get ready to be found");
    expect(html).toContain("2-week streak");
    expect(html).not.toContain("destiny-compass");
  });

  it("celebrates a complete week without inventing a verified outcome", () => {
    const html = renderToStaticMarkup(<WeeklyFocus completed={6} currentStreak={3} task={null} total={6} />);

    expect(html).toContain("This week is complete");
    expect(html).toContain("You completed every assigned step");
    expect(html).toContain("Review the ground you covered");
    expect(html).not.toContain("rankings improved");
  });
});
