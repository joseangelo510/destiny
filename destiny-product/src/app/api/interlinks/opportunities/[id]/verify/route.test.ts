import { describe, it } from "vitest";
import { expectJsonError, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("POST /api/interlinks/opportunities/[id]/verify", () => {
  it("rejects unauthenticated verification", async () => {
    await mockUnauthenticatedSupabase();
    const { POST } = await import("./route");
    await expectJsonError(
      await POST(new Request("http://localhost/api/interlinks/opportunities/link-1/verify", { method: "POST" }), { params: Promise.resolve({ id: "link-1" }) }),
      401,
      "Sign in again to continue.",
    );
  });
});
