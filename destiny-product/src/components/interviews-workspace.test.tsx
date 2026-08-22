import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InterviewsWorkspace } from "./interviews-workspace";

const props = {
  websiteId: "11111111-1111-4111-8111-111111111111",
  auditId: "22222222-2222-4222-8222-222222222222",
  businessName: "Maple Street Roofing",
  generationAvailable: true,
  topics: [{
    title: "7 roofing mistakes that cost homeowners thousands",
    angle: "Help homeowners avoid expensive damage.",
    whyNow: "Built from the approved keyword roof repair mistakes.",
    focusKeyword: "roof repair mistakes",
    searchVolume: 1900,
    estimatedMinutes: 10,
    questionCount: 7,
  }],
  previousInterviews: [],
  libraryItems: [],
};

describe("InterviewsWorkspace", () => {
  it("uses Fable's five-step experience and plain-language promise", () => {
    const html = renderToStaticMarkup(<InterviewsWorkspace {...props} />);
    expect(html).toContain("Pick a topic");
    expect(html).toContain("The interview");
    expect(html).toContain("What we captured");
    expect(html).toContain("Voice Library");
    expect(html).toContain("Your article");
    expect(html).toContain("Talk for ten minutes about what you know");
  });

  it("makes typed interviews available now and labels voice modes truthfully", () => {
    const html = renderToStaticMarkup(<InterviewsWorkspace {...props} />);
    expect(html).toContain("Type your answers");
    expect(html).toContain("Tap to dictate");
    expect(html).toContain("Coming next");
    expect(html).toContain("Live conversation");
    expect(html).not.toContain("voice is live");
  });

  it("shows the 30-day recording policy and exact-word trust boundary", () => {
    const html = renderToStaticMarkup(<InterviewsWorkspace {...props} />);
    expect(html).toContain("recordings delete after 30 days");
    expect(html).toContain("transcripts stay in your Voice Library");
    expect(html).toContain("saved word-for-word");
  });

  it("labels all mock-derived data as empty rather than inventing customer content", () => {
    const html = renderToStaticMarkup(<InterviewsWorkspace {...props} />);
    expect(html).toContain("Your first interview will start your Voice Library");
    expect(html).not.toContain("Maple Street job");
    expect(html).not.toContain("4 out of 10");
  });
});
