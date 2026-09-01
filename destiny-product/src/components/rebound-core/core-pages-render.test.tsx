import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCalendarView, buildContentPipeline, buildDistributionView, buildProgressView } from "@/lib/rebound-core/core-pages";
import { ready } from "@/lib/rebound-core/panel-result";
import { CalendarDashboard, ContentDashboard, DistributionDashboard, ProgressDashboard } from "./core-pages";

const websiteId = "11111111-1111-4111-8111-111111111111";
const base = {
  firstName: "Jordan",
  websiteLabel: "Example Co",
  websiteId,
  queue: ready({ items: [], sessionMoves: [] }),
  searchConnected: true,
};

describe("Rebound read-only core pages", () => {
  it("renders the six-state Content pipeline without a new write control", () => {
    const pipeline = buildContentPipeline({
      approvedKeywords: [{ keyword: "content idea" }],
      drafts: [{ id: "draft-1", keyword: "draft keyword", draft: { title: "Saved draft", generationStatus: "generated" } }],
      scheduleItems: [{ id: "scheduled-1", keyword: "scheduled keyword", title: "Scheduled article", scheduled_for: "2026-09-03T16:00:00Z", state: "scheduled" }],
      receipts: [],
    });
    const html = renderToStaticMarkup(<ContentDashboard view={{ ...base, pipeline: ready(pipeline) }} />);

    for (const label of ["Ideas", "Drafts", "Approved", "Scheduled", "Published", "Verified live"]) expect(html).toContain(label);
    expect(html).toContain(`/app/content/draft-1?site=${websiteId}`);
    for (const writeLabel of ["Approve all", "Publish now", "Send as report", "Request edits"]) expect(html).not.toContain(writeLabel);
  });

  it("renders Calendar, Distribution, and Progress from saved evidence", () => {
    const calendar = renderToStaticMarkup(<CalendarDashboard view={{ ...base, calendarView: ready(buildCalendarView({ month: "September 2026", items: [{ id: "slot", title: "Saved slot", keyword: "slot", scheduled_for: "2026-09-03T16:00:00Z", state: "scheduled" }] })) }} />);
    const distribution = renderToStaticMarkup(<DistributionDashboard view={{ ...base, distribution: ready(buildDistributionView({ opportunities: [{ platform: "Quora", title: "Saved question", url: "https://www.quora.com/example", snippet: "Matched", topic: "topic" }], interlinks: [] })) }} />);
    const progress = renderToStaticMarkup(<ProgressDashboard view={{ ...base, progress: ready(buildProgressView({ quests: [{ id: "done", title: "Verified move", description: "Done", action_path: "/content", status: "complete", verification_status: "verified", completed_at: "2026-08-31T12:00:00Z" }], scheduleItems: [], receipts: [] })) }} />);

    expect(calendar).toContain("The month");
    expect(distribution).toContain("Saved question");
    expect(progress).toContain("What’s been done");
    expect(progress).toContain("split by who owns it");
  });
});
