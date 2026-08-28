import { describe, it } from "vitest";
import { expectJsonError, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("POST /api/interviews/[id]/complete", () => {
  it("rejects unauthenticated completion", async () => {
    await mockUnauthenticatedSupabase();
    const { POST } = await import("./route");
    await expectJsonError(
      await POST(new Request("http://localhost/api/interviews/interview-1/complete", { method: "POST" }), { params: Promise.resolve({ id: "interview-1" }) }),
      401,
      "Sign in again to finish the interview.",
    );
  });
});
