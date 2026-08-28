import { describe, it } from "vitest";
import { expectJsonError } from "@/../qa/helpers/api-route-contract";
import { GET } from "./route";

describe("GET /api/content/publishing-plan", () => {
  it("requires a website before loading a plan", async () => {
    await expectJsonError(
      await GET(new Request("http://localhost/api/content/publishing-plan")),
      400,
      "Choose a valid website.",
    );
  });
});
