import { describe, it } from "vitest";
import { expectJsonError, jsonRequest } from "@/../qa/helpers/api-route-contract";
import { PATCH } from "./route";

describe("PATCH /api/interlinks/opportunities/[id]", () => {
  it("requires a supported state transition before authentication", async () => {
    await expectJsonError(
      await PATCH(jsonRequest("/api/interlinks/opportunities/link-1", "PATCH", { action: "publish" }), { params: Promise.resolve({ id: "link-1" }) }),
      400,
      "Choose a valid internal-link action.",
    );
  });
});
