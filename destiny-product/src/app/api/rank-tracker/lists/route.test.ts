import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/rank-tracker/lists", () => {
  it("reserves the default General list name before authentication", async () => {
    const response = await POST(new Request("http://localhost/api/rank-tracker/lists", {
      method: "POST",
      body: JSON.stringify({ websiteId: "website-1", name: "  GENERAL  " }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "General is already your default list." });
  });
});
