import { describe, expect, it } from "vitest";
import { reviewCountDisplay } from "./review-count-display";

describe("reviewCountDisplay", () => {
  it("keeps disconnected and incomplete snapshots unknown instead of presenting zero", () => {
    expect(reviewCountDisplay({ synced: false, count: 0 })).toEqual({
      text: "—",
      label: "Google review count unavailable until a Business Profile snapshot is synced.",
    });
    expect(reviewCountDisplay({ synced: false, count: 128 })).toEqual({
      text: "—",
      label: "Google review count unavailable until a Business Profile snapshot is synced.",
    });
    expect(reviewCountDisplay({ synced: true, count: undefined })).toEqual({
      text: "—",
      label: "Google review count unavailable in the latest Business Profile snapshot.",
    });
  });

  it("shows explicit provider counts, including a genuine zero", () => {
    expect(reviewCountDisplay({ synced: true, count: 0 })).toEqual({ text: "0", label: "0 Google reviews" });
    expect(reviewCountDisplay({ synced: true, count: 1234 })).toEqual({ text: "1,234", label: "1,234 Google reviews" });
  });
});
