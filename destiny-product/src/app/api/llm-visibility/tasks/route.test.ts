import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/llm-visibility/tasks", () => {
  it("rejects malformed task updates before authentication", async () => {
    const response = await POST(new Request("http://localhost/api/llm-visibility/tasks", {
      method: "POST",
      body: JSON.stringify({ websiteId: "", sourceKey: "owned-site", status: "complete" }),
    }));

    expect(response.status).toBe(400);
    const body = await response.json() as { error?: unknown };
    expect(body.error).toEqual(expect.any(String));
    expect(String(body.error)).not.toHaveLength(0);
  });
});
