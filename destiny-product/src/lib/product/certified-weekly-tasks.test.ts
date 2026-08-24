import { describe, expect, it } from "vitest";
import { certifiedMvpWeeklyTasks } from "./coach-experience";

const task = (taskType: string, status = "todo") => ({
  id: `task-${taskType}`,
  task_type: taskType,
  category: taskType === "primary_quest" ? "technical" : null,
  status,
  verification_status: "unverified",
  guidance_state: "ready",
  follow_up_at: null,
  priority: 1,
});

describe("certified MVP weekly task boundary", () => {
  it("shows only actions included in the certified launch journey", () => {
    const result = certifiedMvpWeeklyTasks([
      task("keyword_review"),
      task("content_review"),
      task("primary_quest"),
      task("technical_review"),
      task("social_distribution"),
      task("publisher_outreach"),
      task("directory_growth"),
      task("reviews"),
    ]);

    expect(result.map((item) => item.task_type)).toEqual([
      "keyword_review",
      "content_review",
      "primary_quest",
      "technical_review",
    ]);
  });

  it("keeps completed certified work visible as evidence", () => {
    expect(certifiedMvpWeeklyTasks([
      task("keyword_review", "complete"),
      task("community_distribution", "complete"),
    ]).map((item) => item.task_type)).toEqual(["keyword_review"]);
  });
});
