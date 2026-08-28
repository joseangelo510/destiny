import { describe, it } from "vitest";
import { expectJsonError, jsonRequest } from "@/../qa/helpers/api-route-contract";
import { POST } from "./route";

describe("POST /api/content/infographic/document", () => {
  it("requires a valid workspace website before document generation", async () => {
    await expectJsonError(
      await POST(jsonRequest("/api/content/infographic/document", "POST", {})),
      400,
      "Choose the website for this document.",
    );
  });
});
