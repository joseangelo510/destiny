import { describe, it } from "vitest";
import { expectJsonError, jsonRequest, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("POST /api/research/keywords", () => {
  it("rejects unauthenticated keyword research", async () => {
    await mockUnauthenticatedSupabase();
    const { POST } = await import("./route");
    await expectJsonError(
      await POST(jsonRequest("/api/research/keywords", "POST", {})),
      401,
      "Sign in again to continue.",
    );
  });
});
