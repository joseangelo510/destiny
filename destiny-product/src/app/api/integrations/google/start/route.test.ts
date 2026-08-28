import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/integrations/google/start", () => {
  it("redirects unsupported connection requests to a fail-closed result", async () => {
    const response = await GET(new Request("http://localhost/api/integrations/google/start?provider=unknown"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/integrations?google=failed&reason=invalid_request");
  });
});
