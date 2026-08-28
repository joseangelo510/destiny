import { describe, it } from "vitest";
import { expectJsonError, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("POST /api/interviews/[id]/article", () => {
  it("rejects unauthenticated article drafting", async () => {
    await mockUnauthenticatedSupabase();
    const { POST } = await import("./route");
    await expectJsonError(
      await POST(new Request("http://localhost/api/interviews/interview-1/article", { method: "POST" }), { params: Promise.resolve({ id: "interview-1" }) }),
      401,
      "Sign in again to create the article draft.",
    );
  });
});
