import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LlmEvidenceSnapshot } from "./llm-evidence-snapshot";

describe("LLM evidence snapshot", () => {
  const now = new Date("2026-09-23T20:00:00.000Z");

  it("dates an old provider snapshot and discloses the missing answer examples", () => {
    const html = renderToStaticMarkup(<LlmEvidenceSnapshot
      auditId="c9699c3f-0f6f-477c-99dd-a42f7e165e05"
      completedAt="2026-08-04T22:46:42.647Z"
      now={now}
      status="available"
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain("Aug 4, 2026");
    expect(html).toContain("50 days old");
    expect(html).toContain("Older than 30 days");
    expect(html).toContain("provider-reported aggregates");
    expect(html).toContain("Individual prompts and answers are not saved");
    expect(html).toContain('/audits/c9699c3f-0f6f-477c-99dd-a42f7e165e05?site=11111111-1111-4111-8111-111111111111');
  });

  it("dates a recent snapshot without claiming real-time monitoring", () => {
    const html = renderToStaticMarkup(<LlmEvidenceSnapshot
      auditId="recent-audit"
      completedAt="2026-09-22T20:00:00.000Z"
      now={now}
      status="available"
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain("Sep 22, 2026");
    expect(html).toContain("1 day old");
    expect(html).not.toContain("Older than 30 days");
    expect(html).not.toContain("live monitoring");
  });

  it("does not invent a date when the audit or provider evidence is missing", () => {
    const html = renderToStaticMarkup(<LlmEvidenceSnapshot
      auditId={null}
      completedAt={null}
      now={now}
      status="unavailable"
      websiteId="11111111-1111-4111-8111-111111111111"
    />);

    expect(html).toContain("No dated provider snapshot is available");
    expect(html).not.toContain("days old");
  });
});
