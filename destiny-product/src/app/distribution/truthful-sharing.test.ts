import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("distribution sharing truth", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

  it("keeps the three share composers available", () => {
    expect(source).toContain("https://www.linkedin.com/sharing/share-offsite/");
    expect(source).toContain("https://x.com/intent/post");
    expect(source).toContain("https://www.facebook.com/sharer/sharer.php");
  });

  it("labels the feature as guided sharing rather than verified publishing", () => {
    expect(source).toContain("2 · Guided sharing");
    expect(source).toContain("Open LinkedIn composer ↗");
    expect(source).toContain("Open X composer ↗");
    expect(source).toContain("Open Facebook composer ↗");
    expect(source).not.toContain("Share on LinkedIn ↗");
  });
});
