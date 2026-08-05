import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  llmTaskChannelName,
  LlmSourceDashboard,
  nextSourceReadinessPercent,
  parseLlmTaskSyncMessage,
} from "./llm-source-dashboard";
import { buildLlmSourceProgress } from "../lib/llm/source-progress";

describe("LLM source dashboard", () => {
  it("previews the next completed source task without overstating verified visibility", () => {
    expect(nextSourceReadinessPercent(0, 3)).toBe(33);
    expect(nextSourceReadinessPercent(1, 3)).toBe(67);
    expect(nextSourceReadinessPercent(3, 3)).toBe(100);
    expect(nextSourceReadinessPercent(0, 0)).toBe(0);
  });

  it("scopes cross-tab task messages to the active website", () => {
    const websiteId = "11111111-1111-4111-8111-111111111111";
    const task = { source_key: "reddit", task_key: "answer-question", status: "complete" };

    expect(llmTaskChannelName(websiteId)).toBe(`destiny:llm-visibility:${websiteId}`);
    expect(parseLlmTaskSyncMessage({ websiteId, task }, websiteId)).toEqual(task);
    expect(parseLlmTaskSyncMessage({ websiteId: "another-website", task }, websiteId)).toBeNull();
    expect(parseLlmTaskSyncMessage({ websiteId, task: { task_key: "missing-source" } }, websiteId)).toBeNull();
  });

  it("matches Claude's compact seven-row Signal Skyline directive", async () => {
    const records = [{ source_key: "owned-site", task_key: "clarify-entity", status: "complete", completed_at: "2026-08-02T12:00:00.000Z" }];
    const llmVisibility = { status: "available", totalMentions: 0, platforms: [] };
    const html = renderToStaticMarkup(<LlmSourceDashboard
      initialRecords={records}
      initialProgress={await buildLlmSourceProgress({ records, llmVisibility })}
      llmVisibility={llmVisibility}
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain("AI visibility playboard");
    expect(html).toContain("Ghost bars show how often AI cites each source. Your color shows your readiness.");
    expect(html).toContain("Streak");
    expect(html).toContain("Your readiness");
    expect(html).toContain("AI citation benchmark");
    expect(html).toContain("Verified AI citation");
    expect(html.match(/data-signal-source=/g)).toHaveLength(7);
    expect(html).toContain('data-signal-source="reddit"');
    expect(html).toContain("Benchmark 40.1%");
    expect(html).toContain("Benchmark 26.3%");
    expect(html).toContain("Benchmark 23.5%");
    expect(html).toContain("Benchmark 23.3%");
    expect(html).toContain("Benchmark 21%");
    expect(html).toContain("Benchmark 5.9%");
    expect(html).toContain("Benchmark 4.6%");
    expect(html).not.toContain("Your AI visibility map");
    expect(html).not.toContain("Three truthful progress states");
    expect(html).not.toContain("Preview after your next task");
    expect(html).not.toContain("Google AI Overviews");
  });

  it("shows Claude's exact four-task Reddit drawer and one guide action", async () => {
    const llmVisibility = { status: "unavailable", totalMentions: 0, platforms: [] };
    const html = renderToStaticMarkup(<LlmSourceDashboard
      initialRecords={[]}
      initialProgress={await buildLlmSourceProgress({ records: [], llmVisibility })}
      initialSelectedSource="reddit"
      llmVisibility={llmVisibility}
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain('id="llm-source-drawer"');
    expect(html).toContain("Reddit playbook");
    expect(html).toContain("AI cites Reddit in 40% of answers. Real contributions in your niche build readiness.");
    expect(html).toContain("Claim your Reddit username");
    expect(html).toContain("Join 3 subreddits in your niche");
    expect(html).toContain("Answer one question with genuine help");
    expect(html).toContain("Share one lesson from your business");
    expect(html).toContain("Ask Destiny for a step by step guide");
    expect(html.match(/type="checkbox"/g)).toHaveLength(4);
    expect(html).not.toContain("AI visibility gained");
  });

  it("keeps verified citation pills off until a supported provider integration exists", async () => {
    const records = [{ source_key: "reddit", task_key: "claim-username", status: "complete", completed_at: "2026-08-02T12:00:00.000Z" }];
    const llmVisibility = { status: "available", totalMentions: 0, platforms: [] };
    const html = renderToStaticMarkup(<LlmSourceDashboard
      initialRecords={records}
      initialProgress={await buildLlmSourceProgress({ records, llmVisibility })}
      llmVisibility={llmVisibility}
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain("Verified AI citation");
    expect(html).not.toContain("Verified citation</b>");
    expect(html).toContain("You <strong>25%</strong> · Benchmark 40.1%");
  });
});
