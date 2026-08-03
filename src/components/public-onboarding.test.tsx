import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PublicOnboarding } from "./public-onboarding";

describe("PublicOnboarding momentum experience", () => {
  it("keeps the founder-led questions and presents them as a visible journey", () => {
    const html = renderToStaticMarkup(<PublicOnboarding />);
    const source = readFileSync(new URL("./public-onboarding.tsx", import.meta.url), "utf8");

    expect(html).toContain("Build the momentum to be found");
    expect(html).toContain("Your path");
    expect(html).toContain("Small steps. Real evidence. No SEO team required.");
    expect(html).toContain("Tell us about your business and the products or services you provide");
    expect(html).toContain("What problem are you solving with your products or services?");
    expect(source).toContain("Destiny uses the United States search database automatically");
    expect(source).not.toContain("Local market");
    expect(source).not.toContain("Search database country");
    expect(source).not.toContain("San Francisco, California");
    expect(source).not.toContain("<select");
    expect(html).toContain('aria-label="Start dictation for Tell us about your business and the products or services you provide"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Dictate");
    expect(html).toContain("Destiny will finish after 5 seconds of silence");
    expect(html).toContain('class="voice-microphone-icon"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Sound on");
    expect(html).not.toContain("destiny-compass");
  });
});
