import { describe, expect, it } from "vitest";
import { keywordDisclosureState } from "./keyword-disclosure";

describe("keyword report empty-state explanation", () => {
  it("does not blame filters or assert zero demand when the provider returned no rows", () => {
    const state = keywordDisclosureState({ loadedCount: 0, filteredCount: 0, revealed: false });
    expect(state.emptyMessage).toBe("No keyword rows were returned for this query. This does not establish zero search demand. Try a related phrase or a broader topic.");
  });
  it("explains when filters hide an otherwise populated report", () => {
    const state = keywordDisclosureState({ loadedCount: 12, filteredCount: 0, revealed: false });
    expect(state.emptyMessage).toBe("No keywords match these filters. Clear or adjust the filters to see the loaded results.");
  });
  it("does not show an empty message for visible results", () => {
    expect(keywordDisclosureState({ loadedCount: 12, filteredCount: 3, revealed: false }).emptyMessage).toBeNull();
  });
});
