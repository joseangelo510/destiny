import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/audits", () => {
  it("rejects an audit without a selected website", async () => {
    const response = await POST(new Request("http://localhost/api/audits", {
      method: "POST",
      body: JSON.stringify({ locationName: "San Francisco" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Complete onboarding before starting an audit." });
  });
});
