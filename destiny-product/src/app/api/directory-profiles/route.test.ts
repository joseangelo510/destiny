import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/directory-profiles", () => {
  it("rejects unsupported directories", async () => {
    const response = await POST(new Request("http://localhost/api/directory-profiles", {
      method: "POST",
      body: JSON.stringify({ websiteId: "website-1", directoryKey: "unknown", profileUrl: "https://example.com" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Choose a supported directory." });
  });
});
