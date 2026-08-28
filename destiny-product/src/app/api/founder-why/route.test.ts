import { describe, expect, it } from "vitest";

import { PATCH } from "./route";

describe("PATCH /api/founder-why", () => {
  it("rejects a founder why that is too short before authentication", async () => {
    const response = await PATCH(new Request("http://localhost/api/founder-why", {
      method: "PATCH",
      body: JSON.stringify({ founderWhy: "Too short" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Use at least 12 characters, or leave it empty to clear it.",
    });
  });
});
