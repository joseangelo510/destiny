import { describe, expect, it } from "vitest";
import { workspaceHomeDestination } from "./routes";

describe("Rebound core workspace route", () => {
  it("opens the redesigned Home instead of the legacy weekly coach", () => {
    expect(workspaceHomeDestination("11111111-1111-4111-8111-111111111111"))
      .toBe("/app/home?site=11111111-1111-4111-8111-111111111111");
  });
});
