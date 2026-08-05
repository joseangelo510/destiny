import { describe, expect, it } from "vitest";
import { keywordDisclosureState } from "./keyword-disclosure";

describe("keyword research progressive disclosure", () => {
  it("shows 50 rows first and offers one client-side reveal", () => {
    expect(keywordDisclosureState({ filteredCount: 100, loadedCount: 100, revealed: false })).toEqual({
      visibleCount: 50,
      hiddenCount: 50,
      buttonLabel: "Show 50 more keywords",
      toolbarLabel: "Showing 50 of 100 keywords · 100 loaded",
      caption: "Showing 50 of 100 keywords",
    });
    expect(keywordDisclosureState({ filteredCount: 100, loadedCount: 100, revealed: true })).toEqual({
      visibleCount: 100,
      hiddenCount: 0,
      buttonLabel: null,
      toolbarLabel: "100 shown of 100 loaded",
      caption: null,
    });
  });

  it("uses truthful labels for partial and small result sets", () => {
    expect(keywordDisclosureState({ filteredCount: 63, loadedCount: 100, revealed: false })).toMatchObject({
      visibleCount: 50,
      hiddenCount: 13,
      buttonLabel: "Show all 63 keywords",
      toolbarLabel: "Showing 50 of 63 keywords · 100 loaded",
      caption: "Showing 50 of 100 keywords",
    });
    expect(keywordDisclosureState({ filteredCount: 42, loadedCount: 100, revealed: false })).toMatchObject({
      visibleCount: 42,
      hiddenCount: 0,
      buttonLabel: null,
      toolbarLabel: "42 shown of 100 loaded",
      caption: null,
    });
  });
});
