import { describe, it } from "vitest";
import { expectJsonError, jsonRequest, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("PATCH /api/interviews/[id]/insights", () => {
  it("rejects unauthenticated Voice Library updates", async () => {
    await mockUnauthenticatedSupabase();
    const { PATCH } = await import("./route");
    await expectJsonError(
      await PATCH(jsonRequest("/api/interviews/interview-1/insights", "PATCH", {}), { params: Promise.resolve({ id: "interview-1" }) }),
      401,
      "Sign in again to update the Voice Library.",
    );
  });
});
