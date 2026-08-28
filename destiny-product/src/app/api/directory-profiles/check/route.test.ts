import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/directory-profiles/check", () => {
  it("requires a saved directory profile before authentication", async () => {
    const response = await POST(new Request("http://localhost/api/directory-profiles/check", {
      method: "POST",
      body: JSON.stringify({ websiteId: "website-1" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Choose a saved directory profile." });
  });
});
