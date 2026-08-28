import { describe, it } from "vitest";
import { expectJsonError, jsonRequest } from "@/../qa/helpers/api-route-contract";
import { POST } from "./route";

describe("POST /api/integrations/google/sync", () => {
  it("rejects unsupported connection requests before authentication", async () => {
    await expectJsonError(
      await POST(jsonRequest("/api/integrations/google/sync", "POST", { provider: "unknown", websiteId: "site-1" })),
      400,
      "Choose a supported Google connection and website.",
    );
  });
});
