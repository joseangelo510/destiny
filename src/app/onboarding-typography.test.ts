import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("onboarding response typography", () => {
  it("keeps typed responses regular weight without changing their established sizing", () => {
    const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

    expect(css).toContain(
      ".guided-onboarding-card input, .guided-onboarding-card textarea { font-weight: 400; }",
    );
    expect(css).toContain(
      ".guided-onboarding-card input, .guided-onboarding-card textarea, .guided-onboarding-card select { font-size: 17px; line-height: 1.55; }",
    );
  });
});
