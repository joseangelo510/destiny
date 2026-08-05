import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildLlmSourceProgress } from "../lib/llm/source-progress";
import { LlmSignalPlayboard } from "./llm-signal-playboard";

describe("LLM signal playboard", () => {
  it("adds Claude's seven-source visual without replacing the original dashboard", async () => {
    const records = [{
      source_key: "reddit",
      task_key: "find-conversations",
      status: "complete",
      completed_at: "2026-08-04T12:00:00.000Z",
    }];
    const llmVisibility = { status: "available", totalMentions: 0, platforms: [] };
    const html = renderToStaticMarkup(<LlmSignalPlayboard
      initialProgress={await buildLlmSourceProgress({ records, llmVisibility })}
      initialRecords={records}
      llmVisibility={llmVisibility}
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain("AI visibility playboard");
    expect(html).toContain("Ghost bars show how often AI cites each source");
    expect(html.match(/data-signal-source=/g)).toHaveLength(7);
    expect(html).toContain('data-signal-source="reddit"');
    expect(html).toContain("You <strong>33%</strong> · Benchmark 40.1%");
    expect(html).toContain("Select a source to open its detailed playbook above");
    expect(html).not.toContain("AI visibility gained");
  });
});
