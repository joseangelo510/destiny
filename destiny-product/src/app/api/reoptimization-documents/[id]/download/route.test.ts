import { describe, it } from "vitest";
import { expectJsonError, mockUnauthenticatedSupabase } from "@/../qa/helpers/api-route-contract";

describe("GET /api/reoptimization-documents/[id]/download", () => {
  it("rejects unauthenticated document downloads", async () => {
    await mockUnauthenticatedSupabase();
    const { GET } = await import("./route");
    await expectJsonError(
      await GET(new Request("http://localhost/api/reoptimization-documents/document-1/download"), { params: Promise.resolve({ id: "document-1" }) }),
      401,
      "Sign in again to continue.",
    );
  });
});
