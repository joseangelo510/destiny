import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public homepage privacy guard", () => {
  it("does not expose real client names or domains in the demo", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8").toLowerCase();
    for (const privateName of ["clearcheck", "smartfast", "empowerly", "98junk", "logiccaffeine", "joseangelostudios"]) {
      expect(source).not.toContain(privateName);
    }
  });

  it("describes guided social sharing without inventing delivery proof", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toContain("guiding your distribution where it matters");
    expect(source).toContain("Share kit prepared for LinkedIn and X.");
    expect(source).toContain("guided sharing ready for LinkedIn and X");
    expect(source).not.toContain("Last week&apos;s article was shared.");
    expect(source).not.toContain("your first articles are live and shared");
  });
});
