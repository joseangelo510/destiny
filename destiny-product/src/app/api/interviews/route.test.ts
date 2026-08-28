import { describe, it } from "vitest";
import { expectJsonError, jsonRequest, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("POST /api/interviews", () => {
  it("rejects unauthenticated interview creation", async () => {
    await mockUnauthenticatedSupabase();
    const { POST } = await import("./route");
    await expectJsonError(
      await POST(jsonRequest("/api/interviews", "POST", {})),
      401,
      "Sign in again to start an interview.",
    );
  });
});
