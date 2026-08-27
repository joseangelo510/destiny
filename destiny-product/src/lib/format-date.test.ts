import { describe, expect, it } from "vitest";
import { formatUtcDate, formatUtcDateTime } from "./format-date";

describe("deterministic UTC evidence dates", () => {
  it("keeps a provider timestamp on the same calendar day in every viewer timezone", () => {
    const boundaryTimestamp = "2026-08-27T02:30:00.000Z";

    expect(formatUtcDate(boundaryTimestamp)).toBe("Aug 27, 2026");
    expect(formatUtcDateTime(boundaryTimestamp)).toBe("Aug 27, 2026, 2:30 AM UTC");
  });
});
