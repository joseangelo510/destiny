import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/distribution/creators", () => {
  it("requires a website and at least one usable topic before authentication", async () => {
    const response = await POST(new Request("http://localhost/api/distribution/creators", {
      method: "POST",
      body: JSON.stringify({ websiteId: "website-1", topics: ["", "x", 42] }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Choose at least one priority keyword first." });
  });
});
