import { describe, it } from "vitest";
import { expectJsonError, jsonRequest, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("POST /api/research/backlinks", () => {
  it("rejects unauthenticated backlink research", async () => {
    await mockUnauthenticatedSupabase();
    const { POST } = await import("./route");
    await expectJsonError(
      await POST(jsonRequest("/api/research/backlinks", "POST", {})),
      401,
      "Sign in again to continue.",
    );
  });
});
