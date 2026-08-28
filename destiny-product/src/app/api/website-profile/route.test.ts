import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/website-profile", () => {
  it("rejects unrecognized profile selections", async () => {
    const response = await POST(new Request("http://localhost/api/website-profile", {
      method: "POST",
      body: JSON.stringify({ websiteId: "website-1", platform: "unknown", builderTools: ["unknown"] }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Choose a platform and AI tools from the provided options.",
    });
  });
});
