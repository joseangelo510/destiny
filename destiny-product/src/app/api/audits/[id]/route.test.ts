import { describe, it } from "vitest";
import { expectJsonError, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("GET /api/audits/[id]", () => {
  it("rejects unauthenticated audit reads", async () => {
    await mockUnauthenticatedSupabase();
    const { GET } = await import("./route");
    await expectJsonError(
      await GET(new Request("http://localhost/api/audits/audit-1"), { params: Promise.resolve({ id: "audit-1" }) }),
      401,
      "Sign in again to continue.",
    );
  });
});
