import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/reoptimization-documents", () => {
  it("requires both an audit and keyword before authentication", async () => {
    const response = await POST(new Request("http://localhost/api/reoptimization-documents", {
      method: "POST",
      body: JSON.stringify({ auditId: "audit-1", keyword: "  " }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Choose a valid keyword and audit." });
  });
});
