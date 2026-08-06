import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  llmTaskChannelName,
  LlmSourceDashboard,
  parseLlmTaskSyncMessage,
} from "./llm-source-dashboard";
import { buildLlmSourceProgress } from "../lib/llm/source-progress";

describe("LLM source dashboard", () => {
  it("scopes cross-tab task messages to the active website", () => {
    const websiteId = "11111111-1111-4111-8111-111111111111";
    const task = { source_key: "reddit", task_key: "answer-question", status: "complete" };

    expect(llmTaskChannelName(websiteId)).toBe(`destiny:llm-visibility:${websiteId}`);
    expect(parseLlmTaskSyncMessage({ websiteId, task }, websiteId)).toEqual(task);
    expect(parseLlmTaskSyncMessage({ websiteId: "another-website", task }, websiteId)).toBeNull();
    expect(parseLlmTaskSyncMessage({ websiteId, task: { task_key: "missing-source" } }, websiteId)).toBeNull();
  });

  it("renders an interactive source map, truthful progress, and model-specific benchmark lens", async () => {
    const records = [{ source_key: "owned-site", task_key: "clarify-entity", status: "complete", completed_at: "2026-08-02T12:00:00.000Z" }];
    const llmVisibility = { status: "available", totalMentions: 0, platforms: [] };
    const html = renderToStaticMarkup(<LlmSourceDashboard
      initialRecords={records}
      initialProgress={await buildLlmSourceProgress({ records, llmVisibility })}
      llmVisibility={llmVisibility}
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain("Your AI visibility map");
    expect(html).toContain("1 of 27 source-readiness actions complete");
    expect(html).toContain("No provider-detected mentions yet");
    expect(html).toContain("Live workspace updates");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('data-source-key="youtube"');
    expect(html).toContain('data-source-key="wikipedia"');
    expect(html).toContain('aria-controls="llm-source-playbook"');
    expect(html).toContain("Benchmark lens");
    expect(html).toContain("ChatGPT");
    expect(html).toContain("Gemini");
    expect(html).toContain("Perplexity");
    expect(html).toContain("Google AI Mode");
    expect(html).toContain("Google AI Overviews");
    expect(html).toContain("Market benchmark, not your evidence");
    expect(html).toContain("Open Reddit playbook");
    expect(html).toContain('data-playbook-source="reddit"');
    expect(html).toContain('data-playbook-source="earned-media"');
    expect(html).toContain("Choose an actionable bar to open its checklist");
    expect(html).toContain("Three truthful progress states");
    expect(html).toContain("Public proof attached");
    expect(html).toContain("0 of 8 proof-bearing actions");
  });

  it("shows the selected source checklist with effort states instead of claiming citations", async () => {
    const llmVisibility = { status: "unavailable", totalMentions: 0, platforms: [] };
    const html = renderToStaticMarkup(<LlmSourceDashboard
      initialRecords={[]}
      initialProgress={await buildLlmSourceProgress({ records: [], llmVisibility })}
      llmVisibility={llmVisibility}
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain('id="llm-source-playbook"');
    expect(html).toContain("What completing this means");
    expect(html).toContain("Mark done");
    expect(html).toContain("Provider monitoring is not available yet");
    expect(html).not.toContain("You are now AI visible");
    expect(html).toContain("Public proof URL");
    expect(html).toContain("Proof is user-attached and not provider verification");
  });

  it("renders attached proof separately from a provider-detected citation", async () => {
    const records = [{ source_key: "owned-site", task_key: "publish-source-page", status: "complete", completed_at: "2026-08-02T12:00:00.000Z", proof_url: "https://example.com/buyer-guide", proof_attached_at: "2026-08-02T12:01:00.000Z" }];
    const llmVisibility = { status: "available", totalMentions: 0, platforms: [] };
    const html = renderToStaticMarkup(<LlmSourceDashboard
      initialRecords={records}
      initialProgress={await buildLlmSourceProgress({ records, llmVisibility })}
      llmVisibility={llmVisibility}
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain("1 of 8 proof-bearing actions");
    expect(html).toContain("Open attached proof");
    expect(html).toContain("No provider-detected mentions yet");
  });
});
