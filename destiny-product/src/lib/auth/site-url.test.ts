import { describe, expect, it } from "vitest";
import { siteOrigin, siteRedirectUrl } from "./site-url";

describe("siteOrigin", () => {
  it("prefers the configured public site over a proxy origin", () => {
    expect(siteOrigin("https://destiny-seo.replit.app", "https://0.0.0.0:3000"))
      .toBe("https://destiny-seo.replit.app");
  });

  it("rejects non-https remote origins", () => {
    expect(siteOrigin(undefined, "http://0.0.0.0:3000")).toBe("http://localhost:3000");
  });

  it("allows a local development origin", () => {
    expect(siteOrigin(undefined, "http://localhost:3100")).toBe("http://localhost:3100");
  });

  it("keeps auth callbacks on the public site behind a reverse proxy", () => {
    expect(siteRedirectUrl(
      "https://destiny-seo.replit.app",
      "https://0.0.0.0:3000/auth/confirm?code=test",
      "/onboarding",
    ).toString()).toBe("https://destiny-seo.replit.app/onboarding");
  });
});
