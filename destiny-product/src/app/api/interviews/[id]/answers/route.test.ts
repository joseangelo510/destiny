import { describe, it } from "vitest";
import { expectJsonError, jsonRequest, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("POST /api/interviews/[id]/answers", () => {
  it("rejects unauthenticated answer writes", async () => {
    await mockUnauthenticatedSupabase();
    const { POST } = await import("./route");
    await expectJsonError(
      await POST(jsonRequest("/api/interviews/interview-1/answers", "POST", {}), { params: Promise.resolve({ id: "interview-1" }) }),
      401,
      "Sign in again to continue the interview.",
    );
  });
});
