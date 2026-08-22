import { describe, expect, it } from "vitest";
import {
  buildInterviewArticleDraft,
  buildInterviewQuestions,
  buildInterviewTopicSuggestions,
  buildVoiceContext,
  validateInterviewAnswer,
} from "./interviews";

describe("Destiny Interviews", () => {
  it("turns approved keywords and onboarding context into distinct expert-led topics", () => {
    const topics = buildInterviewTopicSuggestions({
      businessName: "Maple Street Roofing",
      productsServices: "Residential roof repair, replacement, and inspections",
      idealCustomer: "Homeowners who want honest repair advice",
      problemSolved: "Prevent small roof problems from becoming expensive damage",
      differentiation: "Twenty years of inspections and photo-documented recommendations",
      approvedKeywords: [
        { keyword: "roof repair mistakes", searchVolume: 1900 },
        { keyword: "metal roof vs shingles", searchVolume: 2400 },
        { keyword: "roof inspection checklist", searchVolume: 880 },
      ],
      previousTopics: ["A topic already covered"],
    });

    expect(topics).toHaveLength(3);
    expect(topics[0]).toMatchObject({ focusKeyword: "metal roof vs shingles", searchVolume: 2400 });
    expect(topics.map((topic) => topic.title).join(" ")).toContain("actually tell customers");
    expect(new Set(topics.map((topic) => topic.title)).size).toBe(topics.length);
    expect(topics.every((topic) => topic.whyNow.includes("approved keyword"))).toBe(true);
  });

  it("uses Fable's seven-part expertise arc without changing the owner's onboarding", () => {
    const questions = buildInterviewQuestions({
      topicTitle: "7 roofing mistakes that cost homeowners thousands",
      focusKeyword: "roof repair mistakes",
      businessName: "Maple Street Roofing",
      idealCustomer: "Homeowners",
      productsServices: "Roof inspection and repair",
      differentiation: "Photo-documented recommendations",
    });

    expect(questions.map((question) => question.kind)).toEqual([
      "warm_up", "contrarian", "story", "change", "evidence", "product_tie_in", "audience_advice",
    ]);
    expect(questions[2].text).toContain("specific");
    expect(questions[5].text).toContain("different");
    expect(questions[6].text).toContain("one thing");
  });

  it("keeps short answers valid while offering one gentle detail prompt", () => {
    expect(validateInterviewAnswer("I see leaks.")).toEqual({
      valid: true,
      nudge: "One more detail or real example will make this much stronger.",
    });
    expect(validateInterviewAnswer(" ").valid).toBe(false);
    expect(validateInterviewAnswer("x".repeat(121)).nudge).toBeNull();
  });

  it("builds website-scoped voice context from verbatim answers and confirmed interpretations only", () => {
    const context = buildVoiceContext({
      answers: [
        { id: "answer-1", verbatimText: "Water always wins if you give it time.", interviewTopic: "Roofing mistakes" },
      ],
      libraryItems: [
        { id: "item-1", type: "pov", body: "Small repairs prevent expensive damage.", status: "confirmed_by_owner", answerId: "answer-1" },
        { id: "item-2", type: "pov", body: "Rejected idea", status: "rejected_by_owner", answerId: "answer-1" },
      ],
    });

    expect(context).toContain("Water always wins");
    expect(context).toContain("Small repairs prevent");
    expect(context).not.toContain("Rejected idea");
    expect(context).toContain("Use quotes verbatim or not at all");
  });

  it("creates a non-publishable Content Studio handoff with visible source answers", () => {
    const draft = buildInterviewArticleDraft({
      interviewId: "interview-1",
      topicTitle: "7 roofing mistakes that cost homeowners thousands",
      focusKeyword: "roof repair mistakes",
      businessName: "Maple Street Roofing",
      answers: [
        { question: "What is the biggest mistake?", verbatimText: "Waiting too long. Water always wins if you give it time." },
        { question: "What makes your approach different?", verbatimText: "We photograph every inspection and explain what can wait." },
      ],
    });

    expect(draft.generationStatus).toBe("needs_generation");
    expect(draft.body).toContain("## What the expert said");
    expect(draft.body).toContain("> Waiting too long");
    expect(draft.qualityIssues[0].message).toContain("Content Studio");
    expect(draft.optimization).toContainEqual(expect.objectContaining({ label: "Interview source" }));
  });
});
