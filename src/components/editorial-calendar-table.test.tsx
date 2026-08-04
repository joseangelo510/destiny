import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calendarRowPresentation, type EditorialCalendarItem } from "../lib/content/editorial-calendar";
import { CALENDAR_COLUMNS, EditorialCalendarTable } from "./editorial-calendar-table";

function row(keyword: string, overrides: Partial<EditorialCalendarItem> = {}): EditorialCalendarItem {
  return {
    month: 1,
    week: 1,
    contentType: "Service page",
    title: `Where to hire help for ${keyword}`,
    focusKeyword: keyword,
    searchIntent: "conversion",
    evidence: "Relevant site idea",
    searchVolume: 1400,
    difficulty: 22,
    priorityReason: "Evidence-based opportunity",
    ...overrides,
  };
}

const noop = () => {};

describe("calendarRowPresentation", () => {
  it("derives status and action from the real article state", () => {
    expect(calendarRowPresentation({ hasSavedDraft: false })).toEqual({ status: "Planned", action: { kind: "create", label: "Create content" } });
    expect(calendarRowPresentation({ hasSavedDraft: true })).toEqual({ status: "Draft ready", action: { kind: "review", label: "Review draft" } });
    expect(calendarRowPresentation({ hasSavedDraft: true, approvedForDelivery: true })).toEqual({ status: "Scheduled", action: { kind: "review", label: "Review draft" } });
    expect(calendarRowPresentation({ hasSavedDraft: true, publishedUrl: "https://example.com/post" })).toEqual({ status: "Published", action: { kind: "view", label: "View post", url: "https://example.com/post" } });
  });

  it("makes Review draft structurally impossible without a saved draft", () => {
    expect(calendarRowPresentation({ hasSavedDraft: false, approvedForDelivery: true }).action.label).toBe("Create content");
    expect(calendarRowPresentation({ hasSavedDraft: false }).status).toBe("Planned");
  });
});

describe("EditorialCalendarTable", () => {
  it("shows Create content — never Review draft — when no draft exists", () => {
    const html = renderToStaticMarkup(<EditorialCalendarTable calendar={[row("junk removal boston")]} draftStates={{}} onCreateContent={noop} onReviewDraft={noop} planMonths={3} questComplete={false} sourceLabel="Saved audit data" />);

    expect(html).toContain("Create content");
    expect(html).not.toContain("Review draft");
    expect(html).toContain("Planned");
    expect(html).toContain("1,400");
  });

  it("shows Review draft only for a saved generated draft, and Scheduled once approved for delivery", () => {
    const calendar = [row("junk removal boston"), row("office cleanouts", { week: 2 })];
    const html = renderToStaticMarkup(<EditorialCalendarTable calendar={calendar} draftStates={{ "junk removal boston": { generationStatus: "generated", approved: false } }} onCreateContent={noop} onReviewDraft={noop} planMonths={3} questComplete={false} sourceLabel="Saved audit data" />);
    expect(html).toContain("Review draft");
    expect(html).toContain("Draft ready");
    expect(html).toContain("Create content");

    const scheduled = renderToStaticMarkup(<EditorialCalendarTable calendar={calendar} draftStates={{ "junk removal boston": { generationStatus: "generated", approved: true } }} onCreateContent={noop} onReviewDraft={noop} planMonths={3} questComplete sourceLabel="Saved audit data" />);
    expect(scheduled).toContain("Scheduled");
  });

  it("treats a starter prefill as not yet created content", () => {
    const html = renderToStaticMarkup(<EditorialCalendarTable calendar={[row("junk removal boston")]} draftStates={{ "junk removal boston": { generationStatus: "starter", approved: false } }} onCreateContent={noop} onReviewDraft={noop} planMonths={3} questComplete={false} sourceLabel="Saved audit data" />);
    expect(html).toContain("Create content");
    expect(html).not.toContain("Review draft");
  });

  it("gives every column header an accessible info control with the agreed copy", () => {
    const html = renderToStaticMarkup(<EditorialCalendarTable calendar={[row("junk removal boston")]} draftStates={{}} onCreateContent={noop} onReviewDraft={noop} planMonths={3} questComplete={false} sourceLabel="Saved audit data" />);

    expect(CALENDAR_COLUMNS).toHaveLength(8);
    for (const column of CALENDAR_COLUMNS) {
      expect(html).toContain(`aria-label="What does ${column.label} mean?"`);
      expect(html).toContain(`aria-controls="column-info-${column.key}"`);
    }
    // Real button controls (click/keyboard, not hover-only), closed by default, icon not a bare "(I)" text label.
    expect(html.match(/class="column-info-button"/g)).toHaveLength(8);
    expect(html.match(/aria-expanded="false"/g)?.length).toBe(8);
    expect(html).toContain("<svg");
    expect(html).not.toContain("(I)");
    // Tooltip copy is exactly the adopted wording.
    expect(CALENDAR_COLUMNS.find((column) => column.key === "monthlySearches")?.info).toBe("An estimated number of U.S. searches for this keyword each month. Use it with intent and competition—not by itself.");
    expect(CALENDAR_COLUMNS.find((column) => column.key === "status")?.info).toBe("Where this idea is in your workflow: planned, draft ready, scheduled, or published.");
    expect(CALENDAR_COLUMNS.find((column) => column.key === "action")?.info).toBe("The next truthful step available for this content.");
  });

  it("labels cells for the mobile card layout and keeps monthly searches numeric", () => {
    const html = renderToStaticMarkup(<EditorialCalendarTable calendar={[row("junk removal boston")]} draftStates={{}} onCreateContent={noop} onReviewDraft={noop} planMonths={3} questComplete={false} sourceLabel="Saved audit data" />);

    for (const label of ["Schedule", "Content type", "Focus keyword", "Monthly searches", "Title", "Search intent", "Status", "Action"]) {
      expect(html).toContain(`data-label="${label}"`);
    }
    expect(html).toMatch(/class="numeric" data-label="Monthly searches"/);
  });
});
