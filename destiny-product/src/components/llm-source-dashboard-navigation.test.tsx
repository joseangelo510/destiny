import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LlmSourceDashboard } from "./llm-source-dashboard";
import { buildLlmSourceProgress } from "../lib/llm/source-progress";

const websiteId = "11111111-1111-4111-8111-111111111111";
const llmVisibility = { status: "unavailable", totalMentions: 0, platforms: [] };

async function render(href?: string) {
  const progress = await buildLlmSourceProgress({ records: [], llmVisibility });
  if (href) progress.sources[0].tasks[0].actionHref = href;
  return renderToStaticMarkup(<LlmSourceDashboard websiteId={websiteId} initialRecords={[]} initialProgress={progress} llmVisibility={llmVisibility} />);
}

describe("AI visibility website handoff", () => {
  it("keeps content and audit task navigation on the dashboard website", async () => {
    const html = await render();
    expect(html).toContain(`href="/content?site=${websiteId}"`);
    expect(html).toContain(`href="/audits?site=${websiteId}"`);
    expect(html).not.toContain('href="/content"');
    expect(html).not.toContain('href="/audits"');
  });

  it("retains action filters and anchors while replacing stale website context", async () => {
    const html = await render("/content?stage=draft&site=22222222-2222-4222-8222-222222222222#article-review-workspace");
    expect(html).toContain(`href="/content?stage=draft&amp;site=${websiteId}#article-review-workspace"`);
  });

  it("preserves external action destinations and separate-tab behavior", async () => {
    const html = await render("https://example.com/contribute?source=rebound#instructions");
    expect(html).toContain('href="https://example.com/contribute?source=rebound#instructions" rel="noreferrer" target="_blank"');
  });
});
