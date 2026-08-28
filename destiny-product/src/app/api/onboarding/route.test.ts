import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/onboarding", () => {
  it("rejects incomplete onboarding", async () => {
    const response = await POST(new Request("http://localhost/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ firstName: "Jose", email: "invalid", website: "https://example.com" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Complete every onboarding field." });
  });
});
