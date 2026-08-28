import { describe, it } from "vitest";
import { expectJsonError, jsonRequest } from "@/../qa/helpers/api-route-contract";
import { POST } from "./route";

describe("POST /api/onboarding/competitors/suggest", () => {
  it("rejects a missing public website before discovery", async () => {
    await expectJsonError(
      await POST(jsonRequest("/api/onboarding/competitors/suggest", "POST", {})),
      400,
      "Enter a valid public website.",
    );
  });
});
