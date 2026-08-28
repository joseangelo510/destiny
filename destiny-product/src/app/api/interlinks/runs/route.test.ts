import { describe, it } from "vitest";
import { expectJsonError, jsonRequest } from "@/../qa/helpers/api-route-contract";
import { POST } from "./route";

describe("POST /api/interlinks/runs", () => {
  it("requires a website before starting a live crawl", async () => {
    await expectJsonError(
      await POST(jsonRequest("/api/interlinks/runs", "POST", {})),
      400,
      "Choose a website before checking internal links.",
    );
  });
});
