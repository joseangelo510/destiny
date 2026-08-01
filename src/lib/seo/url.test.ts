import { describe, expect, it } from "vitest";
import { normalizeWebsite } from "./url";

describe("normalizeWebsite", () => {
  it("normalizes a public domain and strips credentials and fragments", () => {
    expect(normalizeWebsite("https://user:pass@www.Example.com/services#pricing")).toEqual({
      domain: "example.com",
      url: "https://www.example.com/services",
    });
  });

  it.each([
    "localhost",
    "http://127.0.0.1",
    "http://10.0.0.8",
    "http://[::1]",
    "http://printer.local",
    "http://service.internal",
  ])("rejects non-public target %s", (target) => {
    expect(() => normalizeWebsite(target)).toThrow("valid public website");
  });

  it("adds https when the protocol is omitted", () => {
    expect(normalizeWebsite("example.com").url).toBe("https://example.com/");
  });
});
