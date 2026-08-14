import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public homepage privacy guard", () => {
  it("does not expose real client names or domains in the demo", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8").toLowerCase();
    for (const privateName of ["clearcheck", "smartfast", "empowerly", "98junk", "logiccaffeine", "joseangelostudios"]) {
      expect(source).not.toContain(privateName);
    }
  });
});
